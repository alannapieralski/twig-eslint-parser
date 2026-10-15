# twig-html/attrs-newline

Put each attribute of a tag with many attributes on its own line, indented one step from the tag.

Enabled as a warning in `configs.recommended`. Fixable.

## Rule details

A tag with more than 1 attribute is laid out with one attribute per line. Each attribute is
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

The fix only changes the whitespace between attributes. If anything else sits between two
attributes, such as a Twig comment, the rule reports the tag but does not fix it. The same goes for an open tag that is missing its
`>`, where the parser reads the markup after it as attributes (including when it ends up inside an unquoted value): splitting those "attributes" onto
separate lines would break the next tag.

## Options

| Option | Default | Description |
|---|---|---|
| `ifAttrsMoreThan` | `1` | Lay out a tag once it has more attributes than this. |
| `closeStyle` | `'newline'` | `'newline'` puts `>` on its own line; `'sameline'` keeps it after the last attribute. |
| `indent` | `2` | Spaces per indent step. A tag indented with tabs gets its attributes indented with one more tab. |
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
| Indent of attributes | One step from the tag | Same |
| Threshold | More than 1 attribute on one line | More than 1 (`ifAttrsMoreThan`) |
| Tag at or under the threshold | Still checked: a multi-line tag is normalised | Left alone, however it is written |
| Attribute order | `vue/attributes-order` reorders them | Never reorders |
| Self-closing void tag (`<img />`) | `vue/html-self-closing` removes the `/` | Keeps `/>` and puts it on its own line |
| Scope of the fix | Re-indents the whole element tree (`vue/html-indent`) | Changes only the whitespace between attributes |

The defaults match Vue's threshold.

## Testing

- `test/attrs-newline.test.ts` covers the layout, the options, Drupal attributes after the tag name, Twig blocks that span attributes, Twig in tag names, multi-line values, inline SVG, Windows line endings, text in `textarea`, the unfixable Twig-comment case and open tags missing their `>`.
- `test/fix-safety.test.ts` fixes every parser fixture and checks the result changes only whitespace and still parses.
- `npm run corpus -- --rule twig-html/attrs-newline` does the same for real templates, and also checks a second pass changes nothing (see the repository README).

Run over 15 real Drupal projects (17,914 templates, Drupal core and contrib included): 4,770 tags
were reported at a threshold of 2. The fix changed only whitespace in every file, every fixed template
still parsed and was stable on a second pass. The only tags left unfixed were two with a Twig comment
between attributes, as designed. One template had an unclosed tag, so it failed to parse and was
skipped.

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
