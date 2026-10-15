import { ESLint, type Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import twigHtml from '../src/index.js';

async function lint(code: string, ruleOptions?: Record<string, unknown>) {
  const rules: Linter.RulesRecord = {
    'twig-html/attrs-newline': 'off',
    'twig-html/quotes': 'off',
    'twig-html/multiline-tag-content': ruleOptions ? ['warn', ruleOptions] : 'warn',
  };
  const eslint = new ESLint({ overrideConfigFile: true, fix: true, overrideConfig: [twigHtml.configs.recommended, { files: ['**/*.twig'], rules }] });
  const [result] = await eslint.lintText(code, { filePath: 'template.html.twig' });
  if (!result) throw new Error('ESLint returned no result.');
  return { output: result.output ?? code, messages: result.messages };
}

async function fixed(code: string, ruleOptions?: Record<string, unknown>): Promise<string> {
  return (await lint(code, ruleOptions)).output;
}

describe('twig-html/multiline-tag-content', () => {
  it('moves text onto its own line when the opening tag spans several lines', async () => {
    expect(await fixed('<h2\n  id="system-breadcrumb"\n  class="sr-only"\n>You are here:</h2>')).toBe(
      '<h2\n  id="system-breadcrumb"\n  class="sr-only"\n>\n  You are here:\n</h2>',
    );
  });

  it('leaves an empty tag as >< when its opening tag spans several lines', async () => {
    const code = '<div\n  class="swiper-pagination"\n  data-js-gallery-pagination\n></div>';
    expect((await lint(code)).messages).toEqual([]);
  });

  it('leaves a tag with whitespace-only content alone', async () => {
    const code = '<div\n  class="a"\n  id="b"\n>\n</div>';
    expect((await lint(code)).messages).toEqual([]);
  });

  it('leaves a tag whose opening tag is on one line alone, whatever it contains', async () => {
    const code = '<h2 id="a" class="b">text</h2>\n<div class="a"><p>x</p></div>';
    expect((await lint(code)).messages).toEqual([]);
  });

  it('moves child elements and Twig onto their own lines', async () => {
    expect(await fixed('<ul\n  class="a"\n  id="b"\n><li>{{ item }}</li></ul>')).toBe('<ul\n  class="a"\n  id="b"\n>\n  <li>{{ item }}</li>\n</ul>');
    expect(await fixed('<p\n  class="a"\n  id="b"\n>{{ text }}</p>')).toBe('<p\n  class="a"\n  id="b"\n>\n  {{ text }}\n</p>');
  });

  it('breaks only the side that is wrong', async () => {
    expect(await fixed('<p\n  class="a"\n  id="b"\n>\n  text</p>')).toBe('<p\n  class="a"\n  id="b"\n>\n  text\n</p>');
    expect(await fixed('<p\n  class="a"\n  id="b"\n>text\n</p>')).toBe('<p\n  class="a"\n  id="b"\n>\n  text\n</p>');
  });

  it('accepts a tag that is already laid out correctly, whatever the indentation of its content', async () => {
    expect((await lint('  <p\n    class="a"\n    id="b"\n  >\n    text\n  </p>')).messages).toEqual([]);
    expect((await lint('<p\n  class="a"\n  id="b"\n>\n      text\n</p>')).messages).toEqual([]);
  });

  it('indents from the line the tag starts on', async () => {
    const code = '{% if x %}\n    <p\n      class="a"\n      id="b"\n    >{{ text }}</p>\n{% endif %}';
    expect(await fixed(code)).toBe('{% if x %}\n    <p\n      class="a"\n      id="b"\n    >\n      {{ text }}\n    </p>\n{% endif %}');
  });

  it('works with attrs-newline: one pass lays out the attributes, the next the content', async () => {
    const eslint = new ESLint({ overrideConfigFile: true, fix: true, overrideConfig: [twigHtml.configs.recommended] });
    const [result] = await eslint.lintText('<h2 id="a" class="b">You are here:</h2>', { filePath: 'template.html.twig' });
    expect(result?.output).toBe('<h2\n  id="a"\n  class="b"\n>\n  You are here:\n</h2>');
  });

  it('only nests the first line break for a tag with a single attribute that is already multi-line', async () => {
    expect(await fixed('<h2\n  id="a">x</h2>')).toBe('<h2\n  id="a">\n  x\n</h2>');
  });

  it('keeps Windows line endings', async () => {
    expect(await fixed('<p\r\n  class="a"\r\n  id="b"\r\n>text</p>')).toBe('<p\r\n  class="a"\r\n  id="b"\r\n>\r\n  text\r\n</p>');
  });

  it('indents with tabs when the tag is indented with tabs', async () => {
    expect(await fixed('\t<p\n\t\tclass="a"\n\t\tid="b"\n\t>text</p>')).toBe('\t<p\n\t\tclass="a"\n\t\tid="b"\n\t>\n\t\ttext\n\t</p>');
  });

  it('can change the indent size', async () => {
    expect(await fixed('<p\n  class="a"\n  id="b"\n>text</p>', { indent: 4 })).toBe('<p\n  class="a"\n  id="b"\n>\n    text\n</p>');
  });

  it.each(['pre', 'textarea'])('never touches <%s>, where whitespace is content', async (name) => {
    const code = `<${name}\n  class="a"\n  id="b"\n>text</${name}>`;
    expect((await lint(code)).messages).toEqual([]);
  });

  it.each(['a', 'span', 'strong', 'button', 'label'])('never touches <%s>, where whitespace inside the tag is rendered', async (name) => {
    const code = `<p>See <${name}\n  class="a"\n  id="b"\n>this</${name}>.</p>`;
    expect((await lint(code)).messages).toEqual([]);
  });

  it('never touches a tag inside <pre>, where whitespace is content', async () => {
    const code = '<pre><div\n  class="a"\n  id="b"\n>text</div></pre>';
    expect((await lint(code)).messages).toEqual([]);
  });

  it.each(['my-element', 'ruby', 'video', 'unknown'])('never touches <%s>, which is not known to be block-level', async (name) => {
    const code = `<p>See <${name}\n  class="a"\n  id="b"\n>this</${name}>.</p>`;
    expect((await lint(code)).messages).toEqual([]);
  });

  it.each(['{{ element }}', 'h{{ level }}'])('never touches <%s>, whose name Twig may render as an inline element', async (name) => {
    const code = `<p>See <${name}\n  class="a"\n  id="b"\n>this</${name}>.</p>`;
    expect((await lint(code)).messages).toEqual([]);
  });

  it('keeps non-breaking spaces at the edges of the content', async () => {
    expect(await fixed('<p\n  class="a"\n  id="b"\n>\u00A0text\u00A0</p>')).toBe('<p\n  class="a"\n  id="b"\n>\n  \u00A0text\u00A0\n</p>');
  });

  it('leaves <script> and <style> alone', async () => {
    expect((await lint('<script\n  src="a"\n  type="module"\n>init()</script>')).messages).toEqual([]);
    expect((await lint('<style\n  media="print"\n  id="b"\n>a { color: red; }</style>')).messages).toEqual([]);
  });

  it('leaves inline SVG alone, and lays it out when ignoreInside is empty', async () => {
    const code = '<svg\n  class="icon"\n  viewBox="0 0 1 1"\n><path d="M0 0"/></svg>';
    expect(await fixed(code)).toBe(code);
    expect(await fixed(code, { ignoreInside: [] })).toBe('<svg\n  class="icon"\n  viewBox="0 0 1 1"\n>\n  <path d="M0 0"/>\n</svg>');
  });

  it('does not re-indent child tags it moves', async () => {
    const code = '<div\n  class="a"\n  id="b"\n><p\n  class="c"\n  id="d"\n>text</p></div>';
    expect(await fixed(code)).toBe('<div\n  class="a"\n  id="b"\n>\n  <p\n  class="c"\n  id="d"\n>\n  text\n</p>\n</div>');
  });

  it('does not report tags without a closing tag, such as void elements', async () => {
    expect((await lint('<img\n  src="a"\n  alt=""\n>')).messages).toEqual([]);
  });

  it.each([
    ['an open tag missing its >', '<li\n  class="a"\n  id="b"{{ title }}</li>'],
    ['an open tag missing its > before plain text', '<li\n  class="a"\n  id="b"text</li>'],
    ['an open tag whose unquoted value swallowed the next tag', '<li\n  class="a"\n  id=b<span>x</span></li>'],
    ['an open tag with no > before the end of the file', '<li\n  class="a"\n  id="b"\n'],
  ])('does not report %s, so the markup it swallowed is never split', async (_name, code) => {
    const result = await lint(code);
    expect(result.output).toBe(code);
    expect(result.messages.filter((message) => message.ruleId === 'twig-html/multiline-tag-content')).toEqual([]);
  });
});
