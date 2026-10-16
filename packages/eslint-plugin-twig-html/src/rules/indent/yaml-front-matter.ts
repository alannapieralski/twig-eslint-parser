import type { Range } from '../../shared/range.js';

const leadingYamlFrontMatter = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/;

export function findYamlFrontMatter(text: string): Range[] {
  const yamlFrontMatter = leadingYamlFrontMatter.exec(text);
  return yamlFrontMatter ? [[0, yamlFrontMatter[0].length]] : [];
}
