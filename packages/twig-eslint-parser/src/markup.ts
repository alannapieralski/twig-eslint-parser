import { TEMPLATE_ENGINE_SYNTAX, parseForESLint as parseHtmlForESLint, type ParserOptions as HtmlParserOptions } from '@html-eslint/parser';
import { blankPreservingLineBreaks } from './source-text.js';
import type { TwigBlock } from './twig/blocks.js';

export type MarkupParserOptions = HtmlParserOptions;

function blankTwigComments(source: string, blocks: readonly TwigBlock[]): string {
  let blanked = '';
  let copiedUpTo = 0;
  for (const block of blocks) {
    if (block.kind !== 'comment') continue;
    blanked += source.slice(copiedUpTo, block.start) + blankPreservingLineBreaks(source.slice(block.start, block.end));
    copiedUpTo = block.end;
  }
  return blanked + source.slice(copiedUpTo);
}

export function parseMarkup(source: string, blocks: readonly TwigBlock[], options: MarkupParserOptions): ReturnType<typeof parseHtmlForESLint> {
  return parseHtmlForESLint(blankTwigComments(source, blocks), {
    templateEngineSyntax: TEMPLATE_ENGINE_SYNTAX.TWIG,
    ...options,
  });
}
