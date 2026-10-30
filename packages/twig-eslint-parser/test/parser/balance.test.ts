import { describe, expect, it } from 'vitest';
import { depthChangeWithin, isSameOnEveryTwigBranch, isTwigBalancedWithin } from '../../src/twig/balance.js';
import type { TwigBlockSummary } from '../../src/twig/blocks.js';

const block = (tagName: string, start: number, depthChange: TwigBlockSummary['depthChange']): TwigBlockSummary => ({
  kind: 'tag',
  tagName,
  range: [start, start + 5],
  depthChange,
  bracketPairs: [],
  inlineComments: [],
});

const ifBlock = block('if', 0, 1);
const elseBlock = block('else', 10, 0);
const endifBlock = block('endif', 20, -1);
const BLOCKS = [ifBlock, elseBlock, endifBlock];

describe('depthChangeWithin', () => {
  it('adds the depth change of every block inside the range', () => {
    expect(depthChangeWithin([0, 25], BLOCKS)).toBe(0);
    expect(depthChangeWithin([0, 15], BLOCKS)).toBe(1);
  });

  it('ignores blocks that start before the range or end after it', () => {
    expect(depthChangeWithin([1, 22], BLOCKS)).toBe(0);
    expect(depthChangeWithin([21, 30], BLOCKS)).toBe(0);
  });
});

describe('isTwigBalancedWithin', () => {
  it('accepts a range holding a whole if, else and endif', () => {
    expect(isTwigBalancedWithin([0, 25], BLOCKS)).toBe(true);
  });

  it('rejects a range that opens a block without closing it', () => {
    expect(isTwigBalancedWithin([0, 15], BLOCKS)).toBe(false);
  });

  it('rejects a range that closes a block it did not open', () => {
    expect(isTwigBalancedWithin([20, 25], BLOCKS)).toBe(false);
  });

  it('rejects a range that continues a branch it did not open', () => {
    expect(isTwigBalancedWithin([10, 25], BLOCKS)).toBe(false);
  });

  it('accepts a range with no blocks', () => {
    expect(isTwigBalancedWithin([30, 40], BLOCKS)).toBe(true);
  });
});

describe('isSameOnEveryTwigBranch', () => {
  const forBlock = block('for', 0, 1);
  const innerIfBlock = block('if', 10, 1);
  const innerEndifBlock = block('endif', 20, -1);
  const endforBlock = block('endfor', 30, -1);
  const NESTED_BLOCKS = [forBlock, innerIfBlock, innerEndifBlock, endforBlock];

  it('accepts a range with no blocks', () => {
    expect(isSameOnEveryTwigBranch([30, 40], BLOCKS)).toBe(true);
  });

  it('accepts a range holding a whole if and endif', () => {
    expect(isSameOnEveryTwigBranch([0, 25], BLOCKS)).toBe(true);
  });

  it('accepts a range holding an if nested in a for', () => {
    expect(isSameOnEveryTwigBranch([0, 35], NESTED_BLOCKS)).toBe(true);
  });

  it('rejects a range that opens an if without closing it', () => {
    expect(isSameOnEveryTwigBranch([0, 15], BLOCKS)).toBe(false);
  });

  it('rejects a range that starts at an else', () => {
    expect(isSameOnEveryTwigBranch([10, 25], BLOCKS)).toBe(false);
  });

  it('rejects a range that closes an if it did not open', () => {
    expect(isSameOnEveryTwigBranch([20, 25], BLOCKS)).toBe(false);
  });

  it('rejects a range that closes the for around an if it did not start in', () => {
    expect(isSameOnEveryTwigBranch([10, 35], NESTED_BLOCKS)).toBe(false);
  });

  it('accepts a range that opens a tag whose body always renders', () => {
    expect(isSameOnEveryTwigBranch([0, 5], [block('block', 0, 1)])).toBe(true);
  });
});
