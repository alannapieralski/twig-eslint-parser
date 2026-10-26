import { describeOpenTags, findHtmlRegions } from './html/html-regions.js';
import { findSeams } from './seams.js';
import { findTwigRegions } from './twig/twig-regions.js';
import { findYamlFrontMatter } from './yaml-front-matter.js';
import type { TwigBlockSummary } from 'twig-eslint-parser';
import type { HtmlSource } from './html/html-regions.js';
import type { MarkupNode } from './html/types.js';
import type { TwigSegment } from './twig/types.js';
import type { IndentLayout } from './types.js';

export type LayoutSource = HtmlSource & { readonly blocks: readonly TwigBlockSummary[] };

export function buildIndentLayout(document: MarkupNode, segments: readonly TwigSegment[], source: LayoutSource): IndentLayout {
  const html = findHtmlRegions(document, source);
  const twig = findTwigRegions(segments, source.blocks, source.text);
  const seams = findSeams(html.elements, segments);
  const depthUnknown = [...seams.branchSplitContent, ...html.unclosedContent];

  return {
    nestings: [...html.nestings, ...twig.nestings],
    skipped: [...findYamlFrontMatter(source.text), ...seams.splitOpenTags, ...html.skipped, ...twig.skipped],
    depthUnknown,
    openTags: describeOpenTags(html.elements, source, depthUnknown),
    closeTags: html.closeTags,
  };
}
