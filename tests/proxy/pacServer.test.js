import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { PacServer } from '../../src/proxy/pacServer.js';

describe('PacServer._generatePAC()', () => {
  let server;

  beforeEach(() => {
    server = new PacServer(0);
    server.proxyPort = 9999;
  });

  it('returns DIRECT when there are no mappings', () => {
    const pac = server._generatePAC();
    expect(pac).toContain('return "DIRECT"');
    expect(pac).not.toContain('PROXY');
  });

  it('returns DIRECT when all mappings are disabled', () => {
    server.mappings = [
      { domain: 'myapp.local', enabled: false },
      { domain: 'api.local', enabled: false },
    ];
    const pac = server._generatePAC();
    expect(pac).toContain('return "DIRECT"');
    expect(pac).not.toContain('PROXY');
  });

  it('includes PROXY directive for a single enabled domain', () => {
    server.mappings = [{ domain: 'myapp.local', enabled: true }];
    const pac = server._generatePAC();
    expect(pac).toContain('host === "myapp.local"');
    expect(pac).toContain('PROXY 127.0.0.1:9999');
  });

  it('includes all enabled domains and skips disabled ones', () => {
    server.mappings = [
      { domain: 'myapp.local', enabled: true },
      { domain: 'skipped.local', enabled: false },
      { domain: 'api.local', enabled: true },
    ];
    const pac = server._generatePAC();
    expect(pac).toContain('host === "myapp.local"');
    expect(pac).toContain('host === "api.local"');
    expect(pac).not.toContain('skipped.local');
  });

  it('uses exact hostname equality (no wildcards)', () => {
    server.mappings = [{ domain: 'myapp.local', enabled: true }];
    const pac = server._generatePAC();
    expect(pac).toMatch(/host === "myapp\.local"/);
    expect(pac).not.toContain('shExpMatch');
    expect(pac).not.toContain('*');
  });

  it('reflects the current proxyPort in the PAC output', () => {
    server.proxyPort = 54321;
    server.mappings = [{ domain: 'myapp.local', enabled: true }];
    const pac = server._generatePAC();
    expect(pac).toContain('PROXY 127.0.0.1:54321');
  });
});

describe('PacServer HTTP server', () => {
  let server;

  afterEach(async () => {
    await server?.stop();
  });

  it('serves the PAC file at /proxy.pac', async () => {
    server = new PacServer(0);
    server.mappings = [{ domain: 'myapp.local', enabled: true }];
    await server.start(9999);

    const { port } = server.server.address();
    const body = await fetch(`http://127.0.0.1:${port}/proxy.pac`).then((r) => r.text());

    expect(body).toContain('FindProxyForURL');
    expect(body).toContain('myapp.local');
  });

  it('returns 404 for unknown paths', async () => {
    server = new PacServer(0);
    await server.start(9999);

    const { port } = server.server.address();
    const res = await fetch(`http://127.0.0.1:${port}/other`);

    expect(res.status).toBe(404);
  });

  it('sets the correct Content-Type for /proxy.pac', async () => {
    server = new PacServer(0);
    await server.start(9999);

    const { port } = server.server.address();
    const res = await fetch(`http://127.0.0.1:${port}/proxy.pac`);

    expect(res.headers.get('content-type')).toBe('application/x-ns-proxy-autoconfig');
  });

  it('stop() closes the server and clears the reference', async () => {
    server = new PacServer(0);
    await server.start(9999);
    expect(server.server).not.toBeNull();

    await server.stop();
    expect(server.server).toBeNull();
  });

  it('stop() resolves cleanly when the server was never started', async () => {
    server = new PacServer(0);
    await expect(server.stop()).resolves.toBeUndefined();
  });

  it('updateMappings() is reflected in subsequent PAC responses', async () => {
    server = new PacServer(0);
    await server.start(9999);
    const { port } = server.server.address();

    server.updateMappings([{ domain: 'newapp.local', enabled: true }]);
    const body = await fetch(`http://127.0.0.1:${port}/proxy.pac`).then((r) => r.text());

    expect(body).toContain('newapp.local');
  });
});
