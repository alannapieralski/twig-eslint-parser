import type { Linter } from 'eslint';
import { unionWith } from 'eslint-visitor-keys';
import { omitInterpolatedAttributes, type OmittedAttribute } from './attributes.js';
import { parseJavaScriptAt, type EstreeNode } from './estree.js';
import { parseMarkup, type MarkupParserOptions } from './markup.js';
import { parseTwigParserOptions } from './options.js';
import { createOffsetLocator, type SourcePosition } from './source-text.js';
import { groupTwigBlocks, type TwigBlock, type TwigBlockKind } from './twig/blocks.js';
import { toSameLengthJavaScript } from './twig/javascript.js';
import { tokenizeTwig } from './twig/tokens.js';

export type ParserOptions = MarkupParserOptions & { ignoreInterpolatedAttributes?: readonly string[] } & Record<string, unknown>;

export type UnconvertedTwigBlock = {
  readonly kind: TwigBlockKind;
  readonly tagName: string | undefined;
  readonly range: readonly [number, number];
  readonly reason: string;
};

export type TwigParserServices = {
  readonly convertedBlockCount: number;
  readonly ignoredBlockCount: number;
  readonly unconvertedBlocks: readonly UnconvertedTwigBlock[];
  readonly omittedAttributes: readonly OmittedAttribute[];
};

export type TwigParseResult = Omit<Linter.ESLintParseResult, 'ast' | 'services'> & {
  readonly ast: Linter.ESLintParseResult['ast'] & { readonly twigBody: readonly EstreeNode[] };
  readonly services: Record<string, unknown> & { readonly twig: TwigParserServices };
};

type TwigExpressions = Omit<TwigParserServices, 'omittedAttributes'> & { readonly statements: EstreeNode[] };

function convertTwigBlocks(blocks: readonly TwigBlock[], locate: (offset: number) => SourcePosition): TwigExpressions {
  const statements: EstreeNode[] = [];
  const unconvertedBlocks: UnconvertedTwigBlock[] = [];
  let convertedBlockCount = 0;
  let ignoredBlockCount = 0;

  for (const block of blocks) {
    const javascript = toSameLengthJavaScript(block);
    if (javascript === undefined) {
      ignoredBlockCount += 1;
      continue;
    }

    const parsed = parseJavaScriptAt(javascript, block.start, locate);
    if (!parsed.isParsed) {
      unconvertedBlocks.push({ kind: block.kind, tagName: block.tagName, range: [block.start, block.end], reason: parsed.reason });
      continue;
    }

    convertedBlockCount += 1;
    statements.push(...parsed.statements);
  }

  return { statements, convertedBlockCount, ignoredBlockCount, unconvertedBlocks };
}

export function parseForESLint(code: string, options: ParserOptions = {}): TwigParseResult {
  const { ignoreInterpolatedAttributes } = parseTwigParserOptions(options);
  const blocks = groupTwigBlocks(tokenizeTwig(code));
  const markup = parseMarkup(code, blocks, options);
  const omittedAttributes = omitInterpolatedAttributes(markup.ast, ignoreInterpolatedAttributes);
  const { statements, ...twigServices } = convertTwigBlocks(blocks, createOffsetLocator(code));
  const visitorKeys = unionWith(markup.visitorKeys ?? {});

  return {
    ...markup,
    ast: { ...markup.ast, twigBody: statements },
    visitorKeys: { ...visitorKeys, Program: [...(visitorKeys['Program'] ?? []), 'twigBody'] },
    services: { ...markup.services, twig: { ...twigServices, omittedAttributes } },
  };
}
