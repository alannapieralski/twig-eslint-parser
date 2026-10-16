import { whitespaceSensitiveElements, inlineNonVoidElements } from '../../shared/html-elements.js';

export type Options = { ignores?: string[]; ignoreWhenEmpty?: boolean; allowEmptyLines?: boolean };

const defaultOptions: Required<Options> = {
  ignores: [...whitespaceSensitiveElements, ...inlineNonVoidElements],
  ignoreWhenEmpty: true,
  allowEmptyLines: false,
};

export const optionsSchema = {
  type: 'object',
  properties: {
    allowEmptyLines: { type: 'boolean' },
    ignoreWhenEmpty: { type: 'boolean' },
    ignores: { type: 'array', items: { type: 'string' }, uniqueItems: true },
  },
  additionalProperties: false,
} as const;

export function resolveOptions(rawOptions: unknown): Required<Options> {
  return { ...defaultOptions, ...(rawOptions as Options | undefined) };
}
