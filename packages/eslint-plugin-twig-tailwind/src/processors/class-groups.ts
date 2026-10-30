const GROUP_DELIMITERS: ReadonlySet<string> = new Set(['[', ']', '|', '][']);
const SURROUNDING_QUOTE = /^["'`]|["'`]$/g;
const WHITESPACE_RUN = /\s+/;

export function isGroupDelimiter(text: string): boolean {
  return GROUP_DELIMITERS.has(text.trim());
}

export function containsGroupDelimiter(classList: string): boolean {
  const tokens = classList.replace(SURROUNDING_QUOTE, '').split(WHITESPACE_RUN);
  return tokens.some((token) => GROUP_DELIMITERS.has(token));
}
