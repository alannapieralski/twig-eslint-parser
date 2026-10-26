import { resolve } from 'node:path';
import { configChecks, ruleChecks } from '../../../tools/corpus/src/index.js';
import twigTailwind from '../src/index.js';
import type { PackageCorpus } from '../../../tools/corpus/src/index.js';

const { recommended, drupal } = twigTailwind.configs;

export default {
  package: 'eslint-plugin-twig-tailwind',
  checks: [
    ...ruleChecks({ plugin: twigTailwind, prefix: 'twig-tailwind' }),
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
