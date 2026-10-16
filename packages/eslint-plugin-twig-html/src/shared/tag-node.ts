import type { Range } from './range.js';

export type Token = { readonly range: Range; readonly value: string };

export type ParsedTag = {
  readonly name?: string;
  readonly openStart: Token;
  readonly openEnd?: Token;
  readonly close?: Token | null;
  readonly attributes: readonly { readonly range: Range }[];
};

export type TagNode = ParsedTag & { readonly openEnd: Token };

export const tagNodeTypes: readonly string[] = ['Tag', 'ScriptTag', 'StyleTag'];
