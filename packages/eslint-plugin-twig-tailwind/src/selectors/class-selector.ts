export type ClassSelector = {
  readonly kind: 'attribute' | 'callee' | 'tag' | 'variable';
  readonly name?: string;
  readonly path?: string;
  readonly match?: readonly { readonly type: 'strings' | 'objectKeys' | 'objectValues'; readonly path?: string }[];
};
