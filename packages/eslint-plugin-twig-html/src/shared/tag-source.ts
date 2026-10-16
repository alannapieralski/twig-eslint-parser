import type { SourceCode } from 'eslint';
import type { TwigBlockSummary } from 'twig-eslint-parser';
import { createIgnoredInsideCheck } from './ignored-inside.js';
import { lineBreakUsedIn } from './line-ending.js';
import type { TagNode } from './tag-node.js';

export type TagSource = {
  readonly text: string;
  readonly lineBreak: string;
  readonly blocks: readonly TwigBlockSummary[];
  readonly isIgnored: (tag: TagNode) => boolean;
};

export function createTagSource(sourceCode: SourceCode, blocks: readonly TwigBlockSummary[], ignoreInside: readonly string[]): TagSource {
  const { text } = sourceCode;

  return {
    text,
    lineBreak: lineBreakUsedIn(text),
    blocks,
    isIgnored: createIgnoredInsideCheck(sourceCode, ignoreInside),
  };
}
