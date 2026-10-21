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

Defined in `.claude/rules/docs.md`. Follow it, and the rule pages already written.

The docs, the `meta` and the tests must agree: every "reports but does not fix" case in the docs
has a test, and every option in the schema is in the options table.
