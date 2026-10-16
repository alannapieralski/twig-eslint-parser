const groupDelimiters: ReadonlySet<string> = new Set(['[', ']', '|', '][']);
const surroundingQuote = /^["'`]|["'`]$/g;
const whitespaceRun = /\s+/;

export function isGroupDelimiter(text: string): boolean {
  return groupDelimiters.has(text.trim());
}

export function containsGroupDelimiter(classList: string): boolean {
  const tokens = classList.replace(surroundingQuote, '').split(whitespaceRun);
  return tokens.some((token) => groupDelimiters.has(token));
}
