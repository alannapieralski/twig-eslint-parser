import { isSameOnEveryTwigBranch } from '../../twig/balance.js';
import { END_TAG_OPTIONAL_ELEMENT_NAMES } from '../syntax.js';
import { isCutOffByUnreadText } from './markup-end.js';
import type { TwigBlockSummary } from '../../twig/blocks.js';
import type { TwigDiagnostic } from '../../diagnostics.js';
import type { MarkupElement } from './markup-elements.js';
import type { MarkupEnd } from './markup-end.js';

function isMissingItsEndTag(element: MarkupElement): boolean {
  const isOpenTagComplete = element.openEnd !== undefined;
  const isEndTagRequired = !END_TAG_OPTIONAL_ELEMENT_NAMES.has(element.name ?? '');

  return isOpenTagComplete && !element.selfClosing && !element.close && isEndTagRequired;
}

export function findUnclosedElementDiagnostics(elements: readonly MarkupElement[], blocks: readonly TwigBlockSummary[], text: string, markupEnd: MarkupEnd): TwigDiagnostic[] {
  const isSameOnEveryBranch = (element: MarkupElement) => isSameOnEveryTwigBranch([element.openStart.range[0], element.range[1]], blocks);
  const isClosedByTheMarkupAfterIt = (element: MarkupElement) => !isCutOffByUnreadText(element, markupEnd);

  return elements
    .filter(isMissingItsEndTag)
    .filter(isSameOnEveryBranch)
    .filter(isClosedByTheMarkupAfterIt)
    .map((element): TwigDiagnostic => ({
      code: 'x-unclosed-element',
      message: `${text.slice(...element.openStart.range)}> is never closed. Add its closing tag.`,
      range: [element.openStart.range[0], element.openEnd?.range[1] ?? element.openStart.range[1]],
    }));
}
