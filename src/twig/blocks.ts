import type { TwigToken, TwigTokenType } from './tokens.js';

export type TwigBlockKind = 'print' | 'tag' | 'comment';

export type TwigBlock = {
  readonly kind: TwigBlockKind;
  readonly start: number;
  readonly end: number;
  readonly tokens: readonly TwigToken[];
  readonly tagName: string | undefined;
};

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
