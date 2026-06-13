---
name: screenshot-refresh
description: Launches the real Electron app with remote debugging, drives the renderer via the Chrome DevTools Protocol, and captures a PNG per sidebar view (mappings, mocks, log, settings, about) in both light and dark themes to use in the README. Use when asked to update/refresh screenshots or take new screenshots of the app.
---

Run the bundled script to (re)build the renderer and capture fresh screenshots:

```bash
node .claude/skills/screenshot-refresh/capture-screenshots.mjs
```

By default this captures `mappings`, `mocks`, `log`, and `settings`, in both `light` and `dark` themes, to `assets/screenshots/` as `screenshot-<theme>-<view>.png` (e.g. `screenshot-light-mappings.png`, `screenshot-dark-mappings.png`), at 1356x796 with a 2x device scale factor (2712x1592 — matches the existing README screenshots exactly).

## How it works

1. Runs `npm run sass:build && npm run js:build` so the renderer reflects the latest source.
2. Launches `electron .` with `--remote-debugging-port=9333` (with `ELECTRON_RUN_AS_NODE` stripped from the env — if that var is inherited from the shell, `electron .` silently runs as a plain Node script instead of the GUI app and CDP never comes up).
3. Connects to the renderer's page target over the DevTools Protocol using Node's built-in `fetch`/`WebSocket` (no extra deps).
4. Overrides the viewport via `Emulation.setDeviceMetricsOverride` (so output size doesn't depend on the actual window size/display).
5. For each theme, sets `data-bs-theme` on `<html>`, then for each requested view clicks the matching `.nav-item` (by its Bootstrap icon class) and calls `Page.captureScreenshot`.
6. Kills the Electron process when done.

## Options

```bash
node .claude/skills/screenshot-refresh/capture-screenshots.mjs \
  --views=mappings,mocks,log,settings,about \
  --width=1356 --height=796 --scale=2 \
  --theme=light,dark \
  --out-dir=assets/screenshots \
  --port=9333
```

- `--views` — comma-separated subset of `mappings`, `mocks`, `log`, `settings`, `about`. `log` is skipped (with a warning) if `settings.loggingEnabled` is off, since the nav item won't exist.
- `--theme` — comma-separated subset of `light`, `dark` (default `light,dark`); sets `data-bs-theme` on `<html>` before capturing each. Pass `--theme=` (empty) to do a single pass without overriding the theme (uses whatever the app's current `colorMode` resolves to) and writes legacy `screenshot-<view>.png` names.
- `--out-dir` — defaults to `assets/screenshots`, matching where the existing `screenshot-*.png` files already live.

## Important caveats

- **This launches the real app with your real local config** (`~/Library/Application Support/saeng/config.json` on macOS) — mappings, mocks, and settings shown in the screenshots are whatever is currently configured. Set up representative mappings/mocks beforehand if the screenshots are for the README.
- If `settings.startOnLaunch` is true (the default), starting the app sets the OS auto-proxy via `networksetup`/PowerShell, same as `npm start`. It's cleared again when the process is killed at the end of the script — this is normal app behavior, not specific to this script.
- The Electron window will briefly become visible on screen during the run.

## After running

Review the generated PNGs, then update `README.md`'s `![Saeng ...](./assets/screenshots/screenshot-<theme>-<view>.png "...")` references if you added/removed/renamed any screenshots.
