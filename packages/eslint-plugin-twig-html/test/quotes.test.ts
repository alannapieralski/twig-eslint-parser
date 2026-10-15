import { ESLint, type Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import twigHtml from '../src/index.js';

type LintSettings = { fix?: boolean; extraConfig?: Linter.Config[] };

async function lint(code: string, ruleOptions?: Record<string, unknown>, { fix = true, extraConfig = [] }: LintSettings = {}) {
  const rules: Linter.RulesRecord = { 'twig-html/attrs-newline': 'off', ...(ruleOptions && { 'twig-html/quotes': ['warn', ruleOptions] }) };
  const eslint = new ESLint({ overrideConfigFile: true, fix, overrideConfig: [twigHtml.configs.recommended, ...extraConfig, { files: ['**/*.twig'], rules }] });
  const [result] = await eslint.lintText(code, { filePath: 'template.html.twig' });
  if (!result) throw new Error('ESLint returned no result.');
  return { output: result.output ?? code, messages: result.messages };
}

async function fixed(code: string, ruleOptions?: Record<string, unknown>): Promise<string> {
  return (await lint(code, ruleOptions)).output;
}

async function reportedLines(code: string): Promise<number[]> {
  return (await lint(code, undefined, { fix: false })).messages.map((message) => message.line);
}

describe('twig-html/quotes', () => {
  describe('HTML attribute values', () => {
    it('uses double quotes by default', async () => {
      expect(await fixed("<a class='flex' href='/'>x</a>")).toBe('<a class="flex" href="/">x</a>');
    });

    it('uses single quotes when asked', async () => {
      expect(await fixed('<a class="flex">x</a>', { html: 'single' })).toBe("<a class='flex'>x</a>");
    });

    it('leaves a value containing the wanted quote alone, since it would need an escape', async () => {
      const code = `<a title='say "hi"' onclick='go("{{ id }}")'>x</a>`;
      expect((await lint(code)).messages).toEqual([]);
    });

    it('reads the quote of an empty value', async () => {
      expect(await fixed("<img alt=''>")).toBe('<img alt="">');
    });

    it('ignores quotes inside Twig blocks, which HTML never reads', async () => {
      expect(await fixed(`<a class='{{ "a" }}'>x</a>`, { html: 'double', twig: 'double' })).toBe('<a class="{{ "a" }}">x</a>');
      expect(await fixed(`<a class="{{ 'a' }}">x</a>`, { html: 'single', twig: 'single' })).toBe(`<a class='{{ 'a' }}'>x</a>`);
    });

    it.each([
      ['double', 'single', `<a class="{{ 'a' }}">x</a>`],
      ['single', 'double', `<a class='{{ "a" }}'>x</a>`],
    ])('keeps html: %s and twig: %s apart', async (html, twig, code) => {
      expect((await lint(code, { html, twig })).messages).toEqual([]);
    });

    it('wraps unquoted values, with or without Twig', async () => {
      expect(await fixed('<a class=flex data-id={{ id }}>x</a>')).toBe('<a class="flex" data-id="{{ id }}">x</a>');
    });

    it('reports an unquoted value holding quotes without fixing it', async () => {
      const code = `<p class={% if a %}"a"{% else %}'b'{% endif %}>x</p>`;
      const { output, messages } = await lint(code);
      expect(output).toBe(code);
      expect(messages.map((message) => message.messageId)).toEqual(['missingHtmlQuote']);
    });

    it('wraps only plain text or a single Twig print, since other Twig may print attributes of its own', async () => {
      const code = '<p data-a=x-{{ id }} data-b={{ theme }}{{ extra_attributes }} data-c={% if a %}b{% endif %}>x</p>';
      const { output, messages } = await lint(code);
      expect(output).toBe(code);
      expect(messages.map((message) => message.messageId)).toEqual(['missingHtmlQuote', 'missingHtmlQuote', 'missingHtmlQuote']);
    });

    it('does not wrap an unquoted value the markup reader may have cut short at a slash', async () => {
      const code = '<a href=a/b>x</a><input value=a/>';
      expect(await fixed(code)).toBe(code);
    });

    it('reports but does not fix a value that opens a Twig block another attribute closes', async () => {
      const code = `<p class='a{% if x %}' data-x='{% endif %}'>x</p>`;
      const { output, messages } = await lint(code);
      expect(output).toBe(code);
      expect(messages.map((message) => message.messageId)).toEqual(['wrongHtmlQuote', 'wrongHtmlQuote']);
    });

    it('reports but does not swap the quotes of a value printing Twig through |raw, which is never escaped', async () => {
      const code = "<p data-config='{{ config|json_encode|raw }}'>x</p>";
      const { output, messages } = await lint(code);
      expect(output).toBe(code);
      expect(messages.map((message) => message.messageId)).toEqual(['wrongHtmlQuote']);
    });

    it('fixes a value that holds a whole Twig block', async () => {
      expect(await fixed(`<p class='a {% if x %}b{% endif %}'>x</p>`)).toBe('<p class="a {% if x %}b{% endif %}">x</p>');
    });

    it('leaves attributes without a value, and Drupal attribute prints, alone', async () => {
      expect((await lint('<input disabled {{ attributes }}>')).messages).toEqual([]);
    });

    it('checks script and style tags', async () => {
      expect(await fixed("<script src='/a.js'></script><style media='print'></style>")).toBe('<script src="/a.js"></script><style media="print"></style>');
    });

    it('leaves quotes in text, comments, scripts, styles and raw text alone', async () => {
      const code = `<p>it's "quoted"</p><!-- 'x' --><script>var a = "b";</script><style>a::after { content: "x"; }</style><textarea>a='b'</textarea>`;
      expect((await lint(code)).messages).toEqual([]);
    });

    it('still checks class attributes left out by ignoreInterpolatedAttributes', async () => {
      const ignoreClass: Linter.Config = { files: ['**/*.twig'], languageOptions: { parserOptions: { ignoreInterpolatedAttributes: ['class'] } } };
      const { output } = await lint("<p class='a {{ b }}'>x</p>", undefined, { extraConfig: [ignoreClass] });
      expect(output).toBe('<p class="a {{ b }}">x</p>');
    });
  });

  describe('Twig strings', () => {
    it('uses single quotes by default', async () => {
      expect(await fixed('{{ "a" ~ "b"|trim }}')).toBe("{{ 'a' ~ 'b'|trim }}");
    });

    it('uses double quotes when asked', async () => {
      expect(await fixed("{% set a = 'b' %}", { twig: 'double' })).toBe('{% set a = "b" %}');
    });

    it('checks tags that never become JavaScript, and hash keys', async () => {
      const code = '{% extends "base.html.twig" %}{% import "m.twig" as m %}{% trans with {"%n%": n} %}x{% endtrans %}{% cache "k" %}{% endcache %}';
      expect(await fixed(code)).toBe("{% extends 'base.html.twig' %}{% import 'm.twig' as m %}{% trans with {'%n%': n} %}x{% endtrans %}{% cache 'k' %}{% endcache %}");
    });

    it('drops escapes the new quote no longer needs', async () => {
      expect(await fixed(`{{ 'it\\'s' }}`, { twig: 'double' })).toBe(`{{ "it's" }}`);
      expect(await fixed(`{{ "say \\"hi\\"" }}`)).toBe(`{{ 'say "hi"' }}`);
    });

    it('keeps other escapes as they are', async () => {
      expect(await fixed(`{{ "tab\\there \\\\ \\x41" }}`)).toBe(`{{ 'tab\\there \\\\ \\x41' }}`);
    });

    it('leaves strings that would need a new escape alone', async () => {
      expect((await lint(`{{ "it's" }}`)).messages).toEqual([]);
      expect((await lint(`{{ 'say "hi"' }}`, { twig: 'double' })).messages).toEqual([]);
    });

    it('never moves interpolation in or out of a string', async () => {
      expect((await lint('{{ "a #{b}" }}')).messages).toEqual([]);
      expect((await lint("{{ 'a #{b}' }}", { twig: 'double' })).messages).toEqual([]);
      expect(await fixed('{{ "a \\#{b}" }}')).toBe("{{ 'a \\#{b}' }}");
    });

    it('checks strings inside an interpolation on their own', async () => {
      expect(await fixed('{{ "a #{ b ~ "c" }" }}')).toBe(`{{ "a #{ b ~ 'c' }" }}`);
    });

    it('checks Twig inside script, style and HTML comments, but not Twig comments or verbatim', async () => {
      const code = '<script>var a = {{ "x"|json_encode }};</script><!-- {{ "y" }} -->{# "z" #}{% verbatim %}{{ "v" }}{% endverbatim %}';
      expect(await reportedLines(code)).toEqual([1, 1]);
      expect(await fixed(code)).toBe(`<script>var a = {{ 'x'|json_encode }};</script><!-- {{ 'y' }} -->{# "z" #}{% verbatim %}{{ "v" }}{% endverbatim %}`);
    });

    it('checks strings that span lines', async () => {
      expect(await fixed('{{ "a\nb" }}')).toBe("{{ 'a\nb' }}");
    });
  });
});
