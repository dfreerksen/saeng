const http = require('http');

class PacServer {
  constructor(port) {
    this.port = port;
    this.mappings = [];
    this.proxyPort = null;
    this.server = null;
  }

  updateMappings(mappings) {
    this.mappings = mappings;
  }

  _generatePAC() {
    const enabledDomains = this.mappings
      .filter((m) => m.enabled)
      .map((m) => m.domain);

    if (enabledDomains.length === 0) {
      return `function FindProxyForURL(url, host) { return "DIRECT"; }`;
    }

    const conditions = enabledDomains
      .map((d) => `host === "${d}"`)
      .join(' ||\n    ');

    return `function FindProxyForURL(url, host) {
  if (
    ${conditions}
  ) {
    return "PROXY 127.0.0.1:${this.proxyPort}; DIRECT";
  }
  return "DIRECT";
}`;
  }

  start(proxyPort) {
    this.proxyPort = proxyPort;

    this.server = http.createServer((req, res) => {
      if (req.url === '/proxy.pac') {
        res.writeHead(200, { 'Content-Type': 'application/x-ns-proxy-autoconfig' });
        res.end(this._generatePAC());
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, '127.0.0.1', () => resolve());
      this.server.on('error', reject);
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = { PacServer };
