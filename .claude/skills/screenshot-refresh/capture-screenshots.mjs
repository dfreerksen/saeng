#!/usr/bin/env node
// Launches the real Electron app with remote debugging enabled, drives the
// renderer via the Chrome DevTools Protocol (native fetch/WebSocket, no deps),
// and captures a PNG per sidebar view, per theme, to assets/screenshots/ as
// screenshot-<theme>-<view>.png.

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

const NAV_ICONS = {
  dashboard: 'bi-speedometer2',
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

const views = flag('views', 'dashboard,mappings,mocks,log,settings').split(',').map((v) => v.trim());
const width = Number(flag('width', '1356'));
const height = Number(flag('height', '796'));
const scale = Number(flag('scale', '2'));
// Comma-separated list of 'light'/'dark'. Pass --theme= (empty) to capture a
// single pass without overriding data-bs-theme, using legacy screenshot-<view>.png names.
const themes = flag('theme', 'light,dark').split(',').map((t) => t.trim()).filter(Boolean);
const outDir = path.resolve(root, flag('out-dir', 'assets/screenshots'));
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

async function injectFakeLogEntries(ws) {
  const { result } = await cdpSend(ws, 'Runtime.evaluate', {
    expression: `(() => {
      const now = Date.now();
      const entries = [
        { id: 1, method: 'GET', hostname: 'webapp.local', path: '/', status: 200, https: false, websocket: false, timestamp: now - 12400, latencyMs: 34, mocked: false, error: null },
        { id: 2, method: 'POST', hostname: 'webapp.local', path: '/api/auth/login', status: 201, https: true, websocket: false, timestamp: now - 9800, latencyMs: 87, mocked: false, error: null },
        { id: 3, method: 'GET', hostname: 'api.webapp.local', path: '/v2/users?page=1&limit=25', status: 200, https: true, websocket: false, timestamp: now - 7200, latencyMs: 156, mocked: true, error: null },
        { id: 4, method: 'GET', hostname: 'dashboard.local', path: '/assets/styles.css', status: 304, https: false, websocket: false, timestamp: now - 4100, latencyMs: 8, mocked: false, error: null },
        { id: 5, method: 'PUT', hostname: 'webapp.local', path: '/api/users/42/profile', status: 500, https: true, websocket: false, timestamp: now - 2300, latencyMs: 203, mocked: false, error: 'ECONNREFUSED' },
        { id: 6, method: 'GET', hostname: 'dashboard.local', path: '/events', status: 101, https: false, websocket: true, timestamp: now - 500, latencyMs: 5, mocked: false, error: null },
      ];

      const root = document.getElementById('root');
      const containerKey = Object.keys(root).find(k => k.startsWith('__reactContainer'));
      if (!containerKey) return 'no-container';

      function findAppFiber(f) {
        if (!f) return null;
        if (typeof f.type === 'function' && f.type.name === 'App') return f;
        return findAppFiber(f.child) || findAppFiber(f.sibling);
      }

      const appFiber = findAppFiber(root[containerKey]);
      if (!appFiber) return 'no-app';

      // requestLog is the 4th useState hook (index 3)
      let hook = appFiber.memoizedState;
      for (let i = 0; i < 3; i++) {
        if (!hook) return 'hook-' + i;
        hook = hook.next;
      }

      if (!hook?.queue?.dispatch) return 'no-dispatch';
      hook.queue.dispatch(entries);
      return 'ok';
    })()`,
    returnByValue: true,
  });
  return result?.value;
}

async function injectFakeDashboardData(ws) {
  const { result } = await cdpSend(ws, 'Runtime.evaluate', {
    expression: `(() => {
      const now = Date.now();

      // Seeded PRNG for deterministic screenshots
      let seed = 42;
      function rand() {
        seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
        return seed / 0x7fffffff;
      }

      const hosts = ['webapp.local', 'api.webapp.local', 'dashboard.local', 'admin.dashboard.local'];
      const hostPaths = {
        'webapp.local': ['/', '/about', '/contact', '/login', '/assets/app.js', '/assets/styles.css', '/favicon.ico'],
        'api.webapp.local': ['/v2/users', '/v2/users?page=1&limit=25', '/v2/posts', '/v2/comments', '/v2/auth/token', '/v2/health'],
        'dashboard.local': ['/events', '/metrics', '/', '/assets/dashboard.js', '/assets/styles.css'],
        'admin.dashboard.local': ['/users', '/settings', '/audit-log'],
      };
      const methods = ['GET', 'GET', 'GET', 'GET', 'GET', 'POST', 'PUT', 'DELETE'];

      // Traffic pattern per minute bucket (index 0 = oldest, 29 = most recent)
      const traffic = [
        2,2,3,2,3, 3,4,3,4,3, 4,4,5,6,7,
        6,7,5,5,4, 4,3,4,3,3, 3,2,3,2,3
      ];

      const entries = [];
      let id = 1;
      for (let min = 0; min < 30; min++) {
        const count = traffic[min];
        for (let j = 0; j < count; j++) {
          const host = hosts[Math.floor(rand() * hosts.length)];
          const ps = hostPaths[host];
          const p = ps[Math.floor(rand() * ps.length)];
          const method = methods[Math.floor(rand() * methods.length)];
          const timestamp = now - (30 - min) * 60000 + Math.floor(rand() * 55000) + 2000;

          let status = 200;
          const r = rand();
          if (min >= 14 && min <= 17 && r > 0.82) status = 500;
          else if (r > 0.94) status = 500;
          else if (r > 0.90) status = 404;
          else if (r > 0.84) status = 304;
          else if (r > 0.80 && method === 'POST') status = 201;

          const latencyMs = Math.round(12 + rand() * 160 + (status >= 500 ? 80 + rand() * 120 : 0));
          const error = status === 500 && rand() > 0.4 ? 'ECONNREFUSED' : null;

          entries.push({
            id: id++, method, hostname: host, path: p, status,
            https: host.includes('api.'), websocket: false,
            timestamp, latencyMs, mocked: rand() > 0.88, error,
          });
        }
      }

      const mappings = [
        { id: 'm1', domain: 'webapp.local', host: '127.0.0.1', port: 3000, https: false, enabled: true, createdAt: now - 86400000, requestHeaders: [], responseHeaders: [], mocksEnabled: true },
        { id: 'm2', domain: 'api.webapp.local', host: '127.0.0.1', port: 3001, https: true, enabled: true, createdAt: now - 86400000, requestHeaders: [], responseHeaders: [], mocksEnabled: true },
        { id: 'm3', domain: 'dashboard.local', host: '127.0.0.1', port: 8080, https: false, enabled: true, createdAt: now - 86400000, requestHeaders: [], responseHeaders: [], mocksEnabled: false },
        { id: 'm4', domain: 'admin.dashboard.local', host: '127.0.0.1', port: 8081, https: false, enabled: false, createdAt: now - 86400000, requestHeaders: [], responseHeaders: [], mocksEnabled: false },
      ];

      const mocks = [
        { id: 'mk1', mappingId: 'm1', enabled: true, method: 'GET', pathPattern: '^/api/health$', statusCode: 200, headers: [], body: '{"status":"ok"}', delayMs: 0, createdAt: now - 86400000 },
        { id: 'mk2', mappingId: 'm2', enabled: true, method: '*', pathPattern: '^/v2/auth/token$', statusCode: 200, headers: [], body: '{"token":"fake"}', delayMs: 100, createdAt: now - 86400000 },
        { id: 'mk3', mappingId: 'm2', enabled: false, method: 'GET', pathPattern: '^/v2/users$', statusCode: 200, headers: [], body: '[]', delayMs: 0, createdAt: now - 86400000 },
      ];

      const healthStatuses = {
        m1: { id: 'm1', status: 'up', latencyMs: 12, checkedAt: now },
        m2: { id: 'm2', status: 'up', latencyMs: 45, checkedAt: now },
        m3: { id: 'm3', status: 'down', latencyMs: null, checkedAt: now, error: 'ECONNREFUSED' },
      };

      const root = document.getElementById('root');
      const containerKey = Object.keys(root).find(k => k.startsWith('__reactContainer'));
      if (!containerKey) return 'no-container';

      function findAppFiber(f) {
        if (!f) return null;
        if (typeof f.type === 'function' && f.type.name === 'App') return f;
        return findAppFiber(f.child) || findAppFiber(f.sibling);
      }

      const appFiber = findAppFiber(root[containerKey]);
      if (!appFiber) return 'no-app';

      function getHook(index) {
        let hook = appFiber.memoizedState;
        for (let i = 0; i < index; i++) {
          if (!hook) return null;
          hook = hook.next;
        }
        return hook;
      }

      // Hook 0: proxyRunning — true so health stats show
      const proxyHook = getHook(0);
      if (proxyHook?.queue?.dispatch) proxyHook.queue.dispatch(true);

      // Hook 1: mappings
      const mappingsHook = getHook(1);
      if (mappingsHook?.queue?.dispatch) mappingsHook.queue.dispatch(mappings);

      // Hook 2: mocks
      const mocksHook = getHook(2);
      if (mocksHook?.queue?.dispatch) mocksHook.queue.dispatch(mocks);

      // Hook 3: requestLog
      const logHook = getHook(3);
      if (logHook?.queue?.dispatch) logHook.queue.dispatch(entries);

      // Hook 4: healthStatuses
      const healthHook = getHook(4);
      if (healthHook?.queue?.dispatch) healthHook.queue.dispatch(healthStatuses);

      // Hook 5: settings — enable dashboard and health checks
      const settingsHook = getHook(5);
      if (settingsHook?.queue?.dispatch) {
        const current = settingsHook.memoizedState || {};
        settingsHook.queue.dispatch({ ...current, dashboardEnabled: true, healthCheckEnabled: true });
      }

      return 'ok';
    })()`,
    returnByValue: true,
  });
  return result?.value;
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
        if (view === 'dashboard') {
          const injected = await injectFakeDashboardData(ws);
          if (injected !== 'ok') {
            console.warn(`  Dashboard data injection returned: ${injected}`);
          }
          await sleep(600);
        }

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

        if (view === 'log') {
          const injected = await injectFakeLogEntries(ws);
          if (injected !== 'ok') {
            console.warn(`  Log entry injection returned: ${injected}`);
          }
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
