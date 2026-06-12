import { HttpProxy } from './httpProxy.js';
import { PacServer } from './pacServer.js';
import { CertManager } from './certManager.js';
import { RequestLog } from './requestLog.js';
import { HealthChecker } from './healthChecker.js';
import { setSystemProxy, clearSystemProxy } from '../systemProxy.js';

const PAC_PORT = 8181;

class ProxyManager {
  constructor(store) {
    this.store = store;
    this.httpProxy = null;
    this.pacServer = null;
    const settings = store.getSettings();
    this.requestLog = new RequestLog(settings.logMaxEntries, settings.loggingEnabled, settings.logHeadersEnabled, settings.logBodyEnabled);
    this.healthChecker = new HealthChecker(settings.healthCheckIntervalMs, settings.healthCheckTimeoutMs, settings.healthCheckEnabled);
    this.healthChecker.setProxyRunning(false);
    this.running = false;
    this.startedAt = null;
  }

  isRunning() {
    return this.running;
  }

  getStatus() {
    return {
      running: this.running,
      uptime: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
    };
  }

  async start(mappings, settings) {
    if (this.running) return;

    const certDir = this.store.getCertDir();
    const certManager = CertManager.getInstance(certDir);

    this.httpProxy = new HttpProxy(certManager, this.requestLog);
    this.pacServer = new PacServer(PAC_PORT);

    this.pacServer.updateMappings(mappings);

    const proxyPort = await this.httpProxy.start(mappings, settings);
    this.httpProxy.updateMocks(this.store.getMocks());

    await this.pacServer.start(proxyPort);

    await setSystemProxy(`http://127.0.0.1:${PAC_PORT}/proxy.pac`);

    this.running = true;
    this.startedAt = Date.now();
    this.healthChecker.updateMappings(mappings);
    this.healthChecker.setProxyRunning(true);
  }

  async stop() {
    if (!this.running) return;

    await clearSystemProxy();

    if (this.httpProxy) {
      await this.httpProxy.stop();
      this.httpProxy = null;
    }

    if (this.pacServer) {
      await this.pacServer.stop();
      this.pacServer = null;
    }

    this.running = false;
    this.startedAt = null;
    this.healthChecker.setProxyRunning(false);
  }

  updateMappings(mappings) {
    this.healthChecker.updateMappings(mappings);
    if (!this.running) return;
    this.httpProxy?.updateMappings(mappings);
    this.pacServer?.updateMappings(mappings);
  }

  updateMocks(mocks) {
    if (!this.running) return;
    this.httpProxy?.updateMocks(mocks);
  }
}

export { ProxyManager };
