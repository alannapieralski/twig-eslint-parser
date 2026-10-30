const DOCS_DIRECTORY = 'https://github.com/alannapieralski/twig-lint/blob/main/packages/eslint-plugin-twig-html/docs/rules';

export function docsUrlFor(ruleId: string): string {
  return `${DOCS_DIRECTORY}/${ruleId}.md`;
}
