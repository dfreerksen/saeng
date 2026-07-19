import fs from 'fs';
import { ipcMain, dialog } from 'electron';
import * as i18n from '../i18n/i18n.js';
import { buildHar } from '../proxy/har.js';

// Registers the `proxy:*`, `requestLog:*`, and `health:*` IPC handlers.
// `onProxyStateChange(running)` lets main.js keep the tray menu in sync.
export function registerProxyIpc({ store, proxyManager, getMainWindow, appVersion, onProxyStateChange }) {
  ipcMain.handle('proxy:start', async () => {
    try {
      await proxyManager.start(store.getMappings(), store.getSettings());
      onProxyStateChange(true);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('proxy:stop', async () => {
    try {
      await proxyManager.stop();
      onProxyStateChange(false);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('proxy:status', () => ({
    running: proxyManager.isRunning(),
    ...proxyManager.getStatus(),
  }));

  ipcMain.handle('requestLog:list', () => proxyManager.requestLog.list());

  ipcMain.handle('requestLog:clear', () => {
    proxyManager.requestLog.clear();
    return [];
  });

  ipcMain.handle('requestLog:exportHar', async () => {
    const entries = proxyManager.requestLog.list();
    const result = await dialog.showSaveDialog(getMainWindow(), {
      title: i18n.t('log.exportHar.dialog.title'),
      defaultPath: 'saeng-requests.har',
      filters: [{ name: 'HAR', extensions: ['har'] }],
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    try {
      const har = buildHar(entries, appVersion);
      fs.writeFileSync(result.filePath, JSON.stringify(har, null, 2), 'utf8');
      return { success: true, path: result.filePath, count: entries.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('health:list', () => proxyManager.healthChecker.getStatuses());
}
