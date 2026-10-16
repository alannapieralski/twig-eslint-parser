import type { AttributeNode } from 'twig-eslint-parser';
import type { Problem } from '../../shared/problem.js';
import { isOpenTagSwallowingMarkup } from '../../shared/swallowed-markup.js';
import { findAttributeProblems } from './find-attribute-problems.js';
import type { QuoteSource, TagWithAttributes } from './types.js';

export function findTagProblems(tag: TagWithAttributes, ownedByTag: ReadonlyMap<object, readonly AttributeNode[]>, source: QuoteSource): Problem[] {
  const attributes = [...tag.attributes, ...(ownedByTag.get(tag) ?? [])];
  const isInSoundTag = !isOpenTagSwallowingMarkup({ ...tag, attributes }, source.text);

  return attributes.flatMap((attribute) => findAttributeProblems(attribute, isInSoundTag, source));
}
