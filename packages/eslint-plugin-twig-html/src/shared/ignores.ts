export const ignoresSchema = { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true } as const;

export function elementNameSet(names: readonly string[]): ReadonlySet<string> {
  return new Set(names.map((name) => name.toLowerCase()));
}
