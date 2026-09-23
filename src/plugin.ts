import type { ESLint } from 'eslint';
import { meta } from './index.js';
import { noInterpolatedAttributes } from './rules/no-interpolated-attributes.js';

const plugin: ESLint.Plugin = {
  meta: { name: `${meta.name}/plugin`, version: meta.version },
  rules: { 'no-interpolated-attributes': noInterpolatedAttributes },
};

export default plugin;
