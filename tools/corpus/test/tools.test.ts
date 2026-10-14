import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Rule } from 'eslint';
import twigParser from 'twig-eslint-parser';
import { describe, expect, it } from 'vitest';
import { canaryRoot, evaluateCanaries, isExpectedCanaryFailure } from '../src/canaries.js';
import { findingKey, findStaleBaselineKeys, keepBaselineKeysOutsideTheRun } from '../src/baseline.js';
import { discoverTemplates, loadConfig } from '../src/config.js';
import { describeFixProblems, reviewFix, type FixKeeps } from '../src/fix-invariants.js';
import type { AppliedFix } from '../src/fixing.js';
import { compareRuns, describeStrictViolations, mergeHistory, recordRun } from '../src/history.js';
import { createProgressReporter } from '../src/progress.js';
import { ruleChecks, type CorpusPlugin } from '../src/rule-checks.js';
import { selectChecks } from '../src/select.js';
import type { Check, CheckOutcome, Finding, Template } from '../src/types.js';

function createCorpusDirectory(files: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), 'corpus-test-'));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(directory, name, '..'), { recursive: true });
    writeFileSync(join(directory, name), content);
  }
  return directory;
}

function fixingRule(replaceWith: (source: string) => string, { reportsWhenClean = false } = {}): Rule.RuleModule {
  return {
    meta: { type: 'layout', fixable: 'code', schema: [] },
    create: (context) => ({
      Program: (node) => {
        const { text } = context.sourceCode;
        const replacement = replaceWith(text);
        if (replacement === text && !reportsWhenClean) return;
        context.report({ node, message: 'rewrite', fix: (fixer) => fixer.replaceTextRange([0, text.length], replacement) });
      },
    }),
  };
}

function pluginWith(rules: Record<string, Rule.RuleModule>): CorpusPlugin {
  return {
    rules,
    configs: { recommended: { files: ['**/*.twig'], plugins: { fake: { rules } }, languageOptions: { parser: twigParser } } },
  };
}

describe('describeFixProblems', () => {
  it('accepts a change to the whitespace between attributes', () => {
    expect(describeFixProblems('<a  href="x"  id="y">', '<a\n  href="x"\n  id="y">', 'layout')).toEqual([]);
  });

  it('rejects a change inside an attribute value when the rule promises layout only', () => {
    expect(describeFixProblems('<a class="b  c">x</a>', '<a class="b c">x</a>', 'layout')).toEqual([
      'the fix changes more than the whitespace between tokens: "b  c" became "b c"',
    ]);
  });

  it('rejects a change to text when the rule promises layout only', () => {
    expect(describeFixProblems('<a href="x">y</a>', '<a href="x">z</a>', 'layout')).toEqual([
      'the fix changes more than the whitespace between tokens: "y" became "z"',
    ]);
  });

  it('allows other changes when the rule only promises valid code', () => {
    expect(describeFixProblems('<a href="x">', '<a href="y">', 'code')).toEqual([]);
  });

  it('rejects a fix that changes the Twig blocks even when the rule only promises valid code', () => {
    expect(describeFixProblems('{% if a %}b{% endif %}', '{% if a %}b{% endif %}{% if c %}{% endif %}', 'code')[0]).toContain('the fix changes the Twig blocks');
  });

  it('rejects a fix that leaves a template the parser can no longer read', () => {
    const problems = describeFixProblems('<p>x</p>', '<p>{{ </p>', 'code');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('no longer parses');
  });
});

describe('ruleChecks', () => {
  const template = (root: string, source = '<p>x</p>'): Template => ({ root, path: join(root, 'a.twig'), relativePath: 'a.twig', source });

  async function failuresOf(rule: Rule.RuleModule, fixKeeps: FixKeeps = 'code'): Promise<readonly Finding[]> {
    const root = createCorpusDirectory({ 'a.twig': '<p>x</p>' });
    const [check] = ruleChecks({ plugin: pluginWith({ rewrite: rule }), prefix: 'fake', rules: { rewrite: { fixKeeps } } });
    if (!check) throw new Error('No check was created.');
    const { findings } = await check.run([template(root)], { sampleSize: 0, roots: new Map(), progress: () => undefined });
    return findings.filter((finding) => finding.severity === 'failure');
  }

  it('creates one check per rule, named after the rule', () => {
    const checks = ruleChecks({ plugin: pluginWith({ one: fixingRule((s) => s), two: fixingRule((s) => s) }), prefix: 'fake', rules: { one: { fixKeeps: 'code' }, two: { fixKeeps: 'code' } } });
    expect(checks.map((check) => check.id)).toEqual(['fake/one', 'fake/two']);
  });

  it('fails loudly when the settings name a rule the plugin does not have', () => {
    expect(() => ruleChecks({ plugin: pluginWith({ one: fixingRule((s) => s) }), prefix: 'fake', rules: { missing: {} } })).toThrow('missing');
  });

  it('fails loudly when a fixable rule does not say what its fix keeps', () => {
    expect(() => ruleChecks({ plugin: pluginWith({ one: fixingRule((s) => s) }), prefix: 'fake' })).toThrow('fixKeeps');
  });

  it('passes a fix that settles', async () => {
    expect(await failuresOf(fixingRule((source) => source.replace('<p>', '<p class="a">')))).toEqual([]);
  });

  it('catches a fix that keeps changing the template on every pass', async () => {
    const failures = await failuresOf(fixingRule((source) => ` ${source}`));
    expect(failures.map((failure) => failure.message)).toEqual(['the fix does not settle: the template still changes after 10 passes']);
  });

  it('catches a fix that flips between two versions of the template', async () => {
    const failures = await failuresOf(fixingRule((source) => (source.endsWith('\n') ? source.slice(0, -1) : `${source}\n`)));
    expect(failures.map((failure) => failure.message)).toEqual(['the fix oscillates: pass 2 brings back an earlier version of the template']);
  });

  it('catches a fix that does not resolve its own report', async () => {
    const failures = await failuresOf(fixingRule((source) => source, { reportsWhenClean: true }));
    expect(failures.map((failure) => failure.message)).toEqual(['the fix does not resolve its own report: applying it changes nothing and the report stays']);
  });

  it('catches a fix that changes text when the rule promises layout only', async () => {
    const failures = await failuresOf(fixingRule((source) => source.replace('x', 'y')), 'layout');
    expect(failures.map((failure) => failure.message)).toEqual(['the fix changes more than the whitespace between tokens: "x" became "y"']);
  });

  it('lists a template it cannot parse as skipped instead of ignoring it', async () => {
    const source = '<div class="a"\n  <p>x</p>';
    const root = createCorpusDirectory({ 'a.twig': source });
    const [check] = ruleChecks({ plugin: pluginWith({ rewrite: fixingRule((s) => s) }), prefix: 'fake', rules: { rewrite: { fixKeeps: 'code' } } });
    if (!check) throw new Error('No check was created.');
    const { findings, stats } = await check.run([template(root, source)], { sampleSize: 0, roots: new Map(), progress: () => undefined });
    expect(findings.map((finding) => [finding.severity, finding.message])).toEqual([['skipped', expect.stringContaining('the template cannot be parsed')]]);
    expect(stats).toMatchObject({ unparseable: 1, reports: 0, withReports: 0 });
  });

  it('lists a template the plugin config ignores as skipped instead of counting it as clean', async () => {
    const root = createCorpusDirectory({ 'a.twig': '<p>x</p>' });
    const plugin = pluginWith({ rewrite: fixingRule((s) => s) });
    const [check] = ruleChecks({ plugin: { ...plugin, configs: { recommended: { ...plugin.configs.recommended, ignores: ['**/a.twig'] } } }, prefix: 'fake', rules: { rewrite: { fixKeeps: 'code' } } });
    if (!check) throw new Error('No check was created.');
    const { findings, stats } = await check.run([template(root)], { sampleSize: 0, roots: new Map(), progress: () => undefined });
    expect(findings.map((finding) => [finding.severity, finding.message])).toEqual([['skipped', 'the plugin config ignores this template']]);
    expect(stats).toMatchObject({ ignored: 1, reports: 0, withReports: 0 });
  });

  it('catches a rule that crashes', async () => {
    const crashing: Rule.RuleModule = { meta: { type: 'problem', schema: [] }, create: () => { throw new Error('boom'); } };
    const failures = await failuresOf(crashing);
    expect(failures[0]?.message).toContain('the rule crashed');
  });
});

describe('selectChecks', () => {
  const check = (id: string, rule?: string): Check => ({ id, ...(rule && { rule }), run: () => ({ findings: [], stats: {} }) });
  const packages = [
    { package: 'parser', checks: [check('parser/lexer')] },
    { package: 'html', checks: [check('twig-html/attrs-newline', 'twig-html/attrs-newline')] },
  ];

  it('selects everything without filters', () => {
    expect(selectChecks(packages, { slow: false })).toHaveLength(2);
  });

  it('leaves slow checks out of an unfiltered run unless asked for', () => {
    const withSlow = [...packages, { package: 'tailwind', checks: [{ ...check('twig-tailwind/config:recommended'), isSlow: true }] }];
    expect(selectChecks(withSlow, { slow: false })).toHaveLength(2);
    expect(selectChecks(withSlow, { slow: true })).toHaveLength(3);
    expect(selectChecks(withSlow, { slow: false, package: 'tailwind' })).toHaveLength(1);
  });

  it('selects a rule by its full id or its short name', () => {
    expect(selectChecks(packages, { slow: false, rule: 'twig-html/attrs-newline' })).toHaveLength(1);
    expect(selectChecks(packages, { slow: false, rule: 'attrs-newline' })).toHaveLength(1);
  });

  it('selects one package', () => {
    expect(selectChecks(packages, { slow: false, package: 'parser' }).map((selected) => selected.check.id)).toEqual(['parser/lexer']);
  });

  it('fails loudly, listing what is available, when nothing matches', () => {
    expect(() => selectChecks(packages, { slow: false, rule: 'nope' })).toThrow('twig-html/attrs-newline');
  });
});

describe('config and discovery', () => {
  it('reads roots from TWIG_CORPUS and finds templates, skipping vendor and node_modules', () => {
    const root = createCorpusDirectory({ 'a.twig': 'a', 'sub/b.html.twig': 'b', 'node_modules/c.twig': 'c', 'vendor/d.twig': 'd', 'e.txt': 'e' });
    const config = loadConfig(tmpdir(), { TWIG_CORPUS: root });
    expect(discoverTemplates(config, { quick: false }).map((found) => found.relativePath)).toEqual(['a.twig', 'sub/b.html.twig']);
  });

  it('fails loudly when a root does not exist', () => {
    expect(() => loadConfig(tmpdir(), { TWIG_CORPUS: '/definitely/not/here' })).toThrow('do not exist');
  });

  it('fails loudly when there is no config and no environment variable', () => {
    expect(() => loadConfig(createCorpusDirectory({}), {})).toThrow('corpus.config.example.json');
  });

  it('needs a quick root for --quick', () => {
    const root = createCorpusDirectory({ 'a.twig': 'a' });
    expect(() => discoverTemplates(loadConfig(tmpdir(), { TWIG_CORPUS: root }), { quick: true })).toThrow('quick');
  });
});

describe('findingKey', () => {
  const finding = (path: string, source: string): Finding => ({ check: 'c', severity: 'failure', message: 'm', template: { root: '/r', path, relativePath: 'a', source } });

  it('stays the same when a template moves, and changes when its content does', () => {
    expect(findingKey(finding('/one/a.twig', 'same'))).toBe(findingKey(finding('/two/a.twig', 'same')));
    expect(findingKey(finding('/one/a.twig', 'same'))).not.toBe(findingKey(finding('/one/a.twig', 'other')));
  });
});

describe('createProgressReporter', () => {
  function reporterWith(isTerminal: boolean) {
    const written: string[] = [];
    let time = 0;
    const reporter = createProgressReporter({ write: (text) => { written.push(text); }, isTerminal }, () => time);
    return { reporter, written, advance: (milliseconds: number) => { time += milliseconds; } };
  }

  it('prints a phase as one prefixed line', () => {
    const { reporter, written } = reporterWith(false);
    reporter.phase('config: 2 roots');
    expect(written).toEqual(['[corpus] config: 2 roots\n']);
  });

  it('prints a line each time a log passes another 10%, with counts and speed', () => {
    const { reporter, written, advance } = reporterWith(false);
    const progress = reporter.track('1/1 a/b', 100);
    advance(2000);
    progress(5, { reports: 1 });
    progress(10, { reports: 3 });
    progress(15, { reports: 4 });
    expect(written).toEqual(['[corpus] 1/1 a/b  10/100 (10%)  reports 3  5 templates/s\n']);
  });

  it('prints a line after 5 seconds even without a new 10% step', () => {
    const { reporter, written, advance } = reporterWith(false);
    const progress = reporter.track('x', 1000);
    advance(5000);
    progress(3);
    expect(written).toHaveLength(1);
  });

  it('prints nothing at the start or the end, which the phase lines cover', () => {
    const { reporter, written, advance } = reporterWith(false);
    const progress = reporter.track('x', 10);
    advance(60_000);
    progress(0);
    progress(10);
    expect(written).toEqual([]);
  });

  it('rewrites one line on a terminal', () => {
    const { reporter, written, advance } = reporterWith(true);
    const progress = reporter.track('x', 100);
    advance(300);
    progress(2);
    expect(written[0]).toMatch(/^\r\x1b\[2K\[corpus\] x {2}2\/100/);
    expect(written[0]).not.toContain('\n');
  });
});

describe('run history', () => {
  const template = (relativePath: string, source = '<p>x</p>'): Template => ({ root: '/r', path: `/r/${relativePath}`, relativePath, source });
  const report = (on: Template, message = 'm', line = 1): Finding => ({ check: 'c', severity: 'report', template: on, message, line });
  const run = (templates: readonly Template[], findings: readonly Finding[], changes: CheckOutcome['changes'] = []) => recordRun(templates, [{ id: 'c', outcome: { findings, stats: {}, changes } }]);

  it('counts what changed on templates that are the same in both runs', () => {
    const [a, b] = [template('a.twig'), template('b.twig')];
    const [comparison] = compareRuns(run([a, b], [report(a), report(b)]), run([a, b], [report(a)]));
    expect(comparison).toMatchObject({ comparableTemplates: 2, before: { report: 2 }, after: { report: 1 }, added: [], removed: [{ template: '/r :: b.twig' }] });
  });

  it('leaves out templates whose content changed between runs', () => {
    const [comparison] = compareRuns(run([template('a.twig')], [report(template('a.twig'))]), run([template('a.twig', '<p>y</p>')], []));
    expect(comparison).toMatchObject({ comparableTemplates: 0, added: [], removed: [] });
  });

  it('notices when a fix produces different output', () => {
    const a = template('a.twig');
    const [comparison] = compareRuns(run([a], [], [{ template: a, before: a.source, after: '<p>y</p>' }]), run([a], [], [{ template: a, before: a.source, after: '<p>z</p>' }]));
    expect(comparison).toMatchObject({ before: { fix: 1 }, after: { fix: 1 } });
    expect(comparison?.added).toHaveLength(1);
  });

  it('keeps earlier results for templates a partial run did not cover', () => {
    const [a, b] = [template('a.twig'), template('b.twig')];
    const merged = mergeHistory(run([a, b], [report(a), report(b)]), run([a], []));
    const [comparison] = compareRuns(merged, run([a, b], [report(b)]));
    expect(comparison).toMatchObject({ before: { report: 1 }, after: { report: 1 }, added: [], removed: [] });
  });

  it('fails a strict run when a rule goes silent, swings, or a check is skipped', () => {
    const templates = Array.from({ length: 30 }, (_, index) => template(`${index}.twig`));
    const before = run(templates, templates.map((each) => report(each)));
    expect(describeStrictViolations(compareRuns(before, run(templates, [])))).toEqual(['c reports went from 30 to 0']);
    expect(describeStrictViolations(compareRuns(before, run(templates, templates.slice(0, 20).map((each) => report(each)))))).toEqual(['c reports went from 30 to 20']);
    expect(describeStrictViolations(compareRuns(before, run(templates, templates.slice(0, 27).map((each) => report(each)))))).toEqual([]);
    const skipped = recordRun(templates, [{ id: 'c', outcome: { findings: templates.map((each) => report(each)), stats: {}, skipped: 'PHP is missing' } }]);
    expect(describeStrictViolations(compareRuns(before, skipped))).toEqual(['c was skipped this time']);
  });
});

describe('baseline hygiene', () => {
  const key = (check: string, hash: string) => `${check}|${hash}|message`;

  it('finds baseline entries that no longer happen', () => {
    const baseline = new Set([key('c', 'aaa'), key('c', 'bbb'), key('other', 'ccc')]);
    expect(findStaleBaselineKeys(baseline, new Set(['c']), new Set([key('c', 'aaa')]), new Set(['aaa']), true)).toEqual([key('c', 'bbb')]);
    expect(findStaleBaselineKeys(baseline, new Set(['c']), new Set([key('c', 'aaa')]), new Set(['aaa']), false)).toEqual([]);
  });

  it('keeps entries for checks and templates outside a partial run when updating', () => {
    const baseline = new Set([key('c', 'aaa'), key('c', 'bbb'), key('other', 'aaa')]);
    expect(keepBaselineKeysOutsideTheRun(baseline, new Set(['c']), new Set(['aaa']))).toEqual([key('c', 'bbb'), key('other', 'aaa')]);
  });

  it('keys a failure without the numbers in its message', () => {
    const finding: Finding = { check: 'c', severity: 'failure', template: { root: '/r', path: '/r/a', relativePath: 'a', source: 'x' }, message: 'found 14, markup has 15' };
    expect(findingKey(finding)).toMatch(/\|found #, markup has #$/);
  });
});

describe('canaries', () => {
  const canary: Template = { root: canaryRoot, path: `${canaryRoot}/a.twig`, relativePath: 'a.twig', source: '<p>x</p>\n<p>y</p>' };
  const finding = (severity: Finding['severity'], line: number): Finding => ({ check: 'c', severity, template: canary, message: 'm', line });
  const expect_ = (entry: Record<string, unknown>) => [{ file: 'a.twig', check: 'c', ...entry }] as unknown as Parameters<typeof evaluateCanaries>[0];

  it('misses an expected report that did not happen', () => {
    expect(evaluateCanaries(expect_({ kind: 'reports', lines: [1, 2] }), 'c', [finding('report', 1)]).missed).toEqual(['canary a.twig:2 expected a report from c']);
  });

  it('misses a clean line that got a finding', () => {
    expect(evaluateCanaries(expect_({ kind: 'clean', lines: 'all' }), 'c', [finding('report', 2)]).missed).toEqual(['canary a.twig expected nothing from c']);
  });

  it('lists a pending expectation instead of failing, and says when it starts passing', () => {
    const pending = expect_({ kind: 'noFailures', lines: 'all', pending: 'later' });
    expect(evaluateCanaries(pending, 'c', [finding('failure', 1)])).toMatchObject({ missed: [], stillPending: [expect.stringContaining('later')] });
    expect(evaluateCanaries(pending, 'c', [finding('report', 1)])).toMatchObject({ missed: [], nowPassing: [expect.stringContaining('marked pending')] });
  });

  it('treats failures on a pending or deliberately failing canary as expected', () => {
    expect(isExpectedCanaryFailure(expect_({ kind: 'noFailures', lines: 'all', pending: 'later' }), finding('failure', 2))).toBe(true);
    expect(isExpectedCanaryFailure(expect_({ kind: 'failures', lines: [1] }), finding('failure', 2))).toBe(false);
    expect(isExpectedCanaryFailure(expect_({ kind: 'failures', lines: [1] }), finding('failure', 1))).toBe(true);
  });
});

describe('reviewFix with class-tokens', () => {
  const review = (source: string, fixed: string, applied: AppliedFix[]) => reviewFix(source, fixed, 'class-tokens', applied, {
    rewritesClasses: new Set(['canonical']),
    removesDuplicateClasses: new Set(['dedupe']),
  });
  const fix = (ruleId: string, replaced: string, replacement: string): AppliedFix => ({ ruleId, replaced, replacement });

  it('accepts reordering and rewrapping classes inside a group', () => {
    expect(review('<p class="b a">x</p>', '<p class="a b">x</p>', [fix('order', '"b a"', '"\n  a\n  b\n"')])).toEqual({ problems: [], notes: [] });
  });

  it('fails a fix that moves the [ ] and | group delimiters', () => {
    expect(review('<p class="a [ md:b ]">x</p>', '<p class="[ ] a md:b">x</p>', [fix('order', 'a [ md:b ]', '[ ] a md:b')]).problems).toEqual(['order moves classes between the groups that [ ] and | delimit']);
    expect(review('<p class="a [ b ] [ c ]">x</p>', '<p class="a [ b c ]">x</p>', [fix('dedupe', 'a [ b ] [ c ]', 'a [ b c ]')]).problems).toEqual(['dedupe moves or removes class group delimiters: [ ] [ ] became [ ]']);
  });

  it('fails a fix that moves classes across a | delimiter', () => {
    expect(review('<p class="a | b c">x</p>', '<p class="b | a c">x</p>', [fix('order', 'a | b c', 'b | a c')]).problems).toEqual(['order moves classes between the groups that [ ] and | delimit']);
  });

  it('fails a fix that drops a class', () => {
    expect(review('<p class="a b">x</p>', '<p class="a">x</p>', [fix('order', 'a b', 'a')]).problems).toEqual(['order changes the classes: removes b, adds none']);
  });

  it('notes a duplicate removal only when the class really is duplicated', () => {
    expect(review('<p class="a b b">x</p>', '<p class="a b">x</p>', [fix('dedupe', ' b', '')])).toEqual({ problems: [], notes: ['dedupe removes duplicate classes'] });
    expect(review('<p class="a b">x</p>', '<p class="a">x</p>', [fix('dedupe', ' b', '')]).problems).toHaveLength(1);
  });

  it('notes class rewrites from a rule whose job is to rewrite them', () => {
    expect(review('<p class="w-6 h-6">x</p>', '<p class="size-6">x</p>', [fix('canonical', 'w-6 h-6', 'size-6')])).toEqual({ problems: [], notes: ['canonical rewrites classes: w-6 h-6 became size-6'] });
  });

  it('fails a fix that changes Twig inside a class list', () => {
    expect(review('<p class="a {{ b }}">x</p>', '<p class="a {{b}}">x</p>', [fix('order', 'a {{ b }}', 'a {{b}}')]).problems).toEqual(['order changes Twig inside a class list']);
  });
});
