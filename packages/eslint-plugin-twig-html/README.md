# eslint-plugin-twig-html

ESLint rules for the HTML in Twig and Drupal templates. The rules read the markup through
[`twig-eslint-parser`](https://github.com/alannapieralski/twig-eslint-parser/tree/main/packages/twig-eslint-parser)
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

`configs.recommended` applies to `**/*.twig`, sets `twig-eslint-parser` as the parser and turns on
`twig-html/attrs-newline` as a warning. It works next to `eslint-plugin-twig-tailwind`'s recommended
config, which uses the same parser.

## Rules

| Rule | Description | Recommended | Fixable |
|---|---|---|---|
| [`attrs-newline`](docs/rules/attrs-newline.md) | Put each attribute of a tag with more than 2 attributes on its own line, indented one step from the tag | warn | yes |

## Why not @html-eslint's rules

[`@html-eslint/eslint-plugin`](https://html-eslint.org) has an `attrs-newline` rule, and it runs on
Twig through this parser. Its fix only adds line breaks and leaves indentation to its `indent`
rule, so attributes end up at column 0. That `indent` rule does not know about Twig blocks: it
removes the indentation `{% if %}` and `{% for %}` add to the HTML inside them. Its fix also
rebuilds the tag from the attributes it parsed, which drops a Twig comment written between two
attributes. `twig-html/attrs-newline` indents from the tag itself and only ever changes the
whitespace between attributes.

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
