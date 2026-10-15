import type { Rule, SourceCode } from 'eslint';

const tagEnds: ReadonlySet<string> = new Set(['>', '/>']);
const twigSpan = /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\}/g;
const quotedValue = /"[^"]*"|'[^']*'/g;
const whitespaceSensitiveTags: ReadonlySet<string> = new Set(['pre', 'textarea']);
const inlineTags: ReadonlySet<string> = new Set([
  'a', 'abbr', 'acronym', 'b', 'bdi', 'bdo', 'big', 'button', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'font', 'i', 'ins', 'kbd', 'label',
  'mark', 'output', 'q', 's', 'samp', 'small', 'span', 'strike', 'strong', 'sub', 'sup', 'time', 'tt', 'u', 'var',
]);

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

// Returns '\r\n' when the file uses Windows line endings, otherwise '\n'.
export function lineBreakUsedIn(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

export function indentUnitFor(tagIndentation: string, indent: number): string {
  return tagIndentation.includes('\t') ? '\t' : ' '.repeat(indent);
}

function endsWithClosingBracket(node: TagNode): boolean {
  return tagEnds.has(node.openEnd.value);
}

function withoutTwigAndQuotedText(attributeText: string): string {
  const withoutTwig = attributeText.replace(twigSpan, '');
  return withoutTwig.replace(quotedValue, '');
}

function hasStrayOpeningBracket(attributeText: string): boolean {
  return withoutTwigAndQuotedText(attributeText).includes('<');
}

// True when the parser read the markup after an unterminated open tag as part of that tag.
export function isOpenTagSwallowingMarkup(node: TagNode, text: string): boolean {
  if (!endsWithClosingBracket(node)) return true;

  return node.attributes.some((attribute) => {
    const attributeText = text.slice(...attribute.range);
    return hasStrayOpeningBracket(attributeText);
  });
}

function normaliseElementName(name: string | undefined): string {
  return (name ?? '').toLowerCase();
}

export function hasSignificantContentWhitespace(node: TagNode): boolean {
  const name = normaliseElementName(node.name);
  return whitespaceSensitiveTags.has(name) || inlineTags.has(name);
}

const htmlWhitespace = ' \t\n\r\f';

export function countLeadingHtmlWhitespace(text: string): number {
  let count = 0;
  while (count < text.length && htmlWhitespace.includes(text[count] as string)) count++;
  return count;
}

export function countTrailingHtmlWhitespace(text: string): number {
  let count = 0;
  while (count < text.length && htmlWhitespace.includes(text[text.length - 1 - count] as string)) count++;
  return count;
}

// Builds a check for whether a tag is, or sits inside, one of the ignored elements.
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

function isTerminated(node: ParsedTag): node is TagNode {
  return node.openEnd !== undefined;
}

export function tagListeners(check: TagListener, selectors: readonly string[]): Rule.RuleListener {
  const checkTerminated = (node: ParsedTag) => {
    if (isTerminated(node)) check(node);
  };
  return Object.fromEntries(selectors.map((selector) => [selector, checkTerminated])) as unknown as Rule.RuleListener;
}
