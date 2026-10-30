import { MIDDLE_TAGS } from './syntax.js';
import type { TwigBlockSummary } from './blocks.js';

export function isOpeningTag(block: TwigBlockSummary): boolean {
  return block.kind === 'tag' && block.depthChange === 1;
}

export function isClosingTag(block: TwigBlockSummary): boolean {
  return block.kind === 'tag' && block.depthChange === -1;
}

export function isMiddleTag(block: TwigBlockSummary): boolean {
  return block.kind === 'tag' && MIDDLE_TAGS.has(block.tagName ?? '');
}
