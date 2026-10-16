import { whitespaceSensitiveElements, inlineNonVoidElements } from '../../shared/html-elements.js';
import { layoutOptionDefaults, layoutOptionProperties } from '../../shared/layout-options.js';

export type Options = { indent?: number; ignores?: string[]; ignoreWhenEmpty?: boolean; allowEmptyLines?: boolean };

const defaultOptions: Required<Options> = {
  indent: layoutOptionDefaults.indent,
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
    indent: layoutOptionProperties.indent,
  },
  additionalProperties: false,
} as const;

export function resolveOptions(rawOptions: unknown): Required<Options> {
  return { ...defaultOptions, ...(rawOptions as Options | undefined) };
}
