import { readdirSync, readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { parseForESLint } from 'twig-eslint-parser';
import { describe, expect, it } from 'vitest';
import twigHtml from '../src/index.js';

const parserFixturesDirectory = new URL('../../twig-eslint-parser/test/fixtures/twig/', import.meta.url);
const parserFixtures = readdirSync(parserFixturesDirectory).filter((name) => name.endsWith('.twig')).sort();

describe('twig-html/attrs-newline --fix', () => {
  it.each(parserFixtures)('only changes whitespace in %s, and the result still parses', async (fixtureName) => {
    const code = readFileSync(new URL(fixtureName, parserFixturesDirectory), 'utf8');
    const eslint = new ESLint({ overrideConfigFile: true, fix: true, overrideConfig: [twigHtml.configs.recommended] });
    const [result] = await eslint.lintText(code, { filePath: fixtureName });
    const output = result?.output ?? code;
    expect(output.replace(/\s+/g, '')).toBe(code.replace(/\s+/g, ''));
    expect(() => parseForESLint(output)).not.toThrow();
    expect(parseForESLint(output).services.twig.unconvertedBlocks.length).toBe(parseForESLint(code).services.twig.unconvertedBlocks.length);
  });
});
