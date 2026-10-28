import { findLastNode } from './markup-elements.js';
import type { MarkupElement, MarkupTreeNode } from './markup-elements.js';

export type MarkupEnd = { readonly treeEnd: number; readonly lastNode: MarkupTreeNode; readonly isTextLeftUnread: boolean };

export function readMarkupEnd(document: MarkupTreeNode, text: string): MarkupEnd {
  return { treeEnd: document.range[1], lastNode: findLastNode(document), isTextLeftUnread: document.range[1] < text.length };
}

export function isCutOffByUnreadText(element: MarkupElement, markupEnd: MarkupEnd): boolean {
  return markupEnd.isTextLeftUnread && element.range[1] >= markupEnd.treeEnd && element !== markupEnd.lastNode;
}
