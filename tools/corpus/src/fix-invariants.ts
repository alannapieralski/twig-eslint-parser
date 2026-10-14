import { parseForESLint, type TwigParseResult } from 'twig-eslint-parser';
import type { AppliedFix } from './fixing.js';

export type FixKeeps = 'layout' | 'class-tokens' | 'code';
export type FixReview = { readonly problems: readonly string[]; readonly notes: readonly string[] };
export type ClassRuleRoles = { readonly rewritesClasses?: ReadonlySet<string>; readonly removesDuplicateClasses?: ReadonlySet<string> };
type ClassList = { readonly delimiters: string; readonly groups: readonly (readonly string[])[]; readonly twig: readonly string[] };

type Range = readonly [number, number];
type Leaf = { readonly type: string; readonly range: Range };
type ParsedTemplate = { readonly result: TwigParseResult } | { readonly error: string };

const keysOutsideTheHtmlTree = new Set(['parent', 'loc', 'range', 'parts', 'stylesheet']);
const cubeDelimiters = new Set(['[', ']', '|', '][']);
const twigSpan = /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\}/g;

function parse(code: string): ParsedTemplate {
  try {
    return { result: parseForESLint(code) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function collectLeaves(value: unknown, leaves: Leaf[] = [], seen = new Set<object>()): Leaf[] {
  if (typeof value !== 'object' || value === null || seen.has(value)) return leaves;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((child) => collectLeaves(child, leaves, seen));
    return leaves;
  }
  const node = value as Record<string, unknown>;
  if (typeof node['type'] === 'string' && typeof node['value'] === 'string' && Array.isArray(node['range'])) leaves.push(node as unknown as Leaf);
  for (const [key, child] of Object.entries(node)) {
    if (!keysOutsideTheHtmlTree.has(key)) collectLeaves(child, leaves, seen);
  }
  return leaves;
}

function layoutTokens(code: string, result: TwigParseResult): string[] {
  return collectLeaves(result.ast.body)
    .sort((first, second) => first.range[0] - second.range[0])
    .map((leaf) => {
      const text = code.slice(...leaf.range);
      return leaf.type === 'Text' ? text.trim() : text;
    })
    .filter((text) => text !== '');
}

function twigBlockShapes(result: TwigParseResult): string[] {
  return result.services.twig.blocks.map((block) => `${block.kind}:${block.tagName ?? ''}`);
}

function describeFirstDifference(before: readonly string[], after: readonly string[]): string | undefined {
  const length = Math.max(before.length, after.length);
  for (let index = 0; index < length; index += 1) {
    if (before[index] === after[index]) continue;
    const show = (text: string | undefined) => (text === undefined ? 'nothing' : JSON.stringify(text.slice(0, 50)));
    return `${show(before[index])} became ${show(after[index])}`;
  }
  return undefined;
}

function withoutSurroundingQuotes(text: string): string {
  const trimmed = text.trim();
  const quote = trimmed[0];
  return quote !== undefined && '"\'`'.includes(quote) && trimmed.endsWith(quote) && trimmed.length > 1 ? trimmed.slice(1, -1) : trimmed;
}

function readClassList(text: string): ClassList {
  const twig = text.match(twigSpan) ?? [];
  const tokens = withoutSurroundingQuotes(text).replace(twigSpan, ' ').split(/\s+/).filter((token) => token !== '');
  const groups: string[][] = [[]];
  let delimiters = '';
  for (const token of tokens) {
    if (cubeDelimiters.has(token)) {
      delimiters += ` ${token}`;
      groups.push([]);
    } else {
      groups.at(-1)?.push(token);
    }
  }
  return { delimiters, groups, twig };
}

function withoutItems(items: readonly string[], removed: ReadonlySet<string>): string[] {
  return [...new Set(items)].filter((item) => !removed.has(item));
}

function sameSet(first: readonly string[], second: readonly string[]): boolean {
  const firstSet = new Set(first);
  const secondSet = new Set(second);
  return firstSet.size === secondSet.size && [...firstSet].every((item) => secondSet.has(item));
}

function occursMoreThanOnce(source: string, className: string): boolean {
  const pattern = new RegExp(`(^|[\\s"'])${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s"']|$)`, 'g');
  return (source.match(pattern) ?? []).length > 1;
}

function reviewClassListFix(fix: AppliedFix, source: string, roles: ClassRuleRoles): FixReview {
  const before = readClassList(fix.replaced);
  const after = readClassList(fix.replacement);
  const rule = fix.ruleId ?? 'a rule';
  if (before.twig.join('\n') !== after.twig.join('\n')) return { problems: [`${rule} changes Twig inside a class list`], notes: [] };
  if (before.delimiters !== after.delimiters) {
    return { problems: [`${rule} moves or removes class group delimiters:${before.delimiters || ' none'} became${after.delimiters || ' none'}`], notes: [] };
  }
  const beforeClasses = before.groups.flat();
  const afterClasses = after.groups.flat();
  const regroups = before.groups.some((group, index) => !sameSet(group, after.groups[index] ?? []));
  if (sameSet(beforeClasses, afterClasses)) {
    if (regroups) return { problems: [`${rule} moves classes between the groups that [ ] and | delimit`], notes: [] };
    return { problems: [], notes: beforeClasses.length === afterClasses.length ? [] : [`${rule} removes duplicate classes`] };
  }
  const lost = withoutItems(beforeClasses, new Set(afterClasses));
  const gained = withoutItems(afterClasses, new Set(beforeClasses));
  if (roles.removesDuplicateClasses?.has(rule) && gained.length === 0 && lost.every((className) => occursMoreThanOnce(source, className))) {
    return { problems: [], notes: [`${rule} removes duplicate classes`] };
  }
  const mayRewrite = roles.rewritesClasses?.has(rule) === true || (lost.length === gained.length && !regroups);
  if (mayRewrite) return { problems: [], notes: [`${rule} rewrites classes: ${lost.join(' ') || 'none'} became ${gained.join(' ') || 'none'}`] };
  return { problems: [`${rule} changes the classes: removes ${lost.join(' ') || 'none'}, adds ${gained.join(' ') || 'none'}`], notes: [] };
}

function usesOnlyWindowsLineEndings(code: string): boolean {
  return code.includes('\r\n') && !/(^|[^\r])\n/.test(code);
}

export function reviewFix(source: string, fixed: string, fixKeeps: FixKeeps, applied: readonly AppliedFix[] = [], roles: ClassRuleRoles = {}): FixReview {
  const before = parse(source);
  const after = parse(fixed);
  if ('error' in after) return { problems: [`the fixed template no longer parses: ${after.error}`], notes: [] };
  if ('error' in before) return { problems: [], notes: [] };

  const problems: string[] = [];
  if (usesOnlyWindowsLineEndings(source) && !usesOnlyWindowsLineEndings(fixed)) problems.push('the fix mixes bare \\n line breaks into a template that uses \\r\\n');
  if (after.result.services.twig.unconvertedBlocks.length !== before.result.services.twig.unconvertedBlocks.length) {
    problems.push('the fix changes how many Twig blocks the parser can read');
  }
  const blockChange = describeFirstDifference(twigBlockShapes(before.result), twigBlockShapes(after.result));
  if (blockChange) problems.push(`the fix changes the Twig blocks: ${blockChange}`);

  if (fixKeeps === 'layout') {
    const layoutChange = describeFirstDifference(layoutTokens(source, before.result), layoutTokens(fixed, after.result));
    if (layoutChange) problems.push(`the fix changes more than the whitespace between tokens: ${layoutChange}`);
  }
  if (fixKeeps !== 'class-tokens') return { problems, notes: [] };

  const reviews = applied.map((fix) => reviewClassListFix(fix, source, roles));
  return { problems: [...problems, ...new Set(reviews.flatMap((review) => review.problems))], notes: [...new Set(reviews.flatMap((review) => review.notes))] };
}

export function describeFixProblems(source: string, fixed: string, fixKeeps: FixKeeps, applied?: readonly AppliedFix[]): string[] {
  return [...reviewFix(source, fixed, fixKeeps, applied).problems];
}
