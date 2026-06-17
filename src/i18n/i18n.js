import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPPORTED_LOCALES = [
  { code: 'ar', name: 'العربية', dir: 'rtl' }, // Arabic
  { code: 'be', name: 'беларускі', dir: 'ltr' }, // Belarusian
  { code: 'bg', name: 'Български', dir: 'ltr' }, // Bulgarian
  { code: 'zh', name: '中文', dir: 'ltr' }, // Chinese (Simplified)
  { code: 'nl', name: 'Nederlands', dir: 'ltr' }, // Dutch
  { code: 'en', name: 'English', dir: 'ltr' }, // English
  { code: 'fr', name: 'Français', dir: 'ltr' }, // French
  { code: 'de', name: 'Deutsch', dir: 'ltr' }, // German
  { code: 'id', name: 'Bahasa Indonesia', dir: 'ltr' }, // Indonesian
  { code: 'it', name: 'Italiano', dir: 'ltr' }, // Italian
  { code: 'ja', name: '日本語', dir: 'ltr' }, // Japanese
  { code: 'ko', name: '한국어', dir: 'ltr' }, // Korean
  { code: 'pl', name: 'Polski', dir: 'ltr' }, // Polish
  { code: 'ru', name: 'Русский', dir: 'ltr' }, // Russian
  { code: 'pt', name: 'Português', dir: 'ltr' }, // Portuguese (Brazil)
  { code: 'es', name: 'Español', dir: 'ltr' }, // Spanish
  { code: 'sv', name: 'Svenska', dir: 'ltr' }, // Swedish
  { code: 'th', name: 'แบบไทย', dir: 'ltr' }, // Thai
  { code: 'tr', name: 'Türkçe', dir: 'ltr' }, // Turkish
  { code: 'vi', name: 'Tiếng Việt', dir: 'ltr' }, // Vietnamese
  { code: 'uk', name: 'Українська', dir: 'ltr' }, // Ukrainian
];

let strings = {};

function load(locale) {
  const lang = (locale || 'en').split('-')[0].toLowerCase();
  const dir = path.join(__dirname, 'locales');
  for (const name of [locale, lang, 'en']) {
    if (!name) continue;
    const file = path.join(dir, `${name}.json`);
    if (fs.existsSync(file)) {
      strings = JSON.parse(fs.readFileSync(file, 'utf8'));
      return;
    }
  }
}

function t(key, vars) {
  let str = strings[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

function getStrings() {
  return strings;
}

function getSupportedLocales() {
  return SUPPORTED_LOCALES;
}

export { load, t, getStrings, getSupportedLocales };
