# twig-tailwind/no-interpolated-classes

Disallow Twig interpolation (`#{ }`) inside class strings, so every class stays visible to linting.

Enabled as an error in `configs.recommended`.

## Rule details

`"card #{modifier}"` hides part of the value from every linter: nothing can know what the Twig
produces. better-tailwindcss also misreads the string, because it only recognises JavaScript's
`${`. The recommended config's processor silences better-tailwindcss inside these strings, and
this rule reports each one instead, pointing to an array.

A string counts as a class string when the `selectors` setting would lint it: by default, a
variable named `classes` or ending in `_classes`, the `classes` value passed to `include` or
`embed`, the arguments of `addClass()` and `removeClass()`, and the `class` value passed to
`create_attribute()`. Strings used only as a condition, such as the test of a ternary, are ignored.

Examples of **incorrect** code:

```twig
{% set classes = ["card", "card--#{variant}"] %}
<div{{ attributes.addClass("flex #{modifier}") }}>
{% include 'numiko:card' with { classes: "c-#{variant}" } only %}
```

Examples of **correct** code:

```twig
{% set classes = ['card', is_featured ? 'card--featured'] %}
<div{{ attributes.addClass(['flex', modifier]) }}>
{% include 'numiko:card' with { classes: [variant == 'dark' ? 'c-dark' : 'c-light'] } only %}
{% set title = "Hello #{name}" %}
```

## When not to use it

Turn the rule off if you rely on interpolated class strings and accept that their classes go
unchecked. The processor still keeps better-tailwindcss from misreading them.
