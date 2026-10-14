import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Check, CheckOutcome, Finding, PackageCorpus, Template } from '../../../tools/corpus/src/index.js';
import { parseForESLint, type UnconvertedTwigBlock } from '../src/index.js';
import { createOffsetLocator } from '../src/source-text.js';
import { findParityMismatches, type Golden } from './lexer/parity.js';
import { branchPairedEndTagCheck, compareWithHtmlOracle, twigRangesFromOracle } from './support/html-oracle.js';
import { checkRewritesKeepTheTree } from './support/metamorphic.js';
import { checkParserOutput, templateDefectChecks, type OutputIssue } from './support/output-checks.js';

type OracleResult = Partial<Golden> & { path: string; twig: string; error?: string; line?: number };

const oracleDirectory = resolve(import.meta.dirname, '../tools/twig-oracle');
const oracleScript = resolve(oracleDirectory, 'tokenize.php');
const oracleChunkSize = 500;

function unconvertedBlocksOf(source: string): readonly UnconvertedTwigBlock[] | undefined {
  try {
    return parseForESLint(source).services.twig.unconvertedBlocks;
  } catch {
    return undefined;
  }
}

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

const oracleResultsByPath = new Map<string, OracleResult>();

function* oracleResultsFor(templates: readonly Template[]): Generator<OracleResult> {
  yield* templates.flatMap((template) => oracleResultsByPath.get(template.path) ?? []);
  const uncached = templates.filter((template) => !oracleResultsByPath.has(template.path));
  for (let start = 0; start < uncached.length; start += oracleChunkSize) {
    for (const result of tokenizeWithTwig(uncached.slice(start, start + oracleChunkSize))) {
      oracleResultsByPath.set(result.path, result);
      yield result;
    }
  }
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
  run(templates, context): CheckOutcome {
    const skipped = oracleUnavailableReason();
    if (skipped !== undefined) return { findings: [], stats: {}, skipped };

    const templatesByPath = new Map(templates.map((template) => [template.path, template]));
    const findings: Finding[] = [];
    let comparedTokens = 0;
    let rejectedByTwig = 0;
    let index = 0;
    for (const result of oracleResultsFor(templates)) {
      context.progress(index, { findings: findings.length });
      index += 1;
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
    let notParsed = 0;
    for (const [index, template] of templates.entries()) {
      context.progress(index, { failures: findings.length });
      const blocks = unconvertedBlocksOf(template.source);
      if (blocks === undefined) {
        notParsed += 1;
        continue;
      }
      const locate = createOffsetLocator(template.source);
      for (const block of blocks) {
        findings.push({ check: 'parser/converts-every-block', severity: 'failure', template, message: `${template.source.slice(...block.range)} (${block.reason})`, line: locate(block.range[0]).line });
      }
    }
    return { findings, stats: { templates: templates.length, notParsed } };
  },
};

const outputMatchesSource: Check = {
  id: 'parser/output-matches-source',
  run(templates, context): CheckOutcome {
    const findings: Finding[] = [];
    const stats = { templates: templates.length, invalidTemplates: 0, elementsLeftOpen: 0, strayCloseTags: 0 };
    for (const [index, template] of templates.entries()) {
      context.progress(index, { findings: findings.length });
      for (const issue of checkParserOutput(template.source)) {
        if (issue.check === 'converts every Twig block') continue;
        if (issue.check === 'template is valid Twig and HTML') stats.invalidTemplates += 1;
        if (issue.check === 'html: element closes') stats.elementsLeftOpen += 1;
        if (issue.check === 'html: stray close tag') stats.strayCloseTags += 1;
        const severity = templateDefectChecks.has(issue.check) ? 'report' : 'failure';
        findings.push({ check: 'parser/output-matches-source', severity, template, message: `${issue.check}: ${issue.detail}`, ...(issue.line !== undefined && { line: issue.line }) });
      }
    }
    return { findings, stats };
  },
};

const templateDefectsInTheHtmlOracle: ReadonlySet<string> = new Set(['html-oracle: unmatched end tags', branchPairedEndTagCheck]);

function htmlOracleIssues(template: Template, golden: Golden): readonly OutputIssue[] | undefined {
  let ast: unknown;
  try {
    ast = parseForESLint(template.source).ast;
  } catch {
    return undefined;
  }
  try {
    return compareWithHtmlOracle(template.source, twigRangesFromOracle(template.source, golden), ast);
  } catch (error) {
    return [{ check: 'html-oracle: reads the Twig oracle', detail: describeError(error) }];
  }
}

const htmlOracle: Check = {
  id: 'parser/html-oracle',
  run(templates, context): CheckOutcome {
    const skipped = oracleUnavailableReason();
    if (skipped !== undefined) return { findings: [], stats: {}, skipped };

    const templatesByPath = new Map(templates.map((template) => [template.path, template]));
    const findings: Finding[] = [];
    const stats = { templates: templates.length, rejectedByTwig: 0, notParsed: 0 };
    let index = 0;
    for (const result of oracleResultsFor(templates)) {
      context.progress(index, { findings: findings.length });
      index += 1;
      const template = templatesByPath.get(result.path);
      if (!template) throw new Error(`The Twig oracle returned a template that was not sent: ${result.path}`);
      if (result.error !== undefined) {
        stats.rejectedByTwig += 1;
        continue;
      }
      const issues = htmlOracleIssues(template, result as Golden);
      if (issues === undefined) {
        stats.notParsed += 1;
        continue;
      }
      for (const issue of issues) {
        const severity = templateDefectsInTheHtmlOracle.has(issue.check) ? 'report' : 'failure';
        findings.push({ check: 'parser/html-oracle', severity, template, message: `${issue.check}: ${issue.detail}`, ...(issue.line !== undefined && { line: issue.line }) });
      }
    }
    return { findings, stats };
  },
};

const metamorphic: Check = {
  id: 'parser/metamorphic',
  run(templates, context): CheckOutcome {
    const findings: Finding[] = [];
    for (const [index, template] of templates.entries()) {
      context.progress(index, { failures: findings.length });
      for (const issue of checkRewritesKeepTheTree(template.source)) {
        findings.push({ check: 'parser/metamorphic', severity: 'failure', template, message: `${issue.check}: ${issue.detail}`, ...(issue.line !== undefined && { line: issue.line }) });
      }
    }
    return { findings, stats: { templates: templates.length } };
  },
};

export default { package: 'twig-eslint-parser', checks: [lexerParity, convertsEveryBlock, outputMatchesSource, metamorphic, htmlOracle] } satisfies PackageCorpus;
