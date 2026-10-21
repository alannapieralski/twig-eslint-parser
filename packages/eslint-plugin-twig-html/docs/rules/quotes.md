# twig-html/quotes

Enforce one quote style for HTML attribute values and another for Twig strings.

Enabled as a warning in `configs.recommended`. Fixable.

## Rule details

A Twig template holds two kinds of quoted text, and this rule sets the style of each separately:

- **HTML attribute values**, double quotes by default.
- **Twig string literals**, single quotes by default.

With the defaults, a Twig string inside an attribute never uses the attribute's quote, so
`class="{{ 'a' }}"` reads clearly.

Examples of **incorrect** code:

```twig
<a class='flex' href={{ url }}>{{ "Home"|t }}</a>

{% include "@theme/card.html.twig" with { "title": title } %}
```

Examples of **correct** code:

```twig
<a class="flex" href="{{ url }}">{{ 'Home'|t }}</a>

{% include '@theme/card.html.twig' with { 'title': title } %}

<a title='Say "hi"'>{{ "it's" }}</a>
```

### HTML attribute values

- Every attribute of every tag is checked, `<script>` and `<style>` tags included. Attributes left
  out of the AST by the parser option `ignoreInterpolatedAttributes`, such as `class` under
  `eslint-plugin-twig-tailwind`'s recommended config, are still checked.
- Twig inside a value is opaque to HTML. In `class='{{ "a" }}'` only the outer quotes are HTML
  quotes, so the rule never reads quotes inside Twig as part of the value.
- An unquoted value (`class=flex`, `data-id={{ id }}`) is reported. It is wrapped in the HTML quote
  only when it is plain text without quotes, `=`, `<`, `>` or backticks.
- Quotes in text, comments, `<script>` and `<style>` content, and `<textarea>` and `<title>` text
  have no meaning to HTML, so they are left alone. So are DOCTYPE identifiers.

### Twig strings

Every string the Twig lexer reads is checked. That includes:

- tags that never become JavaScript nodes, such as `{% extends %}`, `{% import %}`, `{% trans %}`
  and `{% cache %}`
- hash keys
- strings inside `#{ }` interpolation, each checked on its own
- Twig inside `<script>`, `<style>` and HTML comments

Strings in `{# #}` comments and `{% verbatim %}` are text to Twig, so they are left alone.

Switching quotes removes escapes that are no longer needed, so `'it\'s'` becomes `"it's"`. Other
escapes, such as `\n` or `\x41`, mean the same in both kinds of string and are kept.

### When it leaves a value alone

The rule never adds an escape, and never changes what a template renders. It does not report:

- a value or string that contains the wanted quote, such as `title='say "hi"'` or `{{ "it's" }}`
- with `twig: 'single'`, a double-quoted Twig string that interpolates, such as `"a #{b}"`, since only
  double quotes interpolate
- with `twig: 'double'`, a single-quoted Twig string containing `#{`, since double quotes would start
  interpolating it

It reports but does not fix:

- an attribute whose value opens a Twig block that another attribute closes, such as
  `class='a{% if x %}' data-x='{% endif %}'`, since fixing one half on its own would split the
  branch
- a quoted value holding Twig that prints, such as `{{ x }}`, `{{ 'Say "hi"'|t }}`, `|raw` or
  `{% include %}`, since Drupal markup, `|raw` and included templates are not escaped and may
  print the new quote. Only comments and `if` and `for` tags (with their `else`, `elseif` and end tags) are allowed around the value's text
- an unquoted value holding any Twig, such as `data-id={{ id }}` or
  `class={% if a %}"a"{% else %}'b'{% endif %}`, since that Twig may print spaces, attributes or
  quotes of its own
- an attribute in an open tag that swallowed the markup after it, such as `<li id=b<span>`, where the `li`
  open tag has no `>` of its own, since the parser has misread where that tag ends

## Options

| Option | Default | Description |
|---|---|---|
| `html` | `'double'` | `'double'` or `'single'`: the quote around HTML attribute values. |
| `twig` | `'single'` | `'single'` or `'double'`: the quote around Twig strings. |

```js
'twig-html/quotes': ['warn', { html: 'double', twig: 'single' }],
```

## Compared with @html-eslint's quotes

The HTML half follows [`@html-eslint/quotes`](https://html-eslint.org/docs/rules/quotes):

| | `@html-eslint/quotes` | `twig-html/quotes` |
|---|---|---|
| Default HTML quote | Double | Double |
| Value containing the wanted quote | Left alone | Left alone |
| Unquoted value | Reported and wrapped | Reported, and wrapped when that cannot change the output |
| Value containing a template | Skipped unless `enforceTemplatedAttrValue` | Checked, since Twig is opaque to HTML, and fixed only when the Twig prints nothing |
| Twig strings | Not read | Checked with their own style |

## Testing

- `test/quotes.test.ts` covers both options for each kind of quote, removing escapes, every case
  the rule leaves alone or reports without fixing, Twig in tags that never become JavaScript, raw
  text, comments, `verbatim` and attributes left out by `ignoreInterpolatedAttributes`.
- `test/fix-safety.test.ts` fixes every parser fixture with the default and the opposite options,
  and checks the result changes only HTML quotes, Twig string delimiters and quote escapes, still
  parses, and has as many Twig strings and interpolations as before.
- `npm run corpus -- --rule twig-html/quotes` does the same for real templates. The
  `quotes.html.twig` canary checks the fixed output exactly.

## When not to use it

Turn it off if your templates are formatted by a tool that sets quotes.
