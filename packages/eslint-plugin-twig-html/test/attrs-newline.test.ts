import { ESLint, type Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import twigHtml from '../src/index.js';

async function lint(code: string, ruleOptions?: Record<string, unknown>) {
  const rules: Linter.RulesRecord = ruleOptions ? { 'twig-html/attrs-newline': ['warn', ruleOptions] } : {};
  const eslint = new ESLint({ overrideConfigFile: true, fix: true, overrideConfig: [twigHtml.configs.recommended, { files: ['**/*.twig'], rules }] });
  const [result] = await eslint.lintText(code, { filePath: 'template.html.twig' });
  if (!result) throw new Error('ESLint returned no result.');
  return { output: result.output ?? code, messages: result.messages };
}

async function fixed(code: string, ruleOptions?: Record<string, unknown>): Promise<string> {
  return (await lint(code, ruleOptions)).output;
}

describe('twig-html/attrs-newline', () => {
  it('puts each of three attributes on its own line, indented one step from the tag, with > back at the tag', async () => {
    expect(await fixed('<button type="button" class="flex" data-js-toggle>x</button>')).toBe(
      '<button\n  type="button"\n  class="flex"\n  data-js-toggle\n>x</button>',
    );
  });

  it('leaves tags with two attributes alone', async () => {
    const code = '<a href="{{ url }}" class="flex w-full items-center justify-center gap-4 overflow-hidden">x</a>';
    expect((await lint(code)).messages).toEqual([]);
  });

  it('indents from the line the tag starts on, inside Twig blocks', async () => {
    const code = '{% for item in items %}\n    <li class="a" id="{{ item.id }}" role="listitem">{{ item }}</li>\n{% endfor %}';
    expect(await fixed(code)).toBe(
      '{% for item in items %}\n    <li\n      class="a"\n      id="{{ item.id }}"\n      role="listitem"\n    >{{ item }}</li>\n{% endfor %}',
    );
  });

  it.each([
    ["<nav{{ attributes|without('role') }} role=\"navigation\" aria-labelledby=\"a\">x</nav>", "<nav\n  {{ attributes|without('role') }}\n  role=\"navigation\"\n  aria-labelledby=\"a\"\n>x</nav>"],
    ['<legend{{ legend.attributes }} class="a" id="b">x</legend>', '<legend\n  {{ legend.attributes }}\n  class="a"\n  id="b"\n>x</legend>'],
    ["<div{{ create_attribute({'id': 'a'}) }} class=\"b\" role=\"c\">x</div>", "<div\n  {{ create_attribute({'id': 'a'}) }}\n  class=\"b\"\n  role=\"c\"\n>x</div>"],
  ])('counts Drupal attributes printed straight after the tag name as an attribute, and moves them to their own line: %s', async (code, expected) => {
    expect(await fixed(code)).toBe(expected);
  });

  it('does not report Drupal attributes plus one more attribute', async () => {
    expect((await lint('<div{{ attributes }} id="a">x</div>')).messages).toEqual([]);
  });

  it('treats Twig inside a tag name as part of the name, never as an attribute', async () => {
    expect((await lint('<h{{ level }} class="a" id="b">x</h{{ level }}>')).messages).toEqual([]);
    expect(await fixed('<h{{ level }} class="a" id="b" role="c">x</h{{ level }}>')).toBe('<h{{ level }}\n  class="a"\n  id="b"\n  role="c"\n>x</h{{ level }}>');
  });

  it('leaves tags whose whole name is Twig alone, since they are not parsed as tags', async () => {
    const code = '<{{ html_element }} class="a" id="b" role="c">x</{{ html_element }}>';
    expect(await lint(code)).toEqual({ output: code, messages: [] });
  });

  it('puts /> of a self-closing tag on its own line', async () => {
    expect(await fixed('<img src="{{ src }}" alt="" loading="lazy" />')).toBe('<img\n  src="{{ src }}"\n  alt=""\n  loading="lazy"\n/>');
  });

  it('keeps a Twig block that spans several attributes together as one attribute', async () => {
    const code = '<input {% if checked %}checked disabled{% endif %} type="checkbox" name="a">';
    expect(await fixed(code)).toBe('<input\n  {% if checked %}checked disabled{% endif %}\n  type="checkbox"\n  name="a"\n>');
  });

  it('does not count a Twig block spanning attributes as more than one', async () => {
    expect((await lint('<input {% if checked %}checked disabled{% endif %} type="checkbox">')).messages).toEqual([]);
  });

  it('keeps multi-line attribute values as they are', async () => {
    const code = '<p class="a\n  b" id="c" role="d">x</p>';
    expect(await fixed(code)).toBe('<p\n  class="a\n  b"\n  id="c"\n  role="d"\n>x</p>');
  });

  it('fixes attributes that are on their own lines but aligned rather than indented', async () => {
    const code = '<button type="button"\n        class="flex"\n        data-js-toggle>x</button>';
    expect(await fixed(code)).toBe('<button\n  type="button"\n  class="flex"\n  data-js-toggle\n>x</button>');
  });

  it('accepts a tag that is already laid out correctly', async () => {
    expect((await lint('  <button\n    type="button"\n    class="flex"\n    data-js-toggle\n  >x</button>')).messages).toEqual([]);
  });

  it('reports but does not fix a tag with a Twig comment between attributes, so the comment is never lost', async () => {
    const code = '<div class="a" {# note #} id="b" role="c">x</div>';
    const result = await lint(code);
    expect(result.output).toBe(code);
    expect(result.messages.map((message) => message.ruleId)).toEqual(['twig-html/attrs-newline']);
  });

  it('checks <script> and <style> tags too', async () => {
    expect(await fixed('<script src="a.js" type="module" defer></script>')).toBe('<script\n  src="a.js"\n  type="module"\n  defer\n></script>');
  });

  it('can keep > on the line of the last attribute', async () => {
    expect(await fixed('<a href="#" class="a" id="b">x</a>', { closeStyle: 'sameline' })).toBe('<a\n  href="#"\n  class="a"\n  id="b">x</a>');
    expect(await fixed('<img src="a" alt="" loading="lazy" />', { closeStyle: 'sameline' })).toBe('<img\n  src="a"\n  alt=""\n  loading="lazy" />');
  });

  it('can change the attribute threshold and the indent size', async () => {
    expect((await lint('<a href="#" class="a" id="b">x</a>', { ifAttrsMoreThan: 3 })).messages).toEqual([]);
    expect(await fixed('<a href="#" class="a" id="b">x</a>', { indent: 4 })).toBe('<a\n    href="#"\n    class="a"\n    id="b"\n>x</a>');
  });

  it('indents with tabs when the tag is indented with tabs', async () => {
    expect(await fixed('\t<a href="#" class="a" id="b">x</a>')).toBe('\t<a\n\t\thref="#"\n\t\tclass="a"\n\t\tid="b"\n\t>x</a>');
  });
});
