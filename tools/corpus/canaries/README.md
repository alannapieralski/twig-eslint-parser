# Corpus canaries

Synthetic templates that every corpus run includes, whatever `--roots` selects. They prove each
check still fires, and cover syntax the real corpus lacks.

`expectations.json` maps each file to what each check should find:

| Key | Meaning |
|---|---|
| `reports` | These lines get at least one report. |
| `failures` | These lines get at least one failure, on purpose (not counted as new). |
| `clean` | These lines get nothing from the check. |
| `noFailures` | These lines may get reports but no failures. |

Use `"all"` instead of a list of lines for the whole file. Add `"pending": "why"` when the
expectation describes behaviour that is not built yet: the run lists it as pending instead of
failing, and says when it starts passing so the marker can be removed.

Never copy client templates or Drupal core text into this folder.
