import { ipcMain, shell } from 'electron';
import { trustCA, untrustCA } from '../ssl/trust.js';

// Registers the `ssl:*` IPC handlers for CA cert management.
export function registerSslIpc({ getCertManager }) {
  ipcMain.handle('ssl:get-ca-expiry', async () => {
    const certManager = getCertManager();
    // Wait for the startup pre-warm (or create the CA now if it's missing),
    // so the renderer's initial query doesn't race CA generation.
    await certManager.ensureCA();
    return certManager.getCAExpiry();
  });

  ipcMain.handle('ssl:regenerate-ca', () => getCertManager().regenerateCA());

  ipcMain.handle('ssl:delete-ca', async () => {
    const certManager = getCertManager();
    const untrustResult = await untrustCA(certManager.getCAPath());
    certManager.deleteCA();
    return { success: true, warning: untrustResult?.success === false ? untrustResult.message : null };
  });

  ipcMain.handle('ssl:get-ca-path', () => getCertManager().getCAPath());

  ipcMain.handle('ssl:reveal-ca', () => shell.showItemInFolder(getCertManager().getCAPath()));

  ipcMain.handle('ssl:trust-ca', () => trustCA(getCertManager().getCAPath()));
}
