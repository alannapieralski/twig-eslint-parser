import { TEMPLATE_ENGINE_SYNTAX, parseForESLint as parseHtmlForESLint, type ParserOptions as HtmlParserOptions } from '@html-eslint/parser';
import { blankPreservingLineBreaks, createOffsetLocator, type SourcePosition } from './source-text.js';
import type { TwigBlock } from './twig/blocks.js';

export type MarkupParserOptions = HtmlParserOptions;

type HtmlParseResult = ReturnType<typeof parseHtmlForESLint>;
type Range = readonly [number, number];
type BranchInfo = {
  readonly branchSegments?: { start: number; end: number }[];
  readonly branchControlRanges?: [number, number][];
};
type MarkupText = {
  readonly text: string;
  readonly rewrittenRanges: readonly Range[];
  readonly tagNameRanges: readonly Range[];
  readonly insertedOffsets: readonly number[];
};

const drupalAttributesPrint = /^\{\{[-~]?\s*(?:[\w.]*attributes\b|create_attribute\s*\()/;
const openTagNameAtEnd = /<[A-Za-z][\w:-]*$/;
const tagNameStartAtEnd = /<\/?(?:[A-Za-z][\w:-]*)?$/;
const attributeFollows = /^[\s>/{]/;

function isRange(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number';
}

function overlaps([start, end]: Range, ranges: readonly Range[]): boolean {
  return ranges.some(([rangeStart, rangeEnd]) => start < rangeEnd && rangeStart < end);
}

function letterFor(character: string): string {
  return String.fromCharCode(97 + ((character.codePointAt(0) ?? 0) % 26));
}

function prepareMarkup(source: string, blocks: readonly TwigBlock[]): MarkupText {
  const characters = source.split('');
  const rewrittenRanges: Range[] = [];
  const tagNameRanges: Range[] = [];
  const insertedOffsets: number[] = [];
  const rewrite = ([start, end]: Range, replacement: string) => {
    characters.splice(start, end - start, ...replacement.split(''));
  };

  let markupStart = 0;
  let tagNameEnd: number | undefined;
  for (const block of blocks) {
    const blockRange: Range = [block.start, block.end];
    const blockText = source.slice(...blockRange);
    const markupBefore = source.slice(markupStart, block.start);
    const followsTagName = openTagNameAtEnd.test(markupBefore) || block.start === tagNameEnd;
    markupStart = block.end;

    if (block.kind === 'comment') {
      rewrite(blockRange, blankPreservingLineBreaks(blockText));
      continue;
    }
    const isDrupalAttributes = block.kind === 'print' && drupalAttributesPrint.test(blockText);
    const isAttributeTag = block.kind === 'tag' && attributeFollows.test(source.slice(block.end, block.end + 1));
    if (followsTagName && (isDrupalAttributes || isAttributeTag)) {
      insertedOffsets.push(block.start);
    } else if (block.kind === 'print' && tagNameStartAtEnd.test(markupBefore)) {
      rewrite(blockRange, blockText.split('').map(letterFor).join(''));
      rewrittenRanges.push(blockRange);
      tagNameRanges.push(blockRange);
      tagNameEnd = block.end;
    }
  }

  let text = characters.join('');
  insertedOffsets.forEach((offset, index) => {
    const position = offset + index;
    text = `${text.slice(0, position)} ${text.slice(position)}`;
  });
  return { text, rewrittenRanges, tagNameRanges, insertedOffsets };
}

function visitNodes(root: unknown, visit: (node: Record<string, unknown>) => void): void {
  const visited = new Set<object>();
  const walk = (value: unknown): void => {
    if (typeof value !== 'object' || value === null || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    const node = value as Record<string, unknown>;
    visit(node);
    for (const [key, child] of Object.entries(node)) {
      if (key !== 'range' && key !== 'loc' && key !== 'parent') walk(child);
    }
  };
  walk(root);
}

function mapPositionsToSource(result: HtmlParseResult, insertedOffsets: readonly number[], locate: (offset: number) => SourcePosition): void {
  const spacePositions = insertedOffsets.map((offset, index) => offset + index);
  const toSource = (offset: number) => offset - spacePositions.filter((position) => position < offset).length;

  visitNodes(result.ast, (node) => {
    if (!isRange(node['range'])) return;
    const range: [number, number] = [toSource(node['range'][0]), toSource(node['range'][1])];
    node['range'] = range;
    node['loc'] = { start: locate(range[0]), end: locate(range[1]) };
  });

  const branches = result.ast as unknown as BranchInfo;
  for (const segment of branches.branchSegments ?? []) {
    segment.start = toSource(segment.start);
    segment.end = toSource(segment.end);
  }
  for (const range of branches.branchControlRanges ?? []) {
    range[0] = toSource(range[0]);
    range[1] = toSource(range[1]);
  }
}

function restoreSourceText(result: HtmlParseResult, source: string, markup: MarkupText): void {
  visitNodes(result.ast, (node) => {
    const range = node['range'];
    if (!isRange(range) || !overlaps(range, markup.rewrittenRanges)) return;
    const sourceText = source.slice(...range);
    if (typeof node['value'] === 'string' && node['value'].length === sourceText.length) node['value'] = sourceText;
    const openStart = node['openStart'] as { range?: unknown } | undefined;
    if (node['type'] === 'Tag' && isRange(openStart?.range) && overlaps(openStart.range, markup.tagNameRanges)) {
      node['name'] = source.slice(openStart.range[0] + 1, openStart.range[1]);
    }
  });
}

export function parseMarkup(source: string, blocks: readonly TwigBlock[], options: MarkupParserOptions): HtmlParseResult {
  const markup = prepareMarkup(source, blocks);
  const result = parseHtmlForESLint(markup.text, {
    templateEngineSyntax: TEMPLATE_ENGINE_SYNTAX.TWIG,
    ...options,
  });
  if (markup.insertedOffsets.length > 0) mapPositionsToSource(result, markup.insertedOffsets, createOffsetLocator(source));
  if (markup.rewrittenRanges.length > 0) restoreSourceText(result, source, markup);
  return result;
}
