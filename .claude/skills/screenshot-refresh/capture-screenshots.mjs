#!/usr/bin/env node
// Launches the real Electron app with remote debugging enabled, drives the
// renderer via the Chrome DevTools Protocol (native fetch/WebSocket, no deps),
// and captures a PNG per sidebar view, per theme, to the repo root as
// screenshot-<theme>-<view>.png.

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

const NAV_ICONS = {
  mappings: 'bi-arrow-left-right',
  mocks: 'bi-magic',
  log: 'bi-list-columns-reverse',
  settings: 'bi-gear-wide-connected',
  about: 'bi-info-circle',
};

const args = process.argv.slice(2);
function flag(name, fallback) {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const views = flag('views', 'mappings,mocks,log,settings').split(',').map((v) => v.trim());
const width = Number(flag('width', '1356'));
const height = Number(flag('height', '796'));
const scale = Number(flag('scale', '2'));
// Comma-separated list of 'light'/'dark'. Pass --theme= (empty) to capture a
// single pass without overriding data-bs-theme, using legacy screenshot-<view>.png names.
const themes = flag('theme', 'light,dark').split(',').map((t) => t.trim()).filter(Boolean);
const outDir = path.resolve(root, flag('out-dir', '.'));
const port = Number(flag('port', '9333'));

for (const v of views) {
  if (!NAV_ICONS[v]) {
    console.error(`Unknown view "${v}". Valid views: ${Object.keys(NAV_ICONS).join(', ')}`);
    process.exit(1);
  }
}

for (const t of themes) {
  if (t !== 'light' && t !== 'dark') {
    console.error(`Unknown theme "${t}". Valid themes: light, dark`);
    process.exit(1);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let nextId = 1;
function cdpSend(ws, method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function waitForCDP(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for Electron's CDP server on port ${port}`);
}

async function findRendererTarget(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = list.find((t) => t.type === 'page' && t.url.startsWith('app://saeng'));
    if (target) return target;
    await sleep(300);
  }
  throw new Error('Could not find the Saeng renderer window via CDP (app://saeng/*)');
}

async function waitForAppReady(ws, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { result } = await cdpSend(ws, 'Runtime.evaluate', {
      expression: "!!document.querySelector('.sidebar')",
      returnByValue: true,
    });
    if (result?.value) return;
    await sleep(300);
  }
  throw new Error('Timed out waiting for the Saeng UI to render');
}

async function main() {
  console.log('Building renderer assets...');
  execSync('npm run sass:build && npm run js:build', { cwd: root, stdio: 'inherit' });

  console.log(`Launching Electron with --remote-debugging-port=${port}...`);
  const electronBin = path.join(root, 'node_modules/.bin/electron');
  const env = { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' };
  // electron . would otherwise run as a plain Node script (no GUI, no CDP)
  // if this env var is inherited from the shell.
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electronBin, ['.', `--remote-debugging-port=${port}`], {
    cwd: root,
    stdio: 'ignore',
    env,
  });

  let ws;
  try {
    await waitForCDP();
    const target = await findRendererTarget();

    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    await cdpSend(ws, 'Page.enable');
    await cdpSend(ws, 'Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: scale,
      mobile: false,
    });

    await waitForAppReady(ws);

    fs.mkdirSync(outDir, { recursive: true });

    // themes is empty when --theme= was passed explicitly: do a single pass
    // without overriding data-bs-theme, using legacy screenshot-<view>.png names.
    const passes = themes.length ? themes : [null];

    for (const themeName of passes) {
      if (themeName) {
        await cdpSend(ws, 'Runtime.evaluate', {
          expression: `document.documentElement.setAttribute('data-bs-theme', '${themeName}')`,
        });
        await sleep(200);
      }

      for (const view of views) {
        const icon = NAV_ICONS[view];
        const { result } = await cdpSend(ws, 'Runtime.evaluate', {
          expression: `(() => {
            const icon = document.querySelector('.nav-item i.${icon}');
            if (!icon) return false;
            icon.closest('button').click();
            return true;
          })()`,
          returnByValue: true,
        });
        if (!result?.value) {
          console.warn(`  Skipping "${view}": no .nav-item with icon .${icon} found (is it hidden, e.g. logging disabled?)`);
          continue;
        }

        await sleep(500);

        const { data } = await cdpSend(ws, 'Page.captureScreenshot', { format: 'png' });
        const suffix = themeName ? `-${themeName}` : '';
        const outPath = path.join(outDir, `screenshot${suffix}-${view}.png`);
        fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
        console.log(`  Wrote ${path.relative(root, outPath)}`);
      }
    }
  } finally {
    ws?.close();
    child.kill();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
