const path = require('path');
const fs = require('fs');

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

module.exports = { load, t, getStrings };
