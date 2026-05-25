# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Build assets (Sass + JS) then run in development (opens the Electron window)
npm run build      # Build assets then package for distribution via electron-builder
npm run pack       # Build assets then electron-builder --dir (no installer, outputs to dist/)
npm run sass:build # Compile SCSS → src/renderer/styles.css
npm run js:build   # Bundle src/renderer/main.jsx → src/renderer/scripts.js via esbuild
npm run lint       # Run both JS (eslint) and CSS (stylelint) linters
npm run lint:js    # ESLint only
npm run lint:css   # Stylelint only (SCSS files)
npm test           # Run vitest in watch mode
npm run test:run   # Run vitest once (CI mode)
node --check <file>  # Syntax-check a file without running it
```

`sass:build` and `js:build` must run before `electron .` because the renderer loads the compiled `styles.css` and `scripts.js`. The `start`/`build`/`pack` scripts do this automatically.

## Architecture

Saeng is an Electron app that acts as a local reverse proxy, routing `.local` (and related) domains to localhost ports. The core approach uses a **PAC (Proxy Auto-Config) file** — the app configures the OS system proxy to point to a local PAC server, so browsers route matching domains through the app's HTTP proxy without requiring `/etc/hosts` edits or elevated port binding.

The project uses **ESM throughout** (`"type": "module"` in `package.json`). The single exception is `preload.cjs`, which must stay CommonJS because Electron's preload sandbox does not honour `"type": "module"`.

### Request flow

1. Browser navigates to `http://myapp.local` or `https://myapp.local`
2. OS auto-proxy points to `http://127.0.0.1:8181/proxy.pac`
3. PAC file returns `PROXY 127.0.0.1:<dynamicPort>` for configured domains, `DIRECT` for everything else
4. The HTTP proxy (`src/proxy/httpProxy.js`) receives the request:
   - Plain HTTP: reads `Host` header, looks up mapping, proxies to `localhost:<port>`
   - HTTPS (`CONNECT` method): if HTTPS is disabled, raw TCP tunnel to backend; if enabled, pipes through an internal HTTPS server for MITM SSL termination
   - WebSocket upgrades: replays the `Upgrade` request directly to the backend port
5. On proxy start/stop, `src/systemProxy.js` calls `networksetup` (macOS) or PowerShell registry writes (Windows) to set/clear the system auto-proxy URL

### Ports

- **8181** — PAC file server (fixed). Serves `/proxy.pac` dynamically from current mappings.
- **dynamic (port 0)** — HTTP proxy server. OS assigns the port; the PAC file is updated with the actual port at start time.
- **dynamic (port 0)** — Internal HTTPS server (only when HTTPS is enabled). Used as the MITM TLS termination target.

### Domain suffixes

`src/renderer/js/utils.js` defines the valid domain suffixes: `.local`, `.test`, `.localhost`, `.co.local`, `.co.test`. The default is `.local`. The PAC `FindProxyForURL` uses **exact hostname equality** — each domain/subdomain combination must be a separate mapping entry; there is no implicit subdomain matching.

### Electron process boundary

All logic runs in the **main process**. The renderer has no Node.js access.

- `preload.cjs` — exposes `window.electronAPI` via `contextBridge`. All renderer↔main communication goes through this object. Uses `.cjs` because Electron's preload sandbox requires CommonJS.
- `main.js` — wires all IPC handlers in `setupIPC()`. Every `ipcMain.handle` channel is defined there. Serves renderer files via a custom `app://` protocol with CSP nonce injection.
- `src/renderer/main.jsx` — React entry point; mounts `<App />` to `#root`.
- `src/renderer/components/App.jsx` — root React component, owns all state and dispatches to child views.

### Renderer

The renderer is a **React 19** app bundled by **esbuild**. SCSS is compiled by **Sass** from `src/renderer/scss/` → `src/renderer/styles.css`. Bootstrap 5 + Bootstrap Icons are used for UI. Source files in `src/renderer/components/` are `.jsx`; utility modules in `src/renderer/js/` are plain `.js`.

`eslint.config.mjs` intentionally ignores `src/renderer/scripts.js` (the esbuild output). The ESLint config covers only `.js` files — not `.jsx`.

### IPC channels (renderer → main)

| Channel | Description |
|---|---|
| `mappings:list/add/remove/update/toggle` | CRUD for domain mappings |
| `proxy:start/stop/status` | Control and query proxy state |
| `settings:get/set` | Read/write persistent settings |
| `ssl:get-ca-expiry/regenerate-ca/delete-ca/get-ca-path/reveal-ca/trust-ca` | CA cert management |
| `app:get-info/open-external` | App metadata, open URL in browser |
| `i18n:get-strings/get-locales/set-locale` | Internationalisation |

The main process also pushes `proxy:status` events to the renderer when proxy state changes (from the tray menu).

### HTTPS / SSL

`CertManager` (`src/proxy/certManager.js`) is a **singleton** via `static instance`. On first run it generates a 2048-bit RSA root CA (`ca.crt` + `ca.key`) and persists it to `app.getPath('userData')/certs/`. Per-domain leaf certs are generated lazily on first HTTPS CONNECT for that hostname, cached in memory and on disk. The `SNICallback` on the internal HTTPS server selects the correct cert per connection. If `certDir` ever needs to change, set `CertManager.instance = null` before calling `getInstance()` again.

The user must install the CA cert into the OS trust store once — `src/ssl/trust.js` runs `security add-trusted-cert` (macOS) or `certutil` via an elevated PowerShell process (Windows).

### Persistence

`src/store.js` wraps **electron-store v11** (ESM). The store file is `config.json` in `app.getPath('userData')`. The schema has two top-level keys: `mappings` (array) and `settings` (object).

Mapping shape:
```js
{ id, domain, port, https, enabled, label, createdAt }
```
`https` on a mapping means the **backend** expects HTTPS — it does not control whether the frontend domain is served over HTTPS (that is the global `settings.httpsEnabled` toggle).

Settings defaults: `{ httpsEnabled: true, startOnLaunch: true, colorMode: 'auto', locale: 'en' }`.

### Live mapping updates

Adding, removing, toggling, or editing a mapping while the proxy is running calls `ProxyManager.updateMappings()`, which pushes the change live to both `httpProxy` and `pacServer` — no proxy restart required.

### Startup / shutdown

On `app.whenReady`: clears any leftover system proxy pointing at our PAC URL (avoiding stomping VPN-managed settings on other interfaces), pre-warms the CA cert, then optionally auto-starts if `settings.startOnLaunch` is true.

On `app.before-quit`: tears down the proxy (which calls `clearSystemProxy`) before exit. On macOS and Windows, closing the window hides it rather than quitting; the tray keeps the app alive. On Linux, closing the window quits.

### Internationalisation

`src/i18n/i18n.js` loads locale JSON from `src/i18n/locales/`. Supports 15 languages including RTL (Arabic). The renderer uses a `t(key, vars)` helper in `App.jsx` that mirrors the main-process `i18n.t()`. Locale is persisted in settings and applied to `<html lang>` and `dir` attributes at runtime.

## Tests

Vitest is the test runner. Renderer tests (`tests/renderer/**`) run in jsdom; everything else runs in node.

```bash
npm run test:run   # single pass
npm test           # watch mode
```
