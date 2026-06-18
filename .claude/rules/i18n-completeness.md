---
globs: "src/renderer/components/**/*.jsx, src/i18n/locales/**/*.json"
---

# i18n completeness

This project supports 21 locales (`src/i18n/locales/*.json`), with `en.json` as the canonical source of truth for keys.

When adding, renaming, or removing a user-facing string key:

- Add/update the key in `en.json` AND every other locale file (`ar`, `be`, `bg`, `de`, `es`, `fr`, `id`, `it`, `ja`, `ko`, `nl`, `pl`, `pt`, `ru`, `sv`, `th`, `tr`, `uk`, `vi`, `zh`), in the same position as `en.json` so diffs stay readable.
- Translate the value per locale — don't just copy the English string, except for known intentional loanwords/placeholders/app name (see the `i18n-check` skill for examples and precedent).
- Removing a key from `en.json` requires removing it from every other locale file too.
- After editing, run `node .claude/skills/i18n-check/check-locales.mjs` to confirm no missing/extra/untranslated keys remain.
