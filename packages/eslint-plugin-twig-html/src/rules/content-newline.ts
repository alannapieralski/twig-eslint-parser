import type { AST, Rule } from 'eslint';
import { createIgnoredInsideCheck, indentUnitFor, isOpenTagSwallowingMarkup, lineBreakUsedIn, lineIndentation, tagListeners, type Range, type TagNode } from '../tag-layout.js';

const whitespaceSensitiveTags: ReadonlySet<string> = new Set(['pre', 'textarea']);

type Options = { indent?: number; ignoreInside?: string[] };
type ContentGap = { readonly range: Range; readonly expected: string; readonly messageId: 'contentOnOwnLine' | 'closeOnOwnLine'; readonly anchor: Range };

function describeContentGaps(node: TagNode, close: NonNullable<TagNode['close']>, text: string, indent: number): ContentGap[] {
  const contentStart = node.openEnd.range[1];
  const contentEnd = close.range[0];
  const content = text.slice(contentStart, contentEnd);
  const trimmedStart = content.length - content.trimStart().length;
  if (trimmedStart === content.length) return [];

  const lineBreak = lineBreakUsedIn(text);
  const tagIndentation = lineIndentation(text, node.openStart.range[0]);
  const contentBreak = `${lineBreak}${tagIndentation}${indentUnitFor(tagIndentation, indent)}`;
  const closeBreak = `${lineBreak}${tagIndentation}`;
  const trimmedEnd = content.trimEnd().length;
  return [
    { range: [contentStart, contentStart + trimmedStart], expected: contentBreak, messageId: 'contentOnOwnLine', anchor: node.openEnd.range },
    { range: [contentStart + trimmedEnd, contentEnd], expected: closeBreak, messageId: 'closeOnOwnLine', anchor: close.range },
  ];
}

export const contentNewline: Rule.RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Put the content of a tag whose opening tag spans several lines on its own lines',
      url: 'https://github.com/alannapieralski/twig-eslint-parser/blob/main/packages/eslint-plugin-twig-html/docs/rules/content-newline.md',
    },
    fixable: 'whitespace',
    schema: [{
      type: 'object',
      properties: {
        indent: { type: 'integer', minimum: 1 },
        ignoreInside: { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true },
      },
      additionalProperties: false,
    }],
    messages: {
      contentOnOwnLine: 'Put the content on its own line, below the opening tag.',
      closeOnOwnLine: 'Put the closing tag on its own line, below the content.',
    },
  },

  create(context) {
    const options: Required<Options> = { indent: 2, ignoreInside: ['svg'], ...(context.options[0] as Options | undefined) };
    const { sourceCode } = context;
    const text = sourceCode.text;
    const isIgnored = createIgnoredInsideCheck(sourceCode, options.ignoreInside);
    const locate = ([start, end]: Range): AST.SourceLocation => ({ start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(end) });

    const check = (node: TagNode) => {
      const { close } = node;
      if (!close) return;
      if (whitespaceSensitiveTags.has(String(node.name ?? '').toLowerCase())) return;
      if (!text.slice(node.openStart.range[0], node.openEnd.range[1]).includes('\n')) return;
      if (isOpenTagSwallowingMarkup(node, text) || isIgnored(node)) return;

      for (const gap of describeContentGaps(node, close, text, options.indent)) {
        if (text.slice(...gap.range).includes('\n')) continue;
        context.report({
          loc: locate(gap.anchor),
          messageId: gap.messageId,
          fix: (fixer) => fixer.replaceTextRange([...gap.range], gap.expected),
        });
      }
    };

    return tagListeners(check, ['Tag']);
  },
};
