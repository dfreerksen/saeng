# Settings

Open **Settings** from the sidebar to configure Saeng's behavior. Changes take effect immediately unless otherwise noted.

## General

### Start on Launch
When enabled, Saeng automatically starts the proxy when the app opens. Default: **on**.

### Color Mode
Controls the app's appearance:
- **Auto** — follows the OS light/dark mode setting (default)
- **Light** — always light
- **Dark** — always dark

### Language
Choose the display language. Saeng supports 21 languages including Arabic (RTL). The selected locale is applied to all UI text immediately, including the `lang` and `dir` attributes on the document.

### Icon Mode
Controls where the Saeng icon appears:
- **Both** — tray icon + Dock/taskbar icon (default)
- **Tray only** — Dock/taskbar icon hidden; closing the window keeps Saeng running in the background
- **Dock/taskbar only** — no tray icon; closing the window quits Saeng

> On Linux, the icon mode setting has no effect — closing the window always quits the app.

### Dashboard
Enables the [Dashboard](Dashboard.md) overview screen. When on, the Dashboard becomes the first sidebar item and the default view on launch. Default: **off**.

## Logging

### Enable Logging
Toggles request logging on or off. When disabled, no new entries are recorded (existing entries are kept). Default: **on**.

### Log Max Entries
The maximum number of log entries to keep in memory. Oldest entries are dropped once the limit is reached. Default: **300**.

### Log Request/Response Headers
When enabled, full request and response headers are captured per entry and shown in the expandable detail row in the Logs view. Default: **off**.

### Log Request/Response Body
When enabled, up to 64 KB of request and response body is captured per entry and shown in the expandable detail row. Bodies larger than 64 KB are truncated. Default: **off**.

See [Logs](Logs.md) for more on using the request log.

## Health Checks

### Enable Health Checks
When enabled and the proxy is running, Saeng periodically opens a TCP connection to each active mapping's backend to verify it is reachable. A status dot appears next to each domain in the Mappings view. Default: **off**.

### Check Interval
How often health checks run, in seconds. Range: 5–300 seconds. Default: **60 seconds (1 minute)**.

### Check Timeout
How long to wait for a backend to respond before marking it as down. Range: 0.5–30 seconds. Default: **2 seconds**.

## SSL / HTTPS

### Enable HTTPS
When on, Saeng acts as a local HTTPS proxy (MITM): it terminates TLS from the browser and forwards the request to the backend. This allows browsers to access your `.local` domains over `https://`. The browser must trust Saeng's root CA (see below). Default: **on**.

When off, HTTPS CONNECT requests are forwarded as raw TCP tunnels to the backend — no TLS termination, no mock support for HTTPS.

### Trust CA Certificate
Installs Saeng's root CA certificate into the OS trust store so browsers do not show security warnings. Runs `security add-trusted-cert` on macOS or `certutil` via elevated PowerShell on Windows. See [Mac](Mac.md) or [Windows](Windows.md) for details.

### Reveal CA in Finder / Explorer
Opens the folder containing the CA certificate file (`ca.crt`) so you can manually import it (e.g. into Firefox or a Linux system trust store).

### Regenerate CA
Generates a new root CA key and certificate, replacing the existing one. All previously generated per-domain leaf certificates are invalidated. You will need to re-trust the new CA in your OS or browser.

Use this if the CA is compromised or if you want to rotate it.

### Delete CA
Removes the CA key and certificate from disk. The next time a HTTPS connection is proxied, a new CA is generated automatically.

### CA Expiry
Shows the expiry date of the current root CA certificate.
