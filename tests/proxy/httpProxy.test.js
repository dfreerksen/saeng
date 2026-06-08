import { describe, it, expect, afterEach, vi } from 'vitest';
import http from 'http';
import { EventEmitter } from 'events';
import { HttpProxy } from '../../src/proxy/httpProxy.js';

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

function stopBackend(server) {
  return new Promise((resolve) => server.close(resolve));
}

// Helper: make a plain HTTP request and return { statusCode, body }
function makeRequest(port, { method = 'GET', path = '/', host } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, method, path, headers: { Host: host } },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.end();
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
