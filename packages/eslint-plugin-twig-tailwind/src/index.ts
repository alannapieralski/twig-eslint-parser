import { createRequire } from 'node:module';
import type { ESLint, Linter } from 'eslint';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults';
import twigParser from 'twig-eslint-parser';
import { createProcessor } from './processor.js';
import { noInterpolatedAttributes } from './rules/no-interpolated-attributes.js';
import { noInterpolatedClasses } from './rules/no-interpolated-classes.js';
import { drupalSelectors } from './selectors.js';

const { name, version } = createRequire(import.meta.url)('../package.json') as { name: string; version: string };

const plugin = {
  meta: { name, version },
  rules: {
    'no-interpolated-attributes': noInterpolatedAttributes,
    'no-interpolated-classes': noInterpolatedClasses,
  },
  processors: { twig: createProcessor({ name, version }) },
  configs: {} as { recommended: Linter.Config },
} satisfies ESLint.Plugin;

const attributeSelectors = getDefaultSelectors().filter((selector) => selector.kind === 'attribute');

const recommended: Linter.Config = {
  name: 'twig-tailwind/recommended',
  files: ['**/*.twig'],
  plugins: { ...betterTailwindcss.configs.recommended.plugins, 'twig-tailwind': plugin },
  processor: 'twig-tailwind/twig',
  languageOptions: {
    parser: twigParser,
    parserOptions: { ignoreInterpolatedAttributes: ['class'] },
  },
  settings: {
    'better-tailwindcss': { selectors: [...getDefaultSelectors(), ...drupalSelectors] },
  },
  rules: {
    ...betterTailwindcss.configs.recommended.rules,
    'better-tailwindcss/enforce-consistent-line-wrapping': ['warn', { selectors: attributeSelectors }],
    'twig-tailwind/no-interpolated-attributes': 'error',
    'twig-tailwind/no-interpolated-classes': 'error',
  },
};

Object.assign(plugin.configs, { recommended });

export { drupalSelectors, twigSelectors, type ClassSelector } from './selectors.js';
export default plugin;
