import type { TwigBlockSummary } from 'twig-eslint-parser';

const WHITESPACE = /\s/;
const WHITESPACE_CONTROL = /[-~]/;
const ELEMENT_SEPARATORS: ReadonlySet<string> = new Set([',', '(', '[', '{']);

function inlineCommentAt(block: TwigBlockSummary, offset: number): TwigBlockSummary['inlineComments'][number] | undefined {
  return block.inlineComments.find(([start, end]) => start <= offset && offset < end);
}

function lastVisibleOffsetBefore(text: string, block: TwigBlockSummary, offset: number): number {
  let index = offset - 1;

  while (index >= 0) {
    const comment = inlineCommentAt(block, index);
    if (comment) index = comment[0] - 1;
    else if (WHITESPACE.test(text[index] ?? '')) index -= 1;
    else return index;
  }

  return index;
}

function openingEndOf(block: TwigBlockSummary, text: string): number {
  const afterBraces = block.range[0] + 2;
  const delimiterEnd = WHITESPACE_CONTROL.test(text[afterBraces] ?? '') ? afterBraces + 1 : afterBraces;
  if (block.kind !== 'tag' || !block.tagName) return delimiterEnd;

  const nameStart = text.indexOf(block.tagName, delimiterEnd);
  return nameStart + block.tagName.length;
}

export function continuesPreviousLine(text: string, block: TwigBlockSummary, lineStart: number): boolean {
  const lastVisibleOffset = lastVisibleOffsetBefore(text, block, lineStart);
  const isFirstLineOfContent = lastVisibleOffset < openingEndOf(block, text);
  if (isFirstLineOfContent) return false;

  return !ELEMENT_SEPARATORS.has(text[lastVisibleOffset] ?? '');
}
