import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, protocol, net } from 'electron';
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
import pkg from './package.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let mainWindow = null;
let tray = null;
let store = null;
let proxyManager = null;
let isQuitting = false;

app.setAboutPanelOptions({
  applicationName: 'Saeng',
  applicationVersion: pkg.version,
  copyright: `© ${new Date().getFullYear()} ${pkg.author.name}`,
  credits: pkg.description,
  iconPath: path.join(__dirname, 'resources/icons/icon.png')
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 940,
    height: 680,
    minWidth: 760,
    minHeight: 520,
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
    if ((process.platform === 'darwin' || process.platform === 'win32') && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPaths = {
    darwin: path.join(__dirname, 'assets/icons/mac/icon.icon/Assets/icon.png'),
    win32: path.join(__dirname, 'assets/icons/win/icon.png'),
    linux: path.join(__dirname, 'assets/icons/linux/icon.png'),
  };
  let img = nativeImage.createEmpty();
  const iconPath = iconPaths[process.platform];
  if (iconPath && fs.existsSync(iconPath)) {
    const loaded = nativeImage.createFromPath(iconPath);
    if (!loaded.isEmpty()) img = loaded;
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
    { type: 'separator' },
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
    if (proxyManager.isRunning()) {
      proxyManager.updateMappings(store.getMappings());
    }
    return store.getMappings();
  });

  ipcMain.handle('mappings:remove', (_, id) => {
    store.removeMapping(id);
    if (proxyManager.isRunning()) {
      proxyManager.updateMappings(store.getMappings());
    }
    return store.getMappings();
  });

  ipcMain.handle('mappings:toggle', (_, id) => {
    store.toggleMapping(id);
    if (proxyManager.isRunning()) {
      proxyManager.updateMappings(store.getMappings());
    }
    return store.getMappings();
  });

  ipcMain.handle('mappings:update', (_, id, data) => {
    store.updateMapping(id, data);
    if (proxyManager.isRunning()) {
      proxyManager.updateMappings(store.getMappings());
    }
    return store.getMappings();
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

  ipcMain.handle('settings:get', () => store.getSettings());

  ipcMain.handle('settings:set', (_, patch) => {
    const updated = store.setSettings(patch);
    if ('logMaxEntries' in patch) {
      proxyManager.requestLog.setMaxEntries(updated.logMaxEntries);
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
  createWindow();
  createTray();

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
  if (process.platform === 'linux') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (isQuitting) return;
  isQuitting = true;
  event.preventDefault();
  tray?.destroy();
  const cleanup = proxyManager?.isRunning() ? proxyManager.stop() : Promise.resolve();
  cleanup.catch(() => {}).finally(() => app.quit());
});
