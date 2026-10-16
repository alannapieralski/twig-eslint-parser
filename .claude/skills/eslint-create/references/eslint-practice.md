# What similar projects teach

Distilled from the sources linked at the end, for decisions the other references do not cover.
ESLint's docs for older major versions carry end-of-life banners, so check the current docs when a
detail matters.

## ESLint's own guidance

- A rule exports `meta` and `create(context)`. `create` returns visitors: node types or
  selectors, `Node:exit` for checks that need the children first.
- `meta.type` is `problem`, `suggestion` or `layout`. `meta.fixable` is required if the rule ever
  fixes. `meta.hasSuggestions` is required if it offers suggestions.
- Report with `messageId` and `data`. Tests assert on the id, not the text.
- A rule with options must declare `meta.schema`. An empty array means no options are allowed.
- `context.options` excludes the severity. Use `context.sourceCode` rather than the deprecated
  methods on `context`.
- Fixes: minimal, one per report, no overlapping edits, no changes to behaviour. Do not try to
  match the author's quotes or semicolons: ESLint re-runs rules, up to ten passes.
- Suggestions are never applied automatically and need their own `desc` or `messageId`.
- `meta.defaultOptions` (ESLint 9.15 and later) merges user options over defaults. This repo's
  peer range starts at 9.0, so rules merge defaults themselves.
- Performance: `TIMING=1 npx eslint ...` lists the slowest rules.
- Explore trees in the [Code Explorer](https://explorer.eslint.org).

## eslint-plugin-better-tailwindcss (its AGENTS.md is the closest model)

- A rule change touches a fixed list: implementation, tests, registration, docs page, README table.
  Skipping one drifts CI and docs.
- Rule metadata is explicit: category, recommended, autofix. Stylistic rules warn, correctness
  rules error.
- Schema keys are alphabetical and strict, so unknown options are rejected.
- Autofix only when the transformation is deterministic and safe.
- Rules read everything through one narrow interface and never touch ESLint's context, settings or
  options directly. This repo's equivalent: logic receives plain data, and one shared function talks
  to ESLint.
- Reuse existing helpers before writing a local version. The maintainers list every helper and where
  it lives.

## Sources

- ESLint, [Custom rules](https://eslint.org/docs/latest/extend/custom-rules)
- better-tailwindcss, [AGENTS.md](https://github.com/schoero/eslint-plugin-better-tailwindcss/blob/main/AGENTS.md)
