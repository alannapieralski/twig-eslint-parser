import type { ClassSelector } from './class-selector.js';

const classesName = '(?:(?:.*_)?class(?:es)?|[a-z]\\w*Class(?:es)?)';

export const twigSelectors: readonly ClassSelector[] = [
  { kind: 'variable', name: `^${classesName}$`, match: [{ type: 'strings' }] },
  { kind: 'callee', name: '^\\w+$', match: [{ type: 'objectValues', path: `^(?:.*\\.)?${classesName}(?:\\[\\d+\\])?$` }] },
  { kind: 'callee', path: `^${classesName}\\.merge$`, match: [{ type: 'strings' }] },
];
