const leadingIndentation = /^[ \t]*/;

export function lineIndentationAt(text: string, offset: number): string {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  return text.slice(lineStart, offset).match(leadingIndentation)?.[0] ?? '';
}
