import type { TwigQuote } from 'twig-eslint-parser';
import type { Options, QuoteStyle } from './options.js';

const quoteByStyle: Record<QuoteStyle, TwigQuote> = { single: "'", double: '"' };

export function quotesFor(options: Required<Options>): { htmlQuote: TwigQuote; twigQuote: TwigQuote } {
  return { htmlQuote: quoteByStyle[options.html], twigQuote: quoteByStyle[options.twig] };
}

export function describeQuote(quote: TwigQuote): string {
  return quote === "'" ? "single (')" : 'double (")';
}
