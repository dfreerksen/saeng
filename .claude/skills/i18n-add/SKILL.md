---
name: i18n-add
description: Insert a new i18n key with translations into en.json and all 14 other locale files at the correct position in one shot. Use when adding a new user-facing string key.
---

Run the bundled script with a JSON payload describing the key, where to insert it, and all 15 translations:

```bash
node .claude/skills/i18n-add/add-key.mjs '<json>'
```

## JSON payload shape

```json
{
  "key": "log.filter.ws",
  "after": "log.filterEmpty",
  "translations": {
    "en": "WebSocket",
    "ar": "ويب سوكيت",
    "be": "Вэб-сокет",
    "bg": "УебСокет",
    "de": "WebSocket",
    "es": "WebSocket",
    "fr": "WebSocket",
    "it": "WebSocket",
    "ja": "WebSocket",
    "ko": "WebSocket",
    "pt": "WebSocket",
    "ru": "ВебСокет",
    "th": "เว็บซ็อกเก็ต",
    "uk": "Веб-сокет",
    "vi": "WebSocket",
    "zh": "WebSocket"
  }
}
```

- **`key`** — the new dot-notation key (required).
- **`after`** — the existing key to insert after (optional; omits to append at end of file).
- **`translations`** — values for all 15 locales (required). All locales must be present.

## Workflow

1. Determine all 15 translations. Follow tone/punctuation conventions in each locale (check sibling keys for precedent).
2. Run the script. It inserts the key at the same position in every file, preserving blank lines and formatting.
3. Verify with `node .claude/skills/i18n-check/check-locales.mjs` — it should report no missing or untranslated keys.

## Notes

- If a key already exists in a file the script skips that file rather than inserting a duplicate.
- The `after` key must exist in every locale file or the script will report an error for that locale.
- For loanwords kept in English across all locales (WebSocket, Proxy, MOCK, etc.) it is correct to use the English string — do not flag these as untranslated.
