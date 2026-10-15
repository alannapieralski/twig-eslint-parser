import { createRequire } from 'node:module';
import type { ESLint, Linter } from 'eslint';
import twigParser from 'twig-eslint-parser';
import { attrsNewline } from './rules/attrs-newline.js';
import { multilineTagContent } from './rules/multiline-tag-content.js';
import { quotes } from './rules/quotes.js';

const { name, version } = createRequire(import.meta.url)('../package.json') as { name: string; version: string };

const plugin = {
  meta: { name, version },
  rules: { 'attrs-newline': attrsNewline, 'multiline-tag-content': multilineTagContent, quotes },
  configs: {} as { recommended: Linter.Config },
} satisfies ESLint.Plugin;

const recommended: Linter.Config = {
  name: 'twig-html/recommended',
  files: ['**/*.twig'],
  ignores: ['**/*.svg.twig'],
  plugins: { 'twig-html': plugin },
  languageOptions: { parser: twigParser },
  rules: { 'twig-html/attrs-newline': 'warn', 'twig-html/multiline-tag-content': 'warn', 'twig-html/quotes': 'warn' },
};

Object.assign(plugin.configs, { recommended });

export default plugin;
