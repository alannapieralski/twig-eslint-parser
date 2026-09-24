# twig-html/attrs-newline

Put each attribute of a tag with many attributes on its own line, indented one step from the tag.

Enabled as a warning in `configs.recommended`. Fixable.

## Rule details

A tag with more than 2 attributes is laid out with one attribute per line. Each attribute is
indented one step (2 spaces by default) from the line the tag starts on, and the closing `>` or
`/>` goes on its own line, in line with the tag.

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

<a href="{{ url }}" class="flex">
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
are kept as they are.

The fix only changes the whitespace between attributes. If anything else sits between two
attributes, such as a Twig comment, the rule reports the tag but does not fix it.

## Options

| Option | Default | Description |
|---|---|---|
| `ifAttrsMoreThan` | `2` | Lay out a tag once it has more attributes than this. |
| `closeStyle` | `'newline'` | `'newline'` puts `>` on its own line; `'sameline'` keeps it after the last attribute. |
| `indent` | `2` | Spaces per indent step. A tag indented with tabs gets its attributes indented with one more tab. |

```js
'twig-html/attrs-newline': ['warn', { ifAttrsMoreThan: 3, closeStyle: 'sameline' }],
```

## When not to use it

Turn it off if your templates are laid out by a formatter.
