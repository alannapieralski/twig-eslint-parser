import type { ParsedTag } from './tag-node.js';

const tagEnds: ReadonlySet<string> = new Set(['>', '/>']);
const twigSpan = /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\}/g;
const quotedValue = /"[^"]*"|'[^']*'/g;

function hasStrayOpeningBracket(attributeText: string): boolean {
  const withoutTwigAndQuotedText = attributeText.replace(twigSpan, '').replace(quotedValue, '');
  return withoutTwigAndQuotedText.includes('<');
}

export function isOpenTagSwallowingMarkup(tag: Pick<ParsedTag, 'openEnd' | 'attributes'>, text: string): boolean {
  const endsWithClosingBracket = tag.openEnd !== undefined && tagEnds.has(tag.openEnd.value);
  if (!endsWithClosingBracket) return true;

  return tag.attributes.some((attribute) => hasStrayOpeningBracket(text.slice(...attribute.range)));
}
