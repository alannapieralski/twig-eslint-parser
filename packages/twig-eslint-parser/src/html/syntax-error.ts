export class HtmlSyntaxError extends Error {
  readonly lineNumber: number;
  readonly column: number;

  constructor(message: string, lineNumber: number, column: number) {
    super(message);
    this.name = 'HtmlSyntaxError';
    this.lineNumber = lineNumber;
    this.column = column;
  }
}
