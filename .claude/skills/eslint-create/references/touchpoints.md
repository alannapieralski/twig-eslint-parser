# Touchpoints for a rule

A rule is not finished until every row is done. `eslint-review` checks the same list.

| # | Touchpoint | Where |
|---|---|---|
| 1 | Rule folder | `packages/<plugin>/src/rules/<rule>/` (see `rule-anatomy.md`) |
| 2 | Registered in the plugin | `src/index.ts` `rules` map, and the recommended config with its severity |
| 3 | Docs page | `docs/rules/<rule>.md` |
| 4 | Plugin README | row in the Rules table, with recommended severity and fixable |
| 5 | Root README | the package table lists rule names: add the new one |
| 6 | Rule tests | `test/<rule>.test.ts` (a plugin that tests whole configs may cover a rule in `test/integration/`) |
| 7 | Fix-safety test | a fixable rule is added to `test/fix-safety.test.ts` (or `test/integration/fix-safety.test.ts`) |
| 8 | Corpus declaration | `test/corpus.ts`: a fixable rule states `fixKeeps` (`'layout'`, `'class-tokens'` or `'code'`). Rules are otherwise picked up automatically |
| 9 | Canary | a template in `tools/corpus/canaries` the rule must report, listed in `expectations.json` (`reports`, `clean`, and `output` for a fixer) |
| 10 | Corpus run | `npm run corpus -- --rule <name> --sample 20`, samples read |
| 11 | Commit | `feat(<plugin prefix>): ...`, message format from the `conventional-commit` skill, committed only when the user agrees |

## Docs page headings

Follow `docs/rules/quotes.md` and `docs/rules/attrs-newline.md`:

1. `# <short-plugin-name>/<rule>` then one sentence matching `meta.docs.description`.
2. A line saying whether it is enabled in the recommended config, at what severity, and whether it
   is fixable.
3. `## Rule details`: what it checks, then "Examples of **incorrect** code" and "Examples of
   **correct** code" in `twig` fences.
4. Subsections for each behaviour a reader could be surprised by, including "When it leaves a
   value alone" and what it reports without fixing, each with the reason.
5. `## Options`, when the rule has options: a table of option, default and description, then a
   config snippet.
6. `## Compared with ...` when a similar rule exists elsewhere.
7. `## Testing`: which tests and canary cover it.
8. `## When not to use it`.

The docs, the `meta` and the tests must agree: every "reports but does not fix" case in the docs
has a test, and every option in the schema is in the options table.
