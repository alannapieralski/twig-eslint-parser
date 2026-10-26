import { parseForESLint } from '../../src/index.js';
import { createOffsetLocator } from '../../src/source-text.js';
import { groupTwigBlocks } from '../../src/twig/blocks.js';
import { tokenizeTwig } from '../../src/twig/tokens.js';
import { branchPairedEndTagCheck, compareWithHtmlOracle, twigRangesFromOracle } from './html-oracle.js';
import { checkParserOutput } from './output-checks.js';
import type { Golden } from '../lexer/parity.js';
import type { TwigRange } from './html-oracle.js';
import type { OutputIssue } from './output-checks.js';

export type DamageCause = 'unparseable' | 'twig-unconverted' | 'unread' | 'misread' | 'misplaced' | 'malformed-node' | 'branch-split' | 'template-defect';
export type LineStatus = 'parsed' | 'fault' | 'branchSplit' | 'templateDefect';
export type DamageSpan = { readonly cause: DamageCause; readonly startLine: number; readonly endLine: number; readonly detail: string };
export type TwigReading = { readonly kind: 'oracle'; readonly golden: Golden } | { readonly kind: 'rejected-by-twig' } | { readonly kind: 'own-lexer' };
export type LineCoverage = {
  readonly countedLines: number;
  readonly lineStatuses: Readonly<Record<LineStatus, number>>;
  readonly causeLines: Readonly<Partial<Record<DamageCause, number>>>;
  readonly spans: readonly DamageSpan[];
  readonly unlocatedIssues: number;
};

type Range = readonly [number, number];
type LocatedIssue = { readonly cause: DamageCause; readonly range: Range | undefined; readonly line: number | undefined; readonly detail: string };

export const damageCausesByPrecedence: readonly DamageCause[] = ['unparseable', 'twig-unconverted', 'unread', 'misread', 'misplaced', 'malformed-node', 'branch-split', 'template-defect'];

const statusOfCause: Readonly<Record<DamageCause, LineStatus>> = {
  'unparseable': 'fault',
  'twig-unconverted': 'fault',
  'unread': 'fault',
  'misread': 'fault',
  'misplaced': 'fault',
  'malformed-node': 'fault',
  'branch-split': 'branchSplit',
  'template-defect': 'templateDefect',
};
const causeOfCheck: Readonly<Record<string, DamageCause>> = {
  'template is valid Twig and HTML': 'unparseable',
  'parses': 'unparseable',
  'converts every Twig block': 'twig-unconverted',
  'html: source is covered': 'unread',
  'html: close tag is read': 'unread',
  'html: Twig block glued to a name': 'misread',
  'html-oracle: start tags': 'misread',
  'html-oracle: tag names': 'misread',
  'html-oracle: attributes': 'misread',
  'html-oracle: attribute names': 'misread',
  'html-oracle: attribute values': 'misread',
  'html-oracle: raw text': 'misread',
  'html-oracle: parents': 'misplaced',
  'html-oracle: end tags': 'misplaced',
  'html-oracle: implied end tags': 'misplaced',
  'html: element opened and closed in different Twig branches': 'branch-split',
  'html: element left open in a Twig branch': 'branch-split',
  [branchPairedEndTagCheck]: 'branch-split',
  'html: stray close tag': 'template-defect',
  'html: element closes': 'template-defect',
  'html-oracle: unmatched end tags': 'template-defect',
};
const lineBreakPattern = /\r\n|[\r\n\u2028\u2029]/;

function causeOf(check: string): DamageCause {
  return causeOfCheck[check] ?? 'malformed-node';
}

function countedLineNumbers(source: string): readonly number[] {
  return source.split(lineBreakPattern).flatMap((text, index) => (text.trim() === '' ? [] : [index + 1]));
}

const closingDelimiterTypes: ReadonlySet<string> = new Set(['VARIABLE_END', 'TAG_END', 'COMMENT_END']);
const closingDelimiterLength = 2;

function twigRangesFromOwnLexer(source: string): TwigRange[] {
  return groupTwigBlocks(tokenizeTwig(source)).map((block) => {
    const closingDelimiter = block.tokens.findLast((token) => closingDelimiterTypes.has(token.type));
    return { start: block.start, end: closingDelimiter ? closingDelimiter.start + closingDelimiterLength : block.end, kind: block.kind };
  });
}

function twigRangesOf(source: string, reading: TwigReading): TwigRange[] {
  return reading.kind === 'oracle' ? twigRangesFromOracle(source, reading.golden) : twigRangesFromOwnLexer(source);
}

function isParseFailure(issue: OutputIssue): boolean {
  return causeOf(issue.check) === 'unparseable';
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function oracleIssuesFor(source: string, reading: TwigReading): readonly OutputIssue[] {
  try {
    return compareWithHtmlOracle(source, twigRangesOf(source, reading), parseForESLint(source).ast, Infinity);
  } catch (error) {
    return [{ check: 'html-oracle: reads the Twig oracle', detail: describeError(error) }];
  }
}

function locate(issue: OutputIssue, cause: DamageCause): LocatedIssue {
  return { cause, range: issue.range, line: issue.line, detail: issue.detail };
}

function issuesToLocate(source: string, reading: TwigReading): readonly LocatedIssue[] {
  const outputIssues = checkParserOutput(source);
  const parseFailure = outputIssues.find(isParseFailure);
  if (parseFailure) {
    const cause = reading.kind === 'rejected-by-twig' ? 'template-defect' : 'unparseable';
    return [{ cause, range: [0, source.length], line: undefined, detail: parseFailure.detail }];
  }
  return [...outputIssues, ...oracleIssuesFor(source, reading)].map((issue) => locate(issue, causeOf(issue.check)));
}

function lineSpanOf(issue: LocatedIssue, lineOf: (offset: number) => number): readonly [number, number] | undefined {
  if (issue.range) {
    const [start, end] = issue.range;
    return [lineOf(start), lineOf(Math.max(start, end - 1))];
  }
  return issue.line === undefined ? undefined : [issue.line, issue.line];
}

function mergeSpans(spans: readonly DamageSpan[]): DamageSpan[] {
  const merged: DamageSpan[] = [];
  const sorted = [...spans].sort((first, second) => first.startLine - second.startLine || damageCausesByPrecedence.indexOf(first.cause) - damageCausesByPrecedence.indexOf(second.cause));
  for (const span of sorted) {
    const previous = merged.find((candidate) => candidate.cause === span.cause && span.startLine <= candidate.endLine + 1);
    if (!previous) {
      merged.push(span);
      continue;
    }
    merged[merged.indexOf(previous)] = { ...previous, endLine: Math.max(previous.endLine, span.endLine) };
  }
  return merged.sort((first, second) => first.startLine - second.startLine);
}

function winningCauseOf(line: number, spans: readonly DamageSpan[]): DamageCause | undefined {
  const covering = spans.filter((span) => span.startLine <= line && line <= span.endLine).map((span) => span.cause);
  return damageCausesByPrecedence.find((cause) => covering.includes(cause));
}

// Scores how many of a template's lines the parser read correctly, and names the damaged regions of the rest.
export function measureLineCoverage(source: string, reading: TwigReading): LineCoverage {
  const locateOffset = createOffsetLocator(source);
  const lineOf = (offset: number) => locateOffset(offset).line;
  const issues = issuesToLocate(source, reading);
  const unlocated = issues.filter((issue) => issue.range === undefined && issue.line === undefined);
  const rawSpans = issues.flatMap((issue): DamageSpan[] => {
    const lines = lineSpanOf(issue, lineOf);
    return lines ? [{ cause: issue.cause, startLine: lines[0], endLine: lines[1], detail: issue.detail }] : [];
  });
  const spans = mergeSpans(rawSpans);

  const lineStatuses: Record<LineStatus, number> = { parsed: 0, fault: 0, branchSplit: 0, templateDefect: 0 };
  const causeLines: Partial<Record<DamageCause, number>> = {};
  const countedLines = countedLineNumbers(source);
  for (const line of countedLines) {
    const cause = winningCauseOf(line, rawSpans);
    if (cause === undefined) {
      lineStatuses.parsed += 1;
      continue;
    }
    lineStatuses[statusOfCause[cause]] += 1;
    causeLines[cause] = (causeLines[cause] ?? 0) + 1;
  }
  return { countedLines: countedLines.length, lineStatuses, causeLines, spans, unlocatedIssues: unlocated.length };
}

export function statusOfDamage(cause: DamageCause): LineStatus {
  return statusOfCause[cause];
}
