import { readdirSync, readFileSync } from 'node:fs';
import { ESLint, type Linter } from 'eslint';
import { parseForESLint } from 'twig-eslint-parser';
import { describe, expect, it } from 'vitest';
import twigHtml from '../src/index.js';

const parserFixturesDirectory = new URL('../../twig-eslint-parser/test/fixtures/twig/', import.meta.url);
const parserFixtures = readdirSync(parserFixturesDirectory).filter((name) => name.endsWith('.twig')).sort();

const ruleIds = ['twig-html/attrs-newline', 'twig-html/multiline-tag-content'];
const withoutHtmlWhitespace = (text: string) => text.replace(/[ \t\n\r\f]+/g, '');

describe.each(ruleIds)('%s --fix', (ruleId) => {
  const rules: Linter.RulesRecord = Object.fromEntries(ruleIds.map((id) => [id, id === ruleId ? 'warn' : 'off']));

  it.each(parserFixtures)('only changes whitespace in %s, and the result still parses', async (fixtureName) => {
    const code = readFileSync(new URL(fixtureName, parserFixturesDirectory), 'utf8');
    const eslint = new ESLint({ overrideConfigFile: true, fix: true, overrideConfig: [twigHtml.configs.recommended, { files: ['**/*.twig'], rules }] });
    const [result] = await eslint.lintText(code, { filePath: fixtureName });
    const output = result?.output ?? code;
    expect(withoutHtmlWhitespace(output)).toBe(withoutHtmlWhitespace(code));
    expect(() => parseForESLint(output)).not.toThrow();
    expect(parseForESLint(output).services.twig.unconvertedBlocks.length).toBe(parseForESLint(code).services.twig.unconvertedBlocks.length);
  });
});
