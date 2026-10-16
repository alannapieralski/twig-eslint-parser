import type { TwigBlockSummary } from 'twig-eslint-parser';
import type { Range } from './range.js';

const branchContinuations: ReadonlySet<string> = new Set(['else', 'elseif']);

function firstBlockIndexFrom(offset: number, blocks: readonly TwigBlockSummary[]): number {
  let low = 0;
  let high = blocks.length;

  while (low < high) {
    const middle = (low + high) >> 1;
    const middleStart = blocks[middle]?.range[0] ?? Infinity;

    if (middleStart < offset) low = middle + 1;
    else high = middle;
  }

  return low;
}

function findBlocksWithin(range: Range, blocks: readonly TwigBlockSummary[]): TwigBlockSummary[] {
  const found: TwigBlockSummary[] = [];

  for (let index = firstBlockIndexFrom(range[0], blocks); index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block || block.range[1] > range[1]) break;
    found.push(block);
  }

  return found;
}

export function depthChangeWithin(range: Range, blocks: readonly TwigBlockSummary[]): number {
  return findBlocksWithin(range, blocks).reduce((depth, block) => depth + block.depthChange, 0);
}

export function isTwigBalancedWithin(range: Range, blocks: readonly TwigBlockSummary[]): boolean {
  let depth = 0;

  for (const block of findBlocksWithin(range, blocks)) {
    const isBranchContinuationAtTopLevel = depth === 0 && branchContinuations.has(block.tagName ?? '');
    if (isBranchContinuationAtTopLevel) return false;

    depth += block.depthChange;
    if (depth < 0) return false;
  }

  return depth === 0;
}
