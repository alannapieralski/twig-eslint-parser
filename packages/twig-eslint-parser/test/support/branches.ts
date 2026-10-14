type Segment = { readonly start: number; readonly end: number };
type MaybeClosedTag = { readonly name: string; readonly openStart: number; readonly isClosed: boolean };

export function branchSegmentsOf(ast: unknown): readonly Segment[] {
  const segments = (ast as { branchSegments?: unknown } | undefined)?.branchSegments;
  return Array.isArray(segments) ? (segments as Segment[]) : [];
}

export function isInsideABranch(offset: number, segments: readonly Segment[]): boolean {
  return segments.some((segment) => segment.start <= offset && offset < segment.end);
}

function comparableName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

// Tells whether a close tag the tree does not use can be explained by an element of that name left open inside a Twig branch.
export function isClosedInAnotherBranch(ast: unknown, closeStart: number, closeName: string, tags: readonly MaybeClosedTag[]): boolean {
  const segments = branchSegmentsOf(ast);
  return tags.some((tag) => !tag.isClosed && tag.openStart < closeStart && comparableName(tag.name) === comparableName(closeName) && isInsideABranch(tag.openStart, segments));
}
