import type { Rule, SourceCode } from 'eslint';

const tagEnds: ReadonlySet<string> = new Set(['>', '/>']);
const twigSpan = /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\}/g;

export type Range = readonly [number, number];
export type Token = { readonly range: Range; readonly value: string };
export type TagNode = {
  readonly name?: string;
  readonly openStart: Token;
  readonly openEnd: Token;
  readonly close?: Token | null;
  readonly attributes: readonly { readonly range: Range; readonly key?: { readonly range: Range } }[];
};
export type LayoutOptions = { indent: number; ignoreInside: string[] };

type EslintNode = Parameters<SourceCode['getAncestors']>[0];

export function lineIndentation(text: string, offset: number): string {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  return /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? '';
}

// Returns '\r\n' when the file uses Windows line endings, otherwise '\n'.
export function lineBreakUsedIn(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

export function indentUnitFor(tagIndentation: string, indent: number): string {
  return tagIndentation.includes('\t') ? '\t' : ' '.repeat(indent);
}

export function isOpenTagSwallowingMarkup(node: TagNode, text: string): boolean {
  if (!tagEnds.has(node.openEnd.value)) return true;
  return node.attributes.some((attribute) => attribute.key !== undefined && text.slice(...attribute.key.range).replace(twigSpan, '').includes('<'));
}

export function createIgnoredInsideCheck(sourceCode: SourceCode, ignoreInside: readonly string[]): (node: TagNode) => boolean {
  const ignoredElements = new Set(ignoreInside.map((name) => name.toLowerCase()));
  return (node) => [...sourceCode.getAncestors(node as unknown as EslintNode), node as unknown as EslintNode]
    .some((ancestor) => ignoredElements.has(String((ancestor as unknown as TagNode).name ?? '').toLowerCase()));
}

export type TagListener = (node: TagNode) => void;

export function tagListeners(check: TagListener, selectors: readonly string[]): Rule.RuleListener {
  return Object.fromEntries(selectors.map((selector) => [selector, check])) as unknown as Rule.RuleListener;
}
