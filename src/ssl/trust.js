import { execFile } from 'child_process';
import { promisify } from 'util';
import { t } from '../i18n/i18n.js';

const execAsync = promisify(execFile);

async function untrustCA(certPath) {
  if (process.platform === 'darwin') {
    try {
      await execAsync('/usr/bin/security', ['remove-trusted-cert', certPath]);
      return { success: true };
    } catch {
      return { success: false, message: t('toast.error.untrustCaMac') };
    }
  } else if (process.platform === 'win32') {
    try {
      const script = `Start-Process certutil -ArgumentList '-delstore "ROOT" "${certPath}"' -Verb RunAs -Wait`;
      await execAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
      return { success: true };
    } catch {
      return { success: false, message: t('toast.error.untrustCaWindows') };
    }
  } else if (process.platform === 'linux') {
    return { success: false, message: t('toast.error.untrustCaLinux') };
  }

  return { success: false, message: t('toast.error.untrustCaOther') };
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
      return { success: true, message: t('toast.error.trustCaSuccess') };
    } catch (err) {
      console.error('Failed to trust CA on macOS:', err);
      const msg = err.stderr || err.message || 'Unknown error';
      return { success: false, message: t('toast.error.trustCaMac', { error: msg }) };
    }
  } else if (process.platform === 'win32') {
    try {
      // certutil requires admin — PowerShell elevation prompt appears automatically
      const script = `Start-Process certutil -ArgumentList '-addstore -f "ROOT" "${certPath}"' -Verb RunAs -Wait`;
      await execAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
      return { success: true, message: t('toast.error.trustCaSuccess') };
    } catch (err) {
      console.error('Failed to trust CA on Windows:', err);
      const msg = err.stderr || err.message || 'Unknown error';
      return { success: false, message: t('toast.error.trustCaWindows', { error: msg }) };
    }
  } else if (process.platform === 'linux') {
    // Linux trust management is highly distro-specific and often requires manual steps,
    // so we won't attempt to automate it. Instead, we'll show an informational message.
    return { success: false, message: t('toast.error.untrustCaLinux') };
  }

  return { success: false, message: t('toast.error.trustCaOther') };
}

export { trustCA, untrustCA };
