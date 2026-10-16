import type { Rule } from 'eslint';
import type { Edit, Problem } from './problem.js';

const fixFor = (edits: readonly Edit[]) => (fixer: Rule.RuleFixer) => edits.map((edit) => fixer.replaceTextRange([...edit.range], edit.text));

export function reportProblems(context: Rule.RuleContext, problems: readonly Problem[]): void {
  const { sourceCode } = context;

  for (const { range, messageId, data, edits } of problems) {
    context.report({
      loc: { start: sourceCode.getLocFromIndex(range[0]), end: sourceCode.getLocFromIndex(range[1]) },
      messageId,
      data,
      ...(edits && { fix: fixFor(edits) }),
    });
  }
}
