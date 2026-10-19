const docsDirectory = 'https://github.com/alannapieralski/twig-lint/blob/main/packages/eslint-plugin-twig-tailwind/docs/rules';

export function docsUrlFor(ruleId: string): string {
  return `${docsDirectory}/${ruleId}.md`;
}
