import { ESCAPABLE_RAW_TEXT_ELEMENT_NAMES } from '../syntax.js';
import { findEndTagDiagnostics } from './end-tag-diagnostics.js';
import { findMarkupElements } from './markup-elements.js';
import { readMarkupEnd } from './markup-end.js';
import { findOpenTagDiagnostics } from './open-tag-diagnostics.js';
import { findTrailingSolidusDiagnostics } from './trailing-solidus-diagnostics.js';
import { findUnclosedElementDiagnostics } from './unclosed-element-diagnostics.js';
import { findUnreadEndDiagnostics } from './unread-end-diagnostics.js';
import type { TwigDiagnostic } from '../../diagnostics.js';
import type { TwigBlockSummary } from '../../twig/blocks.js';
import type { MarkupTreeNode, SourceToken } from './markup-elements.js';

export type MarkupSource = {
  readonly document: MarkupTreeNode;
  readonly tokens: readonly SourceToken[];
  readonly text: string;
  readonly blocks: readonly TwigBlockSummary[];
  readonly rawContentTags: ReadonlySet<string>;
};

export function findMarkupDiagnostics({ document, tokens, text, blocks, rawContentTags }: MarkupSource): TwigDiagnostic[] {
  const elements = findMarkupElements(document);
  const markupEnd = readMarkupEnd(document, text);
  const rawTextNames = new Set([...ESCAPABLE_RAW_TEXT_ELEMENT_NAMES, ...rawContentTags]);

  return [
    ...findOpenTagDiagnostics(elements, text, blocks),
    ...findTrailingSolidusDiagnostics(document, text),
    ...findEndTagDiagnostics({ document, tokens, elements, blocks, text }),
    ...findUnclosedElementDiagnostics(elements, blocks, text, markupEnd),
    ...findUnreadEndDiagnostics(markupEnd, text, rawTextNames),
  ];
}
