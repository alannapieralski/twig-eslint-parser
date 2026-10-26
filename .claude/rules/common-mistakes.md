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

- Do not use "swallow" or "unsound". Say an open tag is **unreadable**, or that a tag **takes in**
  the markup after it.
- A name that says how an option works, such as `ignores`, means the same in every rule. Check the
  other rules before reusing it with a different meaning.

## Changing behaviour

- **A changed default or option is a docs and tests change in the same commit**: the options table,
  the examples, the vue or html-eslint comparison row and a test that pins the new default.
- **Do not weaken a test to make a change pass.** Turn the rule off in the test, or fix the code.
- **Run every example on a rule page through the rule** before finishing, as `CLAUDE.md` says.
