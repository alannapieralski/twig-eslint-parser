import type { TwigBlockSummary, TwigStringSummary } from 'twig-eslint-parser';
import { lineIndentationAt } from '../../shared/line-indentation.js';
import { isBlankFrom } from './line-starts.js';
import type { BracketLine } from './types.js';

const leadingIndentation = /^[ \t]*/;

type BracketPair = TwigBlockSummary['bracketPairs'][number];

type BracketLayoutInput = {
  readonly text: string;
  readonly block: TwigBlockSummary;
  readonly startLineIndentation: string;
  readonly unitText: string;
  readonly strings: readonly TwigStringSummary[];
};

function lineStartOf(text: string, offset: number): number {
  return text.lastIndexOf('\n', offset - 1) + 1;
}

function findLineStartsWithin(text: string, range: readonly [number, number]): number[] {
  const lineStarts: number[] = [];

  for (let lineBreak = text.indexOf('\n', range[0]); lineBreak !== -1 && lineBreak < range[1]; lineBreak = text.indexOf('\n', lineBreak + 1)) {
    lineStarts.push(lineBreak + 1);
  }

  return lineStarts;
}

function isInsideString(lineStart: number, strings: readonly TwigStringSummary[]): boolean {
  return strings.some((string) => string.range[0] < lineStart && lineStart < string.range[1]);
}

function findInnermostPairOpenedBefore(lineStart: number, contentStart: number, pairs: readonly BracketPair[]): BracketPair | undefined {
  const enclosing = pairs.filter(([open, close]) => open < lineStart && contentStart < close);
  return enclosing.at(-1);
}

export function findBracketLines(input: BracketLayoutInput): BracketLine[] {
  const { text, block, startLineIndentation, unitText, strings } = input;
  const startLineStart = lineStartOf(text, block.range[0]);
  const indentations = new Map<number, string>([[startLineStart, startLineIndentation]]);
  const bracketLines: BracketLine[] = [];

  const indentationOfLineAt = (offset: number): string => {
    const lineStart = lineStartOf(text, offset);
    return indentations.get(lineStart) ?? lineIndentationAt(text, offset);
  };

  for (const lineStart of findLineStartsWithin(text, block.range)) {
    const contentStart = lineStart + (text.slice(lineStart).match(leadingIndentation)?.[0].length ?? 0);
    if (isBlankFrom(text, contentStart) || isInsideString(lineStart, strings)) continue;

    const closedPair = block.bracketPairs.find(([open, close]) => close === contentStart && open < lineStart);
    const enclosingPair = findInnermostPairOpenedBefore(lineStart, contentStart, block.bracketPairs);
    const indentation = closedPair
      ? indentationOfLineAt(closedPair[0])
      : enclosingPair && `${indentationOfLineAt(enclosingPair[0])}${unitText}`;
    if (indentation === undefined) continue;

    indentations.set(lineStart, indentation);
    bracketLines.push({ lineStart, contentStart, indentation });
  }

  return bracketLines;
}
