# twig-eslint-parser

ESLint for Twig templates, with Tailwind CSS linting for Drupal themes.

| Package | What it is |
|---|---|
| [`twig-eslint-parser`](packages/twig-eslint-parser) | The parser: HTML markup plus Twig expressions as one ESLint AST with exact source ranges. No rules. |
| [`eslint-plugin-twig-tailwind`](packages/eslint-plugin-twig-tailwind) | The glue for [`eslint-plugin-better-tailwindcss`](https://github.com/schoero/eslint-plugin-better-tailwindcss): Twig and Drupal class selectors, a recommended config and the `no-interpolated-attributes` rule. |

Both packages share one version and are released together.

## Development

Needs Node.js 24 or later and npm 11.10 or later.

```sh
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

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
