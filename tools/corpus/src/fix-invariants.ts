import { parseForESLint } from 'twig-eslint-parser';

export type FixKeeps = 'whitespace';

function unconvertedBlockCount(code: string): number {
  return parseForESLint(code).services.twig.unconvertedBlocks.length;
}

function describeParseProblems(source: string, fixed: string): string[] {
  try {
    return unconvertedBlockCount(fixed) === unconvertedBlockCount(source) ? [] : ['the fix changes how many Twig blocks the parser can read'];
  } catch (error) {
    return [`the fixed template no longer parses: ${error instanceof Error ? error.message : String(error)}`];
  }
}

export function describeFixProblems(source: string, fixed: string, fixKeeps: FixKeeps | undefined): string[] {
  const problems = describeParseProblems(source, fixed);
  if (fixKeeps === 'whitespace' && fixed.replace(/\s+/g, '') !== source.replace(/\s+/g, '')) {
    problems.push('the fix changes more than whitespace');
  }
  return problems;
}
