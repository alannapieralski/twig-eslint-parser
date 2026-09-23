# twig-tailwind/no-interpolated-attributes

Disallow Twig inside attribute values such as `class=""`, so every class stays visible to linting.

Enabled as an error in `configs.recommended`.

## Rule details

`class="flex {{ modifier }}"` hides classes from every linter: nothing can know what the Twig
produces. This rule reports Twig (`{{ }}` or `{% %}`) inside `class=""` and points to the
alternatives, `{% set classes = [...] %}` with `attributes.addClass()`, or `{ classes: [...] }`
passed to an include.

Examples of **incorrect** code:

```twig
<div class="card {{ modifier }}">
<p class="flex {% if active %}font-bold{% endif %}">
```

Examples of **correct** code:

```twig
{% set classes = ['card', is_featured ? 'card--featured'] %}
<div{{ attributes.addClass(classes) }}>

{% include 'numiko:card' with { classes: ['w-full', modifier] } only %}
```

The rule also reports attributes that the parser's `ignoreInterpolatedAttributes` option leaves out
of the HTML AST (it reads them from the parser services). With the recommended config,
better-tailwindcss stays quiet about `{{` and BEM fragments, and each such attribute is reported
once by this rule.

## Options

| Option | Default | Description |
|---|---|---|
| `attributes` | `['class']` | Attribute names (case-insensitive) to check. |

```js
'twig-tailwind/no-interpolated-attributes': ['error', { attributes: ['class', 'style'] }],
```

## When not to use it

Turn the rule off for templates you do not control (for example copies of Drupal core templates)
if rewriting them is not an option.
