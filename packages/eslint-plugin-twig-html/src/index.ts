import { createRequire } from 'node:module';
import type { ESLint, Linter } from 'eslint';
import twigParser from 'twig-eslint-parser';
import { attrsNewline } from './rules/attrs-newline.js';
import { contentNewline } from './rules/content-newline.js';

const { name, version } = createRequire(import.meta.url)('../package.json') as { name: string; version: string };

const plugin = {
  meta: { name, version },
  rules: { 'attrs-newline': attrsNewline, 'content-newline': contentNewline },
  configs: {} as { recommended: Linter.Config },
} satisfies ESLint.Plugin;

const recommended: Linter.Config = {
  name: 'twig-html/recommended',
  files: ['**/*.twig'],
  ignores: ['**/*.svg.twig'],
  plugins: { 'twig-html': plugin },
  languageOptions: { parser: twigParser },
  rules: { 'twig-html/attrs-newline': 'warn', 'twig-html/content-newline': 'warn' },
};

Object.assign(plugin.configs, { recommended });

export default plugin;
