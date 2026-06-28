# Development

This document is for contributors working on Saeng itself. For what the app does and how to use it, see [README.md](README.md).

## Prerequisites

* Node `>=24.11.1`
  * [nvm](https://github.com/nvm-sh/nvm) is recommended
* npm `>=11.6.2`
* Xcode `>= 26.0` (to create local Mac build)
* GitHub CLI (for release)
  * Install with `brew install gh`

## Setup

```bash
nvm install
nvm use
npm install
```

## Running the app

```bash
npm start
```

This compiles the SCSS and bundles the renderer JS before launching Electron. The renderer loads `src/renderer/styles.css` and `src/renderer/scripts.js`, which are build artifacts (gitignored) — if you edit `.scss` or `.jsx`/`.js` files under `src/renderer/` and the app is already running, re-run `npm start` (or the individual build commands below) and restart Electron to see changes.

```bash
npm run sass:build # SCSS -> src/renderer/styles.css
npm run js:build   # main.jsx -> src/renderer/scripts.js (esbuild)
```

## Project structure

- `main.js` — Electron main process entry point; wires all IPC handlers in `setupIPC()`, creates the window/tray, and serves renderer files via a custom `app://` protocol.
- `preload.cjs` — exposes `window.electronAPI` to the renderer via `contextBridge`. CommonJS by necessity (Electron preload sandbox).
- `src/store.js` — persistent config (`electron-store`), schema for `mappings`, `mocks`, `windowBounds`, `settings`.
- `src/proxy/` — `ProxyManager`, `HttpProxy`, `pacServer`, `certManager`, `requestLog`, `healthChecker`, `har`.
- `src/ssl/` — CA trust helpers (`security`/`certutil`).
- `src/systemProxy.js` — sets/clears the OS auto-proxy (`networksetup` on macOS, registry on Windows).
- `src/i18n/` — `i18n.js` plus `locales/*.json` (15 languages).
- `src/renderer/` — React 19 app (`main.jsx` entry, `components/*.jsx`, `js/*.js` utilities, `scss/` source).

See `.claude/CLAUDE.md` for a deeper architectural walkthrough (request flow, IPC channel table, mocks, health checks, etc.).

## Testing

[Vitest](https://vitest.dev/) is the test runner. Renderer tests (`tests/renderer/**`) run in `jsdom`; everything else runs in `node` (see `vitest.config.js`).

```bash
npm test         # watch mode
npm run test:run # single pass (CI)
```

Test layout mirrors `src/`: `tests/proxy/`, `tests/renderer/components/`, `tests/renderer/js/`, `tests/i18n/`, etc.

## Linting

```bash
npm run lint     # JS + CSS
npm run lint:js  # ESLint (covers .js and .jsx files)
npm run lint:css # Stylelint (SCSS under src/renderer/scss/)
```

`eslint.config.mjs` excludes `src/renderer/scripts.js` (the esbuild output). `.jsx` files are linted with `eslint-plugin-react-hooks` (rules-of-hooks, exhaustive-deps); `eslint-plugin-react` is not used since its latest release isn't compatible with ESLint 10.

## i18n

When adding, renaming, or removing a user-facing string key, update `en.json` and all 14 other locale files in the same position, with real translations (not copies). Then verify:

```bash
node .claude/skills/i18n-check/check-locales.mjs
```

See `.claude/rules/i18n-completeness.md` for details.

## IPC changes

If you add, rename, or remove an IPC channel, keep `preload.cjs`, `main.js`, and renderer usages (`window.electronAPI.*`) in sync. The `.claude/skills/ipc-check` skill cross-checks this wiring.

## Packaging

```bash
npm run pack  # electron-builder --dir, unpacked output in dist/
npm run build # full installers via electron-builder
```

Build targets (see `package.json` `build` section): macOS (`dmg`, arm64 + x64), Windows (`nsis`), Linux (`AppImage`, `deb`).

## Debugging tips

* Saeng manages the OS system proxy setting. If the app crashes or is killed without a clean shutdown, the system proxy may be left pointing at `127.0.0.1:8181`; restart the app (it clears stale proxy settings pointing at our PAC URL on startup) or clear it manually via system network settings.
* The generated CA cert/key live in `app.getPath('userData')/certs/`. Delete that directory (or use the SSL settings UI) to force regeneration if HTTPS/MITM behaves unexpectedly.
* Renderer devtools: Electron's standard `Cmd+Option+I` (macOS) / `Ctrl+Shift+I` (Windows/Linux) shortcuts work when the window is focused.

## Releasing

Update the version in `package.json` and run `npm install`. Then run the release process using a Claude command and follow the instructions

```bash
/release
```

## Claude

These are Claude Code slash commands available when working in this repo.

| Command | Description |
| :--- | :--- |
| `/release` | See above |
| `/deps-update` | Audit outdated npm dependencies grouped by major/minor/patch, then apply updates and verify with lint and tests |
| `/i18n-check` | Audits the translation files against the English baseline. It checks for missing keys, extra/stale keys, and untranslated values |
| `/ipc-check` | Audits the three places that must stay in sync for every Electron IPC channel. Run it after adding/renaming/removing IPC channels |
| `/screenshot-refresh` | Run the app and make screenshots of each section for the README.md file |
