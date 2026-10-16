import { resolve } from 'node:path';
import { configChecks, ruleChecks, type PackageCorpus } from '../../../tools/corpus/src/index.js';
import twigHtml from '../src/index.js';

export default {
  package: 'eslint-plugin-twig-html',
  checks: [
    ...ruleChecks({
      plugin: twigHtml,
      prefix: 'twig-html',
      rules: {
        'attrs-newline': { fixKeeps: 'layout' },
        indent: { fixKeeps: 'layout' },
        'multiline-html-element-content-newline': { fixKeeps: 'layout' },
        quotes: { fixKeeps: 'code' },
      },
    }),
    ...configChecks({
      prefix: 'twig-html',
      configs: { recommended: [twigHtml.configs.recommended] },
      fixKeeps: 'code',
      fallbackTailwindCwd: resolve(import.meta.dirname, '..'),
    }),
  ],
} satisfies PackageCorpus;
