# Windows

## Installation

1. Download the latest `.exe` installer from the [releases page](https://github.com/dfreerksen/saeng/releases).
2. Run the installer and follow the prompts.
3. Launch Saeng from the Start menu or the desktop shortcut.

Windows SmartScreen may show a warning on first run. Click **More info → Run anyway** to proceed.

## How it works

Saeng configures the Windows system proxy to point to a local PAC (Proxy Auto-Config) file by writing to the registry via PowerShell. When you navigate to a `.local` (or similar) domain, Windows routes the request through Saeng's proxy, which forwards it to the backend port you configured. No `/etc/hosts` editing or elevated port binding required.

The registry key written is `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings`. Saeng clears this on exit.

## Trusting the CA Certificate (HTTPS)

To proxy HTTPS traffic, Saeng acts as a local SSL man-in-the-middle. Your browser needs to trust Saeng's root CA certificate so it does not show security warnings.

1. Open **Settings** in Saeng.
2. Under **SSL / HTTPS**, click **Trust CA Certificate**.
3. An elevated PowerShell window will open and run `certutil` to install the cert into the Windows certificate store. Accept the UAC prompt if asked.

This only needs to be done once. If you ever regenerate the CA, trust it again using the same steps.

> **Note:** Some browsers (Firefox) maintain their own certificate store and may require manual import even after the system-level trust step. In Firefox, go to **Settings → Privacy & Security → Certificates → View Certificates → Authorities → Import**, then select the CA file from **Settings → SSL / HTTPS → Reveal CA in Explorer**.

## Getting Started

1. Launch Saeng and click **Start Proxy**.
2. Go to **Mappings** and click **Add Mapping**.
3. Enter a domain (e.g. `myapp.local`) and the local port your app is running on (e.g. `3000`).
4. Save — the domain is now live in your browser.

See [Mappings](Mappings.md) for a full explanation of mapping options.

## Tray and Taskbar Icon

By default Saeng appears in both the system tray and the taskbar. You can change this in **Settings → Icon Mode**:

- **Both** — tray and taskbar (default)
- **Tray only** — taskbar icon hidden; closing the window keeps the app running in the background
- **Dock/taskbar only** — no tray icon; closing the window quits the app

## Troubleshooting

**Proxy not working**
Ensure no other application (e.g. a VPN client) has overridden the system proxy. Open **Internet Options → Connections → LAN Settings** and confirm the automatic configuration script is set to Saeng's PAC URL (`http://127.0.0.1:8181/proxy.pac`).

**Elevated PowerShell prompt appears unexpectedly**
This is expected when clicking **Trust CA Certificate**. Saeng needs admin rights to install the certificate into the system store.

**Certificate warnings in browser**
Trust the CA certificate (see above). If you regenerated the CA in Settings, you must trust it again.
