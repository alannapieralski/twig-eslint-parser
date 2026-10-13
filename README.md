# twig-eslint-parser

ESLint for Twig templates, with Tailwind CSS and HTML linting for Drupal themes.

| Package | What it is |
|---|---|
| [`twig-eslint-parser`](packages/twig-eslint-parser) | The parser: HTML markup plus Twig expressions as one ESLint AST with exact source ranges. No rules. |
| [`eslint-plugin-twig-tailwind`](packages/eslint-plugin-twig-tailwind) | Needs [`eslint-plugin-better-tailwindcss`](https://github.com/schoero/eslint-plugin-better-tailwindcss) as a peer dependency. Teaches it where classes live in Twig, with an opt-in Drupal config, and adds a processor for interpolated strings and the `no-interpolated-attributes`, `no-interpolated-classes` and `no-unparsed-twig` rules. |
| [`eslint-plugin-twig-html`](packages/eslint-plugin-twig-html) | Rules for the HTML layout in Twig templates that understand Twig blocks, starting with `attrs-newline`. |

All packages share one version and are released together.

## Development

Needs Node.js 24.15 or later (`.nvmrc` pins the version used here) and npm 11.10 or later.

```sh
nvm use
npm install
```

| Command | What it does |
|---|---|
| `npm test` | Builds the parser, then runs every package's tests. |
| `npm run typecheck` | Builds the parser, then type-checks every package. |
| `npm run build` | Compiles every package to its `dist`. |

Package-specific commands, such as the twig-lexer fork checks, are listed in each package's README
and run with `-w <package>`.

## Testing on real templates

Fixtures prove the cases someone thought of. The corpus run proves the parser and every rule on
the templates you actually have: Drupal core, contributed modules and your themes.

1. Copy `corpus.config.example.json` to `corpus.config.json` and list the project folders to
   check. Every `*.twig` file under a root is used, except in `node_modules`, `vendor` and `.git`.
   Mark a few roots `"quick": true` for fast runs. The file is git-ignored.
2. Run it:

| Command | What it runs |
|---|---|
| `npm run corpus` | Every check of every package, on every root. |
| `npm run corpus -w eslint-plugin-twig-html` | Only that package's checks. Works for each package. |
| `npm run corpus -- --rule twig-html/attrs-newline` | One rule on every root. Use it after adding or changing a rule. |
| `npm run corpus -- --rule attrs-newline --sample 20` | The same, and write 20 before/after diffs of the fix to `corpus-report/samples`, spread across the corpus, to judge the fix by eye. |
| `npm run corpus -- --quick` | Only the roots marked `quick`. |
| `npm run corpus -- --roots drupal,theme` | Only roots whose path contains one of these strings. |
| `npm run corpus -- --list` | Which checks match the filters, without running them. |
| `TWIG_CORPUS=dir:dir npm run corpus` | Use these folders instead of the config file. |

### The checks

- **Parser** (`packages/twig-eslint-parser/test/corpus.ts`): the lexer produces the same tokens as
  real Twig (needs PHP and `composer install` in `tools/twig-oracle`), every template parses, every
  Twig block converts, and the output matches the source node by node.
- **Rules** (`packages/*/test/corpus.ts`): every rule of a plugin gets a check automatically, so a
  new rule is covered as soon as it is exported. The check runs the rule alone on every template and
  counts its reports. For a fixable rule it also applies the fix and checks that the fixed template
  still parses, that the number of Twig blocks the parser can read has not changed, and that a second
  pass changes nothing. A rule can promise more in its `corpus.ts` entry, for example
  `{ fixKeeps: 'whitespace' }` for a layout rule, and the run then checks the fix changes nothing
  but whitespace. A rule that throws is a failure.

### Progress

The run prints what it is doing to the terminal as it goes: the roots found and how many
templates each holds, then for each check a `starting` line, a progress line every 10% (or every 5
seconds), and a `done` line with its reports and failures. On a terminal the progress line rewrites
in place; piped or in a log it prints one line per step.

### The report

Everything is written to `corpus-report/` (git-ignored, because it holds local paths):

- `summary.md`: one row per check, then the first new failures of each.
- `findings.ndjson`: one JSON object per finding: check, status (`report`, `new` or `known`), root,
  file, line and message. Read or grep this to go through every report.
- `failures/<check>/`: the before and after of a failed fix, as a diff.
- `samples/<rule>/`: the diffs written by `--sample`.

The run exits with a failure only for failures that are new. Failures you accept, such as a template
that is not valid HTML, are recorded with `npm run corpus -- --update-baseline` in
`corpus.baseline.json` (git-ignored). Entries are keyed by a hash of the template's content, so they
survive a template moving.

### Adding a rule

Export it from the plugin. Then run `npm run corpus -- --rule <name> --sample 20`, read the diffs,
and fix or baseline what it finds. To make a rule's fix promise more than "still parses and is
stable", add it to the `rules` map in the package's `test/corpus.ts`. To add a different kind of
check, add a `Check` to that file's `checks` array. The runner and the config live in
`tools/corpus`, which is not published, and `npm test` runs its own unit tests.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org), scoped to the
package they change (`fix(parser): ...`, `feat(plugin): ...`). The release changelog is built from
them.

### Dependency policy

Installs only accept package versions published at least 7 days ago (`min-release-age=7` in
`.npmrc`). That setting needs npm 11.10 or later, so `devEngines` makes older npm versions fail
instead of silently ignoring it. Every dependency is pinned to an exact version and upgraded by
hand.

## Releasing

Releases use [release-it](https://github.com/release-it/release-it) from the repository root. One
run releases every package at the same version.

Before the first release:

1. Log in to npm with the account that will own the packages: `npm login`.
2. Create a GitHub token that can create releases on this repository and export it as
   `GITHUB_TOKEN`.

Then, on an up-to-date `main` with a clean working tree:

```sh
npm run release
```

release-it will:

1. Check the npm login, then run the lexer drift check, typechecks and all tests.
2. Work out the next version from the commits since the last `v*` tag (`fix` is a patch, `feat` a
   minor, a breaking change a major) and ask you to confirm it.
3. Write `CHANGELOG.md`, bump the root and every package to that version, point both plugins at
   the same parser version and update the lockfile.
4. Publish `twig-eslint-parser`, then `eslint-plugin-twig-tailwind` and `eslint-plugin-twig-html`,
   to npm, asking for a one-time password if the account needs one.
5. Commit `chore(release): x.y.z`, tag `vx.y.z`, push, and create the GitHub Release with the
   changelog as its notes.

The first release proposes 0.1.0, with every commit so far in its changelog. Until 1.0.0, a
breaking change would propose 1.0.0; pick a different increment at the prompt if that is not
wanted yet, or pass the version explicitly (`npm run release -- 0.3.0`).

Use `npm run release -- --dry-run` to see every step without changing anything.

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
