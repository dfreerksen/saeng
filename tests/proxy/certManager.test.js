import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CertManager } from '../../src/proxy/certManager.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

// We share one CertManager across the whole suite so the CA is only
// generated once (keygen runs via node:crypto but still costs real time).
let certDir;
let manager;

beforeAll(async () => {
  certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saeng-cert-test-'));
  CertManager.instance = null;
  manager = CertManager.getInstance(certDir);
  await manager.ensureCA(); // generates the CA keypair
}, 30_000);

afterAll(() => {
  CertManager.instance = null;
  fs.rmSync(certDir, { recursive: true, force: true });
});

describe('CertManager CA bootstrap', () => {
  it('writes ca.crt and ca.key to certDir once ensureCA() resolves', () => {
    expect(fs.existsSync(path.join(certDir, 'ca.crt'))).toBe(true);
    expect(fs.existsSync(path.join(certDir, 'ca.key'))).toBe(true);
  });

  it('ensureCA() is idempotent and shares one in-flight generation', async () => {
    // Already generated — resolves immediately without touching the files.
    const before = fs.statSync(path.join(certDir, 'ca.crt')).mtimeMs;
    await Promise.all([manager.ensureCA(), manager.ensureCA()]);
    expect(fs.statSync(path.join(certDir, 'ca.crt')).mtimeMs).toBe(before);
  });

  it('getCAPath() points to the ca.crt file', () => {
    expect(manager.getCAPath()).toBe(path.join(certDir, 'ca.crt'));
  });

  it('getCACertPem() returns a PEM-formatted certificate', () => {
    const pem = manager.getCACertPem();
    expect(pem).toMatch(/^-----BEGIN CERTIFICATE-----/);
    expect(pem).toContain('-----END CERTIFICATE-----');
  });

  it('getCAExpiry() returns an ISO 8601 date string in the future', () => {
    const expiry = manager.getCAExpiry();
    expect(() => new Date(expiry)).not.toThrow();
    expect(new Date(expiry).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('CertManager singleton', () => {
  it('getInstance() returns the same instance when called again', () => {
    const second = CertManager.getInstance(certDir);
    expect(second).toBe(manager);
  });

  it('loads existing CA from disk instead of regenerating', () => {
    // Create a fresh instance pointing at the same certDir — the constructor
    // should read the existing files (no ensureCA() needed) rather than
    // overwrite them.
    CertManager.instance = null;
    const reloaded = CertManager.getInstance(certDir);
    // PEM/ASN.1 time format has only second precision, so compare at that granularity
    const toSec = (iso) => Math.floor(new Date(iso).getTime() / 1000);
    expect(toSec(reloaded.getCAExpiry())).toBe(toSec(manager.getCAExpiry()));
    // Restore the shared manager for subsequent tests
    CertManager.instance = manager;
  });
});

describe('CertManager.getCert()', () => {
  const HOST = 'test-host.local';

  it('returns an object with cert and key PEM strings', async () => {
    const result = await manager.getCert(HOST);
    expect(result.cert).toMatch(/^-----BEGIN CERTIFICATE-----/);
    expect(result.key).toMatch(/^-----BEGIN RSA PRIVATE KEY-----/);
  }, 30_000);

  it('persists the cert and key to disk', () => {
    expect(fs.existsSync(path.join(certDir, `${HOST}.crt`))).toBe(true);
    expect(fs.existsSync(path.join(certDir, `${HOST}.key`))).toBe(true);
  });

  it('returns the same object reference on a second call (in-memory cache)', async () => {
    const first = await manager.getCert(HOST);
    const second = await manager.getCert(HOST);
    expect(second).toBe(first);
  });

  it('deduplicates concurrent requests for the same hostname', async () => {
    const [a, b] = await Promise.all([
      manager.getCert('concurrent.local'),
      manager.getCert('concurrent.local'),
    ]);
    expect(b).toBe(a);
  }, 30_000);
});

describe('CertManager.purgeCert()', () => {
  const HOST = 'purgeable.local';

  beforeAll(async () => {
    await manager.getCert(HOST); // populate cache + disk
  }, 30_000);

  it('removes the hostname from the in-memory cache', () => {
    manager.purgeCert(HOST);
    expect(manager.cache.has(HOST)).toBe(false);
  });

  it('deletes the .crt and .key files from disk', () => {
    expect(fs.existsSync(path.join(certDir, `${HOST}.crt`))).toBe(false);
    expect(fs.existsSync(path.join(certDir, `${HOST}.key`))).toBe(false);
  });

  it('is safe to call on a hostname that was never generated', () => {
    expect(() => manager.purgeCert('never-existed.local')).not.toThrow();
  });
});

// Runs last: deletes and then recreates the shared CA.
describe('CertManager.deleteCA() / regenerateCA()', () => {
  it('getCAExpiry() returns null after the CA is deleted', () => {
    manager.deleteCA();
    expect(manager.getCAExpiry()).toBeNull();
  });

  it('ensureCA() recreates the CA after deletion', async () => {
    await manager.ensureCA();
    expect(manager.getCAExpiry()).not.toBeNull();
    expect(fs.existsSync(path.join(certDir, 'ca.crt'))).toBe(true);
  }, 30_000);

  it('regenerateCA() replaces the CA and returns the new expiry', async () => {
    const oldPem = manager.getCACertPem();
    const expiry = await manager.regenerateCA();
    expect(expiry).not.toBeNull();
    expect(new Date(expiry).getTime()).toBeGreaterThan(Date.now());
    expect(manager.getCACertPem()).not.toBe(oldPem);
  }, 30_000);
});
