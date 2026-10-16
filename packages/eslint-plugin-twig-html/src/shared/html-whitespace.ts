const leadingHtmlWhitespace = /^[ \t\n\r\f]*/;
const trailingHtmlWhitespace = /[ \t\n\r\f]*$/;

export function countLeadingHtmlWhitespace(text: string): number {
  return text.match(leadingHtmlWhitespace)?.[0].length ?? 0;
}

export function countTrailingHtmlWhitespace(text: string): number {
  return text.match(trailingHtmlWhitespace)?.[0].length ?? 0;
}
