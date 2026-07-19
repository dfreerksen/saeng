import { ipcMain } from 'electron';
import * as i18n from '../i18n/i18n.js';
import { exportListToJsonFile, importListFromJsonFile } from './jsonFileDialogs.js';

// Registers the `mappings:*` IPC handlers (CRUD, group toggle, JSON
// export/import). Removing a mapping also removes its mocks, so that
// handler pushes both updated lists to the proxy.
export function registerMappingsIpc({ store, proxyManager, getMainWindow }) {
  ipcMain.handle('mappings:list', () => store.getMappings());

  ipcMain.handle('mappings:add', (_, data) => {
    store.addMapping(data);
    proxyManager.updateMappings(store.getMappings());
    return store.getMappings();
  });

  ipcMain.handle('mappings:remove', (_, id) => {
    store.removeMapping(id);
    store.removeMocksForMapping(id);
    proxyManager.updateMappings(store.getMappings());
    proxyManager.updateMocks(store.getMocks());
    return store.getMappings();
  });

  ipcMain.handle('mappings:toggle', (_, id) => {
    store.toggleMapping(id);
    proxyManager.updateMappings(store.getMappings());
    return store.getMappings();
  });

  ipcMain.handle('mappings:setGroupEnabled', (_, ids, enabled) => {
    store.setMappingsEnabled(ids, enabled);
    proxyManager.updateMappings(store.getMappings());
    return store.getMappings();
  });

  ipcMain.handle('mappings:update', (_, id, data) => {
    store.updateMapping(id, data);
    proxyManager.updateMappings(store.getMappings());
    return store.getMappings();
  });

  ipcMain.handle('mappings:export', (_, ids) =>
    exportListToJsonFile(getMainWindow(), {
      title: i18n.t('mappings.modals.export.dialog.title'),
      defaultPath: 'saeng-mappings.json',
      key: 'mappings',
      data: store.exportMappings(ids),
    })
  );

  ipcMain.handle('mappings:import', async () => {
    const result = await importListFromJsonFile(getMainWindow(), {
      title: i18n.t('mappings.modals.import.dialog.title'),
      key: 'mappings',
      i18nPrefix: 'mappings.modals.import',
    });
    if (!result.success) return result;

    const { added, skipped } = store.importMappings(result.list);
    if (added.length > 0) {
      proxyManager.updateMappings(store.getMappings());
    }
    return { success: true, added: added.length, skipped: skipped.length, mappings: store.getMappings() };
  });
}
