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
   - Plain HTTP: reads `Host` header, looks up mapping, proxies to `<mapping.host>:<port>` (defaults to `127.0.0.1`)
   - HTTPS (`CONNECT` method): if HTTPS is disabled, raw TCP tunnel to backend; if enabled, pipes through an internal HTTPS server for MITM SSL termination
   - WebSocket upgrades: replays the `Upgrade` request directly to the backend host/port
5. On proxy start/stop, `src/systemProxy.js` calls `networksetup` (macOS) or PowerShell registry writes (Windows) to set/clear the system auto-proxy URL

### Ports

- **8181** — PAC file server (fixed). Serves `/proxy.pac` dynamically from current mappings.
- **dynamic (port 0)** — HTTP proxy server. OS assigns the port; the PAC file is updated with the actual port at start time.
- **dynamic (port 0)** — Internal HTTPS server (only when HTTPS is enabled). Used as the MITM TLS termination target.

### Domain suffixes

`src/renderer/js/utils.js` defines the valid domain suffixes: `.local`, `.test`, `.localhost`, `.self`, `.co.local`, `.co.test`. The default is `.local`. The PAC `FindProxyForURL` uses **exact hostname equality** — each domain/subdomain combination must be a separate mapping entry; there is no implicit subdomain matching.

### Electron process boundary

All logic runs in the **main process**. The renderer has no Node.js access.

- `preload.cjs` — exposes `window.electronAPI` via `contextBridge`. All renderer↔main communication goes through this object. Uses `.cjs` because Electron's preload sandbox requires CommonJS.
- `main.js` — wires all IPC handlers in `setupIPC()`. Every `ipcMain.handle` channel is defined there. Serves renderer files via a custom `app://` protocol with CSP nonce injection.
- `src/renderer/main.jsx` — React entry point; mounts `<App />` to `#root`.
- `src/renderer/components/App.jsx` — root React component, owns all state and dispatches to child views.

### Renderer

The renderer is a **React 19** app bundled by **esbuild**. SCSS is compiled by **Sass** from `src/renderer/scss/` → `src/renderer/styles.css`. Bootstrap 5 + Bootstrap Icons are used for UI. **chart.js** and **react-chartjs-2** provide the time-series charts on the Dashboard view. Source files in `src/renderer/components/` are `.jsx`; utility modules in `src/renderer/js/` are plain `.js`.

`src/renderer/components/` is organized into subdirectories by role: `layout/` (`Sidebar.jsx`, `Titlebar.jsx`), `modals/` (`Modal.jsx`, `MappingModal.jsx`, `MockModal.jsx`, `MockRegexHelpPane.jsx`, `AboutModal.jsx`, `ExportModal.jsx`, `AppModals.jsx` — renders the set of modals owned by `App.jsx`), `settings/` (`ProxySection.jsx`, `CertificateSection.jsx`, `RequestLogsSection.jsx`, `HealthChecksSection.jsx`, `PreferencesSection.jsx` — extracted sections rendered by `SettingsView.jsx`), and `utilities/` (`Toast.jsx`, `Tooltip.jsx`). View-level components (`App.jsx`, `DashboardView.jsx`, `MappingsView.jsx`, `MocksView.jsx`, `LogView.jsx`, `LogDetailPanel.jsx`, `SettingsView.jsx`, `ConditionListEditor.jsx`, `HeaderListEditor.jsx`) live directly under `components/`.

`eslint.config.mjs` intentionally ignores `src/renderer/scripts.js` (the esbuild output). The ESLint config covers `.js` files and `.jsx` files — the `.jsx` block includes `eslint-plugin-react` (`jsx-uses-vars`, `no-unknown-property`) and `eslint-plugin-react-hooks` (`rules-of-hooks`, `exhaustive-deps`).

### IPC channels (renderer → main)

| Channel | Description |
|---|---|
| `mappings:list/add/remove/update/toggle` | CRUD for domain mappings |
| `mappings:setGroupEnabled` | Enable/disable every mapping in a domain group at once (takes an array of ids + target enabled state) |
| `mappings:export/import` | Export/import mappings to/from a JSON file via native save/open dialogs |
| `mocks:list/add/update/remove/toggle` | CRUD for mock response rules |
| `mocks:export/import` | Export/import mock rules to/from a JSON file via native save/open dialogs |
| `proxy:start/stop/status` | Control and query proxy state |
| `requestLog:list/clear` | Read/clear the in-memory request log |
| `requestLog:exportHar` | Export the current request log as a HAR file via a native save dialog |
| `health:list` | Read current backend health-check statuses, keyed by mapping id |
| `settings:get/set` | Read/write persistent settings |
| `ssl:get-ca-expiry/regenerate-ca/delete-ca/get-ca-path/reveal-ca/trust-ca` | CA cert management |
| `app:get-info/open-external` | App metadata, open URL in browser |
| `update:get-status` | Read the current update-checker status (current/latest version, update availability, release URL) |
| `i18n:get-strings/get-locales/set-locale` | Internationalisation |

The main process also pushes `proxy:status` events to the renderer when proxy state changes (from the tray menu), `health:update` events whenever a backend health check completes, and `update:status` events whenever the update checker re-polls GitHub.

### HTTPS / SSL

`CertManager` (`src/proxy/certManager.js`) is a **singleton** via `static instance`. On first run it generates a 2048-bit RSA root CA (`ca.crt` + `ca.key`) and persists it to `app.getPath('userData')/certs/`. Per-domain leaf certs are generated lazily on first HTTPS CONNECT for that hostname, cached in memory and on disk. The `SNICallback` on the internal HTTPS server selects the correct cert per connection. If `certDir` ever needs to change, set `CertManager.instance = null` before calling `getInstance()` again.

The user must install the CA cert into the OS trust store once — `src/ssl/trust.js` runs `security add-trusted-cert` (macOS) or `certutil` via an elevated PowerShell process (Windows).

### Persistence

`src/store.js` wraps **electron-store v11** (ESM). The store file is `config.json` in `app.getPath('userData')`. The schema has four top-level keys: `mappings` (array), `mocks` (array), `windowBounds` (object), and `settings` (object).

Mapping shape:
```js
{ id, domain, host, port, https, enabled, createdAt, requestHeaders, responseHeaders, mocksEnabled, pathRewriteFrom, pathRewriteTo }
```
`host` is the backend hostname to proxy to (defaults to `127.0.0.1`). It is used for all connection types: plain HTTP, HTTPS CONNECT tunnels, and WebSocket upgrades. `https` on a mapping means the **backend** expects HTTPS — it does not control whether the frontend domain is served over HTTPS (that is the global `settings.httpsEnabled` toggle). `mocksEnabled` (default `false`) gates whether any mock rules for this mapping are applied — see [Mocks](#mocks).

`pathRewriteFrom`/`pathRewriteTo` (both default `''`, sanitized via `sanitizePathRewriteFrom()`/`sanitizePathRewriteTo()` — trimmed, given a leading `/` if non-empty, trailing `/` stripped unless the value is just `/`) let a mapping strip or replace a path prefix before forwarding to the backend. `HttpProxy._rewritePath(mapping, pathWithQuery)` rewrites the path only when `pathRewriteFrom` is non-empty and the request pathname is exactly `pathRewriteFrom` or starts with `pathRewriteFrom + '/'`, replacing the matched prefix with `pathRewriteTo` (falling back to `/` if the result is empty) while preserving the query string; it is called from `_handleRequest`, `_handleDecryptedRequest`, and `_handleWebSocketUpgrade` (applied to `req.url` when replaying the upgrade request line) right before the backend request/connection is built. Rewriting happens *after* `_findMock()` is checked, so mock rules always match the original, pre-rewrite request path — rewriting only affects what is sent to the real backend. Raw HTTPS CONNECT tunnels (`_tunnelRaw`, used when global HTTPS is disabled) are opaque TCP and are not affected by path rewriting.

`requestHeaders`/`responseHeaders` are arrays of `{ name, value }` pairs (sanitized via `sanitizeHeaders()`, default `[]`), editable per-mapping in `MappingModal.jsx`. `HttpProxy._applyHeaderOverrides()` lowercases each `name` and sets it on the headers object, so overrides replace rather than duplicate existing headers — `requestHeaders` are applied to the outgoing backend request (including WebSocket upgrade replays) and `responseHeaders` to the response written back to the client.

`windowBounds` (`{ width, height }`, default `940x680`) is read via `store.getWindowBounds()` when creating the `BrowserWindow` and saved via `store.setWindowBounds()` on the window's `close` event, so the app reopens at its last size.

Settings defaults: `{ httpsEnabled: true, startOnLaunch: true, colorMode: 'auto', locale: 'en', iconMode: 'both', dashboardEnabled: false, logMaxEntries: DEFAULT_LOG_MAX_ENTRIES, loggingEnabled: true, logHeadersEnabled: false, logBodyEnabled: false, healthCheckEnabled: false, healthCheckIntervalMs: DEFAULT_INTERVAL_MS, healthCheckTimeoutMs: DEFAULT_TIMEOUT_MS }`. `healthCheckIntervalMs` (1 min default, clamped 5s-300s) and `healthCheckTimeoutMs` (2s default, clamped 500ms-30s) come from `src/proxy/healthChecker.js`'s exported defaults and are clamped in `setSettings()`. `iconMode` is validated to one of `both`, `tray`, `dock` (default `both`).

`store.exportMappings(ids)` / `store.importMappings(list)` back the `mappings:export`/`mappings:import` IPC handlers — export writes `{ mappings: [...] }` JSON via a save dialog, import reads a file (accepting either a bare array or `{ mappings: [...] }`), skipping mappings that already exist.

### Request log

`RequestLog` (`src/proxy/requestLog.js`) is an in-memory ring buffer (default cap `DEFAULT_MAX_ENTRIES = 300`, configurable via `settings.logMaxEntries`) that records metadata for each proxied request, including the error reason on failures. It lives on `ProxyManager` and is wired into `HttpProxy` so entries are recorded on the hot path. Toggling `settings.loggingEnabled` calls `requestLog.setEnabled()`, which short-circuits `add()` without clearing existing entries. The renderer's `LogView.jsx` reads/clears it via the `requestLog:list/clear` IPC channels.

When `settings.logHeadersEnabled`/`settings.logBodyEnabled` are true, `HttpProxy._recordRequest()` additionally attaches `requestHeaders`/`responseHeaders` to each entry, and `_captureBody()` captures up to `MAX_BODY_CAPTURE_BYTES` (64 KB) of `requestBody`/`responseBody`, setting `requestBodyTruncated`/`responseBodyTruncated` if the real body was larger. `RequestLog.setLogHeaders()`/`setLogBody()` (called from `settings:set`) control this without restarting the proxy. `LogView.jsx` shows an expandable details row per entry with header tables and body previews when either setting is enabled.

The `requestLog:exportHar` IPC handler writes the current log to a `.har` file (via a save dialog) using `buildHar()` from `src/proxy/har.js`, which converts entries into a HAR 1.2 document (`log.entries[]` with `request`/`response`/`timings`) for use with browser dev tools or other HTTP debugging tools. Log entries served from a mock have `mocked: true`, shown as a "MOCK" badge in `LogView.jsx` and exported as `_mocked: true` on the HAR entry.

`src/renderer/js/logFilter.js` exports `FILTER_TABS` (an ordered list of filter tab names: `all`, `http`, `https`, `ws`, `json`, `xhr`, `doc`, `css`, `js`, `font`, `img`, `manifest`, `wasm`, `graphql`, `wml`, `other`) and `matchesFilter(entry, filter)`, which classifies a log entry by inspecting `content-type` response headers, request path extension, and request metadata. `LogView.jsx` renders a tab bar using `FILTER_TABS` and applies `matchesFilter` client-side to the already-fetched log entries — no IPC required for filtering.

### Mocks

`mocks` is a separate top-level store array, independent of `mappings`, with shape:
```js
{ id, mappingId, enabled, method, pathPattern, statusCode, headers, body, delayMs, conditions, createdAt }
```
`method` is uppercased, or `*` to match any method (`sanitizeMockMethod()`). `pathPattern` is a regular expression matched against the request path **without the query string**; `validatePathPattern()` throws if it doesn't compile, both on `store.addMock()`/`updateMock()` and client-side in `MockModal.jsx`. `statusCode` is clamped to 100-599 (default 200, via `sanitizeMockStatusCode()`). `delayMs` is clamped to 0-30000 (default 0, via `sanitizeMockDelayMs()`); when > 0, `_serveMock()` delays the response by that many milliseconds via `setTimeout`. `headers` is a `requestHeaders`-style array applied to the mocked response via `_applyHeaderOverrides()`.

`conditions` (default `[]`) is an array of `{ type, key, operator, value }` extra-match rules a mock must *also* satisfy beyond method/`pathPattern`, sanitized via `sanitizeConditions()` and validated by `validateConditions()` (throws on an unparsable `regex` operator value) in `store.js`. `type` is `header`, `query`, or `body` (`key` is required for `header`/`query`, dropped if blank; not used for `body`). `operator` is `equals`, `contains`, `regex`, or `exists`. All conditions in a mock's list must match (AND) for the mock to apply. `ConditionListEditor.jsx` is the shared row-editor UI used by `MockModal.jsx`, mirroring `HeaderListEditor.jsx`'s pattern.

On the proxy side, `HttpProxy._compileConditions()` pre-lowercases `header` condition keys and pre-compiles `regex` operator values (a compile failure skips the whole mock, same as an invalid `pathPattern`); `_findMock()` additionally calls `_conditionsMatch()`/`_conditionMatches()` against an `extra` object (`{ headers, query, body }`) built from the request. Because a `body` condition needs the full request body before a match decision can be made, `HttpProxy.updateMocks()` also tracks `mocksNeedBody` (a `Set<mappingId>`); `_dispatch()` checks this set and, when present, buffers the whole request body via `_readFullBody()` before calling `_continueRequest()` — otherwise requests stream through unbuffered as before. When the body was pre-buffered, `_continueRequest()`/`_serveMock()` replay it (`proxyReq.end(bufferedBody)` / passing `bufferedBody` into `_serveMock()`) instead of re-reading `req`, since a request stream can only be consumed once.

Mock bodies support template variables rendered at request time by `renderMockTemplate()` (`src/proxy/mockTemplate.js`). Variables use `{{name}}` syntax: `{{timestamp}}` (epoch ms), `{{isodate}}` (ISO 8601), `{{uuid}}` (v4), `{{request.method}}`, `{{request.path}}`, `{{request.url}}`, `{{request.body}}`, `{{request.host}}`, `{{request.header.<name>}}` (lowercased header lookup), and `{{match.<N>}}` (regex capture groups from the `pathPattern` match). Unrecognized variables are left as-is. Templates are skipped entirely if the body contains no `{{`.

A mock only takes effect if its mapping has `mocksEnabled: true`. `HttpProxy.updateMocks(mocks)` compiles all enabled mocks into a `Map<mappingId, CompiledMock[]>` (regexes pre-compiled, invalid patterns skipped defensively), called by `ProxyManager` on proxy start and whenever mocks change (mirroring `updateMappings()`'s live-update pattern — no restart required). For each plain HTTP or HTTPS (post-MITM) request, `_findMock()` returns the first rule whose method, `pathPattern`, and `conditions` all match; `_serveMock()` renders template variables in the mock body, writes the mocked status/headers/body directly to the client without contacting the backend, always sets `x-saeng-mock: true` on the response, and marks the log record `mocked: true`. Mocking does not apply to WebSocket upgrades or raw HTTPS tunnels (when global HTTPS is disabled).

`store.removeMocksForMapping(mappingId)` is called from the `mappings:remove` handler to delete orphaned mocks when their mapping is removed. `store.exportMocks(ids)`/`importMocks(list)` mirror the mapping export/import functions but key on the mapping's `domain` rather than `mappingId` (so exports are portable across stores) — import skips entries whose `domain` doesn't match an existing mapping.

In the renderer, `MocksView.jsx` groups mocks by mapping domain (mirroring `MappingsView.jsx`), `MockModal.jsx` is the add/edit form with an inline regex-help pane (toggled by a help button) showing example `pathPattern` regexes with copy-to-clipboard. `MockModal.jsx` and `MappingModal.jsx` share the extracted `HeaderListEditor.jsx` component for editing header lists. `ExportModal.jsx` was generalized to take `items`/`i18nPrefix` props so it can be reused for both mapping and mock exports.

### Mapping groups

`MappingsView.jsx` groups mappings by their base domain (`domain + suffix` from `splitDomain()`, e.g. `myapp.local`) into separate `<tbody>` blocks, each with a group header row showing the base domain and a "toggle all" checkbox. That checkbox calls `mappings:setGroupEnabled` (backed by `store.setMappingsEnabled(ids, enabled)`) to enable/disable every mapping in the group in one update. Within a group, rows are ordered by `compareMappings`/`subdomainRank`: the bare domain (no subdomain) first, then named subdomains alphanumerically, then the wildcard `*` subdomain last. Copying a wildcard mapping's URL copies the bare base domain rather than the literal `*.domain` host.

### Live mapping updates

Adding, removing, toggling, or editing a mapping always calls `ProxyManager.updateMappings()`. While the proxy is running this pushes the change live to both `httpProxy` and `pacServer` — no proxy restart required. It also always forwards the new mapping list to `healthChecker.updateMappings()`, even when the proxy is stopped, so health-check state stays in sync.

### Health checks

`HealthChecker` (`src/proxy/healthChecker.js`) lives on `ProxyManager` and, when `settings.healthCheckEnabled` is true and the proxy is running (`setProxyRunning()`), periodically opens a raw TCP connection (`net.connect`) to each enabled mapping's `host:port` on a `setInterval` of `settings.healthCheckIntervalMs`, timing out after `settings.healthCheckTimeoutMs`. Each check produces `{ id, status: 'up' | 'down', latencyMs, checkedAt, error }`, stored in an in-memory map and emitted to a listener (mirroring `RequestLog`'s pattern). Newly-enabled mappings are checked immediately rather than waiting for the next tick.

`main.js` wires `healthChecker.setListener()` to push `health:update` events to the renderer, exposes the current map via `health:list`, and starts the checker (`healthChecker.start(mappings)`) on `app.whenReady` regardless of `startOnLaunch`. `settings:set` calls `setEnabled`/`setIntervalMs`/`setTimeoutMs` on the checker when those keys change. The renderer's `MappingsView.jsx` shows a colored status dot with a tooltip next to each domain when `settings.healthCheckEnabled` is true and the mapping is enabled and the proxy is running.

### Update checker

`UpdateChecker` (`src/updateChecker.js`) polls the GitHub releases API (`https://api.github.com/repos/dfreerksen/saeng/releases/latest`) once at startup and then every 6 hours (`CHECK_INTERVAL_MS`), comparing the latest release tag against `pkg.version` via `isNewerVersion()`. Each check produces `{ updateAvailable, currentVersion, latestVersion, url }`, emitted to a listener (mirroring `HealthChecker`'s pattern). `main.js` constructs it on `app.whenReady`, wires `setListener()` to push `update:status` events to the renderer, exposes the current status via `update:get-status`, calls `updateChecker.start()`, and stops it on `before-quit`. The renderer's `Titlebar.jsx` shows an "update available" badge that links to the release URL when `updateInfo.updateAvailable` is true.

### Startup / shutdown

On `app.whenReady`: clears any leftover system proxy pointing at our PAC URL (avoiding stomping VPN-managed settings on other interfaces), pre-warms the CA cert, creates the window, conditionally creates the tray (if `iconMode` is `tray` or `both`), hides the dock if `iconMode` is `tray` (macOS), starts the health checker, then optionally auto-starts the proxy if `settings.startOnLaunch` is true.

On `app.before-quit`: stops the health checker and tears down the proxy (which calls `clearSystemProxy`) before exit. On macOS and Windows, closing the window hides it rather than quitting when a tray icon is active (`iconMode` is `tray` or `both`); otherwise closing quits. On Linux, closing the window always quits.

### Icon mode

`settings.iconMode` controls where the app icon appears: `both` (default, tray + dock/taskbar), `tray` (tray only, dock hidden on macOS), or `dock` (dock/taskbar only, no tray). Changing the setting at runtime dynamically creates/destroys the tray and shows/hides the dock. When `iconMode` is `dock`, closing the window quits the app on all platforms since there is no tray to keep it alive.

Tray icons live in `assets/icons/tray/` with platform-specific variants: macOS uses template images (`tray.png` + `tray@2x.png` with `setTemplateImage(true)`), Windows uses `tray.ico`, Linux uses `tray.png`. Dock/app icons are in `assets/icons/dock/` (per-platform subdirectories referenced by `electron-builder` config in `package.json`). The about panel icon is `assets/icons/about/icon.png`.

### Dashboard

`DashboardView.jsx` is an optional overview screen (controlled by `settings.dashboardEnabled`, default `false`). When enabled, it becomes the initial view on app load and appears as the first item in the sidebar. It shows:

- **Stat cards** — total requests, error rate, average latency (when logging is enabled), domains up/down (when health checks are enabled and the proxy is running), active/disabled mappings, and active/disabled mocks.
- **Time-series charts** — requests per minute, error rate (%), and average latency (ms) over the last 30 minutes, rendered with chart.js / react-chartjs-2.
- **Group breakdowns** — mappings and mocks counted per base domain.

All data is derived from the existing in-memory request log, mappings, mocks, and health-check state — no additional IPC channels or persistence are required. If the dashboard is disabled while the user is viewing it, the app redirects to the mappings view.

### Internationalisation

`src/i18n/i18n.js` loads locale JSON from `src/i18n/locales/`. Supports 21 languages (`ar`, `be`, `bg`, `de`, `en`, `es`, `fr`, `id`, `it`, `ja`, `ko`, `nl`, `pl`, `pt`, `ru`, `sv`, `th`, `tr`, `uk`, `vi`, `zh`) including RTL (Arabic). The renderer uses a `t(key, vars)` helper in `App.jsx` that mirrors the main-process `i18n.t()`. Locale is persisted in settings and applied to `<html lang>` and `dir` attributes at runtime.

## Tests

Vitest is the test runner. Renderer tests (`tests/renderer/**`) run in jsdom; everything else runs in node.

```bash
npm run test:run   # single pass
npm test           # watch mode
```
