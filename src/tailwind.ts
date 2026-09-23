export type ClassSelector = {
  readonly kind: 'callee' | 'variable';
  readonly name?: string;
  readonly path?: string;
  readonly match: readonly { readonly type: 'strings' | 'objectValues'; readonly path?: string }[];
};

export const twigSelectors: readonly ClassSelector[] = [
  { kind: 'variable', name: '^(?:.*_)?classes$', match: [{ type: 'strings' }] },
  { kind: 'callee', name: '^(?:include|embed)$', match: [{ type: 'objectValues', path: '^classes(?:\\[\\d+\\])?$' }] },
];

export const drupalSelectors: readonly ClassSelector[] = [
  ...twigSelectors,
  { kind: 'callee', path: '^.*\\.(?:addClass|removeClass)$', match: [{ type: 'strings' }] },
  { kind: 'callee', name: '^create_attribute$', match: [{ type: 'objectValues', path: '^class(?:\\[\\d+\\])?$' }] },
];

export const recommendedParserOptions = {
  ignoreInterpolatedAttributes: ['class'],
} as const;
