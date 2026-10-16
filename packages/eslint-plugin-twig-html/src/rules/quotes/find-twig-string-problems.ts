import type { TwigStringSummary } from 'twig-eslint-parser';
import type { Problem } from '../../shared/problem.js';
import { describeQuote } from './quote-style.js';
import { requote } from './requote.js';
import type { QuoteSource } from './types.js';

export function findTwigStringProblems(string: TwigStringSummary, source: QuoteSource): Problem[] {
  const { text, twigQuote } = source;
  if (string.quote === twigQuote || string.isInterpolated) return [];

  const body = text.slice(string.range[0] + 1, string.range[1] - 1);
  const requoted = requote(body, string.quote, twigQuote);
  if (requoted === undefined) return [];

  return [{
    range: string.range,
    messageId: 'wrongTwigQuote',
    data: { expected: describeQuote(twigQuote) },
    edits: [{ range: string.range, text: `${twigQuote}${requoted}${twigQuote}` }],
  }];
}
