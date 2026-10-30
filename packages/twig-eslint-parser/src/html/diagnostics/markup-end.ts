import { findLastNode } from './markup-elements.js';
import type { MarkupElement, MarkupTreeNode } from './markup-elements.js';

export type MarkupEnd = { readonly treeEnd: number; readonly lastNode: MarkupTreeNode; readonly unreadStart: number | undefined };

const VISIBLE_CHARACTER = /\S/;

function findFirstVisibleOffset(text: string, from: number): number | undefined {
  const distance = text.slice(from).search(VISIBLE_CHARACTER);
  return distance === -1 ? undefined : from + distance;
}

export function readMarkupEnd(document: MarkupTreeNode, text: string): MarkupEnd {
  const treeEnd = document.range[1];
  return { treeEnd, lastNode: findLastNode(document), unreadStart: findFirstVisibleOffset(text, treeEnd) };
}

export function isCutOffByUnreadText(element: MarkupElement, markupEnd: MarkupEnd): boolean {
  const isTextLeftUnread = markupEnd.unreadStart !== undefined;
  return isTextLeftUnread && element.range[1] >= markupEnd.treeEnd && element !== markupEnd.lastNode;
}
