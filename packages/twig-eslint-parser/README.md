# twig-eslint-parser

An [ESLint](https://eslint.org) parser for [Twig](https://twig.symfony.com) templates. It turns a
`.twig` file into one AST that contains both the HTML markup and every Twig expression, with
every node pointing at its exact position in the template.

It is only a parser: it gives existing ESLint rules something to read and ships no rules of its
own. Its first use is linting Tailwind CSS classes in Drupal themes with
[`eslint-plugin-twig-tailwind`](https://github.com/alannapieralski/twig-eslint-parser/tree/main/packages/eslint-plugin-twig-tailwind), including classes that live inside Twig
expressions:

```twig
{% set classes = ['gap-fl-sm', 'grid-cols-1'] %}
<div{{ attributes.addClass(classes).addClass('md:grid-cols-2') }}>
  {% include 'numiko:card' with { classes: ['w-full'] } only %}
</div>
```

## How it works

1. **Twig** is tokenised by a fork of [twig-lexer](https://gitlab.com/nightlycommit/twig-lexer)
   brought up to Twig 3.28 (see [the vendored code](#vendored-code)).
2. **Markup** is read by a fork of [es-html-parser](https://github.com/yeonjuan/es-html-parser), the
   parser behind [html-eslint](https://html-eslint.org), so the tree has the shape html-eslint
   rules and better-tailwindcss expect. The lexer's Twig blocks are handed to it as template
   ranges, and the markup reader treats each one according to where it sits (see
   [Markup](#markup)).
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
npm install --save-dev twig-eslint-parser eslint
```

Requires Node.js 24 or later and ESLint 9 or 10. The package is ESM only.

## Usage

```js
// eslint.config.js
import twigParser from 'twig-eslint-parser';

export default [
  {
    files: ['**/*.twig'],
    languageOptions: { parser: twigParser },
  },
];
```

Add rules that read HTML nodes, string literals or call expressions. For Tailwind CSS, use
[`eslint-plugin-twig-tailwind`](https://github.com/alannapieralski/twig-eslint-parser/tree/main/packages/eslint-plugin-twig-tailwind) instead of wiring this up by hand.

## Parser options

| Option | Default | Description |
|---|---|---|
| `ignoreInterpolatedAttributes` | `[]` | Attribute names (case-insensitive) to leave out of the HTML AST when their value contains Twig, such as `class="figure {{ classes }}"`. The recommended config of `eslint-plugin-twig-tailwind` sets `['class']`. |
| `rawContentTags` | `[]` | Extra element names whose content is read as raw text, added to `textarea` and `title`. |

`ignoreInterpolatedAttributes` exists because linters such as better-tailwindcss read HTML
attribute values as plain strings, so they would report `{{`, variable names and BEM fragments
such as `region--` as unknown classes. Every attribute left out is listed in the parser services, so nothing disappears
silently.

## Parser services

`readTwigServices(context.sourceCode, context.id)` reads `context.sourceCode.parserServices.twig`, and throws a clear error when another parser parsed the file. It describes what happened to the file:

| Property | Meaning |
|---|---|
| `convertedBlockCount` | Twig blocks turned into JavaScript nodes. |
| `ignoredBlockCount` | Blocks with no expression worth parsing, such as `{% endif %}` or `{% extends %}`. |
| `unconvertedBlocks` | Blocks that could not be converted, with their range and the reason. |
| `blocks` | Every Twig block (`print`, `tag` or `comment`) with its range, tag name and `depthChange`: `1` for a tag that opens a nested block such as `{% if %}`, `-1` for one that closes it, `0` otherwise. `twig-html/attrs-newline` uses it to keep attributes wrapped in a Twig block together. |
| `omittedAttributes` | Attributes left out by `ignoreInterpolatedAttributes`, with their name and range. `twig-tailwind/no-interpolated-attributes` reports them. |

Invalid Twig, such as an unclosed `{{`, and broken markup, such as a tag missing its `>`, are reported by ESLint as a
parsing error with its position.

## Markup

The markup reader knows where every Twig block is, and what kind it is, so a block means what its
position in the markup says:

- A Twig tag or comment, or a print that outputs a whole attribute list (`{{ attributes }}`,
  `{{ x.addClass(...) }}`, `{{ create_attribute(...) }}`), ends a tag name or an attribute name.
  Tags and attribute prints become attributes of their own (`<span {% if x %}class="a"{% endif %}>`
  has the attributes `{% if x %}`, `class` and `{% endif %}`); comments between attributes are
  skipped.
- A print touching the end of a tag name is read as attributes (`<div{{ attr }}>`, whatever the
  expression is called) unless a close tag spells the same Twig into the name
  (`<h{{ level }}>...</h{{ level }}>`), in which case it continues the name. An element with no
  close tag, such as `<input{{ attr }}>`, is therefore read as attributes. A print straight after
  `<` (`<{{ html_element }}>`) is the tag name, and any other print touching a name continues it
  (`data-{{ name }}="x"`). The tag's `name` is the Twig as written.
- Close tags pair with their open tag ignoring whitespace, so `</{{element}}>` closes
  `<{{ element }}>`. A close tag that matches an element further up closes the elements in between,
  as a browser does, so one element that is never closed, such as Drupal's
  `<head-placeholder token="...">`, is reported on its own instead of swallowing the rest of the
  document.
- `textarea` and `title` content is raw text, as in HTML, and Twig inside `script`, `style` and raw
  text never ends the element early.
- Twig delimiters inside `{% verbatim %}` are printed as text, so they are hidden from the markup
  reader.

Every node's range, location and text are the original template's.

## Strings

Every Twig string becomes a `TemplateLiteral` whose range covers the Twig quotes, because Twig
strings behave like JavaScript template literals: they may span lines, and double-quoted ones
interpolate with `#{ }`, which becomes an expression. Two cases stay a plain `Literal`: hash keys
such as `'class'` in `{'class': ...}`, which cannot be template literals, and strings containing a
backtick or `${`, which a template literal would read differently.

`findInterpolatedStrings(code)` returns the range of every Twig string containing `#{ }`, using only
the lexer. `eslint-plugin-twig-tailwind`'s processor uses it.

## Known limitations

- **JavaScript reserved words** used as bare Twig variables (`{{ class }}`) are renamed to a
  same-length identifier (`_lass`) so the expression parses; rules see the new name.
- **Concatenated strings** (`'c-grid--' ~ count ~ '-items'`) stay separate strings joined by `+`,
  so rules see each fixed fragment on its own.
- **Elements opened or closed in different Twig branches**, such as
  `{% if url %}<a href="{{ url }}">{% else %}<span>{% endif %}`, cannot be paired: the markup is read
  as one document, so the element appears unclosed. The branches are recorded in
  `Program.branchSegments` for rules that compare markup across them.
- **A Twig tag inside a tag name**, such as `<h{% if big %}1{% else %}2{% endif %}>`, ends the name:
  the tag is read as `h` with the Twig blocks and the digits as attributes.
- **Oxlint** cannot use this parser: it does not support custom HTML parsers yet.

## Supported Twig

Twig 3.x syntax up to 3.28, verified against real Twig:

- `test/fixtures/twig/twig-syntax.json` lists every tag, test, operator, expression form, token
  type and punctuation character Twig 3.28 defines, read from Twig's own registries by
  `tools/twig-oracle/syntax.php`. `test/syntax-coverage.test.ts` fails if the fixture templates
  do not use every one of them, or a hand-kept list of forms the registries do not name (string
  and number forms, hash keys, named arguments, whitespace control, comments, and Twig inside
  markup), or if the parser cannot convert every operator and test.
- Every fixture matches Twig 3.28.0's own tokens exactly, and its output passes the node-by-node
  checks in `test/support/output-checks.ts`: ranges, locations and text match the source, every
  string appears once, every tag and attribute is read, and every element closes.
- On about 19,000 real templates (Drupal core, contributed modules and themes) the lexer matches
  Twig on every token and the output passes the same checks, apart from elements opened or closed
  in different Twig branches and a few templates with invalid HTML.

## Upgrading Twig

1. Set the new version in `tools/twig-oracle/composer.json` and run `composer update` there.
2. `npm run syntax:twig` rewrites `twig-syntax.json`. Its diff is the list of new syntax.
3. `npm run golden:twig` rewrites the fixtures' golden token files.
4. `npm test`. Each failure names what to change:
   - **Syntax coverage:** add the new syntax to a fixture in `test/fixtures/twig`, then rerun
     step 3.
   - **Lexer parity:** the lexer tokenises something differently from Twig. Add a patch to
     `third_party/twig-lexer` (see its `UPSTREAM.md`).
   - **Operators, tests and tags:** every Twig-specific table lives in `src/twig/syntax.ts`:
     operators and their JavaScript stand-ins, two-word tests, and which tags are converted or
     deliberately left unconverted.
5. Run `npm run corpus` on real templates before releasing.

## Vendored code

Two upstream projects are kept as forks, each the same way: the upstream files byte for byte in
`third_party/<name>/pristine`, every change a separate patch with a
[DEP-3](https://dep-team.pages.debian.net/deps/dep3/) header in `third_party/<name>/patches`, and
`third_party/<name>/UPSTREAM.md` listing each change and the test that proves it.
`npm run vendor:check` fails if the shipped copy ever differs from pristine plus patches; run it in
CI.

- **twig-lexer 1.0.0** (`src/lexer`), a TypeScript port of Twig's lexer that has not been released
  since April 2024, brought up to Twig 3.28. See
  [`third_party/twig-lexer/UPSTREAM.md`](third_party/twig-lexer/UPSTREAM.md).
- **es-html-parser 0.3.2** (`src/es-html-parser`), the HTML parser behind html-eslint, taught to
  treat Twig blocks by kind and position and to close back to an open element as browsers do. See
  [`third_party/es-html-parser/UPSTREAM.md`](third_party/es-html-parser/UPSTREAM.md).

## Development

Run these from the repository root; see the [root README](https://github.com/alannapieralski/twig-eslint-parser#readme) for the rest.

| Command | What it does |
|---|---|
| `npm test -w twig-eslint-parser` | Unit, parity and ESLint tests. |
| `npm run typecheck -w twig-eslint-parser` | Type-checks the vendored code (with upstream's settings) and everything else (strict). |
| `npm run build -w twig-eslint-parser` | Compiles to `dist`. |
| `npm run test:upstream -w twig-eslint-parser` | Runs twig-lexer's and es-html-parser's own test suites against the patched code. |
| `npm run vendor:check -w twig-eslint-parser` / `vendor:write` | Checks or regenerates `src/lexer` and `src/es-html-parser` from pristine plus patches. |
| `npm run golden:twig -w twig-eslint-parser` | Regenerates the fixture golden files with real Twig (needs PHP and `composer install` in `tools/twig-oracle`). |
| `npm run syntax:twig -w twig-eslint-parser` | Regenerates `twig-syntax.json` from the installed Twig (same requirements). |
| `npm run corpus -w twig-eslint-parser` | Checks the lexer against real Twig, and the parser's output node by node, on every template in your corpus (needs PHP). See the root README. |

## Licence

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE). The lexer is derived from
twig-lexer by Eric MORAND, also Apache-2.0. The markup reader is derived from es-html-parser by
YeonJuan, and the HTML visitor keys from html-eslint, both MIT.
