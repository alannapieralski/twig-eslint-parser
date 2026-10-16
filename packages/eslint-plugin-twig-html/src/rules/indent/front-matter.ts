import type { Range } from '../../shared/range.js';

const leadingFrontMatter = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/;

export function findFrontMatter(text: string): Range[] {
  const frontMatter = leadingFrontMatter.exec(text);
  return frontMatter ? [[0, frontMatter[0].length]] : [];
}
