import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendorRoot = join(repositoryRoot, 'third_party/twig-lexer');
const pristineRoot = join(vendorRoot, 'pristine');
const patchesRoot = join(vendorRoot, 'patches');
const shippedLexerRoot = join(repositoryRoot, 'src/lexer');
const upstreamLibraryDirectory = 'src/main/lib';
const shippedLexerFiles = ['Lexer.ts', 'SyntaxError.ts', 'Token.ts', 'TokenType.ts'];
const upstreamTestFiles = [
  'src/test/unit/lib/Lexer/index.ts',
  'src/test/unit/lib/Token/index.ts',
  'src/test/unit/lib/SyntaxError/index.ts',
];

function readPatchSeries(): string[] {
  const seriesPath = join(patchesRoot, 'series');
  if (!existsSync(seriesPath)) return [];

  return readFileSync(seriesPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

function applyPatch(patchName: string, targetDirectory: string): void {
  const patchPath = join(patchesRoot, patchName);
  if (!existsSync(patchPath)) {
    throw new Error(`Patch "${patchName}" is listed in patches/series but ${patchPath} does not exist.`);
  }

  try {
    execFileSync('git', ['apply', '--whitespace=error-all', patchPath], { cwd: targetDirectory, stdio: 'pipe' });
  } catch (error) {
    const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr) : String(error);
    throw new Error(`Patch "${patchName}" no longer applies cleanly:\n${stderr}`);
  }
}

function materialisePatchedUpstream(targetDirectory: string): void {
  cpSync(pristineRoot, targetDirectory, { recursive: true });
  for (const patchName of readPatchSeries()) applyPatch(patchName, targetDirectory);
}

function withPatchedUpstream<Result>(work: (patchedRoot: string) => Result): Result {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'twig-lexer-'));
  try {
    materialisePatchedUpstream(temporaryDirectory);
    return work(temporaryDirectory);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function findDriftedLexerFiles(patchedRoot: string): string[] {
  return shippedLexerFiles.filter((fileName) => {
    const shippedPath = join(shippedLexerRoot, fileName);
    if (!existsSync(shippedPath)) return true;

    const expected = readFileSync(join(patchedRoot, upstreamLibraryDirectory, fileName));
    return !expected.equals(readFileSync(shippedPath));
  });
}

function checkShippedLexer(): void {
  const driftedFiles = withPatchedUpstream(findDriftedLexerFiles);
  if (driftedFiles.length > 0) {
    throw new Error(
      `src/lexer does not match pristine + patches for: ${driftedFiles.join(', ')}.\n`
        + 'Record the change as a patch in third_party/twig-lexer/patches, then run npm run vendor:write.',
    );
  }
  console.log(`src/lexer matches pristine + ${readPatchSeries().length} patch(es).`);
}

function writeShippedLexer(): void {
  withPatchedUpstream((patchedRoot) => {
    mkdirSync(shippedLexerRoot, { recursive: true });
    for (const fileName of shippedLexerFiles) {
      cpSync(join(patchedRoot, upstreamLibraryDirectory, fileName), join(shippedLexerRoot, fileName));
    }
  });
  console.log(`Wrote ${shippedLexerFiles.length} files to src/lexer from pristine + ${readPatchSeries().length} patch(es).`);
}

function createPatchWorkspace(workspaceDirectory: string): void {
  if (existsSync(workspaceDirectory)) throw new Error(`${workspaceDirectory} already exists; choose an empty path.`);

  materialisePatchedUpstream(workspaceDirectory);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: workspaceDirectory, stdio: 'pipe' });
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.name=vendor', '-c', 'user.email=vendor@localhost', 'commit', '-q', '-m', 'pristine + current patches');
  console.log(`Workspace ready at ${workspaceDirectory}. Edit it, then save a new patch with:\n`
    + `  git -C ${workspaceDirectory} diff > third_party/twig-lexer/patches/TL-NN-short-name.patch`);
}

function runUpstreamTests(): void {
  withPatchedUpstream((patchedRoot) => {
    writeFileSync(join(patchedRoot, 'package.json'), JSON.stringify({ type: 'commonjs' }));
    writeFileSync(join(patchedRoot, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'es2017',
        module: 'nodenext',
        moduleResolution: 'nodenext',
        noImplicitAny: true,
        strict: false,
        esModuleInterop: false,
        ignoreDeprecations: '6.0',
        skipLibCheck: true,
        types: ['node', 'tape'],
        rootDir: 'src',
        outDir: 'out',
      },
      files: upstreamTestFiles,
    }));
    symlinkSync(join(repositoryRoot, 'node_modules'), join(patchedRoot, 'node_modules'), 'dir');

    execFileSync(join(repositoryRoot, 'node_modules/.bin/tsc'), ['-p', patchedRoot], { stdio: 'inherit' });
    const compiledTests = upstreamTestFiles.map((file) => join(patchedRoot, 'out', file.replace(/^src\//, '').replace(/\.ts$/, '.js')));
    const runner = compiledTests.map((file) => `require(${JSON.stringify(file)});`).join('');
    execFileSync(process.execPath, ['-e', runner], { cwd: patchedRoot, stdio: 'inherit' });
  });
}

const [command, argument] = process.argv.slice(2);

switch (command) {
  case '--check':
    checkShippedLexer();
    break;
  case '--write':
    writeShippedLexer();
    break;
  case '--test':
    runUpstreamTests();
    break;
  case '--workspace':
    if (!argument) throw new Error('Usage: node scripts/vendor-twig-lexer.ts --workspace <empty directory>');
    createPatchWorkspace(resolve(argument));
    break;
  default:
    throw new Error('Usage: node scripts/vendor-twig-lexer.ts --check | --write | --test | --workspace <dir>');
}
