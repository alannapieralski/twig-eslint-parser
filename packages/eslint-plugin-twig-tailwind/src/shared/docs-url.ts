const DOCS_DIRECTORY = 'https://github.com/alannapieralski/twig-lint/blob/main/packages/eslint-plugin-twig-tailwind/docs/rules';

export function docsUrlFor(ruleId: string): string {
  return `${DOCS_DIRECTORY}/${ruleId}.md`;
}
