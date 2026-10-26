import type { Range } from '../../shared/range.js';

const LEADING_YAML_FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/;

export function findYamlFrontMatter(text: string): Range[] {
  const yamlFrontMatter = LEADING_YAML_FRONT_MATTER.exec(text);
  return yamlFrontMatter ? [[0, yamlFrontMatter[0].length]] : [];
}
