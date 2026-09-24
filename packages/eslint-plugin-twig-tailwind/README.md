# eslint-plugin-twig-tailwind

Lint Tailwind CSS classes in Twig and Drupal templates. This plugin is the glue between
[`twig-eslint-parser`](https://github.com/alannapieralski/twig-eslint-parser/tree/main/packages/twig-eslint-parser),
which reads Twig, and
[`eslint-plugin-better-tailwindcss`](https://github.com/schoero/eslint-plugin-better-tailwindcss),
which checks the classes. It adds the selectors that find classes inside Twig and Drupal
expressions, and two rules that keep Twig out of class values.

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
- the `twig-tailwind/twig` processor (see [Interpolated strings](#interpolated-strings));
- better-tailwindcss's selectors plus `drupalSelectors`;
- better-tailwindcss's recommended rules, with `enforce-consistent-line-wrapping` limited to HTML
  attributes such as `class=""`. Wrapping a string inside a Twig array or call splits it over
  lines within its quotes, which reads badly, so a long list of classes there is better split
  into more array items by hand;
- [`twig-tailwind/no-interpolated-attributes`](docs/rules/no-interpolated-attributes.md) and
  [`twig-tailwind/no-interpolated-classes`](docs/rules/no-interpolated-classes.md) as errors.

ESLint merges `settings`, so your `entryPoint` sits next to the selectors instead of replacing
them. Override any rule in your own config object as usual.

### Path aliases

Tailwind resolves `@import` with relative paths and package names only. If your CSS imports
through bundler aliases such as Vite's `@css/...`, point better-tailwindcss's `tsconfig` setting at
a tsconfig whose `paths` define the same aliases, and keep `entryPoint` on your real stylesheet:

```js
settings: {
  'better-tailwindcss': { entryPoint: 'src/css/style.css', tsconfig: 'tsconfig.json' },
},
```

An import Tailwind cannot resolve is loaded as empty without an error, so the classes it defines
are reported as unknown. That is usually the first sign an alias is missing.

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
| [`no-interpolated-classes`](docs/rules/no-interpolated-classes.md) | Disallow `#{ }` inside class strings | error |

## Interpolated strings

better-tailwindcss finds interpolation by looking for JavaScript's `${` in the source text. Twig
writes `#{`, so inside a string such as `"flex #{modifier} p-4"` it would report `#{` as an
unknown class, and its class-order fix would move the interpolation around.

The `twig-tailwind/twig` processor prevents this: it drops every better-tailwindcss message, and
with it every fix, that starts inside a Twig string containing `#{ }`. Other strings in the file
are linted and fixed as usual, and messages from other plugins are kept.
[`no-interpolated-classes`](docs/rules/no-interpolated-classes.md) then reports each such class
string once, so it is not silently skipped. An ESLint config applies one processor per file, so
if you set your own processor for `.twig` files, these strings are no longer silenced.

## Known limitations

- **Classes built by concatenation** (`'c-grid--' ~ count ~ '-items'`) are only partly visible:
  the fixed fragments are separate strings.
- **Classes computed in PHP** (preprocess functions) are not in the template and cannot be seen.
- **Oxlint** cannot run these rules on Twig: it does not support custom HTML parsers yet.

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
