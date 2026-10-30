import { RAW_TEXT_ELEMENT_NAMES } from '../syntax.js';
import { isMarkupElement } from './markup-elements.js';
import { UNTERMINATED_TAG_MESSAGE } from './open-tag-diagnostics.js';
import type { TwigDiagnostic } from '../../diagnostics.js';
import type { MarkupTreeNode } from './markup-elements.js';
import type { MarkupEnd } from './markup-end.js';

function isRawTextElementLeftOpen(node: MarkupTreeNode, rawTextNames: ReadonlySet<string>): boolean {
  if (!isMarkupElement(node) || node.close) return false;
  return Object.hasOwn(RAW_TEXT_ELEMENT_NAMES, node.type) || rawTextNames.has(node.name ?? '');
}

export function findUnreadEndDiagnostics(markupEnd: MarkupEnd, text: string, rawTextNames: ReadonlySet<string>): TwigDiagnostic[] {
  const { lastNode, unreadStart } = markupEnd;
  if (unreadStart === undefined) return [];
  if (lastNode.type === 'Comment') return [{ code: 'eof-in-comment', message: 'This comment never ends with "-->", so the rest of the file is read as part of it. Add the "-->".', range: lastNode.range }];
  if (isRawTextElementLeftOpen(lastNode, rawTextNames)) return [];

  return [{ code: 'eof-in-tag', message: UNTERMINATED_TAG_MESSAGE, range: [unreadStart, text.length] }];
}
