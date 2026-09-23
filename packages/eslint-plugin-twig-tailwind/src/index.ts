import { createRequire } from 'node:module';
import type { ESLint, Linter } from 'eslint';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults';
import twigParser from 'twig-eslint-parser';
import { noInterpolatedAttributes } from './rules/no-interpolated-attributes.js';
import { drupalSelectors } from './selectors.js';

const { name, version } = createRequire(import.meta.url)('../package.json') as { name: string; version: string };

const plugin = {
  meta: { name, version },
  rules: { 'no-interpolated-attributes': noInterpolatedAttributes },
  configs: {} as { recommended: Linter.Config },
} satisfies ESLint.Plugin;

const recommended: Linter.Config = {
  name: 'twig-tailwind/recommended',
  files: ['**/*.twig'],
  plugins: { ...betterTailwindcss.configs.recommended.plugins, 'twig-tailwind': plugin },
  languageOptions: {
    parser: twigParser,
    parserOptions: { ignoreInterpolatedAttributes: ['class'] },
  },
  settings: {
    'better-tailwindcss': { selectors: [...getDefaultSelectors(), ...drupalSelectors] },
  },
  rules: {
    ...betterTailwindcss.configs.recommended.rules,
    'twig-tailwind/no-interpolated-attributes': 'error',
  },
};

Object.assign(plugin.configs, { recommended });

export { drupalSelectors, twigSelectors, type ClassSelector } from './selectors.js';
export default plugin;
