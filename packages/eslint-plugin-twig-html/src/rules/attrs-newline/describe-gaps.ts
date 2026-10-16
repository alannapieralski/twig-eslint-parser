import { indentUnitFor, lineIndentation } from '../../shared/indentation.js';
import type { Range } from '../../shared/range.js';
import type { TagNode } from '../../shared/tag-node.js';
import type { Options } from './options.js';
import type { Gap } from './types.js';

export function describeGaps(tag: TagNode, groups: readonly Range[], text: string, lineBreak: string, options: Required<Options>): Gap[] {
  const tagIndentation = lineIndentation(text, tag.openStart.range[0]);
  const indentUnit = indentUnitFor(text, tagIndentation, options.indent);
  const attributeBreak = `${lineBreak}${tagIndentation}${indentUnit}`;
  const selfClosingSpace = tag.openEnd.value === '/>' ? ' ' : '';
  const closingBreak = options.closeStyle === 'newline' ? `${lineBreak}${tagIndentation}` : selfClosingSpace;

  const boundaries = [tag.openStart.range[1], ...groups.flatMap(([start, end]) => [start, end]), tag.openEnd.range[0]];
  const gaps: Gap[] = [];

  for (let index = 0; index < boundaries.length; index += 2) {
    const isClosing = index === boundaries.length - 2;
    const range: Range = [boundaries[index] as number, boundaries[index + 1] as number];
    gaps.push({ range, expected: isClosing ? closingBreak : attributeBreak, isClosing });
  }

  return gaps;
}
