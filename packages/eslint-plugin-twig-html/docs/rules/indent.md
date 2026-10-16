# twig-html/indent

Indent HTML and Twig blocks one step per level of nesting.

Enabled as a warning in `configs.recommended`. Fixable.

## Rule details

Each line is indented one step for every element and every Twig block it sits inside:

- Children of an element are one step in from the element. The closing tag is in line with the
  opening tag.
- The body of a Twig block (`if`, `for`, `block`, `embed`, `macro`, `apply`, block-form `set` and
  any other tag closed by `end<name>`) is one step in from the opening tag. `else`, `elseif` and
  the `end` tag are in line with the opening tag.
- Every line of multi-line text is at the child indent.
- An attribute on its own line is one step in from the tag. If the first attribute is on the tag's
  line, the others line up with it instead (see `alignAttributesVertically`).
- A `>` or `/>` on its own line is in line with the tag (see `closeBracket`).

Each line's indentation is worked out from scratch, so a deeply wrong tree is fixed in one pass.
The fix replaces the whole leading whitespace of the line.

Examples of **incorrect** code:

```twig
<ul>
{% for item in items %}
<li>{{ item }}</li>
{% endfor %}
</ul>

{% if url %}
    <a
    href="{{ url }}"
    class="link"
        >{{ label }}</a>
{% endif %}
```

Examples of **correct** code:

```twig
<ul>
  {% for item in items %}
    <li>{{ item }}</li>
  {% else %}
    <li>{{ 'No items'|t }}</li>
  {% endfor %}
</ul>

{% if url %}
  <a
    href="{{ url }}"
    class="link"
  >{{ label }}</a>
{% endif %}

<div class="card"
     id="card-{{ id }}">
</div>
```

### Lines it leaves alone

These lines keep whatever indentation the author wrote:

- Content of `pre` and `textarea`, including the line of their closing tag, because whitespace
  there is content.
- Content of `script` and `style`, and of any element named in `ignores`. Their closing tags are
  still indented.
- Inner lines of a multi-line attribute value. `eslint-plugin-twig-tailwind` wraps `class` values
  and owns their layout.
- Inner lines of a multi-line Twig print, tag or comment, such as an `include` with an object
  literal, and of an HTML comment.
- The bodies of `{% verbatim %}` and `{% raw %}`.
- Elements opened and closed in different Twig branches, such as a conditional wrapper:

  ```twig
  {% if url %}<a href="{{ url }}">{% endif %}
    <span>{{ label }}</span>
  {% if url %}</a>{% endif %}
  ```

  The parser cannot build one tree for both branches, so the lines inside that element, and the
  Twig tags that wrap it, are not checked. Lines before and after them are.
- YAML front matter between `---` lines at the top of the file, as in Drupal help topics.
- Everything after an open tag that has no `>`, and the content of an element that is never
  closed, because the parser cannot tell where they end.

### Files it does not check

If the Twig tags in a file do not pair up, such as an `{% endif %}` with no `{% if %}` or an
`{% endfor %}` closing an `{% if %}`, nothing in the file is reported. The rule cannot know the
nesting, and guessing would move every later line.

### Working with other rules

`twig-html/attrs-newline` and `twig-html/multiline-html-element-content-newline` only insert line
breaks. This rule indents the lines they create, on the next fix pass. Keep it on with them,
otherwise their fixes leave the new lines at column 0.

## Options

The first option is the indent size: a number of spaces (default `2`) or `'tab'`. The second is an
object:

| Option | Default | Description |
|---|---|---|
| `attribute` | `1` | Steps an attribute on its own line is indented from the tag. |
| `closeBracket` | `0` | Steps a `>` or `/>` on its own line is indented from the tag. A number sets all three; an object sets `startTag` (`>`), `selfClosingTag` (`/>`) and `endTag` (the `>` of a closing tag) one by one, each defaulting to `0`. |
| `alignAttributesVertically` | `true` | When the first attribute is on the tag's line, line the other attributes up with it. When `false`, they are indented `attribute` steps from the tag. |
| `ignores` | `[]` | Leave the content of these elements alone, matched by name. Their opening and closing tags are still indented. |

```js
'twig-html/indent': ['warn', 4, { closeBracket: { selfClosingTag: 1 }, ignores: ['svg'] }],
```

## Compared with eslint-plugin-vue

The rule follows `vue/html-indent`, which indents `<template>` in `.vue` files. `@stylistic/indent`
only indents JavaScript, so it does not apply to templates. Checked against the `flat/recommended`
preset of eslint-plugin-vue 10:

| | `vue/html-indent` | `twig-html/indent` |
|---|---|---|
| Indent size | `2` | `2` |
| `attribute`, `closeBracket`, `alignAttributesVertically` | `1`, `0`, `true` | Same |
| `ignores` | AST selectors | Element names |
| `baseIndent` | `1`: children of `<template>` are indented | Not needed: Twig templates have no root wrapper, so top-level content is at column 0 |
| Twig and Vue blocks | `v-if` lives on the element, so blocks add no level | Every Twig block body adds a level |
| Expressions inside `{{ }}` | Indented like JavaScript | Inner lines left alone |
| Comments before a closing tag | May line up with the line above or the closing tag | Indented like the content around them |
| Message | `Expected indentation of 2 spaces but found 0 spaces.` | Same |

## Testing

- `test/indent.test.ts` covers nested HTML, Twig blocks with `else` and `elseif`, block, embed and
  block-form set, inline set and the short block form, whitespace control, multi-line Twig, verbatim,
  unpaired Twig, conditional wrappers and elements split across branches, each attribute and close
  bracket option, Twig between attributes, multi-line attribute values, `pre`, `textarea`, `script`,
  `style`, `ignores`, open tags missing their `>`, tabs, other sizes, Windows line endings and
  front matter and fixing a deep tree in one pass.
- `test/fix-safety.test.ts` fixes every parser fixture and checks the result changes only whitespace
  and still parses.
- `npm run corpus -- --rule twig-html/indent` does the same for real templates. The canary
  `tools/corpus/canaries/indent.twig` must report and fix to `indent.expected`.

## When not to use it

Turn it off if your templates are laid out by a formatter, or if your team does not indent the body
of Twig blocks.
