import type { TwigBlockSummary } from 'twig-eslint-parser';
import { whitespaceSensitiveElements } from '../../shared/html-elements.js';
import { lineIndentationAt } from '../../shared/line-indentation.js';
import type { Range } from '../../shared/range.js';
import { isOpenTagSwallowingMarkup } from '../../shared/swallowed-markup.js';
import type { AttributesOf } from '../../shared/tag-attributes.js';
import type { Token } from '../../shared/tag-node.js';
import { findYamlFrontMatter } from './yaml-front-matter.js';
import { twigBlockEnd } from './twig-frames.js';
import type { IndentLayout, MarkupNode, OpenTag, TwigSegment } from './types.js';

type Element = MarkupNode & { readonly openStart: Token };
type CrossingSpan = { readonly range: Range; readonly splitsOpenTag: boolean };

type LayoutSource = {
  readonly text: string;
  readonly blocks: readonly TwigBlockSummary[];
  readonly attributesOf: AttributesOf;
  readonly ignores: readonly string[];
};

const elementNodeTypes: ReadonlySet<string> = new Set(['Tag', 'ScriptTag', 'StyleTag']);
const rawTextNodeTypes: ReadonlySet<string> = new Set(['ScriptTag', 'StyleTag']);
const singleTokenNodeTypes: ReadonlySet<string> = new Set(['Comment', 'Doctype']);
const unindentedTwigFrames: ReadonlySet<string> = new Set(['verbatim', 'raw']);

function isDefined<Value>(value: Value | undefined): value is Value {
  return value !== undefined;
}

function flattenMarkup(nodes: readonly MarkupNode[]): MarkupNode[] {
  const flattened: MarkupNode[] = [];
  const toVisit = [...nodes].reverse();

  for (let node = toVisit.pop(); node; node = toVisit.pop()) {
    flattened.push(node);
    for (const child of [...(node.children ?? [])].reverse()) toVisit.push(child);
  }

  return flattened;
}

function isElement(node: MarkupNode): node is Element {
  return elementNodeTypes.has(node.type) && node.openStart !== undefined;
}

function interiorOf(range: Range): Range {
  return [range[0] + 1, range[1]];
}

function bodyOf(element: Element): Range | undefined {
  if (!element.openEnd || !element.close) return undefined;
  return [element.openEnd.range[1], element.close.range[0]];
}

function extentOf(element: Element): Range {
  const lastToken = element.close ?? element.openEnd ?? element.openStart;
  return [element.openStart.range[0], lastToken.range[1]];
}

function nameOf(element: Element): string {
  return (element.name ?? '').toLowerCase();
}

function isContentWhitespaceSensitive(element: Element): boolean {
  const hasRawContent = (element.children ?? []).some((child) => child.type === 'RawContent');
  return hasRawContent || whitespaceSensitiveElements.includes(nameOf(element));
}

function findSkippedInElement(element: Element, text: string, attributes: readonly { readonly range: Range }[], ignoredNames: ReadonlySet<string>): Range[] {
  const { openStart, openEnd, close } = element;
  const attributeInteriors = attributes.map((attribute) => interiorOf(attribute.range));

  if (!openEnd) return [[openStart.range[1], Infinity]];

  const isSwallowingMarkup = isOpenTagSwallowingMarkup({ openEnd, attributes }, text);
  if (isSwallowingMarkup) return [[openStart.range[1], element.range[1]]];

  if (!close) return attributeInteriors;

  if (isContentWhitespaceSensitive(element)) return [...attributeInteriors, [openEnd.range[1], close.range[1]]];

  const isContentLeftAlone = rawTextNodeTypes.has(element.type) || ignoredNames.has(nameOf(element));
  if (isContentLeftAlone) return [...attributeInteriors, [openEnd.range[1], close.range[0]]];

  return attributeInteriors;
}

function findUnclosedContent(element: Element): Range | undefined {
  const hasUnclosedChildren = !element.close && (element.children ?? []).length > 0;
  if (!element.openEnd || !hasUnclosedChildren) return undefined;
  return [element.openEnd.range[1], element.range[1]];
}

function describeOpenTag(element: Element, text: string, attributes: readonly { readonly range: Range }[], depthUnknown: readonly Range[]): OpenTag | undefined {
  if (!element.openEnd) return undefined;

  const tagStart = element.openStart.range[0];
  const firstAttribute = attributes[0];
  const isFirstAttributeOnTagLine = firstAttribute !== undefined && !text.slice(tagStart, firstAttribute.range[0]).includes('\n');
  const isDepthUnknown = depthUnknown.some((range) => range[0] <= tagStart && tagStart < range[1]);

  return {
    start: tagStart,
    attributesStart: element.openStart.range[1],
    closeBracketStart: element.openEnd.range[0],
    isSelfClosing: element.openEnd.value === '/>',
    firstAttributeColumn: isFirstAttributeOnTagLine ? firstAttribute.range[0] - tagStart : undefined,
    lineIndentationAsWritten: isDepthUnknown ? lineIndentationAt(text, tagStart) : undefined,
  };
}

function isCrossing(first: Range, second: Range): boolean {
  const firstStartsOutside = first[0] < second[0] && second[0] < first[1] && first[1] < second[1];
  const secondStartsOutside = second[0] < first[0] && first[0] < second[1] && second[1] < first[1];
  return firstStartsOutside || secondStartsOutside;
}

function frameExtentOf(segment: TwigSegment, segments: readonly TwigSegment[]): Range {
  const frameEnds = segments.filter((candidate) => candidate.frameStart === segment.frameStart).map((candidate) => candidate.extent[1]);
  return [segment.frameStart, Math.max(...frameEnds)];
}

function openTagOf(element: Element): Range {
  const openTagEnd = element.openEnd?.range[1] ?? element.range[1];
  return [element.openStart.range[0], openTagEnd];
}

function findCrossingSpans(elements: readonly Element[], segments: readonly TwigSegment[]): CrossingSpan[] {
  return elements.flatMap((element) => {
    const extent = extentOf(element);
    const inner = bodyOf(element) ?? extent;
    const openTag = openTagOf(element);
    const isInsideOpenTag = (offset: number) => openTag[0] < offset && offset < openTag[1];
    const crossedSegments = segments.filter((segment) => isCrossing(extent, segment.extent));

    return crossedSegments.map((segment): CrossingSpan => {
      const frameExtent = frameExtentOf(segment, segments);
      const splitsOpenTag = isInsideOpenTag(frameExtent[0]) || isInsideOpenTag(frameExtent[1]);
      const start = splitsOpenTag ? extent[0] : Math.min(inner[0], frameExtent[0]);
      return { range: [start, Math.max(inner[1], frameExtent[1])], splitsOpenTag };
    });
  });
}

function findTwigInteriors(blocks: readonly TwigBlockSummary[], text: string): Range[] {
  return blocks.map((block): Range => [block.range[0] + 1, twigBlockEnd(block, text)]);
}

export function buildIndentLayout(document: MarkupNode, segments: readonly TwigSegment[], source: LayoutSource): IndentLayout {
  const { text, blocks, attributesOf } = source;
  const ignoredNames = new Set(source.ignores.map((name) => name.toLowerCase()));
  const markupNodes = flattenMarkup(document.children ?? []);
  const elements = markupNodes.filter(isElement);

  const bodies = elements.map(bodyOf).filter(isDefined);
  const crossingSpans = findCrossingSpans(elements, segments);

  const tokenInteriors = markupNodes.filter((node) => singleTokenNodeTypes.has(node.type)).map((node) => interiorOf(node.range));
  const unindentedSegments = segments.filter((segment) => unindentedTwigFrames.has(segment.frameName)).map((segment) => segment.range);
  const elementSkips = elements.flatMap((element) => findSkippedInElement(element, text, attributesOf(element), ignoredNames));
  const splitOpenTags = crossingSpans.filter((span) => span.splitsOpenTag).map((span) => span.range);
  const branchSplitContent = crossingSpans.filter((span) => !span.splitsOpenTag).map((span) => span.range);
  const depthUnknown = [...branchSplitContent, ...elements.map(findUnclosedContent).filter(isDefined)];

  return {
    nestings: [...bodies, ...segments.map((segment) => segment.range)],
    skipped: [...findYamlFrontMatter(text), ...splitOpenTags, ...tokenInteriors, ...findTwigInteriors(blocks, text), ...unindentedSegments, ...elementSkips],
    depthUnknown,
    openTags: elements.map((element) => describeOpenTag(element, text, attributesOf(element), depthUnknown)).filter(isDefined),
    closeTags: elements.flatMap((element) => (element.close ? [element.close.range] : [])),
  };
}
