import { execFileSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findParityMismatches, type Golden } from './parity.js';

type OracleResult = Partial<Golden> & { path: string; twig: string; error?: string; line?: number };

const corpusDirectories = (process.env['TWIG_CORPUS'] ?? '').split(':').filter((directory) => directory !== '');
const oracleScript = resolve(import.meta.dirname, '../../tools/twig-oracle/tokenize.php');

function collectTemplatePaths(directories: string[]): string[] {
  return directories
    .flatMap((directory) => globSync('**/*.twig', { cwd: directory }).map((file) => resolve(directory, file)))
    .sort();
}

function tokenizeWithTwig(templatePaths: string[]): OracleResult[] {
  const output = execFileSync('php', [oracleScript, '--stdin'], {
    input: templatePaths.join('\n'),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });
  return output.split('\n').filter((line) => line !== '').map((line) => JSON.parse(line) as OracleResult);
}

function describeTemplateMismatches(result: OracleResult & Golden): string[] {
  try {
    return findParityMismatches(readFileSync(result.path, 'utf8'), result);
  } catch (error) {
    return [`our lexer threw: ${error instanceof Error ? error.message : String(error)}`];
  }
}

describe.skipIf(corpusDirectories.length === 0)('lexer parity with Twig on a local corpus (TWIG_CORPUS=dir:dir)', () => {
  it('matches Twig on every template Twig itself can lex', () => {
    const results = tokenizeWithTwig(collectTemplatePaths(corpusDirectories));
    const rejectedByTwig = results.filter((result) => result.error !== undefined);
    const mismatchReports = results
      .filter((result): result is OracleResult & Golden => result.tokens !== undefined)
      .map((result) => ({ path: result.path, mismatches: describeTemplateMismatches(result) }))
      .filter((report) => report.mismatches.length > 0)
      .map((report) => `${report.path}\n  ${report.mismatches.slice(0, 5).join('\n  ')}`);

    const comparedTokenCount = results.reduce((total, result) => total + (result.tokens?.length ?? 0), 0);
    console.info(
      `${results.length} templates, ${comparedTokenCount} Twig tokens compared; Twig ${results[0]?.twig} rejected ${rejectedByTwig.length}; ${mismatchReports.length} differ from Twig.`,
      ...rejectedByTwig.map((result) => `\n  Twig rejected ${result.path}: ${result.error} (line ${result.line})`),
    );
    expect(mismatchReports.join('\n')).toBe('');
  }, 600_000);
});
