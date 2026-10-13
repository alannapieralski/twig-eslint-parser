import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Rule } from 'eslint';
import twigParser from 'twig-eslint-parser';
import { describe, expect, it } from 'vitest';
import { findingKey } from '../src/baseline.js';
import { discoverTemplates, loadConfig } from '../src/config.js';
import { describeFixProblems } from '../src/fix-invariants.js';
import { createProgressReporter } from '../src/progress.js';
import { ruleChecks, type CorpusPlugin } from '../src/rule-checks.js';
import { selectChecks } from '../src/select.js';
import type { Check, Finding, Template } from '../src/types.js';

function createCorpusDirectory(files: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), 'corpus-test-'));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(directory, name, '..'), { recursive: true });
    writeFileSync(join(directory, name), content);
  }
  return directory;
}

function fixingRule(replaceWith: (source: string) => string): Rule.RuleModule {
  return {
    meta: { type: 'layout', fixable: 'code', schema: [] },
    create: (context) => ({
      Program: (node) => {
        const { text } = context.sourceCode;
        context.report({ node, message: 'rewrite', fix: (fixer) => fixer.replaceTextRange([0, text.length], replaceWith(text)) });
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
  it('accepts a whitespace-only change', () => {
    expect(describeFixProblems('<a  href="x">', '<a href="x">', 'whitespace')).toEqual([]);
  });

  it('rejects a change that is more than whitespace when the rule promises whitespace only', () => {
    expect(describeFixProblems('<a href="x">', '<a href="y">', 'whitespace')).toEqual(['the fix changes more than whitespace']);
  });

  it('allows other changes when the rule promises nothing', () => {
    expect(describeFixProblems('<a href="x">', '<a href="y">', undefined)).toEqual([]);
  });

  it('rejects a fix that leaves a template the parser can no longer read', () => {
    const problems = describeFixProblems('<p>x</p>', '<p>{{ </p>', undefined);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('no longer parses');
  });
});

describe('ruleChecks', () => {
  const template = (root: string): Template => ({ root, path: join(root, 'a.twig'), relativePath: 'a.twig', source: '<p>x</p>' });

  async function failuresOf(rule: Rule.RuleModule, fixKeeps?: 'whitespace'): Promise<readonly Finding[]> {
    const root = createCorpusDirectory({ 'a.twig': '<p>x</p>' });
    const [check] = ruleChecks({ plugin: pluginWith({ rewrite: rule }), prefix: 'fake', ...(fixKeeps && { rules: { rewrite: { fixKeeps } } }) });
    if (!check) throw new Error('No check was created.');
    const { findings } = await check.run([template(root)], { sampleSize: 0, progress: () => undefined });
    return findings.filter((finding) => finding.severity === 'failure');
  }

  it('creates one check per rule, named after the rule', () => {
    const checks = ruleChecks({ plugin: pluginWith({ one: fixingRule((s) => s), two: fixingRule((s) => s) }), prefix: 'fake' });
    expect(checks.map((check) => check.id)).toEqual(['fake/one', 'fake/two']);
  });

  it('fails loudly when the settings name a rule the plugin does not have', () => {
    expect(() => ruleChecks({ plugin: pluginWith({ one: fixingRule((s) => s) }), prefix: 'fake', rules: { missing: {} } })).toThrow('missing');
  });

  it('passes a fix that settles', async () => {
    expect(await failuresOf(fixingRule((source) => source.trim()))).toEqual([]);
  });

  it('catches a fix that keeps changing the template on every pass', async () => {
    const failures = await failuresOf(fixingRule((source) => ` ${source}`));
    expect(failures.map((failure) => failure.message)).toEqual(['the fix is not stable: a second pass changes the template again']);
  });

  it('catches a fix that changes more than whitespace when the rule promises whitespace only', async () => {
    const failures = await failuresOf(fixingRule((source) => source.replace('x', 'y')), 'whitespace');
    expect(failures.map((failure) => failure.message)).toContain('the fix changes more than whitespace');
  });

  it('lists a template it cannot parse as a skipped report instead of ignoring it', async () => {
    const root = createCorpusDirectory({ 'a.twig': '<div class="a"\n  <p>x</p>' });
    const [check] = ruleChecks({ plugin: pluginWith({ rewrite: fixingRule((s) => s) }), prefix: 'fake' });
    const brokenTemplate: Template = { root, path: join(root, 'a.twig'), relativePath: 'a.twig', source: '<div class="a"\n  <p>x</p>' };
    const { findings, stats } = await check!.run([brokenTemplate], { sampleSize: 0, progress: () => undefined });
    expect(findings.map((finding) => [finding.severity, finding.message])).toEqual([['report', expect.stringContaining('skipped, the template cannot be parsed')]]);
    expect(stats).toMatchObject({ unparseable: 1, reports: 1, withReports: 0 });
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
    expect(selectChecks(packages, {})).toHaveLength(2);
  });

  it('selects a rule by its full id or its short name', () => {
    expect(selectChecks(packages, { rule: 'twig-html/attrs-newline' })).toHaveLength(1);
    expect(selectChecks(packages, { rule: 'attrs-newline' })).toHaveLength(1);
  });

  it('selects one package', () => {
    expect(selectChecks(packages, { package: 'parser' }).map((selected) => selected.check.id)).toEqual(['parser/lexer']);
  });

  it('fails loudly, listing what is available, when nothing matches', () => {
    expect(() => selectChecks(packages, { rule: 'nope' })).toThrow('twig-html/attrs-newline');
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
