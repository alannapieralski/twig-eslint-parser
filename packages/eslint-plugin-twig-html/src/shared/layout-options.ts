export type LayoutOptions = { ignoreInside?: string[] };

export const layoutOptionDefaults: Required<LayoutOptions> = { ignoreInside: ['svg'] };

export const layoutOptionProperties = {
  ignoreInside: { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true },
} as const;
