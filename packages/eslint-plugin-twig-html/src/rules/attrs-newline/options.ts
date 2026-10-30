import { ignoresSchema } from '../../shared/ignores.js';

export type CloseStyle = 'newline' | 'sameline';

export type Options = { ifAttrsMoreThan?: number; closeStyle?: CloseStyle; ignores?: string[] };

const defaultOptions: Required<Options> = { ifAttrsMoreThan: 1, closeStyle: 'newline', ignores: ['svg'] };

export const optionsSchema = {
  type: 'object',
  properties: {
    closeStyle: { enum: ['newline', 'sameline'] },
    ifAttrsMoreThan: { type: 'integer', minimum: 0 },
    ignores: ignoresSchema,
  },
  additionalProperties: false,
} as const;

export function resolveOptions(rawOptions: unknown): Required<Options> {
  return { ...defaultOptions, ...(rawOptions as Options | undefined) };
}
