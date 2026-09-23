# twig-eslint-parser

ESLint for Twig templates, with Tailwind CSS linting for Drupal themes.

| Package | What it is |
|---|---|
| [`twig-eslint-parser`](packages/twig-eslint-parser) | The parser: HTML markup plus Twig expressions as one ESLint AST with exact source ranges. No rules. |
| [`eslint-plugin-twig-tailwind`](packages/eslint-plugin-twig-tailwind) | The glue for [`eslint-plugin-better-tailwindcss`](https://github.com/schoero/eslint-plugin-better-tailwindcss): Twig and Drupal class selectors, a recommended config and the `no-interpolated-attributes` rule. |

Both packages share one version and are released together.

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
run releases both packages at the same version.

Before the first release:

1. Log in to npm with the account that will own both packages: `npm login`.
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
3. Write `CHANGELOG.md`, bump the root and both packages to that version, point the plugin at the
   same parser version and update the lockfile.
4. Publish `twig-eslint-parser`, then `eslint-plugin-twig-tailwind`, to npm, asking for a one-time
   password if the account needs one.
5. Commit `chore(release): x.y.z`, tag `vx.y.z`, push, and create the GitHub Release with the
   changelog as its notes.

The first release proposes 0.1.0, with every commit so far in its changelog. Until 1.0.0, a
breaking change would propose 1.0.0; pick a different increment at the prompt if that is not
wanted yet, or pass the version explicitly (`npm run release -- 0.3.0`).

Use `npm run release -- --dry-run` to see every step without changing anything.

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
