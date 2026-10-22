import type { TwigBlockSummary, TwigStringSummary } from 'twig-eslint-parser';
import type { Problem } from '../../shared/problem.js';
import type { AttributesOf } from '../../shared/tag-attributes.js';
import { expectedIndentAt, isChecked } from './expected-indent.js';
import { findBracketProblems } from './find-bracket-problems.js';
import { indentationProblem } from './indentation-problem.js';
import { buildIndentLayout } from './indent-regions.js';
import { findLineStarts } from './line-starts.js';
import type { ResolvedOptions } from './options.js';
import { findTwigSegments } from './twig-frames.js';
import type { MarkupNode } from './types.js';

export type MarkupProgram = { readonly body: readonly MarkupNode[] };

export type IndentSource = {
  readonly text: string;
  readonly blocks: readonly TwigBlockSummary[];
  readonly attributesOf: AttributesOf;
  readonly rawContentTags: readonly string[];
  readonly strings: readonly TwigStringSummary[];
};

export function findIndentProblems(program: MarkupProgram, source: IndentSource, options: ResolvedOptions): Problem[] {
  const { text, blocks, attributesOf, rawContentTags, strings } = source;
  const [document] = program.body;
  if (!document) return [];

  const segments = findTwigSegments(blocks, text);
  if (!segments) return [];

  const layout = buildIndentLayout(document, segments, { text, blocks, attributesOf, ignores: options.ignores, rawContentTags });
  const checkedLines = findLineStarts(text).filter((line) => isChecked(line.contentStart, layout));
  const lineProblems = checkedLines.flatMap((line) => indentationProblem(line, expectedIndentAt(line.contentStart, layout, options), text, options));

  return [...lineProblems, ...findBracketProblems(blocks, layout, text, options, strings)];
}
