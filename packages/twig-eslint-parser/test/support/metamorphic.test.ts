import { describe, expect, it } from 'vitest';
import { groupTwigBlocks } from '../../src/twig/blocks.js';
import { tokenizeTwig } from '../../src/twig/tokens.js';
import { checkRewritesKeepTheTree, rewrites } from './metamorphic.js';

function rewrite(name: string, source: string): string {
  const selected = rewrites.find((candidate) => candidate.name === name);
  if (!selected) throw new Error(`No rewrite named ${name}.`);
  return selected.apply(source, groupTwigBlocks(tokenizeTwig(source)));
}

describe('rewrites', () => {
  it('removes the spaces inside Twig delimiters', () => {
    expect(rewrite('Twig delimiters without inner spaces', '<p>{{ a }}{% if b %}c{% endif %}{# d #}</p>')).toBe('<p>{{a}}{%if b%}c{%endif%}{# d #}</p>');
  });

  it('keeps a space that stops an expression from reading as a whitespace-control marker', () => {
    expect(rewrite('Twig delimiters without inner spaces', '{{ -1 }}{{ a - }}{{- b -}}')).toBe('{{ -1}}{{a - }}{{-b-}}');
  });

  it('adds a space inside Twig delimiters', () => {
    expect(rewrite('Twig delimiters with inner spaces', '{{a}}{%if b%}c{%endif%}')).toBe('{{ a }}{% if b %}c{% endif %}');
  });

  it('spaces Twig tags away from attribute names inside a start tag only', () => {
    expect(rewrite('Twig tags spaced from attribute names', '<a {% if x %}href="y"{% endif %}>t{% if z %}u{% endif %}</a>')).toBe('<a {% if x %} href="y"{% endif %}>t{% if z %}u{% endif %}</a>');
  });

  it('leaves Twig inside a quoted attribute value alone', () => {
    expect(rewrite('Twig tags spaced from attribute names', '<a class="b{% if x %}c{% endif %}">')).toBe('<a class="b{% if x %}c{% endif %}">');
  });

  it('switches to Windows line endings', () => {
    expect(rewrite('Windows line endings', '<p>\n{{ a }}\n</p>')).toBe('<p>\r\n{{ a }}\r\n</p>');
  });
});

describe('checkRewritesKeepTheTree', () => {
  it('finds nothing when the parser reads every rewrite the same way', () => {
    expect(checkRewritesKeepTheTree('<div class="a {{ b }}" id="{{ c }}">\n  {% for d in e %}<p>{{ d|upper }}</p>{% endfor %}\n</div>')).toEqual([]);
  });

  it('flags a Twig tag glued to an attribute name, because spacing them changes the attributes', () => {
    const issues = checkRewritesKeepTheTree('<span {% if x %}class="a"{% endif %}>b</span>');
    expect(issues.map((issue) => issue.check)).toContain('metamorphic: Twig tags spaced from attribute names: html');
  });

  it('flags a dynamic close tag that pairs only when spaced like its open tag', () => {
    const issues = checkRewritesKeepTheTree('<{{ element }}>a</{{element}}>');
    expect(issues.map((issue) => issue.check)).toContain('metamorphic: Twig delimiters with inner spaces: html');
  });
});
