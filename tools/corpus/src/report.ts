import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { findingKey } from './baseline.js';
import { unifiedDiff } from './diff.js';
import type { Check, CheckOutcome, Finding, FixChange } from './types.js';

export type CheckResult = {
  readonly package: string;
  readonly check: Check;
  readonly outcome: CheckOutcome;
  readonly seconds: number;
};

export type CheckReport = {
  readonly package: string;
  readonly id: string;
  readonly stats: Readonly<Record<string, number>>;
  readonly skipped?: string;
  readonly reports: number;
  readonly failures: number;
  readonly knownFailures: number;
  readonly newFailures: readonly Finding[];
  readonly seconds: number;
};

const maxFailureFilesPerCheck = 25;
const maxListedFailuresPerCheck = 10;

export function buildCheckReport({ package: packageName, check, outcome, seconds }: CheckResult, baseline: ReadonlySet<string>): CheckReport {
  const failures = outcome.findings.filter((finding) => finding.severity === 'failure');
  const newFailures = failures.filter((finding) => !baseline.has(findingKey(finding)));
  return {
    package: packageName,
    id: check.id,
    stats: outcome.stats,
    ...(outcome.skipped !== undefined && { skipped: outcome.skipped }),
    reports: outcome.findings.filter((finding) => finding.severity === 'report').length,
    failures: failures.length,
    knownFailures: failures.length - newFailures.length,
    newFailures,
    seconds,
  };
}

export function buildCheckReports(results: readonly CheckResult[], baseline: ReadonlySet<string>): CheckReport[] {
  return results.map((result) => buildCheckReport(result, baseline));
}

function checkDirectoryName(id: string): string {
  return id.replaceAll('/', '__');
}

function describeLocation(finding: Finding): string {
  return `${finding.template.root} :: ${finding.template.relativePath}${finding.line === undefined ? '' : `:${finding.line}`}`;
}

export function renderSummary(reports: readonly CheckReport[], templateCount: number, rootCount: number): string {
  const lines = [
    '# Corpus run',
    '',
    `${templateCount} templates from ${rootCount} roots.`,
    '',
    '| Check | Templates | Reports | Failures | New | Known | Seconds | Notes |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const report of reports) {
    const { templates = '', ...otherStats } = report.stats;
    const notes = report.skipped ?? Object.entries(otherStats).map(([name, value]) => `${name} ${value}`).join(', ');
    lines.push(`| ${report.id} | ${templates} | ${report.reports} | ${report.failures} | ${report.newFailures.length} | ${report.knownFailures} | ${report.seconds.toFixed(1)} | ${notes} |`);
  }
  for (const report of reports.filter((candidate) => candidate.newFailures.length > 0)) {
    lines.push('', `## New failures: ${report.id}`, '');
    for (const finding of report.newFailures.slice(0, maxListedFailuresPerCheck)) lines.push(`- ${describeLocation(finding)}: ${finding.message}`);
    const unlisted = report.newFailures.length - maxListedFailuresPerCheck;
    if (unlisted > 0) lines.push(`- ... and ${unlisted} more in findings.ndjson`);
  }
  return `${lines.join('\n')}\n`;
}

function statusOf(finding: Finding, baseline: ReadonlySet<string>): 'report' | 'skipped' | 'known' | 'new' {
  if (finding.severity !== 'failure') return finding.severity;
  return baseline.has(findingKey(finding)) ? 'known' : 'new';
}

function writeFindings(directory: string, results: readonly CheckResult[], baseline: ReadonlySet<string>): void {
  const lines = results.flatMap(({ outcome }) => outcome.findings.map((finding) => JSON.stringify({
    check: finding.check,
    status: statusOf(finding, baseline),
    root: finding.template.root,
    file: finding.template.relativePath,
    line: finding.line,
    message: finding.message,
  })));
  writeFileSync(join(directory, 'findings.ndjson'), lines.length === 0 ? '' : `${lines.join('\n')}\n`);
}

function writeFailureFiles(directory: string, results: readonly CheckResult[]): void {
  for (const { check, outcome } of results) {
    const withDiffs = outcome.findings.filter((finding) => finding.severity === 'failure' && finding.before !== undefined && finding.after !== undefined);
    if (withDiffs.length === 0) continue;
    const checkDirectory = join(directory, 'failures', checkDirectoryName(check.id));
    mkdirSync(checkDirectory, { recursive: true });
    withDiffs.slice(0, maxFailureFilesPerCheck).forEach((finding, index) => {
      const body = `${describeLocation(finding)}\n${finding.message}\n\n${unifiedDiff(finding.before ?? '', finding.after ?? '')}`;
      writeFileSync(join(checkDirectory, `${String(index + 1).padStart(2, '0')}-${basename(finding.template.path)}.txt`), body);
    });
  }
}

function evenlySpaced<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  const step = items.length / count;
  return Array.from({ length: count }, (_, index) => items[Math.floor(index * step)] as T);
}

function writeSamples(directory: string, results: readonly CheckResult[], sampleSize: number): void {
  for (const { check, outcome } of results) {
    const changes: readonly FixChange[] = outcome.changes ?? [];
    if (changes.length === 0 || sampleSize === 0) continue;
    const checkDirectory = join(directory, 'samples', checkDirectoryName(check.id));
    mkdirSync(checkDirectory, { recursive: true });
    evenlySpaced(changes, sampleSize).forEach((change, index) => {
      const body = `${change.template.root} :: ${change.template.relativePath}\n\n${unifiedDiff(change.before, change.after)}`;
      writeFileSync(join(checkDirectory, `${String(index + 1).padStart(2, '0')}-${basename(change.template.path)}.diff`), body);
    });
  }
}

export function writeReport(directory: string, input: {
  readonly results: readonly CheckResult[];
  readonly reports: readonly CheckReport[];
  readonly baseline: ReadonlySet<string>;
  readonly templateCount: number;
  readonly rootCount: number;
  readonly sampleSize: number;
}): string {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const summary = renderSummary(input.reports, input.templateCount, input.rootCount);
  writeFileSync(join(directory, 'summary.md'), summary);
  writeFileSync(join(directory, 'summary.json'), `${JSON.stringify(input.reports.map(({ newFailures, ...rest }) => ({ ...rest, newFailures: newFailures.length })), null, 2)}\n`);
  writeFindings(directory, input.results, input.baseline);
  writeFailureFiles(directory, input.results);
  writeSamples(directory, input.results, input.sampleSize);
  return summary;
}
