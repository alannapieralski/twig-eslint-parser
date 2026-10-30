import { ELEMENT_NODE_TYPES } from '../syntax.js';
import type { AttributeNode } from '../../attributes.js';
import type { TokenTypes } from '../../es-html-parser/constants/token-types.js';
import type { Range } from '../../range.js';

type MarkupToken = { readonly range: Range; readonly value: string };

export type MarkupTreeNode = { readonly type: string; readonly children?: readonly MarkupTreeNode[] };

export type MarkupElement = MarkupTreeNode & {
  readonly name?: string;
  readonly range: Range;
  readonly openStart: MarkupToken;
  readonly openEnd?: MarkupToken;
  readonly close?: MarkupToken | null;
  readonly selfClosing?: boolean;
  readonly attributes: readonly AttributeNode[];
};

export type SourceToken = { readonly type: string; readonly range: Range; readonly value: string; readonly parts?: { type: TokenTypes; value: string }[] };

function isMarkupElement(node: MarkupTreeNode): node is MarkupElement {
  return ELEMENT_NODE_TYPES.includes(node.type) && 'openStart' in node;
}

export function findMarkupElements(document: MarkupTreeNode): MarkupElement[] {
  const elements: MarkupElement[] = [];
  const toVisit = [document];

  for (let node = toVisit.pop(); node; node = toVisit.pop()) {
    if (isMarkupElement(node)) elements.push(node);
    toVisit.push(...(node.children ?? []));
  }

  return elements;
}
