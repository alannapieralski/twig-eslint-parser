---
name: corpus-check
description: Run the parser and every rule against the real Twig templates listed in corpus.config.json and read the report. Use after adding or changing a rule, changing the parser or lexer, or before a release.
---

### When to run it

- After adding or changing a rule: `npm run corpus -- --rule <name> --sample 20`.
- After changing one package: `npm run corpus -w <package>`.
- After changing the lexer or parser: `npm run corpus` (about 3 minutes).
- Before a release: `npm run corpus -- --slow --strict` (adds the whole-config checks, about 15
  minutes, and fails on large swings against the last run).
- For a fast pass while iterating: `npm run corpus -- --quick`.

If `corpus.config.json` is missing, copy `corpus.config.example.json` and ask the user which project
folders to list. Never write real project names or paths into a committed file.

### Reading the result

1. Read `corpus-report/summary.md`. A check with new failures is a regression to fix. Also read
   "Changes since the last run": a rule whose reports or fixes swing, or drop to zero, needs an
   explanation even when nothing fails, and "Canaries" for pending ones that now pass.
2. Read "Line coverage: parser/line-coverage": the share of template lines the parser reads
   correctly, with 100% as the goal. A fall is a regression to explain. It names the templates with
   the most lines not read, with the span and cause (`unparseable`, `twig-unconverted`, `unread`,
   `misread`, `misplaced`, `malformed-node`), and `corpus-report/coverage.ndjson` has every template.
   Lines marked "not scored" are branch splits (markup opened and closed in different Twig branches)
   and template defects (stray or missing tags a browser reads the same way). They are listed and
   counted but are not parser faults, so sample them now and then to check the buckets are honest.
3. For failed fixes, open `corpus-report/failures/<check>/` for the before and after diff.
4. For a new or changed rule, open `corpus-report/samples/<rule>/` and judge whether the fixes are
   right, not only whether they are safe. Passing checks do not prove a fix is correct.
5. To go through every report, read or grep `corpus-report/findings.ndjson`. Status is `report`
   (the rule fired), `new` (an unaccepted failure) or `known` (in the baseline).
6. Only record failures with `npm run corpus -- --update-baseline` when the user has agreed they are
   accepted, such as a template that is not valid HTML. Otherwise fix the cause.

### Keep it public-safe

The repository is published. Reports, the config and the baseline are git-ignored. Do not copy
template content, paths or project names from the report into docs, tests, fixtures or commits.
Describe findings generically. Fixtures must not copy Drupal core text (GPL).

### Adding a rule

A rule exported from a plugin is picked up automatically. Add it to the `rules` map in that
package's `test/corpus.ts` only to declare a stronger promise, such as `fixKeeps: 'whitespace'`.
