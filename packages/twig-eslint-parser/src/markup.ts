import type { TemplateWrapper } from './es-html-parser/types/index.js';
import { annotateBranches } from './html/branches.js';
import { parseHtmlProgram, visitorKeys, type HtmlProgram } from './html/program.js';
import { createOffsetLocator } from './source-text.js';
import { classifyPrintsInTagNames, type TagNamePrintRole } from './tag-name-roles.js';
import { summariseTwigBlocks, type TwigBlock } from './twig/blocks.js';

export type MarkupParserOptions = { readonly rawContentTags?: readonly string[] };

type HtmlParseResult = { readonly ast: HtmlProgram; readonly visitorKeys: typeof visitorKeys };
type Range = readonly [number, number];
type MarkupText = { readonly text: string; readonly blankedRanges: readonly Range[] };

const attributesPrint = /^\{\{[-~]?\s*(?:[\w.]*attributes\b|create_attribute\s*\(|[\w.]+\.(?:addClass|removeClass|setAttribute|removeAttribute)\s*\()/;
const rawTextElements: readonly string[] = ['textarea', 'title'];
const twigDelimiters = /\{\{|\}\}|\{%|%\}|\{#|#\}/g;

function isRange(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number';
}

function overlaps([start, end]: Range, ranges: readonly Range[]): boolean {
  return ranges.some(([rangeStart, rangeEnd]) => start < rangeEnd && rangeStart < end);
}

function findVerbatimBodies(blocks: readonly TwigBlock[]): Range[] {
  const bodies: Range[] = [];
  let bodyStart: number | undefined;
  for (const block of blocks) {
    if (block.tagName === 'verbatim') bodyStart = block.end;
    if (block.tagName === 'endverbatim' && bodyStart !== undefined) {
      bodies.push([bodyStart, block.start]);
      bodyStart = undefined;
    }
  }
  return bodies;
}

// Blanks Twig delimiters that {% verbatim %} prints as text, so the markup reader does not take them for Twig.
function blankVerbatimDelimiters(source: string, blocks: readonly TwigBlock[]): MarkupText {
  let text = source;
  const blankedRanges: Range[] = [];
  for (const [start, end] of findVerbatimBodies(blocks)) {
    const body = source.slice(start, end);
    const blanked = body.replace(twigDelimiters, '  ');
    if (blanked === body) continue;
    text = text.slice(0, start) + blanked + text.slice(end);
    blankedRanges.push([start, end]);
  }
  return { text, blankedRanges };
}

function delimiterEnd(block: TwigBlock): number {
  const closing = block.tokens.at(-1);
  const lineBreak = /\r?\n$/.exec(closing?.value ?? '')?.[0] ?? '';
  return block.end - lineBreak.length;
}

function templateInfoOf(source: string, block: TwigBlock, tagNamePrintRoles: ReadonlyMap<TwigBlock, TagNamePrintRole>): TemplateWrapper {
  const end = delimiterEnd(block);
  const tagNameRole = tagNamePrintRoles.get(block);
  const isAttributesPrint = block.kind === 'print' && (tagNameRole ? tagNameRole === 'starts-attributes' : attributesPrint.test(source.slice(block.start, end)));
  return { open: [block.start, block.start + 2], close: [end - 2, end], kind: block.kind, ...(isAttributesPrint && { role: 'attributes' as const }) };
}

function restoreBlankedText(result: HtmlParseResult, source: string, blankedRanges: readonly Range[]): void {
  const visited = new Set<object>();
  const visit = (value: unknown): void => {
    if (typeof value !== 'object' || value === null || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = value as Record<string, unknown>;
    const range = node['range'];
    if (isRange(range) && typeof node['value'] === 'string' && overlaps(range, blankedRanges) && node['value'].length === range[1] - range[0]) {
      node['value'] = source.slice(...range);
    }
    for (const [key, child] of Object.entries(node)) {
      if (key !== 'range' && key !== 'loc' && key !== 'parent') visit(child);
    }
  };
  visit(result.ast);
}

export class HtmlSyntaxError extends Error {
  readonly lineNumber: number;
  readonly column: number;

  constructor(message: string, lineNumber: number, column: number) {
    super(message);
    this.name = 'HtmlSyntaxError';
    this.lineNumber = lineNumber;
    this.column = column;
  }
}

function isPositionedSyntaxError(error: unknown): error is SyntaxError & { pos: number } {
  return error instanceof SyntaxError && typeof (error as { pos?: unknown }).pos === 'number';
}

export function parseMarkup(source: string, blocks: readonly TwigBlock[], options: MarkupParserOptions): HtmlParseResult {
  const markup = blankVerbatimDelimiters(source, blocks);
  const tagNamePrintRoles = classifyPrintsInTagNames(source, blocks);
  const parseOptions = {
    templateInfos: blocks.map((block) => templateInfoOf(source, block, tagNamePrintRoles)),
    rawContentTags: [...rawTextElements, ...(options.rawContentTags ?? [])],
  };
  let result: HtmlParseResult;
  try {
    result = { ast: parseHtmlProgram(markup.text, parseOptions, annotateBranches(summariseTwigBlocks(blocks))), visitorKeys };
  } catch (error) {
    if (!isPositionedSyntaxError(error)) throw error;
    const position = createOffsetLocator(source)(error.pos);
    throw new HtmlSyntaxError(error.message.replace(/ \(\d+:\d+\)$/, ''), position.line, position.column + 1);
  }
  if (markup.blankedRanges.length > 0) restoreBlankedText(result, source, markup.blankedRanges);
  return result;
}
