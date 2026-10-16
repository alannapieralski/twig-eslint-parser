import type { AttributeNode, TwigStringSummary } from 'twig-eslint-parser';
import type { Problem } from '../../shared/problem.js';
import { findAttributeProblems } from './find-attribute-problems.js';
import { findTwigStringProblems } from './find-twig-string-problems.js';
import type { QuoteSource } from './types.js';

export function findFileLevelProblems(unownedAttributes: readonly AttributeNode[], strings: readonly TwigStringSummary[], source: QuoteSource): Problem[] {
  const isInSoundTag = false;
  const attributeProblems = unownedAttributes.flatMap((attribute) => findAttributeProblems(attribute, isInSoundTag, source));
  const stringProblems = strings.flatMap((string) => findTwigStringProblems(string, source));

  return [...attributeProblems, ...stringProblems];
}
