import type { AST, Rule } from 'eslint';

type Range = readonly [number, number];
type Token = { readonly range: Range; readonly value: string };
type TagNode = {
  readonly openStart: Token;
  readonly openEnd: Token;
  readonly attributes: readonly { readonly range: Range }[];
};
type Options = { ifAttrsMoreThan?: number; closeStyle?: 'newline' | 'sameline'; indent?: number };
type Gap = { readonly range: Range; readonly expected: string; readonly isClosing: boolean };

const twigBlockOpeners = new Set(['if', 'for', 'block', 'with', 'apply', 'autoescape', 'spaceless', 'embed', 'macro', 'filter', 'sandbox', 'cache', 'verbatim']);

function twigBlockDepthChange(text: string): number {
  let change = 0;
  for (const [, tagName = ''] of text.matchAll(/\{%[-~]?\s*(\w+)/g)) {
    if (tagName.startsWith('end')) change -= 1;
    else if (twigBlockOpeners.has(tagName)) change += 1;
  }
  return change;
}

function groupAttributes(attributes: TagNode['attributes'], text: string): Range[] {
  const groups: Range[] = [];
  let groupStart: number | undefined;
  let depth = 0;
  for (const attribute of attributes) {
    groupStart ??= attribute.range[0];
    depth += twigBlockDepthChange(text.slice(...attribute.range));
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

function lineIndentation(text: string, offset: number): string {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  return /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? '';
}

function describeGaps(node: TagNode, groups: readonly Range[], text: string, options: Required<Options>): Gap[] {
  const tagIndentation = lineIndentation(text, node.openStart.range[0]);
  const indentUnit = tagIndentation.includes('\t') ? '\t' : ' '.repeat(options.indent);
  const attributeBreak = `\n${tagIndentation}${indentUnit}`;
  const selfClosingSpace = node.openEnd.value === '/>' ? ' ' : '';
  const closingBreak = options.closeStyle === 'newline' ? `\n${tagIndentation}` : selfClosingSpace;

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
      },
      additionalProperties: false,
    }],
    messages: {
      attributeLine: 'Put each attribute on its own line, indented one step from the tag, when a tag has more than {{max}} attributes.',
      closeOnOwnLine: 'Put "{{close}}" on its own line, in line with the tag.',
      closeAfterLastAttribute: 'Put "{{close}}" straight after the last attribute.',
    },
  },

  create(context) {
    const options: Required<Options> = { ifAttrsMoreThan: 2, closeStyle: 'newline', indent: 2, ...(context.options[0] as Options | undefined) };
    const text = context.sourceCode.text;

    const check = (node: TagNode) => {
      const groups = groupAttributes(node.attributes, text);
      if (groups.length <= options.ifAttrsMoreThan) return;

      const gaps = describeGaps(node, groups, text, options);
      const wrongGaps = gaps.filter((gap) => text.slice(...gap.range) !== gap.expected);
      const firstWrong = wrongGaps[0];
      if (!firstWrong) return;

      const isFixable = gaps.every((gap) => /^\s*$/.test(text.slice(...gap.range)));
      const messageId = !firstWrong.isClosing ? 'attributeLine' : options.closeStyle === 'newline' ? 'closeOnOwnLine' : 'closeAfterLastAttribute';
      const reportedEnd = firstWrong.isClosing ? node.openEnd.range[1] : (groups.find(([start]) => start === firstWrong.range[1])?.[1] ?? firstWrong.range[1]);
      const loc: AST.SourceLocation = { start: context.sourceCode.getLocFromIndex(firstWrong.range[1]), end: context.sourceCode.getLocFromIndex(reportedEnd) };

      context.report({
        loc,
        messageId,
        data: { max: String(options.ifAttrsMoreThan), close: node.openEnd.value },
        ...(isFixable && { fix: (fixer) => wrongGaps.map((gap) => fixer.replaceTextRange([...gap.range], gap.expected)) }),
      });
    };

    return { Tag: check, ScriptTag: check, StyleTag: check } as unknown as Rule.RuleListener;
  },
};
