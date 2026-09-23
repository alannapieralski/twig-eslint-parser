import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults';
import { describe, expect, it } from 'vitest';
import twigParser from '../../src/index.js';
import { drupalSelectors, recommendedParserOptions } from '../../src/tailwind.js';

const fixturesDirectory = fileURLToPath(new URL('../fixtures/', import.meta.url));

function linterOptions(): ESLint.Options {
  return {
    cwd: fixturesDirectory,
    overrideConfigFile: true,
    overrideConfig: [{
      files: ['**/*.twig'],
      plugins: { 'better-tailwindcss': betterTailwindcss },
      languageOptions: { parser: twigParser, parserOptions: { ...recommendedParserOptions } },
      settings: { 'better-tailwindcss': { entryPoint: 'tailwind/theme.css', selectors: [...getDefaultSelectors(), ...drupalSelectors] } },
      rules: {
        'better-tailwindcss/no-unknown-classes': 'error',
        'better-tailwindcss/no-conflicting-classes': 'error',
        'better-tailwindcss/no-duplicate-classes': 'error',
        'better-tailwindcss/enforce-consistent-class-order': 'warn',
      },
    }],
  };
}

async function lint(code: string, extraOptions: ESLint.Options = {}) {
  const [result] = await new ESLint({ ...linterOptions(), ...extraOptions }).lintText(code, { filePath: `${fixturesDirectory}/template.html.twig` });
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

describe('better-tailwindcss rules on Twig through twig-eslint-parser and its Drupal preset', () => {
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

  it('leaves class attributes containing Twig out, instead of reporting "{{" or BEM fragments as unknown classes', async () => {
    const result = await lint('<p class="region--{{ region }}__inner flex {{ extra }}">x</p>');
    expect(result.messages).toEqual([]);
  });

  it('autofixes class order inside a Twig string without touching anything else', async () => {
    const code = "<span{{ attributes.addClass('text-surface-primary-accent shrink-0 mt-1') }}>y</span>";
    const result = await lint(code, { fix: true });
    expect(result.output).toBe("<span{{ attributes.addClass('mt-1 shrink-0 text-surface-primary-accent') }}>y</span>");
  });

  it('does not crash on Drupal docblock comments that contain {{ }}', async () => {
    const result = await lint('{# Use {{ content }} to print everything. #}<p class="flex">x</p>');
    expect(result.messages).toEqual([]);
  });

  it('reports invalid Twig as a positioned parsing error', async () => {
    const result = await lint('<p>{{ foo </p>');
    expect(result.messages.map((message) => [message.fatal, message.message])).toEqual([[true, 'Parsing error: Unclosed variable opened at {1:4}.']]);
  });
});
