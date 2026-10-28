import type { IndentUnit } from './options.js';

export function repeatUnit(unit: IndentUnit, depth: number): string {
  return unit.text.repeat(Math.max(depth, 0));
}
