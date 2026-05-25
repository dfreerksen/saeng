let i18nStrings = {};

export function t(key, vars) {
  let str = i18nStrings[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

export function loadStrings(strings) {
  i18nStrings = strings;
}
