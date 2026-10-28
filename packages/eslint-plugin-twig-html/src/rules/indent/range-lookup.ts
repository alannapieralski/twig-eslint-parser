import type { Range } from '../../shared/range.js';

export type RangeCoverage = {
  readonly countAt: (offset: number) => number;
  readonly covers: (offset: number) => boolean;
};

function byOffset(first: number, second: number): number {
  return first - second;
}

function countAtOrBefore(sortedOffsets: readonly number[], offset: number): number {
  let low = 0;
  let high = sortedOffsets.length;

  while (low < high) {
    const middle = (low + high) >> 1;
    if ((sortedOffsets[middle] ?? Infinity) <= offset) low = middle + 1;
    else high = middle;
  }

  return low;
}

export function interiorOf(range: Range): Range {
  return [range[0] + 1, range[1]];
}

export function createRangeCoverage(ranges: readonly Range[]): RangeCoverage {
  const starts = ranges.map((range) => range[0]).sort(byOffset);
  const ends = ranges.map((range) => range[1]).sort(byOffset);
  const countAt = (offset: number) => countAtOrBefore(starts, offset) - countAtOrBefore(ends, offset);

  return { countAt, covers: (offset) => countAt(offset) > 0 };
}

export function createLastStartingLookup<Item>(items: readonly Item[], startOf: (item: Item) => number): (offset: number) => Item | undefined {
  const sortedItems = items.toSorted((first, second) => startOf(first) - startOf(second));
  const sortedStarts = sortedItems.map(startOf);

  return (offset) => sortedItems[countAtOrBefore(sortedStarts, offset) - 1];
}
