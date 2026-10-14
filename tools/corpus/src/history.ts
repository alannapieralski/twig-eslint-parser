import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { CheckOutcome, Finding, FixChange, Template } from './types.js';

type Severity = Finding['severity'] | 'fix';
type CheckHistory = { readonly skipped?: string; readonly templates: readonly string[]; readonly fingerprints: Readonly<Record<string, readonly string[]>> };
export type RunHistory = { readonly templates: Readonly<Record<string, string>>; readonly checks: Readonly<Record<string, CheckHistory>> };
export type CheckRun = { readonly id: string; readonly outcome: CheckOutcome };

type Counts = Readonly<Record<Severity, number>>;
type Example = { readonly template: string; readonly fingerprint: string };
export type CheckComparison = {
  readonly id: string;
  readonly comparableTemplates: number;
  readonly before: Counts;
  readonly after: Counts;
  readonly added: readonly Example[];
  readonly removed: readonly Example[];
  readonly wasSkipped: boolean;
  readonly isSkipped: boolean;
};

const severities: readonly Severity[] = ['report', 'failure', 'skipped', 'fix'];
const maxExamples = 5;
const strictChangeRatio = 0.2;
const strictMinimumChange = 5;

export const emptyHistory: RunHistory = { templates: {}, checks: {} };

export function templateKey(template: Template): string {
  return `${template.root} :: ${template.relativePath}`;
}

export function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

export function loadHistory(path: string): RunHistory {
  if (!existsSync(path)) return emptyHistory;
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || !('templates' in parsed) || !('checks' in parsed)) {
    throw new Error(`${path} is not a corpus run history. Delete it to start a new one.`);
  }
  return parsed as RunHistory;
}

export function writeHistory(path: string, history: RunHistory): void {
  writeFileSync(path, `${JSON.stringify(history)}\n`);
}

function fingerprintOf(finding: Finding): string {
  return `${finding.severity}|${finding.line ?? ''}|${finding.message}`;
}

function fingerprintOfChange(change: FixChange): string {
  return `fix||${hashText(change.after)}`;
}

function severityOf(fingerprint: string): Severity {
  return fingerprint.slice(0, fingerprint.indexOf('|')) as Severity;
}

export function recordRun(templates: readonly Template[], runs: readonly CheckRun[]): RunHistory {
  const templateHashes = Object.fromEntries(templates.map((template) => [templateKey(template), hashText(template.source)]));
  const checks = Object.fromEntries(runs.map(({ id, outcome }): [string, CheckHistory] => {
    const fingerprints: Record<string, string[]> = {};
    const add = (template: Template, fingerprint: string) => (fingerprints[templateKey(template)] ??= []).push(fingerprint);
    for (const finding of outcome.findings) add(finding.template, fingerprintOf(finding));
    for (const change of outcome.changes ?? []) add(change.template, fingerprintOfChange(change));
    for (const list of Object.values(fingerprints)) list.sort();
    return [id, { ...(outcome.skipped !== undefined && { skipped: outcome.skipped }), templates: Object.keys(templateHashes), fingerprints }];
  }));
  return { templates: templateHashes, checks };
}

export function mergeHistory(previous: RunHistory, current: RunHistory): RunHistory {
  const checks: Record<string, CheckHistory> = { ...previous.checks };
  for (const [id, check] of Object.entries(current.checks)) {
    const earlier = previous.checks[id];
    if (!earlier) {
      checks[id] = check;
      continue;
    }
    const rerun = new Set(check.templates);
    const keptFingerprints = Object.fromEntries(Object.entries(earlier.fingerprints).filter(([template]) => !rerun.has(template)));
    checks[id] = {
      ...(check.skipped !== undefined && { skipped: check.skipped }),
      templates: [...new Set([...earlier.templates, ...check.templates])],
      fingerprints: { ...keptFingerprints, ...check.fingerprints },
    };
  }
  return { templates: { ...previous.templates, ...current.templates }, checks };
}

function countBySeverity(fingerprints: readonly string[]): Counts {
  const counts: Record<Severity, number> = { report: 0, failure: 0, skipped: 0, fix: 0 };
  for (const fingerprint of fingerprints) counts[severityOf(fingerprint)] += 1;
  return counts;
}

function difference(from: readonly string[], to: readonly string[]): string[] {
  const remaining = new Map<string, number>();
  for (const item of to) remaining.set(item, (remaining.get(item) ?? 0) + 1);
  return from.filter((item) => {
    const count = remaining.get(item) ?? 0;
    if (count === 0) return true;
    remaining.set(item, count - 1);
    return false;
  });
}

export function compareRuns(previous: RunHistory, current: RunHistory): CheckComparison[] {
  return Object.entries(current.checks).flatMap(([id, check]): CheckComparison[] => {
    const earlier = previous.checks[id];
    if (!earlier) return [];
    const earlierTemplates = new Set(earlier.templates);
    const comparable = check.templates.filter((template) => earlierTemplates.has(template) && previous.templates[template] === current.templates[template]);
    const added: Example[] = [];
    const removed: Example[] = [];
    const beforeAll: string[] = [];
    const afterAll: string[] = [];
    for (const template of comparable) {
      const before = earlier.fingerprints[template] ?? [];
      const after = check.fingerprints[template] ?? [];
      beforeAll.push(...before);
      afterAll.push(...after);
      added.push(...difference(after, before).map((fingerprint) => ({ template, fingerprint })));
      removed.push(...difference(before, after).map((fingerprint) => ({ template, fingerprint })));
    }
    return [{
      id,
      comparableTemplates: comparable.length,
      before: countBySeverity(beforeAll),
      after: countBySeverity(afterAll),
      added,
      removed,
      wasSkipped: earlier.skipped !== undefined,
      isSkipped: check.skipped !== undefined,
    }];
  });
}

function isLargeSwing(before: number, after: number): boolean {
  if (before === after) return false;
  if (before === 0 || after === 0) return true;
  return Math.abs(after - before) >= strictMinimumChange && Math.abs(after - before) / before > strictChangeRatio;
}

export function describeStrictViolations(comparisons: readonly CheckComparison[]): string[] {
  return comparisons.flatMap((comparison) => {
    const { id, before, after } = comparison;
    const violations: string[] = [];
    if (comparison.isSkipped && !comparison.wasSkipped) violations.push(`${id} was skipped this time`);
    if (isLargeSwing(before.report, after.report)) violations.push(`${id} reports went from ${before.report} to ${after.report}`);
    if (isLargeSwing(before.fix, after.fix)) violations.push(`${id} fixed templates went from ${before.fix} to ${after.fix}`);
    if (after.skipped > before.skipped) violations.push(`${id} skipped templates rose from ${before.skipped} to ${after.skipped}`);
    return violations;
  });
}

function describeExample({ template, fingerprint }: Example): string {
  const [severity = '', line = '', ...message] = fingerprint.split('|');
  const location = line === '' ? template : `${template}:${line}`;
  return severity === 'fix' ? `${location}: fix output changed` : `${location}: ${severity} ${message.join('|')}`;
}

export function renderComparison(comparisons: readonly CheckComparison[], strictViolations: readonly string[] | undefined): string {
  const lines = ['', '## Changes since the last run', ''];
  if (comparisons.length === 0) return `${[...lines, 'No earlier run of these checks to compare with.'].join('\n')}\n`;
  lines.push('| Check | Templates compared | Reports | Failures | Fixed | Skipped | Added | Removed |', '|---|---|---|---|---|---|---|---|');
  for (const { id, comparableTemplates, before, after, added, removed } of comparisons) {
    const pair = (severity: Severity) => (before[severity] === after[severity] ? `${after[severity]}` : `${before[severity]} → ${after[severity]}`);
    lines.push(`| ${id} | ${comparableTemplates} | ${pair('report')} | ${pair('failure')} | ${pair('fix')} | ${pair('skipped')} | ${added.length} | ${removed.length} |`);
  }
  for (const { id, added, removed } of comparisons.filter((comparison) => comparison.added.length + comparison.removed.length > 0)) {
    lines.push('', `### ${id}`, '');
    for (const example of added.slice(0, maxExamples)) lines.push(`- added: ${describeExample(example)}`);
    if (added.length > maxExamples) lines.push(`- ... and ${added.length - maxExamples} more added`);
    for (const example of removed.slice(0, maxExamples)) lines.push(`- removed: ${describeExample(example)}`);
    if (removed.length > maxExamples) lines.push(`- ... and ${removed.length - maxExamples} more removed`);
  }
  if (strictViolations && strictViolations.length > 0) {
    lines.push('', '## Strict check failed', '', ...strictViolations.map((violation) => `- ${violation}`), '', 'Review the changes, then run again without --strict to record this run as the new comparison point.');
  }
  return `${lines.join('\n')}\n`;
}
