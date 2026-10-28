import type { TwigBlockSummary } from 'twig-eslint-parser';

const WHITESPACE = /\s/;
const WHITESPACE_CONTROL = /[-~]/;
const ELEMENT_SEPARATORS: ReadonlySet<string> = new Set([',', '(', '[', '{']);

function lastVisibleOffsetBefore(text: string, offset: number): number {
  let index = offset - 1;
  while (index >= 0 && WHITESPACE.test(text[index] ?? '')) index -= 1;
  return index;
}

function openingDelimiterEndOf(block: TwigBlockSummary, text: string): number {
  const afterBraces = block.range[0] + 2;
  return WHITESPACE_CONTROL.test(text[afterBraces] ?? '') ? afterBraces + 1 : afterBraces;
}

export function continuesPreviousLine(text: string, block: TwigBlockSummary, lineStart: number): boolean {
  const lastVisibleOffset = lastVisibleOffsetBefore(text, lineStart);
  const isFirstLineOfContent = lastVisibleOffset < openingDelimiterEndOf(block, text);
  if (isFirstLineOfContent) return false;

  return !ELEMENT_SEPARATORS.has(text[lastVisibleOffset] ?? '');
}
