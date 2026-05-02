const forge = require('node-forge');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class CertManager {
  static instance = null;

  constructor(certDir) {
    this.certDir = certDir;
    this.cache = new Map();
    this.ca = null;
    this.caKey = null;

    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    this._loadOrCreateCA();
  }

  static getInstance(certDir) {
    if (!CertManager.instance) {
      CertManager.instance = new CertManager(certDir);
    }
    return CertManager.instance;
  }

  _loadOrCreateCA() {
    const caPath = path.join(this.certDir, 'ca.crt');
    const caKeyPath = path.join(this.certDir, 'ca.key');

    if (fs.existsSync(caPath) && fs.existsSync(caKeyPath)) {
      this.ca = forge.pki.certificateFromPem(fs.readFileSync(caPath, 'utf8'));
      this.caKey = forge.pki.privateKeyFromPem(fs.readFileSync(caKeyPath, 'utf8'));
      return;
    }

    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

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

    fs.writeFileSync(caPath, forge.pki.certificateToPem(cert));
    fs.writeFileSync(caKeyPath, forge.pki.privateKeyToPem(keys.privateKey));

    this.ca = cert;
    this.caKey = keys.privateKey;
  }

  getCert(hostname) {
    if (this.cache.has(hostname)) {
      return this.cache.get(hostname);
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

    return this._generateCert(hostname);
  }

  _generateCert(hostname) {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = crypto.randomBytes(16).toString('hex');
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
    fs.writeFileSync(path.join(this.certDir, `${hostname}.key`), keyPem);

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

  getCAPath() {
    return path.join(this.certDir, 'ca.crt');
  }

  getCACertPem() {
    return fs.readFileSync(this.getCAPath(), 'utf8');
  }
}

module.exports = { CertManager };
