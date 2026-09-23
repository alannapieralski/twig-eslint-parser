import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Lexer } from '../../src/lexer/Lexer.js';
import type { Token } from '../../src/lexer/Token.js';
import type { TokenType } from '../../src/lexer/TokenType.js';

type GoldenToken = { type: string; value: unknown; line: number; offset: number };
type Golden = { twig: string; tokens: GoldenToken[] };
type PositionedToken = { type: TokenType; value: string; start: number; end: number };

const fixturesDirectory = new URL('../fixtures/twig/', import.meta.url);

const acceptedTypesByTwigType: Record<string, TokenType[]> = {
  'text': ['TEXT'],
  'begin of print statement': ['VARIABLE_START'],
  'end of print statement': ['VARIABLE_END'],
  'begin of statement block': ['TAG_START'],
  'end of statement block': ['TAG_END'],
  'name': ['NAME'],
  'number': ['NUMBER'],
  'string': ['OPENING_QUOTE', 'STRING'],
  'operator': ['OPERATOR', 'TEST_OPERATOR', 'PUNCTUATION', 'ARROW', 'SPREAD_OPERATOR'],
  'punctuation': ['PUNCTUATION'],
  'begin of string interpolation': ['INTERPOLATION_START'],
  'end of string interpolation': ['INTERPOLATION_END'],
  'end of template': ['EOF'],
};

const typesThatMustAlignWithTwig = new Set<TokenType>([
  'NAME', 'NUMBER', 'OPERATOR', 'TEST_OPERATOR', 'PUNCTUATION', 'ARROW', 'SPREAD_OPERATOR',
  'VARIABLE_START', 'VARIABLE_END', 'TAG_START', 'TAG_END', 'INTERPOLATION_START', 'INTERPOLATION_END', 'OPENING_QUOTE',
]);

function utf16IndexByByteOffset(source: string): Map<number, number> {
  const indexByByteOffset = new Map<number, number>();
  let byteOffset = 0;
  let utf16Index = 0;
  for (const character of source) {
    indexByByteOffset.set(byteOffset, utf16Index);
    byteOffset += Buffer.byteLength(character);
    utf16Index += character.length;
  }
  indexByByteOffset.set(byteOffset, utf16Index);
  return indexByByteOffset;
}

function positionTokens(tokens: Token[]): PositionedToken[] {
  let start = 0;
  return tokens.map((token) => {
    const value = token.value === null || token.value === undefined ? '' : String(token.value);
    const positioned = { type: token.type, value, start, end: start + value.length };
    start = positioned.end;
    return positioned;
  });
}

const tagsConsumedByTwigLexer = new Set(['verbatim', 'endverbatim', 'line']);
const trimmingModifierTypes = new Set<TokenType>(['TRIMMING_MODIFIER', 'LINE_TRIMMING_MODIFIER']);
const endDelimiterTypeByTwigType: Record<string, TokenType> = {
  'end of print statement': 'VARIABLE_END',
  'end of statement block': 'TAG_END',
};

function findStartsOfTagsConsumedByTwigLexer(ours: PositionedToken[]): Set<number> {
  const consumedStarts = new Set<number>();
  ours.forEach((token, index) => {
    if (token.type !== 'TAG_START') return;

    const tagEndIndex = ours.findIndex((candidate, candidateIndex) => candidateIndex > index && candidate.type === 'TAG_END');
    const tagTokens = ours.slice(index, tagEndIndex + 1);
    const tagName = tagTokens.find((candidate) => candidate.type === 'NAME')?.value;
    if (tagName && tagsConsumedByTwigLexer.has(tagName)) tagTokens.forEach((candidate) => consumedStarts.add(candidate.start));
  });
  return consumedStarts;
}

function findStartsOfQuotesTwigLexesAsStringParts(ours: PositionedToken[], source: string): Set<number> {
  const quoteStarts = new Set<number>();
  ours.forEach((token, index) => {
    if (token.type !== 'OPENING_QUOTE' || token.value !== '"') return;

    const closingQuote = ours.find((candidate, candidateIndex) => candidateIndex > index && candidate.type === 'CLOSING_QUOTE');
    const content = source.slice(token.end, closingQuote?.start ?? source.length);
    if (content.includes('#')) quoteStarts.add(token.start);
  });
  return quoteStarts;
}

function findEndDelimiterAfterTrimmingModifier(ours: PositionedToken[], modifier: PositionedToken, twigType: string): PositionedToken | undefined {
  const expectedEndType = endDelimiterTypeByTwigType[twigType];
  if (!expectedEndType || !trimmingModifierTypes.has(modifier.type)) return undefined;

  const next = ours[ours.indexOf(modifier) + 1];
  return next?.type === expectedEndType ? next : undefined;
}

function describeMismatch(twigToken: GoldenToken, reason: string): string {
  return `${reason}: Twig ${twigToken.type} ${JSON.stringify(twigToken.value)} at line ${twigToken.line}, offset ${twigToken.offset}`;
}

function valuesAgree(twigToken: GoldenToken, ours: PositionedToken): boolean {
  switch (twigToken.type) {
    case 'name':
    case 'punctuation':
      return ours.value === twigToken.value;
    case 'operator':
      return ours.value.replace(/\s+/g, ' ') === twigToken.value;
    case 'number':
      return Number(ours.value.replaceAll('_', '')) === twigToken.value;
    default:
      return true;
  }
}

function findParityMismatches(source: string, golden: Golden): string[] {
  const ours = positionTokens(new Lexer(3).tokenize(source));
  const toUtf16 = utf16IndexByByteOffset(source);
  const oursByStart = new Map(ours.filter((token) => token.value !== '' || token.type === 'EOF').map((token) => [token.start, token]));
  const mismatches: string[] = [];
  const twigStarts = new Set<number>();

  for (const twigToken of golden.tokens) {
    const start = toUtf16.get(twigToken.offset);
    if (start === undefined) throw new Error(`Golden offset ${twigToken.offset} is not a character boundary.`);
    twigStarts.add(start);

    const acceptedTypes = acceptedTypesByTwigType[twigToken.type];
    if (!acceptedTypes) throw new Error(`No type mapping for Twig token type "${twigToken.type}".`);

    const match = twigToken.type === 'text'
      ? ours.find((token) => token.type === 'TEXT' && token.start <= start && start < Math.max(token.end, token.start + 1))
      : oursByStart.get(start);

    if (!match) {
      mismatches.push(describeMismatch(twigToken, 'no token of ours starts here'));
      continue;
    }
    const endAfterModifier = findEndDelimiterAfterTrimmingModifier(ours, match, twigToken.type);
    if (endAfterModifier) {
      twigStarts.add(endAfterModifier.start);
      continue;
    }
    if (!acceptedTypes.includes(match.type)) {
      mismatches.push(describeMismatch(twigToken, `our token is ${match.type} ${JSON.stringify(match.value)}`));
      continue;
    }
    if (!valuesAgree(twigToken, match)) {
      mismatches.push(describeMismatch(twigToken, `our value is ${JSON.stringify(match.value)}`));
    }
  }

  const startsWithoutTwigToken = new Set([
    ...findStartsOfTagsConsumedByTwigLexer(ours),
    ...findStartsOfQuotesTwigLexesAsStringParts(ours, source),
  ]);
  for (const token of ours) {
    if (!typesThatMustAlignWithTwig.has(token.type) || twigStarts.has(token.start) || startsWithoutTwigToken.has(token.start)) continue;
    mismatches.push(`our ${token.type} ${JSON.stringify(token.value)} at offset ${token.start} has no Twig token`);
  }

  return mismatches;
}

const pendingPatchesByFixture: Record<string, string[]> = {
};

const showPendingMismatches = process.env['PARITY_SHOW_PENDING'] === '1';

const fixtureNames = readdirSync(fixturesDirectory).filter((name) => name.endsWith('.twig')).sort();

function assertParity(fixtureName: string): void {
  const source = readFileSync(new URL(fixtureName, fixturesDirectory), 'utf8');
  const golden = JSON.parse(readFileSync(new URL(fixtureName.replace(/\.twig$/, '.tokens.json'), fixturesDirectory), 'utf8')) as Golden;
  expect(findParityMismatches(source, golden).join('\n')).toBe('');
}

describe('lexer parity with Twig (golden files from tools/twig-oracle)', () => {
  for (const fixtureName of fixtureNames) {
    const pendingPatches = pendingPatchesByFixture[fixtureName];
    if (pendingPatches && !showPendingMismatches) {
      it.fails(`${fixtureName} (awaiting ${pendingPatches.join(', ')})`, () => assertParity(fixtureName));
    } else {
      it(fixtureName, () => assertParity(fixtureName));
    }
  }
});
