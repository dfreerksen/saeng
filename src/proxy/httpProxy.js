import http from 'http';
import https from 'https';
import net from 'net';
import tls from 'tls';
import { applyHeaderOverrides, rewritePath, toPathWithQuery } from './requestUtils.js';
import { compileMockRules, findMock } from './mockMatcher.js';
import { serveMock } from './mockResponder.js';

// Cap on how much of a request/response body is captured for the request
// log, to bound memory use for large uploads/downloads.
const MAX_BODY_CAPTURE_BYTES = 64 * 1024;

// Cap on how much of a request body is buffered for mock body-condition
// matching. Bodies larger than this are treated as "no body" for matching
// (body conditions fail) and are streamed to the backend instead of being
// buffered whole.
const MAX_MOCK_BODY_MATCH_BYTES = 1024 * 1024;

class HttpProxy {
  constructor(certManager, requestLog = null) {
    this.certManager = certManager;
    this.requestLog = requestLog;
    this.mappings = new Map();
    this.wildcards = [];
    this.mocks = new Map();
    this.mocksNeedBody = new Set();
    // Sockets belonging to CONNECT tunnels and WebSocket upgrades. Node
    // detaches these from the HTTP server when the 'connect'/'upgrade'
    // event fires, so server.closeAllConnections() doesn't cover them —
    // stop() destroys them explicitly.
    this.tunnelSockets = new Set();
    this.httpServer = null;
    this.internalHttpsServer = null;
    this.internalHttpsPort = null;
    this.httpsEnabled = false;
  }

  updateMappings(mappings) {
    // Normalize host once here so the request/tunnel/upgrade handlers don't
    // each need a `|| '127.0.0.1'` fallback.
    const enabled = mappings
      .filter((m) => m.enabled)
      .map((m) => (m.host ? m : { ...m, host: '127.0.0.1' }));
    this.mappings = new Map(
      enabled.filter((m) => !m.domain.startsWith('*.')).map((m) => [m.domain, m])
    );
    this.wildcards = enabled
      .filter((m) => m.domain.startsWith('*.'))
      .map((m) => ({ base: m.domain.slice(2), mapping: m }))
      .sort((a, b) => b.base.length - a.base.length);
  }

  _trackTunnelSockets(...sockets) {
    for (const socket of sockets) {
      this.tunnelSockets.add(socket);
      socket.on('close', () => this.tunnelSockets.delete(socket));
    }
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

  // Compiles the enabled mock rules and tracks which mappings need their
  // request body buffered before a mock-match decision can be made. See
  // mockMatcher.js for details.
  updateMocks(mocks) {
    const { byMapping, needsBody } = compileMockRules(mocks);
    this.mocks = byMapping;
    this.mocksNeedBody = needsBody;
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
    const defaultCert = await this.certManager.getCert('saeng.internal');

    this.internalHttpsServer = https.createServer(
      {
        cert: defaultCert.cert,
        key: defaultCert.key,
        SNICallback: (hostname, cb) => {
          this.certManager.getCert(hostname)
            .then((certData) =>
              cb(null, tls.createSecureContext({ cert: certData.cert, key: certData.key }))
            )
            .catch((err) => {
              console.error(`Failed to get cert for ${hostname}:`, err);
              cb(err);
            });
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
      const reqPath = toPathWithQuery(req.url || '/');

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
    const reqPath = toPathWithQuery(req.url);

    this._dispatch(req, res, mapping, reqPath || '/', record, true);
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

    this._dispatch(req, res, mapping, req.url || '/', record, false);
  }

  // Reads the request body into a Buffer for mock body-condition matching,
  // up to MAX_MOCK_BODY_MATCH_BYTES. Resolves { body, complete }: when the
  // cap is hit the stream is paused with `complete: false`, so the caller
  // can replay the buffered part and pipe the rest to the backend (a
  // request stream can only be consumed once).
  _readBodyForMatching(req) {
    return new Promise((resolve) => {
      const chunks = [];
      let total = 0;
      const onData = (chunk) => {
        chunks.push(chunk);
        total += chunk.length;
        if (total >= MAX_MOCK_BODY_MATCH_BYTES) {
          req.pause();
          req.off('data', onData);
          req.off('end', onEnd);
          resolve({ body: Buffer.concat(chunks), complete: false });
        }
      };
      const onEnd = () => resolve({ body: Buffer.concat(chunks), complete: true });
      req.on('data', onData);
      req.on('end', onEnd);
    });
  }

  // Buffers the request body first when the mapping has a mock with a body
  // condition (needed for both matching and replaying to the backend);
  // otherwise continues immediately, preserving today's streaming fast path.
  _dispatch(req, res, mapping, pathWithQuery, record, stripProxyConnectionHeader) {
    if (mapping.mocksEnabled && this.mocksNeedBody.has(mapping.id)) {
      this._readBodyForMatching(req).then((buffered) => {
        this._continueRequest(req, res, mapping, pathWithQuery, record, stripProxyConnectionHeader, buffered);
      });
      return;
    }
    this._continueRequest(req, res, mapping, pathWithQuery, record, stripProxyConnectionHeader, null);
  }

  // Shared tail of _handleRequest/_handleDecryptedRequest: finds a matching
  // mock (using headers/query/body available at this point) or forwards to
  // the real backend. `buffered` ({ body, complete }), when provided, is the
  // request body already read by `_readBodyForMatching` — replayed to the
  // mock/backend instead of re-reading `req` (a stream can only be consumed
  // once). An incomplete buffer (body larger than the matching cap) is
  // treated as "no body" for matching, so body conditions fail.
  _continueRequest(req, res, mapping, pathWithQuery, record, stripProxyConnectionHeader, buffered) {
    const input = pathWithQuery || '/';
    const qIndex = input.indexOf('?');
    const pathname = qIndex === -1 ? input : input.slice(0, qIndex);
    const query = new URLSearchParams(qIndex === -1 ? '' : input.slice(qIndex + 1));
    const extra = {
      query,
      headers: req.headers,
      body: buffered?.complete ? buffered.body.toString('utf8') : undefined,
    };

    const found = findMock(this.mocks, mapping, req.method, pathname, extra);
    if (found) {
      if (buffered && !buffered.complete) {
        // A non-body-conditioned mock matched mid-buffer: discard the rest
        // of the oversized upload (templates see the truncated portion).
        req.resume();
      }
      serveMock(found.mock, req, res, record, found.match, this.requestLog, buffered ? buffered.body : null);
      return;
    }

    const backendPath = rewritePath(mapping, pathWithQuery || '/');

    const backendProto = mapping.https ? https : http;
    const options = {
      hostname: mapping.host,
      port: mapping.port,
      method: req.method,
      path: backendPath,
      headers: { ...req.headers },
      ...(mapping.https && { rejectUnauthorized: false }),
    };
    if (stripProxyConnectionHeader) delete options.headers['proxy-connection'];
    applyHeaderOverrides(options.headers, mapping.requestHeaders);

    const proxyReq = backendProto.request(options, (proxyRes) => {
      const headers = applyHeaderOverrides({ ...proxyRes.headers }, mapping.responseHeaders);
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

    if (buffered !== null) {
      if (buffered.complete) {
        proxyReq.end(buffered.body);
      } else {
        // Replay the buffered part, then stream the rest (the request was
        // paused when the matching cap was hit; pipe() resumes it).
        proxyReq.write(buffered.body);
        req.pipe(proxyReq);
      }
    } else {
      req.pipe(proxyReq);
    }
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
      this._tunnelRaw(clientSocket, head, mapping.port, mapping.host);
      return;
    }

    // HTTPS MITM: pipe the client socket through our internal TLS server
    clientSocket.write('HTTP/1.1 200 Connection Established\r\nProxy-agent: Saeng\r\n\r\n');

    const tunnelSocket = net.connect(this.internalHttpsPort, '127.0.0.1', () => {
      if (head && head.length > 0) tunnelSocket.write(head);
      tunnelSocket.pipe(clientSocket);
      clientSocket.pipe(tunnelSocket);
    });
    this._trackTunnelSockets(clientSocket, tunnelSocket);

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
    this._trackTunnelSockets(clientSocket, serverSocket);

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

    const serverSocket = net.connect(mapping.port, mapping.host, () => {
      // Replay the upgrade request to the backend
      const headers = applyHeaderOverrides({ ...req.headers }, mapping.requestHeaders);
      const backendPath = rewritePath(mapping, req.url || '/');
      let requestLine = `${req.method} ${backendPath} HTTP/${req.httpVersion}\r\n`;
      serverSocket.write(requestLine);
      Object.entries(headers).forEach(([k, v]) => {
        // Multi-value headers arrive as arrays — write one line per value
        // instead of comma-joining them.
        for (const value of Array.isArray(v) ? v : [v]) {
          serverSocket.write(`${k}: ${value}\r\n`);
        }
      });
      serverSocket.write('\r\n');
      if (head && head.length > 0) serverSocket.write(head);

      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });
    this._trackTunnelSockets(clientSocket, serverSocket);

    serverSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => serverSocket.destroy());
  }

  stop() {
    // Destroy open tunnel sockets (CONNECT tunnels, WebSocket upgrades) —
    // these are detached from the HTTP server, so closeAllConnections()
    // below doesn't reach them and close() would wait on them forever.
    for (const socket of this.tunnelSockets) {
      socket.destroy();
    }
    this.tunnelSockets.clear();

    const closeServer = (server) =>
      new Promise((resolve) => {
        if (server) {
          // Destroy remaining request sockets (e.g. keep-alive connections)
          // so close() resolves immediately instead of waiting for clients
          // to hang up.
          server.closeAllConnections();
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

export { HttpProxy, MAX_BODY_CAPTURE_BYTES, MAX_MOCK_BODY_MATCH_BYTES };
