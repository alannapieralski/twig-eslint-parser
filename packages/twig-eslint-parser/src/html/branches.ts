import type { TwigBlockSummary } from '../twig/blocks.js';

export type BranchSegment = { readonly groupId: number; readonly branchIndex: number; readonly start: number; readonly end: number };
export type BranchAnnotations = { readonly branchSegments: BranchSegment[]; readonly branchControlRanges: [number, number][] };

type Role = 'start' | 'continue' | 'end' | 'blockOpen' | 'blockClose';
type Frame = { readonly kind: 'if'; readonly groupId: number; branchIndex: number; segmentStart: number } | { readonly kind: 'block' };

const tagsThatScopeBranches = new Set(['for', 'block', 'macro', 'embed', 'autoescape', 'sandbox', 'with']);

function roleOf(block: TwigBlockSummary): Role | undefined {
  const { tagName } = block;
  if (block.kind !== 'tag' || tagName === undefined) return undefined;
  if (tagName === 'if') return 'start';
  if (tagName === 'elseif' || tagName === 'else') return 'continue';
  if (tagName === 'endif') return 'end';
  if (tagName.startsWith('end') && tagsThatScopeBranches.has(tagName.slice('end'.length))) return 'blockClose';
  if (tagsThatScopeBranches.has(tagName) && block.depthChange === 1) return 'blockOpen';
  return undefined;
}

// Splits each {% if %} group into its branches, for rules that must not compare markup across branches.
export function annotateBranches(blocks: readonly TwigBlockSummary[]): BranchAnnotations {
  const branchSegments: BranchSegment[] = [];
  const branchControlRanges: [number, number][] = [];
  const stack: Frame[] = [];
  let nextGroupId = 0;

  for (const block of blocks) {
    const role = roleOf(block);
    if (role === undefined) continue;
    const [start, end] = block.range;
    branchControlRanges.push([start, end]);
    const top = stack.at(-1);
    switch (role) {
      case 'start':
        stack.push({ kind: 'if', groupId: nextGroupId++, branchIndex: 0, segmentStart: end });
        break;
      case 'blockOpen':
        stack.push({ kind: 'block' });
        break;
      case 'continue':
        if (top?.kind !== 'if') break;
        branchSegments.push({ groupId: top.groupId, branchIndex: top.branchIndex, start: top.segmentStart, end: start });
        top.branchIndex += 1;
        top.segmentStart = end;
        break;
      case 'end':
        if (top?.kind !== 'if') break;
        stack.pop();
        branchSegments.push({ groupId: top.groupId, branchIndex: top.branchIndex, start: top.segmentStart, end: start });
        break;
      case 'blockClose':
        if (top?.kind === 'block') stack.pop();
        break;
    }
  }
  return { branchSegments, branchControlRanges };
}
