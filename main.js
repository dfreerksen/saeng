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
import { UpdateChecker } from './src/updateChecker.js';
import { registerMappingsIpc } from './src/ipc/mappingsIpc.js';
import { registerMocksIpc } from './src/ipc/mocksIpc.js';
import { registerProxyIpc } from './src/ipc/proxyIpc.js';
import { registerSslIpc } from './src/ipc/sslIpc.js';
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

function getCertManager() {
  return CertManager.getInstance(store.getCertDir());
}

function hasTrayIcon(settings) {
  return settings.iconMode === 'tray' || settings.iconMode === 'both';
}

app.setAboutPanelOptions({
  applicationName: pkg.productName,
  applicationVersion: pkg.version,
  copyright: `© ${new Date().getFullYear()} ${pkg.author.name}`,
  // macOS
  credits: pkg.description,
  // Linux
  website: pkg.homepage,
  // Windows and Linux
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

  // Persist the size as the user resizes (debounced), so the last size
  // survives even when the app exits without a clean window close
  // (crash, force-quit). The close handler below still saves as a catch-all.
  let saveBoundsTimer = null;
  mainWindow.on('resize', () => {
    clearTimeout(saveBoundsTimer);
    saveBoundsTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        store.setWindowBounds(mainWindow.getBounds());
      }
    }, 500);
  });

  mainWindow.on('close', (event) => {
    clearTimeout(saveBoundsTimer);
    store.setWindowBounds(mainWindow.getBounds());
    if (hasTrayIcon(store.getSettings()) && (process.platform === 'darwin' || process.platform === 'win32') && !isQuitting) {
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
  const ctx = { store, proxyManager, getMainWindow: () => mainWindow };

  registerMappingsIpc(ctx);
  registerMocksIpc(ctx);
  registerProxyIpc({ ...ctx, appVersion: pkg.version, onProxyStateChange: updateTrayMenu });
  registerSslIpc({ getCertManager });

  // The remaining handlers stay here because they touch main.js-owned state
  // (tray, dock, window) or are trivial one-liners.
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
      if (hasTrayIcon(updated) && !tray) {
        createTray();
        updateTrayMenu(proxyManager.isRunning());
      } else if (updated.iconMode === 'dock' && tray) {
        tray.destroy();
        tray = null;
      }
      if (updated.iconMode === 'tray') {
        app.dock?.hide();
      } else {
        app.dock?.show();
      }
    }
    return updated;
  });

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

  // Pre-warm the CA cert so the first HTTPS connection is fast. Generation
  // runs off the main thread (node:crypto), so this doesn't block startup.
  getCertManager().ensureCA().catch((err) => console.error('CA pre-warm failed:', err));

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

  const settings = store.getSettings();
  if (settings.iconMode === 'tray') {
    app.dock?.hide();
  }

  createWindow();

  if (hasTrayIcon(settings)) {
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
  if (process.platform === 'linux' || !hasTrayIcon(store.getSettings())) {
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
