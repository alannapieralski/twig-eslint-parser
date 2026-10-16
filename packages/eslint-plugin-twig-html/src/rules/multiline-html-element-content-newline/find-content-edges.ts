import { countLeadingHtmlWhitespace, countTrailingHtmlWhitespace } from '../../shared/html-whitespace.js';
import type { TagNode } from '../../shared/tag-node.js';
import type { ContentEdge } from './types.js';

export function findContentEdges(tag: TagNode, close: NonNullable<TagNode['close']>, text: string): ContentEdge[] {
  const contentStart = tag.openEnd.range[1];
  const contentEnd = close.range[0];
  const content = text.slice(contentStart, contentEnd);
  const leadingWhitespace = countLeadingHtmlWhitespace(content);

  if (leadingWhitespace === content.length) {
    return [{ range: [contentStart, contentEnd], messageId: 'unexpectedAfterClosingBracket' }];
  }

  const trailingStart = contentEnd - countTrailingHtmlWhitespace(content);

  return [
    { range: [contentStart, contentStart + leadingWhitespace], messageId: 'unexpectedAfterClosingBracket' },
    { range: [trailingStart, contentEnd], messageId: 'unexpectedBeforeOpeningBracket' },
  ];
}
