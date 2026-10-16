# Plugin anatomy

Use `packages/eslint-plugin-twig-html` and `packages/eslint-plugin-twig-tailwind` as the reference
for package metadata, README, tests and wiring. Their `src/` layout predates this shape, so follow
the layout below for the source.

## Layout

```
packages/eslint-plugin-<name>/
  package.json
  README.md
  LICENSE
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts          only when tests need non-default settings
  docs/rules/<rule>.md
  src/
    index.ts                wiring only
    rules/<rule>/...        see rule-anatomy.md
    shared/<concept>.ts     code used by two or more rules
    configs/ processors/ selectors/   only when the plugin has them, one concept per file
  test/
    <rule>.test.ts
    fix-safety.test.ts      when any rule is fixable
    corpus.ts
```

## src/index.ts

Wiring only: the package's `name` and `version` read from `package.json`, the `rules` map, the
configs, and any processors. No logic, no helper functions.

- The plugin object `satisfies ESLint.Plugin`.
- `rules` keys are the kebab-case rule ids.
- The recommended config is named `<plugin>/recommended`, applies to `**/*.twig`, sets
  `twig-eslint-parser` as the parser, registers the plugin under its short name, and turns on
  every rule with its default severity.
- A config that needs computing (selectors, options, validation) is built by a factory in its own
  module, and `index.ts` only calls it.
- The default export is the plugin. Public helpers are named exports.

## package.json

Follow an existing plugin field by field: `name`, `version`, `description`, `license`, `author`,
`repository` with `directory`, `bugs`, `homepage`, `type: module`, `engines.node`, an `exports`
map with `types` and `default`, `files` including `dist` and `docs`, `keywords`, the `build`,
`prepack`, `typecheck`, `test` and `corpus` scripts, `dependencies.twig-eslint-parser`, and
`peerDependencies.eslint` as `^9.0.0 || ^10.0.0`.

- Pin every dependency to an exact version. The repo only accepts packages at least 7 days old
  (root `README.md`, "Dependency policy").
- A peer plugin the package wraps is a peer dependency listing only the versions that were tested.

## Wiring into the monorepo

A new plugin touches these places, and the change is incomplete without all of them:

1. Root `package.json`: add the package to `workspaces`. Workspace order sets publish order for
   releases (`publishArgs: --workspaces`), and the parser must come first.
2. Root `package.json`, `release-it.hooks.after:bump`: add `-w <package>` to the
   `npm pkg set dependencies.twig-eslint-parser` command, so a release points it at the new parser
   version.
3. Root `README.md`: add a row to the package table.
4. `test/corpus.ts`: a default export of `PackageCorpus` using `ruleChecks`, so the corpus runs the
   plugin's rules (see `corpus-check`).
5. A canary in `tools/corpus/canaries` for each rule, with its entry in `expectations.json`.
6. The plugin README: description, install, usage, rules table, known limitations, licence.
7. `LICENSE` copied from an existing plugin.

CI runs `npm run typecheck` and `npm test` across workspaces, so a workspace entry is enough for
CI. Dependabot is configured at the root and needs no change.

## README sections

Description and a small example, Installation (with the Node and ESLint requirement), Usage with
an `eslint.config.js` snippet, Rules table (rule, description, recommended severity, a fixable
column when any rule is fixable, link to its docs page), notes on what the recommended config sets, Known limitations, Licence.
Limitations that belong to the parser are linked to the parser README, not repeated.
