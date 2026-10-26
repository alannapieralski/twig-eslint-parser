import { isTwigBalancedWithin } from 'twig-eslint-parser';
import { elementsWithUnrenderedEdgeWhitespace } from '../../shared/html-elements.js';
import { lineIndentationAt, lineStartOf } from '../../shared/line-text.js';
import type { Problem } from '../../shared/problem.js';
import type { Range } from '../../shared/range.js';
import { isOpenTagUnreadable } from '../../shared/unreadable-open-tags.js';
import type { TagNode } from '../../shared/tag-node.js';
import { findContentEdges } from './find-content-edges.js';
import { countLineBreaks, indentationAfterLastLineBreak } from './line-breaks.js';
import type { Options } from './options.js';
import type { TagSource } from '../../shared/tag-source.js';
import type { ContentEdge } from './types.js';

const plainElementName = /^[a-z][a-z0-9-]*$/i;

function isLineBreakCountInvalid(lineBreaks: number, allowEmptyLines: boolean): boolean {
  return allowEmptyLines ? lineBreaks === 0 : lineBreaks !== 1;
}

function describeEdgeProblem(edge: ContentEdge, name: string, tagIndentation: string, source: TagSource, options: Required<Options>, isFixable: boolean): Problem | undefined {
  const whitespace = source.text.slice(...edge.range);
  const lineBreaks = countLineBreaks(whitespace);
  if (!isLineBreakCountInvalid(lineBreaks, options.allowEmptyLines)) return undefined;

  const keptIndentation = lineBreaks === 0 ? tagIndentation : indentationAfterLastLineBreak(whitespace);

  return {
    range: edge.range,
    messageId: edge.messageId,
    data: { name, actual: lineBreaks === 0 ? 'no' : String(lineBreaks) },
    ...(isFixable && { edits: [{ range: edge.range, text: `${source.lineBreak}${keptIndentation}` }] }),
  };
}

export function findContentProblems(tag: TagNode, source: TagSource, options: Required<Options>): Problem[] {
  const { close, name } = tag;
  if (!close || name === undefined || !plainElementName.test(name)) return [];

  const { text, blocks, isIgnored, unreadableTagStarts } = source;
  const contentRange: Range = [tag.openEnd.range[1], close.range[0]];
  const isSingleLine = lineStartOf(text, close.range[0]) <= tag.openStart.range[0];
  if (isSingleLine) return [];

  const isEmpty = contentRange[0] === contentRange[1];
  if (options.ignoreWhenEmpty && isEmpty) return [];

  const isUnsafeToCheck = isOpenTagUnreadable(tag, unreadableTagStarts) || !isTwigBalancedWithin(contentRange, blocks) || isIgnored(tag);
  if (isUnsafeToCheck) return [];

  const isFixable = elementsWithUnrenderedEdgeWhitespace.has(name.toLowerCase());
  const tagIndentation = lineIndentationAt(text, tag.openStart.range[0]);
  const edges = findContentEdges(tag, close, text);
  const problems = edges.map((edge) => describeEdgeProblem(edge, name, tagIndentation, source, options, isFixable));

  return problems.filter((problem) => problem !== undefined);
}
