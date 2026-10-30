import { findEndOfFileDiagnostics } from './end-of-file-diagnostics.js';
import { findEndTagDiagnostics } from './end-tag-diagnostics.js';
import { findMarkupElements } from './markup-elements.js';
import { findOpenTagDiagnostics } from './open-tag-diagnostics.js';
import { findUnclosedElementDiagnostics } from './unclosed-element-diagnostics.js';
import type { TwigDiagnostic } from '../../diagnostics.js';
import type { MarkupSource } from './markup-source.js';

export function findMarkupDiagnostics({ document, tokens, text, blocks }: MarkupSource): TwigDiagnostic[] {
  const elements = findMarkupElements(document);

  return [
    ...findOpenTagDiagnostics(elements, text, blocks),
    ...findEndTagDiagnostics({ document, tokens, elements, blocks, text }),
    ...findUnclosedElementDiagnostics(elements, text, blocks),
    ...findEndOfFileDiagnostics(document, text),
  ];
}
