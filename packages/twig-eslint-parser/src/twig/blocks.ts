import type { TwigToken, TwigTokenType } from './tokens.js';

export type TwigBlockKind = 'print' | 'tag' | 'comment';

export type TwigBlock = {
  readonly kind: TwigBlockKind;
  readonly start: number;
  readonly end: number;
  readonly tokens: readonly TwigToken[];
  readonly tagName: string | undefined;
};

export type TwigBlockSummary = {
  readonly kind: TwigBlockKind;
  readonly tagName: string | undefined;
  readonly range: readonly [number, number];
  readonly depthChange: -1 | 0 | 1;
};

const tagDelimiterTypes: ReadonlySet<TwigTokenType> = new Set(['TAG_START', 'TAG_END', 'WHITESPACE', 'TRIMMING_MODIFIER', 'LINE_TRIMMING_MODIFIER']);

function isShortBlock(block: TwigBlock): boolean {
  const contentTokens = block.tokens.filter((token) => !tagDelimiterTypes.has(token.type));
  return block.tagName === 'block' && contentTokens.length > 2;
}

function opensNesting(block: TwigBlock, closedTagNames: ReadonlySet<string>): boolean {
  if (block.tagName === undefined || !closedTagNames.has(block.tagName)) return false;
  const isInlineSet = block.tagName === 'set' && block.tokens.some((token) => token.type === 'OPERATOR' && token.value === '=');
  return !isInlineSet && !isShortBlock(block);
}

function nestingDepthChange(block: TwigBlock, closedTagNames: ReadonlySet<string>): TwigBlockSummary['depthChange'] {
  if (block.tagName?.startsWith('end')) return -1;
  return opensNesting(block, closedTagNames) ? 1 : 0;
}

export function summariseTwigBlocks(blocks: readonly TwigBlock[]): TwigBlockSummary[] {
  const closedTagNames = new Set(blocks.flatMap((block) => (block.tagName?.startsWith('end') ? [block.tagName.slice('end'.length)] : [])));
  return blocks.map((block) => ({ kind: block.kind, tagName: block.tagName, range: [block.start, block.end], depthChange: nestingDepthChange(block, closedTagNames) }));
}

const blockKindByOpeningType: Partial<Record<TwigTokenType, { kind: TwigBlockKind; closingType: TwigTokenType }>> = {
  VARIABLE_START: { kind: 'print', closingType: 'VARIABLE_END' },
  TAG_START: { kind: 'tag', closingType: 'TAG_END' },
  COMMENT_START: { kind: 'comment', closingType: 'COMMENT_END' },
};

function createBlock(kind: TwigBlockKind, tokens: TwigToken[]): TwigBlock {
  const first = tokens[0];
  const last = tokens.at(-1);
  if (!first || !last) throw new Error('A Twig block needs at least its opening and closing delimiters.');

  const tagName = kind === 'tag' ? tokens.find((token) => token.type === 'NAME')?.value : undefined;
  return { kind, start: first.start, end: last.end, tokens, tagName };
}

export function groupTwigBlocks(tokens: readonly TwigToken[]): TwigBlock[] {
  const blocks: TwigBlock[] = [];
  let index = 0;

  while (index < tokens.length) {
    const opening = tokens[index];
    const blockKind = opening && blockKindByOpeningType[opening.type];
    if (!blockKind) {
      index += 1;
      continue;
    }

    const closingIndex = tokens.findIndex((token, candidateIndex) => candidateIndex > index && token.type === blockKind.closingType);
    if (closingIndex === -1) throw new Error(`Twig ${blockKind.kind} block opened at offset ${opening.start} has no closing delimiter.`);

    blocks.push(createBlock(blockKind.kind, tokens.slice(index, closingIndex + 1)));
    index = closingIndex + 1;
  }

  return blocks;
}
