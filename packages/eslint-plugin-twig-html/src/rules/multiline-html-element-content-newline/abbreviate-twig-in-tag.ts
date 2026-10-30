import { isRangeWithin } from 'twig-eslint-parser';
import type { TwigBlockSummary } from 'twig-eslint-parser';
import type { Range } from '../../shared/range.js';

const TWIG_SHOWN_AS: Readonly<Record<TwigBlockSummary['kind'], string>> = { print: '{{ … }}', tag: '{% … %}', comment: '{# … #}' };

export function abbreviateTwigInTag(tagRange: Range, text: string, blocks: readonly TwigBlockSummary[]): string {
  const twigBlocksInsideTag = blocks.filter((block) => isRangeWithin(block.range, tagRange));
  let abbreviated = '';
  let position = tagRange[0];

  for (const block of twigBlocksInsideTag) {
    abbreviated += `${text.slice(position, block.range[0])}${TWIG_SHOWN_AS[block.kind]}`;
    position = block.range[1];
  }

  return `${abbreviated}${text.slice(position, tagRange[1])}`;
}
