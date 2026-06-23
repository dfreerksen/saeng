import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, protocol, net, dialog } from 'electron';
import path from 'path';
import { randomBytes } from 'crypto';
import { pathToFileURL, fileURLToPath } from 'url';
import fs from 'fs';
import * as i18n from './src/i18n/i18n.js';
import AppStore from './src/store.js';
import { ProxyManager } from './src/proxy/manager.js';
import { CertManager } from './src/proxy/certManager.js';
import { clearSystemProxy } from './src/systemProxy.js';
import { trustCA, untrustCA } from './src/ssl/trust.js';
import { UpdateChecker } from './src/updateChecker.js';
import { buildHar } from './src/proxy/har.js';
import pkg from './package.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let mainWindow = null;
let tray = null;
let store = null;
let proxyManager = null;
let updateChecker = null;
let isQuitting = false;

app.setAboutPanelOptions({
  applicationName: 'Saeng',
  applicationVersion: pkg.version,
  copyright: `© ${new Date().getFullYear()} ${pkg.author.name}`,
  credits: pkg.description,
  iconPath: path.join(__dirname, 'assets/icons/about/icon.png')
});

function createWindow() {
  const { width, height } = store.getWindowBounds();
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Saeng',
    show: false,
    backgroundColor: '#0f1117',
  });

  mainWindow.loadURL('app://saeng/index.html');

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', (event) => {
    store.setWindowBounds(mainWindow.getBounds());
    const currentIconMode = store.getSettings().iconMode || 'both';
    const hasTray = currentIconMode === 'tray' || currentIconMode === 'both';
    if (hasTray && (process.platform === 'darwin' || process.platform === 'win32') && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  let img = nativeImage.createEmpty();
  const trayDir = path.join(__dirname, 'assets/icons/tray');

  if (process.platform === 'darwin') {
    const icon1x = path.join(trayDir, 'mac/tray.png');
    const icon2x = path.join(trayDir, 'mac/tray@2x.png');
    if (fs.existsSync(icon1x)) {
      const loaded = nativeImage.createFromPath(icon1x);
      if (!loaded.isEmpty()) {
        if (fs.existsSync(icon2x)) {
          loaded.addRepresentation({ scaleFactor: 2, dataURL: nativeImage.createFromPath(icon2x).toDataURL() });
        }
        loaded.setTemplateImage(true);
        img = loaded;
      }
    }
  } else if (process.platform === 'win32') {
    const iconPath = path.join(trayDir, 'windows/tray.ico');
    if (fs.existsSync(iconPath)) {
      const loaded = nativeImage.createFromPath(iconPath);
      if (!loaded.isEmpty()) img = loaded;
    }
  } else {
    const iconPath = path.join(trayDir, 'linux/tray.png');
    if (fs.existsSync(iconPath)) {
      const loaded = nativeImage.createFromPath(iconPath);
      if (!loaded.isEmpty()) img = loaded;
    }
  }

  tray = new Tray(img);

  updateTrayMenu(false);

  tray.on('double-click', () => {
    if (!mainWindow) createWindow();
    else mainWindow.show();
  });
}

function updateTrayMenu(running) {
  if (!tray) return;
  tray.setToolTip(i18n.t(running ? 'tray.tooltip.running' : 'tray.tooltip.stopped'));
  const menu = Menu.buildFromTemplate([
    {
      label: i18n.t('tray.open'),
      click() {
        if (!mainWindow) createWindow();
        else mainWindow.show();
      },
    },
    {
      label: i18n.t(running ? 'tray.stopProxy' : 'tray.startProxy'),
      async click() {
        if (running) {
          await proxyManager.stop();
          mainWindow?.webContents.send('proxy:status', { running: false });
          updateTrayMenu(false);
        } else {
          try {
            await proxyManager.start(store.getMappings(), store.getSettings());
            mainWindow?.webContents.send('proxy:status', { running: true });
            updateTrayMenu(true);
          } catch (err) {
            console.error('Error starting proxy:', err);
          }
        }
      },
    },
    { type: 'separator' },
    {
      label: i18n.t('tray.quit'),
      click() {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

function setupIPC() {
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

  ipcMain.handle('mappings:export', async (_, ids) => {
    const data = store.exportMappings(ids);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: i18n.t('mappings.modals.export.dialog.title'),
      defaultPath: 'saeng-mappings.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    try {
      fs.writeFileSync(result.filePath, JSON.stringify({ mappings: data }, null, 2), 'utf8');
      return { success: true, path: result.filePath, count: data.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('mappings:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: i18n.t('mappings.modals.import.dialog.title'),
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
      return { success: false, error: i18n.t('mappings.modals.import.error.readFailed', { error: err.message }) };
    }

    const list = Array.isArray(parsed) ? parsed : parsed?.mappings;
    if (!Array.isArray(list)) {
      return { success: false, error: i18n.t('mappings.modals.import.error.invalidFormat') };
    }

    const { added, skipped } = store.importMappings(list);
    if (added.length > 0) {
      proxyManager.updateMappings(store.getMappings());
    }
    return { success: true, added: added.length, skipped: skipped.length, mappings: store.getMappings() };
  });

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

  ipcMain.handle('mocks:export', async (_, ids) => {
    const data = store.exportMocks(ids);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: i18n.t('mocks.modals.export.dialog.title'),
      defaultPath: 'saeng-mocks.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    try {
      fs.writeFileSync(result.filePath, JSON.stringify({ mocks: data }, null, 2), 'utf8');
      return { success: true, path: result.filePath, count: data.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('mocks:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: i18n.t('mocks.modals.import.dialog.title'),
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
      return { success: false, error: i18n.t('mocks.modals.import.error.readFailed', { error: err.message }) };
    }

    const list = Array.isArray(parsed) ? parsed : parsed?.mocks;
    if (!Array.isArray(list)) {
      return { success: false, error: i18n.t('mocks.modals.import.error.invalidFormat') };
    }

    const { added, skipped } = store.importMocks(list);
    if (added.length > 0) {
      proxyManager.updateMocks(store.getMocks());
    }
    return { success: true, added: added.length, skipped: skipped.length, mocks: store.getMocks() };
  });

  ipcMain.handle('proxy:start', async () => {
    try {
      await proxyManager.start(store.getMappings(), store.getSettings());
      updateTrayMenu(true);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('proxy:stop', async () => {
    try {
      await proxyManager.stop();
      updateTrayMenu(false);
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
    const result = await dialog.showSaveDialog(mainWindow, {
      title: i18n.t('log.exportHar.dialog.title'),
      defaultPath: 'saeng-requests.har',
      filters: [{ name: 'HAR', extensions: ['har'] }],
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    try {
      const har = buildHar(entries, pkg.version);
      fs.writeFileSync(result.filePath, JSON.stringify(har, null, 2), 'utf8');
      return { success: true, path: result.filePath, count: entries.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('health:list', () => proxyManager.healthChecker.getStatuses());

  ipcMain.handle('settings:get', () => store.getSettings());

  ipcMain.handle('settings:set', (_, patch) => {
    const updated = store.setSettings(patch);
    if ('logMaxEntries' in patch) {
      proxyManager.requestLog.setMaxEntries(updated.logMaxEntries);
    }
    if ('loggingEnabled' in patch) {
      proxyManager.requestLog.setEnabled(updated.loggingEnabled);
    }
    if ('logHeadersEnabled' in patch) {
      proxyManager.requestLog.setLogHeaders(updated.logHeadersEnabled);
    }
    if ('logBodyEnabled' in patch) {
      proxyManager.requestLog.setLogBody(updated.logBodyEnabled);
    }
    if ('healthCheckEnabled' in patch) {
      proxyManager.healthChecker.setEnabled(updated.healthCheckEnabled);
    }
    if ('healthCheckIntervalMs' in patch) {
      proxyManager.healthChecker.setIntervalMs(updated.healthCheckIntervalMs);
    }
    if ('healthCheckTimeoutMs' in patch) {
      proxyManager.healthChecker.setTimeoutMs(updated.healthCheckTimeoutMs);
    }
    if ('iconMode' in patch) {
      const newMode = updated.iconMode;
      if ((newMode === 'tray' || newMode === 'both') && !tray) {
        createTray();
        updateTrayMenu(proxyManager.isRunning());
      } else if (newMode === 'dock' && tray) {
        tray.destroy();
        tray = null;
      }
      if (newMode === 'tray') {
        app.dock?.hide();
      } else {
        app.dock?.show();
      }
    }
    return updated;
  });

  ipcMain.handle('ssl:get-ca-expiry', () =>
    CertManager.getInstance(store.getCertDir()).getCAExpiry()
  );

  ipcMain.handle('ssl:regenerate-ca', () =>
    CertManager.getInstance(store.getCertDir()).regenerateCA()
  );

  ipcMain.handle('ssl:delete-ca', async () => {
    const certManager = CertManager.getInstance(store.getCertDir());
    const untrustResult = await untrustCA(certManager.getCAPath());
    certManager.deleteCA();
    return { success: true, warning: untrustResult?.success === false ? untrustResult.message : null };
  });

  ipcMain.handle('ssl:get-ca-path', () =>
    CertManager.getInstance(store.getCertDir()).getCAPath()
  );

  ipcMain.handle('ssl:reveal-ca', () =>
    shell.showItemInFolder(CertManager.getInstance(store.getCertDir()).getCAPath())
  );

  ipcMain.handle('ssl:trust-ca', () =>
    trustCA(CertManager.getInstance(store.getCertDir()).getCAPath())
  );

  ipcMain.handle('app:open-external', (_, url) => shell.openExternal(url));

  ipcMain.handle('app:get-info', () => ({
    name: app.getName(),
    version: pkg.version,
    electron: process.versions.electron,
    node: process.versions.node,
  }));

  ipcMain.handle('update:get-status', () => updateChecker.getStatus());

  ipcMain.handle('i18n:get-strings', () => i18n.getStrings());

  ipcMain.handle('i18n:get-locales', () => i18n.getSupportedLocales());

  ipcMain.handle('i18n:set-locale', (_, locale) => {
    store.setSettings({ locale });
    i18n.load(locale);
    updateTrayMenu(proxyManager.isRunning());
    return i18n.getStrings();
  });
}

app.whenReady().then(async () => {
  store = new AppStore();
  i18n.load(store.getSettings().locale || app.getLocale());
  proxyManager = new ProxyManager(store);
  proxyManager.requestLog.setListener((entry) =>
    mainWindow?.webContents.send('requestLog:entry', entry)
  );
  proxyManager.healthChecker.setListener((result) =>
    mainWindow?.webContents.send('health:update', result)
  );

  updateChecker = new UpdateChecker(pkg.version);
  updateChecker.setListener((status) =>
    mainWindow?.webContents.send('update:status', status)
  );

  // Clear any leftover proxy config from a previous run (crash / force-quit).
  // Only touch services already pointing at our PAC URL so VPN-managed proxy
  // settings on other interfaces are left intact.
  await clearSystemProxy({ onlyIfUrl: 'http://127.0.0.1:8181/proxy.pac' }).catch(() => {});

  // Pre-warm the CA cert so the first HTTPS connection is fast
  CertManager.getInstance(store.getCertDir());

  const nonce = randomBytes(16).toString('base64');
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    const pathname = url.pathname.slice(1);
    const filePath = pathname.startsWith('node_modules/')
      ? path.join(__dirname, pathname)
      : path.join(__dirname, 'src/renderer', pathname);
    if (url.pathname === '/index.html') {
      const html = fs.readFileSync(path.join(__dirname, 'src/renderer/index.html'), 'utf8')
        .replaceAll('__NONCE__', nonce);
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return net.fetch(pathToFileURL(filePath).href);
  });

  setupIPC();

  const iconMode = store.getSettings().iconMode || 'both';
  if (iconMode === 'tray') {
    app.dock?.hide();
  }

  createWindow();

  if (iconMode === 'tray' || iconMode === 'both') {
    createTray();
  }

  proxyManager.healthChecker.start(store.getMappings());
  updateChecker.start();

  // Auto-start if the setting is enabled
  if (store.getSettings().startOnLaunch) {
    proxyManager.start(store.getMappings(), store.getSettings()).then(() => {
      updateTrayMenu(true);
      mainWindow?.webContents.send('proxy:status', { running: true });
    }).catch(() => {});
  }
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
  else mainWindow.show();
});

app.on('window-all-closed', () => {
  const currentIconMode = store.getSettings().iconMode || 'both';
  const hasTray = currentIconMode === 'tray' || currentIconMode === 'both';
  if (process.platform === 'linux' || !hasTray) {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (isQuitting) return;
  isQuitting = true;
  event.preventDefault();
  tray?.destroy();
  proxyManager?.healthChecker.stop();
  updateChecker?.stop();
  const cleanup = proxyManager?.isRunning() ? proxyManager.stop() : Promise.resolve();
  cleanup.catch(() => {}).finally(() => app.quit());
});
