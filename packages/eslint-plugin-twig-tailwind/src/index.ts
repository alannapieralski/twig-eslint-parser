import { createRequire } from 'node:module';
import type { ESLint } from 'eslint';
import { createConfigFactory } from './config.js';
import { createProcessor } from './processor.js';
import { noInterpolatedAttributes } from './rules/no-interpolated-attributes.js';
import { noUnparsedTwig } from './rules/no-unparsed-twig.js';

const { name, version } = createRequire(import.meta.url)('../package.json') as { name: string; version: string };

const plugin = {
  meta: { name, version },
  rules: {
    'no-interpolated-attributes': noInterpolatedAttributes,
    'no-unparsed-twig': noUnparsedTwig,
  },
  processors: { twig: createProcessor({ name, version }) },
} satisfies ESLint.Plugin;

export const createConfig = createConfigFactory(plugin);

export { drupalSelectors } from './selectors/drupal.js';
export { twigSelectors } from './selectors/twig.js';
export type { ClassSelector } from './selectors/class-selector.js';
export type { ConfigOptions } from './config.js';
export default Object.assign(plugin, { createConfig, configs: { recommended: createConfig(), drupal: createConfig({ drupal: true }) } });
