# twig-html/multiline-tag-content

Put the content of a tag on its own lines when the opening tag already spans several lines.

Enabled as a warning in `configs.recommended`. Fixable.

## Rule details

When `<h2` and its `>` are on different lines, the content goes between them and the closing tag on
lines of their own: the content one step in from the tag, the closing tag in line with it. This is
the layout `twig-html/attrs-newline` produces for a tag with several attributes, so the two rules
finish each other's job: `attrs-newline` breaks the opening tag, this rule then lifts the content
off the `>` line.

Examples of **incorrect** code:

```twig
<h2
  id="system-breadcrumb"
  class="sr-only"
>You are here:</h2>

<ul
  class="list"
  id="menu"
><li>{{ item }}</li></ul>
```

Examples of **correct** code:

```twig
<h2
  id="system-breadcrumb"
  class="sr-only"
>
  You are here:
</h2>

<div
  class="swiper-pagination"
  data-js-gallery-pagination
></div>

<h2 id="a" class="b">Short tags stay as they are</h2>
```

What it leaves alone:

- A tag whose opening tag is on one line, however long its content.
- A tag with no content, or only whitespace: `></div>` is fine.
- `<pre>` and `<textarea>`, where whitespace is content.
- Any tag not known to be block-level, where a line break after `>` or before the closing tag may render as a space inside the element. That covers inline elements such as `<a>`, `<span>`, `<button>` and `<label>`, custom elements, unknown tags, and tags whose name is Twig, such as `<{{ element }}>` or `<h{{ level }}>`, since Twig may render them as an inline element. The rule only fixes standard block elements (`div`, `p`, `ul`, `li`, `h1` to `h6`, `section`, table parts and the like) and SVG containers.
- `<script>` and `<style>`, which this rule does not check (`attrs-newline` does).
- Tags with no closing tag, such as `<img>`, and tags inside an inline `<svg>` (see `ignoreInside`).
- An open tag that is missing its `>`, where the parser reads the markup after it as attributes.

The rule only checks that a line break sits between the `>` and the content, and between the content
and the closing tag. It does not re-indent content that is already on its own lines, and it does not
re-indent child tags it moves. Content that already starts on a new line is accepted at any indentation.

The fix only changes HTML whitespace (space, tab, line feed, carriage return and form feed), so a non-breaking space at the edge of the content is kept. It uses the file's line endings (`\r\n` stays `\r\n`) and indents with
tabs when the tag is indented with tabs.

## Options

| Option | Default | Description |
|---|---|---|
| `indent` | `2` | Spaces per indent step. A tag indented with tabs gets its content indented with one more tab. |
| `ignoreInside` | `['svg']` | Leave tags inside these elements, and the elements themselves, alone. Set `[]` to lay SVG out too. |

```js
'twig-html/multiline-tag-content': ['warn', { indent: 4 }],
```

## Why not @html-eslint's `element-newline`

`@html-eslint/element-newline` treats text as inline, and only breaks after the opening tag when a
child is a block-level element. `<h2>text</h2>` is left alone and `<div><p>x</p></div>` is split, so
it cannot express "any content goes on its own line". This rule keys off the opening tag instead:
once it is multi-line, the content follows.

## Testing

- `test/multiline-tag-content.test.ts` covers the layout, empty and whitespace-only tags, each side being fixed on its own, indentation from the tag's line, tabs, Windows line endings, `pre`, `textarea`, inline elements, custom and unknown tags and tags named by Twig, `script` and `style`, non-breaking spaces, inline SVG, tags without a closing tag, open tags missing their `>` and the interplay with `attrs-newline`.
- `test/fix-safety.test.ts` fixes every parser fixture and checks the result changes only whitespace and still parses.
- `npm run corpus -- --rule twig-html/multiline-tag-content` does the same for real templates.

## When not to use it

Turn it off if your templates are laid out by a formatter, or if you prefer `>text</h2>` after a
multi-line opening tag.
