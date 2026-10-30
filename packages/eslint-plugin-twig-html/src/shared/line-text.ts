const LEADING_INDENTATION = /^[ \t]*/;

export function indentationOf(line: string): string {
  return line.match(LEADING_INDENTATION)?.[0] ?? '';
}

export function lineStartOf(text: string, offset: number): number {
  return text.lastIndexOf('\n', offset - 1) + 1;
}

export function contentStartOf(text: string, lineStart: number): number {
  return lineStart + indentationOf(text.slice(lineStart)).length;
}

export function lineIndentationAt(text: string, offset: number): string {
  return indentationOf(text.slice(lineStartOf(text, offset), offset));
}
