# twig-html/attrs-newline

Put each attribute of a tag with many attributes on its own line.

Enabled as a warning in `configs.recommended`. Fixable.

## Rule details

A tag with more than 1 attribute is laid out with one attribute per line, and the closing `>` or
`/>` goes on its own line. The rule only places the line breaks: it accepts any indentation on those
lines, and each line its fix creates starts at the indentation of the tag's line.
[`twig-html/indent`](indent.md) then indents the new lines on the next fix pass, one step in from the
tag with `>` in line with it. Keep `indent` on with this rule, as `configs.recommended` does.

Examples of **incorrect** code:

```twig
<button type="button" class="flex items-center" aria-controls="accordion-{{ id }}">

<button type="button"
        class="flex items-center"
        aria-controls="accordion-{{ id }}">
```

Examples of **correct** code:

```twig
<button
  type="button"
  class="flex items-center"
  aria-controls="accordion-{{ id }}"
>

<a href="{{ url }}">
```

What counts as one attribute:

- Every HTML attribute, including ones whose value contains Twig (`id="item-{{ id }}"`).
- Drupal attributes printed straight after the tag name, such as `<div{{ attributes }}>`,
  `<legend{{ legend.attributes }}>` or `<div{{ create_attribute(...) }}>`, and conditional
  attributes such as `<div{% if id %} id="{{ id }}"{% endif %}>`. They move to their own line like
  any other attribute, which renders the same HTML.
- A Twig block that spans several attributes, such as `{% if checked %}checked disabled{% endif %}`.
  It stays together on one line.

Twig that builds the tag name, such as `<h{{ level }}>` or `<{{ html_element }}>`, stays on the
tag's line and is not counted as an attribute.

`<script>` and `<style>` tags are checked too. Attribute values that already span several lines
are kept as they are. Tags inside an inline `<svg>` are left alone (see `ignoreInside`), and
`<textarea>` and `<title>` content is text, so the rule never reads markup there.

The line breaks it inserts match the file: a template with Windows line endings (`\r\n`) keeps
them.

The fix only changes the whitespace between attributes, and never adds an indent step of its own. If anything else sits between two
attributes, such as a Twig comment, the rule reports the tag but does not fix it. The same goes for an open tag that is missing its
`>`, where the parser reads the markup after it as attributes (including when it ends up inside an unquoted value): splitting those "attributes" onto
separate lines would break the next tag.

## Options

| Option | Default | Description |
|---|---|---|
| `ifAttrsMoreThan` | `1` | Lay out a tag once it has more attributes than this. |
| `closeStyle` | `'newline'` | `'newline'` puts `>` on its own line; `'sameline'` keeps it after the last attribute. |
| `ignoreInside` | `['svg']` | Leave tags inside these elements, and the elements themselves, alone. Inline SVG puts many short tags on one line, and one attribute per line would make it much longer for no gain. Set `[]` to lay SVG out too. |

```js
'twig-html/attrs-newline': ['warn', { ifAttrsMoreThan: 2, closeStyle: 'sameline' }],
```

## Compared with eslint-plugin-vue

The rule follows the layout `vue/max-attributes-per-line`, `vue/first-attribute-linebreak` and
`vue/html-closing-bracket-newline` produce, so `.vue` and `.twig` files look alike. Checked against
the `flat/recommended` preset of eslint-plugin-vue 10:

| | `vue` | `twig-html/attrs-newline` |
|---|---|---|
| Tag with more attributes than the threshold | One attribute per line, `>` on its own line | Same layout |
| Indent of attributes | One step from the tag (`vue/html-indent`) | One step from the tag (`twig-html/indent`) |
| Threshold | More than 1 attribute on one line | More than 1 (`ifAttrsMoreThan`) |
| Tag at or under the threshold | Still checked: a multi-line tag is normalised | Left alone, however it is written |
| Attribute order | `vue/attributes-order` reorders them | Never reorders |
| Self-closing void tag (`<img />`) | `vue/html-self-closing` removes the `/` | Keeps `/>` and puts it on its own line |
| Scope of the fix | Line breaks only; `vue/html-indent` indents | Line breaks only; `twig-html/indent` indents |

The defaults match Vue's threshold.

## Testing

- `test/attrs-newline.test.ts` covers the layout, the options, Drupal attributes after the tag name, Twig blocks that span attributes, Twig in tag names, multi-line values, inline SVG, Windows line endings, text in `textarea`, the unfixable Twig-comment case and open tags missing their `>`.
- `test/fix-safety.test.ts` fixes every parser fixture and checks the result changes only whitespace and still parses.
- `npm run corpus -- --rule twig-html/attrs-newline` does the same for real templates, and also checks a second pass changes nothing (see the repository README).

## When not to use it

Turn it off if your templates are laid out by a formatter.

`configs.recommended` skips `**/*.svg.twig`, for the same reason the rule leaves inline SVG alone.
The skipped files get no parser either, so to lint them anyway, reuse the whole recommended config
for them and let the rule into SVG:

```js
// eslint.config.js
import twigHtml from 'eslint-plugin-twig-html';

export default [
  twigHtml.configs.recommended,
  {
    ...twigHtml.configs.recommended,
    files: ['**/*.svg.twig'],
    ignores: [],
    rules: { 'twig-html/attrs-newline': ['warn', { ignoreInside: [] }] },
  },
];
```
