import { resolve } from 'node:path';
import { configChecks, ruleChecks, type PackageCorpus } from '../../../tools/corpus/src/index.js';
import twigTailwind, { createConfig } from '../src/index.js';

const recommended = createConfig();
const drupal = createConfig({ drupal: true });

export default {
  package: 'eslint-plugin-twig-tailwind',
  checks: [
    ...ruleChecks({ plugin: { rules: twigTailwind.rules, configs: { recommended } }, prefix: 'twig-tailwind' }),
    ...configChecks({
      prefix: 'twig-tailwind',
      configs: { recommended: [recommended], drupal: [drupal] },
      fixKeeps: 'class-tokens',
      fallbackTailwindCwd: resolve(import.meta.dirname, '..'),
      rulesThatRewriteClasses: ['better-tailwindcss/enforce-canonical-classes', 'better-tailwindcss/no-deprecated-classes'],
      rulesThatRemoveDuplicateClasses: ['better-tailwindcss/no-duplicate-classes'],
    }),
  ],
} satisfies PackageCorpus;
