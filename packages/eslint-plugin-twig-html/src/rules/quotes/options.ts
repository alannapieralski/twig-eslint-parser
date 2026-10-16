export type QuoteStyle = 'single' | 'double';

export type Options = { html?: QuoteStyle; twig?: QuoteStyle };

const defaultOptions: Required<Options> = { html: 'double', twig: 'single' };

export const optionsSchema = {
  type: 'object',
  properties: {
    html: { enum: ['single', 'double'] },
    twig: { enum: ['single', 'double'] },
  },
  additionalProperties: false,
} as const;

export function resolveOptions(rawOptions: unknown): Required<Options> {
  return { ...defaultOptions, ...(rawOptions as Options | undefined) };
}
