import type { ClassSelector } from './class-selector.js';

export const twigSelectors: readonly ClassSelector[] = [
  { kind: 'variable', name: '^(?:.*_)?classes$', match: [{ type: 'strings' }] },
  { kind: 'callee', name: '^(?:include|embed)$', match: [{ type: 'objectValues', path: '^classes(?:\\[\\d+\\])?$' }] },
];
