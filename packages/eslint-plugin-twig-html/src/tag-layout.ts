import type { Rule, SourceCode } from 'eslint';

const tagEnds: ReadonlySet<string> = new Set(['>', '/>']);
const twigSpan = /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\}/g;
const quotedValue = /"[^"]*"|'[^']*'/g;

export type Range = readonly [number, number];
type Token = { readonly range: Range; readonly value: string };
export type TagNode = {
  readonly name?: string;
  readonly openStart: Token;
  readonly openEnd: Token;
  readonly close?: Token | null;
  readonly attributes: readonly { readonly range: Range }[];
};
type ParsedTag = Omit<TagNode, 'openEnd'> & { readonly openEnd?: Token };

type EslintNode = Parameters<SourceCode['getAncestors']>[0];

export function lineIndentation(text: string, offset: number): string {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  let indentationEnd = lineStart;
  while (text[indentationEnd] === ' ' || text[indentationEnd] === '\t') indentationEnd++;
  return text.slice(lineStart, indentationEnd);
}

export function lineBreakUsedIn(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

export type LayoutOptions = { indent?: number; ignoreInside?: string[] };

export const layoutOptionDefaults: Required<LayoutOptions> = { indent: 2, ignoreInside: ['svg'] };

export const layoutOptionProperties = {
  indent: { type: 'integer', minimum: 1 },
  ignoreInside: { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true },
} as const;

export function indentUnitFor(text: string, tagIndentation: string, indent: number): string {
  const isTabIndented = tagIndentation === '' ? /^\t/m.test(text) && !/^ /m.test(text) : tagIndentation.includes('\t');
  return isTabIndented ? '\t' : ' '.repeat(indent);
}

// True when the parser read the markup after an unterminated open tag as part of that tag.
export function isOpenTagSwallowingMarkup(node: Pick<ParsedTag, 'openEnd' | 'attributes'>, text: string): boolean {
  const endsWithClosingBracket = node.openEnd !== undefined && tagEnds.has(node.openEnd.value);
  if (!endsWithClosingBracket) return true;

  const withoutTwigAndQuotedText = (attributeText: string) => attributeText.replace(twigSpan, '').replace(quotedValue, '');
  const hasStrayOpeningBracket = (attributeText: string) => withoutTwigAndQuotedText(attributeText).includes('<');

  return node.attributes.some((attribute) => {
    const attributeText = text.slice(...attribute.range);
    return hasStrayOpeningBracket(attributeText);
  });
}

function normaliseElementName(name: string | undefined): string {
  return (name ?? '').toLowerCase();
}

const leadingHtmlWhitespace = /^[ \t\n\r\f]*/;
const trailingHtmlWhitespace = /[ \t\n\r\f]*$/;

export function countLeadingHtmlWhitespace(text: string): number {
  return text.match(leadingHtmlWhitespace)?.[0].length ?? 0;
}

export function countTrailingHtmlWhitespace(text: string): number {
  return text.match(trailingHtmlWhitespace)?.[0].length ?? 0;
}

export function createIgnoredInsideCheck(sourceCode: SourceCode, ignoreInside: readonly string[]): (node: TagNode) => boolean {
  const ignoredElementNames = new Set(ignoreInside.map(normaliseElementName));

  return (node) => {
    const tagAsEslintNode = node as unknown as EslintNode;
    const enclosingNodes = sourceCode.getAncestors(tagAsEslintNode);
    const nodesToCheck = [...enclosingNodes, tagAsEslintNode];

    return nodesToCheck.some((candidate) => {
      const candidateName = (candidate as unknown as TagNode).name;
      return ignoredElementNames.has(normaliseElementName(candidateName));
    });
  };
}

type TagListener = (node: TagNode) => void;

export function tagListeners(check: TagListener, selectors: readonly string[]): Rule.RuleListener {
  const isTerminated = (node: ParsedTag): node is TagNode => node.openEnd !== undefined;
  const checkTerminated = (node: ParsedTag) => {
    if (isTerminated(node)) check(node);
  };
  return Object.fromEntries(selectors.map((selector) => [selector, checkTerminated])) as unknown as Rule.RuleListener;
}
