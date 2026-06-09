const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  mappings: {
    list: () => ipcRenderer.invoke('mappings:list'),
    add: (data) => ipcRenderer.invoke('mappings:add', data),
    remove: (id) => ipcRenderer.invoke('mappings:remove', id),
    toggle: (id) => ipcRenderer.invoke('mappings:toggle', id),
    update: (id, data) => ipcRenderer.invoke('mappings:update', id, data),
    setGroupEnabled: (ids, enabled) => ipcRenderer.invoke('mappings:setGroupEnabled', ids, enabled),
    export: (ids) => ipcRenderer.invoke('mappings:export', ids),
    import: () => ipcRenderer.invoke('mappings:import'),
  },
  proxy: {
    start: () => ipcRenderer.invoke('proxy:start'),
    stop: () => ipcRenderer.invoke('proxy:stop'),
    status: () => ipcRenderer.invoke('proxy:status'),
    onStatusChanged: (callback) => {
      ipcRenderer.on('proxy:status', (_, data) => callback(data));
    },
  },
  requestLog: {
    list: () => ipcRenderer.invoke('requestLog:list'),
    clear: () => ipcRenderer.invoke('requestLog:clear'),
    onEntry: (callback) => {
      ipcRenderer.on('requestLog:entry', (_, entry) => callback(entry));
    },
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
  },
  ssl: {
    deleteCA: () => ipcRenderer.invoke('ssl:delete-ca'),
    getCAExpiry: () => ipcRenderer.invoke('ssl:get-ca-expiry'),
    getCAPath: () => ipcRenderer.invoke('ssl:get-ca-path'),
    regenerateCA: () => ipcRenderer.invoke('ssl:regenerate-ca'),
    revealCA: () => ipcRenderer.invoke('ssl:reveal-ca'),
    trustCA: () => ipcRenderer.invoke('ssl:trust-ca'),
  },
  app: {
    getInfo: () => ipcRenderer.invoke('app:get-info'),
    openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  },
  i18n: {
    getStrings: () => ipcRenderer.invoke('i18n:get-strings'),
    getLocales: () => ipcRenderer.invoke('i18n:get-locales'),
    setLocale: (locale) => ipcRenderer.invoke('i18n:set-locale', locale),
  },
});
