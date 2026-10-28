import type { AttributeNode, TwigQuote } from 'twig-eslint-parser';
import type { ParsedTag } from '../../shared/tag-node.js';
import type { TagSource } from '../../shared/tag-source.js';

export type AttributeWrapper = NonNullable<AttributeNode['startWrapper']>;

export type AttributeValue = NonNullable<AttributeNode['value']>;

export type TagWithAttributes = Omit<ParsedTag, 'attributes'> & { readonly attributes: readonly AttributeNode[] };

export type QuoteSource = Pick<TagSource, 'text' | 'blocks' | 'attributesOf' | 'unreadableTagStarts'> & {
  readonly htmlQuote: TwigQuote;
  readonly twigQuote: TwigQuote;
};
