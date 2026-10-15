import { createRequire } from 'node:module';
import type { ESLint, Linter } from 'eslint';
import twigParser from 'twig-eslint-parser';
import { attrsNewline } from './rules/attrs-newline.js';
import { multilineHtmlElementContentNewline } from './rules/multiline-html-element-content-newline.js';
import { quotes } from './rules/quotes.js';

const { name, version } = createRequire(import.meta.url)('../package.json') as { name: string; version: string };

const plugin = {
  meta: { name, version },
  rules: { 'attrs-newline': attrsNewline, 'multiline-html-element-content-newline': multilineHtmlElementContentNewline, quotes },
  configs: {} as { recommended: Linter.Config },
} satisfies ESLint.Plugin;

const recommended: Linter.Config = {
  name: 'twig-html/recommended',
  files: ['**/*.twig'],
  ignores: ['**/*.svg.twig'],
  plugins: { 'twig-html': plugin },
  languageOptions: { parser: twigParser },
  rules: { 'twig-html/attrs-newline': 'warn', 'twig-html/multiline-html-element-content-newline': 'warn', 'twig-html/quotes': 'warn' },
};

Object.assign(plugin.configs, { recommended });

export default plugin;
