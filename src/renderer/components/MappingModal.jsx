import { useState, useRef, useEffect } from 'react';
import Modal from './Modal.jsx';
import HeaderListEditor from './HeaderListEditor.jsx';
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
  const [mocksEnabled, setMocksEnabled] = useState(!!mapping?.mocksEnabled);
  const [requestHeaders, setRequestHeaders] = useState(mapping?.requestHeaders ?? []);
  const [responseHeaders, setResponseHeaders] = useState(mapping?.responseHeaders ?? []);
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
      setDomainError(t('mappings.modals.manage.form.domain.error.invalid'));
      valid = false;
    } else if (trimSubdomain && trimSubdomain !== '*' && !validateDomainPart(trimSubdomain)) {
      setDomainError(t('mappings.modals.manage.form.subdomain.error'));
      valid = false;
    }

    if (!parsedPort || parsedPort < 1 || parsedPort > 65535 || isNaN(parsedPort)) {
      setPortError(t('mappings.modals.manage.form.port.error'));
      valid = false;
    }

    if (!valid) return;

    const fullDomain = trimSubdomain
      ? `${trimSubdomain}.${trimDomain}${suffix}`
      : `${trimDomain}${suffix}`;

    if (mappings.some((m) => m.domain === fullDomain && m.id !== mapping?.id)) {
      setDomainError(t('mappings.modals.manage.form.domain.error.duplicate', { domain: fullDomain }));
      return;
    }

    setSubmitting(true);
    await onSubmit({
      domain: fullDomain,
      host: host.trim() || '127.0.0.1',
      port: parsedPort,
      https,
      mocksEnabled,
      requestHeaders,
      responseHeaders,
    });
    setSubmitting(false);
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h1 className="modal-title fs-5">
              {isEditing ? t('mappings.modals.manage.editTitle') : t('mappings.modals.manage.addTitle')}
            </h1>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label">
                  <span>{t('mappings.modals.manage.form.domain.label')}</span>
                  <span style={{ color: 'var(--saeng-text-muted)' }}>{t('mappings.modals.manage.form.required')}</span>
                </label>
                <div className="domain-row">
                  <input
                    className="form-input"
                    placeholder={t('mappings.modals.manage.form.subdomain.placeholder')}
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                    autoComplete="off"
                    spellCheck={false}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <span className="domain-sep">.</span>
                  <input
                    ref={domainInputRef}
                    className="form-input"
                    placeholder={t('mappings.modals.manage.form.domain.placeholder')}
                    value={domain}
                    onChange={(e) => setDomain(e.target.value.toLowerCase())}
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
                <div className="form-hint">{t('mappings.modals.manage.form.domain.hint')}</div>
                {domainError && <div className="form-error visible">{domainError}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>{t('mappings.modals.manage.form.host.label')}</span>
                  <span style={{ color: 'var(--saeng-text-muted)' }}>{t('mappings.modals.manage.form.optional')}</span>
                </label>
                <input
                  className="form-input"
                  placeholder="127.0.0.1"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className="form-hint">{t('mappings.modals.manage.form.host.hint')}</div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>{t('mappings.modals.manage.form.port.label')}</span>
                  <span style={{ color: 'var(--saeng-text-muted)' }}>{t('mappings.modals.manage.form.required')}</span>
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
                <div className="form-hint">{t('mappings.modals.manage.form.port.hint')}</div>
                {portError && <div className="form-error visible">{portError}</div>}
              </div>

              <div className="form-group">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={https}
                    onChange={(e) => setHttps(e.target.checked)}
                  />
                  <span>{t('mappings.modals.manage.form.https.label')}</span>
                </label>
                <div className="form-hint" style={{ marginTop: 6 }}>{t('mappings.modals.manage.form.https.hint')}</div>
              </div>

              <div className="form-group">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={mocksEnabled}
                    onChange={(e) => setMocksEnabled(e.target.checked)}
                  />
                  <span>{t('mappings.modals.manage.form.mocksEnabled.label')}</span>
                </label>
                <div className="form-hint" style={{ marginTop: 6 }}>{t('mappings.modals.manage.form.mocksEnabled.hint')}</div>
              </div>

              <HeaderListEditor
                headers={requestHeaders}
                onChange={setRequestHeaders}
                label={t('mappings.modals.manage.form.headers.request.label')}
                hint={t('mappings.modals.manage.form.headers.request.hint')}
                t={t}
              />

              <HeaderListEditor
                headers={responseHeaders}
                onChange={setResponseHeaders}
                label={t('mappings.modals.manage.form.headers.response.label')}
                hint={t('mappings.modals.manage.form.headers.response.hint')}
                t={t}
              />

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  {t('mappings.modals.manage.buttons.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {isEditing ? t('mappings.modals.manage.buttons.update') : t('mappings.modals.manage.buttons.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Modal>
  );
}
