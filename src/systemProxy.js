const { execFile } = require('child_process');
const util = require('util');

const execAsync = util.promisify(execFile);

// Returns a list of network service names on macOS (e.g. ["Wi-Fi", "Ethernet"])
async function getMacNetworkServices() {
  try {
    const { stdout } = await execAsync('/usr/sbin/networksetup', ['-listallnetworkservices']);
    return stdout
      .split('\n')
      .slice(1) // skip the header line
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('*'));
  } catch (_) {
    return [];
  }
}

async function getMacAutoproxyUrl(service) {
  try {
    const { stdout } = await execAsync('/usr/sbin/networksetup', ['-getautoproxyurl', service]);
    const match = stdout.match(/^URL:\s*(.+)$/m);
    return match ? match[1].trim() : null;
  } catch (_) {
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

module.exports = { setSystemProxy, clearSystemProxy };
