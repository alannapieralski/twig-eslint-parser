import type { Linter, Rule } from 'eslint';

export type FixOutcome = 'settled' | 'unresolved' | 'oscillates' | 'unsettled';
export type AppliedFix = { readonly ruleId: string | null; readonly replaced: string; readonly replacement: string };
export type FixRun = { readonly outcome: FixOutcome; readonly output: string; readonly passes: number; readonly applied: readonly AppliedFix[] };
type Pass = { readonly output: string; readonly applied: readonly AppliedFix[] };

type FixableMessage = Linter.LintMessage & { readonly fix: Rule.Fix };

const maxPasses = 10;

function isFixable(message: Linter.LintMessage): message is FixableMessage {
  return message.fix !== undefined;
}

// Applies one pass of non-overlapping fixes in source order.
export function applyOnePass(text: string, messages: readonly Linter.LintMessage[]): Pass {
  const fixable = messages.filter(isFixable).sort((first, second) => first.fix.range[0] - second.fix.range[0] || first.fix.range[1] - second.fix.range[1]);
  const applied: AppliedFix[] = [];
  let output = '';
  let position = 0;
  for (const { fix, ruleId } of fixable) {
    const [start, end] = fix.range;
    if (start < position || start > end) continue;
    output += text.slice(position, start) + fix.text;
    applied.push({ ruleId, replaced: text.slice(start, end), replacement: fix.text });
    position = end;
  }
  return { output: output + text.slice(position), applied };
}

export async function fixUntilSettled(
  source: string,
  firstMessages: readonly Linter.LintMessage[],
  lint: (code: string) => Promise<readonly Linter.LintMessage[]>,
): Promise<FixRun> {
  const seenOutputs = new Set([source]);
  const applied: AppliedFix[] = [];
  let current = source;
  let messages = firstMessages;
  for (let pass = 1; pass <= maxPasses; pass += 1) {
    if (!messages.some(isFixable)) return { outcome: 'settled', output: current, passes: pass - 1, applied };
    const next = applyOnePass(current, messages);
    applied.push(...next.applied);
    if (next.output === current) return { outcome: 'unresolved', output: current, passes: pass, applied };
    if (seenOutputs.has(next.output)) return { outcome: 'oscillates', output: next.output, passes: pass, applied };
    seenOutputs.add(next.output);
    current = next.output;
    messages = await lint(current);
  }
  return { outcome: messages.some(isFixable) ? 'unsettled' : 'settled', output: current, passes: maxPasses, applied };
}

export function describeFixOutcome(run: FixRun): string | undefined {
  switch (run.outcome) {
    case 'settled':
      return undefined;
    case 'unresolved':
      return 'the fix does not resolve its own report: applying it changes nothing and the report stays';
    case 'oscillates':
      return `the fix oscillates: pass ${run.passes} brings back an earlier version of the template`;
    case 'unsettled':
      return `the fix does not settle: the template still changes after ${maxPasses} passes`;
  }
}
