const docsDirectory = 'https://github.com/alannapieralski/twig-eslint-parser/blob/main/packages/eslint-plugin-twig-html/docs/rules';

export function docsUrlFor(ruleId: string): string {
  return `${docsDirectory}/${ruleId}.md`;
}
