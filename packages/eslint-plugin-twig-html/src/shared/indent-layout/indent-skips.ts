import { containsOffset } from '../range.js';
import type { TagNode } from '../tag-node.js';
import { findIndentLayout, type IndentLayoutSource } from './find-indent-layout.js';
import type { IndentLayout, MarkupNode } from './types.js';

export type IndentSkipChecks = {
  readonly isOpenTagSkipped: (tag: TagNode) => boolean;
  readonly isContentSkipped: (tag: TagNode) => boolean;
};

export function isSkipped(offset: number, layout: IndentLayout): boolean {
  return layout.skipped.some((range) => containsOffset(range, offset));
}

function isAnySkipped(offsets: readonly (number | undefined)[], layout: IndentLayout | undefined): boolean {
  if (!layout) return true;

  return offsets.some((offset) => offset !== undefined && isSkipped(offset, layout));
}

export function createIndentSkipChecks(document: MarkupNode | undefined, source: IndentLayoutSource): IndentSkipChecks {
  let layout: IndentLayout | undefined;
  let isLayoutFound = false;

  const findLayoutOnce = (): IndentLayout | undefined => {
    if (!isLayoutFound) {
      layout = document && findIndentLayout(document, source);
      isLayoutFound = true;
    }
    return layout;
  };

  return {
    isOpenTagSkipped: (tag) => isAnySkipped([tag.openStart.range[0]], findLayoutOnce()),
    isContentSkipped: (tag) => isAnySkipped([tag.openStart.range[0], tag.openEnd.range[1], tag.close?.range[0]], findLayoutOnce()),
  };
}
