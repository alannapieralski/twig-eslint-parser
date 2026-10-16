import type { ESLint, Linter } from 'eslint';
import twigParser from 'twig-eslint-parser';
import { betterTailwindcss } from './better-tailwindcss.js';
import type { ClassSelector } from './selectors/class-selector.js';
import { drupalSelectors } from './selectors/drupal.js';
import { twigSelectors } from './selectors/twig.js';

export type ConfigOptions = {
  readonly drupal?: boolean;
  readonly selectors?: readonly ClassSelector[];
};

type DefaultSelector = ReturnType<typeof betterTailwindcss.getDefaultSelectors>[number];

const knownOptionNames: ReadonlySet<string> = new Set(['drupal', 'selectors']);

const selectorKinds: ReadonlySet<unknown> = new Set(['attribute', 'callee', 'tag', 'variable']);

const isStyleVariableSelector = (selector: DefaultSelector) =>
  selector.kind === 'variable' && ['style', 'styles'].some((variableName) => new RegExp(selector.name).test(variableName));

const isSelector = (value: unknown) => typeof value === 'object' && value !== null && selectorKinds.has((value as { kind?: unknown }).kind);

function parseConfigOptions(options: unknown): Required<ConfigOptions> {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new TypeError('createConfig() takes an options object, such as { drupal: true }.');
  }
  const unknownNames = Object.keys(options).filter((optionName) => !knownOptionNames.has(optionName));
  if (unknownNames.length > 0) throw new TypeError(`createConfig() has no option named ${unknownNames.join(', ')}. Its options are drupal and selectors.`);

  const { drupal = false, selectors = [] } = options as ConfigOptions;
  if (typeof drupal !== 'boolean') throw new TypeError('createConfig() option "drupal" must be true or false.');
  if (!Array.isArray(selectors) || !selectors.every(isSelector)) throw new TypeError('createConfig() option "selectors" must be an array of better-tailwindcss selectors.');
  return { drupal, selectors };
}

export function createConfigFactory(plugin: ESLint.Plugin): (options?: ConfigOptions) => Linter.Config {
  const defaultSelectors = betterTailwindcss.getDefaultSelectors();
  const attributeSelectors = defaultSelectors.filter((selector) => selector.kind === 'attribute');
  const classSelectors = [...defaultSelectors.filter((selector) => !isStyleVariableSelector(selector)), ...twigSelectors];

  return (options = {}) => {
    const { drupal, selectors } = parseConfigOptions(options);
    return {
      name: 'twig-tailwind/recommended',
      files: ['**/*.twig'],
      plugins: { ...betterTailwindcss.plugin.configs.recommended.plugins, 'twig-tailwind': plugin },
      processor: 'twig-tailwind/twig',
      languageOptions: {
        parser: twigParser,
        parserOptions: { ignoreInterpolatedAttributes: ['class'] },
      },
      settings: {
        'better-tailwindcss': { selectors: [...classSelectors, ...(drupal ? drupalSelectors : []), ...selectors] },
      },
      rules: {
        ...betterTailwindcss.plugin.configs.recommended.rules,
        'better-tailwindcss/enforce-consistent-line-wrapping': ['warn', { selectors: attributeSelectors }],
        'twig-tailwind/no-interpolated-attributes': 'error',
        'twig-tailwind/no-unparsed-twig': 'error',
      },
    };
  };
}
