import { describe, it, expect, afterEach, vi } from 'vitest';
import http from 'http';
import net from 'net';
import { EventEmitter } from 'events';
import { HttpProxy, MAX_BODY_CAPTURE_BYTES } from '../../src/proxy/httpProxy.js';

// Helper: build a minimal mock req/res pair for exercising _recordRequest()
// directly, without spinning up a real server. `res` is an EventEmitter so
// `res.on('finish', ...)` can be triggered with `res.emit('finish')`.
function makeMockReqRes({ method = 'GET', url = '/path', statusCode = 200, proxyError } = {}) {
  const req = { method, url, headers: {} };
  const res = new EventEmitter();
  res.statusCode = statusCode;
  if (proxyError !== undefined) res.proxyError = proxyError;
  return { req, res };
}

function startBackend(response = 'ok') {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => res.end(response));
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Backend that echoes the request headers it received as a JSON body, and
// sets its own response header so response-header overrides can be checked.
function startEchoBackend() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('X-Original', 'original-value');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(req.headers));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function stopBackend(server) {
  return new Promise((resolve) => server.close(resolve));
}

// Backend that responds with the request path (req.url) as its body, used
// to verify path-rewriting is applied to what's forwarded to the backend.
function startPathEchoBackend() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => res.end(req.url));
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Helper: make a plain HTTP request and return { statusCode, body }
function makeRequest(port, { method = 'GET', path = '/', host, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, method, path, headers: { Host: host } },
      (res) => {
        let respBody = '';
        res.on('data', (chunk) => (respBody += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: respBody }));
      }
    );
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

// Creates a minimal mock TCP socket suitable for _handleConnect and
// _handleWebSocketUpgrade tests. All methods are vi.fn() so they can be
// asserted against; _written collects everything passed to write().
function makeMockSocket() {
  const socket = new EventEmitter();
  const _written = [];
  socket.write = vi.fn((data) => { _written.push(data); return true; });
  socket.end = vi.fn();
  socket.destroy = vi.fn();
  socket.pipe = vi.fn();
  socket._written = _written;
  return socket;
}

// Joins all data written to a mock socket into a single string.
function writtenText(socket) {
  return socket._written.map((d) => (Buffer.isBuffer(d) ? d.toString() : String(d))).join('');
}

// Backend that responds with a fixed-size body, used to exercise body
// truncation in the request log.
function startSizedBackend(responseSize) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('y'.repeat(responseSize));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

describe('HttpProxy.updateMappings()', () => {
  it('builds a Map containing only enabled mappings', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([
      { domain: 'myapp.local', port: 3000, enabled: true },
      { domain: 'disabled.local', port: 3001, enabled: false },
      { domain: 'api.local', port: 4000, enabled: true },
    ]);
    expect(proxy.mappings.size).toBe(2);
    expect(proxy.mappings.has('myapp.local')).toBe(true);
    expect(proxy.mappings.has('api.local')).toBe(true);
    expect(proxy.mappings.has('disabled.local')).toBe(false);
  });

  it('stores the full mapping object (port, https, host, etc.)', () => {
    const proxy = new HttpProxy(null);
    const mapping = { domain: 'myapp.local', port: 3000, https: true, host: '10.0.0.1', enabled: true };
    proxy.updateMappings([mapping]);
    expect(proxy.mappings.get('myapp.local')).toMatchObject({ port: 3000, https: true, host: '10.0.0.1' });
  });

  it('replaces the previous mapping set on each call', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{ domain: 'old.local', port: 1, enabled: true }]);
    proxy.updateMappings([{ domain: 'new.local', port: 2, enabled: true }]);
    expect(proxy.mappings.has('old.local')).toBe(false);
    expect(proxy.mappings.has('new.local')).toBe(true);
  });
});

describe('HttpProxy.updateMocks()', () => {
  it('builds a Map containing only enabled mocks, keyed by mappingId', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: 'get', pathPattern: '^/a$', statusCode: 200, headers: [], body: 'a' },
      { mappingId: 'm1', enabled: false, method: 'get', pathPattern: '^/b$', statusCode: 200, headers: [], body: 'b' },
      { mappingId: 'm2', enabled: true, method: '*', pathPattern: '^/c$', statusCode: 200, headers: [], body: 'c' },
    ]);
    expect(proxy.mocks.get('m1')).toHaveLength(1);
    expect(proxy.mocks.get('m1')[0]).toMatchObject({ method: 'GET', body: 'a' });
    expect(proxy.mocks.get('m2')).toHaveLength(1);
  });

  it('carries delayMs through to compiled mocks', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/a$', statusCode: 200, headers: [], body: 'a', delayMs: 500 },
    ]);
    expect(proxy.mocks.get('m1')[0].delayMs).toBe(500);
  });

  it('defaults delayMs to 0 when not provided', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/a$', statusCode: 200, headers: [], body: 'a' },
    ]);
    expect(proxy.mocks.get('m1')[0].delayMs).toBe(0);
  });

  it('skips mocks with an invalid pathPattern regex', () => {
    const proxy = new HttpProxy(null);
    expect(() => proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '(unterminated', statusCode: 200, headers: [], body: '' },
    ])).not.toThrow();
    expect(proxy.mocks.has('m1')).toBe(false);
  });

  it('replaces the previous mock set on each call', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([{ mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/old$', statusCode: 200, headers: [], body: 'old' }]);
    proxy.updateMocks([{ mappingId: 'm2', enabled: true, method: '*', pathPattern: '^/new$', statusCode: 200, headers: [], body: 'new' }]);
    expect(proxy.mocks.has('m1')).toBe(false);
    expect(proxy.mocks.has('m2')).toBe(true);
  });

  it('tracks mappingIds with a body condition in mocksNeedBody', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/a$', statusCode: 200, headers: [], body: '', conditions: [{ type: 'body', key: '', operator: 'contains', value: 'x' }] },
      { mappingId: 'm2', enabled: true, method: '*', pathPattern: '^/b$', statusCode: 200, headers: [], body: '', conditions: [{ type: 'header', key: 'x-foo', operator: 'exists' }] },
    ]);
    expect(proxy.mocksNeedBody.has('m1')).toBe(true);
    expect(proxy.mocksNeedBody.has('m2')).toBe(false);
  });

  it('skips mocks with an invalid condition regex', () => {
    const proxy = new HttpProxy(null);
    expect(() => proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/a$', statusCode: 200, headers: [], body: '', conditions: [{ type: 'header', key: 'x-foo', operator: 'regex', value: '(unterminated' }] },
    ])).not.toThrow();
    expect(proxy.mocks.has('m1')).toBe(false);
  });
});

describe('HttpProxy._findMock()', () => {
  it('returns null when mapping.mocksEnabled is false', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([{ mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api$', statusCode: 200, headers: [], body: '' }]);
    expect(proxy._findMock({ id: 'm1', mocksEnabled: false }, 'GET', '/api')).toBeNull();
  });

  it('returns null when there are no mocks for the mapping', () => {
    const proxy = new HttpProxy(null);
    expect(proxy._findMock({ id: 'm1', mocksEnabled: true }, 'GET', '/api')).toBeNull();
  });

  it('matches a mock with method "*" regardless of request method', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([{ mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api$', statusCode: 200, headers: [], body: 'any' }]);
    const mapping = { id: 'm1', mocksEnabled: true };
    expect(proxy._findMock(mapping, 'GET', '/api')?.mock.body).toBe('any');
    expect(proxy._findMock(mapping, 'POST', '/api')?.mock.body).toBe('any');
  });

  it('matches a mock only for its configured method (case-insensitive)', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([{ mappingId: 'm1', enabled: true, method: 'post', pathPattern: '^/api$', statusCode: 200, headers: [], body: 'posted' }]);
    const mapping = { id: 'm1', mocksEnabled: true };
    expect(proxy._findMock(mapping, 'POST', '/api')?.mock.body).toBe('posted');
    expect(proxy._findMock(mapping, 'GET', '/api')).toBeNull();
  });

  it('matches the path against the mock regex', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([{ mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api/users/\\d+$', statusCode: 200, headers: [], body: 'user' }]);
    const mapping = { id: 'm1', mocksEnabled: true };
    expect(proxy._findMock(mapping, 'GET', '/api/users/42')?.mock.body).toBe('user');
    expect(proxy._findMock(mapping, 'GET', '/api/users/abc')).toBeNull();
  });

  it('returns the first matching rule when multiple rules match', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api.*$', statusCode: 200, headers: [], body: 'first' },
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api/ping$', statusCode: 200, headers: [], body: 'second' },
    ]);
    const mapping = { id: 'm1', mocksEnabled: true };
    expect(proxy._findMock(mapping, 'GET', '/api/ping')?.mock.body).toBe('first');
  });

  it('returns the regex match result with capture groups', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([{ mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api/users/(\\d+)$', statusCode: 200, headers: [], body: '' }]);
    const mapping = { id: 'm1', mocksEnabled: true };
    const result = proxy._findMock(mapping, 'GET', '/api/users/42');
    expect(result.match[0]).toBe('/api/users/42');
    expect(result.match[1]).toBe('42');
  });
});

describe('HttpProxy._findMock() with conditions', () => {
  const mapping = { id: 'm1', mocksEnabled: true };

  it('matches when a header condition is satisfied (equals, case-insensitive key)', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([{ mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api$', statusCode: 200, headers: [], body: 'ok', conditions: [{ type: 'header', key: 'X-Token', operator: 'equals', value: 'secret' }] }]);
    const extra = { query: new URLSearchParams(), headers: { 'x-token': 'secret' } };
    expect(proxy._findMock(mapping, 'GET', '/api', extra)?.mock.body).toBe('ok');
    expect(proxy._findMock(mapping, 'GET', '/api', { query: new URLSearchParams(), headers: { 'x-token': 'wrong' } })).toBeNull();
  });

  it('matches a header "exists" condition regardless of value', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([{ mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api$', statusCode: 200, headers: [], body: 'ok', conditions: [{ type: 'header', key: 'authorization', operator: 'exists' }] }]);
    expect(proxy._findMock(mapping, 'GET', '/api', { query: new URLSearchParams(), headers: { authorization: 'Bearer x' } })).not.toBeNull();
    expect(proxy._findMock(mapping, 'GET', '/api', { query: new URLSearchParams(), headers: {} })).toBeNull();
  });

  it('matches a query param condition (contains)', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([{ mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api$', statusCode: 200, headers: [], body: 'ok', conditions: [{ type: 'query', key: 'debug', operator: 'contains', value: 'tru' }] }]);
    expect(proxy._findMock(mapping, 'GET', '/api', { query: new URLSearchParams('debug=true'), headers: {} })).not.toBeNull();
    expect(proxy._findMock(mapping, 'GET', '/api', { query: new URLSearchParams(), headers: {} })).toBeNull();
  });

  it('matches a body condition (regex)', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([{ mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api$', statusCode: 200, headers: [], body: 'ok', conditions: [{ type: 'body', key: '', operator: 'regex', value: '"id":\\s*\\d+' }] }]);
    expect(proxy._findMock(mapping, 'GET', '/api', { query: new URLSearchParams(), headers: {}, body: '{"id": 42}' })).not.toBeNull();
    expect(proxy._findMock(mapping, 'GET', '/api', { query: new URLSearchParams(), headers: {}, body: '{}' })).toBeNull();
  });

  it('treats a body "exists" condition as non-empty', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([{ mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api$', statusCode: 200, headers: [], body: 'ok', conditions: [{ type: 'body', key: '', operator: 'exists' }] }]);
    expect(proxy._findMock(mapping, 'GET', '/api', { query: new URLSearchParams(), headers: {}, body: '  ' })).toBeNull();
    expect(proxy._findMock(mapping, 'GET', '/api', { query: new URLSearchParams(), headers: {}, body: 'x' })).not.toBeNull();
  });

  it('requires all conditions to match (AND)', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([{
      mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api$', statusCode: 200, headers: [], body: 'ok',
      conditions: [
        { type: 'header', key: 'x-token', operator: 'exists' },
        { type: 'query', key: 'debug', operator: 'equals', value: 'true' },
      ],
    }]);
    expect(proxy._findMock(mapping, 'GET', '/api', { query: new URLSearchParams('debug=true'), headers: { 'x-token': 'a' } })).not.toBeNull();
    expect(proxy._findMock(mapping, 'GET', '/api', { query: new URLSearchParams('debug=true'), headers: {} })).toBeNull();
  });

  it('is backward compatible when called without an extra context', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMocks([{ mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api$', statusCode: 200, headers: [], body: 'ok' }]);
    expect(proxy._findMock(mapping, 'GET', '/api')?.mock.body).toBe('ok');
  });
});

describe('HttpProxy.findMapping()', () => {
  it('returns the mapping for a known domain', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{ domain: 'myapp.local', port: 3000, enabled: true }]);
    expect(proxy.findMapping('myapp.local')).toMatchObject({ port: 3000 });
  });

  it('returns undefined for an unknown domain', () => {
    const proxy = new HttpProxy(null);
    expect(proxy.findMapping('unknown.local')).toBeUndefined();
  });

  it('is case-insensitive', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{ domain: 'myapp.local', port: 3000, enabled: true }]);
    expect(proxy.findMapping('MYAPP.LOCAL')).toBeDefined();
    expect(proxy.findMapping('MyApp.Local')).toBeDefined();
  });

  it('matches a subdomain against a wildcard mapping', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{ domain: '*.myapp.local', port: 3000, enabled: true }]);
    expect(proxy.findMapping('api.myapp.local')).toMatchObject({ port: 3000 });
    expect(proxy.findMapping('a.b.myapp.local')).toMatchObject({ port: 3000 });
  });

  it('does not match the bare base domain against a wildcard mapping', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{ domain: '*.myapp.local', port: 3000, enabled: true }]);
    expect(proxy.findMapping('myapp.local')).toBeUndefined();
  });

  it('prefers an exact mapping over an overlapping wildcard mapping', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([
      { domain: '*.myapp.local', port: 3000, enabled: true },
      { domain: 'api.myapp.local', port: 4000, enabled: true },
    ]);
    expect(proxy.findMapping('api.myapp.local')).toMatchObject({ port: 4000 });
    expect(proxy.findMapping('admin.myapp.local')).toMatchObject({ port: 3000 });
  });

  it('prefers the more specific wildcard when wildcards overlap', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([
      { domain: '*.myapp.local', port: 3000, enabled: true },
      { domain: '*.api.myapp.local', port: 5000, enabled: true },
    ]);
    expect(proxy.findMapping('v1.api.myapp.local')).toMatchObject({ port: 5000 });
    expect(proxy.findMapping('admin.myapp.local')).toMatchObject({ port: 3000 });
  });

  it('is case-insensitive for wildcard mappings', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{ domain: '*.myapp.local', port: 3000, enabled: true }]);
    expect(proxy.findMapping('API.MYAPP.LOCAL')).toBeDefined();
  });
});

describe('HttpProxy.getPort()', () => {
  it('returns null before the server is started', () => {
    expect(new HttpProxy(null).getPort()).toBeNull();
  });

  it('returns a positive port number after start', async () => {
    const proxy = new HttpProxy(null);
    await proxy.start([], { httpsEnabled: false });
    expect(proxy.getPort()).toBeGreaterThan(0);
    await proxy.stop();
  });
});

describe('HttpProxy HTTP server lifecycle', () => {
  let proxy;

  afterEach(async () => {
    await proxy?.stop();
    proxy = null;
  });

  it('stop() nulls out httpServer and internalHttpsServer', async () => {
    proxy = new HttpProxy(null);
    await proxy.start([], { httpsEnabled: false });
    await proxy.stop();
    expect(proxy.httpServer).toBeNull();
    expect(proxy.internalHttpsServer).toBeNull();
    proxy = null;
  });

  it('stop() resolves cleanly when never started', async () => {
    proxy = new HttpProxy(null);
    await expect(proxy.stop()).resolves.toBeUndefined();
    proxy = null;
  });
});

describe('HttpProxy request handling', () => {
  let proxy;

  afterEach(async () => {
    await proxy?.stop();
    proxy = null;
  });

  it('returns 502 and error text for an unmapped hostname', async () => {
    proxy = new HttpProxy(null);
    await proxy.start([], { httpsEnabled: false });
    const { statusCode, body } = await makeRequest(proxy.getPort(), { host: 'unknown.local' });
    expect(statusCode).toBe(502);
    expect(body).toContain('unknown.local');
  });

  it('returns 502 for a mapped-but-disabled hostname (not in Map)', async () => {
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ domain: 'disabled.local', port: 9999, enabled: false }],
      { httpsEnabled: false }
    );
    const { statusCode } = await makeRequest(proxy.getPort(), { host: 'disabled.local' });
    expect(statusCode).toBe(502);
  });

  it('routes to mapping.host when an explicit host is provided', async () => {
    const backend = await startBackend('from-backend');
    const backendPort = backend.address().port;
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ domain: 'custom.local', host: '127.0.0.1', port: backendPort, enabled: true }],
      { httpsEnabled: false }
    );
    const { statusCode, body } = await makeRequest(proxy.getPort(), { host: 'custom.local' });
    expect(statusCode).toBe(200);
    expect(body).toBe('from-backend');
    await stopBackend(backend);
  });

  it('strips the port from the Host header when resolving the mapping', async () => {
    proxy = new HttpProxy(null);
    // Map myapp.local but send Host: myapp.local:3000 — should still find it
    proxy.updateMappings([{ domain: 'myapp.local', port: 3000, enabled: true }]);
    await proxy.start([], { httpsEnabled: false });
    // We expect a 502 here (backend isn't listening), NOT a connection error thrown
    // The important thing is that the proxy attempted to connect, not that it rejected the host
    const { statusCode } = await makeRequest(proxy.getPort(), { host: 'myapp.local:3000' });
    expect(statusCode).toBe(502);
  });

  it('applies mapping.requestHeaders to the request forwarded to the backend', async () => {
    const backend = await startEchoBackend();
    const backendPort = backend.address().port;
    proxy = new HttpProxy(null);
    await proxy.start(
      [{
        domain: 'headers.local', host: '127.0.0.1', port: backendPort, enabled: true,
        requestHeaders: [{ name: 'X-Custom', value: 'injected' }],
      }],
      { httpsEnabled: false }
    );
    const { body } = await makeRequest(proxy.getPort(), { host: 'headers.local' });
    expect(JSON.parse(body)['x-custom']).toBe('injected');
    await stopBackend(backend);
  });

  it('applies mapping.responseHeaders to the response sent to the client, overriding existing headers', async () => {
    const backend = await startEchoBackend();
    const backendPort = backend.address().port;
    proxy = new HttpProxy(null);
    await proxy.start(
      [{
        domain: 'headers.local', host: '127.0.0.1', port: backendPort, enabled: true,
        responseHeaders: [{ name: 'X-Original', value: 'overridden' }, { name: 'X-New', value: 'added' }],
      }],
      { httpsEnabled: false }
    );
    const { headers } = await makeRequest(proxy.getPort(), { host: 'headers.local' });
    expect(headers['x-original']).toBe('overridden');
    expect(headers['x-new']).toBe('added');
    await stopBackend(backend);
  });

  it('rewrites the request path before forwarding to the backend', async () => {
    const backend = await startPathEchoBackend();
    const backendPort = backend.address().port;
    proxy = new HttpProxy(null);
    await proxy.start(
      [{
        domain: 'rewrite.local', host: '127.0.0.1', port: backendPort, enabled: true,
        pathRewriteFrom: '/api/v2', pathRewriteTo: '/v3',
      }],
      { httpsEnabled: false }
    );
    const { body } = await makeRequest(proxy.getPort(), { host: 'rewrite.local', path: '/api/v2/users?x=1' });
    expect(body).toBe('/v3/users?x=1');
    await stopBackend(backend);
  });

  it('does not rewrite the path when pathRewriteFrom is empty', async () => {
    const backend = await startPathEchoBackend();
    const backendPort = backend.address().port;
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ domain: 'norewrite.local', host: '127.0.0.1', port: backendPort, enabled: true }],
      { httpsEnabled: false }
    );
    const { body } = await makeRequest(proxy.getPort(), { host: 'norewrite.local', path: '/api/v2/users' });
    expect(body).toBe('/api/v2/users');
    await stopBackend(backend);
  });

  it('matches a mock against the original pre-rewrite path even when a rewrite is configured', async () => {
    const backend = await startPathEchoBackend();
    const backendPort = backend.address().port;
    proxy = new HttpProxy(null);
    const mapping = {
      id: 'm1', domain: 'mockrewrite.local', host: '127.0.0.1', port: backendPort, enabled: true,
      mocksEnabled: true, pathRewriteFrom: '/api/v2', pathRewriteTo: '/v3',
    };
    proxy.updateMocks([{
      id: 'mock1', mappingId: 'm1', enabled: true, method: '*',
      pathPattern: '^/api/v2/users$', statusCode: 200, headers: [], body: 'mocked-response', delayMs: 0,
    }]);
    await proxy.start([mapping], { httpsEnabled: false });
    const { body } = await makeRequest(proxy.getPort(), { host: 'mockrewrite.local', path: '/api/v2/users' });
    expect(body).toBe('mocked-response');
    await stopBackend(backend);
  });
});

describe('HttpProxy._rewritePath()', () => {
  it('returns the path unchanged when pathRewriteFrom is empty/not set', () => {
    const proxy = new HttpProxy(null);
    expect(proxy._rewritePath({}, '/api/v2/users')).toBe('/api/v2/users');
    expect(proxy._rewritePath({ pathRewriteFrom: '' }, '/api/v2/users')).toBe('/api/v2/users');
  });

  it('rewrites an exact prefix match to pathRewriteTo', () => {
    const proxy = new HttpProxy(null);
    const mapping = { pathRewriteFrom: '/api/v2', pathRewriteTo: '/v3' };
    expect(proxy._rewritePath(mapping, '/api/v2')).toBe('/v3');
  });

  it('rewrites a prefix match with a trailing segment, preserving the query string', () => {
    const proxy = new HttpProxy(null);
    const mapping = { pathRewriteFrom: '/api/v2', pathRewriteTo: '/v3' };
    expect(proxy._rewritePath(mapping, '/api/v2/users/42?x=1')).toBe('/v3/users/42?x=1');
  });

  it('does not rewrite when the prefix is not a full path segment', () => {
    const proxy = new HttpProxy(null);
    const mapping = { pathRewriteFrom: '/api', pathRewriteTo: '/v3' };
    expect(proxy._rewritePath(mapping, '/apiextra')).toBe('/apiextra');
  });

  it('falls back to "/" when pathRewriteTo is empty and the match is exact', () => {
    const proxy = new HttpProxy(null);
    const mapping = { pathRewriteFrom: '/api/v2', pathRewriteTo: '' };
    expect(proxy._rewritePath(mapping, '/api/v2')).toBe('/');
  });

  it('strips the prefix down to the remaining segment when pathRewriteTo is empty', () => {
    const proxy = new HttpProxy(null);
    const mapping = { pathRewriteFrom: '/api/v2', pathRewriteTo: '' };
    expect(proxy._rewritePath(mapping, '/api/v2/users')).toBe('/users');
  });

  it('preserves special characters in the query string exactly', () => {
    const proxy = new HttpProxy(null);
    const mapping = { pathRewriteFrom: '/api/v2', pathRewriteTo: '/v3' };
    expect(proxy._rewritePath(mapping, '/api/v2/users?q=a%20b&x=1')).toBe('/v3/users?q=a%20b&x=1');
  });

  it('treats a missing pathWithQuery as "/"', () => {
    const proxy = new HttpProxy(null);
    const mapping = { pathRewriteFrom: '/', pathRewriteTo: '/v3' };
    expect(proxy._rewritePath(mapping, '')).toBe('/v3');
  });
});

describe('HttpProxy._applyHeaderOverrides()', () => {
  it('lowercases override names and overwrites existing headers without dropping others', () => {
    const proxy = new HttpProxy(null);
    const headers = { 'x-existing': 'old', 'content-type': 'text/plain' };
    const result = proxy._applyHeaderOverrides(headers, [
      { name: 'X-Existing', value: 'new' },
      { name: 'X-New', value: 'added' },
    ]);
    expect(result['x-existing']).toBe('new');
    expect(result['x-new']).toBe('added');
    expect(result['content-type']).toBe('text/plain');
  });

  it('leaves headers unchanged when overrides is not an array', () => {
    const proxy = new HttpProxy(null);
    const headers = { 'x-existing': 'old' };
    expect(proxy._applyHeaderOverrides(headers, undefined)).toBe(headers);
    expect(headers).toEqual({ 'x-existing': 'old' });
  });
});

describe('HttpProxy._recordRequest()', () => {
  it('does nothing when no requestLog is configured', () => {
    const proxy = new HttpProxy(null);
    const { req, res } = makeMockReqRes();
    expect(() => {
      proxy._recordRequest(req, res, 'myapp.local', false);
      res.emit('finish');
    }).not.toThrow();
  });

  it('logs a completed request with method, hostname, path, status, https flag and timing', () => {
    const add = vi.fn();
    const proxy = new HttpProxy(null, { add });
    const { req, res } = makeMockReqRes({ method: 'GET', url: '/dashboard', statusCode: 200 });

    proxy._recordRequest(req, res, 'myapp.local', false);
    res.emit('finish');

    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0][0]).toMatchObject({
      method: 'GET',
      hostname: 'myapp.local',
      path: '/dashboard',
      https: false,
      status: 200,
      error: null,
    });
    expect(add.mock.calls[0][0].timestamp).toEqual(expect.any(Number));
    expect(add.mock.calls[0][0].latencyMs).toEqual(expect.any(Number));
  });

  it('includes the backend error message when the response was marked with proxyError', () => {
    const add = vi.fn();
    const proxy = new HttpProxy(null, { add });
    const { req, res } = makeMockReqRes({ statusCode: 502, proxyError: 'connect ECONNREFUSED 127.0.0.1:9999' });

    proxy._recordRequest(req, res, 'myapp.local', false);
    res.emit('finish');

    expect(add.mock.calls[0][0]).toMatchObject({
      status: 502,
      error: 'connect ECONNREFUSED 127.0.0.1:9999',
    });
  });

  it('marks https requests with https: true', () => {
    const add = vi.fn();
    const proxy = new HttpProxy(null, { add });
    const { req, res } = makeMockReqRes();

    proxy._recordRequest(req, res, 'secure.local', true);
    res.emit('finish');

    expect(add.mock.calls[0][0]).toMatchObject({ hostname: 'secure.local', https: true });
  });

  it('extracts the path and query string from an absolute proxy URL', () => {
    const add = vi.fn();
    const proxy = new HttpProxy(null, { add });
    const { req, res } = makeMockReqRes({ url: 'http://myapp.local/search?q=test' });

    proxy._recordRequest(req, res, 'myapp.local', false);
    res.emit('finish');

    expect(add.mock.calls[0][0]).toMatchObject({ path: '/search?q=test' });
  });

  it('falls back to the raw URL when an absolute-looking URL fails to parse', () => {
    const add = vi.fn();
    const proxy = new HttpProxy(null, { add });
    const { req, res } = makeMockReqRes({ url: 'http://' });

    proxy._recordRequest(req, res, 'myapp.local', false);
    res.emit('finish');

    expect(add.mock.calls[0][0]).toMatchObject({ path: 'http://' });
  });

  it('defaults to "/" when the request has no url', () => {
    const add = vi.fn();
    const proxy = new HttpProxy(null, { add });
    const { req, res } = makeMockReqRes();
    delete req.url;

    proxy._recordRequest(req, res, 'myapp.local', false);
    res.emit('finish');

    expect(add.mock.calls[0][0]).toMatchObject({ path: '/' });
  });
});

describe('HttpProxy request logging — end to end', () => {
  let proxy;
  let backend;

  afterEach(async () => {
    await proxy?.stop();
    proxy = null;
    if (backend) await stopBackend(backend);
    backend = null;
  });

  it('records a completed proxied request once the response finishes', async () => {
    backend = await startBackend('hello');
    const add = vi.fn();
    proxy = new HttpProxy(null, { add });
    await proxy.start(
      [{ domain: 'logged.local', host: '127.0.0.1', port: backend.address().port, enabled: true }],
      { httpsEnabled: false }
    );

    await makeRequest(proxy.getPort(), { host: 'logged.local', path: '/ping' });

    await vi.waitFor(() => expect(add).toHaveBeenCalled());
    expect(add.mock.calls[0][0]).toMatchObject({
      method: 'GET',
      hostname: 'logged.local',
      path: '/ping',
      https: false,
      status: 200,
    });
  });

  it('records the backend error message when the backend is unreachable', async () => {
    const add = vi.fn();
    proxy = new HttpProxy(null, { add });
    await proxy.start(
      [{ domain: 'unreachable.local', host: '127.0.0.1', port: 1, enabled: true }],
      { httpsEnabled: false }
    );

    await makeRequest(proxy.getPort(), { host: 'unreachable.local', path: '/ping' });

    await vi.waitFor(() => expect(add).toHaveBeenCalled());
    expect(add.mock.calls[0][0]).toMatchObject({
      hostname: 'unreachable.local',
      status: 502,
      error: expect.stringContaining('ECONNREFUSED'),
    });
  });

  it('does not attempt to log when no requestLog is configured', async () => {
    backend = await startBackend('hello');
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ domain: 'unlogged.local', host: '127.0.0.1', port: backend.address().port, enabled: true }],
      { httpsEnabled: false }
    );

    await expect(
      makeRequest(proxy.getPort(), { host: 'unlogged.local' })
    ).resolves.toMatchObject({ statusCode: 200 });
  });
});

describe('HttpProxy request logging — headers and body capture', () => {
  let proxy;
  let backend;

  afterEach(async () => {
    await proxy?.stop();
    proxy = null;
    if (backend) await stopBackend(backend);
    backend = null;
  });

  it('omits header and body fields by default', async () => {
    backend = await startBackend('hello');
    const add = vi.fn();
    proxy = new HttpProxy(null, { add });
    await proxy.start(
      [{ domain: 'plain.local', host: '127.0.0.1', port: backend.address().port, enabled: true }],
      { httpsEnabled: false }
    );

    await makeRequest(proxy.getPort(), { host: 'plain.local' });

    await vi.waitFor(() => expect(add).toHaveBeenCalled());
    const entry = add.mock.calls[0][0];
    expect(entry.requestHeaders).toBeUndefined();
    expect(entry.responseHeaders).toBeUndefined();
    expect(entry.requestBody).toBeUndefined();
    expect(entry.responseBody).toBeUndefined();
  });

  it('captures request and response headers when logHeaders is enabled', async () => {
    backend = await startBackend('hello');
    const add = vi.fn();
    proxy = new HttpProxy(null, { add, logHeaders: true });
    await proxy.start(
      [{ domain: 'headers2.local', host: '127.0.0.1', port: backend.address().port, enabled: true }],
      { httpsEnabled: false }
    );

    await makeRequest(proxy.getPort(), { host: 'headers2.local' });

    await vi.waitFor(() => expect(add).toHaveBeenCalled());
    const entry = add.mock.calls[0][0];
    expect(entry.requestHeaders.host).toBe('headers2.local');
    expect(entry.responseHeaders).toMatchObject({ date: expect.any(String) });
    expect(entry.requestBody).toBeUndefined();
    expect(entry.responseBody).toBeUndefined();
  });

  it('captures request and response bodies when logBody is enabled', async () => {
    backend = await startBackend('pong');
    const add = vi.fn();
    proxy = new HttpProxy(null, { add, logBody: true });
    await proxy.start(
      [{ domain: 'body.local', host: '127.0.0.1', port: backend.address().port, enabled: true }],
      { httpsEnabled: false }
    );

    await makeRequest(proxy.getPort(), { host: 'body.local', method: 'POST', body: 'ping' });

    await vi.waitFor(() => expect(add).toHaveBeenCalled());
    const entry = add.mock.calls[0][0];
    expect(entry.requestBody).toBe('ping');
    expect(entry.requestBodyTruncated).toBe(false);
    expect(entry.responseBody).toBe('pong');
    expect(entry.responseBodyTruncated).toBe(false);
    expect(entry.requestHeaders).toBeUndefined();
    expect(entry.responseHeaders).toBeUndefined();
  });

  it('truncates bodies larger than the capture limit and flags them', async () => {
    const bigSize = MAX_BODY_CAPTURE_BYTES + 1000;
    backend = await startSizedBackend(bigSize);
    const add = vi.fn();
    proxy = new HttpProxy(null, { add, logBody: true });
    await proxy.start(
      [{ domain: 'big.local', host: '127.0.0.1', port: backend.address().port, enabled: true }],
      { httpsEnabled: false }
    );

    await makeRequest(proxy.getPort(), { host: 'big.local', method: 'POST', body: 'x'.repeat(bigSize) });

    await vi.waitFor(() => expect(add).toHaveBeenCalled());
    const entry = add.mock.calls[0][0];
    expect(entry.requestBody).toHaveLength(MAX_BODY_CAPTURE_BYTES);
    expect(entry.requestBodyTruncated).toBe(true);
    expect(entry.responseBody).toHaveLength(MAX_BODY_CAPTURE_BYTES);
    expect(entry.responseBodyTruncated).toBe(true);
  });
});

describe('HttpProxy mocked responses — end to end', () => {
  let proxy;
  let backend;
  let backendHits;

  function startCountingBackend(response = 'from-backend') {
    return new Promise((resolve) => {
      backendHits = 0;
      const server = http.createServer((req, res) => {
        backendHits += 1;
        res.end(response);
      });
      server.listen(0, '127.0.0.1', () => resolve(server));
    });
  }

  afterEach(async () => {
    await proxy?.stop();
    proxy = null;
    if (backend) await stopBackend(backend);
    backend = null;
  });

  it('returns the mocked status/body and never contacts the backend when a rule matches', async () => {
    backend = await startCountingBackend();
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ id: 'm1', domain: 'mocked.local', host: '127.0.0.1', port: backend.address().port, enabled: true, mocksEnabled: true }],
      { httpsEnabled: false }
    );
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: 'GET', pathPattern: '^/api/ping$', statusCode: 200, headers: [], body: '{"ok":true}' },
    ]);

    const { statusCode, body } = await makeRequest(proxy.getPort(), { host: 'mocked.local', path: '/api/ping' });
    expect(statusCode).toBe(200);
    expect(body).toBe('{"ok":true}');
    expect(backendHits).toBe(0);
  });

  it('defaults the content-type header to text/plain when the mock does not specify one', async () => {
    backend = await startCountingBackend();
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ id: 'm1', domain: 'mocked.local', host: '127.0.0.1', port: backend.address().port, enabled: true, mocksEnabled: true }],
      { httpsEnabled: false }
    );
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/.*$', statusCode: 200, headers: [], body: 'hello' },
    ]);

    const { headers } = await makeRequest(proxy.getPort(), { host: 'mocked.local', path: '/anything' });
    expect(headers['content-type']).toBe('text/plain; charset=utf-8');
  });

  it('applies mock.headers to the mocked response', async () => {
    backend = await startCountingBackend();
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ id: 'm1', domain: 'mocked.local', host: '127.0.0.1', port: backend.address().port, enabled: true, mocksEnabled: true }],
      { httpsEnabled: false }
    );
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/.*$', statusCode: 201, headers: [{ name: 'Content-Type', value: 'application/json' }, { name: 'X-Mock', value: 'yes' }], body: '{}' },
    ]);

    const { statusCode, headers } = await makeRequest(proxy.getPort(), { host: 'mocked.local', path: '/anything' });
    expect(statusCode).toBe(201);
    expect(headers['content-type']).toBe('application/json');
    expect(headers['x-mock']).toBe('yes');
  });

  it('adds the X-Saeng-Mock header to mocked responses', async () => {
    backend = await startCountingBackend();
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ id: 'm1', domain: 'mocked.local', host: '127.0.0.1', port: backend.address().port, enabled: true, mocksEnabled: true }],
      { httpsEnabled: false }
    );
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/.*$', statusCode: 200, headers: [], body: 'hello' },
    ]);

    const { headers } = await makeRequest(proxy.getPort(), { host: 'mocked.local', path: '/anything' });
    expect(headers['x-saeng-mock']).toBe('true');
  });

  it('falls through to the backend when mocksEnabled is false, even if a rule would match', async () => {
    backend = await startCountingBackend('from-backend');
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ id: 'm1', domain: 'unmocked.local', host: '127.0.0.1', port: backend.address().port, enabled: true, mocksEnabled: false }],
      { httpsEnabled: false }
    );
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/.*$', statusCode: 200, headers: [], body: 'mocked' },
    ]);

    const { body } = await makeRequest(proxy.getPort(), { host: 'unmocked.local', path: '/anything' });
    expect(body).toBe('from-backend');
    expect(backendHits).toBe(1);
  });

  it('falls through to the backend when no rule matches the path', async () => {
    backend = await startCountingBackend('from-backend');
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ id: 'm1', domain: 'mocked.local', host: '127.0.0.1', port: backend.address().port, enabled: true, mocksEnabled: true }],
      { httpsEnabled: false }
    );
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api/ping$', statusCode: 200, headers: [], body: 'mocked' },
    ]);

    const { body } = await makeRequest(proxy.getPort(), { host: 'mocked.local', path: '/other' });
    expect(body).toBe('from-backend');
    expect(backendHits).toBe(1);
  });

  it('serves the mock only when a body condition matches, otherwise forwards the full untruncated body to the backend', async () => {
    let receivedBody = '';
    backend = await new Promise((resolve) => {
      const server = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          receivedBody = Buffer.concat(chunks).toString('utf8');
          res.end('from-backend');
        });
      });
      server.listen(0, '127.0.0.1', () => resolve(server));
    });
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ id: 'm1', domain: 'bodycond.local', host: '127.0.0.1', port: backend.address().port, enabled: true, mocksEnabled: true }],
      { httpsEnabled: false }
    );
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: 'POST', pathPattern: '^/api$', statusCode: 200, headers: [], body: 'mocked-response', conditions: [{ type: 'body', key: '', operator: 'contains', value: 'special' }] },
    ]);

    const matched = await makeRequest(proxy.getPort(), { method: 'POST', host: 'bodycond.local', path: '/api', body: 'this is a special payload' });
    expect(matched.body).toBe('mocked-response');

    const largeBody = 'x'.repeat(100000);
    const unmatched = await makeRequest(proxy.getPort(), { method: 'POST', host: 'bodycond.local', path: '/api', body: largeBody });
    expect(unmatched.body).toBe('from-backend');
    expect(receivedBody).toBe(largeBody);
  });

  it('marks log entries with mocked: true for mocked responses and mocked: false for proxied responses', async () => {
    backend = await startCountingBackend('from-backend');
    const add = vi.fn();
    proxy = new HttpProxy(null, { add });
    await proxy.start(
      [{ id: 'm1', domain: 'mocked.local', host: '127.0.0.1', port: backend.address().port, enabled: true, mocksEnabled: true }],
      { httpsEnabled: false }
    );
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api/ping$', statusCode: 200, headers: [], body: 'mocked' },
    ]);

    await makeRequest(proxy.getPort(), { host: 'mocked.local', path: '/api/ping' });
    await makeRequest(proxy.getPort(), { host: 'mocked.local', path: '/other' });

    await vi.waitFor(() => expect(add).toHaveBeenCalledTimes(2));
    const [mockedEntry, proxiedEntry] = add.mock.calls.map((call) => call[0]);
    expect(mockedEntry).toMatchObject({ path: '/api/ping', mocked: true });
    expect(proxiedEntry).toMatchObject({ path: '/other', mocked: false });
  });

  it('drains a POST body for a mocked response without hanging the request', async () => {
    backend = await startCountingBackend();
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ id: 'm1', domain: 'mocked.local', host: '127.0.0.1', port: backend.address().port, enabled: true, mocksEnabled: true }],
      { httpsEnabled: false }
    );
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: 'POST', pathPattern: '^/api/echo$', statusCode: 200, headers: [], body: 'mocked' },
    ]);

    const { statusCode, body } = await makeRequest(proxy.getPort(), { host: 'mocked.local', path: '/api/echo', method: 'POST', body: 'request-body' });
    expect(statusCode).toBe(200);
    expect(body).toBe('mocked');
  });

  it('interpolates template placeholders in the mock body', async () => {
    backend = await startCountingBackend();
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ id: 'm1', domain: 'mocked.local', host: '127.0.0.1', port: backend.address().port, enabled: true, mocksEnabled: true }],
      { httpsEnabled: false }
    );
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: 'POST', pathPattern: '^/api/echo$', statusCode: 200, headers: [], body: '{"method":"{{request.method}}","body":"{{request.body}}"}' },
    ]);

    const { body } = await makeRequest(proxy.getPort(), { host: 'mocked.local', path: '/api/echo', method: 'POST', body: 'hello' });
    expect(JSON.parse(body)).toEqual({ method: 'POST', body: 'hello' });
    expect(backendHits).toBe(0);
  });

  it('interpolates regex capture groups via {{match.N}} placeholders', async () => {
    backend = await startCountingBackend();
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ id: 'm1', domain: 'mocked.local', host: '127.0.0.1', port: backend.address().port, enabled: true, mocksEnabled: true }],
      { httpsEnabled: false }
    );
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api/users/(\\d+)$', statusCode: 200, headers: [], body: '{"id":{{match.1}}}' },
    ]);

    const { body } = await makeRequest(proxy.getPort(), { host: 'mocked.local', path: '/api/users/42' });
    expect(JSON.parse(body)).toEqual({ id: 42 });
  });

  it('delays the mocked response by delayMs', async () => {
    backend = await startCountingBackend();
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ id: 'm1', domain: 'mocked.local', host: '127.0.0.1', port: backend.address().port, enabled: true, mocksEnabled: true }],
      { httpsEnabled: false }
    );
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/slow$', statusCode: 200, headers: [], body: 'delayed', delayMs: 200 },
    ]);

    const start = Date.now();
    const { statusCode, body } = await makeRequest(proxy.getPort(), { host: 'mocked.local', path: '/slow' });
    const elapsed = Date.now() - start;
    expect(statusCode).toBe(200);
    expect(body).toBe('delayed');
    expect(elapsed).toBeGreaterThanOrEqual(150);
  });

  it('responds immediately when delayMs is 0', async () => {
    backend = await startCountingBackend();
    proxy = new HttpProxy(null);
    await proxy.start(
      [{ id: 'm1', domain: 'mocked.local', host: '127.0.0.1', port: backend.address().port, enabled: true, mocksEnabled: true }],
      { httpsEnabled: false }
    );
    proxy.updateMocks([
      { mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/fast$', statusCode: 200, headers: [], body: 'instant', delayMs: 0 },
    ]);

    const start = Date.now();
    const { statusCode, body } = await makeRequest(proxy.getPort(), { host: 'mocked.local', path: '/fast' });
    const elapsed = Date.now() - start;
    expect(statusCode).toBe(200);
    expect(body).toBe('instant');
    expect(elapsed).toBeLessThan(150);
  });
});

describe('HttpProxy._handleConnect()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes 502 Bad Gateway and closes the socket for an unmapped hostname', () => {
    const proxy = new HttpProxy(null);
    const socket = makeMockSocket();

    proxy._handleConnect({ url: 'unknown.local:443' }, socket, Buffer.alloc(0));

    expect(writtenText(socket)).toContain('502 Bad Gateway');
    expect(socket.end).toHaveBeenCalled();
  });

  it('opens a raw TCP tunnel when httpsEnabled is false', async () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{ domain: 'myapp.local', port: 3000, host: '10.0.0.1', enabled: true }]);

    const clientSocket = makeMockSocket();
    const serverSocket = makeMockSocket();
    // Defer cb so the source's `const serverSocket = net.connect(...)` is out of TDZ
    // before the callback body references it.
    vi.spyOn(net, 'connect').mockImplementation((port, host, cb) => {
      process.nextTick(cb);
      return serverSocket;
    });

    proxy._handleConnect({ url: 'myapp.local:443' }, clientSocket, Buffer.alloc(0));

    expect(net.connect).toHaveBeenCalledWith(3000, '10.0.0.1', expect.any(Function));
    expect(writtenText(clientSocket)).toContain('200 Connection Established');

    await new Promise((r) => process.nextTick(r));

    expect(serverSocket.pipe).toHaveBeenCalledWith(clientSocket);
    expect(clientSocket.pipe).toHaveBeenCalledWith(serverSocket);
  });

  it('defaults the backend host to 127.0.0.1 when mapping.host is not set', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{ domain: 'myapp.local', port: 3000, enabled: true }]);

    const clientSocket = makeMockSocket();
    const serverSocket = makeMockSocket();
    vi.spyOn(net, 'connect').mockReturnValue(serverSocket); // no cb needed — only checking args

    proxy._handleConnect({ url: 'myapp.local:443' }, clientSocket, Buffer.alloc(0));

    expect(net.connect).toHaveBeenCalledWith(3000, '127.0.0.1', expect.any(Function));
  });

  it('uses the MITM tunnel when httpsEnabled is true and internalHttpsPort is set', async () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{ domain: 'secure.local', port: 8443, host: '127.0.0.1', enabled: true }]);
    proxy.httpsEnabled = true;
    proxy.internalHttpsPort = 12345;

    const clientSocket = makeMockSocket();
    const tunnelSocket = makeMockSocket();
    vi.spyOn(net, 'connect').mockImplementation((port, host, cb) => {
      process.nextTick(cb);
      return tunnelSocket;
    });

    proxy._handleConnect({ url: 'secure.local:443' }, clientSocket, Buffer.alloc(0));

    expect(net.connect).toHaveBeenCalledWith(12345, '127.0.0.1', expect.any(Function));
    expect(writtenText(clientSocket)).toContain('200 Connection Established');

    await new Promise((r) => process.nextTick(r));

    expect(tunnelSocket.pipe).toHaveBeenCalledWith(clientSocket);
    expect(clientSocket.pipe).toHaveBeenCalledWith(tunnelSocket);
  });

  it('forwards head data to the server socket after connecting (raw tunnel)', async () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{ domain: 'myapp.local', port: 3000, enabled: true }]);

    const clientSocket = makeMockSocket();
    const serverSocket = makeMockSocket();
    vi.spyOn(net, 'connect').mockImplementation((port, host, cb) => {
      process.nextTick(cb);
      return serverSocket;
    });

    const head = Buffer.from('initial-data');
    proxy._handleConnect({ url: 'myapp.local:443' }, clientSocket, head);

    await new Promise((r) => process.nextTick(r));

    expect(serverSocket.write).toHaveBeenCalledWith(head);
  });

  it('destroys the client socket when the server socket errors (raw tunnel)', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{ domain: 'myapp.local', port: 3000, enabled: true }]);

    const clientSocket = makeMockSocket();
    const serverSocket = makeMockSocket();
    vi.spyOn(net, 'connect').mockReturnValue(serverSocket);

    proxy._handleConnect({ url: 'myapp.local:443' }, clientSocket, Buffer.alloc(0));
    serverSocket.emit('error', new Error('ECONNREFUSED'));

    expect(clientSocket.destroy).toHaveBeenCalled();
  });

  it('destroys the server socket when the client socket errors (raw tunnel)', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{ domain: 'myapp.local', port: 3000, enabled: true }]);

    const clientSocket = makeMockSocket();
    const serverSocket = makeMockSocket();
    vi.spyOn(net, 'connect').mockReturnValue(serverSocket);

    proxy._handleConnect({ url: 'myapp.local:443' }, clientSocket, Buffer.alloc(0));
    clientSocket.emit('error', new Error('client gone'));

    expect(serverSocket.destroy).toHaveBeenCalled();
  });
});

describe('HttpProxy._handleWebSocketUpgrade()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('closes the socket immediately for an unmapped hostname', () => {
    const proxy = new HttpProxy(null);
    const socket = makeMockSocket();

    proxy._handleWebSocketUpgrade(
      { headers: { host: 'unknown.local' }, method: 'GET', url: '/', httpVersion: '1.1' },
      socket,
      Buffer.alloc(0)
    );

    expect(socket.end).toHaveBeenCalled();
  });

  it('connects to the backend and replays the HTTP upgrade request', async () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{
      domain: 'ws.local', port: 9000, host: '127.0.0.1', enabled: true, requestHeaders: [],
    }]);

    const clientSocket = makeMockSocket();
    const serverSocket = makeMockSocket();
    vi.spyOn(net, 'connect').mockImplementation((port, host, cb) => {
      process.nextTick(cb);
      return serverSocket;
    });

    proxy._handleWebSocketUpgrade(
      {
        headers: { host: 'ws.local', connection: 'Upgrade', upgrade: 'websocket' },
        method: 'GET',
        url: '/chat',
        httpVersion: '1.1',
      },
      clientSocket,
      Buffer.alloc(0)
    );

    expect(net.connect).toHaveBeenCalledWith(9000, '127.0.0.1', expect.any(Function));

    await new Promise((r) => process.nextTick(r));

    const sent = writtenText(serverSocket);
    expect(sent).toContain('GET /chat HTTP/1.1');
    expect(sent).toContain('upgrade: websocket');
    expect(serverSocket.pipe).toHaveBeenCalledWith(clientSocket);
    expect(clientSocket.pipe).toHaveBeenCalledWith(serverSocket);
  });

  it('applies mapping.requestHeaders overrides when replaying the upgrade', async () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{
      domain: 'ws.local', port: 9000, host: '127.0.0.1', enabled: true,
      requestHeaders: [{ name: 'X-Forwarded-Proto', value: 'wss' }],
    }]);

    const clientSocket = makeMockSocket();
    const serverSocket = makeMockSocket();
    vi.spyOn(net, 'connect').mockImplementation((port, host, cb) => {
      process.nextTick(cb);
      return serverSocket;
    });

    proxy._handleWebSocketUpgrade(
      { headers: { host: 'ws.local' }, method: 'GET', url: '/', httpVersion: '1.1' },
      clientSocket,
      Buffer.alloc(0)
    );

    await new Promise((r) => process.nextTick(r));

    expect(writtenText(serverSocket)).toContain('x-forwarded-proto: wss');
  });

  it('rewrites req.url when replaying the WebSocket upgrade request line', async () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{
      domain: 'ws.local', port: 9000, host: '127.0.0.1', enabled: true,
      pathRewriteFrom: '/ws/v1', pathRewriteTo: '/socket',
    }]);

    const clientSocket = makeMockSocket();
    const serverSocket = makeMockSocket();
    vi.spyOn(net, 'connect').mockImplementation((port, host, cb) => {
      process.nextTick(cb);
      return serverSocket;
    });

    proxy._handleWebSocketUpgrade(
      { headers: { host: 'ws.local' }, method: 'GET', url: '/ws/v1/chat', httpVersion: '1.1' },
      clientSocket,
      Buffer.alloc(0)
    );

    await new Promise((r) => process.nextTick(r));

    expect(writtenText(serverSocket)).toContain('GET /socket/chat HTTP/1.1');
  });

  it('does not rewrite the WebSocket upgrade path when pathRewriteFrom is empty', async () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{
      domain: 'ws.local', port: 9000, host: '127.0.0.1', enabled: true,
    }]);

    const clientSocket = makeMockSocket();
    const serverSocket = makeMockSocket();
    vi.spyOn(net, 'connect').mockImplementation((port, host, cb) => {
      process.nextTick(cb);
      return serverSocket;
    });

    proxy._handleWebSocketUpgrade(
      { headers: { host: 'ws.local' }, method: 'GET', url: '/chat', httpVersion: '1.1' },
      clientSocket,
      Buffer.alloc(0)
    );

    await new Promise((r) => process.nextTick(r));

    expect(writtenText(serverSocket)).toContain('GET /chat HTTP/1.1');
  });

  it('forwards head data to the server socket after connecting', async () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{
      domain: 'ws.local', port: 9000, host: '127.0.0.1', enabled: true, requestHeaders: [],
    }]);

    const clientSocket = makeMockSocket();
    const serverSocket = makeMockSocket();
    vi.spyOn(net, 'connect').mockImplementation((port, host, cb) => {
      process.nextTick(cb);
      return serverSocket;
    });

    const head = Buffer.from('ws-head');
    proxy._handleWebSocketUpgrade(
      { headers: { host: 'ws.local' }, method: 'GET', url: '/', httpVersion: '1.1' },
      clientSocket,
      head
    );

    await new Promise((r) => process.nextTick(r));

    expect(serverSocket.write).toHaveBeenCalledWith(head);
  });

  it('destroys the client socket when the server socket errors', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{
      domain: 'ws.local', port: 9000, enabled: true, requestHeaders: [],
    }]);

    const clientSocket = makeMockSocket();
    const serverSocket = makeMockSocket();
    vi.spyOn(net, 'connect').mockReturnValue(serverSocket);

    proxy._handleWebSocketUpgrade(
      { headers: { host: 'ws.local' }, method: 'GET', url: '/', httpVersion: '1.1' },
      clientSocket,
      Buffer.alloc(0)
    );
    serverSocket.emit('error', new Error('backend gone'));

    expect(clientSocket.destroy).toHaveBeenCalled();
  });

  it('destroys the server socket when the client socket errors', () => {
    const proxy = new HttpProxy(null);
    proxy.updateMappings([{
      domain: 'ws.local', port: 9000, enabled: true, requestHeaders: [],
    }]);

    const clientSocket = makeMockSocket();
    const serverSocket = makeMockSocket();
    vi.spyOn(net, 'connect').mockReturnValue(serverSocket);

    proxy._handleWebSocketUpgrade(
      { headers: { host: 'ws.local' }, method: 'GET', url: '/', httpVersion: '1.1' },
      clientSocket,
      Buffer.alloc(0)
    );
    clientSocket.emit('error', new Error('client gone'));

    expect(serverSocket.destroy).toHaveBeenCalled();
  });
});
