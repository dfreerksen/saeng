import fs from 'fs';
import { dialog } from 'electron';
import * as i18n from '../i18n/i18n.js';

// Shared save-dialog flow for the mappings/mocks JSON exports: prompts for a
// destination, writes `{ [key]: data }` as pretty-printed JSON, and returns
// { canceled } / { success, path, count } / { success: false, error }.
export async function exportListToJsonFile(win, { title, defaultPath, key, data }) {
  const result = await dialog.showSaveDialog(win, {
    title,
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }
  try {
    fs.writeFileSync(result.filePath, JSON.stringify({ [key]: data }, null, 2), 'utf8');
    return { success: true, path: result.filePath, count: data.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Shared open-dialog flow for the mappings/mocks JSON imports: prompts for a
// file, parses it, and accepts either a bare array or `{ [key]: [...] }`.
// Error messages are translated using `${i18nPrefix}.error.*` keys. Returns
// { canceled } / { success: true, list } / { success: false, error }.
export async function importListFromJsonFile(win, { title, key, i18nPrefix }) {
  const result = await dialog.showOpenDialog(win, {
    title,
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths?.length) {
    return { canceled: true };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
  } catch (err) {
    return { success: false, error: i18n.t(`${i18nPrefix}.error.readFailed`, { error: err.message }) };
  }

  const list = Array.isArray(parsed) ? parsed : parsed?.[key];
  if (!Array.isArray(list)) {
    return { success: false, error: i18n.t(`${i18nPrefix}.error.invalidFormat`) };
  }
  return { success: true, list };
}
