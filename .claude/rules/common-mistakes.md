---
paths:
  - "packages/*/src/**"
  - "packages/*/test/**"
  - "tools/**"
---

# Common mistakes

Each one was found in review more than once. The placement ladder is in
`.claude/skills/eslint-create/references/shared-code.md`.

## Duplication

- **Search before declaring.** `git grep` the constant, regex, type or function name in
  `packages/*/src` and `tools` first. A second copy, even a slightly different one, is a defect.
- **These already have one home. Import them.**

  | Fact | Home |
  |---|---|
  | Element node types, raw-text element names, single-token node types | `twig-eslint-parser` (`src/html/syntax.ts`) |
  | Whether a Twig block opens, closes or continues a tag, and the text of a tag | `twig-eslint-parser` (`src/twig/block-roles.ts`, `tag-text.ts`) |
  | Lines, indentation and line starts in a text | `eslint-plugin-twig-html/src/shared/line-text.ts` |
  | `ignores` option schema, lower-cased element name sets | `eslint-plugin-twig-html/src/shared/ignores.ts` |
  | Elements every rule leaves alone (`script`, `style`), inline and whitespace-sensitive lists | `eslint-plugin-twig-html/src/shared/html-elements.ts` |

- **A new Twig tag or HTML element rule goes in the parser's tag tables** (`twig/syntax.ts`,
  `html/syntax.ts`), never as a local `Set` in a rule.
- **Do not build a second walker over Twig blocks.** Use the block-role predicates, and extend the
  existing walk when a new check needs the open-tag stack.
- **A type that adds fields to another derives from it** (`Omit`, `&`). Do not retype the fields.
- **A skip that applies to every rule** (such as `script` and `style`) is added once in `shared/`
  and consumed by each rule. Adding it to one rule leaves the others behind.

## Naming

A name says what a thing is or does, in the words a reader of HTML, Twig or ESLint already knows.
Someone who has never seen the file should be able to say what it holds from the name alone. If a
name needs a comment to explain it, rename it.

- **Functions are a verb and what they work on**: `findMarkupElements`, `describeSeparators`.
  **Booleans start with `is`, `has`, `can` or `should`**: `isOpeningTag`. **Types are nouns**:
  `TwigBlockSummary`.
- **Say what it means, not how it feels or how it is built.** A metaphor or a mechanism is a bad
  name. A plain description of the situation is a good one.
- **Use the same word for the same thing in every rule and package.** Check how the other rules
  name it before reusing a word with a different meaning (`ignores` means one thing everywhere).
- **Longer and plain beats short and clever.** The repo is verbose on purpose.

| Bad | Why | Better |
|---|---|---|
| `unsound`, `isInSoundTag` | Borrowed from logic. Says nothing about the tag. | `unreadable`, `isInReadableTag` |
| `swallows the markup` | A metaphor. Does not say what happens. | `takes in the markup`, `ran into the next tag` |
| `utils`, `helpers`, `common` | Says where it sits, not what it is. | Name the concept: `line-text`, `block-roles` |
| `check`, `handle`, `process`, `data`, `info`, `flag`, `temp` | Could be anything. | Say what is checked or done: `isFixable`, `findGaps` |
| `skippedElements` when every rule skips them | Hides that it is shared by all rules. | `hardSkippedElements` |

## Constants

- **A module-level constant is `SCREAMING_SNAKE_CASE`**: a value that never changes, such as a
  number, string, regular expression, list of names, `Set`, `Map` or lookup table.
  `ELEMENT_NODE_TYPES`, `MAX_PASSES`, `LEADING_INDENTATION`. The name tells a reader it is a fixed
  value, not something computed.
- **These stay `camelCase`**: functions, rule modules, plugin and config objects, ESLint `meta` and
  `messages`, option schemas and default option objects, visitor keys, and anything that is changed
  after it is created, such as a cache.
- **In an import list, constants come first, then functions, then types**:
  `import { ELEMENT_NODE_TYPES, readTwigServices, type TwigBlockSummary }`.

## Changing behaviour

- **A changed default or option is a docs and tests change in the same commit**: the options table,
  the examples, the vue or html-eslint comparison row and a test that pins the new default.
- **Do not weaken a test to make a change pass.** Turn the rule off in the test, or fix the code.
- **Run every example on a rule page through the rule** before finishing, as `CLAUDE.md` says.
