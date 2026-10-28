import { isOpenTagUnreadable } from '../../shared/unreadable-open-tags.js';
import { findAttributeProblems } from './find-attribute-problems.js';
import type { Problem } from '../../shared/problem.js';
import type { QuoteSource, TagWithAttributes } from './types.js';

export function findTagProblems(tag: TagWithAttributes, source: QuoteSource): Problem[] {
  const attributes = source.attributesOf(tag);
  const isInReadableTag = !isOpenTagUnreadable(tag, source.unreadableTagStarts);

  return attributes.flatMap((attribute) => findAttributeProblems(attribute, isInReadableTag, source));
}
