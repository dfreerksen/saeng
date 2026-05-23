import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CertManager } from '../../src/proxy/certManager.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

// RSA key generation is CPU-bound (~2-5 s per keypair). We share one CertManager
// across the whole suite to keep total runtime reasonable.
let certDir;
let manager;

beforeAll(() => {
  certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saeng-cert-test-'));
  CertManager.instance = null;
  manager = CertManager.getInstance(certDir); // generates CA keypair
}, 30_000);

afterAll(() => {
  CertManager.instance = null;
  fs.rmSync(certDir, { recursive: true, force: true });
});

describe('CertManager CA bootstrap', () => {
  it('writes ca.crt and ca.key to certDir on first instantiation', () => {
    expect(fs.existsSync(path.join(certDir, 'ca.crt'))).toBe(true);
    expect(fs.existsSync(path.join(certDir, 'ca.key'))).toBe(true);
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
    // Create a fresh instance pointing at the same certDir — it should
    // read the existing files rather than overwrite them.
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

  it('returns an object with cert and key PEM strings', () => {
    const result = manager.getCert(HOST);
    expect(result.cert).toMatch(/^-----BEGIN CERTIFICATE-----/);
    expect(result.key).toMatch(/^-----BEGIN RSA PRIVATE KEY-----/);
  }, 30_000);

  it('persists the cert and key to disk', () => {
    expect(fs.existsSync(path.join(certDir, `${HOST}.crt`))).toBe(true);
    expect(fs.existsSync(path.join(certDir, `${HOST}.key`))).toBe(true);
  });

  it('returns the same object reference on a second call (in-memory cache)', () => {
    const first = manager.getCert(HOST);
    const second = manager.getCert(HOST);
    expect(second).toBe(first);
  });
});

describe('CertManager.purgeCert()', () => {
  const HOST = 'purgeable.local';

  beforeAll(async () => {
    manager.getCert(HOST); // populate cache + disk
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
