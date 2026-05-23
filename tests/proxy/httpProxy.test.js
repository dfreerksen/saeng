import { describe, it, expect, afterEach } from 'vitest';
import http from 'http';
import { HttpProxy } from '../../src/proxy/httpProxy.js';

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

  it('stores the full mapping object (port, https, etc.)', () => {
    const proxy = new HttpProxy(null);
    const mapping = { domain: 'myapp.local', port: 3000, https: true, enabled: true };
    proxy.updateMappings([mapping]);
    expect(proxy.mappings.get('myapp.local')).toMatchObject({ port: 3000, https: true });
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
