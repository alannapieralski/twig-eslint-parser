import type { Problem } from '../../shared/problem.js';
import { isOpenTagSwallowingMarkup } from '../../shared/swallowed-markup.js';
import type { AttributesOf } from '../../shared/tag-attributes.js';
import { findAttributeProblems } from './find-attribute-problems.js';
import type { QuoteSource, TagWithAttributes } from './types.js';

export function findTagProblems(tag: TagWithAttributes, attributesOf: AttributesOf, source: QuoteSource): Problem[] {
  const attributes = attributesOf(tag);
  const isInSoundTag = !isOpenTagSwallowingMarkup({ ...tag, attributes }, source.text);

  return attributes.flatMap((attribute) => findAttributeProblems(attribute, isInSoundTag, source));
}
