import { resolve } from 'node:path';
import { configChecks, ruleChecks } from '../../../tools/corpus/src/index.js';
import twigHtml from '../src/index.js';
import type { PackageCorpus } from '../../../tools/corpus/src/index.js';

const rules = {
  'attrs-newline': { fixKeeps: 'layout' },
  indent: { fixKeeps: 'layout' },
  'multiline-html-element-content-newline': { fixKeeps: 'layout' },
  quotes: { fixKeeps: 'code' },
} as const;

const hiddenClassVariant = { name: 'hidden-class', languageOptions: { parserOptions: { ignoreInterpolatedAttributes: ['class'] } } };

export default {
  package: 'eslint-plugin-twig-html',
  checks: [
    ...ruleChecks({ plugin: twigHtml, prefix: 'twig-html', rules }),
    ...ruleChecks({ plugin: twigHtml, prefix: 'twig-html', rules, variant: hiddenClassVariant }),
    ...configChecks({
      prefix: 'twig-html',
      configs: { recommended: [twigHtml.configs.recommended] },
      fixKeeps: 'code',
      fallbackTailwindCwd: resolve(import.meta.dirname, '..'),
    }),
  ],
} satisfies PackageCorpus;
