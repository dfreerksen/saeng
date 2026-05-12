import { execFile } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(execFile);

async function untrustCA(certPath) {
  if (process.platform === 'darwin') {
    try {
      await execAsync('/usr/bin/security', ['remove-trusted-cert', certPath]);
    } catch {
      console.error('Failed to untrust CA on macOS. This is not an error');
    }
  }
  // Windows trust removal not yet supported
}

async function trustCA(certPath) {
  if (process.platform === 'darwin') {
    try {
      // Targets the per-user trust settings domain (no -d, no -k).
      // Running as the current user avoids the "no user interaction possible"
      // error that occurs when security tries to authorize inside an elevated
      // osascript shell. User-level trust is sufficient for local development
      // and is respected by Safari, Chrome, and the macOS Security framework.
      await execAsync('/usr/bin/security', [
        'add-trusted-cert',
        '-r', 'trustRoot',
        certPath,
      ]);
      return { success: true, message: 'CA certificate trusted successfully.' };
    } catch (err) {
      console.error('Failed to trust CA on macOS:', err);
      const msg = err.stderr || err.message || 'Unknown error';
      return { success: false, message: `Failed to trust CA: ${msg}` };
    }
  } else if (process.platform === 'win32') {
    try {
      // certutil requires admin — PowerShell elevation prompt appears automatically
      const script = `Start-Process certutil -ArgumentList '-addstore -f "ROOT" "${certPath}"' -Verb RunAs -Wait`;
      await execAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
      return { success: true, message: 'CA certificate trusted successfully.' };
    } catch (err) {
      console.error('Failed to trust CA on Windows:', err);
      const msg = err.stderr || err.message || 'Unknown error';
      return { success: false, message: `Failed to trust CA: ${msg}` };
    }
  }

  return { success: false, message: 'Unsupported platform.' };
}

export { trustCA, untrustCA };
