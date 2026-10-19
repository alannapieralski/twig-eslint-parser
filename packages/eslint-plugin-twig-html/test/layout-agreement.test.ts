import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import twigHtml from '../src/index.js';

const manyAttributes = 'id="a" class="b" data-x="c" data-y="d"';

async function lintWithRecommended(code: string) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    fix: true,
    overrideConfig: [twigHtml.configs.recommended, { files: ['**/*.twig'], rules: { 'twig-html/quotes': 'off' } }],
  });
  const [result] = await eslint.lintText(code, { filePath: 'template.html.twig' });
  if (!result) throw new Error('ESLint returned no result.');
  return { output: result.output ?? code, messages: result.messages };
}

async function expectLeftAlone(code: string) {
  const { output, messages } = await lintWithRecommended(code);
  expect(output).toBe(code);
  expect(messages).toEqual([]);
}

describe('layout rules leave alone what indent cannot indent', () => {
  it('leaves a title with no closing tag, which swallows the rest of the file', async () => {
    await expectLeftAlone(`<head>\n<title ${manyAttributes}> {{ t }}\n</head>\n`);
  });

  it('leaves a tag inside pre', async () => {
    await expectLeftAlone(`<div>\n  <pre>\n<span ${manyAttributes}>x</span>\n</pre>\n</div>\n`);
  });

  it('leaves a tag inside verbatim', async () => {
    await expectLeftAlone(`<div>\n  {% verbatim %}\n<span ${manyAttributes}>x</span>\n  {% endverbatim %}\n</div>\n`);
  });

  it('leaves an element whose open tag is in one Twig branch and whose close tag is outside', async () => {
    const { output, messages } = await lintWithRecommended(`<div>\n{% if a %}<section ${manyAttributes}>{% else %}<section>{% endif %}\n<p>x</p>\n</section>\n</div>\n`);
    expect(output).toContain(`\n{% if a %}<section ${manyAttributes}>{% else %}<section>{% endif %}\n`);
    expect(messages).toEqual([]);
  });

  it('leaves an element that crosses a Twig frame', async () => {
    const { output, messages } = await lintWithRecommended(`<div>\n{% if a %}\n<section ${manyAttributes}>\n{% endif %}\n<p>x</p>\n</section>\n</div>\n`);
    expect(output).toContain(`\n<section ${manyAttributes}>\n`);
    expect(messages).toEqual([]);
  });

  it('leaves every tag in a file with a stray closing Twig tag', async () => {
    await expectLeftAlone(`<div>\n<section ${manyAttributes}>\n<p>x</p>\n</section>\n{% endif %}\n</div>\n`);
  });

  it('leaves the content of an element in a file with mismatched Twig tags', async () => {
    await expectLeftAlone(`<div>\n{% for a in b %}\n<section class="a">x\ny</section>\n{% endif %}\n</div>\n`);
  });

  it('still lays out a tag that indent can indent', async () => {
    const { output } = await lintWithRecommended(`<div>\n<section ${manyAttributes}>x</section>\n</div>\n`);
    expect(output).toBe('<div>\n  <section\n    id="a"\n    class="b"\n    data-x="c"\n    data-y="d"\n  >\n    x\n  </section>\n</div>\n');
  });
});
