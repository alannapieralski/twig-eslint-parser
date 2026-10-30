export type Range = readonly [number, number];

export function isRangeWithin(inner: Range, outer: Range): boolean {
  return outer[0] <= inner[0] && inner[1] <= outer[1];
}
