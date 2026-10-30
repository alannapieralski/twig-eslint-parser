import type { TwigBlockSummary } from '../../twig/blocks.js';
import type { MarkupTreeNode, SourceToken } from './markup-elements.js';

export type MarkupSource = {
  readonly document: MarkupTreeNode;
  readonly tokens: readonly SourceToken[];
  readonly text: string;
  readonly blocks: readonly TwigBlockSummary[];
};
