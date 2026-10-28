import { END_TAG_OPTIONAL_ELEMENT_NAMES, FOREIGN_ELEMENT_NAMES, NON_VOID_HTML_ELEMENT_NAMES } from '../syntax.js';
import { isMarkupElement } from './markup-elements.js';
import type { TwigDiagnostic } from '../../diagnostics.js';
import type { MarkupElement, MarkupTreeNode } from './markup-elements.js';

type NodeInContext = { readonly node: MarkupTreeNode; readonly isInForeignContent: boolean };

function isHtmlElementLeftOpenBySolidus(element: MarkupElement): boolean {
  const name = element.name ?? '';
  return element.openEnd?.value === '/>' && NON_VOID_HTML_ELEMENT_NAMES.has(name) && !END_TAG_OPTIONAL_ELEMENT_NAMES.has(name);
}

function describeTrailingSolidus(element: MarkupElement, text: string): TwigDiagnostic {
  const openTag = `${text.slice(...element.openStart.range)}>`;

  return {
    code: 'non-void-html-element-start-tag-with-trailing-solidus',
    message: `HTML ignores the "/" at the end of ${openTag}, so the element stays open and takes in the markup after it. Close it with a closing tag.`,
    range: [element.openStart.range[0], element.openEnd?.range[1] ?? element.openStart.range[1]],
  };
}

export function findTrailingSolidusDiagnostics(document: MarkupTreeNode, text: string): TwigDiagnostic[] {
  const diagnostics: TwigDiagnostic[] = [];
  const toVisit: NodeInContext[] = [{ node: document, isInForeignContent: false }];

  for (let visit = toVisit.pop(); visit; visit = toVisit.pop()) {
    const { node } = visit;
    const isElement = isMarkupElement(node);
    const isInForeignContent = visit.isInForeignContent || (isElement && FOREIGN_ELEMENT_NAMES.includes(node.name ?? ''));

    if (isElement && !isInForeignContent && isHtmlElementLeftOpenBySolidus(node)) diagnostics.push(describeTrailingSolidus(node, text));
    toVisit.push(...(node.children ?? []).map((child) => ({ node: child, isInForeignContent })));
  }

  return diagnostics;
}
