import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Check, CheckOutcome, Finding, PackageCorpus, Template } from '../../../tools/corpus/src/index.js';
import { parseForESLint } from '../src/index.js';
import { findParityMismatches, type Golden } from './lexer/parity.js';
import { checkParserOutput } from './support/output-checks.js';

type OracleResult = Partial<Golden> & { path: string; twig: string; error?: string; line?: number };

const oracleDirectory = resolve(import.meta.dirname, '../tools/twig-oracle');
const oracleScript = resolve(oracleDirectory, 'tokenize.php');

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function oracleUnavailableReason(): string | undefined {
  if (spawnSync('php', ['-v']).status !== 0) return 'PHP is not installed.';
  if (!existsSync(resolve(oracleDirectory, 'vendor/autoload.php'))) return 'Run composer install in packages/twig-eslint-parser/tools/twig-oracle.';
  return undefined;
}

function tokenizeWithTwig(templates: readonly Template[]): OracleResult[] {
  const output = execFileSync('php', [oracleScript, '--stdin'], {
    input: templates.map((template) => template.path).join('\n'),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });
  return output.split('\n').filter((line) => line !== '').map((line) => JSON.parse(line) as OracleResult);
}

function describeLexerMismatches(template: Template, golden: Golden): string[] {
  try {
    return findParityMismatches(template.source, golden);
  } catch (error) {
    return [`our lexer threw: ${describeError(error)}`];
  }
}

const lexerParity: Check = {
  id: 'parser/lexer-parity',
  run(templates): CheckOutcome {
    const skipped = oracleUnavailableReason();
    if (skipped !== undefined) return { findings: [], stats: {}, skipped };

    const templatesByPath = new Map(templates.map((template) => [template.path, template]));
    const findings: Finding[] = [];
    let comparedTokens = 0;
    let rejectedByTwig = 0;
    for (const result of tokenizeWithTwig(templates)) {
      const template = templatesByPath.get(result.path);
      if (!template) throw new Error(`The Twig oracle returned a template that was not sent: ${result.path}`);
      if (result.error !== undefined) {
        rejectedByTwig += 1;
        findings.push({ check: 'parser/lexer-parity', severity: 'report', template, message: `Twig rejects it: ${result.error}`, ...(result.line !== undefined && { line: result.line }) });
        continue;
      }
      comparedTokens += result.tokens?.length ?? 0;
      const mismatches = describeLexerMismatches(template, result as Golden);
      if (mismatches.length > 0) findings.push({ check: 'parser/lexer-parity', severity: 'failure', template, message: mismatches.slice(0, 5).join('; ') });
    }
    return { findings, stats: { templates: templates.length, comparedTokens, rejectedByTwig } };
  },
};

const convertsEveryBlock: Check = {
  id: 'parser/converts-every-block',
  run(templates, context): CheckOutcome {
    const findings: Finding[] = [];
    for (const [index, template] of templates.entries()) {
      context.progress(index, { failures: findings.length });
      try {
        for (const block of parseForESLint(template.source).services.twig.unconvertedBlocks) {
          findings.push({ check: 'parser/converts-every-block', severity: 'failure', template, message: `${template.source.slice(...block.range)} (${block.reason})` });
        }
      } catch (error) {
        findings.push({ check: 'parser/converts-every-block', severity: 'failure', template, message: `the parser threw: ${describeError(error)}` });
      }
    }
    return { findings, stats: { templates: templates.length } };
  },
};

const outputMatchesSource: Check = {
  id: 'parser/output-matches-source',
  run(templates, context): CheckOutcome {
    const findings: Finding[] = [];
    let unpairableElements = 0;
    for (const [index, template] of templates.entries()) {
      context.progress(index, { findings: findings.length });
      for (const issue of checkParserOutput(template.source)) {
        if (issue.check === 'parses') continue;
        const isUnpairable = issue.check === 'html: element closes';
        if (isUnpairable) unpairableElements += 1;
        findings.push({ check: 'parser/output-matches-source', severity: isUnpairable ? 'report' : 'failure', template, message: `${issue.check}: ${issue.detail}` });
      }
    }
    return { findings, stats: { templates: templates.length, unpairableElements } };
  },
};

export default { package: 'twig-eslint-parser', checks: [lexerParity, convertsEveryBlock, outputMatchesSource] } satisfies PackageCorpus;
