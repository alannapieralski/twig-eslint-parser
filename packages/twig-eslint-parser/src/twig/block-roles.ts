import type { TwigBlockSummary } from './blocks.js';
import { middleTags } from './syntax.js';

export function isOpeningTag(block: TwigBlockSummary): boolean {
  return block.kind === 'tag' && block.depthChange === 1;
}

export function isClosingTag(block: TwigBlockSummary): boolean {
  return block.kind === 'tag' && block.depthChange === -1;
}

export function isMiddleTag(block: TwigBlockSummary): boolean {
  return block.kind === 'tag' && middleTags.has(block.tagName ?? '');
}
