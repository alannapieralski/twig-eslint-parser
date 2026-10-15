import type { TwigBlockSummary } from 'twig-eslint-parser';

function firstBlockIndexFrom(offset: number, blocks: readonly TwigBlockSummary[]): number {
  let low = 0;
  let high = blocks.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((blocks[middle]?.range[0] ?? Infinity) < offset) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function depthChangeWithin(range: readonly [number, number], blocks: readonly TwigBlockSummary[]): number {
  let depth = 0;
  for (let index = firstBlockIndexFrom(range[0], blocks), block = blocks[index]; block && block.range[1] <= range[1]; block = blocks[++index]) depth += block.depthChange;
  return depth;
}

const branchContinuations: ReadonlySet<string> = new Set(['else', 'elseif']);

// True when every Twig block that opens or branches within the range also closes within it.
export function isTwigBalancedWithin(range: readonly [number, number], blocks: readonly TwigBlockSummary[]): boolean {
  let depth = 0;
  for (let index = firstBlockIndexFrom(range[0], blocks), block = blocks[index]; block && block.range[1] <= range[1]; block = blocks[++index]) {
    if (depth === 0 && branchContinuations.has(block.tagName ?? '')) return false;
    depth += block.depthChange;
    if (depth < 0) return false;
  }
  return depth === 0;
}
