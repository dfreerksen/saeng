#!/usr/bin/env node
// Compares src/i18n/locales/*.json against en.json (the canonical source)
// and reports missing keys, extra keys, and values that still match the
// English text (likely left untranslated).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, '../../../src/i18n/locales');

const enPath = path.join(localesDir, 'en.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const enKeys = Object.keys(en);

const localeFiles = fs
  .readdirSync(localesDir)
  .filter((f) => f.endsWith('.json') && f !== 'en.json')
  .sort();

let hasIssues = false;

for (const file of localeFiles) {
  const locale = path.basename(file, '.json');
  const data = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
  const dataKeys = Object.keys(data);

  const missing = enKeys.filter((k) => !(k in data));
  const extra = dataKeys.filter((k) => !(k in en));
  const untranslated = enKeys.filter(
    (k) => k in data && data[k] === en[k] && /[a-zA-Z]/.test(en[k])
  );

  if (missing.length === 0 && extra.length === 0 && untranslated.length === 0) {
    continue;
  }

  hasIssues = true;
  console.log(`\n=== ${locale} ===`);
  if (missing.length) {
    console.log(`Missing keys (${missing.length}):`);
    for (const k of missing) console.log(`  ${k}: ${JSON.stringify(en[k])}`);
  }
  if (extra.length) {
    console.log(`Extra keys not in en.json (${extra.length}):`);
    for (const k of extra) console.log(`  ${k}`);
  }
  if (untranslated.length) {
    console.log(`Possibly untranslated (identical to en.json) (${untranslated.length}):`);
    for (const k of untranslated) console.log(`  ${k}: ${JSON.stringify(en[k])}`);
  }
}

if (!hasIssues) {
  console.log('All locales match en.json keys and no untranslated strings found.');
}
