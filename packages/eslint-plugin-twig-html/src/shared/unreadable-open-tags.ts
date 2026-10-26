import type { DiagnosticCode, TwigDiagnostic } from 'twig-eslint-parser';
import type { ParsedTag } from './tag-node.js';

const codesOfUnreadableTags: ReadonlySet<DiagnosticCode> = new Set(['eof-in-tag', 'unexpected-character-in-attribute-name', 'unexpected-character-in-unquoted-attribute-value']);

export function findUnreadableTagStarts(diagnostics: readonly TwigDiagnostic[]): ReadonlySet<number> {
  return new Set(diagnostics.filter((diagnostic) => codesOfUnreadableTags.has(diagnostic.code)).map((diagnostic) => diagnostic.range[0]));
}

export function isOpenTagUnreadable(tag: Pick<ParsedTag, 'openStart'>, unreadableTagStarts: ReadonlySet<number>): boolean {
  return unreadableTagStarts.has(tag.openStart.range[0]);
}
