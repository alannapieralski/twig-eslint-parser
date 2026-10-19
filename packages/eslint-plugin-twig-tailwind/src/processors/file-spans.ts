import { findInterpolatedStrings, TwigSyntaxError } from 'twig-eslint-parser';
import type { Range } from '../shared/range.js';

export type FileSpans = {
  readonly text: string;
  readonly lineStarts: readonly number[];
  readonly interpolatedStrings: readonly Range[];
};

const eslintLineBreak = /\r\n|[\r\n\u2028\u2029]/gu;

function findLineStarts(text: string): number[] {
  return [0, ...[...text.matchAll(eslintLineBreak)].map((match) => (match.index as number) + match[0].length)];
}

function findInterpolatedStringsOrNone(text: string): readonly Range[] {
  try {
    return findInterpolatedStrings(text);
  } catch (error) {
    if (error instanceof TwigSyntaxError) return [];
    throw error;
  }
}

export function readFileSpans(text: string): FileSpans {
  return { text, lineStarts: findLineStarts(text), interpolatedStrings: findInterpolatedStringsOrNone(text) };
}

export function offsetOf(spans: FileSpans, line: number, column: number): number | undefined {
  const lineStart = spans.lineStarts[line - 1];
  return lineStart === undefined ? undefined : lineStart + column - 1;
}
