import twigParser from 'twig-eslint-parser';
import { DRUPAL_SELECTORS } from '../selectors/drupal.js';
import { TWIG_SELECTORS } from '../selectors/twig.js';
import { betterTailwindcss } from './better-tailwindcss.js';
import { parseConfigOptions } from './config-options.js';
import { isAttributeSelector, isStyleVariableSelector } from './default-selectors.js';
import type { ESLint, Linter } from 'eslint';
import type { ConfigOptions } from './config-options.js';

export function createConfigFactory(plugin: ESLint.Plugin): (options?: ConfigOptions) => Linter.Config {
  const defaultSelectors = betterTailwindcss.getDefaultSelectors();
  const attributeSelectors = defaultSelectors.filter(isAttributeSelector);
  const classSelectors = [...defaultSelectors.filter((selector) => !isStyleVariableSelector(selector)), ...TWIG_SELECTORS];

  return (options = {}) => {
    const { drupal, selectors } = parseConfigOptions(options);

    return {
      name: drupal ? 'twig-tailwind/drupal' : 'twig-tailwind/recommended',
      files: ['**/*.twig'],
      plugins: { ...betterTailwindcss.plugin.configs.recommended.plugins, 'twig-tailwind': plugin },
      processor: 'twig-tailwind/twig',
      languageOptions: {
        parser: twigParser,
        parserOptions: { ignoreInterpolatedAttributes: ['class'] },
      },
      settings: {
        'better-tailwindcss': { selectors: [...classSelectors, ...(drupal ? DRUPAL_SELECTORS : []), ...selectors] },
      },
      rules: {
        ...betterTailwindcss.plugin.configs.recommended.rules,
        'better-tailwindcss/enforce-consistent-line-wrapping': ['warn', { selectors: attributeSelectors }],
        'twig-tailwind/no-twig-interpolation': 'warn',
      },
    };
  };
}
