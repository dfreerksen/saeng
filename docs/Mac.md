# Mac (macOS)

## Installation

1. Download the latest `.dmg` from the [releases page](https://github.com/dfreerksen/saeng/releases).
2. Open the `.dmg`, drag **Saeng** into your Applications folder.
3. Launch Saeng from Applications or Spotlight.

On the first launch macOS may show a security warning ("unidentified developer"). You can either open **System Settings → Privacy & Security**, scroll to the bottom, and click **Open Anyway** — or run this in Terminal to clear the quarantine flag:

```sh
xattr -cr /Applications/Saeng.app
```

## How it works

Saeng configures your Mac's system proxy to point to a local PAC (Proxy Auto-Config) file. When you navigate to a `.local` (or similar) domain, macOS routes the request through Saeng's proxy, which forwards it to the backend port you configured. No `/etc/hosts` editing or elevated port binding required.

Saeng uses the `networksetup` command-line tool (built into macOS) to set and clear the auto-proxy URL. It writes to all active network services automatically.

## Trusting the CA Certificate (HTTPS)

To proxy HTTPS traffic, Saeng acts as a local SSL man-in-the-middle. Your browser needs to trust Saeng's root CA certificate so it does not show security warnings.

1. Open **Settings** in Saeng.
2. Under **SSL / HTTPS**, click **Trust CA Certificate**.
3. macOS will prompt for your password to add the cert to the System keychain as trusted.

This only needs to be done once. If you ever regenerate the CA, trust it again using the same steps.

## Getting Started

1. Launch Saeng and click **Start Proxy**.
2. Go to **Mappings** and click **Add Mapping**.
3. Enter a domain (e.g. `myapp.local`) and the local port your app is running on (e.g. `3000`).
4. Save — the domain is now live in your browser.

See [Mappings](Mappings.md) for a full explanation of mapping options.

## Tray and Dock Icon

By default Saeng appears in both the menu bar (tray) and the Dock. You can change this in **Settings → Icon Mode**:

- **Both** — tray and Dock (default)
- **Tray only** — Dock icon hidden; closing the window keeps the app running in the background
- **Dock only** — no tray icon; closing the window quits the app

## Troubleshooting

**Proxy not working after sleep/wake**
Open Saeng and click **Stop Proxy**, then **Start Proxy** to re-apply the system proxy settings.

**Browser still using old proxy after quitting Saeng**
Saeng clears the system proxy on quit. If it crashed, open **System Settings → Network → Proxies** and clear the auto-proxy URL manually.

**Certificate warnings in browser**
Trust the CA certificate (see above). If you regenerated the CA in Settings, you must trust it again.
