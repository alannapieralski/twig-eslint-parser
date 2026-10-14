import { ESLint, type Linter, type Rule } from 'eslint';
import { describeFixProblems, type FixKeeps } from './fix-invariants.js';
import type { Check, CheckContext, CheckOutcome, Finding, FixChange, Template } from './types.js';

export type RuleCorpusSettings = {
  readonly fixKeeps?: FixKeeps;
  readonly options?: readonly unknown[];
  readonly settings?: Linter.Config['settings'];
};

export type CorpusPlugin = {
  readonly rules: Record<string, Rule.RuleModule>;
  readonly configs: { readonly recommended: Linter.Config };
};

type TemplateInspection = {
  readonly isParseable: boolean;
  readonly reports: readonly Finding[];
  readonly failures: readonly Finding[];
  readonly skipped?: Finding;
  readonly change?: FixChange;
};

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createLinterPool(config: Linter.Config, fix: boolean): (root: string) => ESLint {
  const lintersByRoot = new Map<string, ESLint>();
  return (root) => {
    const existing = lintersByRoot.get(root);
    if (existing) return existing;
    const linter = new ESLint({ cwd: root, overrideConfigFile: true, fix, overrideConfig: [config] });
    lintersByRoot.set(root, linter);
    return linter;
  };
}

async function lintSource(linter: ESLint, template: Template, source: string) {
  const [result] = await linter.lintText(source, { filePath: template.path });
  if (!result) throw new Error('ESLint returned no result.');
  return result;
}

async function inspectTemplate(
  template: Template,
  check: string,
  fixKeeps: FixKeeps | undefined,
  reporter: ESLint,
  fixer: ESLint,
): Promise<TemplateInspection> {
  const reportRun = await lintSource(reporter, template, template.source);
  const parseError = reportRun.messages.find((message) => message.fatal);
  if (parseError) {
    const skipped: Finding = { check, severity: 'skipped', template, message: `the template cannot be parsed: ${parseError.message}`, line: parseError.line };
    return { isParseable: false, reports: [], failures: [], skipped };
  }

  const reports = reportRun.messages
    .filter((message) => message.ruleId === check)
    .map((message): Finding => ({ check, severity: 'report', template, message: message.message, line: message.line }));
  if (!reportRun.messages.some((message) => message.fix)) return { isParseable: true, reports, failures: [] };

  const fixRun = await lintSource(fixer, template, template.source);
  const fixed = fixRun.output ?? template.source;
  const problems = describeFixProblems(template.source, fixed, fixKeeps);
  const secondRun = await lintSource(fixer, template, fixed);
  if (secondRun.output !== undefined && secondRun.output !== fixed) problems.push('the fix is not stable: a second pass changes the template again');

  const failures = problems.map((message): Finding => ({ check, severity: 'failure', template, message, before: template.source, after: fixed }));
  const change = fixed === template.source ? undefined : { template, before: template.source, after: fixed };
  return { isParseable: true, reports, failures, ...(change && { change }) };
}

async function runRuleCheck(
  ruleId: string,
  config: Linter.Config,
  fixKeeps: FixKeeps | undefined,
  templates: readonly Template[],
  context: CheckContext,
): Promise<CheckOutcome> {
  const reporterFor = createLinterPool(config, false);
  const fixerFor = createLinterPool(config, true);
  const findings: Finding[] = [];
  const changes: FixChange[] = [];
  const stats = { templates: templates.length, ignored: 0, unparseable: 0, withReports: 0, reports: 0, fixed: 0 };

  for (const [index, template] of templates.entries()) {
    context.progress(index, { reports: stats.reports, fixed: stats.fixed, skipped: stats.ignored + stats.unparseable });
    try {
      if (await reporterFor(template.root).isPathIgnored(template.path)) {
        stats.ignored += 1;
        findings.push({ check: ruleId, severity: 'skipped', template, message: 'the plugin config ignores this template' });
        continue;
      }
      const inspection = await inspectTemplate(template, ruleId, fixKeeps, reporterFor(template.root), fixerFor(template.root));
      if (!inspection.isParseable) stats.unparseable += 1;
      if (inspection.reports.length > 0) stats.withReports += 1;
      stats.reports += inspection.reports.length;
      findings.push(...inspection.reports, ...inspection.failures);
      if (inspection.skipped) findings.push(inspection.skipped);
      if (!inspection.change) continue;
      stats.fixed += 1;
      if (context.sampleSize > 0) changes.push(inspection.change);
    } catch (error) {
      findings.push({ check: ruleId, severity: 'failure', template, message: `the rule crashed: ${describeError(error)}` });
    }
  }
  return { findings, stats, changes };
}

function createRuleCheck(plugin: CorpusPlugin, prefix: string, ruleName: string, settings: RuleCorpusSettings): Check {
  const ruleId = `${prefix}/${ruleName}`;
  const { recommended } = plugin.configs;
  const config: Linter.Config = {
    ...recommended,
    rules: { [ruleId]: ['warn', ...(settings.options ?? [])] },
    settings: { ...recommended.settings, ...settings.settings },
  };
  return { id: ruleId, rule: ruleId, run: (templates, context) => runRuleCheck(ruleId, config, settings.fixKeeps, templates, context) };
}

export function ruleChecks(definition: {
  readonly plugin: CorpusPlugin;
  readonly prefix: string;
  readonly rules?: Readonly<Record<string, RuleCorpusSettings>>;
}): Check[] {
  const { plugin, prefix, rules = {} } = definition;
  const unknownRules = Object.keys(rules).filter((ruleName) => !(ruleName in plugin.rules));
  if (unknownRules.length > 0) throw new Error(`Corpus settings name rules that ${prefix} does not have: ${unknownRules.join(', ')}`);
  return Object.keys(plugin.rules).map((ruleName) => createRuleCheck(plugin, prefix, ruleName, rules[ruleName] ?? {}));
}
