import type { TwigBlockSummary } from 'twig-eslint-parser';
import type { Problem } from '../../shared/problem.js';
import { findIndentLayout } from '../../shared/indent-layout/find-indent-layout.js';
import { isSkipped } from '../../shared/indent-layout/indent-skips.js';
import type { IndentLayout, LineStart, MarkupNode } from '../../shared/indent-layout/types.js';
import { describeIndentation } from './describe-indentation.js';
import { expectedIndentAt } from './expected-indent.js';
import { findLineStarts } from './line-starts.js';
import type { ResolvedOptions } from './options.js';

export type MarkupProgram = { readonly body: readonly MarkupNode[] };

export type IndentSource = { readonly text: string; readonly blocks: readonly TwigBlockSummary[] };

function findLineProblem(line: LineStart, layout: IndentLayout, text: string, options: ResolvedOptions): Problem[] {
  const actual = text.slice(line.lineStart, line.contentStart);
  const expected = expectedIndentAt(line.contentStart, layout, options);
  if (actual === expected) return [];

  const range = [line.lineStart, line.contentStart] as const;

  return [{
    range,
    messageId: 'wrongIndentation',
    data: {
      expected: describeIndentation(expected, options.unit.name),
      actual: describeIndentation(actual, options.unit.name),
    },
    edits: [{ range, text: expected }],
  }];
}

export function findIndentProblems(program: MarkupProgram, source: IndentSource, options: ResolvedOptions): Problem[] {
  const { text, blocks } = source;
  const [document] = program.body;
  if (!document) return [];

  const layout = findIndentLayout(document, { text, blocks, ignores: options.ignores });
  if (!layout) return [];

  const checkedLines = findLineStarts(text).filter((line) => !isSkipped(line.contentStart, layout));

  return checkedLines.flatMap((line) => findLineProblem(line, layout, text, options));
}
