import type { AST, Rule } from 'eslint';
import { countLeadingHtmlWhitespace, countTrailingHtmlWhitespace, createIgnoredInsideCheck, indentUnitFor, isOpenTagSwallowingMarkup, layoutOptionDefaults, layoutOptionProperties, lineBreakUsedIn, lineIndentation, tagListeners, type Range, type TagNode } from '../tag-layout.js';

type Options = { indent?: number; ignores?: string[]; ignoreWhenEmpty?: boolean; allowEmptyLines?: boolean };
type MessageId = 'unexpectedAfterClosingBracket' | 'unexpectedBeforeOpeningBracket';
type ContentEdge = { readonly range: Range; readonly messageId: MessageId; readonly indentationWhenMissing: string };

const vueInlineNonVoidElements = [
  'a', 'abbr', 'audio', 'b', 'bdi', 'bdo', 'canvas', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'i', 'iframe', 'ins', 'kbd', 'label', 'map',
  'mark', 'noscript', 'object', 'output', 'picture', 'q', 'ruby', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'svg', 'time', 'u',
  'var', 'video',
];

const defaultOptions: Required<Options> = {
  indent: layoutOptionDefaults.indent,
  ignores: ['pre', 'textarea', ...vueInlineNonVoidElements],
  ignoreWhenEmpty: true,
  allowEmptyLines: false,
};

const plainElementName = /^[a-z][a-z0-9-]*$/i;

function countLineBreaks(text: string): number {
  return text.split('\n').length - 1;
}

function indentationAfterLastLineBreak(text: string): string {
  return text.slice(text.lastIndexOf('\n') + 1);
}

export const multilineHtmlElementContentNewline: Rule.RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Require a line break before and after the content of a multi-line element',
      url: 'https://github.com/alannapieralski/twig-eslint-parser/blob/main/packages/eslint-plugin-twig-html/docs/rules/multiline-html-element-content-newline.md',
    },
    fixable: 'whitespace',
    schema: [{
      type: 'object',
      properties: {
        indent: layoutOptionProperties.indent,
        ignores: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        ignoreWhenEmpty: { type: 'boolean' },
        allowEmptyLines: { type: 'boolean' },
      },
      additionalProperties: false,
    }],
    messages: {
      unexpectedAfterClosingBracket: 'Expected 1 line break after opening tag (`<{{name}}>`), but {{actual}} line breaks found.',
      unexpectedBeforeOpeningBracket: 'Expected 1 line break before closing tag (`</{{name}}>`), but {{actual}} line breaks found.',
    },
  },

  create(context) {
    const options: Required<Options> = { ...defaultOptions, ...(context.options[0] as Options | undefined) };
    const { sourceCode } = context;
    const text = sourceCode.text;
    const lineBreak = lineBreakUsedIn(text);
    const isIgnored = createIgnoredInsideCheck(sourceCode, options.ignores);
    const isInvalidLineBreakCount = (lineBreaks: number) => options.allowEmptyLines ? lineBreaks === 0 : lineBreaks !== 1;
    const locate = ([start, end]: Range): AST.SourceLocation => ({ start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(end) });

    const findContentEdges = (node: TagNode, close: NonNullable<TagNode['close']>): ContentEdge[] => {
      const contentStart = node.openEnd.range[1];
      const contentEnd = close.range[0];
      const content = text.slice(contentStart, contentEnd);
      const tagIndentation = lineIndentation(text, node.openStart.range[0]);
      const leading = countLeadingHtmlWhitespace(content);

      if (leading === content.length) {
        return [{ range: [contentStart, contentEnd], messageId: 'unexpectedAfterClosingBracket', indentationWhenMissing: tagIndentation }];
      }
      const contentIndentation = tagIndentation + indentUnitFor(text, tagIndentation, options.indent);
      return [
        { range: [contentStart, contentStart + leading], messageId: 'unexpectedAfterClosingBracket', indentationWhenMissing: contentIndentation },
        { range: [contentEnd - countTrailingHtmlWhitespace(content), contentEnd], messageId: 'unexpectedBeforeOpeningBracket', indentationWhenMissing: tagIndentation },
      ];
    };

    const check = (node: TagNode) => {
      const { close } = node;
      if (!close) return;
      if (!plainElementName.test(node.name ?? '') || isIgnored(node)) return;
      if (!text.slice(node.openStart.range[0], close.range[0]).includes('\n')) return;
      if (isOpenTagSwallowingMarkup(node, text)) return;
      if (options.ignoreWhenEmpty && node.openEnd.range[1] === close.range[0]) return;

      for (const edge of findContentEdges(node, close)) {
        const whitespace = text.slice(...edge.range);
        const lineBreaks = countLineBreaks(whitespace);
        if (!isInvalidLineBreakCount(lineBreaks)) continue;

        const indentation = lineBreaks === 0 ? edge.indentationWhenMissing : indentationAfterLastLineBreak(whitespace);
        context.report({
          loc: locate(edge.range),
          messageId: edge.messageId,
          data: { name: node.name ?? '', actual: lineBreaks === 0 ? 'no' : String(lineBreaks) },
          fix: (fixer) => fixer.replaceTextRange([...edge.range], `${lineBreak}${indentation}`),
        });
      }
    };

    return tagListeners(check, ['Tag']);
  },
};
