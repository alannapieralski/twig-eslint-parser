import { parse as parseCss, toPlainObject, type CssNodePlain } from 'css-tree';
import { parse as parseMarkupTree, TokenTypes } from '../es-html-parser/index.js';
import type { TemplateInfo } from '../es-html-parser/types/index.js';
import { cssVisitorKeys, htmlVisitorKeys } from './visitor-keys.js';

type Position = { line: number; column: number };
type Node = { type: string; range: [number, number]; loc: { start: Position; end: Position }; [key: string]: unknown };
type CssNode = { type: string; range?: [number, number]; loc?: { start: Position & { offset: number }; end: Position & { offset: number } } | null; [key: string]: unknown };
type Comment = { readonly type: string; readonly range: [number, number]; readonly loc: Node['loc']; readonly value: unknown };

export type HtmlProgram = {
  readonly type: 'Program';
  readonly body: unknown[];
  readonly range: [number, number];
  readonly loc: Node['loc'];
  readonly tokens: unknown[];
  readonly comments: Comment[];
};
export type HtmlParseOptions = { readonly templateInfos: readonly TemplateInfo[]; readonly rawContentTags?: readonly string[] };

const commentTokenTypes: ReadonlySet<string> = new Set([TokenTypes.CommentOpen, TokenTypes.CommentContent, TokenTypes.CommentClose]);

function isTyped(value: unknown): value is { type: string } {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function visit<Visited extends { type: string }>(root: Visited, keysByType: Readonly<Record<string, readonly string[]>>, typeOf: (node: Visited) => string, visitor: (node: Visited) => void): void {
  const pending: Visited[] = [root];

  for (let node = pending.pop(); node; node = pending.pop()) {
    const childKeys = keysByType[typeOf(node)] ?? [];
    visitor(node);
    const children = childKeys.flatMap((key) => [(node as Record<string, unknown>)[key]].flat()).filter(isTyped) as Visited[];
    for (const child of children.reverse()) pending.push(child);
  }
}

function parseStylesheet(content: Node): CssNodePlain {
  const stylesheet = toPlainObject(parseCss(String(content['value']), {
    context: 'stylesheet',
    offset: content.range[0],
    positions: true,
    line: content.loc.start.line,
    column: content.loc.start.column + 1,
  }));
  visit(stylesheet as unknown as CssNode, cssVisitorKeys, (node) => `Css${node.type}`, (node) => {
    node.type = `Css${node.type}`;
    if (!node.loc) return;
    node.range = [node.loc.start.offset, node.loc.end.offset];
    node.loc.start.column -= 1;
    node.loc.end.column -= 1;
  });
  return stylesheet;
}

export function parseHtmlProgram(text: string, options: HtmlParseOptions): HtmlProgram {
  const { ast, tokens } = parseMarkupTree(text, {
    templateInfos: [...options.templateInfos],
    ...(options.rawContentTags && { rawContentTags: [...options.rawContentTags] }),
  });
  const document = ast as unknown as Node;
  const comments: Comment[] = [];
  visit(document, htmlVisitorKeys, (node) => node.type, (node) => {
    if (node.type === 'CommentContent') comments.push({ type: node.type, range: node.range, loc: node.loc, value: node['value'] });
    if (node.type === 'StyleTagContent') node['stylesheet'] = parseStylesheet(node);
  });
  return {
    type: 'Program',
    body: [document],
    range: document.range,
    loc: document.loc,
    tokens: tokens.filter((token) => !commentTokenTypes.has(token.type)),
    comments,
  };
}

export const visitorKeys = htmlVisitorKeys;
