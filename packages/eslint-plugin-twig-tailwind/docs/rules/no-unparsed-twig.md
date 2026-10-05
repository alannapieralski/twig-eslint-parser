# twig-tailwind/no-unparsed-twig

Report Twig blocks the parser could not read, so the classes inside them are not skipped silently.

Enabled as an error in `configs.recommended`.

## Rule details

The parser reads every `{{ }}` and `{% %}` block as JavaScript of the same length. A block that
cannot be read that way is left out of the AST and listed in the parser services as an unconverted
block, so no rule sees the class strings inside it. This rule reports each one with the reason, so
the gap is visible instead of silent.

A block usually cannot be read because it is not valid Twig, which Twig itself would reject when it
renders the template.

Examples of **incorrect** code:

```twig
{{ title subtitle }}
{% set classes = ['flex' 'gap-4'] %}
```

Examples of **correct** code:

```twig
{{ title ~ subtitle }}
{% set classes = ['flex', 'gap-4'] %}
```

Invalid Twig that stops tokenising altogether, such as an unclosed `{{`, is not reported by this
rule: ESLint reports it as a parsing error.

## When not to use it

If a template uses valid Twig that the parser cannot read yet, turn the rule off for that file and
report the expression as a parser issue.
