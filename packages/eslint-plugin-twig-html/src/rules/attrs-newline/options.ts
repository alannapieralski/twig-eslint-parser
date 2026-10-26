import { layoutOptionDefaults, layoutOptionProperties } from '../../shared/layout-options.js';
import type { LayoutOptions } from '../../shared/layout-options.js';

export type CloseStyle = 'newline' | 'sameline';

export type Options = LayoutOptions & { ifAttrsMoreThan?: number; closeStyle?: CloseStyle };

const defaultOptions: Required<Options> = { ifAttrsMoreThan: 1, closeStyle: 'newline', ...layoutOptionDefaults };

export const optionsSchema = {
  type: 'object',
  properties: {
    closeStyle: { enum: ['newline', 'sameline'] },
    ifAttrsMoreThan: { type: 'integer', minimum: 0 },
    ...layoutOptionProperties,
  },
  additionalProperties: false,
} as const;

export function resolveOptions(rawOptions: unknown): Required<Options> {
  return { ...defaultOptions, ...(rawOptions as Options | undefined) };
}
