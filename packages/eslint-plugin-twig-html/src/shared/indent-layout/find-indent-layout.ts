import type { TwigBlockSummary } from 'twig-eslint-parser';
import { buildIndentLayout } from './indent-regions.js';
import { findTwigSegments } from './twig-frames.js';
import type { IndentLayout, MarkupNode } from './types.js';

export type IndentLayoutSource = {
  readonly text: string;
  readonly blocks: readonly TwigBlockSummary[];
  readonly ignores: readonly string[];
};

export function findIndentLayout(document: MarkupNode, source: IndentLayoutSource): IndentLayout | undefined {
  const segments = findTwigSegments(source.blocks, source.text);
  if (!segments) return undefined;

  return buildIndentLayout(document, segments, source);
}
