import { createOffsetLocator } from '../source-text.js';
import { summariseTwigBlocks, type TwigBlock } from '../twig/blocks.js';
import { annotateBranches } from './branches.js';
import { parseHtmlProgram, visitorKeys, type HtmlProgram } from './program.js';
import { HtmlSyntaxError } from './syntax-error.js';
import { templateInfosOf } from './template-infos.js';
import { maskVerbatimDelimiters, restoreVerbatimDelimiters } from './verbatim-text.js';

type HtmlParseResult = { readonly ast: HtmlProgram; readonly visitorKeys: typeof visitorKeys };

const rawTextElements: readonly string[] = ['textarea', 'title'];

function isPositionedSyntaxError(error: unknown): error is SyntaxError & { pos: number } {
  return error instanceof SyntaxError && typeof (error as { pos?: unknown }).pos === 'number';
}

export function parseMarkup(source: string, blocks: readonly TwigBlock[], rawContentTags: ReadonlySet<string>): HtmlParseResult {
  const verbatim = maskVerbatimDelimiters(source, blocks);
  const parseOptions = {
    templateInfos: templateInfosOf(source, blocks),
    rawContentTags: [...new Set([...rawTextElements, ...rawContentTags])],
  };
  let result: HtmlParseResult;
  try {
    result = { ast: parseHtmlProgram(verbatim.text, parseOptions, annotateBranches(summariseTwigBlocks(blocks))), visitorKeys };
  } catch (error) {
    if (!isPositionedSyntaxError(error)) throw error;
    const position = createOffsetLocator(source)(error.pos);
    throw new HtmlSyntaxError(error.message.replace(/ \(\d+:\d+\)$/, ''), position.line, position.column + 1);
  }
  if (verbatim.maskedRanges.length > 0) restoreVerbatimDelimiters(result.ast, source, verbatim.maskedRanges);
  return result;
}
