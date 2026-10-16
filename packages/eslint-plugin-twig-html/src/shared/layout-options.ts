export type LayoutOptions = { indent?: number; ignoreInside?: string[] };

export const layoutOptionDefaults: Required<LayoutOptions> = { indent: 2, ignoreInside: ['svg'] };

export const layoutOptionProperties = {
  ignoreInside: { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true },
  indent: { type: 'integer', minimum: 1 },
} as const;
