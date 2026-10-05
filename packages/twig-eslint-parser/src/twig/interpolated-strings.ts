import { tokenizeTwig } from './tokens.js';

type OpenString = { readonly start: number; isInterpolated: boolean };

export function findInterpolatedStrings(code: string): readonly (readonly [number, number])[] {
  const ranges: (readonly [number, number])[] = [];
  const openStrings: OpenString[] = [];

  for (const token of tokenizeTwig(code)) {
    if (token.type === 'OPENING_QUOTE') openStrings.push({ start: token.start, isInterpolated: false });
    const innermost = openStrings.at(-1);
    if (token.type === 'INTERPOLATION_START' && innermost) innermost.isInterpolated = true;
    if (token.type === 'CLOSING_QUOTE') {
      const closed = openStrings.pop();
      if (closed?.isInterpolated) ranges.push([closed.start, token.end]);
    }
  }
  return ranges;
}
