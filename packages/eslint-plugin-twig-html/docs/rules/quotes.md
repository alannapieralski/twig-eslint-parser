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
- An unquoted value (`class=flex`, `data-id={{ id }}`) is reported and wrapped in the HTML quote.
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
- a double-quoted Twig string that interpolates, such as `"a #{b}"`, since only double quotes
  interpolate
- a single-quoted Twig string containing `#{`, since double quotes would start interpolating it

It reports but does not fix:

- an attribute whose value opens a Twig block that another attribute closes, such as
  `class='a{% if x %}' data-x='{% endif %}'`, since fixing one half on its own would split the
  branch
- a value printing Twig through `|raw`, since that output is not escaped and may rely on the
  current quote
- an unquoted value holding anything other than plain text or a single Twig print, such as
  `data-a={{ theme }}{{ extra_attributes }}` or `class={% if a %}"a"{% else %}'b'{% endif %}`,
  since that Twig may print attributes or quotes of its own
- an unquoted value straight before a `/`, such as `href=a/b`, which the markup reader cuts short
  at the `/`

The markup reader also drops an unquoted value that starts with `/`, such as `href=/home`, so the
rule cannot see it yet.

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
| Value containing a template | Skipped unless `enforceTemplatedAttrValue` | Checked, since Twig is opaque to HTML and autoescaped |
| Twig strings | Not read | Checked with their own style |

## Testing

- `test/quotes.test.ts` covers both options for each kind of quote, removing escapes, every case
  the rule leaves alone or reports without fixing, Twig in tags that never become JavaScript, raw
  text, comments, `verbatim` and attributes left out by `ignoreInterpolatedAttributes`.
- `test/fix-safety.test.ts` fixes every parser fixture and checks the result changes only
  whitespace and quoting, still parses, and has as many Twig strings and interpolations as before.
- `npm run corpus -- --rule twig-html/quotes` does the same for real templates. The
  `quotes.html.twig` canary checks the fixed output exactly.

Run over 27 theme folders of real Drupal projects (4,169 templates): 2,344 values and strings were
reported in 1,152 templates. Every fixed template still parsed and was stable on a second pass.

## When not to use it

Turn it off if your templates are formatted by a tool that sets quotes.
