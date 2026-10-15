import { readdirSync, readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { parseForESLint } from 'twig-eslint-parser';
import { describe, expect, it } from 'vitest';
import twigHtml from '../src/index.js';

const parserFixturesDirectory = new URL('../../twig-eslint-parser/test/fixtures/twig/', import.meta.url);
const parserFixtures = readdirSync(parserFixturesDirectory).filter((name) => name.endsWith('.twig')).sort();

function withoutLayoutOrQuoting(code: string): string {
  return code.replace(/[\s\\'"]+/g, '');
}

function describeStrings(code: string) {
  const { strings } = parseForESLint(code).services.twig;
  return { count: strings.length, interpolated: strings.filter((string) => string.isInterpolated).length };
}

describe('twig-html/recommended --fix', () => {
  it.each(parserFixtures)('only changes whitespace and quoting in %s, and the result still parses', async (fixtureName) => {
    const code = readFileSync(new URL(fixtureName, parserFixturesDirectory), 'utf8');
    const eslint = new ESLint({ overrideConfigFile: true, fix: true, overrideConfig: [twigHtml.configs.recommended] });
    const [result] = await eslint.lintText(code, { filePath: fixtureName });
    const output = result?.output ?? code;
    expect(withoutLayoutOrQuoting(output)).toBe(withoutLayoutOrQuoting(code));
    expect(() => parseForESLint(output)).not.toThrow();
    expect(parseForESLint(output).services.twig.unconvertedBlocks.length).toBe(parseForESLint(code).services.twig.unconvertedBlocks.length);
    expect(describeStrings(output)).toEqual(describeStrings(code));
  });
});
