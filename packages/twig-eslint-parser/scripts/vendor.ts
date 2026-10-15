import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type VendoredUnit = {
  readonly name: string;
  readonly patchPrefix: string;
  readonly upstreamSourceDirectory: string;
  readonly shippedDirectory: string;
  readonly listShippedFiles: (upstreamSourceRoot: string) => string[];
  readonly runUpstreamTests: (patchedRoot: string) => void;
};

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resolveDependency = createRequire(import.meta.url).resolve;

function runTwigLexerTests(patchedRoot: string): void {
  const testFiles = ['src/test/unit/lib/Lexer/index.ts', 'src/test/unit/lib/Token/index.ts', 'src/test/unit/lib/SyntaxError/index.ts'];
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
    files: testFiles,
  }));
  symlinkSync(resolve(resolveDependency('tape/package.json'), '../..'), join(patchedRoot, 'node_modules'), 'dir');

  execFileSync(process.execPath, [resolveDependency('typescript/bin/tsc'), '-p', patchedRoot], { stdio: 'inherit' });
  const compiledTests = testFiles.map((file) => join(patchedRoot, 'out', file.replace(/^src\//, '').replace(/\.ts$/, '.js')));
  const runner = compiledTests.map((file) => `require(${JSON.stringify(file)});`).join('');
  execFileSync(process.execPath, ['-e', runner], { cwd: patchedRoot, stdio: 'inherit' });
}

function runEsHtmlParserTests(patchedRoot: string): void {
  const vitest = join(dirname(resolveDependency('vitest/package.json')), 'vitest.mjs');
  const fileSnapshotShim = join(packageRoot, 'third_party/es-html-parser/test-support/jest-file-snapshot.ts');
  writeFileSync(join(patchedRoot, 'vitest.config.mjs'), `export default ${JSON.stringify({
    root: patchedRoot,
    resolve: { alias: { 'jest-file-snapshot': fileSnapshotShim } },
    test: { globals: true, include: ['src/**/*.spec.ts'] },
  })};\n`);
  execFileSync(process.execPath, [vitest, 'run', '--config', join(patchedRoot, 'vitest.config.mjs')], { cwd: patchedRoot, stdio: 'inherit' });
}

const units: readonly VendoredUnit[] = [
  {
    name: 'twig-lexer',
    patchPrefix: 'TL',
    upstreamSourceDirectory: 'src/main/lib',
    shippedDirectory: 'src/lexer',
    listShippedFiles: () => ['Lexer.ts', 'SyntaxError.ts', 'Token.ts', 'TokenType.ts'],
    runUpstreamTests: runTwigLexerTests,
  },
  {
    name: 'es-html-parser',
    patchPrefix: 'EHP',
    upstreamSourceDirectory: 'src',
    shippedDirectory: 'src/es-html-parser',
    listShippedFiles: (upstreamSourceRoot) => globSync('**/*.ts', { cwd: upstreamSourceRoot, exclude: (name) => name === '__tests__' }).filter((file) => !file.endsWith('.spec.ts')).sort(),
    runUpstreamTests: runEsHtmlParserTests,
  },
];

function vendorRootOf(unit: VendoredUnit): string {
  return join(packageRoot, 'third_party', unit.name);
}

function readPatchSeries(unit: VendoredUnit): string[] {
  const seriesPath = join(vendorRootOf(unit), 'patches', 'series');
  if (!existsSync(seriesPath)) return [];
  return readFileSync(seriesPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

function applyPatch(unit: VendoredUnit, patchName: string, targetDirectory: string): void {
  const patchPath = join(vendorRootOf(unit), 'patches', patchName);
  if (!existsSync(patchPath)) throw new Error(`Patch "${patchName}" is listed in ${unit.name}/patches/series but ${patchPath} does not exist.`);
  try {
    execFileSync('git', ['apply', '--whitespace=error-all', patchPath], { cwd: targetDirectory, stdio: 'pipe' });
  } catch (error) {
    const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr) : String(error);
    throw new Error(`Patch "${patchName}" no longer applies cleanly:\n${stderr}`);
  }
}

function materialisePatchedUpstream(unit: VendoredUnit, targetDirectory: string): void {
  cpSync(join(vendorRootOf(unit), 'pristine'), targetDirectory, { recursive: true });
  for (const patchName of readPatchSeries(unit)) applyPatch(unit, patchName, targetDirectory);
}

function withPatchedUpstream<Result>(unit: VendoredUnit, work: (patchedRoot: string) => Result): Result {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), `${unit.name}-`));
  try {
    materialisePatchedUpstream(unit, temporaryDirectory);
    return work(temporaryDirectory);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function findDriftedFiles(unit: VendoredUnit, patchedRoot: string): string[] {
  const shippedRoot = join(packageRoot, unit.shippedDirectory);
  const upstreamSourceRoot = join(patchedRoot, unit.upstreamSourceDirectory);
  const expectedFiles = unit.listShippedFiles(upstreamSourceRoot);
  const changed = expectedFiles.filter((file) => {
    const shippedPath = join(shippedRoot, file);
    return !existsSync(shippedPath) || !readFileSync(join(upstreamSourceRoot, file)).equals(readFileSync(shippedPath));
  });
  const extra = existsSync(shippedRoot) ? globSync('**/*.ts', { cwd: shippedRoot }).filter((file) => !expectedFiles.includes(file)) : [];
  return [...changed, ...extra.map((file) => `${file} (not from upstream)`)];
}

function checkShipped(unit: VendoredUnit): void {
  const driftedFiles = withPatchedUpstream(unit, (patchedRoot) => findDriftedFiles(unit, patchedRoot));
  if (driftedFiles.length > 0) {
    throw new Error(
      `${unit.shippedDirectory} does not match pristine + patches for: ${driftedFiles.join(', ')}.\n`
        + `Record the change as a patch in third_party/${unit.name}/patches, then run npm run vendor:write.`,
    );
  }
  console.log(`${unit.shippedDirectory} matches pristine + ${readPatchSeries(unit).length} patch(es).`);
}

function writeShipped(unit: VendoredUnit): void {
  withPatchedUpstream(unit, (patchedRoot) => {
    const shippedRoot = join(packageRoot, unit.shippedDirectory);
    const upstreamSourceRoot = join(patchedRoot, unit.upstreamSourceDirectory);
    const files = unit.listShippedFiles(upstreamSourceRoot);
    rmSync(shippedRoot, { recursive: true, force: true });
    for (const file of files) {
      mkdirSync(dirname(join(shippedRoot, file)), { recursive: true });
      cpSync(join(upstreamSourceRoot, file), join(shippedRoot, file));
    }
    console.log(`Wrote ${files.length} files to ${unit.shippedDirectory} from pristine + ${readPatchSeries(unit).length} patch(es).`);
  });
}

function createPatchWorkspace(unit: VendoredUnit, workspaceDirectory: string): void {
  if (existsSync(workspaceDirectory)) throw new Error(`${workspaceDirectory} already exists; choose an empty path.`);
  materialisePatchedUpstream(unit, workspaceDirectory);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: workspaceDirectory, stdio: 'pipe' });
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.name=vendor', '-c', 'user.email=vendor@localhost', 'commit', '-q', '-m', 'pristine + current patches');
  console.log(`Workspace ready at ${workspaceDirectory}. Edit it, then save a new patch with:\n`
    + `  git -C ${workspaceDirectory} diff > third_party/${unit.name}/patches/${unit.patchPrefix}-NN-short-name.patch`);
}

function selectUnits(names: readonly string[]): readonly VendoredUnit[] {
  if (names.length === 0) return units;
  return names.map((name) => {
    const unit = units.find((candidate) => candidate.name === name);
    if (!unit) throw new Error(`No vendored unit named ${name}. Known: ${units.map((candidate) => candidate.name).join(', ')}.`);
    return unit;
  });
}

const usage = 'Usage: node scripts/vendor.ts --check | --write | --test [unit...] | --workspace <unit> <empty directory>';
const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case '--check':
    selectUnits(rest).forEach(checkShipped);
    break;
  case '--write':
    selectUnits(rest).forEach(writeShipped);
    break;
  case '--test':
    selectUnits(rest).forEach((unit) => withPatchedUpstream(unit, unit.runUpstreamTests));
    break;
  case '--workspace': {
    const [name, directory] = rest;
    if (!name || !directory) throw new Error(usage);
    const [unit] = selectUnits([name]);
    if (unit) createPatchWorkspace(unit, resolve(directory));
    break;
  }
  default:
    throw new Error(usage);
}
