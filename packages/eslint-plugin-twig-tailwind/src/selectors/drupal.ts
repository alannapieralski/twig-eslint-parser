import type { ClassSelector } from './class-selector.js';

const DRUPAL_CLASS_METHODS: readonly string[] = ['addClass', 'removeClass'];

export const DRUPAL_SELECTORS: readonly ClassSelector[] = [
  { kind: 'callee', name: `^(?:${DRUPAL_CLASS_METHODS.join('|')})$`, match: [{ type: 'strings' }] },
];
