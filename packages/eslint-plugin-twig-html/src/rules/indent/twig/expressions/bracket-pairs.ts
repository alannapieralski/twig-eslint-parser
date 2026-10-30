import { createLastStartingLookup } from '../../range-lookup.js';
import type { BracketPair, LineContext } from './types.js';

export type BracketLookup = {
  readonly findClosedPair: (lineStart: number, contentStart: number) => BracketPair | undefined;
  readonly findEnclosingPair: (lineStart: number, contentStart: number) => BracketPair | undefined;
};

export const OUTSIDE_ANY_BRACKET = -1;

function findParentPairs(pairs: readonly BracketPair[]): ReadonlyMap<BracketPair, BracketPair | undefined> {
  const parents = new Map<BracketPair, BracketPair | undefined>();
  const openPairs: BracketPair[] = [];

  for (const pair of pairs) {
    while ((openPairs.at(-1)?.[1] ?? Infinity) < pair[0]) openPairs.pop();
    parents.set(pair, openPairs.at(-1));
    openPairs.push(pair);
  }

  return parents;
}

export function createBracketLookup(pairs: readonly BracketPair[]): BracketLookup {
  const pairByClose = new Map(pairs.map((pair) => [pair[1], pair]));
  const parentOf = findParentPairs(pairs);
  const findLastOpenedBefore = createLastStartingLookup(pairs, (pair) => pair[0] + 1);

  return {
    findClosedPair: (lineStart, contentStart) => {
      const pair = pairByClose.get(contentStart);
      return pair && pair[0] < lineStart ? pair : undefined;
    },
    findEnclosingPair: (lineStart, contentStart) => {
      let pair = findLastOpenedBefore(lineStart);
      while (pair && pair[1] <= contentStart) pair = parentOf.get(pair);
      return pair;
    },
  };
}

export function findClosedPair(line: LineContext): BracketPair | undefined {
  return line.brackets.findClosedPair(line.lineStart, line.contentStart);
}

export function findEnclosingPair(line: LineContext): BracketPair | undefined {
  return line.brackets.findEnclosingPair(line.lineStart, line.contentStart);
}

export function bracketLevelOf(line: LineContext): number {
  return findEnclosingPair(line)?.[0] ?? OUTSIDE_ANY_BRACKET;
}
