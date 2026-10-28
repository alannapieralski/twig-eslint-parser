import { RAW_TEXT_ELEMENT_NAMES } from '../syntax.js';
import { isMarkupElement } from './markup-elements.js';
import { UNTERMINATED_TAG_MESSAGE } from './open-tag-diagnostics.js';
import type { TwigDiagnostic } from '../../diagnostics.js';
import type { MarkupTreeNode } from './markup-elements.js';
import type { MarkupEnd } from './markup-end.js';

const FIRST_VISIBLE_CHARACTER = /\S/;

const UNTERMINATED_COMMENT_MESSAGE = 'This comment never ends with "-->", so the rest of the file is read as part of it. Add the "-->".';

function isRawTextElementLeftOpen(node: MarkupTreeNode, rawTextNames: ReadonlySet<string>): boolean {
  if (!isMarkupElement(node) || node.close) return false;
  return Object.hasOwn(RAW_TEXT_ELEMENT_NAMES, node.type) || rawTextNames.has(node.name ?? '');
}

export function findUnreadEndDiagnostics(markupEnd: MarkupEnd, text: string, rawTextNames: ReadonlySet<string>): TwigDiagnostic[] {
  if (!markupEnd.isTextLeftUnread) return [];

  const { lastNode, treeEnd } = markupEnd;
  if (lastNode.type === 'Comment') return [{ code: 'eof-in-comment', message: UNTERMINATED_COMMENT_MESSAGE, range: lastNode.range }];
  if (isRawTextElementLeftOpen(lastNode, rawTextNames)) return [];

  const unreadStart = treeEnd + Math.max(text.slice(treeEnd).search(FIRST_VISIBLE_CHARACTER), 0);
  return [{ code: 'eof-in-tag', message: UNTERMINATED_TAG_MESSAGE, range: [unreadStart, text.length] }];
}
