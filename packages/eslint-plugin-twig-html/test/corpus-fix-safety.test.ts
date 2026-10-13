import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import { parseForESLint } from 'twig-eslint-parser';
import { describe, expect, it } from 'vitest';
import twigHtml from '../src/index.js';

const corpusDirectories = (process.env['TWIG_CORPUS'] ?? '').split(':').filter((directory) => directory !== '');
const ignoredDirectories = new Set(['node_modules', 'vendor', '.git']);

function templatePaths(directory: string): string[] {
  return globSync('**/*.twig', { cwd: directory, exclude: (name) => ignoredDirectories.has(name) }).map((file) => resolve(directory, file)).sort();
}

function layoutLinter(directory: string, fix: boolean): ESLint {
  return new ESLint({ cwd: directory, overrideConfigFile: true, fix, overrideConfig: [twigHtml.configs.recommended] });
}

function unconvertedBlockCount(code: string): number {
  return parseForESLint(code).services.twig.unconvertedBlocks.length;
}

function describeFixProblems(code: string, fixed: string): string[] {
  const problems: string[] = [];
  if (fixed.replace(/\s+/g, '') !== code.replace(/\s+/g, '')) problems.push('changes more than whitespace');
  try {
    if (unconvertedBlockCount(fixed) !== unconvertedBlockCount(code)) problems.push('changes how many Twig blocks the parser can read');
  } catch (error) {
    problems.push(`no longer parses: ${error instanceof Error ? error.message : String(error)}`);
  }
  return problems;
}

describe.skipIf(corpusDirectories.length === 0)('twig-html/attrs-newline on a local template corpus (TWIG_CORPUS=dir:dir)', () => {
  it.each(corpusDirectories)('fixes every template in %s safely and settles after one pass', async (directory) => {
    const linter = layoutLinter(directory, true);
    const reports: string[] = [];
    for (const path of templatePaths(directory)) {
      const code = readFileSync(path, 'utf8');
      const [firstPass] = await linter.lintText(code, { filePath: path });
      if (firstPass?.messages.some((message) => message.fatal)) continue;
      const fixed = firstPass?.output ?? code;
      const problems = describeFixProblems(code, fixed);
      const [secondPass] = await linter.lintText(fixed, { filePath: path });
      if (secondPass?.output !== undefined && secondPass.output !== fixed) problems.push('is not stable: a second pass changes it again');
      if (problems.length > 0) reports.push(`${path}: ${problems.join('; ')}`);
    }
    expect(reports.join('\n')).toBe('');
  }, 600_000);
});
