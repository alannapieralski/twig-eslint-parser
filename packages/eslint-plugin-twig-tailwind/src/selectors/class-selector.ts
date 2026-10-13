export type ClassSelector = {
  readonly kind: 'callee' | 'variable';
  readonly name?: string;
  readonly path?: string;
  readonly match: readonly { readonly type: 'strings' | 'objectValues'; readonly path?: string }[];
};
