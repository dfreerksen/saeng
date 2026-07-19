import forge from 'node-forge';
import fs from 'fs';
import path from 'path';
import { randomBytes, generateKeyPair } from 'crypto';
import { promisify } from 'util';

const generateKeyPairAsync = promisify(generateKeyPair);

const CA_LIFETIME_YEARS = 10;

// Generates a 2048-bit RSA keypair with node:crypto (native OpenSSL on the
// libuv threadpool — off the main thread) and converts the result to
// node-forge key objects for cert building/signing. node-forge's own
// generateKeyPair is pure JS and blocks the event loop for seconds per key.
async function generateForgeKeyPair() {
  const { privateKey } = await generateKeyPairAsync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  const forgePrivateKey = forge.pki.privateKeyFromPem(privateKey);
  const forgePublicKey = forge.pki.setRsaPublicKey(forgePrivateKey.n, forgePrivateKey.e);
  return { privateKey: forgePrivateKey, publicKey: forgePublicKey };
}

class CertManager {
  static instance = null;

  constructor(certDir) {
    this.certDir = certDir;
    this.cache = new Map();
    // hostname -> in-flight generation promise, so concurrent TLS connections
    // for the same domain share one keygen instead of racing.
    this.pending = new Map();
    this.ca = null;
    this.caKey = null;
    this.caPromise = null;

    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    // Loading an existing CA from disk is cheap; generation is deferred to
    // ensureCA() so constructing the manager never blocks on keygen.
    this._loadCA();
  }

  static getInstance(certDir) {
    if (!CertManager.instance) {
      CertManager.instance = new CertManager(certDir);
    }
    return CertManager.instance;
  }

  // Loads the CA cert + key from disk if both files exist. Returns whether
  // a CA is now loaded.
  _loadCA() {
    const caPath = path.join(this.certDir, 'ca.crt');
    const caKeyPath = path.join(this.certDir, 'ca.key');

    if (fs.existsSync(caPath) && fs.existsSync(caKeyPath)) {
      this.ca = forge.pki.certificateFromPem(fs.readFileSync(caPath, 'utf8'));
      this.caKey = forge.pki.privateKeyFromPem(fs.readFileSync(caKeyPath, 'utf8'));
      return true;
    }
    return false;
  }

  // Ensures the root CA is loaded, creating it (off the main thread) if it
  // doesn't exist yet. Concurrent callers share one in-flight promise.
  async ensureCA() {
    if (this.ca && this.caKey) return;
    if (!this.caPromise) {
      this.caPromise = this._createCA().finally(() => {
        this.caPromise = null;
      });
    }
    return this.caPromise;
  }

  async _createCA() {
    if (this._loadCA()) return;

    const keys = await generateForgeKeyPair();
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + CA_LIFETIME_YEARS);

    const attrs = [
      { name: 'commonName', value: 'Saeng Local Proxy CA' },
      { name: 'organizationName', value: 'Saeng' },
      { shortName: 'C', value: 'US' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
      { name: 'basicConstraints', cA: true, critical: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
      { name: 'subjectKeyIdentifier' },
    ]);

    cert.sign(keys.privateKey, forge.md.sha256.create());

    fs.writeFileSync(path.join(this.certDir, 'ca.crt'), forge.pki.certificateToPem(cert));
    // Private key is MITM signing material — owner read/write only.
    fs.writeFileSync(path.join(this.certDir, 'ca.key'), forge.pki.privateKeyToPem(keys.privateKey), { mode: 0o600 });

    this.ca = cert;
    this.caKey = keys.privateKey;
  }

  // Returns { cert, key } PEMs for a hostname, generating a leaf cert on
  // first use. Async because leaf keygen runs off the main thread.
  async getCert(hostname) {
    if (this.cache.has(hostname)) {
      return this.cache.get(hostname);
    }

    if (this.pending.has(hostname)) {
      return this.pending.get(hostname);
    }

    const certPath = path.join(this.certDir, `${hostname}.crt`);
    const keyPath = path.join(this.certDir, `${hostname}.key`);

    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      const result = {
        cert: fs.readFileSync(certPath, 'utf8'),
        key: fs.readFileSync(keyPath, 'utf8'),
      };
      this.cache.set(hostname, result);
      return result;
    }

    const promise = this._generateCert(hostname).finally(() => {
      this.pending.delete(hostname);
    });
    this.pending.set(hostname, promise);
    return promise;
  }

  async _generateCert(hostname) {
    await this.ensureCA();

    const keys = await generateForgeKeyPair();
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = randomBytes(16).toString('hex');
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

    cert.setSubject([
      { name: 'commonName', value: hostname },
      { name: 'organizationName', value: 'Saeng' },
    ]);
    cert.setIssuer(this.ca.subject.attributes);
    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: [{ type: 2, value: hostname }],
      },
      { name: 'authorityKeyIdentifier' },
    ]);

    cert.sign(this.caKey, forge.md.sha256.create());

    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

    fs.writeFileSync(path.join(this.certDir, `${hostname}.crt`), certPem);
    fs.writeFileSync(path.join(this.certDir, `${hostname}.key`), keyPem, { mode: 0o600 });

    const result = { cert: certPem, key: keyPem };
    this.cache.set(hostname, result);
    return result;
  }

  purgeCert(hostname) {
    this.cache.delete(hostname);
    const certPath = path.join(this.certDir, `${hostname}.crt`);
    const keyPath = path.join(this.certDir, `${hostname}.key`);
    if (fs.existsSync(certPath)) fs.unlinkSync(certPath);
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
  }

  deleteCA() {
    for (const file of fs.readdirSync(this.certDir)) {
      if (file.endsWith('.crt') || file.endsWith('.key')) {
        fs.unlinkSync(path.join(this.certDir, file));
      }
    }
    this.cache.clear();
    this.ca = null;
    this.caKey = null;
  }

  async regenerateCA() {
    // Delete the CA and all per-domain certs (they were signed by the old CA)
    this.deleteCA();
    await this.ensureCA();
    return this.getCAExpiry();
  }

  // Null when no CA is currently loaded (e.g. after deleteCA()).
  getCAExpiry() {
    return this.ca ? this.ca.validity.notAfter.toISOString() : null;
  }

  getCAPath() {
    return path.join(this.certDir, 'ca.crt');
  }

  getCACertPem() {
    return fs.readFileSync(this.getCAPath(), 'utf8');
  }
}

export { CertManager };
