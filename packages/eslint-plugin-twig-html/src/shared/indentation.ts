const tabIndentedLine = /^\t/m;
const spaceIndentedLine = /^ /m;

export function lineIndentation(text: string, offset: number): string {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  let indentationEnd = lineStart;

  while (text[indentationEnd] === ' ' || text[indentationEnd] === '\t') indentationEnd += 1;

  return text.slice(lineStart, indentationEnd);
}

export function indentUnitFor(text: string, tagIndentation: string, indent: number): string {
  const isTabIndented = tagIndentation === ''
    ? tabIndentedLine.test(text) && !spaceIndentedLine.test(text)
    : tagIndentation.includes('\t');

  return isTabIndented ? '\t' : ' '.repeat(indent);
}
