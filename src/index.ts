import { createRequire } from 'node:module';
import { parseForESLint } from './parse-for-eslint.js';

const { name, version } = createRequire(import.meta.url)('../package.json') as { name: string; version: string };

export const meta = { name, version };

export { parseForESLint };
export type { ParserOptions, TwigParseResult, TwigParserServices, UnconvertedTwigBlock } from './parse-for-eslint.js';
export type { OmittedAttribute } from './attributes.js';
export { TwigSyntaxError } from './twig/tokens.js';

export default { meta, parseForESLint };
