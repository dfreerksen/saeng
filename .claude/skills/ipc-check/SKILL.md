---
name: ipc-check
description: Cross-checks IPC wiring between preload.cjs (window.electronAPI), main.js (ipcMain.handle/webContents.send), and the renderer's electronAPI.* usage. Use after adding, renaming, or removing an IPC channel, or when asked to audit IPC consistency.
---

Run the bundled script to verify the three places that must agree on every IPC channel:

```bash
node .claude/skills/ipc-check/check-ipc.mjs
```

It executes `preload.cjs` with a mocked `electron` module to discover the real shape of `window.electronAPI` (including which `ipcRenderer.invoke`/`ipcRenderer.on` channel each member maps to), then cross-references that against `main.js` and `src/renderer/**`.

## What it reports

- **Errors** (exit code 1):
  - `electronAPI.X.Y` invokes a channel with no `ipcMain.handle(...)` in `main.js` — the renderer call would reject at runtime.
  - The renderer calls `electronAPI.X.Y` that `preload.cjs` doesn't expose at all — a `TypeError: ... is not a function` at runtime.
- **Warnings**:
  - `main.js` has an `ipcMain.handle('channel')` that no preload member invokes — a dead handler.
  - `preload.cjs` listens via `ipcRenderer.on('channel')` but `main.js` never calls `webContents.send('channel')` — the renderer callback never fires.
  - `main.js` calls `webContents.send('channel')` but no preload member subscribes via `ipcRenderer.on('channel')` — a dead push event.
- **Info**:
  - `electronAPI.X.Y` is exposed but never referenced in `src/renderer/**` — possibly dead API surface (or only used indirectly, e.g. assigned to a variable before use — check before removing).

## When to run this

- After adding a new IPC channel: confirm `preload.cjs` exposes it, `main.js` handles/sends it, and the renderer actually calls it.
- After renaming or removing a channel: confirm no stale references remain in any of the three places.
- Before updating the "IPC channels" table in `.claude/CLAUDE.md` — the table should match what this script considers consistent.

## Notes

- The script only understands the patterns currently used in this codebase: `ipcRenderer.invoke('channel', ...)`, `ipcRenderer.on('channel', cb)`, `ipcMain.handle('channel', ...)`, and `mainWindow?.webContents.send('channel', ...)`, all with string-literal channel names. Dynamically-constructed channel names won't be detected.
- `src/renderer/scripts.js` (the esbuild bundle output) is excluded from the renderer scan.
- A renderer usage like `electronAPI.mappings` (without a further `.list`/`.add`/etc.) is treated as "known" if any `electronAPI.mappings.*` path is exposed — it won't false-positive on code that destructures a namespace before calling a method.
