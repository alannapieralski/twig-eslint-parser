import type { ArgumentTarget, CallTarget } from 'eslint-plugin-better-tailwindcss/types';

type ClassMatcher = { readonly type: 'strings' | 'objectKeys' | 'objectValues'; readonly path?: string };

export type ClassSelector = {
  readonly kind: 'attribute' | 'callee' | 'tag' | 'variable';
  readonly name?: string;
  readonly path?: string;
  readonly targetCall?: CallTarget;
  readonly targetArgument?: ArgumentTarget;
  readonly match?: readonly (ClassMatcher | { readonly type: 'anonymousFunctionReturn'; readonly match: readonly ClassMatcher[] })[];
};
