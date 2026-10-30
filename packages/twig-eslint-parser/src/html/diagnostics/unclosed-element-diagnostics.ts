import { isSameOnEveryTwigBranch } from '../../twig/balance.js';
import { END_TAG_OPTIONAL_ELEMENT_NAMES } from '../syntax.js';
import { openTagRangeOf, openTagTextOf } from './markup-elements.js';
import type { TwigBlockSummary } from '../../twig/blocks.js';
import type { TwigDiagnostic } from '../../diagnostics.js';
import type { MarkupElement } from './markup-elements.js';

function isMissingItsEndTag(element: MarkupElement): boolean {
  const isOpenTagComplete = element.openEnd !== undefined;
  const isEndTagRequired = !END_TAG_OPTIONAL_ELEMENT_NAMES.has(element.name ?? '');

  return isOpenTagComplete && !element.selfClosing && !element.close && isEndTagRequired;
}

export function findUnclosedElementDiagnostics(elements: readonly MarkupElement[], text: string, blocks: readonly TwigBlockSummary[]): TwigDiagnostic[] {
  const isSameOnEveryBranch = (element: MarkupElement) => isSameOnEveryTwigBranch(element.range, blocks);

  return elements
    .filter(isMissingItsEndTag)
    .filter(isSameOnEveryBranch)
    .map((element): TwigDiagnostic => ({
      code: 'x-unclosed-element',
      message: `${openTagTextOf(element, text)} is never closed. Add its closing tag.`,
      range: openTagRangeOf(element),
    }));
}
