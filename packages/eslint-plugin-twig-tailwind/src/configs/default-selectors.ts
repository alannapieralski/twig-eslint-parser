import { betterTailwindcss } from './better-tailwindcss.js';

type DefaultSelector = ReturnType<typeof betterTailwindcss.getDefaultSelectors>[number];

const styleVariableNames = ['style', 'styles'];

export const isAttributeSelector = (selector: DefaultSelector) => selector.kind === 'attribute';

export const isStyleVariableSelector = (selector: DefaultSelector) =>
  selector.kind === 'variable' && styleVariableNames.some((variableName) => new RegExp(selector.name).test(variableName));
