import { describe, expect, it } from 'vitest';
import { branchSegmentsOf } from './branches.js';

describe('branchSegmentsOf', () => {
  it('splits an {% if %} group into its branches, by range in the template', () => {
    const code = '{% if a %}<div{{ attributes }}>x</div>{% else %}<p>y</p>{% endif %}';
    expect(branchSegmentsOf(code).map(({ start, end }) => code.slice(start, end))).toEqual(['<div{{ attributes }}>x</div>', '<p>y</p>']);
  });

  it('keeps a nested {% if %} inside a {% for %} its own group', () => {
    const code = '{% for x in xs %}{% if x %}<a>{% elseif y %}<b>{% endif %}{% endfor %}';
    expect(branchSegmentsOf(code).map(({ groupId, branchIndex, start, end }) => [groupId, branchIndex, code.slice(start, end)])).toEqual([
      [0, 0, '<a>'],
      [0, 1, '<b>'],
    ]);
  });

  it('ignores a short block, which scopes nothing', () => {
    const code = "{% block title 'x' %}{% if a %}<a>{% else %}<b>{% endif %}";
    expect(branchSegmentsOf(code)).toHaveLength(2);
  });
});
