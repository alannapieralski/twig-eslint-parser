# eslint-plugin-twig-tailwind

Lint Tailwind CSS classes in Twig and Drupal templates. This plugin is the glue between
[`twig-eslint-parser`](https://github.com/alannapieralski/twig-eslint-parser/tree/main/packages/twig-eslint-parser),
which reads Twig, and
[`eslint-plugin-better-tailwindcss`](https://github.com/schoero/eslint-plugin-better-tailwindcss),
which checks the classes. It adds the selectors that find classes inside Twig and Drupal
expressions, and one rule that keeps Twig out of `class=""`.

```twig
{% set classes = ['gap-fl-sm', 'grid-cols-1'] %}
<div{{ attributes.addClass(classes).addClass('md:grid-cols-2') }}>
  {% include 'numiko:card' with { classes: ['w-full'] } only %}
</div>
```

## Installation

```sh
npm install --save-dev eslint-plugin-twig-tailwind eslint eslint-plugin-better-tailwindcss tailwindcss
```

Requires Node.js 24 or later, ESLint 9 or 10 and eslint-plugin-better-tailwindcss 4.7 or later.
The package is ESM only. `twig-eslint-parser` is installed with it.

## Usage

```js
// eslint.config.js
import twigTailwind from 'eslint-plugin-twig-tailwind';

export default [
  twigTailwind.configs.recommended,
  {
    files: ['**/*.twig'],
    settings: {
      'better-tailwindcss': { entryPoint: 'src/css/style.css' },
    },
  },
];
```

`configs.recommended` applies to `**/*.twig` and sets:

- `twig-eslint-parser` as the parser, with `ignoreInterpolatedAttributes: ['class']`;
- better-tailwindcss's selectors plus `drupalSelectors`;
- better-tailwindcss's recommended rules;
- [`twig-tailwind/no-interpolated-attributes`](docs/rules/no-interpolated-attributes.md) as an error.

ESLint merges `settings`, so your `entryPoint` sits next to the selectors instead of replacing
them. Override any rule in your own config object as usual.

`entryPoint` must be a CSS file that Tailwind can resolve on its own. Imports that only resolve
through a bundler alias (for example Vite's `@css/...`) are not followed; use relative paths in
that file, or point `entryPoint` at a small lint-only file that imports the theme relatively.

## What gets linted

| Twig | Selector |
|---|---|
| `class="..."` without Twig inside | better-tailwindcss defaults |
| `{% set classes = [...] %}`, `{% set grid_classes = '...' %}` | `twigSelectors`: variables named `classes` or ending in `_classes` |
| `{% include 'x' with { classes: [...] } %}`, `{% embed %}`, `include('x', { classes })` | `twigSelectors`: the `classes` value of the hash |
| `attributes.addClass(...)`, `.removeClass(...)` | `drupalSelectors` |
| `create_attribute({ 'class': [...] })` | `drupalSelectors` |

`drupalSelectors` includes `twigSelectors`. Both are exported as plain better-tailwindcss selector
objects, so a config for plain Twig (outside Drupal) can use `twigSelectors` instead:

```js
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults';
import twigTailwind, { twigSelectors } from 'eslint-plugin-twig-tailwind';

export default [
  twigTailwind.configs.recommended,
  {
    files: ['**/*.twig'],
    settings: {
      'better-tailwindcss': {
        entryPoint: 'src/css/style.css',
        selectors: [...getDefaultSelectors(), ...twigSelectors],
      },
    },
  },
];
```

## Rules

| Rule | Description | Recommended |
|---|---|---|
| [`no-interpolated-attributes`](docs/rules/no-interpolated-attributes.md) | Disallow Twig inside attribute values such as `class=""` | error |

## Known limitations

- **Classes built by concatenation** (`'c-grid--' ~ count ~ '-items'`) are only partly visible:
  the fixed fragments are separate strings.
- **Classes computed in PHP** (preprocess functions) are not in the template and cannot be seen.
- **Oxlint** cannot run these rules on Twig: it does not support custom HTML parsers yet.

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
