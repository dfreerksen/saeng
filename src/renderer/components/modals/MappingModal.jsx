import { useState, useRef, useEffect } from 'react';
import Modal from './Modal.jsx';
import HeaderListEditor from '../HeaderListEditor.jsx';
import { validateDomainPart, splitDomain, DOMAIN_SUFFIXES, DEFAULT_SUFFIX } from '../../js/utils.js';

export default function MappingModal({ mapping, mappings, httpsEnabled, onClose, onSubmit, t }) {
  const isEditing = !!mapping;
  const parsed = mapping ? splitDomain(mapping.domain) : { subdomain: '', domain: '', suffix: DEFAULT_SUFFIX };

  const [subdomain, setSubdomain] = useState(parsed.subdomain);
  const [domain, setDomain] = useState(parsed.domain);
  const [suffix, setSuffix] = useState(parsed.suffix);
  const [host, setHost] = useState(mapping?.host ?? '127.0.0.1');
  const [port, setPort] = useState(mapping?.port ?? 3000);
  const [https, setHttps] = useState(!!mapping?.https);
  const [mocksEnabled, setMocksEnabled] = useState(!!mapping?.mocksEnabled);
  const [pathRewriteFrom, setPathRewriteFrom] = useState(mapping?.pathRewriteFrom ?? '');
  const [pathRewriteTo, setPathRewriteTo] = useState(mapping?.pathRewriteTo ?? '');
  const [requestHeaders, setRequestHeaders] = useState(mapping?.requestHeaders ?? []);
  const [responseHeaders, setResponseHeaders] = useState(mapping?.responseHeaders ?? []);
  const [domainError, setDomainError] = useState('');
  const [portError, setPortError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const domainInputRef = useRef(null);

  const scheme = httpsEnabled ? 'https' : 'http';
  const trimmedDomain = domain.trim();
  const trimmedSubdomain = subdomain.trim();
  let accessedUsing = null;
  let wildcardExample = null;
  if (trimmedDomain) {
    const base = `${trimmedDomain}${suffix}`;
    const isWildcard = trimmedSubdomain === '*';
    const host = !trimmedSubdomain ? base : isWildcard ? `[SUBDOMAIN].${base}` : `${trimmedSubdomain}.${base}`;
    accessedUsing = t('mappings.modals.manage.form.domain.accessedUsing', { url: `${scheme}://${host}` });
    if (isWildcard) {
      wildcardExample = t('mappings.modals.manage.form.domain.wildcardExample', { url: `${scheme}://admin.${base}` });
    }
  }

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
      pathRewriteFrom: pathRewriteFrom.trim(),
      pathRewriteTo: pathRewriteTo.trim(),
    });
    setSubmitting(false);
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
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
                  <span className="form-label-hint">{t('mappings.modals.manage.form.required')}</span>
                </label>
                <div className="domain-row">
                  <input
                    className="form-input flex-1"
                    placeholder="api"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <span className="domain-sep">.</span>
                  <input
                    ref={domainInputRef}
                    className="form-input flex-1-5"
                    placeholder="myapp"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value.toLowerCase())}
                    autoComplete="off"
                    spellCheck={false}
                    required
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
                {accessedUsing && <div className="form-hint form-hint-emphasis">{accessedUsing}</div>}
                {wildcardExample && <div className="form-hint form-hint-emphasis">{wildcardExample}</div>}
                {domainError && <div className="form-error visible">{domainError}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>{t('mappings.modals.manage.form.host.label')}</span>
                  <span className="form-label-hint">{t('mappings.modals.manage.form.optional')}</span>
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
                  <span className="form-label-hint">{t('mappings.modals.manage.form.required')}</span>
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
                <div className="form-hint mt-1">{t('mappings.modals.manage.form.https.hint')}</div>
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
                <div className="form-hint mt-1">{t('mappings.modals.manage.form.mocksEnabled.hint')}</div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>{t('mappings.modals.manage.form.pathRewrite.label')}</span>
                  <span className="form-label-hint">{t('mappings.modals.manage.form.optional')}</span>
                </label>
                <div className="domain-row">
                  <input
                    className="form-input flex-1"
                    placeholder={t('mappings.modals.manage.form.pathRewrite.fromPlaceholder')}
                    value={pathRewriteFrom}
                    onChange={(e) => setPathRewriteFrom(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <span className="domain-sep">→</span>
                  <input
                    className="form-input flex-1"
                    placeholder={t('mappings.modals.manage.form.pathRewrite.toPlaceholder')}
                    value={pathRewriteTo}
                    onChange={(e) => setPathRewriteTo(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="form-hint">{t('mappings.modals.manage.form.pathRewrite.hint')}</div>
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
