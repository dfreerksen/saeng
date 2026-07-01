# Linux

## Installation

1. Download the latest `.AppImage` from the [releases page](https://github.com/dfreerksen/saeng/releases).
2. Make it executable: `chmod +x Saeng-*.AppImage`
3. Run it: `./Saeng-*.AppImage`

Some distributions require `libfuse2` for AppImage support. Install it with your package manager if the AppImage fails to launch (e.g. `sudo apt install libfuse2` on Ubuntu/Debian).

## How it works

Saeng configures your system proxy to point to a local PAC (Proxy Auto-Config) file. When you navigate to a `.local` (or similar) domain, the proxy routes the request to the backend port you configured. No `/etc/hosts` editing or elevated port binding required.

> **Note:** Linux does not have a single unified system proxy API. Saeng writes proxy settings where it can, but individual browsers may need to be configured manually to use the PAC URL (`http://127.0.0.1:8181/proxy.pac`).

### Configuring browsers manually

**Chrome / Chromium:**
Launch with `--proxy-pac-url=http://127.0.0.1:8181/proxy.pac` or set the proxy in your desktop environment's network settings.

**Firefox:**
Go to **Settings → Network Settings → Settings** and choose **Automatic proxy configuration URL**, then enter `http://127.0.0.1:8181/proxy.pac`.

## Trusting the CA Certificate (HTTPS)

To proxy HTTPS traffic without browser warnings, install Saeng's root CA certificate.

1. Open **Settings** in Saeng, then under **SSL / HTTPS** click **Reveal CA in File Manager** (or note the path shown).
2. Import the CA into your system trust store or browser:

**System-wide (Debian/Ubuntu):**
```bash
sudo cp /path/to/ca.crt /usr/local/share/ca-certificates/saeng.crt
sudo update-ca-certificates
```

**System-wide (Fedora/RHEL):**
```bash
sudo cp /path/to/ca.crt /etc/pki/ca-trust/source/anchors/saeng.crt
sudo update-ca-trust
```

**Firefox:** Go to **Settings → Privacy & Security → Certificates → View Certificates → Authorities → Import** and select the CA file.

**Chrome/Chromium:** Uses the system trust store on Linux once updated above.

## Getting Started

1. Launch Saeng and click **Start Proxy**.
2. Go to **Mappings** and click **Add Mapping**.
3. Enter a domain (e.g. `myapp.local`) and the local port your app is running on (e.g. `3000`).
4. Configure your browser to use the PAC URL (see above).
5. Navigate to your domain — Saeng will route the request to your backend.

See [Mappings](Mappings.md) for a full explanation of mapping options.

## Window Behavior

On Linux, closing the main window always quits the app — there is no tray icon to keep Saeng running in the background. The **Settings → Icon Mode** option has no effect on Linux.

## Troubleshooting

**AppImage won't launch**
Install `libfuse2` (see Installation above) or extract and run the AppImage directly: `./Saeng-*.AppImage --appimage-extract && ./squashfs-root/Saeng`.

**Domains not resolving**
Confirm your browser is using the PAC URL. Some browsers ignore system proxy settings and require manual configuration (see above).

**Certificate warnings in browser**
Trust the CA certificate using the steps above. If you regenerated the CA in Settings, install it again.
