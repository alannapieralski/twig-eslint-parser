const LEADING_HTML_WHITESPACE = /^[ \t\n\r\f]*/;
const TRAILING_HTML_WHITESPACE = /[ \t\n\r\f]*$/;

export function countLeadingHtmlWhitespace(text: string): number {
  return text.match(LEADING_HTML_WHITESPACE)?.[0].length ?? 0;
}

export function countTrailingHtmlWhitespace(text: string): number {
  return text.match(TRAILING_HTML_WHITESPACE)?.[0].length ?? 0;
}
