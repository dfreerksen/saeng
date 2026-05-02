const { HttpProxy } = require('./httpProxy');
const { PacServer } = require('./pacServer');
const { CertManager } = require('./certManager');
const { setSystemProxy, clearSystemProxy } = require('../systemProxy');

const PAC_PORT = 8181;

class ProxyManager {
  constructor(store) {
    this.store = store;
    this.httpProxy = null;
    this.pacServer = null;
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

    this.httpProxy = new HttpProxy(certManager);
    this.pacServer = new PacServer(PAC_PORT);

    this.pacServer.updateMappings(mappings);

    const proxyPort = await this.httpProxy.start(mappings, settings);

    await this.pacServer.start(proxyPort);

    await setSystemProxy(`http://127.0.0.1:${PAC_PORT}/proxy.pac`);

    this.running = true;
    this.startedAt = Date.now();
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
  }

  updateMappings(mappings) {
    if (!this.running) return;
    this.httpProxy?.updateMappings(mappings);
    this.pacServer?.updateMappings(mappings);
  }
}

module.exports = { ProxyManager };
