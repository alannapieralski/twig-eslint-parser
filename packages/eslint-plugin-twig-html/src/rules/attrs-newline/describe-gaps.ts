import type { Range } from '../../shared/range.js';
import type { TagNode } from '../../shared/tag-node.js';
import type { CloseStyle } from './options.js';
import type { Gap } from './types.js';

export function describeGaps(tag: TagNode, groups: readonly Range[], lineBreak: string, closeStyle: CloseStyle): Gap[] {
  const selfClosingSpace = tag.openEnd.value === '/>' ? ' ' : '';
  const isClosingOnOwnLine = closeStyle === 'newline';

  const boundaries = [tag.openStart.range[1], ...groups.flatMap(([start, end]) => [start, end]), tag.openEnd.range[0]];
  const gaps: Gap[] = [];

  for (let index = 0; index < boundaries.length; index += 2) {
    const isClosing = index === boundaries.length - 2;
    const isLineBreak = !isClosing || isClosingOnOwnLine;
    const range: Range = [boundaries[index] as number, boundaries[index + 1] as number];
    gaps.push({ range, expected: isLineBreak ? lineBreak : selfClosingSpace, isClosing, isLineBreak });
  }

  return gaps;
}
