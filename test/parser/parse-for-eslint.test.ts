import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseForESLint, type ParserOptions } from '../../src/index.js';

type Node = { type: string; range: [number, number]; loc: { start: { line: number; column: number } }; [key: string]: unknown };

const fixturesDirectory = new URL('../fixtures/twig/', import.meta.url);

function parse(code: string, options: ParserOptions = {}) {
  const result = parseForESLint(code, options);
  return { result, statements: result.ast.twigBody as unknown as Node[], services: result.services.twig };
}

function collectNodes(value: unknown, predicate: (node: Node) => boolean, found: Node[] = []): Node[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectNodes(item, predicate, found));
    return found;
  }
  if (typeof value !== 'object' || value === null || typeof (value as Node).type !== 'string') return found;

  const node = value as Node;
  if (predicate(node)) found.push(node);
  for (const [key, child] of Object.entries(node)) {
    if (key !== 'loc' && key !== 'range' && key !== 'parent') collectNodes(child, predicate, found);
  }
  return found;
}

function sourceOf(code: string, node: Node): string {
  return code.slice(node.range[0], node.range[1]);
}

function onlyStatement(code: string): Node {
  const { statements, services } = parse(code);
  expect(services.unconvertedBlocks).toEqual([]);
  expect(statements).toHaveLength(1);
  return statements[0] as Node;
}

function expressionOf(code: string): Node {
  return onlyStatement(code)['expression'] as Node;
}

const blocksTwigItselfRejectsByFixture: Record<string, string[]> = {
  'operators.twig': ['{{ foo.is not }}'],
};

describe('fixtures', () => {
  const fixtureNames = readdirSync(fixturesDirectory).filter((name) => name.endsWith('.twig'));

  it.each(fixtureNames)('%s converts every block Twig accepts and keeps every literal at its real source position', (fixtureName) => {
    const code = readFileSync(new URL(fixtureName, fixturesDirectory), 'utf8');
    const { statements, services } = parse(code);
    const unconvertedSources = services.unconvertedBlocks.map((block) => code.slice(...block.range));
    expect(unconvertedSources).toEqual(blocksTwigItselfRejectsByFixture[fixtureName] ?? []);

    const literals = collectNodes(statements, (node) => node.type === 'Literal');
    for (const literal of literals) expect(sourceOf(code, literal)).toBe(literal['raw']);
  });
});

describe('print statements and delimiters', () => {
  it('wraps {{ }} contents as a parenthesised expression', () => {
    expect(expressionOf('{{ foo }}')).toMatchObject({ type: 'Identifier', name: 'foo' });
  });

  it.each(['{{- foo -}}', '{{~ foo ~}}', '{{foo}}'])('ignores whitespace control in %s', (code) => {
    expect(expressionOf(code)).toMatchObject({ type: 'Identifier', name: 'foo' });
  });

  it('parses hashes rather than block statements', () => {
    expect(expressionOf('{{ {a: {b: 1}} }}')).toMatchObject({ type: 'ObjectExpression' });
  });

  it('skips inline # comments', () => {
    expect(expressionOf('{{ foo # a comment with }} inside\n}}')).toMatchObject({ type: 'Identifier', name: 'foo' });
  });
});

describe('strings and numbers', () => {
  it('turns interpolated double-quoted strings into template literals', () => {
    const code = '{{ "a-#{b}-c" }}';
    const expression = expressionOf(code);
    expect(expression).toMatchObject({ type: 'TemplateLiteral', expressions: [{ type: 'Identifier', name: 'b' }] });
    expect(sourceOf(code, expression)).toBe('"a-#{b}-c"');
  });

  it('keeps plain double-quoted strings, including ones with a lone #', () => {
    expect(expressionOf('{{ "hash # here" }}')).toMatchObject({ type: 'Literal', value: 'hash # here' });
  });

  it('accepts escaped quotes and escaped line breaks', () => {
    expect(onlyStatement("{{ 'it\\'s' ~ 'a \\\nb' }}")).toBeDefined();
  });

  it.each(['{{ 1_000 }}', '{{ 1.5e-3 }}', '{{ items.0 }}', '{{ 12345|format_size }}', '{{ 1..5 }}'])('converts %s', (code) => {
    expect(onlyStatement(code)).toBeDefined();
  });
});

describe('operators', () => {
  it.each([
    ['{{ a and b }}', 'LogicalExpression'],
    ['{{ a xor b }}', 'BinaryExpression'],
    ['{{ not a }}', 'UnaryExpression'],
    ['{{ a b-and b }}', 'BinaryExpression'],
    ['{{ a ~ b }}', 'BinaryExpression'],
    ['{{ a // b }}', 'BinaryExpression'],
    ['{{ a <=> b }}', 'BinaryExpression'],
    ['{{ a not in b }}', 'BinaryExpression'],
    ['{{ a starts with b }}', 'BinaryExpression'],
    ['{{ a has some x => x > 1 }}', 'SequenceExpression'],
    ['{{ a === b }}', 'BinaryExpression'],
    ['{{ a ?? b }}', 'LogicalExpression'],
    ['{{ a ?: b }}', 'LogicalExpression'],
    ['{{ a ? : b }}', 'BinaryExpression'],
    ['{{ a ? b : c }}', 'ConditionalExpression'],
    ['{{ a ? b }}', 'BinaryExpression'],
    ['{{ a is defined }}', 'BinaryExpression'],
    ['{{ a is not same as(b) }}', 'BinaryExpression'],
    ['{{ a?.b }}', 'ChainExpression'],
  ])('%s becomes a %s', (code, type) => {
    expect(expressionOf(code)).toMatchObject({ type });
  });

  it('turns filters into method calls', () => {
    expect(expressionOf("{{ items|join(', ') }}")).toMatchObject({
      type: 'CallExpression',
      callee: { type: 'MemberExpression', property: { name: 'join' } },
    });
  });

  it('turns named arguments into assignments', () => {
    expect(expressionOf('{{ f(name: value) }}')).toMatchObject({ type: 'CallExpression', arguments: [{ type: 'AssignmentExpression' }] });
  });

  it('keeps computed hash keys computed', () => {
    expect(expressionOf("{{ {(a ~ 'x'): 1} }}")).toMatchObject({ type: 'ObjectExpression', properties: [{ computed: true }] });
  });

  it('keeps short ternaries inside arrays separate per element', () => {
    const expression = expressionOf("{{ [required ? 'a', 'b'] }}");
    expect(expression).toMatchObject({ type: 'ArrayExpression', elements: [{ type: 'BinaryExpression' }, { type: 'Literal' }] });
  });

  it('parses arrow functions, spreads and dynamic macro calls', () => {
    expect(onlyStatement('{{ items|map(i => i.x) }}')).toBeDefined();
    expect(onlyStatement('{{ [...a, ...b] }}')).toBeDefined();
    expect(onlyStatement('{{ macros.(name)(args) }}')).toBeDefined();
  });

  it('renames JavaScript reserved words used as Twig variables', () => {
    expect(expressionOf('{{ class }}')).toMatchObject({ type: 'Identifier', name: '_lass' });
  });
});

describe('tags', () => {
  it('turns {% set %} into a variable declaration', () => {
    const code = "{% set classes = ['a', 'b'] %}";
    const statement = onlyStatement(code);
    expect(statement).toMatchObject({
      type: 'VariableDeclaration',
      declarations: [{ id: { name: 'classes' }, init: { type: 'ArrayExpression' } }],
    });
  });

  it('keeps multi-line {% set %} positions on their real lines', () => {
    const code = "{%\n  set classes = [\n    'first',\n    'second',\n  ]\n%}";
    const literals = collectNodes(onlyStatement(code), (node) => node.type === 'Literal');
    expect(literals.map((literal) => [sourceOf(code, literal), literal.loc.start.line])).toEqual([["'first'", 3], ["'second'", 4]]);
  });

  it('keeps multiple-target {% set %} a declaration', () => {
    expect(onlyStatement("{% set a, classes = 1, ['x'] %}")).toMatchObject({
      type: 'VariableDeclaration',
      declarations: [{ id: { type: 'ArrayPattern' }, init: { type: 'ArrayExpression' } }],
    });
  });

  it('supports {% set %} capture blocks and destructuring', () => {
    expect(onlyStatement('{% set c %}')).toMatchObject({ type: 'VariableDeclaration' });
    expect(onlyStatement('{% set [a, b] = x %}')).toMatchObject({ type: 'VariableDeclaration' });
    expect(expressionOf('{% do {name: userName} = user %}')).toMatchObject({ type: 'AssignmentExpression' });
  });

  it('represents {% include %} and {% embed %} as calls with the with-hash as an argument', () => {
    expect(expressionOf("{% include 'card' with { classes: ['a'] } only %}")).toMatchObject({
      type: 'CallExpression',
      callee: { name: 'include' },
      arguments: [{ type: 'Literal', value: 'card' }, { type: 'ObjectExpression' }],
    });
    expect(expressionOf("{% embed 'card' ignore missing with { a: 1 } %}")).toMatchObject({ type: 'CallExpression', callee: { name: 'embed' } });
  });

  it('parses the iterated expression of {% for %}, including the Twig 2 if filter', () => {
    expect(expressionOf('{% for key, item in items %}')).toMatchObject({ type: 'Identifier', name: 'items' });
    expect(expressionOf("{% for item in items if item != '' %}")).toMatchObject({ type: 'SequenceExpression' });
  });

  it.each(['{% if a and b %}', '{% elseif a %}', '{% do x = 1 %}', "{% with { a: 1 } only %}", "{% macro input(classes = ['a']) %}", "{% block title 'value' %}"])(
    'parses the expression in %s',
    (code) => {
      expect(onlyStatement(code)).toBeDefined();
    },
  );

  it.each(["{% extends 'base' %}", '{% endif %}', '{% else %}', "{% trans %}", "{% cache 'key' ttl(300) %}", "{% my_custom_tag some 'argument' %}", '{% block title %}'])(
    'leaves %s out without reporting it as a failure',
    (code) => {
      const { statements, services } = parse(code);
      expect(statements).toEqual([]);
      expect(services).toMatchObject({ ignoredBlockCount: 1, unconvertedBlocks: [] });
    },
  );

  it('does not lex the contents of {% verbatim %}', () => {
    expect(parse('{% verbatim %}{{ not.lexed }}{% endverbatim %}').statements).toEqual([]);
  });
});

describe('markup and options', () => {
  it('parses markup whose Twig comments contain {{ }}', () => {
    const { result } = parse('{# Use {{ content }} #}<p class="a">x</p>');
    const tags = collectNodes(result.ast.body, (node) => node.type === 'Tag');
    expect(tags).toHaveLength(1);
  });

  it('reports every attribute it leaves out through parser services', () => {
    const code = '<p class="a {{ b }}" id="{{ c }}">x</p>';
    const { services } = parse(code, { ignoreInterpolatedAttributes: ['CLASS'] });
    expect(services.omittedAttributes.map((attribute) => [attribute.name, code.slice(...attribute.range)])).toEqual([['class', 'class="a {{ b }}"']]);
  });

  it('keeps interpolated attributes unless asked to leave them out', () => {
    expect(parse('<p class="a {{ b }}">x</p>').services.omittedAttributes).toEqual([]);
  });

  it('rejects invalid ignoreInterpolatedAttributes values loudly', () => {
    expect(() => parseForESLint('<p></p>', { ignoreInterpolatedAttributes: 'class' } as unknown as ParserOptions)).toThrow(/must be an array of attribute names/);
  });

  it('reports blocks it cannot convert instead of dropping them silently', () => {
    const { services } = parse('<p>{{ foo.is not }}</p>');
    expect(services.unconvertedBlocks).toMatchObject([{ kind: 'print', tagName: undefined, range: [3, 19] }]);
  });
});

describe('tags without optional whitespace', () => {
  it('still parses {%include%} written without a space after the tag name', () => {
    expect(expressionOf("{%include'card'with{classes:['a']}%}")).toMatchObject({
      type: 'SequenceExpression',
      expressions: [{ type: 'Literal', value: 'card' }, { type: 'ObjectExpression' }],
    });
  });
});
