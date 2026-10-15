import type { AST, Rule } from 'eslint';
import { readTwigServices, type TwigBlockSummary } from 'twig-eslint-parser';
import { createIgnoredInsideCheck, indentUnitFor, isOpenTagSwallowingMarkup, lineBreakUsedIn, lineIndentation, tagListeners, type Range, type TagNode } from '../tag-layout.js';

type Options = { ifAttrsMoreThan?: number; closeStyle?: 'newline' | 'sameline'; indent?: number; ignoreInside?: string[] };
type Gap = { readonly range: Range; readonly expected: string; readonly isClosing: boolean };

function firstBlockIndexFrom(offset: number, blocks: readonly TwigBlockSummary[], searchFrom = 0): number {
  let low = searchFrom;
  let high = blocks.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((blocks[middle]?.range[0] ?? Infinity) < offset) low = middle + 1;
    else high = middle;
  }
  return low;
}

function groupAttributes(attributes: TagNode['attributes'], blocks: readonly TwigBlockSummary[]): Range[] {
  const groups: Range[] = [];
  let blockIndex = 0;
  let groupStart: number | undefined;
  let depth = 0;
  for (const attribute of attributes) {
    groupStart ??= attribute.range[0];
    blockIndex = firstBlockIndexFrom(attribute.range[0], blocks, blockIndex);
    for (let block = blocks[blockIndex]; block && block.range[1] <= attribute.range[1]; block = blocks[++blockIndex]) depth += block.depthChange;
    if (depth <= 0) {
      groups.push([groupStart, attribute.range[1]]);
      groupStart = undefined;
      depth = 0;
    }
  }
  const last = attributes.at(-1);
  if (groupStart !== undefined && last) groups.push([groupStart, last.range[1]]);
  return groups;
}

function describeGaps(node: TagNode, groups: readonly Range[], text: string, lineBreak: string, options: Required<Options>): Gap[] {
  const tagIndentation = lineIndentation(text, node.openStart.range[0]);
  const indentUnit = indentUnitFor(tagIndentation, options.indent);
  const attributeBreak = `${lineBreak}${tagIndentation}${indentUnit}`;
  const selfClosingSpace = node.openEnd.value === '/>' ? ' ' : '';
  const closingBreak = options.closeStyle === 'newline' ? `${lineBreak}${tagIndentation}` : selfClosingSpace;

  const boundaries = [node.openStart.range[1], ...groups.flatMap(([start, end]) => [start, end]), node.openEnd.range[0]];
  const gaps: Gap[] = [];
  for (let index = 0; index < boundaries.length; index += 2) {
    const isClosing = index === boundaries.length - 2;
    gaps.push({ range: [boundaries[index] as number, boundaries[index + 1] as number], expected: isClosing ? closingBreak : attributeBreak, isClosing });
  }
  return gaps;
}

export const attrsNewline: Rule.RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Put each attribute of a tag with many attributes on its own line, indented one step from the tag',
      url: 'https://github.com/alannapieralski/twig-eslint-parser/blob/main/packages/eslint-plugin-twig-html/docs/rules/attrs-newline.md',
    },
    fixable: 'whitespace',
    schema: [{
      type: 'object',
      properties: {
        ifAttrsMoreThan: { type: 'integer', minimum: 0 },
        closeStyle: { enum: ['newline', 'sameline'] },
        indent: { type: 'integer', minimum: 1 },
        ignoreInside: { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true },
      },
      additionalProperties: false,
    }],
    messages: {
      attributeLine: 'Put each attribute on its own line, indented one step from the tag.',
      closeOnOwnLine: 'Put "{{close}}" on its own line, in line with the tag.',
      closeAfterLastAttribute: 'Put "{{close}}" straight after the last attribute.',
    },
  },

  create(context) {
    const options: Required<Options> = { ifAttrsMoreThan: 1, closeStyle: 'newline', indent: 2, ignoreInside: ['svg'], ...(context.options[0] as Options | undefined) };
    const text = context.sourceCode.text;
    const lineBreak = lineBreakUsedIn(text);
    const { blocks } = readTwigServices(context.sourceCode, context.id);
    const isIgnored = createIgnoredInsideCheck(context.sourceCode, options.ignoreInside);

    const check = (node: TagNode) => {
      if (isIgnored(node)) return;
      const groups = groupAttributes(node.attributes, blocks);
      if (groups.length <= options.ifAttrsMoreThan) return;

      const gaps = describeGaps(node, groups, text, lineBreak, options);
      const wrongGaps = gaps.filter((gap) => text.slice(...gap.range) !== gap.expected);
      const firstWrong = wrongGaps[0];
      if (!firstWrong) return;

      const isFixable = gaps.every((gap) => /^\s*$/.test(text.slice(...gap.range))) && !isOpenTagSwallowingMarkup(node, text);
      const messageId = !firstWrong.isClosing ? 'attributeLine' : options.closeStyle === 'newline' ? 'closeOnOwnLine' : 'closeAfterLastAttribute';
      const reportedEnd = firstWrong.isClosing ? node.openEnd.range[1] : (groups.find(([start]) => start === firstWrong.range[1])?.[1] ?? firstWrong.range[1]);
      const loc: AST.SourceLocation = { start: context.sourceCode.getLocFromIndex(firstWrong.range[1]), end: context.sourceCode.getLocFromIndex(reportedEnd) };

      context.report({
        loc,
        messageId,
        data: { close: node.openEnd.value },
        ...(isFixable && { fix: (fixer) => wrongGaps.map((gap) => fixer.replaceTextRange([...gap.range], gap.expected)) }),
      });
    };

    return tagListeners(check, ['Tag', 'ScriptTag', 'StyleTag']);
  },
};
