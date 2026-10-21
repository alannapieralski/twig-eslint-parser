# eslint-plugin-twig-html

ESLint rules for the HTML layout and quoting in Twig templates. The rules read the markup through
[`twig-eslint-parser`](https://github.com/alannapieralski/twig-lint/tree/main/packages/twig-eslint-parser)
and understand Twig blocks, so their fixes keep Twig nesting and Twig inside tags intact.

```twig
<button
  type="button"
  class="flex items-center"
  aria-controls="accordion-{{ id }}"
>
```

## Installation

```sh
npm install --save-dev eslint-plugin-twig-html eslint
```

Requires Node.js 24 or later and ESLint 9 or 10. The package is ESM only. `twig-eslint-parser` is
installed with it.

## Usage

```js
// eslint.config.js
import twigHtml from 'eslint-plugin-twig-html';

export default [twigHtml.configs.recommended];
```

`configs.recommended` applies to `**/*.twig` except `**/*.svg.twig`, sets `twig-eslint-parser` as the parser and turns on
`twig-html/attrs-newline`, `twig-html/indent`, `twig-html/multiline-html-element-content-newline` and `twig-html/quotes` as warnings. It works next to `eslint-plugin-twig-tailwind`'s recommended
config, which uses the same parser. That config leaves `class` attributes containing Twig out of the tree; every `twig-html` rule
still counts them, checks their quotes and leaves their values alone.

## Rules

| Rule | Description | Recommended | Fixable |
|---|---|---|---|
| [`attrs-newline`](docs/rules/attrs-newline.md) | Put each attribute of a tag with many attributes on its own line | warn | yes |
| [`indent`](docs/rules/indent.md) | Indent HTML and Twig blocks one step per level of nesting | warn | yes |
| [`multiline-html-element-content-newline`](docs/rules/multiline-html-element-content-newline.md) | Require a line break before and after the content of a multi-line element | warn | yes |
| [`quotes`](docs/rules/quotes.md) | Use double quotes around HTML attribute values and single quotes around Twig strings, each configurable | warn | yes |

## Why not @html-eslint's rules

[`@html-eslint/eslint-plugin`](https://html-eslint.org) has `attrs-newline` and `indent` rules, and
they run on Twig through this parser. This plugin splits the work the same way: the layout rules
only place line breaks and `twig-html/indent` owns indentation. The difference is Twig: html-eslint's
`indent` rule does not know about Twig blocks, so it removes the indentation `{% if %}` and
`{% for %}` add to the HTML inside them, and its `attrs-newline` fix rebuilds the tag from the
attributes it parsed, which drops a Twig comment written between two attributes.
`twig-html/indent` indents the body of every Twig block, and `twig-html/attrs-newline` only ever
changes the whitespace between attributes, reporting without fixing a tag that has a Twig comment between its attributes.

## Known limitations

Each rule's page lists what it leaves alone and why. The gaps still to build:

- **`indent` does not lay out the inside of multi-line Twig**, such as the parameters of an
  `{% include 'x' with { ... } %}` written over several lines. See [`indent`](docs/rules/indent.md#lines-it-leaves-alone).
- **Elements opened or closed in different Twig branches** are never fixed across a branch, by any rule.
- **Open tags missing their `>`** are a parsing error, except when an unquoted value runs into the next tag
  (`<li id=b<span>`), where the parser swallows the markup after it. The rules never fix those.
- Other limits come from the parser: see
  [its known limitations](https://github.com/alannapieralski/twig-lint/tree/main/packages/twig-eslint-parser#known-limitations).

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
