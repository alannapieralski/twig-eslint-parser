import { describe, expect, it } from 'vitest';
import { checkParserOutput, templateDefectChecks } from './output-checks.js';

function checksOf(code: string): string[] {
  return checkParserOutput(code).map((issue) => issue.check);
}

function parserFailuresOf(code: string): string[] {
  return checksOf(code).filter((check) => !templateDefectChecks.has(check));
}

describe('checkParserOutput', () => {
  it('finds nothing wrong with well-formed markup and Twig', () => {
    expect(checkParserOutput('<div class="a {{ b }}" id=x {# note #} data-y>\n  {% if c %}<p>{{ c }}</p>{% endif %}<br>\n</div>')).toEqual([]);
  });

  it('reports a template the parser rejects as a template defect with its line', () => {
    expect(checkParserOutput('<p>\n<div class="a"\n<p>')).toEqual([
      expect.objectContaining({ check: 'template is valid Twig and HTML', line: 3 }),
    ]);
  });

  it('fails a close tag that the parser drops while its element is still open', () => {
    const code = '<html><head><head-placeholder token="x"></head><body></body></html>';
    expect(parserFailuresOf(code)).toContain('html: close tag is read');
  });

  it('fails a dynamic close tag the parser cannot pair because its Twig is spaced differently', () => {
    expect(parserFailuresOf('<{{ element }}>a</{{element}}>')).toContain('html: close tag is read');
  });

  it('reports a close tag that closes nothing as a template defect', () => {
    expect(checksOf('<div></div></span>')).toEqual(['html: stray close tag']);
  });

  it('reports only the innermost element left open', () => {
    const issues = checkParserOutput('<section><div><span>a</div></section>').filter((issue) => issue.check === 'html: element closes');
    expect(issues.map((issue) => issue.detail)).toEqual(['line 1: <span']);
  });

  it('fails a Twig tag glued into an attribute name', () => {
    expect(parserFailuresOf('<input type="checkbox"{% if checked %} checked{% endif %}>')).toContain('html: Twig block glued to a name');
  });

  it('accepts a Twig print that is part of an attribute name', () => {
    expect(checkParserOutput('<div data-{{ name }}="x"></div>')).toEqual([]);
  });

  it('keeps Twig delimiters inside verbatim out of the coverage check', () => {
    expect(checkParserOutput('{% verbatim %}<p>{{ raw }}</p>{% endverbatim %}')).toEqual([]);
  });
});
