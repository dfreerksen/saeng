import { useState, useRef, useEffect } from 'react';
import Modal from './Modal.jsx';
import { validateDomainPart, splitDomain, DOMAIN_SUFFIXES, DEFAULT_SUFFIX } from '../js/utils.js';

export default function MappingModal({ mapping, mappings, onClose, onSubmit, t }) {
  const isEditing = !!mapping;
  const parsed = mapping ? splitDomain(mapping.domain) : { subdomain: '', domain: '', suffix: DEFAULT_SUFFIX };

  const [subdomain, setSubdomain] = useState(parsed.subdomain);
  const [domain, setDomain] = useState(parsed.domain);
  const [suffix, setSuffix] = useState(parsed.suffix);
  const [host, setHost] = useState(mapping?.host ?? '127.0.0.1');
  const [port, setPort] = useState(mapping?.port ?? 3000);
  const [https, setHttps] = useState(!!mapping?.https);
  const [label, setLabel] = useState(mapping?.label ?? '');
  const [domainError, setDomainError] = useState('');
  const [portError, setPortError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const domainInputRef = useRef(null);

  useEffect(() => {
    domainInputRef.current?.focus();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setDomainError('');
    setPortError('');

    const trimDomain = domain.trim();
    const trimSubdomain = subdomain.trim();
    const parsedPort = parseInt(String(port).trim(), 10);

    let valid = true;

    if (!trimDomain || !validateDomainPart(trimDomain)) {
      setDomainError(t('form.domainErrorInvalid'));
      valid = false;
    } else if (trimSubdomain && !validateDomainPart(trimSubdomain)) {
      setDomainError(t('form.subdomainError'));
      valid = false;
    }

    if (!parsedPort || parsedPort < 1 || parsedPort > 65535 || isNaN(parsedPort)) {
      setPortError(t('form.portError'));
      valid = false;
    }

    if (!valid) return;

    const fullDomain = trimSubdomain
      ? `${trimSubdomain}.${trimDomain}${suffix}`
      : `${trimDomain}${suffix}`;

    if (mappings.some((m) => m.domain === fullDomain && m.id !== mapping?.id)) {
      setDomainError(t('form.domainErrorDuplicate', { domain: fullDomain }));
      return;
    }

    setSubmitting(true);
    await onSubmit({ domain: fullDomain, host: host.trim() || '127.0.0.1', port: parsedPort, https, label: label.trim() });
    setSubmitting(false);
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h1 className="modal-title fs-5">
              {isEditing ? t('modal.editTitle') : t('modal.addTitle')}
            </h1>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label">
                  <span>{t('form.domain')}</span>
                  <span style={{ color: 'var(--saeng-text-muted)' }}>{t('form.required')}</span>
                </label>
                <div className="domain-row">
                  <input
                    className="form-input"
                    placeholder={t('form.subdomainPlaceholder')}
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <span className="domain-sep">.</span>
                  <input
                    ref={domainInputRef}
                    className="form-input"
                    placeholder={t('form.domainPlaceholder')}
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    required
                    style={{ flex: 1.5, minWidth: 0 }}
                  />
                  <select
                    className="domain-suffix-select"
                    value={suffix}
                    onChange={(e) => setSuffix(e.target.value)}
                    autoComplete="off"
                  >
                    {DOMAIN_SUFFIXES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-hint">{t('form.domainHint')}</div>
                {domainError && <div className="form-error visible">{domainError}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>{t('form.host')}</span>
                  <span style={{ color: 'var(--saeng-text-muted)' }}>{t('form.optional')}</span>
                </label>
                <input
                  className="form-input"
                  placeholder="127.0.0.1"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className="form-hint">{t('form.hostHint')}</div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>{t('form.port')}</span>
                  <span style={{ color: 'var(--saeng-text-muted)' }}>{t('form.required')}</span>
                </label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  max="65535"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  autoComplete="off"
                  required
                />
                <div className="form-hint">{t('form.portHint')}</div>
                {portError && <div className="form-error visible">{portError}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>{t('form.label')}</span>
                  <span style={{ color: 'var(--saeng-text-muted)' }}>{t('form.optional')}</span>
                </label>
                <input
                  className="form-input"
                  placeholder={t('form.labelPlaceholder')}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  autoComplete="off"
                  maxLength={60}
                />
              </div>

              <div className="form-group">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={https}
                    onChange={(e) => setHttps(e.target.checked)}
                  />
                  <span>{t('form.httpsLabel')}</span>
                </label>
                <div className="form-hint" style={{ marginTop: 6 }}>{t('form.httpsHint')}</div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  {t('modal.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {isEditing ? t('modal.editSubmit') : t('modal.addSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Modal>
  );
}
