import { ignoresSchema } from './ignores.js';

export type LayoutOptions = { ignores?: string[] };

export const layoutOptionDefaults: Required<LayoutOptions> = { ignores: ['svg'] };

export const layoutOptionProperties = {
  ignores: ignoresSchema,
} as const;
