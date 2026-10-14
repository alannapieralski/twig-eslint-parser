import { resolve } from 'node:path';
import { configChecks, ruleChecks, type PackageCorpus } from '../../../tools/corpus/src/index.js';
import twigTailwind from '../src/index.js';

const { recommended, drupal } = twigTailwind.configs;

export default {
  package: 'eslint-plugin-twig-tailwind',
  checks: [
    ...ruleChecks({ plugin: twigTailwind, prefix: 'twig-tailwind', rules: { 'no-interpolated-classes': { settings: drupal.settings } } }),
    ...configChecks({
      prefix: 'twig-tailwind',
      configs: { recommended: [recommended], drupal: [recommended, drupal] },
      fixKeeps: 'class-tokens',
      fallbackTailwindCwd: resolve(import.meta.dirname, '..'),
      rulesThatRewriteClasses: ['better-tailwindcss/enforce-canonical-classes', 'better-tailwindcss/no-deprecated-classes'],
      rulesThatRemoveDuplicateClasses: ['better-tailwindcss/no-duplicate-classes'],
    }),
  ],
} satisfies PackageCorpus;
