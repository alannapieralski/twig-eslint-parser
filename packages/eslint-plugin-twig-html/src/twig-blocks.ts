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
