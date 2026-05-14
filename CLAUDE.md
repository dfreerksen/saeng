# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Run in development (opens the Electron window)
npm run build      # Package for distribution via electron-builder
npm run pack       # Build without creating installer (outputs to dist/)
node --check <file>  # Syntax-check a file without running it
```

There is no test suite. ESLint is configured (`eslint.config.mjs`) but has no npm script — run it directly with `npx eslint .`.

## Architecture

Saeng is an Electron app that acts as a local reverse proxy, routing `.local` domains to localhost ports. The core approach uses a **PAC (Proxy Auto-Config) file** — the app configures the OS system proxy to point to a local PAC server, so browsers route matching `.local` domains through the app's HTTP proxy without requiring `/etc/hosts` edits or elevated port binding.

The project uses **ESM throughout** (`"type": "module"` in `package.json`). The single exception is `preload.cjs`, which must stay CommonJS because Electron's preload sandbox does not honour `"type": "module"` — it always executes preload scripts as CommonJS regardless of the package type.

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

### Electron process boundary

All logic runs in the **main process**. The renderer has no Node.js access.

- `preload.cjs` — exposes `window.electronAPI` via `contextBridge`. All renderer↔main communication goes through this object. Uses `.cjs` extension because Electron's preload sandbox requires CommonJS (see note above).
- `main.js` — wires IPC handlers in `setupIPC()`. Every `ipcMain.handle` channel is defined there.
- `src/renderer/renderer.js` — calls `window.electronAPI.*` exclusively; never requires Node modules.

### HTTPS / SSL

`CertManager` (`src/proxy/certManager.js`) is a **singleton** via `static instance`. On first run it generates a 2048-bit RSA root CA and persists it to `app.getPath('userData')/certs/ca.crt`. Per-domain leaf certs are generated lazily on first HTTPS CONNECT for that hostname, cached in memory and on disk. The `SNICallback` on the internal HTTPS server selects the correct cert per connection. If `certDir` ever needs to change, set `CertManager.instance = null` before calling `getInstance()` again.

To make HTTPS work end-to-end the user must install the CA cert into the OS trust store once — `src/ssl/trust.js` runs `security add-trusted-cert` (macOS) or `certutil` via an elevated PowerShell process (Windows).

### Persistence

`src/store.js` wraps **electron-store v11** (ESM). The store file is `config.json` in `app.getPath('userData')`. The schema has two top-level keys: `mappings` (array) and `settings` (object).

Mapping shape:
```js
{ id, domain, port, https, enabled, label, createdAt }
```
`https` on a mapping means the **backend** expects HTTPS — it does not control whether the frontend domain is served over HTTPS (that is the global `settings.httpsEnabled` toggle).

### Live mapping updates

Adding, removing, or toggling a mapping while the proxy is running calls `ProxyManager.updateMappings()`, which pushes the change live to both `httpProxy` and `pacServer` — no proxy restart required. The PAC file is regenerated on the next request.

The PAC `FindProxyForURL` uses **exact hostname equality** (`host === "myapp.local"`), not wildcards. Each domain/subdomain combination must be a separate mapping entry; there is no implicit subdomain matching.

### Startup / shutdown

On `app.whenReady`: clears any leftover system proxy from a previous crash, pre-warms the CA cert, then optionally auto-starts the proxy if `settings.startOnLaunch` is true.

On `app.before-quit`: tears down the proxy (which calls `clearSystemProxy`) before exit. On macOS, closing the window hides it rather than quitting; the tray keeps the app alive.
