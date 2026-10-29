import { findLastNode } from './markup-elements.js';
import type { MarkupElement, MarkupTreeNode } from './markup-elements.js';

export type MarkupEnd = { readonly treeEnd: number; readonly lastNode: MarkupTreeNode; readonly isTextLeftUnread: boolean };

const VISIBLE_CHARACTER = /\S/;

export function readMarkupEnd(document: MarkupTreeNode, text: string): MarkupEnd {
  const treeEnd = document.range[1];
  return { treeEnd, lastNode: findLastNode(document), isTextLeftUnread: VISIBLE_CHARACTER.test(text.slice(treeEnd)) };
}

export function isCutOffByUnreadText(element: MarkupElement, markupEnd: MarkupEnd): boolean {
  return markupEnd.isTextLeftUnread && element.range[1] >= markupEnd.treeEnd && element !== markupEnd.lastNode;
}
