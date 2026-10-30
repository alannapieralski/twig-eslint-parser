import { ESCAPABLE_RAW_TEXT_ELEMENT_NAMES } from '../syntax.js';
import { findEndTagDiagnostics } from './end-tag-diagnostics.js';
import { findMarkupElements } from './markup-elements.js';
import { readMarkupEnd } from './markup-end.js';
import { findOpenTagDiagnostics } from './open-tag-diagnostics.js';
import { findUnclosedElementDiagnostics } from './unclosed-element-diagnostics.js';
import { findUnreadEndDiagnostics } from './unread-end-diagnostics.js';
import type { TwigDiagnostic } from '../../diagnostics.js';
import type { MarkupSource } from './markup-source.js';

export function findMarkupDiagnostics({ document, tokens, text, blocks, rawContentTags }: MarkupSource): TwigDiagnostic[] {
  const elements = findMarkupElements(document);
  const markupEnd = readMarkupEnd(document, text);
  const rawTextNames = new Set([...ESCAPABLE_RAW_TEXT_ELEMENT_NAMES, ...rawContentTags]);

  return [
    ...findOpenTagDiagnostics(elements, text, blocks),
    ...findEndTagDiagnostics({ document, tokens, elements, blocks, text }),
    ...findUnclosedElementDiagnostics(elements, blocks, text, markupEnd),
    ...findUnreadEndDiagnostics(markupEnd, text, rawTextNames),
  ];
}
