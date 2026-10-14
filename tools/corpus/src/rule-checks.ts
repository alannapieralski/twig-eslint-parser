import { ESLint, type Linter, type Rule } from 'eslint';
import type { FixKeeps } from './fix-invariants.js';
import { runLintCheck, type LintTarget, type RootLinter } from './lint-check.js';
import type { Check, Template } from './types.js';

export type RuleCorpusSettings = {
  readonly fixKeeps?: FixKeeps;
  readonly options?: readonly unknown[];
  readonly settings?: Linter.Config['settings'];
};

export type CorpusPlugin = {
  readonly rules: Record<string, Rule.RuleModule>;
  readonly configs: { readonly recommended: Linter.Config };
};

function createLinterPool(config: Linter.Config): (template: Template) => RootLinter {
  const lintersByRoot = new Map<string, ESLint>();
  return ({ root }) => {
    const existing = lintersByRoot.get(root);
    if (existing) return { linter: existing };
    const linter = new ESLint({ cwd: root, overrideConfigFile: true, fix: false, overrideConfig: [config] });
    lintersByRoot.set(root, linter);
    return { linter };
  };
}

function createRuleCheck(plugin: CorpusPlugin, prefix: string, ruleName: string, settings: RuleCorpusSettings): Check {
  const ruleId = `${prefix}/${ruleName}`;
  const { recommended } = plugin.configs;
  const config: Linter.Config = {
    ...recommended,
    rules: { [ruleId]: ['warn', ...(settings.options ?? [])] },
    settings: { ...recommended.settings, ...settings.settings },
  };
  const target: LintTarget = {
    check: ruleId,
    fixKeeps: settings.fixKeeps ?? 'code',
    isOwnMessage: (message) => message.ruleId === ruleId,
    describeMessage: (message) => message.message,
  };
  return { id: ruleId, rule: ruleId, run: (templates, context) => runLintCheck(target, createLinterPool(config), templates, context) };
}

export function ruleChecks(definition: {
  readonly plugin: CorpusPlugin;
  readonly prefix: string;
  readonly rules?: Readonly<Record<string, RuleCorpusSettings>>;
}): Check[] {
  const { plugin, prefix, rules = {} } = definition;
  const unknownRules = Object.keys(rules).filter((ruleName) => !(ruleName in plugin.rules));
  if (unknownRules.length > 0) throw new Error(`Corpus settings name rules that ${prefix} does not have: ${unknownRules.join(', ')}`);
  const fixableWithoutPromise = Object.entries(plugin.rules).filter(([ruleName, rule]) => rule.meta?.fixable !== undefined && rules[ruleName]?.fixKeeps === undefined).map(([ruleName]) => ruleName);
  if (fixableWithoutPromise.length > 0) {
    throw new Error(`${prefix} rules ${fixableWithoutPromise.join(', ')} are fixable, so their corpus settings must say what a fix keeps: fixKeeps 'layout', 'class-tokens' or 'code'.`);
  }
  return Object.keys(plugin.rules).map((ruleName) => createRuleCheck(plugin, prefix, ruleName, rules[ruleName] ?? {}));
}
