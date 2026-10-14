import { createRequire } from 'node:module';
import type { ESLint, Linter } from 'eslint';
import twigParser from 'twig-eslint-parser';
import { betterTailwindcss } from './better-tailwindcss.js';
import { createProcessor } from './processor.js';
import { noInterpolatedAttributes } from './rules/no-interpolated-attributes.js';
import { noInterpolatedClasses } from './rules/no-interpolated-classes.js';
import { noUnparsedTwig } from './rules/no-unparsed-twig.js';
import { drupalSelectors } from './selectors/drupal.js';
import { twigSelectors } from './selectors/twig.js';

const { name, version } = createRequire(import.meta.url)('../package.json') as { name: string; version: string };

const plugin = {
  meta: { name, version },
  rules: {
    'no-interpolated-attributes': noInterpolatedAttributes,
    'no-interpolated-classes': noInterpolatedClasses,
    'no-unparsed-twig': noUnparsedTwig,
  },
  processors: { twig: createProcessor({ name, version }) },
  configs: {} as { recommended: Linter.Config; drupal: Linter.Config },
} satisfies ESLint.Plugin;

const { getDefaultSelectors } = betterTailwindcss;
const classSelectors = [...getDefaultSelectors(), ...twigSelectors];
const attributeSelectors = getDefaultSelectors().filter((selector) => selector.kind === 'attribute');

const recommended: Linter.Config = {
  name: 'twig-tailwind/recommended',
  files: ['**/*.twig'],
  plugins: { ...betterTailwindcss.plugin.configs.recommended.plugins, 'twig-tailwind': plugin },
  processor: 'twig-tailwind/twig',
  languageOptions: {
    parser: twigParser,
    parserOptions: { ignoreInterpolatedAttributes: ['class'] },
  },
  settings: {
    'better-tailwindcss': { selectors: classSelectors },
  },
  rules: {
    ...betterTailwindcss.plugin.configs.recommended.rules,
    'better-tailwindcss/enforce-consistent-line-wrapping': ['warn', { selectors: attributeSelectors }],
    'twig-tailwind/no-interpolated-attributes': 'error',
    'twig-tailwind/no-interpolated-classes': 'error',
    'twig-tailwind/no-unparsed-twig': 'error',
  },
};

const drupal: Linter.Config = {
  name: 'twig-tailwind/drupal',
  files: ['**/*.twig'],
  settings: {
    'better-tailwindcss': { selectors: [...classSelectors, ...drupalSelectors] },
  },
};

Object.assign(plugin.configs, { recommended, drupal });

export { drupalSelectors } from './selectors/drupal.js';
export { twigSelectors } from './selectors/twig.js';
export type { ClassSelector } from './selectors/class-selector.js';
export default plugin;
