import { repeatUnit } from '../nesting.js';
import { createLastStartingLookup } from '../range-lookup.js';
import type { Range } from '../../../shared/range.js';
import type { ResolvedOptions } from '../options.js';
import type { RangeCoverage } from '../range-lookup.js';
import type { OpenTag } from './types.js';

function isInsideOpenTag(tag: OpenTag, offset: number): boolean {
  return tag.attributesStart <= offset && offset <= tag.closeBracketStart;
}

function isInsideCloseTag(closeTag: Range, offset: number): boolean {
  return closeTag[0] < offset && offset < closeTag[1];
}

export function createOpenTagLookup(openTags: readonly OpenTag[]): (offset: number) => OpenTag | undefined {
  const findLastStartingAt = createLastStartingLookup(openTags, (tag) => tag.attributesStart);

  return (offset) => {
    const tag = findLastStartingAt(offset);
    return tag && isInsideOpenTag(tag, offset) ? tag : undefined;
  };
}

export function createCloseTagLookup(closeTags: readonly Range[]): (offset: number) => Range | undefined {
  const findLastStartingBefore = createLastStartingLookup(closeTags, (closeTag) => closeTag[0] + 1);

  return (offset) => {
    const closeTag = findLastStartingBefore(offset);
    return closeTag && isInsideCloseTag(closeTag, offset) ? closeTag : undefined;
  };
}

export function expectedInOpenTag(tag: OpenTag, offset: number, nestings: RangeCoverage, options: ResolvedOptions): string {
  const { unit, closeBracket } = options;
  const tagDepth = nestings.countAt(tag.start);
  const tagIndentation = tag.lineIndentationAsWritten ?? repeatUnit(unit, tagDepth);

  if (offset === tag.closeBracketStart) {
    const bracketOffset = tag.isSelfClosing ? closeBracket.selfClosingTag : closeBracket.startTag;
    return `${tagIndentation}${repeatUnit(unit, bracketOffset)}`;
  }

  const depthWithinTag = nestings.countAt(offset) - tagDepth;
  const shouldAlign = options.alignAttributesVertically && tag.firstAttributeColumn !== undefined;
  if (!shouldAlign) return `${tagIndentation}${repeatUnit(unit, depthWithinTag + options.attribute)}`;

  const alignment = ' '.repeat(tag.firstAttributeColumn ?? 0);
  return `${tagIndentation}${alignment}${repeatUnit(unit, depthWithinTag)}`;
}

export function expectedInCloseTag(closeTag: Range, nestings: RangeCoverage, options: ResolvedOptions): string {
  return repeatUnit(options.unit, nestings.countAt(closeTag[0]) + options.closeBracket.endTag);
}
