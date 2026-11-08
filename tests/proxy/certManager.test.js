import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { CertManager } from '../../src/proxy/certManager.js';
import forge from 'node-forge';
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

describe('CertManager leaf certificates', () => {
  const HOST = 'leaf-check.local';
  let leaf;

  beforeAll(async () => {
    leaf = forge.pki.certificateFromPem((await manager.getCert(HOST)).cert);
  }, 30_000);

  // Raw DER of an extension's value, as a hex string
  const extensionHex = (cert, name) => forge.util.bytesToHex(cert.getExtension(name).value);

  it('is signed by the CA', () => {
    expect(manager.ca.verify(leaf)).toBe(true);
  });

  it("names the CA's key in its Authority Key Identifier", () => {
    const caKeyId = manager.ca.getExtension('subjectKeyIdentifier').subjectKeyIdentifier;

    // SEQUENCE { [0] keyIdentifier }, not an empty SEQUENCE (3000)
    expect(extensionHex(leaf, 'authorityKeyIdentifier')).toBe(`30168014${caKeyId}`);
  });

  it('has its own Subject Key Identifier', () => {
    expect(leaf.getExtension('subjectKeyIdentifier')).toBeTruthy();
  });

  it('has a positive serial number', () => {
    expect(parseInt(leaf.serialNumber.slice(0, 2), 16)).toBeLessThan(0x80);
  });

  it('gives the CA a random serial number, not 01', () => {
    expect(manager.ca.serialNumber).not.toBe('01');
    expect(manager.ca.serialNumber).toHaveLength(32);
  });
});

describe('CertManager saved leaf certificates', () => {
  const HOST = 'saved-leaf.local';
  const certPath = () => path.join(certDir, `${HOST}.crt`);
  const keyPath = () => path.join(certDir, `${HOST}.key`);

  // Writes a leaf for HOST, signed by the CA but with extensions of our choosing, as an older Saeng saved them
  function writeLeaf(extensions) {
    const keys = forge.pki.rsa.generateKeyPair(1024);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date(Date.now() + 86_400_000);
    cert.setSubject([ { name: 'commonName', value: HOST } ]);
    cert.setIssuer(manager.ca.subject.attributes);
    cert.setExtensions(extensions);
    cert.sign(manager.caKey, forge.md.sha256.create());
    fs.writeFileSync(certPath(), forge.pki.certificateToPem(cert));
    fs.writeFileSync(keyPath(), forge.pki.privateKeyToPem(keys.privateKey));
    return forge.pki.certificateToPem(cert);
  }

  beforeEach(() => manager.purgeCert(HOST));

  it('keeps a saved leaf that names the current CA', async () => {
    const caKeyId = forge.util.hexToBytes(manager.ca.getExtension('subjectKeyIdentifier').subjectKeyIdentifier);
    const saved = writeLeaf([ { name: 'authorityKeyIdentifier', keyIdentifier: caKeyId } ]);

    expect((await manager.getCert(HOST)).cert).toBe(saved);
  }, 30_000);

  it('replaces a saved leaf with an empty Authority Key Identifier', async () => {
    const saved = writeLeaf([ { name: 'authorityKeyIdentifier' } ]);
    const result = await manager.getCert(HOST);

    expect(result.cert).not.toBe(saved);
    expect(fs.readFileSync(certPath(), 'utf8')).toBe(result.cert);
  }, 30_000);

  it('replaces a saved leaf signed by another CA', async () => {
    const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saeng-cert-other-'));
    const other = new CertManager(otherDir);
    await other.ensureCA();
    const foreign = await other.getCert(HOST);
    fs.writeFileSync(certPath(), foreign.cert);
    fs.writeFileSync(keyPath(), foreign.key);

    expect((await manager.getCert(HOST)).cert).not.toBe(foreign.cert);
    fs.rmSync(otherDir, { recursive: true, force: true });
  }, 30_000);

  it('replaces a saved leaf that isn\'t a certificate', async () => {
    fs.writeFileSync(certPath(), 'not a certificate');
    fs.writeFileSync(keyPath(), 'not a key');

    expect((await manager.getCert(HOST)).cert).toMatch(/^-----BEGIN CERTIFICATE-----/);
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
