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
  const tagIndentation = tag.lineIndentationAsWritten ?? repeatUnit(unit, tagDepth);

  if (offset === tag.closeBracketStart) {
    const bracketOffset = tag.isSelfClosing ? closeBracket.selfClosingTag : closeBracket.startTag;
    return `${tagIndentation}${repeatUnit(unit, bracketOffset)}`;
  }

  const depthWithinTag = depthAt(offset, nestings) - tagDepth;
  const shouldAlign = options.alignAttributesVertically && tag.firstAttributeColumn !== undefined;
  if (!shouldAlign) return `${tagIndentation}${repeatUnit(unit, depthWithinTag + options.attribute)}`;

  const alignment = ' '.repeat(tag.firstAttributeColumn ?? 0);
  return `${tagIndentation}${alignment}${repeatUnit(unit, depthWithinTag)}`;
}

function findOpenTagAt(offset: number, layout: IndentLayout): OpenTag | undefined {
  return layout.openTags.find((tag) => isInsideOpenTag(tag, offset));
}

export function isChecked(offset: number, layout: IndentLayout): boolean {
  const isSkipped = layout.skipped.some((range) => contains(range, offset));
  if (isSkipped) return false;

  const isDepthUnknown = layout.depthUnknown.some((range) => contains(range, offset));
  if (!isDepthUnknown) return true;

  return findOpenTagAt(offset, layout)?.lineIndentationAsWritten !== undefined;
}

export function expectedIndentAt(offset: number, layout: IndentLayout, options: ResolvedOptions): string {
  const { nestings } = layout;
  const { unit } = options;

  const openTag = findOpenTagAt(offset, layout);
  if (openTag) return expectedInOpenTag(openTag, offset, nestings, options);

  const closeTag = layout.closeTags.find((range) => isInsideCloseTag(range, offset));
  if (closeTag) return repeatUnit(unit, depthAt(closeTag[0], nestings) + options.closeBracket.endTag);

  return repeatUnit(unit, depthAt(offset, nestings));
}
