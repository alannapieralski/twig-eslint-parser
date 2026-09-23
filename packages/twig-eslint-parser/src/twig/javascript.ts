import { blankPreservingLineBreaks } from '../source-text.js';
import type { TwigBlock } from './blocks.js';
import type { TwigToken } from './tokens.js';

type ExpressionLayout = {
  readonly wrapInParentheses: boolean;
  readonly closeWithParenthesis?: boolean;
  readonly expressionStartIndex: number;
  readonly replacements: ReadonlyMap<number, string>;
};

type Frame = {
  readonly opener: 'root' | '(' | '[' | '{' | '#{';
  readonly closesComputedKey: boolean;
  hashExpects: 'key' | 'value' | undefined;
  readonly openQuestionMarkIndices: number[];
};

const javascriptByTwigOperator: Record<string, string> = {
  'and': '&&',
  'or': '||',
  'xor': '^',
  'not': '!',
  'b-and': '&',
  'b-or': '|',
  'b-xor': '^',
  'in': '==',
  'not in': '!=',
  'matches': '==',
  'starts with': '==',
  'ends with': '==',
  'has some': ',',
  'has every': ',',
  '~': '+',
  '..': '+',
  '//': '/',
  '?:': '||',
  '<=>': '==',
};

const javascriptByTwigTestOperator: Record<string, string> = { 'is': '==', 'is not': '!=' };
const twoWordTests: Record<string, string> = { same: 'as', divisible: 'by' };
const expressionTags = new Set(['if', 'elseif', 'do', 'macro', 'with']);
const includeTags = new Set(['include', 'embed']);
const includeKeywordsToBlank = new Set(['only', 'ignore', 'missing']);
const reservedJavaScriptWords = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum',
  'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'return', 'super',
  'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with',
]);
const nonSignificantTypes = new Set(['WHITESPACE', 'TRIMMING_MODIFIER', 'LINE_TRIMMING_MODIFIER', 'INLINE_COMMENT']);

function padTo(replacement: string, length: number): string {
  if (replacement.length > length) throw new Error(`Replacement "${replacement}" is longer than the ${length} characters it replaces.`);
  return replacement.padEnd(length, ' ');
}

function isSignificant(token: TwigToken): boolean {
  return !nonSignificantTypes.has(token.type);
}

function isPunctuation(token: TwigToken | undefined, value: string): boolean {
  return token?.type === 'PUNCTUATION' && token.value === value;
}

function findNextSignificant(tokens: readonly TwigToken[], afterIndex: number, toIndex: number): TwigToken | undefined {
  return tokens.slice(afterIndex + 1, toIndex).find(isSignificant);
}

function findTopLevelIndices(tokens: readonly TwigToken[]): Set<number> {
  const topLevelIndices = new Set<number>();
  let depth = 0;
  tokens.forEach((token, index) => {
    if (token.type === 'PUNCTUATION' && '([{'.includes(token.value)) depth += 1;
    if (token.type === 'INTERPOLATION_START' || token.type === 'OPENING_QUOTE') depth += 1;
    if (depth === 0) topLevelIndices.add(index);
    if (token.type === 'PUNCTUATION' && ')]}'.includes(token.value)) depth -= 1;
    if (token.type === 'INTERPOLATION_END' || token.type === 'CLOSING_QUOTE') depth -= 1;
  });
  return topLevelIndices;
}

function indexAfterTagName(block: TwigBlock): number {
  return block.tokens.findIndex((token) => token.type === 'NAME') + 1;
}

function lastWhitespaceBeforeClosing(tokens: readonly TwigToken[]): number {
  for (let index = tokens.length - 2; index >= 0; index -= 1) {
    const token = tokens[index] as TwigToken;
    if (token.type === 'WHITESPACE') return index;
    if (isSignificant(token)) return -1;
  }
  return -1;
}

function replaceFirstCharacter(token: TwigToken | undefined, character: string): string | undefined {
  if (token?.type !== 'WHITESPACE') return undefined;
  return `${character}${blankPreservingLineBreaks(token.value.slice(1))}`;
}

function describeSetLayout(block: TwigBlock, afterTagName: number, topLevelIndices: ReadonlySet<number>): ExpressionLayout {
  const tokens = block.tokens;
  const tagNameIndex = afterTagName - 1;
  const equalsIndex = tokens.findIndex((token, index) => topLevelIndices.has(index) && token.type === 'OPERATOR' && token.value === '=');
  const hasMultipleTargets = equalsIndex !== -1
    && tokens.some((token, index) => index > tagNameIndex && index < equalsIndex && topLevelIndices.has(index) && isPunctuation(token, ','));
  if (!hasMultipleTargets) {
    return { wrapInParentheses: false, expressionStartIndex: afterTagName, replacements: new Map([[tagNameIndex, 'var']]) };
  }

  const closingWhitespaceIndex = lastWhitespaceBeforeClosing(tokens);
  const bracketSlots: [number, string][] = [[afterTagName, '['], [equalsIndex - 1, ']'], [equalsIndex + 1, '['], [closingWhitespaceIndex, ']']];
  const bracketReplacements = bracketSlots.map(([index, bracket]) => [index, replaceFirstCharacter(tokens[index], bracket)] as const);
  if (bracketReplacements.some(([, replacement]) => replacement === undefined)) {
    return { wrapInParentheses: true, expressionStartIndex: afterTagName, replacements: new Map([[tagNameIndex, padTo('', 3)]]) };
  }

  return {
    wrapInParentheses: false,
    expressionStartIndex: afterTagName,
    replacements: new Map<number, string>([[tagNameIndex, 'var'], ...bracketReplacements.map(([index, replacement]) => [index, replacement as string] as const)]),
  };
}

function describeTagLayout(block: TwigBlock): ExpressionLayout | undefined {
  const tagName = block.tagName;
  if (!tagName) return undefined;

  const afterTagName = indexAfterTagName(block);
  const topLevelIndices = findTopLevelIndices(block.tokens);

  if (tagName === 'set') return describeSetLayout(block, afterTagName, topLevelIndices);
  if (expressionTags.has(tagName)) {
    const replacements = new Map<number, string>();
    if (tagName === 'with') {
      block.tokens.forEach((token, index) => {
        if (topLevelIndices.has(index) && token.type === 'NAME' && token.value === 'only') replacements.set(index, padTo('', token.value.length));
      });
    }
    return { wrapInParentheses: true, expressionStartIndex: afterTagName, replacements };
  }
  if (tagName === 'block') {
    const blockNameIndex = block.tokens.findIndex((token, index) => index >= afterTagName && isSignificant(token));
    const hasShortFormValue = block.tokens.some((token, index) => index > blockNameIndex && isSignificant(token) && token.type !== 'TAG_END');
    if (!hasShortFormValue) return undefined;
    return { wrapInParentheses: true, expressionStartIndex: blockNameIndex + 1, replacements: new Map() };
  }
  if (tagName === 'for') {
    const inIndex = block.tokens.findIndex((token, index) => topLevelIndices.has(index) && token.type === 'OPERATOR' && token.value === 'in');
    if (inIndex === -1) return undefined;
    const replacements = new Map<number, string>();
    block.tokens.forEach((token, index) => {
      if (index > inIndex && topLevelIndices.has(index) && token.type === 'NAME' && token.value === 'if') replacements.set(index, padTo(',', token.value.length));
    });
    return { wrapInParentheses: true, expressionStartIndex: inIndex + 1, replacements };
  }
  if (includeTags.has(tagName)) return describeIncludeLayout(block, tagName, afterTagName, topLevelIndices);
  return undefined;
}

function describeIncludeLayout(block: TwigBlock, tagName: string, afterTagName: number, topLevelIndices: ReadonlySet<number>): ExpressionLayout {
  const keywordReplacements = new Map<number, string>();
  block.tokens.forEach((token, index) => {
    if (!topLevelIndices.has(index) || token.type !== 'NAME' || index < afterTagName) return;
    if (token.value === 'with') keywordReplacements.set(index, padTo(',', token.value.length));
    if (includeKeywordsToBlank.has(token.value)) keywordReplacements.set(index, padTo('', token.value.length));
  });

  const whitespaceAfterTagName = block.tokens[afterTagName];
  if (whitespaceAfterTagName?.type !== 'WHITESPACE') {
    return { wrapInParentheses: true, expressionStartIndex: afterTagName, replacements: new Map([...keywordReplacements, [afterTagName - 1, padTo('', tagName.length)]]) };
  }

  return {
    wrapInParentheses: false,
    closeWithParenthesis: true,
    expressionStartIndex: afterTagName + 1,
    replacements: new Map([
      ...keywordReplacements,
      [afterTagName - 1, tagName],
      [afterTagName, `(${blankPreservingLineBreaks(whitespaceAfterTagName.value.slice(1))}`],
    ]),
  };
}

function describeLayout(block: TwigBlock): ExpressionLayout | undefined {
  if (block.kind === 'comment') return undefined;
  if (block.kind === 'print') return { wrapInParentheses: true, expressionStartIndex: 1, replacements: new Map() };
  return describeTagLayout(block);
}

function findMatchingClosingQuote(tokens: readonly TwigToken[], openingIndex: number): { closingIndex: number; isInterpolated: boolean } {
  let depth = 0;
  let isInterpolated = false;
  for (let index = openingIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.type === 'OPENING_QUOTE') depth += 1;
    if (token?.type === 'INTERPOLATION_START' && depth === 1) isInterpolated = true;
    if (token?.type === 'CLOSING_QUOTE') {
      depth -= 1;
      if (depth === 0) return { closingIndex: index, isInterpolated };
    }
  }
  throw new Error(`Twig string opened at offset ${tokens[openingIndex]?.start} has no closing quote.`);
}

function canBecomeTemplateLiteral(tokens: readonly TwigToken[], openingIndex: number, closingIndex: number): boolean {
  let depth = 0;
  for (let index = openingIndex + 1; index < closingIndex; index += 1) {
    const token = tokens[index];
    if (token?.type === 'INTERPOLATION_START') depth += 1;
    if (token?.type === 'INTERPOLATION_END') depth -= 1;
    if (depth === 0 && token?.type === 'STRING' && (token.value.includes('`') || token.value.includes('${'))) return false;
  }
  return true;
}

function classifyColon(frame: Frame, previous: TwigToken | undefined, beforePrevious: TwigToken | undefined): 'hash-key' | 'spaced-elvis' | 'named-argument' | 'ternary' {
  if (frame.opener === '{' && frame.hashExpects === 'key') return 'hash-key';
  if (isPunctuation(previous, '?') && frame.openQuestionMarkIndices.length > 0) return 'spaced-elvis';

  const followsArgumentName = previous?.type === 'NAME' && (isPunctuation(beforePrevious, '(') || isPunctuation(beforePrevious, ','));
  if (frame.opener === '(' && !frame.closesComputedKey && followsArgumentName && frame.openQuestionMarkIndices.length === 0) return 'named-argument';
  return 'ternary';
}

function mapExpression(tokens: readonly TwigToken[], fromIndex: number, toIndex: number, pieces: string[], replacements: ReadonlyMap<number, string>): void {
  const frames: Frame[] = [{ opener: 'root', closesComputedKey: false, hashExpects: undefined, openQuestionMarkIndices: [] }];
  const templateLiteralQuoteIndices = new Set<number>();
  const recentSignificant: TwigToken[] = [];
  const currentFrame = () => frames[frames.length - 1] as Frame;
  const resolveShortTernaries = (frame: Frame) => {
    for (const index of frame.openQuestionMarkIndices.splice(0)) pieces[index] = '&';
  };

  for (let index = fromIndex; index < toIndex; index += 1) {
    const token = tokens[index] as TwigToken;
    const frame = currentFrame();
    const previous = recentSignificant.at(-1);
    const beforePrevious = recentSignificant.at(-2);

    const replacement = replacements.get(index);
    if (replacement !== undefined) {
      pieces[index] = replacement;
      if (replacement.trim() === ',') resolveShortTernaries(frame);
      recentSignificant.push(token);
      continue;
    }
    if (!isSignificant(token)) {
      pieces[index] = token.type === 'WHITESPACE' ? token.value : blankPreservingLineBreaks(token.value);
      continue;
    }

    pieces[index] = token.value;
    switch (token.type) {
      case 'OPERATOR': {
        const normalisedOperator = token.value.replace(/\s+/g, ' ');
        const javascript = javascriptByTwigOperator[normalisedOperator];
        if (javascript !== undefined) pieces[index] = padTo(javascript, token.value.length);
        break;
      }
      case 'NUMBER': {
        const isAttributeAccess = isPunctuation(previous, '.');
        const next = findNextSignificant(tokens, index, toIndex);
        const hasMemberAfter = isPunctuation(next, '.') || isPunctuation(next, '|');
        if (isAttributeAccess || hasMemberAfter) pieces[index] = `_${token.value.slice(1).replace(/[^A-Za-z0-9_]/g, '_')}`;
        break;
      }
      case 'TEST_OPERATOR': {
        const normalisedOperator = token.value.replace(/\s+/g, ' ');
        pieces[index] = padTo(javascriptByTwigTestOperator[normalisedOperator] ?? '==', token.value.length);
        break;
      }
      case 'NAME': {
        const isPropertyName = isPunctuation(previous, '.') || isPunctuation(previous, '|') || (previous?.type === 'OPERATOR' && previous.value === '?.');
        const isHashKey = frame.opener === '{' && frame.hashExpects === 'key';
        const secondTestWord = previous?.type === 'NAME' && beforePrevious?.type === 'TEST_OPERATOR' ? twoWordTests[previous.value] : undefined;
        if (secondTestWord === token.value) pieces[index] = padTo('', token.value.length);
        else if (!isPropertyName && !isHashKey && reservedJavaScriptWords.has(token.value)) pieces[index] = `_${token.value.slice(1)}`;
        break;
      }
      case 'PUNCTUATION': {
        if (token.value === '|') pieces[index] = '.';
        if (token.value === '.' && isPunctuation(findNextSignificant(tokens, index, toIndex), '(')) pieces[index] = ' ';
        if (token.value === '?') frame.openQuestionMarkIndices.push(index);
        if (token.value === ':') {
          const colonKind = classifyColon(frame, previous, beforePrevious);
          if (colonKind === 'hash-key') frame.hashExpects = 'value';
          if (colonKind === 'spaced-elvis') {
            pieces[frame.openQuestionMarkIndices.pop() as number] = '|';
            pieces[index] = ' ';
          }
          if (colonKind === 'named-argument') pieces[index] = '=';
          if (colonKind === 'ternary') frame.openQuestionMarkIndices.pop();
        }
        if (token.value === ',') {
          resolveShortTernaries(frame);
          if (frame.opener === '{') frame.hashExpects = 'key';
        }
        if (token.value === '(') {
          const isComputedKey = frame.opener === '{' && frame.hashExpects === 'key';
          if (isComputedKey) pieces[index] = '[';
          frames.push({ opener: '(', closesComputedKey: isComputedKey, hashExpects: undefined, openQuestionMarkIndices: [] });
        }
        if (token.value === '[') frames.push({ opener: '[', closesComputedKey: false, hashExpects: undefined, openQuestionMarkIndices: [] });
        if (token.value === '{') frames.push({ opener: '{', closesComputedKey: false, hashExpects: 'key', openQuestionMarkIndices: [] });
        if (')]}'.includes(token.value) && frames.length > 1) {
          resolveShortTernaries(frame);
          if (frame.closesComputedKey) pieces[index] = ']';
          frames.pop();
        }
        break;
      }
      case 'OPENING_QUOTE': {
        if (token.value !== '"') break;
        const { closingIndex, isInterpolated } = findMatchingClosingQuote(tokens, index);
        if (isInterpolated && canBecomeTemplateLiteral(tokens, index, closingIndex)) {
          pieces[index] = '`';
          templateLiteralQuoteIndices.add(closingIndex);
        }
        break;
      }
      case 'CLOSING_QUOTE': {
        if (templateLiteralQuoteIndices.has(index)) pieces[index] = '`';
        break;
      }
      case 'INTERPOLATION_START': {
        pieces[index] = '${';
        frames.push({ opener: '#{', closesComputedKey: false, hashExpects: undefined, openQuestionMarkIndices: [] });
        break;
      }
      case 'INTERPOLATION_END': {
        resolveShortTernaries(frame);
        if (frames.length > 1) frames.pop();
        break;
      }
      default:
        break;
    }
    recentSignificant.push(token);
  }

  frames.forEach(resolveShortTernaries);
}

export function toSameLengthJavaScript(block: TwigBlock): string | undefined {
  const layout = describeLayout(block);
  if (!layout) return undefined;

  const tokens = block.tokens;
  const closingIndex = tokens.length - 1;
  const pieces = tokens.map((token) => blankPreservingLineBreaks(token.value));
  mapExpression(tokens, layout.expressionStartIndex, closingIndex, pieces, layout.replacements);

  for (const [index, replacement] of layout.replacements) {
    if (index < layout.expressionStartIndex) pieces[index] = replacement;
  }
  const closing = tokens[closingIndex] as TwigToken;
  if (layout.wrapInParentheses) {
    const opening = tokens[0] as TwigToken;
    pieces[0] = `(${blankPreservingLineBreaks(opening.value.slice(1))}`;
  }
  if (layout.wrapInParentheses || layout.closeWithParenthesis) {
    pieces[closingIndex] = ` )${blankPreservingLineBreaks(closing.value.slice(2))}`;
  }

  const code = pieces.join('');
  if (code.length !== block.end - block.start) {
    throw new Error(`Twig block at offset ${block.start} became ${code.length} characters of JavaScript instead of ${block.end - block.start}.`);
  }
  return code;
}
