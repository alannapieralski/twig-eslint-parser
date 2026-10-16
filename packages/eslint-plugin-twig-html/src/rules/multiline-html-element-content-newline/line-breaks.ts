export function countLineBreaks(text: string): number {
  return text.split('\n').length - 1;
}

export function indentationAfterLastLineBreak(text: string): string {
  return text.slice(text.lastIndexOf('\n') + 1);
}
