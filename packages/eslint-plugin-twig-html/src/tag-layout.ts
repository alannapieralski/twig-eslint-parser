import type { Rule, SourceCode } from 'eslint';

const tagEnds: ReadonlySet<string> = new Set(['>', '/>']);
const twigSpan = /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\}/g;
const quotedValue = /"[^"]*"|'[^']*'/g;
const whitespaceSensitiveTags: ReadonlySet<string> = new Set(['pre', 'textarea']);
const inlineTags: ReadonlySet<string> = new Set([
  'a', 'abbr', 'acronym', 'b', 'bdi', 'bdo', 'big', 'button', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'font', 'i', 'ins', 'kbd', 'label',
  'mark', 'output', 'q', 's', 'samp', 'small', 'span', 'strike', 'strong', 'sub', 'sup', 'time', 'tt', 'u', 'var',
  'audio', 'canvas', 'iframe', 'meter', 'object', 'progress', 'rp', 'rt', 'ruby', 'slot', 'video',
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

function endsWithClosingBracket(node: Pick<ParsedTag, 'openEnd'>): boolean {
  return node.openEnd !== undefined && tagEnds.has(node.openEnd.value);
}

function withoutTwigAndQuotedText(attributeText: string): string {
  const withoutTwig = attributeText.replace(twigSpan, '');
  return withoutTwig.replace(quotedValue, '');
}

function hasStrayOpeningBracket(attributeText: string): boolean {
  return withoutTwigAndQuotedText(attributeText).includes('<');
}

// True when the parser read the markup after an unterminated open tag as part of that tag.
export function isOpenTagSwallowingMarkup(node: Pick<ParsedTag, 'openEnd' | 'attributes'>, text: string): boolean {
  if (!endsWithClosingBracket(node)) return true;

  return node.attributes.some((attribute) => {
    const attributeText = text.slice(...attribute.range);
    return hasStrayOpeningBracket(attributeText);
  });
}

function normaliseElementName(name: string | undefined): string {
  return (name ?? '').toLowerCase();
}

function isInlineElement(name: string): boolean {
  return inlineTags.has(name) || name.includes('-');
}

const leadingHtmlWhitespace = /^[ \t\n\r\f]*/;
const trailingHtmlWhitespace = /[ \t\n\r\f]*$/;

export function countLeadingHtmlWhitespace(text: string): number {
  return text.match(leadingHtmlWhitespace)?.[0].length ?? 0;
}

export function countTrailingHtmlWhitespace(text: string): number {
  return text.match(trailingHtmlWhitespace)?.[0].length ?? 0;
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

// Builds a check for whether whitespace inside a tag is rendered: an inline element, or anything inside <pre> or <textarea>.
export function createContentWhitespaceCheck(sourceCode: SourceCode): (node: TagNode) => boolean {
  const isInsideWhitespaceSensitiveTag = createIgnoredInsideCheck(sourceCode, [...whitespaceSensitiveTags]);
  return (node) => isInlineElement(normaliseElementName(node.name)) || isInsideWhitespaceSensitiveTag(node);
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
