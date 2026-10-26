import type { betterTailwindcss } from './better-tailwindcss.js';

type DefaultSelector = ReturnType<typeof betterTailwindcss.getDefaultSelectors>[number];

const STYLE_VARIABLE_NAMES = ['style', 'styles'];

export const isAttributeSelector = (selector: DefaultSelector) => selector.kind === 'attribute';

export const isStyleVariableSelector = (selector: DefaultSelector) =>
  selector.kind === 'variable' && STYLE_VARIABLE_NAMES.some((variableName) => new RegExp(selector.name).test(variableName));
