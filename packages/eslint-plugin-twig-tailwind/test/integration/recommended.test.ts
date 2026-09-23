import { fileURLToPath } from 'node:url';
import { ESLint, type Linter } from 'eslint';
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults';
import type { ParserOptions } from 'twig-eslint-parser';
import { describe, expect, it } from 'vitest';
import twigTailwind, { twigSelectors } from '../../src/index.js';

const fixturesDirectory = fileURLToPath(new URL('../fixtures/', import.meta.url));

type LintSetup = { parserOptions?: ParserOptions; selectors?: readonly unknown[]; rules?: Linter.RulesRecord; fix?: boolean };

function linterOptions({ parserOptions, selectors, rules = {}, fix = false }: LintSetup): ESLint.Options {
  return {
    cwd: fixturesDirectory,
    fix,
    overrideConfigFile: true,
    overrideConfig: [
      twigTailwind.configs.recommended,
      {
        files: ['**/*.twig'],
        ...(parserOptions && { languageOptions: { parserOptions } }),
        settings: { 'better-tailwindcss': { entryPoint: 'tailwind/theme.css', ...(selectors && { selectors }) } },
        rules,
      },
    ],
  };
}

async function lint(code: string, setup: LintSetup = {}) {
  const [result] = await new ESLint(linterOptions(setup)).lintText(code, { filePath: `${fixturesDirectory}/template.html.twig` });
  if (!result) throw new Error('ESLint returned no result.');
  return result;
}

function columnOf(code: string, text: string): number {
  return code.indexOf(text) + 1;
}

function unknownClassAt(code: string, className: string): string {
  return `1:${columnOf(code, className)} better-tailwindcss/no-unknown-classes Unknown class detected: ${className}`;
}

function describeMessages(messages: { ruleId: string | null; line: number; column: number; message: string }[]): string[] {
  return messages.map((message) => `${message.line}:${message.column} ${message.ruleId} ${message.message.split('\n')[0]}`);
}

describe('configs.recommended on Twig and Drupal templates', () => {
  it.each([
    ['{% set classes %} arrays', "{% set classes = ['gap-fl-sm', 'nope'] %}"],
    ['{% set grid_classes %} arrays', "{% set grid_classes = ['gap-fl-sm', 'nope'] %}"],
    ['addClass() inside <tag{{ attributes }}>', "<div{{ attributes.addClass(['mt-fl-sm', 'nope']) }}>x</div>"],
    ['removeClass()', "<div{{ attributes.removeClass('nope') }}>x</div>"],
    ['create_attribute() with an array', "{% set image = create_attribute({'class': ['size-full', 'nope']}) %}"],
    ['create_attribute() with a string', "{% set image = create_attribute({'class': 'nope size-full'}) %}"],
    ['{% include with { classes } %} arrays', "{% include 'numiko:card' with { classes: ['w-full', 'nope'] } only %}"],
    ['{% embed with { classes } %} strings', "{% embed 'numiko:card' with { classes: 'nope w-full' } %}{% endembed %}"],
    ['include() function calls', "{{ include('numiko:card', { classes: ['w-full', 'nope'] }) }}"],
  ])('reports an unknown class in %s at its exact position', async (_, code) => {
    const result = await lint(code);
    expect(describeMessages(result.messages)).toEqual([unknownClassAt(code, 'nope')]);
  });

  it('reports conflicting classes in a plain class attribute', async () => {
    const result = await lint('<p class="p-2 p-4">x</p>');
    expect(result.messages.map((message) => message.ruleId)).toEqual([
      'better-tailwindcss/no-conflicting-classes',
      'better-tailwindcss/no-conflicting-classes',
    ]);
  });

  it('lets a later selectors setting replace the Drupal selectors', async () => {
    const code = "<div{{ attributes.addClass('nope') }}>x</div>{% set classes = ['nope2'] %}";
    const result = await lint(code, { selectors: [...getDefaultSelectors(), ...twigSelectors] });
    expect(describeMessages(result.messages)).toEqual([unknownClassAt(code, 'nope2')]);
  });

  it('autofixes class order inside a Twig string without touching anything else', async () => {
    const code = "<span{{ attributes.addClass('text-surface-primary-accent shrink-0 mt-1') }}>y</span>";
    const result = await lint(code, { fix: true });
    expect(result.output).toBe("<span{{ attributes.addClass('mt-1 shrink-0 text-surface-primary-accent') }}>y</span>");
  });
});

describe('twig-tailwind/no-interpolated-attributes', () => {
  it('reports Twig inside class="" once, while better-tailwindcss stays quiet about the {{ }} fragments', async () => {
    const code = '<p class="region--{{ region }}__inner flex {{ extra }}">x</p>';
    const result = await lint(code);
    expect(describeMessages(result.messages)).toEqual([
      `1:${columnOf(code, 'class=')} twig-tailwind/no-interpolated-attributes Avoid Twig inside class="": linters cannot see what it produces. Build the value with {% set classes = [...] %} and attributes.addClass(), or pass it to an include as { classes: [...] }.`,
    ]);
  });

  it('reports Twig statements inside class="" too', async () => {
    const result = await lint('<p class="flex {% if active %}font-bold{% endif %}">x</p>');
    expect(result.messages.map((message) => message.ruleId)).toEqual(['twig-tailwind/no-interpolated-attributes']);
  });

  it('also reports when the parser keeps interpolated attributes in the HTML AST', async () => {
    const result = await lint('<p class="flex {{ extra }}">x</p>', { parserOptions: { ignoreInterpolatedAttributes: [] } });
    expect(result.messages.map((message) => message.ruleId)).toContain('twig-tailwind/no-interpolated-attributes');
  });

  it('leaves other attributes alone by default', async () => {
    const result = await lint('<a href="{{ url }}" class="flex">x</a>');
    expect(result.messages).toEqual([]);
  });

  it('checks any attributes listed in its options', async () => {
    const result = await lint('<a href="{{ url }}" class="flex {{ extra }}">x</a>', { rules: { 'twig-tailwind/no-interpolated-attributes': ['error', { attributes: ['href'] }] } });
    expect(result.messages.map((message) => message.message.split(':')[0])).toEqual(['Avoid Twig inside href=""']);
  });

  it('does not report the Twig-built class attributes the option hides when the rule is off', async () => {
    const result = await lint('<p class="flex {{ extra }}">x</p>', { rules: { 'twig-tailwind/no-interpolated-attributes': 'off' } });
    expect(result.messages).toEqual([]);
  });
});
