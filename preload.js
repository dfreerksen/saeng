const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  mappings: {
    list: () => ipcRenderer.invoke('mappings:list'),
    add: (data) => ipcRenderer.invoke('mappings:add', data),
    remove: (id) => ipcRenderer.invoke('mappings:remove', id),
    toggle: (id) => ipcRenderer.invoke('mappings:toggle', id),
    update: (id, data) => ipcRenderer.invoke('mappings:update', id, data),
  },
  proxy: {
    start: () => ipcRenderer.invoke('proxy:start'),
    stop: () => ipcRenderer.invoke('proxy:stop'),
    status: () => ipcRenderer.invoke('proxy:status'),
    onStatusChanged: (callback) => {
      ipcRenderer.on('proxy:status', (_, data) => callback(data));
    },
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
  },
  ssl: {
    getCAPath: () => ipcRenderer.invoke('ssl:get-ca-path'),
    revealCA: () => ipcRenderer.invoke('ssl:reveal-ca'),
    trustCA: () => ipcRenderer.invoke('ssl:trust-ca'),
  },
  i18n: {
    getStrings: () => ipcRenderer.invoke('i18n:get-strings'),
  },
});
