# Corpus checks

- Run `npm run corpus -- --rule <name> --sample 20` after adding or changing a rule, and read the
  samples before calling the rule done.
- Run `npm run corpus` after changing the lexer or parser, and before a release.
- Run the twig-tailwind corpus before merging a Dependabot update of `eslint-plugin-better-tailwindcss`,
  and only then raise the plugin's peer range. The range lists tested versions only.
- Never put real project names, paths or template content in committed files. `corpus.config.json`,
  `corpus.baseline.json` and `corpus-report/` are git-ignored for that reason.
- Use the `corpus-check` skill for the workflow.
