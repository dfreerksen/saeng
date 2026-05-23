import { execFile } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(execFile);

// VPN tunnel devices — modifying their proxy settings disrupts the VPN connection
const VPN_DEVICE_RE = /^(utun|ppp|ipsec)/i;

// Returns enabled non-VPN network service names on macOS (e.g. ["Wi-Fi", "Ethernet"])
async function getMacNetworkServices() {
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
      if (!device || !VPN_DEVICE_RE.test(device)) {
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
    const services = await getMacNetworkServices();
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
  }
}

async function clearSystemProxy({ onlyIfUrl } = {}) {
  if (process.platform === 'darwin') {
    let services = await getMacNetworkServices();
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
  }
}

export { setSystemProxy, clearSystemProxy };
