import { rawTextElementNames, singleTokenNodeTypes } from 'twig-eslint-parser';
import { whitespaceSensitiveElements } from '../../../shared/html-elements.js';
import { lineIndentationAt } from '../../../shared/line-text.js';
import type { Range } from '../../../shared/range.js';
import { isOpenTagUnreadable } from '../../../shared/unreadable-open-tags.js';
import type { AttributesOf } from '../../../shared/tag-attributes.js';
import { elementNameOf } from '../../../shared/tag-node.js';
import { bodyOf, flattenMarkup, interiorOf, isElement } from './html-elements.js';
import type { Element, MarkupNode, OpenTag } from './types.js';

type HtmlSource = {
  readonly text: string;
  readonly attributesOf: AttributesOf;
  readonly ignores: readonly string[];
  readonly rawContentTags: readonly string[];
  readonly unreadableTagStarts: ReadonlySet<number>;
};

export type HtmlRegions = {
  readonly elements: readonly Element[];
  readonly nestings: readonly Range[];
  readonly skipped: readonly Range[];
  readonly unclosedContent: readonly Range[];
  readonly closeTags: readonly Range[];
};

function isDefined<Value>(value: Value | undefined): value is Value {
  return value !== undefined;
}

function findSkippedInElement(
  element: Element,
  unreadableTagStarts: ReadonlySet<number>,
  attributes: readonly { readonly range: Range }[],
  ignoredNames: ReadonlySet<string>,
  whitespaceSensitiveNames: ReadonlySet<string>,
): Range[] {
  const { openStart, openEnd, close } = element;
  const attributeInteriors = attributes.map((attribute) => interiorOf(attribute.range));

  if (!openEnd) return [[openStart.range[1], Infinity]];

  const isUnreadableOpenTag = isOpenTagUnreadable(element, unreadableTagStarts);
  if (isUnreadableOpenTag) return [[openStart.range[1], element.range[1]]];

  if (!close) return attributeInteriors;

  if (whitespaceSensitiveNames.has(elementNameOf(element))) return [...attributeInteriors, [openEnd.range[1], close.range[1]]];

  const isContentLeftAlone = Object.hasOwn(rawTextElementNames, element.type) || ignoredNames.has(elementNameOf(element));
  if (isContentLeftAlone) return [...attributeInteriors, [openEnd.range[1], close.range[0]]];

  return attributeInteriors;
}

function findUnclosedContent(element: Element): Range | undefined {
  const hasUnclosedChildren = !element.close && (element.children ?? []).length > 0;
  if (!element.openEnd || !hasUnclosedChildren) return undefined;
  return [element.openEnd.range[1], element.range[1]];
}

export function findHtmlRegions(document: MarkupNode, source: HtmlSource): HtmlRegions {
  const { attributesOf, unreadableTagStarts } = source;
  const ignoredNames = new Set(source.ignores.map((name) => name.toLowerCase()));
  const whitespaceSensitiveNames = new Set([...whitespaceSensitiveElements, ...source.rawContentTags].map((name) => name.toLowerCase()));
  const markupNodes = flattenMarkup(document.children ?? []);
  const elements = markupNodes.filter(isElement);

  const tokenInteriors = markupNodes.filter((node) => singleTokenNodeTypes.includes(node.type)).map((node) => interiorOf(node.range));
  const elementSkips = elements.flatMap((element) => findSkippedInElement(element, unreadableTagStarts, attributesOf(element), ignoredNames, whitespaceSensitiveNames));

  return {
    elements,
    nestings: elements.map(bodyOf).filter(isDefined),
    skipped: [...tokenInteriors, ...elementSkips],
    unclosedContent: elements.map(findUnclosedContent).filter(isDefined),
    closeTags: elements.flatMap((element) => (element.close ? [element.close.range] : [])),
  };
}

export function describeOpenTags(elements: readonly Element[], source: HtmlSource, depthUnknown: readonly Range[]): OpenTag[] {
  const { text, attributesOf } = source;

  return elements.flatMap((element): OpenTag[] => {
    if (!element.openEnd) return [];

    const attributes = attributesOf(element);
    const tagStart = element.openStart.range[0];
    const firstAttribute = attributes[0];
    const isFirstAttributeOnTagLine = firstAttribute !== undefined && !text.slice(tagStart, firstAttribute.range[0]).includes('\n');
    const isDepthUnknown = depthUnknown.some((range) => range[0] <= tagStart && tagStart < range[1]);

    return [{
      start: tagStart,
      attributesStart: element.openStart.range[1],
      closeBracketStart: element.openEnd.range[0],
      isSelfClosing: element.openEnd.value === '/>',
      firstAttributeColumn: isFirstAttributeOnTagLine ? firstAttribute.range[0] - tagStart : undefined,
      lineIndentationAsWritten: isDepthUnknown ? lineIndentationAt(text, tagStart) : undefined,
    }];
  });
}
