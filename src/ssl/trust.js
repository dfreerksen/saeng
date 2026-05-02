const { execFile } = require('child_process');
const util = require('util');

const execAsync = util.promisify(execFile);

async function trustCA(certPath) {
  if (process.platform === 'darwin') {
    try {
      // Uses macOS's native auth dialog to request password
      await execAsync('/usr/bin/security', [
        'add-trusted-cert',
        '-d',
        '-r', 'trustRoot',
        '-k', '/Library/Keychains/System.keychain',
        certPath,
      ]);
      return { success: true, message: 'CA certificate trusted successfully.' };
    } catch (err) {
      // User may have cancelled the auth dialog
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
      const msg = err.stderr || err.message || 'Unknown error';
      return { success: false, message: `Failed to trust CA: ${msg}` };
    }
  }

  return { success: false, message: 'Unsupported platform.' };
}

module.exports = { trustCA };
