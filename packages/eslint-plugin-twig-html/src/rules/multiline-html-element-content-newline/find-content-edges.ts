import { countLeadingHtmlWhitespace, countTrailingHtmlWhitespace } from '../../shared/html-whitespace.js';
import { indentUnitFor, lineIndentation } from '../../shared/indentation.js';
import type { TagNode } from '../../shared/tag-node.js';
import type { ContentEdge } from './types.js';

export function findContentEdges(tag: TagNode, close: NonNullable<TagNode['close']>, text: string, indent: number): ContentEdge[] {
  const contentStart = tag.openEnd.range[1];
  const contentEnd = close.range[0];
  const content = text.slice(contentStart, contentEnd);
  const tagIndentation = lineIndentation(text, tag.openStart.range[0]);
  const leadingWhitespace = countLeadingHtmlWhitespace(content);

  if (leadingWhitespace === content.length) {
    return [{ range: [contentStart, contentEnd], messageId: 'unexpectedAfterClosingBracket', indentationWhenMissing: tagIndentation }];
  }

  const contentIndentation = tagIndentation + indentUnitFor(text, tagIndentation, indent);
  const trailingStart = contentEnd - countTrailingHtmlWhitespace(content);

  return [
    { range: [contentStart, contentStart + leadingWhitespace], messageId: 'unexpectedAfterClosingBracket', indentationWhenMissing: contentIndentation },
    { range: [trailingStart, contentEnd], messageId: 'unexpectedBeforeOpeningBracket', indentationWhenMissing: tagIndentation },
  ];
}
