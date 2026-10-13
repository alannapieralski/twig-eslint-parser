import type { ClassSelector } from './class-selector.js';

export const drupalSelectors: readonly ClassSelector[] = [
  { kind: 'callee', name: '^(?:addClass|removeClass)$', match: [{ type: 'strings' }] },
  { kind: 'callee', name: '^create_attribute$', match: [{ type: 'objectValues', path: '^class(?:\\[\\d+\\])?$' }] },
];
