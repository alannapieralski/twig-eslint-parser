export type TwigParserOptions = {
  readonly ignoreInterpolatedAttributes: ReadonlySet<string>;
};

function parseAttributeNames(value: unknown): ReadonlySet<string> {
  if (value === undefined) return new Set();
  if (!Array.isArray(value) || !value.every((name) => typeof name === 'string' && name !== '')) {
    throw new TypeError(`twig-eslint-parser: parserOptions.ignoreInterpolatedAttributes must be an array of attribute names, received ${JSON.stringify(value)}.`);
  }
  return new Set(value.map((name) => name.toLowerCase()));
}

export function parseTwigParserOptions(options: Record<string, unknown>): TwigParserOptions {
  return { ignoreInterpolatedAttributes: parseAttributeNames(options['ignoreInterpolatedAttributes']) };
}
