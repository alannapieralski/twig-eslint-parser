import { DRUPAL_VOID_ELEMENTS } from '../../drupal.js';
import { isRangeWithin } from '../../range.js';
import { closeTagNameOf, tagNameKey } from '../../es-html-parser/utils/tag-name.js';
import { findTwigBranchSpans, isInsideTwigBranch } from '../../twig/balance.js';
import { VOID_ELEMENT_NAMES } from '../syntax.js';
import { findInnermostOpenElement, openTagTextOf } from './markup-elements.js';
import type { TwigDiagnostic } from '../../diagnostics.js';
import type { TwigBlockSummary } from '../../twig/blocks.js';
import type { MarkupElement, MarkupTreeNode, SourceToken } from './markup-elements.js';

export type EndTagSource = {
  readonly document: MarkupTreeNode;
  readonly tokens: readonly SourceToken[];
  readonly elements: readonly MarkupElement[];
  readonly blocks: readonly TwigBlockSummary[];
  readonly text: string;
};

const VOID_ELEMENTS: ReadonlySet<string> = new Set([...VOID_ELEMENT_NAMES, ...DRUPAL_VOID_ELEMENTS]);

function nameOfEndTag(token: SourceToken): string {
  return tagNameKey(closeTagNameOf(token));
}

function findNamesClosedBy(element: MarkupElement, unclosedElements: readonly MarkupElement[]): string[] {
  const isInside = (inner: MarkupElement) => isRangeWithin(inner.range, element.range);
  return [element, ...unclosedElements.filter(isInside)].map((closed) => closed.name ?? '');
}

function describeStrayEndTag(token: SourceToken, source: EndTagSource): string {
  const openElement = findInnermostOpenElement(source.document, token.range[0]);
  if (!openElement) return `${token.value} closes nothing, because no element is open. Remove it or add the opening tag.`;

  return `${token.value} does not match the open ${openTagTextOf(openElement, source.text)}. Remove it or correct its name.`;
}

export function findEndTagDiagnostics(source: EndTagSource): TwigDiagnostic[] {
  const elementByCloseStart = new Map(source.elements.flatMap((element) => (element.close ? [[element.close.range[0], element] as const] : [])));
  const unclosedElements = source.elements.filter((element) => !element.close && !element.selfClosing);
  const branchSpans = findTwigBranchSpans(source.blocks);
  const namesClosedInBranches = new Set<string>();
  const diagnostics: TwigDiagnostic[] = [];

  for (const token of source.tokens) {
    if (token.type !== 'CloseTag') continue;

    const isInBranch = isInsideTwigBranch(token.range[0], branchSpans);
    const closedElement = elementByCloseStart.get(token.range[0]);
    if (closedElement && isInBranch) findNamesClosedBy(closedElement, unclosedElements).forEach((name) => namesClosedInBranches.add(name));
    if (closedElement || isInBranch) continue;

    const name = nameOfEndTag(token);
    const isLeftAlone = VOID_ELEMENTS.has(name) || namesClosedInBranches.has(name);
    if (isLeftAlone) continue;

    diagnostics.push({ code: 'x-invalid-end-tag', message: describeStrayEndTag(token, source), range: token.range });
  }

  return diagnostics;
}
