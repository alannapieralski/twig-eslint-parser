import { drupalAttributeObjectFunction, drupalClassMethods } from 'twig-eslint-parser';
import type { ClassSelector } from './class-selector.js';

export const drupalSelectors: readonly ClassSelector[] = [
  { kind: 'callee', name: `^(?:${drupalClassMethods.join('|')})$`, match: [{ type: 'strings' }] },
  { kind: 'callee', name: `^${drupalAttributeObjectFunction}$`, match: [{ type: 'objectValues', path: '^class(?:\\[\\d+\\])?$' }] },
];
