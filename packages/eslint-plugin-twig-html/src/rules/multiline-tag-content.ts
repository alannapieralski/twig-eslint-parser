import type { AST, Rule } from 'eslint';
import { countLeadingHtmlWhitespace, countTrailingHtmlWhitespace, createIgnoredInsideCheck, hasSignificantContentWhitespace, indentUnitFor, isOpenTagSwallowingMarkup, lineBreakUsedIn, lineIndentation, tagListeners, type Range, type TagNode } from '../tag-layout.js';

type Options = { indent?: number; ignoreInside?: string[] };
type ContentEdge = { readonly range: Range; readonly messageId: 'contentOnOwnLine' | 'closeOnOwnLine'; readonly anchor: Range; readonly isOpeningSide: boolean };

function findCrowdedContentEdges(node: TagNode, close: NonNullable<TagNode['close']>, text: string): ContentEdge[] {
  const contentStart = node.openEnd.range[1];
  const contentEnd = close.range[0];
  const content = text.slice(contentStart, contentEnd);
  const leading = countLeadingHtmlWhitespace(content);
  if (leading === content.length) return [];

  const edges: ContentEdge[] = [
    { range: [contentStart, contentStart + leading], messageId: 'contentOnOwnLine', anchor: node.openEnd.range, isOpeningSide: true },
    { range: [contentEnd - countTrailingHtmlWhitespace(content), contentEnd], messageId: 'closeOnOwnLine', anchor: close.range, isOpeningSide: false },
  ];
  return edges.filter((edge) => !text.slice(...edge.range).includes('\n'));
}

export const multilineTagContent: Rule.RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Put the content of a tag whose opening tag spans several lines on its own lines',
      url: 'https://github.com/alannapieralski/twig-eslint-parser/blob/main/packages/eslint-plugin-twig-html/docs/rules/multiline-tag-content.md',
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
    const lineBreak = lineBreakUsedIn(text);
    const isIgnored = createIgnoredInsideCheck(sourceCode, options.ignoreInside);
    const locate = ([start, end]: Range): AST.SourceLocation => ({ start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(end) });

    const check = (node: TagNode) => {
      const { close } = node;
      if (!close) return;
      if (hasSignificantContentWhitespace(node)) return;
      if (!text.slice(node.openStart.range[0], node.openEnd.range[1]).includes('\n')) return;
      if (isOpenTagSwallowingMarkup(node, text) || isIgnored(node)) return;

      const edges = findCrowdedContentEdges(node, close, text);
      if (edges.length === 0) return;

      const tagIndentation = lineIndentation(text, node.openStart.range[0]);
      const contentBreak = `${lineBreak}${tagIndentation}${indentUnitFor(tagIndentation, options.indent)}`;
      const closeBreak = `${lineBreak}${tagIndentation}`;
      for (const edge of edges) {
        context.report({
          loc: locate(edge.anchor),
          messageId: edge.messageId,
          fix: (fixer) => fixer.replaceTextRange([...edge.range], edge.isOpeningSide ? contentBreak : closeBreak),
        });
      }
    };

    return tagListeners(check, ['Tag']);
  },
};
