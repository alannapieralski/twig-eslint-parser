import type { SourceCode } from 'eslint';
import type { TwigBlockSummary } from 'twig-eslint-parser';
import { createIndentSkipChecks } from './indent-layout/indent-skips.js';
import type { MarkupNode } from './indent-layout/types.js';
import { createIgnoredInsideCheck } from './ignored-inside.js';
import { lineBreakUsedIn } from './line-ending.js';
import type { TagNode } from './tag-node.js';

export type TagSource = {
  readonly text: string;
  readonly lineBreak: string;
  readonly blocks: readonly TwigBlockSummary[];
  readonly isIgnored: (tag: TagNode) => boolean;
  readonly isOpenTagSkippedByIndent: (tag: TagNode) => boolean;
  readonly isContentSkippedByIndent: (tag: TagNode) => boolean;
};

export function createTagSource(sourceCode: SourceCode, blocks: readonly TwigBlockSummary[], ignoreInside: readonly string[]): TagSource {
  const { text } = sourceCode;
  const document = sourceCode.ast.body[0] as unknown as MarkupNode | undefined;
  const indentSkips = createIndentSkipChecks(document, { text, blocks, ignores: [] });

  return {
    text,
    lineBreak: lineBreakUsedIn(text),
    blocks,
    isIgnored: createIgnoredInsideCheck(sourceCode, ignoreInside),
    isOpenTagSkippedByIndent: indentSkips.isOpenTagSkipped,
    isContentSkippedByIndent: indentSkips.isContentSkipped,
  };
}
