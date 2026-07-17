import { execFile } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(execFile);

// VPN tunnel devices (e.g. ExpressVPN's utun interface).
const VPN_DEVICE_RE = /^(utun|ppp|ipsec)/i;

// Returns enabled network service names on macOS (e.g. ["Wi-Fi", "Ethernet"]).
//
// When a VPN is connected its tunnel service (utun/ppp/ipsec) becomes the OS's
// *primary* network service, and macOS resolves proxies against the primary
// service. If we skip that service the PAC is never applied to it, so every
// request resolves DIRECT while the VPN is up — the app appears to stop working
// until the VPN is turned off. Pass { includeVpn: true } to set the PAC on the
// VPN service too. Applying an auto-proxy URL is non-destructive: our PAC only
// returns PROXY for configured domains and DIRECT for everything else, so VPN
// traffic is unaffected. VPN services are only excluded from the blind
// (no-onlyIfUrl) clear, to avoid disabling a proxy the VPN itself manages.
async function getMacNetworkServices({ includeVpn = false } = {}) {
  try {
    const { stdout } = await execAsync('/usr/sbin/networksetup', ['-listnetworkserviceorder']);
    const services = [];
    const lines = stdout.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      const nameMatch = lines[i].match(/^\((\d+)\)\s+(.+)$/); // no leading * = enabled
      if (!nameMatch) continue;
      const name = nameMatch[2].trim();
      const deviceMatch = (lines[i + 1] || '').match(/Device:\s*(\S+)\)/);
      const device = deviceMatch ? deviceMatch[1] : null;
      const isVpn = device && VPN_DEVICE_RE.test(device);
      if (!isVpn || includeVpn) {
        services.push(name);
      }
    }
    return services;
  } catch (err) {
    console.error('Failed to get macOS network services:', err);
    return [];
  }
}

async function getMacAutoproxyUrl(service) {
  try {
    const { stdout } = await execAsync('/usr/sbin/networksetup', ['-getautoproxyurl', service]);
    const match = stdout.match(/^URL:\s*(.+)$/m);
    return match ? match[1].trim() : null;
  } catch (err) {
    console.error(`Failed to get autoproxy URL for service ${service}:`, err);
    return null;
  }
}

async function setSystemProxy(pacUrl) {
  if (process.platform === 'darwin') {
    // Include the VPN service so the PAC applies while a VPN is the primary
    // network service (otherwise mappings stop resolving until the VPN is off).
    const services = await getMacNetworkServices({ includeVpn: true });
    await Promise.allSettled(
      services.flatMap((service) => [
        execAsync('/usr/sbin/networksetup', ['-setautoproxyurl', service, pacUrl]),
        execAsync('/usr/sbin/networksetup', ['-setautoproxystate', service, 'on']),
      ])
    );
  } else if (process.platform === 'win32') {
    const script = [
      `$p = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'`,
      `Set-ItemProperty -Path $p -Name AutoConfigURL -Value '${pacUrl}'`,
      `Set-ItemProperty -Path $p -Name ProxyEnable -Value 0`,
      `$sig = '[DllImport("wininet.dll")] public static extern bool InternetSetOption(IntPtr h, int o, IntPtr b, int l);'`,
      `$t = Add-Type -MemberDefinition $sig -Name WinInet -Namespace Win32 -PassThru`,
      `$t::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0)`,
      `$t::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0)`,
    ].join('; ');

    await execAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  } else if (process.platform === 'linux') {
    await execAsync('gsettings', ['set', 'org.gnome.system.proxy', 'mode', 'auto']);
    await execAsync('gsettings', ['set', 'org.gnome.system.proxy', 'autoconfig-url', pacUrl]);
  }
}

async function clearSystemProxy({ onlyIfUrl } = {}) {
  if (process.platform === 'darwin') {
    // For a targeted clear (onlyIfUrl) include the VPN service too, so we can
    // undo the PAC we set on it — this is safe because we only disable services
    // whose current URL already matches our own PAC. For a blind clear, exclude
    // VPN services to avoid disabling a proxy the VPN itself manages.
    let services = await getMacNetworkServices({ includeVpn: Boolean(onlyIfUrl) });
    if (onlyIfUrl) {
      const urls = await Promise.all(services.map((s) => getMacAutoproxyUrl(s)));
      services = services.filter((_, i) => urls[i] === onlyIfUrl);
    }
    await Promise.allSettled(
      services.map((service) =>
        execAsync('/usr/sbin/networksetup', ['-setautoproxystate', service, 'off'])
      )
    );
  } else if (process.platform === 'win32') {
    if (onlyIfUrl) {
      const readScript = `$p = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'; (Get-ItemProperty -Path $p -Name AutoConfigURL -ErrorAction SilentlyContinue).AutoConfigURL`;
      const { stdout } = await execAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', readScript]);
      if (stdout.trim() !== onlyIfUrl) return;
    }
    const script = [
      `$p = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'`,
      `Remove-ItemProperty -Path $p -Name AutoConfigURL -ErrorAction SilentlyContinue`,
      `$sig = '[DllImport("wininet.dll")] public static extern bool InternetSetOption(IntPtr h, int o, IntPtr b, int l);'`,
      `$t = Add-Type -MemberDefinition $sig -Name WinInet -Namespace Win32 -PassThru`,
      `$t::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0)`,
      `$t::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0)`,
    ].join('; ');

    await execAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  } else if (process.platform === 'linux') {
    if (onlyIfUrl) {
      const { stdout } = await execAsync('gsettings', ['get', 'org.gnome.system.proxy', 'autoconfig-url']);
      // gsettings returns string values wrapped in single quotes
      const current = stdout.trim().replace(/^'|'$/g, '');
      if (current !== onlyIfUrl) return;
    }
    await execAsync('gsettings', ['set', 'org.gnome.system.proxy', 'mode', 'none']);
  }
}

export { setSystemProxy, clearSystemProxy };
