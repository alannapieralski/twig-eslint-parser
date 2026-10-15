import { readdirSync, readFileSync } from 'node:fs';
import { ESLint, type Linter } from 'eslint';
import { parseForESLint } from 'twig-eslint-parser';
import { describe, expect, it } from 'vitest';
import twigHtml from '../src/index.js';

const parserFixturesDirectory = new URL('../../twig-eslint-parser/test/fixtures/twig/', import.meta.url);
const parserFixtures = readdirSync(parserFixturesDirectory).filter((name) => name.endsWith('.twig')).sort();

const layoutRuleIds = ['twig-html/attrs-newline', 'twig-html/multiline-tag-content'];
const ruleIds = [...layoutRuleIds, 'twig-html/quotes'];
const withoutHtmlWhitespace = (text: string) => text.replace(/[ \t\n\r\f]+/g, '');

const rulesWithOnly = (ruleId: string): Linter.RulesRecord => Object.fromEntries(ruleIds.map((id) => [id, id === ruleId ? 'warn' : 'off']));

function withoutLayoutOrQuoting(code: string): string {
  return code.replace(/[\s\\'"]+/g, '');
}

function describeStrings(code: string) {
  const { strings } = parseForESLint(code).services.twig;
  return { count: strings.length, interpolated: strings.filter((string) => string.isInterpolated).length };
}

async function fixWithOnly(ruleId: string, fixtureName: string) {
  const code = readFileSync(new URL(fixtureName, parserFixturesDirectory), 'utf8');
  const eslint = new ESLint({ overrideConfigFile: true, fix: true, overrideConfig: [twigHtml.configs.recommended, { files: ['**/*.twig'], rules: rulesWithOnly(ruleId) }] });
  const [result] = await eslint.lintText(code, { filePath: fixtureName });
  return { code, output: result?.output ?? code };
}

describe.each(layoutRuleIds)('%s --fix', (ruleId) => {
  it.each(parserFixtures)('only changes whitespace in %s, and the result still parses', async (fixtureName) => {
    const { code, output } = await fixWithOnly(ruleId, fixtureName);
    expect(withoutHtmlWhitespace(output)).toBe(withoutHtmlWhitespace(code));
    expect(() => parseForESLint(output)).not.toThrow();
    expect(parseForESLint(output).services.twig.unconvertedBlocks.length).toBe(parseForESLint(code).services.twig.unconvertedBlocks.length);
  });
});

describe('twig-html/quotes --fix', () => {
  it.each(parserFixtures)('only changes quoting in %s, and the result still parses', async (fixtureName) => {
    const { code, output } = await fixWithOnly('twig-html/quotes', fixtureName);
    expect(withoutLayoutOrQuoting(output)).toBe(withoutLayoutOrQuoting(code));
    expect(() => parseForESLint(output)).not.toThrow();
    expect(parseForESLint(output).services.twig.unconvertedBlocks.length).toBe(parseForESLint(code).services.twig.unconvertedBlocks.length);
    expect(describeStrings(output)).toEqual(describeStrings(code));
  });
});
