import { isRangeWithin } from 'twig-eslint-parser';
import type { TwigBlockSummary } from 'twig-eslint-parser';
import type { Range } from '../../shared/range.js';

const TWIG_SHOWN_AS: Readonly<Record<TwigBlockSummary['kind'], string>> = { print: '{{ … }}', tag: '{% … %}', comment: '{# … #}' };

export function describeWrittenTag(range: Range, text: string, blocks: readonly TwigBlockSummary[]): string {
  const blocksInside = blocks.filter((block) => isRangeWithin(block.range, range));
  let written = '';
  let position = range[0];

  for (const block of blocksInside) {
    written += `${text.slice(position, block.range[0])}${TWIG_SHOWN_AS[block.kind]}`;
    position = block.range[1];
  }

  return `${written}${text.slice(position, range[1])}`;
}
