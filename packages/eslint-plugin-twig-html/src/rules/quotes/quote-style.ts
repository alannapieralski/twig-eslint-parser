import type { TwigQuote } from 'twig-eslint-parser';
import type { Options, QuoteStyle } from './options.js';

const QUOTE_BY_STYLE: Record<QuoteStyle, TwigQuote> = { single: "'", double: '"' };

export function quotesFor(options: Required<Options>): { htmlQuote: TwigQuote; twigQuote: TwigQuote } {
  return { htmlQuote: QUOTE_BY_STYLE[options.html], twigQuote: QUOTE_BY_STYLE[options.twig] };
}

export function describeQuote(quote: TwigQuote): string {
  return quote === "'" ? "single (')" : 'double (")';
}
