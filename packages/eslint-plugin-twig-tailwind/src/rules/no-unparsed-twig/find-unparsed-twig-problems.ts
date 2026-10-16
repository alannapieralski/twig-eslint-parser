import type { UnconvertedTwigBlock } from 'twig-eslint-parser';
import type { Problem } from '../../shared/problem.js';

export function findUnparsedTwigProblems(blocks: readonly UnconvertedTwigBlock[]): Problem[] {
  return blocks.map((block) => ({ range: block.range, messageId: 'unparsedTwig', data: { reason: block.reason } }));
}
