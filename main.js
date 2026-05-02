const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let store = null;
let proxyManager = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 940,
    height: 680,
    minWidth: 760,
    minHeight: 520,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Saeng',
    show: false,
    backgroundColor: '#0f1117',
  });

  mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Fallback: empty 16×16 image when no icon file exists yet
  const img = nativeImage.createEmpty();
  tray = new Tray(img);

  updateTrayMenu(false);

  tray.on('double-click', () => {
    if (!mainWindow) createWindow();
    else mainWindow.show();
  });
}

function updateTrayMenu(running) {
  if (!tray) return;
  tray.setToolTip(`Saeng — Proxy ${running ? 'running' : 'stopped'}`);
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Saeng',
      click() {
        if (!mainWindow) createWindow();
        else mainWindow.show();
      },
    },
    { type: 'separator' },
    {
      label: running ? 'Stop Proxy' : 'Start Proxy',
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
          } catch (_) {}
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Saeng',
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
    const mapping = store.addMapping(data);
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

  ipcMain.handle('settings:get', () => store.getSettings());

  ipcMain.handle('settings:set', (_, patch) => {
    return store.setSettings(patch);
  });

  ipcMain.handle('ssl:get-ca-path', () => {
    const { CertManager } = require('./src/proxy/certManager');
    return CertManager.getInstance(store.getCertDir()).getCAPath();
  });

  ipcMain.handle('ssl:reveal-ca', () => {
    const { CertManager } = require('./src/proxy/certManager');
    shell.showItemInFolder(CertManager.getInstance(store.getCertDir()).getCAPath());
  });

  ipcMain.handle('ssl:trust-ca', async () => {
    const { trustCA } = require('./src/ssl/trust');
    const { CertManager } = require('./src/proxy/certManager');
    return trustCA(CertManager.getInstance(store.getCertDir()).getCAPath());
  });
}

app.whenReady().then(async () => {
  const AppStore = require('./src/store');
  const { ProxyManager } = require('./src/proxy/manager');
  const { clearSystemProxy } = require('./src/systemProxy');

  store = new AppStore();
  proxyManager = new ProxyManager(store);

  // Clear any leftover proxy config from a previous run (crash / force-quit)
  await clearSystemProxy().catch(() => {});

  // Pre-warm the CA cert so the first HTTPS connection is fast
  const { CertManager } = require('./src/proxy/certManager');
  CertManager.getInstance(store.getCertDir());

  setupIPC();
  createWindow();
  createTray();

  // Auto-start if the setting is enabled
  if (store.getSettings().startOnLaunch) {
    proxyManager.start(store.getMappings(), store.getSettings()).then(() => {
      updateTrayMenu(true);
    }).catch(() => {});
  }
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
  else mainWindow.show();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  tray?.destroy();
  if (proxyManager?.isRunning()) {
    await proxyManager.stop();
  }
});
