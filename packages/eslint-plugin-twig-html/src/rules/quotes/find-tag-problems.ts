import type { Problem } from '../../shared/problem.js';
import { isOpenTagUnreadable } from '../../shared/unreadable-open-tags.js';
import type { AttributesOf } from '../../shared/tag-attributes.js';
import type { ParsedTag } from '../../shared/tag-node.js';
import { findAttributeProblems } from './find-attribute-problems.js';
import type { QuoteSource, TagWithAttributes } from './types.js';

export function findTagProblems(tag: TagWithAttributes, attributesOf: AttributesOf, source: QuoteSource, isSkipped: (tag: ParsedTag) => boolean): Problem[] {
  if (isSkipped(tag)) return [];

  const attributes = attributesOf(tag);
  const isInReadableTag = !isOpenTagUnreadable(tag, source.unreadableTagStarts);

  return attributes.flatMap((attribute) => findAttributeProblems(attribute, isInReadableTag, source));
}
