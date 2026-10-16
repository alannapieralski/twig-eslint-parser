import { isOpenTagSwallowingMarkup } from '../../shared/swallowed-markup.js';
import type { Problem } from '../../shared/problem.js';
import type { Range } from '../../shared/range.js';
import type { TagNode } from '../../shared/tag-node.js';
import { describeGaps } from './describe-gaps.js';
import { groupAttributes } from './group-attributes.js';
import type { CloseStyle, Options } from './options.js';
import type { TagSource } from '../../shared/tag-source.js';
import type { Gap } from './types.js';

const whitespaceOnly = /^\s*$/;

function messageIdForGap(gap: Gap, closeStyle: CloseStyle): string {
  if (!gap.isClosing) return 'attributeLine';
  return closeStyle === 'newline' ? 'closeOnOwnLine' : 'closeAfterLastAttribute';
}

function findReportedEnd(gap: Gap, tag: TagNode, groups: readonly Range[]): number {
  if (gap.isClosing) return tag.openEnd.range[1];

  const groupAfterGap = groups.find(([start]) => start === gap.range[1]);
  return groupAfterGap?.[1] ?? gap.range[1];
}

export function findAttributeProblems(tag: TagNode, source: TagSource, options: Required<Options>): Problem[] {
  const { text, lineBreak, blocks, isIgnored } = source;
  const groups = groupAttributes(tag.attributes, blocks);
  if (groups.length <= options.ifAttrsMoreThan || isIgnored(tag)) return [];

  const gaps = describeGaps(tag, groups, text, lineBreak, options);
  const wrongGaps = gaps.filter((gap) => text.slice(...gap.range) !== gap.expected);
  const firstWrongGap = wrongGaps[0];
  if (!firstWrongGap) return [];

  const areAllGapsWhitespace = gaps.every((gap) => whitespaceOnly.test(text.slice(...gap.range)));
  const isFixable = areAllGapsWhitespace && !isOpenTagSwallowingMarkup(tag, text);

  return [{
    range: [firstWrongGap.range[1], findReportedEnd(firstWrongGap, tag, groups)],
    messageId: messageIdForGap(firstWrongGap, options.closeStyle),
    data: { close: tag.openEnd.value },
    ...(isFixable && { edits: wrongGaps.map((gap) => ({ range: gap.range, text: gap.expected })) }),
  }];
}
