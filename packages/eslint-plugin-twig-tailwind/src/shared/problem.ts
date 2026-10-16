import type { Range } from './range.js';

export type Edit = { readonly range: Range; readonly text: string };

export type Problem = {
  readonly range: Range;
  readonly messageId: string;
  readonly data: Record<string, string>;
  readonly edits?: readonly Edit[];
};
