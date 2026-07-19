#!/usr/bin/env node
// Cross-checks IPC wiring between preload.cjs (window.electronAPI), main.js
// (ipcMain.handle / webContents.send), and the renderer's electronAPI usage.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const require = createRequire(import.meta.url);

// --- 1. Execute preload.cjs with a mocked `electron` module to discover
// what window.electronAPI exposes, and which channel each member maps to. ---

const preloadPath = path.join(root, 'preload.cjs');
const preloadSrc = fs.readFileSync(preloadPath, 'utf8');

let lastInvoke = null;
let lastOn = null;
let exposedAPI = null;

const mockElectron = {
  contextBridge: {
    exposeInMainWorld: (_name, api) => {
      exposedAPI = api;
    },
  },
  ipcRenderer: {
    invoke: (channel) => {
      lastInvoke = channel;
      return Promise.resolve();
    },
    on: (channel) => {
      lastOn = channel;
    },
  },
};

const customRequire = (name) => (name === 'electron' ? mockElectron : require(name));
const runPreload = new Function('require', 'module', 'exports', 'process', preloadSrc);
runPreload(customRequire, { exports: {} }, {}, process);

const exposedInvoke = new Map(); // 'mappings.list' -> 'mappings:list'
const exposedOn = new Map(); // 'proxy.onStatusChanged' -> 'proxy:status'
const exposedValues = new Map(); // 'platform' -> 'darwin'

function walkExposed(obj, prefix) {
  for (const [key, val] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'function') {
      lastInvoke = null;
      lastOn = null;
      try {
        val();
      } catch {
        // Some wrappers expect real arguments/callbacks - safe to ignore.
      }
      if (lastInvoke) exposedInvoke.set(p, lastInvoke);
      if (lastOn) exposedOn.set(p, lastOn);
      if (!lastInvoke && !lastOn) exposedValues.set(p, '(function, channel unknown)');
    } else if (val !== null && typeof val === 'object') {
      walkExposed(val, p);
    } else {
      exposedValues.set(p, val);
    }
  }
}

walkExposed(exposedAPI, '');

// --- 2. Scan main.js and src/ipc/*.js for ipcMain.handle() and webContents.send()
// channels. Some channels are registered directly in main.js (settings:*, app:*,
// update:*, i18n:*); others live in src/ipc/ modules invoked via registerXxxIpc(ctx). ---

const mainSrc = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

const ipcDir = path.join(root, 'src/ipc');
const ipcModuleFiles = fs.existsSync(ipcDir)
  ? fs.readdirSync(ipcDir).filter((f) => f.endsWith('.js'))
  : [];
const ipcSrc = ipcModuleFiles
  .map((f) => fs.readFileSync(path.join(ipcDir, f), 'utf8'))
  .join('\n');

const combinedSrc = `${mainSrc}\n${ipcSrc}`;

const handledChannels = new Set();
for (const m of combinedSrc.matchAll(/ipcMain\.handle\(\s*['"]([^'"]+)['"]/g)) {
  handledChannels.add(m[1]);
}

const sentChannels = new Set();
for (const m of combinedSrc.matchAll(/webContents\.send\(\s*['"]([^'"]+)['"]/g)) {
  sentChannels.add(m[1]);
}

// --- 3. Scan the renderer for window.electronAPI.* usages ---

function walkDir(dir, exts) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full, exts));
    else if (exts.includes(path.extname(entry.name))) results.push(full);
  }
  return results;
}

const rendererFiles = walkDir(path.join(root, 'src/renderer'), ['.jsx', '.js']).filter(
  (f) => !f.endsWith('scripts.js')
);

const usedPaths = new Map(); // 'mappings.list' -> Set of files

for (const file of rendererFiles) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/electronAPI\.([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g)) {
    const p = m[1];
    if (!usedPaths.has(p)) usedPaths.set(p, new Set());
    usedPaths.get(p).add(path.relative(root, file));
  }
}

// --- 4. Cross-check everything ---

const errors = [];
const warnings = [];
const info = [];

// A. preload invokes a channel main.js doesn't handle -> renderer call rejects at runtime.
for (const [p, channel] of exposedInvoke) {
  if (!handledChannels.has(channel)) {
    errors.push(
      `preload.cjs: electronAPI.${p} -> ipcRenderer.invoke('${channel}'), but main.js has no ipcMain.handle('${channel}')`
    );
  }
}

// B. main.js handles a channel preload never invokes -> dead handler.
const exposedInvokeChannels = new Set(exposedInvoke.values());
for (const channel of handledChannels) {
  if (!exposedInvokeChannels.has(channel)) {
    warnings.push(
      `main.js: ipcMain.handle('${channel}') has no matching ipcRenderer.invoke('${channel}') in preload.cjs`
    );
  }
}

// C. preload listens for an event main.js never sends -> renderer callback never fires.
for (const [p, channel] of exposedOn) {
  if (!sentChannels.has(channel)) {
    warnings.push(
      `preload.cjs: electronAPI.${p} -> ipcRenderer.on('${channel}'), but no webContents.send('${channel}') found in main.js`
    );
  }
}

// D. main.js sends an event preload never subscribes to -> dead push.
const exposedOnChannels = new Set(exposedOn.values());
for (const channel of sentChannels) {
  if (!exposedOnChannels.has(channel)) {
    warnings.push(
      `main.js: webContents.send('${channel}') has no matching ipcRenderer.on('${channel}') in preload.cjs`
    );
  }
}

// E. renderer calls electronAPI.X.Y that preload doesn't expose -> TypeError at runtime.
const allExposedPaths = new Set([...exposedInvoke.keys(), ...exposedOn.keys(), ...exposedValues.keys()]);
for (const [p, files] of usedPaths) {
  const isKnownLeaf = allExposedPaths.has(p);
  const isKnownPrefix = [...allExposedPaths].some((ep) => ep.startsWith(`${p}.`));
  if (!isKnownLeaf && !isKnownPrefix) {
    errors.push(`renderer calls electronAPI.${p}, but preload.cjs does not expose it (used in: ${[...files].join(', ')})`);
  }
}

// F. preload exposes something the renderer never references -> possibly dead API surface.
for (const p of allExposedPaths) {
  if (p === 'platform') continue;
  if (!usedPaths.has(p)) {
    info.push(`electronAPI.${p} is exposed in preload.cjs but not referenced anywhere in src/renderer`);
  }
}

// --- 5. Report ---

console.log('IPC consistency check');
console.log('=====================\n');

if (errors.length) {
  console.log(`Errors (${errors.length}):`);
  for (const e of errors) console.log(`  x ${e}`);
  console.log();
}
if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ! ${w}`);
  console.log();
}
if (info.length) {
  console.log(`Info (${info.length}):`);
  for (const i of info) console.log(`  - ${i}`);
  console.log();
}

if (!errors.length && !warnings.length && !info.length) {
  console.log('All IPC channels are consistent across preload.cjs, main.js, and the renderer.');
}

process.exitCode = errors.length ? 1 : 0;
