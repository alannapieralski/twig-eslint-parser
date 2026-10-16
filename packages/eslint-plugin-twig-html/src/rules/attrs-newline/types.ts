import type { Range } from '../../shared/range.js';

export type AttributeSeparator = { readonly range: Range; readonly expected: string; readonly isClosing: boolean; readonly isLineBreak: boolean };
