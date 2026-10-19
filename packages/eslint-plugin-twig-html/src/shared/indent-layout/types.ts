import type { Range } from '../range.js';
import type { Token } from '../tag-node.js';

export type MarkupNode = {
  readonly type: string;
  readonly range: Range;
  readonly name?: string;
  readonly openStart?: Token;
  readonly openEnd?: Token;
  readonly close?: Token | null;
  readonly children?: readonly MarkupNode[];
  readonly attributes?: readonly { readonly range: Range }[];
};

export type TwigSegment = { readonly range: Range; readonly extent: Range; readonly frameStart: number; readonly frameName: string };

export type OpenTag = {
  readonly start: number;
  readonly attributesStart: number;
  readonly closeBracketStart: number;
  readonly isSelfClosing: boolean;
  readonly firstAttributeColumn: number | undefined;
};

export type IndentLayout = {
  readonly nestings: readonly Range[];
  readonly skipped: readonly Range[];
  readonly openTags: readonly OpenTag[];
  readonly closeTags: readonly Range[];
};

export type LineStart = { readonly lineStart: number; readonly contentStart: number };
