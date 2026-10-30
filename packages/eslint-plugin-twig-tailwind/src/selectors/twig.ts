import type { ClassSelector } from './class-selector.js';

const CLASSES_NAME = '(?:(?:.*_)?class(?:es)?|[a-z]\\w*Class(?:es)?)';

export const TWIG_SELECTORS: readonly ClassSelector[] = [
  { kind: 'variable', name: `^${CLASSES_NAME}$`, match: [{ type: 'strings' }] },
  { kind: 'callee', name: '^\\w+$', match: [{ type: 'objectValues', path: `^(?:.*\\.)?${CLASSES_NAME}(?:\\[\\d+\\])?$` }] },
  { kind: 'callee', path: `^${CLASSES_NAME}\\.merge$`, match: [{ type: 'strings' }] },
];
