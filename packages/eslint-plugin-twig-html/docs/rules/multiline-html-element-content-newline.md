# twig-html/multiline-html-element-content-newline

Require a line break before and after the content of a multi-line element.

Enabled as a warning in `configs.recommended`. Fixable.

This is the Twig version of
[`vue/multiline-html-element-content-newline`](https://eslint.vuejs.org/rules/multiline-html-element-content-newline.html),
with the same name, options, defaults and messages, so Twig and Vue templates in one project are laid out the same way.

## Rule details

An element is multi-line when its closing tag starts on a later line than its opening tag. Its content then
goes on lines of its own, with exactly one line break after the `>` of the opening tag and one before the closing tag.
This is the layout `twig-html/attrs-newline` produces for a tag with several attributes, so the two rules
finish each other's job.

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

<p>Some
  text</p>

<div class="a">

  text

</div>

<div
  class="swiper-pagination"
>

</div>
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
></div>

<div
  class="swiper-pagination"
>
</div>

<h2 id="a" class="b">Elements on one line stay as they are</h2>
```

What it leaves alone:

- An element that starts and ends on one line, however long its content.
- An empty element, `></div>`, unless `ignoreWhenEmpty` is off. Whitespace-only content is not empty: it is
  reduced to one line break, as in Vue, so `>\n\n</div>` becomes `>\n</div>`.
- Elements in `ignores`, and everything inside them. By default that is `pre`, `textarea` and the inline elements
  Vue lists (`a`, `span`, `strong`, `label`, `svg` and the like), where a line break may render as a space.
- Tags whose name is Twig, such as `<{{ element }}>` or `<h{{ level }}>`, since Twig may render them as an inline element.
  Vue has no equivalent.
- `<script>` and `<style>`, which this rule does not check (`attrs-newline` does).
- Tags with no closing tag, such as `<img>`.
- An open tag that is missing its `>`, where the parser reads the markup after it as attributes.

Vue's fix inserts a bare line break and leaves indentation to `vue/html-indent`. Twig has no such rule, so this fix
indents too: content one step in from the line the tag starts on, the closing tag in line with it. When it removes
blank lines it keeps the indentation already there. It does not re-indent content that is already on its own lines,
or child tags it moves.

The fix only changes HTML whitespace (space, tab, line feed, carriage return and form feed), so a non-breaking space at
the edge of the content is kept. It uses the file's line endings (`\r\n` stays `\r\n`) and indents with tabs when the
tag is indented with tabs.

## Options

| Option | Default | Description |
|---|---|---|
| `ignores` | `['pre', 'textarea', ...inline elements]` | Leave these elements, and everything inside them, alone. Setting it replaces the whole list, as in Vue. |
| `ignoreWhenEmpty` | `true` | Leave elements with no content at all alone. When `false`, `></div>` becomes `>\n</div>`. |
| `allowEmptyLines` | `false` | Allow blank lines around the content. Only a missing line break is reported. |
| `indent` | `2` | Spaces per indent step for the fix. A tag indented with tabs gets its content indented with one more tab. Not in Vue. |

```js
'twig-html/multiline-html-element-content-newline': ['warn', { allowEmptyLines: true }],
```

## Why not @html-eslint's `element-newline`

`@html-eslint/element-newline` treats text as inline, and only breaks after the opening tag when a
child is a block-level element. `<h2>text</h2>` is left alone and `<div><p>x</p></div>` is split, so
its output differs from Vue's. This rule follows Vue, so both kinds of template end up the same.

## Testing

- `test/multiline-html-element-content-newline.test.ts` covers the layout, empty and whitespace-only elements, blank lines, each option, each side being fixed on its own, indentation from the tag's line, tabs, Windows line endings, ignored elements and their contents, custom and unknown tags, tags named by Twig, `script` and `style`, non-breaking spaces, inline SVG, tags without a closing tag, open tags missing their `>` and the interplay with `attrs-newline`.
- `test/fix-safety.test.ts` fixes every parser fixture and checks the result changes only whitespace and still parses.
- `npm run corpus -- --rule twig-html/multiline-html-element-content-newline` does the same for real templates.

## When not to use it

Turn it off if your templates are laid out by a formatter, or if you prefer `>text</h2>` after a
multi-line opening tag.
