import http from 'http';
import https from 'https';
import net from 'net';
import tls from 'tls';

class HttpProxy {
  constructor(certManager) {
    this.certManager = certManager;
    this.mappings = new Map();
    this.httpServer = null;
    this.internalHttpsServer = null;
    this.internalHttpsPort = null;
    this.httpsEnabled = false;
  }

  updateMappings(mappings) {
    this.mappings = new Map(
      mappings.filter((m) => m.enabled).map((m) => [m.domain, m])
    );
  }

  findMapping(hostname) {
    return this.mappings.get(hostname.toLowerCase());
  }

  async start(mappings, settings) {
    this.updateMappings(mappings);
    this.httpsEnabled = settings.httpsEnabled;

    if (this.httpsEnabled) {
      await this._startInternalHttpsServer();
    }

    await this._startHttpServer();
    return this.httpServer.address().port;
  }

  async _startInternalHttpsServer() {
    // Generate a placeholder cert so https.createServer can start;
    // SNICallback overrides the cert for each actual connection.
    const defaultCert = this.certManager.getCert('saeng.internal');

    this.internalHttpsServer = https.createServer(
      {
        cert: defaultCert.cert,
        key: defaultCert.key,
        SNICallback: (hostname, cb) => {
          try {
            const certData = this.certManager.getCert(hostname);
            cb(null, tls.createSecureContext({ cert: certData.cert, key: certData.key }));
          } catch (err) {
            console.error(`Failed to get cert for ${hostname}:`, err);
            cb(err);
          }
        },
      },
      (req, res) => this._handleDecryptedRequest(req, res)
    );

    this.internalHttpsServer.on('upgrade', (req, socket, head) =>
      this._handleWebSocketUpgrade(req, socket, head)
    );

    return new Promise((resolve, reject) => {
      this.internalHttpsServer.listen(0, '127.0.0.1', () => {
        this.internalHttpsPort = this.internalHttpsServer.address().port;
        resolve();
      });
      this.internalHttpsServer.on('error', reject);
    });
  }

  async _startHttpServer() {
    this.httpServer = http.createServer((req, res) =>
      this._handleRequest(req, res)
    );

    this.httpServer.on('connect', (req, socket, head) =>
      this._handleConnect(req, socket, head)
    );

    this.httpServer.on('upgrade', (req, socket, head) =>
      this._handleWebSocketUpgrade(req, socket, head)
    );

    return new Promise((resolve, reject) => {
      this.httpServer.listen(0, '127.0.0.1', () => resolve());
      this.httpServer.on('error', reject);
    });
  }

  getPort() {
    return this.httpServer ? this.httpServer.address().port : null;
  }

  _handleRequest(req, res) {
    const rawHost = req.headers.host || '';
    const hostname = rawHost.split(':')[0].toLowerCase();
    const mapping = this.findMapping(hostname);

    if (!mapping) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`Saeng: no mapping for ${hostname}`);
      return;
    }

    // For HTTP proxy requests the URL is absolute; extract just the path+query
    let reqPath = req.url;
    if (reqPath.startsWith('http://') || reqPath.startsWith('https://')) {
      try {
        const parsed = new URL(reqPath);
        reqPath = parsed.pathname + parsed.search;
      } catch (err) {
        console.error(`Failed to parse URL ${reqPath}:`, err);
        // fall through with original
      }
    }

    const backendProto = mapping.https ? https : http;
    const options = {
      hostname: '127.0.0.1',
      port: mapping.port,
      method: req.method,
      path: reqPath || '/',
      headers: { ...req.headers },
    };
    delete options.headers['proxy-connection'];

    const proxyReq = backendProto.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Saeng: backend error — ${err.message}`);
      }
    });

    req.pipe(proxyReq);
  }

  // Handles decrypted HTTPS requests forwarded from the internal TLS server
  _handleDecryptedRequest(req, res) {
    const rawHost = req.headers.host || '';
    const hostname = rawHost.split(':')[0].toLowerCase();
    const mapping = this.findMapping(hostname);

    if (!mapping) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`Saeng: no mapping for ${hostname}`);
      return;
    }

    const backendProto = mapping.https ? https : http;
    const options = {
      hostname: '127.0.0.1',
      port: mapping.port,
      method: req.method,
      path: req.url || '/',
      headers: { ...req.headers },
    };

    const proxyReq = backendProto.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Saeng: backend error — ${err.message}`);
      }
    });

    req.pipe(proxyReq);
  }

  _handleConnect(req, clientSocket, head) {
    const hostname = req.url.split(':')[0].toLowerCase();
    const mapping = this.findMapping(hostname);

    if (!mapping) {
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      clientSocket.end();
      return;
    }

    if (!this.httpsEnabled || !this.internalHttpsPort) {
      // HTTPS not enabled — tunnel raw TCP to the backend (no SSL termination)
      this._tunnelRaw(clientSocket, head, mapping.port);
      return;
    }

    // HTTPS MITM: pipe the client socket through our internal TLS server
    clientSocket.write('HTTP/1.1 200 Connection Established\r\nProxy-agent: Saeng\r\n\r\n');

    const tunnelSocket = net.connect(this.internalHttpsPort, '127.0.0.1', () => {
      if (head && head.length > 0) tunnelSocket.write(head);
      tunnelSocket.pipe(clientSocket);
      clientSocket.pipe(tunnelSocket);
    });

    tunnelSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => tunnelSocket.destroy());
  }

  _tunnelRaw(clientSocket, head, targetPort) {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\nProxy-agent: Saeng\r\n\r\n');

    const serverSocket = net.connect(targetPort, '127.0.0.1', () => {
      if (head && head.length > 0) serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => serverSocket.destroy());
  }

  _handleWebSocketUpgrade(req, clientSocket, head) {
    const rawHost = req.headers.host || '';
    const hostname = rawHost.split(':')[0].toLowerCase();
    const mapping = this.findMapping(hostname);

    if (!mapping) {
      clientSocket.end();
      return;
    }

    const serverSocket = net.connect(mapping.port, '127.0.0.1', () => {
      // Replay the upgrade request to the backend
      let requestLine = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
      serverSocket.write(requestLine);
      Object.entries(req.headers).forEach(([k, v]) => {
        serverSocket.write(`${k}: ${v}\r\n`);
      });
      serverSocket.write('\r\n');
      if (head && head.length > 0) serverSocket.write(head);

      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => serverSocket.destroy());
  }

  stop() {
    const closeServer = (server) =>
      new Promise((resolve) => {
        if (server) {
          server.close(() => resolve());
        } else {
          resolve();
        }
      });

    return Promise.all([
      closeServer(this.httpServer),
      closeServer(this.internalHttpsServer),
    ]).then(() => {
      this.httpServer = null;
      this.internalHttpsServer = null;
      this.internalHttpsPort = null;
    });
  }
}

export { HttpProxy };
