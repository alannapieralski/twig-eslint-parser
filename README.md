# twig-eslint-parser

An [ESLint](https://eslint.org) parser for [Twig](https://twig.symfony.com) templates. It turns a
`.twig` file into one AST that contains both the HTML markup and every Twig expression, with
every node pointing at its exact position in the template.

It is a parser, not a linter: it gives existing ESLint rules something to read. Its first use is
linting Tailwind CSS classes in Drupal themes with
[`eslint-plugin-better-tailwindcss`](https://github.com/schoero/eslint-plugin-better-tailwindcss),
including classes that live inside Twig expressions:

```twig
{% set classes = ['gap-fl-sm', 'grid-cols-1'] %}
<div{{ attributes.addClass(classes).addClass('md:grid-cols-2') }}>
  {% include 'numiko:card' with { classes: ['w-full'] } only %}
</div>
```

## How it works

1. **Markup** is parsed by [`@html-eslint/parser`](https://html-eslint.org) with its Twig preset,
   so `class="..."` attributes work as they do in plain HTML.
2. **Twig** is tokenised by a fork of [twig-lexer](https://gitlab.com/nightlycommit/twig-lexer)
   brought up to Twig 3.28 (see [the fork](#the-twig-lexer-fork)).
3. Every `{{ }}` and `{% %}` block is rewritten as **JavaScript of exactly the same length**
   (`set` becomes `var`, `~` becomes `+`, `|filter` becomes `.filter`, `and` becomes `&&`, and so
   on) and parsed with [espree](https://github.com/eslint/js/tree/main/packages/espree), ESLint's
   own parser. Because the lengths match, every string literal keeps the source range it has in
   the template, so rule reports and autofixes land on the right characters.
4. Both trees are combined into one `Program`: the HTML in `body`, the Twig expressions in
   `twigBody`.

The JavaScript is only a vehicle for positions and structure. It does not mean what the Twig
means (`a ~ b` looks like `a + b`), so run rules that read strings and structure on `.twig`
files, not general JavaScript rules such as `no-undef`.

## Installation

```sh
npm install --save-dev twig-eslint-parser eslint eslint-plugin-better-tailwindcss
```

Requires Node.js 24 or later and ESLint 9 or 10. The package is ESM only.

## Usage with Tailwind CSS

```js
// eslint.config.js
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults';
import twigParser from 'twig-eslint-parser';
import { drupalSelectors, recommendedParserOptions } from 'twig-eslint-parser/tailwind';

export default [
  {
    files: ['**/*.twig'],
    plugins: { 'better-tailwindcss': betterTailwindcss },
    languageOptions: {
      parser: twigParser,
      parserOptions: { ...recommendedParserOptions },
    },
    settings: {
      'better-tailwindcss': {
        entryPoint: 'src/css/style.css',
        selectors: [...getDefaultSelectors(), ...drupalSelectors],
      },
    },
    rules: {
      ...betterTailwindcss.configs.recommended.rules,
    },
  },
];
```

`entryPoint` must be a CSS file that Tailwind can resolve on its own. Imports that only resolve
through a bundler alias (for example Vite's `@css/...`) are not followed; use relative paths in
that file, or point `entryPoint` at a small lint-only file that imports the theme relatively.

### What gets linted

| Twig | Selector |
|---|---|
| `class="..."` without Twig inside | better-tailwindcss defaults |
| `{% set classes = [...] %}`, `{% set grid_classes = '...' %}` | `twigSelectors`: variables named `classes` or ending in `_classes` |
| `{% include 'x' with { classes: [...] } %}`, `{% embed %}`, `include('x', { classes })` | `twigSelectors`: the `classes` value of the hash |
| `attributes.addClass(...)`, `.removeClass(...)` | `drupalSelectors` |
| `create_attribute({ 'class': [...] })` | `drupalSelectors` |

`drupalSelectors` includes `twigSelectors`. Both are plain better-tailwindcss selector objects, so
you can extend or replace them.

## Parser options

| Option | Default | Description |
|---|---|---|
| `ignoreInterpolatedAttributes` | `[]` | Attribute names (case-insensitive) to leave out of the HTML AST when their value contains Twig, such as `class="figure {{ classes }}"`. `recommendedParserOptions` sets `['class']`. |
| `templateEngineSyntax` | Twig preset | Passed to `@html-eslint/parser`. |

`ignoreInterpolatedAttributes` exists because better-tailwindcss reads HTML attribute values as
plain strings, so it would report `{{`, variable names and BEM fragments such as `region--` as
unknown classes. Every attribute left out is listed in the parser services, so nothing disappears
silently.

## Parser services

`context.sourceCode.parserServices.twig` describes what happened to the file:

| Property | Meaning |
|---|---|
| `convertedBlockCount` | Twig blocks turned into JavaScript nodes. |
| `ignoredBlockCount` | Blocks with no expression worth parsing, such as `{% endif %}` or `{% extends %}`. |
| `unconvertedBlocks` | Blocks that could not be converted, with their range and the reason. |
| `omittedAttributes` | Attributes left out by `ignoreInterpolatedAttributes`. |

Invalid Twig, such as an unclosed `{{`, is reported by ESLint as a parsing error with its position.

## Known limitations

- **Classes built by concatenation** (`'c-grid--' ~ count ~ '-items'`) are only partly visible:
  the fixed fragments are separate strings.
- **Classes computed in PHP** (preprocess functions) are not in the template and cannot be seen.
- **JavaScript reserved words** used as bare Twig variables (`{{ class }}`) are renamed to a
  same-length identifier (`_lass`) so the expression parses; variable selectors see the new name.
- **Oxlint** cannot use this parser: it does not support custom HTML parsers yet.

## Supported Twig

Twig 3.x syntax up to 3.28, verified against real Twig:

- 9 fixture templates cover every delimiter, whitespace-control form, comment style, string,
  number, operator (up to `===`, `?.`, `xor` and `has some`) and tag in Twig 3.28, and match
  Twig 3.28.0's own tokens exactly (`test/fixtures/twig`, generated by `tools/twig-oracle`).
- On 1,311 real templates (Drupal core, contributed modules and themes, and a Numiko theme) the
  lexer matches Twig on all 110,470 tokens and all 10,017 Twig blocks convert.

## The twig-lexer fork

The lexer in `src/lexer` is a fork of twig-lexer 1.0.0, a TypeScript port of Twig's lexer that has
not been released since April 2024. The upstream files are kept byte for byte in
`third_party/twig-lexer/pristine`, and every change is a separate patch with a
[DEP-3](https://dep-team.pages.debian.net/deps/dep3/) header in `third_party/twig-lexer/patches`.
[`third_party/twig-lexer/UPSTREAM.md`](third_party/twig-lexer/UPSTREAM.md) lists each change, the
Twig release it reproduces and the test that proves it. `npm run vendor:check` fails if `src/lexer`
ever differs from pristine plus patches; run it in CI.

## Development

| Command | What it does |
|---|---|
| `npm test` | Unit, parity and integration tests. |
| `npm run typecheck` | Type-checks the lexer (with upstream's settings) and everything else (strict). |
| `npm run build` | Compiles to `dist`. |
| `npm run test:upstream` | Runs twig-lexer's own test suite against the patched lexer. |
| `npm run vendor:check` / `vendor:write` | Checks or regenerates `src/lexer` from pristine plus patches. |
| `npm run golden:twig` | Regenerates the fixture golden files with real Twig (needs PHP and `composer install` in `tools/twig-oracle`). |
| `TWIG_CORPUS=dir:dir npm test -- test/corpus.test.ts` | Checks the lexer against real Twig and the parser on every template in the given directories (needs PHP). |

### Dependency policy

Installs only accept package versions published at least 7 days ago (`min-release-age=7` in
`.npmrc`). That setting needs npm 11.10 or later, so `devEngines` makes older npm versions fail
instead of silently ignoring it. Runtime dependencies are pinned to exact versions.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org).

## Licence

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE). The lexer is derived from
twig-lexer by Eric MORAND, also Apache-2.0.
