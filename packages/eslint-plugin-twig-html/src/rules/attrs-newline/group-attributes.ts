import type { TwigBlockSummary } from 'twig-eslint-parser';
import type { Range } from '../../shared/range.js';
import type { TagNode } from '../../shared/tag-node.js';
import { depthChangeWithin } from '../../shared/twig-blocks.js';

export function groupAttributes(attributes: TagNode['attributes'], blocks: readonly TwigBlockSummary[]): Range[] {
  const groups: Range[] = [];
  let groupStart: number | undefined;
  let depth = 0;

  for (const attribute of attributes) {
    groupStart ??= attribute.range[0];
    depth += depthChangeWithin(attribute.range, blocks);

    if (depth <= 0) {
      groups.push([groupStart, attribute.range[1]]);
      groupStart = undefined;
      depth = 0;
    }
  }

  const lastAttribute = attributes.at(-1);
  if (groupStart !== undefined && lastAttribute) groups.push([groupStart, lastAttribute.range[1]]);

  return groups;
}
