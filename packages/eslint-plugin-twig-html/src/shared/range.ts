export type Range = readonly [number, number];

export function containsOffset(range: Range, offset: number): boolean {
  return range[0] <= offset && offset < range[1];
}
