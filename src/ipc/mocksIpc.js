import { ipcMain } from 'electron';
import * as i18n from '../i18n/i18n.js';
import { exportListToJsonFile, importListFromJsonFile } from './jsonFileDialogs.js';

// Registers the `mocks:*` IPC handlers (CRUD, JSON export/import). Add and
// update return { success, error } instead of throwing because the store
// validates pathPattern/condition regexes.
export function registerMocksIpc({ store, proxyManager, getMainWindow }) {
  ipcMain.handle('mocks:list', () => store.getMocks());

  ipcMain.handle('mocks:add', (_, data) => {
    try {
      store.addMock(data);
      proxyManager.updateMocks(store.getMocks());
      return { success: true, mocks: store.getMocks() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('mocks:update', (_, id, data) => {
    try {
      store.updateMock(id, data);
      proxyManager.updateMocks(store.getMocks());
      return { success: true, mocks: store.getMocks() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('mocks:remove', (_, id) => {
    store.removeMock(id);
    proxyManager.updateMocks(store.getMocks());
    return store.getMocks();
  });

  ipcMain.handle('mocks:toggle', (_, id) => {
    store.toggleMock(id);
    proxyManager.updateMocks(store.getMocks());
    return store.getMocks();
  });

  ipcMain.handle('mocks:export', (_, ids) =>
    exportListToJsonFile(getMainWindow(), {
      title: i18n.t('mocks.modals.export.dialog.title'),
      defaultPath: 'saeng-mocks.json',
      key: 'mocks',
      data: store.exportMocks(ids),
    })
  );

  ipcMain.handle('mocks:import', async () => {
    const result = await importListFromJsonFile(getMainWindow(), {
      title: i18n.t('mocks.modals.import.dialog.title'),
      key: 'mocks',
      i18nPrefix: 'mocks.modals.import',
    });
    if (!result.success) return result;

    const { added, skipped } = store.importMocks(result.list);
    if (added.length > 0) {
      proxyManager.updateMocks(store.getMocks());
    }
    return { success: true, added: added.length, skipped: skipped.length, mocks: store.getMocks() };
  });
}
