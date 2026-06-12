import http from 'http';
import https from 'https';
import net from 'net';
import tls from 'tls';

// Cap on how much of a request/response body is captured for the request
// log, to bound memory use for large uploads/downloads.
const MAX_BODY_CAPTURE_BYTES = 64 * 1024;

class HttpProxy {
  constructor(certManager, requestLog = null) {
    this.certManager = certManager;
    this.requestLog = requestLog;
    this.mappings = new Map();
    this.wildcards = [];
    this.mocks = new Map();
    this.httpServer = null;
    this.internalHttpsServer = null;
    this.internalHttpsPort = null;
    this.httpsEnabled = false;
  }

  updateMappings(mappings) {
    const enabled = mappings.filter((m) => m.enabled);
    this.mappings = new Map(
      enabled.filter((m) => !m.domain.startsWith('*.')).map((m) => [m.domain, m])
    );
    this.wildcards = enabled
      .filter((m) => m.domain.startsWith('*.'))
      .map((m) => ({ base: m.domain.slice(2), mapping: m }))
      .sort((a, b) => b.base.length - a.base.length);
  }

  // Applies a mapping's header overrides ({ name, value } pairs) onto a
  // headers object, lowercasing names so they replace existing headers
  // (which Node always reports with lowercase keys) rather than duplicating.
  _applyHeaderOverrides(headers, overrides) {
    if (Array.isArray(overrides)) {
      for (const { name, value } of overrides) {
        if (name) headers[name.toLowerCase()] = value;
      }
    }
    return headers;
  }

  findMapping(hostname) {
    const lower = hostname.toLowerCase();

    const exact = this.mappings.get(lower);
    if (exact) return exact;

    const wildcard = this.wildcards.find(
      ({ base }) => lower !== base && lower.endsWith(`.${base}`)
    );
    return wildcard?.mapping;
  }

  // Compiles the enabled mock rules into a Map<mappingId, CompiledMock[]>,
  // preserving array order so the first matching rule wins. Rules with an
  // invalid pathPattern are skipped defensively (the store validates on
  // save, but mappings between processes could in theory drift).
  updateMocks(mocks) {
    const byMapping = new Map();
    for (const mock of mocks) {
      if (!mock.enabled) continue;
      let regex;
      try {
        regex = new RegExp(mock.pathPattern);
      } catch {
        continue;
      }
      const list = byMapping.get(mock.mappingId) ?? [];
      list.push({
        method: (mock.method || '*').toUpperCase(),
        regex,
        statusCode: mock.statusCode,
        headers: mock.headers,
        body: mock.body,
      });
      byMapping.set(mock.mappingId, list);
    }
    this.mocks = byMapping;
  }

  // Returns the first enabled mock rule for `mapping` whose method and path
  // regex match the request, or null if mocking is off or nothing matches.
  _findMock(mapping, method, pathname) {
    if (!mapping.mocksEnabled) return null;
    const mocks = this.mocks.get(mapping.id);
    if (!mocks) return null;
    const upperMethod = method.toUpperCase();
    return mocks.find(
      (mock) => (mock.method === '*' || mock.method === upperMethod) && mock.regex.test(pathname)
    ) ?? null;
  }

  // Writes a mocked response directly to the client without contacting the
  // backend. Drains the request body so its stream doesn't hang, and (when
  // request-log detail is enabled) records the response headers/body since
  // there's no proxied stream to capture them from.
  _serveMock(mock, req, res, record) {
    req.resume();

    const headers = this._applyHeaderOverrides({}, mock.headers);
    if (!('content-type' in headers)) headers['content-type'] = 'text/plain; charset=utf-8';
    const body = mock.body || '';

    if (record) {
      record.mocked = true;
      if (this.requestLog?.logHeaders) record.responseHeaders = { ...headers };
      if (this.requestLog?.logBody) {
        record.responseBody = body;
        record.responseBodyTruncated = false;
      }
    }

    res.writeHead(mock.statusCode, headers);
    res.end(body);
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

  // Captures up to MAX_BODY_CAPTURE_BYTES of a request/response body stream
  // into `record[key]`, alongside `record[`${key}Truncated`]` noting whether
  // the full body was larger than that.
  _captureBody(stream, record, key) {
    const chunks = [];
    let captured = 0;
    let total = 0;

    stream.on('data', (chunk) => {
      total += chunk.length;
      if (captured < MAX_BODY_CAPTURE_BYTES) {
        const remaining = MAX_BODY_CAPTURE_BYTES - captured;
        const piece = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
        chunks.push(piece);
        captured += piece.length;
      }
    });

    stream.on('end', () => {
      record[key] = Buffer.concat(chunks).toString('utf8');
      record[`${key}Truncated`] = total > captured;
    });
  }

  // Records a completed request/response cycle to the request log (if enabled).
  // Hooked on 'finish' so it captures the real status code and total latency
  // without affecting how the response is streamed to the client. Returns a
  // record object the caller can populate with response headers/body as the
  // proxied response comes in.
  _recordRequest(req, res, hostname, https) {
    if (!this.requestLog) return null;

    const startedAt = Date.now();
    const { logHeaders, logBody } = this.requestLog;

    const record = {};
    if (logHeaders) record.requestHeaders = { ...req.headers };
    if (logBody) this._captureBody(req, record, 'requestBody');

    res.on('finish', () => {
      let reqPath = req.url || '/';
      if (reqPath.startsWith('http://') || reqPath.startsWith('https://')) {
        try {
          const parsed = new URL(reqPath);
          reqPath = parsed.pathname + parsed.search;
        } catch {
          // leave reqPath as the raw URL
        }
      }

      this.requestLog.add({
        timestamp: startedAt,
        method: req.method,
        hostname,
        path: reqPath,
        https,
        status: res.statusCode,
        latencyMs: Date.now() - startedAt,
        error: res.proxyError ?? null,
        mocked: record?.mocked ?? false,
        ...(logHeaders && {
          requestHeaders: record.requestHeaders,
          responseHeaders: record.responseHeaders,
        }),
        ...(logBody && {
          requestBody: record.requestBody,
          requestBodyTruncated: record.requestBodyTruncated,
          responseBody: record.responseBody,
          responseBodyTruncated: record.responseBodyTruncated,
        }),
      });
    });

    return record;
  }

  _handleRequest(req, res) {
    const rawHost = req.headers.host || '';
    const hostname = rawHost.split(':')[0].toLowerCase();
    const mapping = this.findMapping(hostname);
    const record = this._recordRequest(req, res, hostname, false);

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

    const mock = this._findMock(mapping, req.method, (reqPath || '/').split('?')[0]);
    if (mock) {
      this._serveMock(mock, req, res, record);
      return;
    }

    const backendProto = mapping.https ? https : http;
    const options = {
      hostname: mapping.host || '127.0.0.1',
      port: mapping.port,
      method: req.method,
      path: reqPath || '/',
      headers: { ...req.headers },
      ...(mapping.https && { rejectUnauthorized: false }),
    };
    delete options.headers['proxy-connection'];
    this._applyHeaderOverrides(options.headers, mapping.requestHeaders);

    const proxyReq = backendProto.request(options, (proxyRes) => {
      const headers = this._applyHeaderOverrides({ ...proxyRes.headers }, mapping.responseHeaders);
      if (record && this.requestLog.logHeaders) record.responseHeaders = { ...headers };
      if (record && this.requestLog.logBody) this._captureBody(proxyRes, record, 'responseBody');
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.proxyError = err.message;
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Saeng: backend error - ${err.message}`);
      }
    });

    req.pipe(proxyReq);
  }

  // Handles decrypted HTTPS requests forwarded from the internal TLS server
  _handleDecryptedRequest(req, res) {
    const rawHost = req.headers.host || '';
    const hostname = rawHost.split(':')[0].toLowerCase();
    const mapping = this.findMapping(hostname);
    const record = this._recordRequest(req, res, hostname, true);

    if (!mapping) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`Saeng: no mapping for ${hostname}`);
      return;
    }

    const mock = this._findMock(mapping, req.method, (req.url || '/').split('?')[0]);
    if (mock) {
      this._serveMock(mock, req, res, record);
      return;
    }

    const backendProto = mapping.https ? https : http;
    const options = {
      hostname: mapping.host || '127.0.0.1',
      port: mapping.port,
      method: req.method,
      path: req.url || '/',
      headers: { ...req.headers },
      ...(mapping.https && { rejectUnauthorized: false }),
    };
    this._applyHeaderOverrides(options.headers, mapping.requestHeaders);

    const proxyReq = backendProto.request(options, (proxyRes) => {
      const headers = this._applyHeaderOverrides({ ...proxyRes.headers }, mapping.responseHeaders);
      if (record && this.requestLog.logHeaders) record.responseHeaders = { ...headers };
      if (record && this.requestLog.logBody) this._captureBody(proxyRes, record, 'responseBody');
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.proxyError = err.message;
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Saeng: backend error - ${err.message}`);
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
      this._tunnelRaw(clientSocket, head, mapping.port, mapping.host || '127.0.0.1');
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

  _tunnelRaw(clientSocket, head, targetPort, targetHost = '127.0.0.1') {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\nProxy-agent: Saeng\r\n\r\n');

    const serverSocket = net.connect(targetPort, targetHost, () => {
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

    const serverSocket = net.connect(mapping.port, mapping.host || '127.0.0.1', () => {
      // Replay the upgrade request to the backend
      const headers = this._applyHeaderOverrides({ ...req.headers }, mapping.requestHeaders);
      let requestLine = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
      serverSocket.write(requestLine);
      Object.entries(headers).forEach(([k, v]) => {
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

export { HttpProxy, MAX_BODY_CAPTURE_BYTES };
