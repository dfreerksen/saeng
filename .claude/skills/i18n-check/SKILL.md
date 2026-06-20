---
name: i18n-check
description: Scan src/i18n/locales/*.json for translation gaps against en.json — missing keys, extra/stale keys, and values that still match the English text (likely untranslated). Use when asked to find missing translations, audit locale files, or before/after adding new i18n strings.
---

Run the bundled script to compare every locale file against `en.json` (the canonical source of truth for keys):

```bash
node .claude/skills/i18n-check/check-locales.mjs
```

For each locale (`ar`, `be`, `bg`, `de`, `es`, `fr`, `ja`, `ko`, `pt`, `ru`, `th`, `uk`, `vi`, `zh`), it reports:

- **Missing keys** — present in `en.json` but absent from the locale file. These need to be added and translated.
- **Extra keys** — present in the locale file but not in `en.json`. Usually stale leftovers from removed strings; confirm before deleting.
- **Possibly untranslated** — the locale's value is byte-identical to the English value. This is a heuristic, not a verdict — many of these are intentional:
  - App name (`application.name: "Saeng"`)
  - Placeholders/examples (`mappings.modals.manage.form.domain.placeholder: "myapp"`, regex patterns)
  - Loanwords some languages keep in English (`"Mocks"`, `"Status"`, `"Proxy"`, `"MOCK"`, `"Actions"`)

  Use judgment per language/term — check how similar terms (e.g. `mocks.title`, `log.table.status`) are handled elsewhere in that same locale file for precedent before deciding whether a flagged string needs translating.

## Workflow for fixing missing keys

1. Run the script to get the list of missing keys per locale.
2. For each missing key, look at how sibling/similar keys are phrased in that locale (tone, punctuation, placeholder style like `{count}`/`{path}`) and translate consistently.
3. Add the key to each locale file in the same position as `en.json` (helps diffs stay readable).
4. Re-run the script — it should report zero missing/untranslated for keys you just added. The PostToolUse JSON-validation hook (`.claude/hooks/validate-locale-json.mjs`) will flag any syntax errors introduced while editing.
