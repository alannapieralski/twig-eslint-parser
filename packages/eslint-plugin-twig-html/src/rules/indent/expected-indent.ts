import type { Range } from '../../shared/range.js';
import type { IndentUnit, ResolvedOptions } from './options.js';
import type { IndentLayout, OpenTag } from './types.js';

function contains(range: Range, offset: number): boolean {
  return range[0] <= offset && offset < range[1];
}

function depthAt(offset: number, nestings: readonly Range[]): number {
  return nestings.filter((range) => contains(range, offset)).length;
}

function repeatUnit(unit: IndentUnit, depth: number): string {
  return unit.text.repeat(Math.max(depth, 0));
}

function isInsideOpenTag(tag: OpenTag, offset: number): boolean {
  return tag.attributesStart <= offset && offset <= tag.closeBracketStart;
}

function isInsideCloseTag(closeTag: Range, offset: number): boolean {
  return closeTag[0] < offset && offset < closeTag[1];
}

function expectedInOpenTag(tag: OpenTag, offset: number, nestings: readonly Range[], options: ResolvedOptions): string {
  const { unit, closeBracket } = options;
  const tagDepth = depthAt(tag.start, nestings);

  if (offset === tag.closeBracketStart) {
    const bracketOffset = tag.isSelfClosing ? closeBracket.selfClosingTag : closeBracket.startTag;
    return repeatUnit(unit, tagDepth + bracketOffset);
  }

  const lineDepth = depthAt(offset, nestings);
  const shouldAlign = options.alignAttributesVertically && tag.firstAttributeColumn !== undefined;
  if (!shouldAlign) return repeatUnit(unit, lineDepth + options.attribute);

  const alignment = ' '.repeat(tag.firstAttributeColumn ?? 0);
  return `${repeatUnit(unit, tagDepth)}${alignment}${repeatUnit(unit, lineDepth - tagDepth)}`;
}

export function isSkipped(offset: number, layout: IndentLayout): boolean {
  return layout.skipped.some((range) => contains(range, offset));
}

export function expectedIndentAt(offset: number, layout: IndentLayout, options: ResolvedOptions): string {
  const { nestings } = layout;
  const { unit } = options;

  const openTag = layout.openTags.find((tag) => isInsideOpenTag(tag, offset));
  if (openTag) return expectedInOpenTag(openTag, offset, nestings, options);

  const closeTag = layout.closeTags.find((range) => isInsideCloseTag(range, offset));
  if (closeTag) return repeatUnit(unit, depthAt(closeTag[0], nestings) + options.closeBracket.endTag);

  return repeatUnit(unit, depthAt(offset, nestings));
}
