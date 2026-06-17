#!/usr/bin/env node
// Inserts a new i18n key into en.json and all 14 other locale files at the
// same position, preserving the existing file formatting and blank lines.
//
// Usage:
//   node .claude/skills/i18n-add/add-key.mjs '<json>'
//
// JSON shape:
//   {
//     "key": "log.filter.ws",
//     "after": "log.filterEmpty",   // key to insert after; omit to append at end
//     "translations": {
//       "en": "WebSocket",
//       "ar": "...",
//       "be": "...",
//       "bg": "...",
//       "de": "...",
//       "es": "...",
//       "fr": "...",
//       "ja": "...",
//       "ko": "...",
//       "pt": "...",
//       "ru": "...",
//       "th": "...",
//       "uk": "...",
//       "vi": "...",
//       "zh": "..."
//     }
//   }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupportedLocales } from '../../../src/i18n/i18n.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, '../../../src/i18n/locales');

const ALL_LOCALES = ['en', ...getSupportedLocales().map((l) => l.code).filter((c) => c !== 'en')];

// --- parse and validate input ---

const raw = process.argv[2];
if (!raw) {
  console.error('Usage: node add-key.mjs \'{"key":"...","after":"...","translations":{...}}\'');
  process.exit(1);
}

let input;
try {
  input = JSON.parse(raw);
} catch {
  console.error('Error: argument must be valid JSON');
  process.exit(1);
}

const { key, after, translations } = input;

if (!key || typeof key !== 'string') {
  console.error('Error: "key" is required and must be a string');
  process.exit(1);
}
if (!translations || typeof translations !== 'object') {
  console.error('Error: "translations" object is required');
  process.exit(1);
}

const missingLocales = ALL_LOCALES.filter((l) => !(l in translations));
if (missingLocales.length) {
  console.error(`Error: missing translations for: ${missingLocales.join(', ')}`);
  process.exit(1);
}

// --- insertion ---

function insertIntoFile(filePath, locale) {
  const text = fs.readFileSync(filePath, 'utf8');
  const quotedKey = JSON.stringify(key);

  if (text.includes(`${quotedKey}:`)) {
    return 'skipped (key already exists)';
  }

  const value = translations[locale];
  const newEntry = `  ${quotedKey}: ${JSON.stringify(value)}`;
  const lines = text.split('\n');

  if (after) {
    const quotedAfter = JSON.stringify(after);
    const afterIdx = lines.findIndex((l) => l.trimStart().startsWith(`${quotedAfter}:`));
    if (afterIdx === -1) throw new Error(`key "${after}" not found`);

    // Check whether afterKey is currently the last key (next non-blank line is `}`)
    let nextIdx = afterIdx + 1;
    while (nextIdx < lines.length && lines[nextIdx].trim() === '') nextIdx++;
    const isLast = lines[nextIdx]?.trim() === '}';

    if (isLast) {
      if (!lines[afterIdx].trimEnd().endsWith(',')) {
        lines[afterIdx] = lines[afterIdx].trimEnd() + ',';
      }
      lines.splice(afterIdx + 1, 0, newEntry);
    } else {
      lines.splice(afterIdx + 1, 0, `${newEntry},`);
    }
  } else {
    // Append before the closing brace
    const closingIdx = lines.lastIndexOf('}');
    if (closingIdx === -1) throw new Error('no closing brace found');

    let lastKeyIdx = closingIdx - 1;
    while (lastKeyIdx >= 0 && lines[lastKeyIdx].trim() === '') lastKeyIdx--;

    if (lastKeyIdx >= 0 && !lines[lastKeyIdx].trimEnd().endsWith(',')) {
      lines[lastKeyIdx] = lines[lastKeyIdx].trimEnd() + ',';
    }
    lines.splice(closingIdx, 0, newEntry);
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  return 'ok';
}

// --- run ---

let errors = 0;
for (const locale of ALL_LOCALES) {
  const filePath = path.join(localesDir, `${locale}.json`);
  try {
    const result = insertIntoFile(filePath, locale);
    console.log(`${result === 'ok' ? '✓' : '–'} ${locale}${result !== 'ok' ? ` (${result})` : ''}`);
  } catch (err) {
    console.error(`✗ ${locale}: ${err.message}`);
    errors++;
  }
}

if (errors === 0) {
  console.log(`\nAdded "${key}" to all locale files.`);
  console.log('Run node .claude/skills/i18n-check/check-locales.mjs to verify.');
} else {
  console.error(`\n${errors} locale(s) failed.`);
  process.exit(1);
}
