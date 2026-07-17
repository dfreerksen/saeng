import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// execAsyncMock is declared via vi.hoisted() so it exists before vi.mock() is
// hoisted and executed, allowing the child_process mock factory to reference it.
const execAsyncMock = vi.hoisted(() => vi.fn().mockResolvedValue({ stdout: '', stderr: '' }));

// Replace child_process.execFile with a vi.fn() that exposes our controlled
// async mock via [util.promisify.custom]. systemProxy.js calls
// `promisify(execFile)` at load time; promisify sees the custom symbol and
// returns execAsyncMock directly, so every execAsync() call goes to it.
vi.mock('child_process', async () => {
  const { promisify } = await import('util');
  const execFile = vi.fn();
  execFile[promisify.custom] = execAsyncMock;
  return { execFile };
});

import { setSystemProxy, clearSystemProxy } from '../src/systemProxy.js';

// Builds a realistic `networksetup -listnetworkserviceorder` stdout.
// services: Array<{ index, name, device, disabled? }>
// Disabled entries are prefixed with '*' and are skipped by getMacNetworkServices().
function makeServiceOrderOutput(services) {
  const lines = [];
  for (const { index, name, device, disabled = false } of services) {
    lines.push(`${disabled ? '*' : ''}(${index}) ${name}`);
    lines.push(`(Hardware Port: Ethernet, Device: ${device})`);
    lines.push('');
  }
  return lines.join('\n');
}

const ORIGINAL_PLATFORM = process.platform;

function setPlatform(value) {
  Object.defineProperty(process, 'platform', { value, configurable: true, writable: true });
}

beforeEach(() => {
  execAsyncMock.mockReset();
  execAsyncMock.mockResolvedValue({ stdout: '', stderr: '' });
});

afterEach(() => {
  setPlatform(ORIGINAL_PLATFORM);
});

// ---------------------------------------------------------------------------
// macOS — setSystemProxy
// ---------------------------------------------------------------------------

describe('setSystemProxy() on macOS', () => {
  beforeEach(() => setPlatform('darwin'));

  it('calls -setautoproxyurl and -setautoproxystate on for each non-VPN service', async () => {
    const output = makeServiceOrderOutput([
      { index: 1, name: 'Wi-Fi', device: 'en0' },
      { index: 2, name: 'Ethernet', device: 'en1' },
    ]);
    execAsyncMock.mockImplementation(async (cmd, args) => {
      if (args[0] === '-listnetworkserviceorder') return { stdout: output, stderr: '' };
      return { stdout: '', stderr: '' };
    });

    await setSystemProxy('http://127.0.0.1:8181/proxy.pac');

    const urlCalls = execAsyncMock.mock.calls.filter(([, a]) => a[0] === '-setautoproxyurl');
    const stateCalls = execAsyncMock.mock.calls.filter(([, a]) => a[0] === '-setautoproxystate');

    expect(urlCalls).toHaveLength(2);
    expect(urlCalls[0][1]).toEqual(['-setautoproxyurl', 'Wi-Fi', 'http://127.0.0.1:8181/proxy.pac']);
    expect(urlCalls[1][1]).toEqual(['-setautoproxyurl', 'Ethernet', 'http://127.0.0.1:8181/proxy.pac']);
    expect(stateCalls[0][1]).toEqual(['-setautoproxystate', 'Wi-Fi', 'on']);
    expect(stateCalls[1][1]).toEqual(['-setautoproxystate', 'Ethernet', 'on']);
  });

  it('includes VPN tunnel devices (utun, ppp, ipsec) so the PAC applies while a VPN is primary', async () => {
    const output = makeServiceOrderOutput([
      { index: 1, name: 'VPN ExpressVPN', device: 'utun0' },
      { index: 2, name: 'Wi-Fi', device: 'en0' },
      { index: 3, name: 'PPP Link', device: 'ppp0' },
      { index: 4, name: 'IPSec Tunnel', device: 'ipsec0' },
    ]);
    execAsyncMock.mockImplementation(async (cmd, args) => {
      if (args[0] === '-listnetworkserviceorder') return { stdout: output, stderr: '' };
      return { stdout: '', stderr: '' };
    });

    await setSystemProxy('http://127.0.0.1:8181/proxy.pac');

    const urlCalls = execAsyncMock.mock.calls.filter(([, a]) => a[0] === '-setautoproxyurl');
    const names = urlCalls.map(([, a]) => a[1]);
    expect(names).toEqual(['VPN ExpressVPN', 'Wi-Fi', 'PPP Link', 'IPSec Tunnel']);
  });

  it('skips disabled network services (prefixed with * in networksetup output)', async () => {
    const output = makeServiceOrderOutput([
      { index: 1, name: 'Wi-Fi', device: 'en0' },
      { index: 2, name: 'Disabled Adapter', device: 'en2', disabled: true },
    ]);
    execAsyncMock.mockImplementation(async (cmd, args) => {
      if (args[0] === '-listnetworkserviceorder') return { stdout: output, stderr: '' };
      return { stdout: '', stderr: '' };
    });

    await setSystemProxy('http://127.0.0.1:8181/proxy.pac');

    const urlCalls = execAsyncMock.mock.calls.filter(([, a]) => a[0] === '-setautoproxyurl');
    expect(urlCalls).toHaveLength(1);
    expect(urlCalls[0][1][1]).toBe('Wi-Fi');
  });

  it('resolves cleanly and makes no proxy calls when networksetup fails', async () => {
    execAsyncMock.mockRejectedValueOnce(new Error('command not found'));

    await expect(setSystemProxy('http://127.0.0.1:8181/proxy.pac')).resolves.toBeUndefined();

    const urlCalls = execAsyncMock.mock.calls.filter(([, a]) => a[0] === '-setautoproxyurl');
    expect(urlCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// macOS — clearSystemProxy
// ---------------------------------------------------------------------------

describe('clearSystemProxy() on macOS', () => {
  beforeEach(() => setPlatform('darwin'));

  it('disables the auto-proxy state for every service when no onlyIfUrl is given', async () => {
    const output = makeServiceOrderOutput([
      { index: 1, name: 'Wi-Fi', device: 'en0' },
      { index: 2, name: 'Ethernet', device: 'en1' },
    ]);
    execAsyncMock.mockImplementation(async (cmd, args) => {
      if (args[0] === '-listnetworkserviceorder') return { stdout: output, stderr: '' };
      return { stdout: '', stderr: '' };
    });

    await clearSystemProxy();

    const stateCalls = execAsyncMock.mock.calls.filter(([, a]) => a[0] === '-setautoproxystate');
    expect(stateCalls).toHaveLength(2);
    expect(stateCalls[0][1]).toEqual(['-setautoproxystate', 'Wi-Fi', 'off']);
    expect(stateCalls[1][1]).toEqual(['-setautoproxystate', 'Ethernet', 'off']);
  });

  it('only clears services whose current URL matches onlyIfUrl', async () => {
    const PAC_URL = 'http://127.0.0.1:8181/proxy.pac';
    const output = makeServiceOrderOutput([
      { index: 1, name: 'Wi-Fi', device: 'en0' },
      { index: 2, name: 'Ethernet', device: 'en1' },
    ]);
    execAsyncMock.mockImplementation(async (cmd, args) => {
      if (args[0] === '-listnetworkserviceorder') return { stdout: output, stderr: '' };
      if (args[0] === '-getautoproxyurl') {
        // Wi-Fi has our PAC URL; Ethernet returns empty stdout → null URL
        if (args[1] === 'Wi-Fi') return { stdout: `URL: ${PAC_URL}\nEnabled: Yes\n`, stderr: '' };
        return { stdout: '', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    });

    await clearSystemProxy({ onlyIfUrl: PAC_URL });

    const stateCalls = execAsyncMock.mock.calls.filter(([, a]) => a[0] === '-setautoproxystate');
    expect(stateCalls).toHaveLength(1);
    expect(stateCalls[0][1]).toEqual(['-setautoproxystate', 'Wi-Fi', 'off']);
  });

  it('does not call -setautoproxystate when no service URL matches onlyIfUrl', async () => {
    const output = makeServiceOrderOutput([{ index: 1, name: 'Wi-Fi', device: 'en0' }]);
    execAsyncMock.mockImplementation(async (cmd, args) => {
      if (args[0] === '-listnetworkserviceorder') return { stdout: output, stderr: '' };
      if (args[0] === '-getautoproxyurl')
        return { stdout: 'URL: http://127.0.0.1:8181/proxy.pac\nEnabled: Yes\n', stderr: '' };
      return { stdout: '', stderr: '' };
    });

    await clearSystemProxy({ onlyIfUrl: 'http://different.proxy:9090/pac' });

    const stateCalls = execAsyncMock.mock.calls.filter(([, a]) => a[0] === '-setautoproxystate');
    expect(stateCalls).toHaveLength(0);
  });

  it('clears the VPN service on a targeted clear when its URL matches our PAC', async () => {
    const PAC_URL = 'http://127.0.0.1:8181/proxy.pac';
    const output = makeServiceOrderOutput([
      { index: 1, name: 'VPN ExpressVPN', device: 'utun0' },
      { index: 2, name: 'Wi-Fi', device: 'en0' },
    ]);
    execAsyncMock.mockImplementation(async (cmd, args) => {
      if (args[0] === '-listnetworkserviceorder') return { stdout: output, stderr: '' };
      if (args[0] === '-getautoproxyurl') return { stdout: `URL: ${PAC_URL}\nEnabled: Yes\n`, stderr: '' };
      return { stdout: '', stderr: '' };
    });

    await clearSystemProxy({ onlyIfUrl: PAC_URL });

    const stateCalls = execAsyncMock.mock.calls.filter(([, a]) => a[0] === '-setautoproxystate');
    const names = stateCalls.map(([, a]) => a[1]);
    expect(names).toEqual(expect.arrayContaining(['VPN ExpressVPN', 'Wi-Fi']));
  });

  it('excludes VPN services from a blind clear (no onlyIfUrl) to avoid disabling a VPN-managed proxy', async () => {
    const output = makeServiceOrderOutput([
      { index: 1, name: 'VPN ExpressVPN', device: 'utun0' },
      { index: 2, name: 'Wi-Fi', device: 'en0' },
    ]);
    execAsyncMock.mockImplementation(async (cmd, args) => {
      if (args[0] === '-listnetworkserviceorder') return { stdout: output, stderr: '' };
      return { stdout: '', stderr: '' };
    });

    await clearSystemProxy();

    const stateCalls = execAsyncMock.mock.calls.filter(([, a]) => a[0] === '-setautoproxystate');
    const names = stateCalls.map(([, a]) => a[1]);
    expect(names).toEqual(['Wi-Fi']);
  });
});

// ---------------------------------------------------------------------------
// Windows — setSystemProxy
// ---------------------------------------------------------------------------

describe('setSystemProxy() on Windows', () => {
  beforeEach(() => setPlatform('win32'));

  it('runs a PowerShell command that sets AutoConfigURL to the PAC URL', async () => {
    await setSystemProxy('http://127.0.0.1:8181/proxy.pac');

    expect(execAsyncMock).toHaveBeenCalledTimes(1);
    const [cmd, args] = execAsyncMock.mock.calls[0];
    expect(cmd).toBe('powershell.exe');
    const script = args[args.length - 1];
    expect(script).toContain('AutoConfigURL');
    expect(script).toContain('http://127.0.0.1:8181/proxy.pac');
  });
});

// ---------------------------------------------------------------------------
// Windows — clearSystemProxy
// ---------------------------------------------------------------------------

describe('clearSystemProxy() on Windows', () => {
  beforeEach(() => setPlatform('win32'));

  it('runs a PowerShell command that removes AutoConfigURL when no onlyIfUrl is given', async () => {
    await clearSystemProxy();

    expect(execAsyncMock).toHaveBeenCalledTimes(1);
    const [cmd, args] = execAsyncMock.mock.calls[0];
    expect(cmd).toBe('powershell.exe');
    expect(args[args.length - 1]).toContain('Remove-ItemProperty');
  });

  it('reads the current URL and skips clearing when it does not match onlyIfUrl', async () => {
    execAsyncMock.mockResolvedValueOnce({ stdout: 'http://different.proxy/pac', stderr: '' });

    await clearSystemProxy({ onlyIfUrl: 'http://127.0.0.1:8181/proxy.pac' });

    // Only the read call; the clear script should not run
    expect(execAsyncMock).toHaveBeenCalledTimes(1);
    const [, args] = execAsyncMock.mock.calls[0];
    expect(args[args.length - 1]).not.toContain('Remove-ItemProperty');
  });

  it('reads the current URL and clears when it matches onlyIfUrl', async () => {
    const PAC_URL = 'http://127.0.0.1:8181/proxy.pac';
    // First call: read current registry value (powershell returns a bare string)
    execAsyncMock.mockResolvedValueOnce({ stdout: PAC_URL + '\n', stderr: '' });

    await clearSystemProxy({ onlyIfUrl: PAC_URL });

    expect(execAsyncMock).toHaveBeenCalledTimes(2);
    const [, clearArgs] = execAsyncMock.mock.calls[1];
    expect(clearArgs[clearArgs.length - 1]).toContain('Remove-ItemProperty');
  });
});

// ---------------------------------------------------------------------------
// Linux — setSystemProxy
// ---------------------------------------------------------------------------

describe('setSystemProxy() on Linux', () => {
  beforeEach(() => setPlatform('linux'));

  it('sets gsettings proxy mode to auto and writes the autoconfig URL', async () => {
    await setSystemProxy('http://127.0.0.1:8181/proxy.pac');

    expect(execAsyncMock).toHaveBeenCalledTimes(2);
    const [cmd1, args1] = execAsyncMock.mock.calls[0];
    const [cmd2, args2] = execAsyncMock.mock.calls[1];
    expect(cmd1).toBe('gsettings');
    expect(args1).toContain('auto');
    expect(cmd2).toBe('gsettings');
    expect(args2).toContain('http://127.0.0.1:8181/proxy.pac');
  });
});

// ---------------------------------------------------------------------------
// Linux — clearSystemProxy
// ---------------------------------------------------------------------------

describe('clearSystemProxy() on Linux', () => {
  beforeEach(() => setPlatform('linux'));

  it('sets gsettings proxy mode to none when no onlyIfUrl is given', async () => {
    await clearSystemProxy();

    expect(execAsyncMock).toHaveBeenCalledTimes(1);
    const [cmd, args] = execAsyncMock.mock.calls[0];
    expect(cmd).toBe('gsettings');
    expect(args).toContain('none');
  });

  it('reads the current URL and skips clearing when it does not match onlyIfUrl', async () => {
    // gsettings wraps string values in single quotes
    execAsyncMock.mockResolvedValueOnce({ stdout: "'http://different.proxy/pac'\n", stderr: '' });

    await clearSystemProxy({ onlyIfUrl: 'http://127.0.0.1:8181/proxy.pac' });

    // Only the read call; 'none' should not be set
    expect(execAsyncMock).toHaveBeenCalledTimes(1);
    const [, args] = execAsyncMock.mock.calls[0];
    expect(args).not.toContain('none');
  });

  it('reads the current URL and clears when it matches onlyIfUrl', async () => {
    const PAC_URL = 'http://127.0.0.1:8181/proxy.pac';
    execAsyncMock.mockResolvedValueOnce({ stdout: `'${PAC_URL}'\n`, stderr: '' });

    await clearSystemProxy({ onlyIfUrl: PAC_URL });

    expect(execAsyncMock).toHaveBeenCalledTimes(2);
    const [, clearArgs] = execAsyncMock.mock.calls[1];
    expect(clearArgs).toContain('none');
  });
});
