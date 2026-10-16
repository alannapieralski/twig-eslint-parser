import type { TwigBlockSummary } from 'twig-eslint-parser';
import type { TagNode } from './tag-node.js';

export type TagSource = {
  readonly text: string;
  readonly lineBreak: string;
  readonly blocks: readonly TwigBlockSummary[];
  readonly isIgnored: (tag: TagNode) => boolean;
};
