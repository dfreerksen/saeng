import { useState, useRef, useEffect, useMemo } from 'react';
import Modal from './Modal.jsx';
import HeaderListEditor from './HeaderListEditor.jsx';
import Tooltip from './Tooltip.jsx';
import { splitDomain } from '../js/utils.js';

const HTTP_METHODS = ['*', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const REGEX_EXAMPLES = [
  { pattern: '^/api/users$', descriptionKey: 'mocks.modals.manage.help.examples.exact' },
  { pattern: '^/api/users/\\d+$', descriptionKey: 'mocks.modals.manage.help.examples.numericId' },
  { pattern: '^/api/users/[^/]+$', descriptionKey: 'mocks.modals.manage.help.examples.anySegment' },
  { pattern: '^/api/users(/.*)?$', descriptionKey: 'mocks.modals.manage.help.examples.prefix' },
  { pattern: '^/api/users/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$', descriptionKey: 'mocks.modals.manage.help.examples.uuid' },
  { pattern: '\\.json$', descriptionKey: 'mocks.modals.manage.help.examples.extension' },
  { pattern: '^/(users|accounts)$', descriptionKey: 'mocks.modals.manage.help.examples.alternation' },
  { pattern: '.*', descriptionKey: 'mocks.modals.manage.help.examples.any' },
];

function subdomainRank(subdomain) {
  if (subdomain === '') return 0;
  if (subdomain === '*') return 2;
  return 1;
}

function compareMappings(a, b) {
  const splitA = splitDomain(a.domain);
  const splitB = splitDomain(b.domain);
  const baseA = splitA.domain + splitA.suffix;
  const baseB = splitB.domain + splitB.suffix;
  const baseCmp = baseA.localeCompare(baseB, undefined, { numeric: true });
  if (baseCmp !== 0) return baseCmp;
  const rankDiff = subdomainRank(splitA.subdomain) - subdomainRank(splitB.subdomain);
  if (rankDiff !== 0) return rankDiff;
  return splitA.subdomain.localeCompare(splitB.subdomain, undefined, { numeric: true });
}

export default function MockModal({ mock, initialValues, mappings, onClose, onSubmit, showToast, t }) {
  const isEditing = !!mock;
  const init = mock ?? initialValues ?? {};

  const sortedMappings = useMemo(() => [...mappings].sort(compareMappings), [mappings]);
  const [mappingId, setMappingId] = useState(init.mappingId ?? sortedMappings[0]?.id ?? '');
  const [method, setMethod] = useState(init.method ?? '*');
  const [pathPattern, setPathPattern] = useState(init.pathPattern ?? '');
  const [statusCode, setStatusCode] = useState(init.statusCode ?? 200);
  const [delayMs, setDelayMs] = useState(init.delayMs ?? 0);
  const [headers, setHeaders] = useState(init.headers ?? []);
  const [body, setBody] = useState(init.body ?? '');
  const [mappingError, setMappingError] = useState('');
  const [pathError, setPathError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [delayError, setDelayError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const pathInputRef = useRef(null);

  useEffect(() => {
    pathInputRef.current?.focus();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMappingError('');
    setPathError('');
    setStatusError('');
    setDelayError('');

    const trimPath = pathPattern.trim();
    const parsedStatus = parseInt(String(statusCode).trim(), 10);
    const parsedDelay = parseInt(String(delayMs).trim(), 10);

    let valid = true;

    if (!mappingId) {
      setMappingError(t('mocks.modals.manage.form.mapping.error'));
      valid = false;
    }

    if (!trimPath) {
      setPathError(t('mocks.modals.manage.form.path.error.required'));
      valid = false;
    } else {
      try {
        new RegExp(trimPath);
      } catch {
        setPathError(t('mocks.modals.manage.form.path.error.invalid'));
        valid = false;
      }
    }

    if (!parsedStatus || parsedStatus < 100 || parsedStatus > 599 || isNaN(parsedStatus)) {
      setStatusError(t('mocks.modals.manage.form.status.error'));
      valid = false;
    }

    if (isNaN(parsedDelay) || parsedDelay < 0 || parsedDelay > 30000) {
      setDelayError(t('mocks.modals.manage.form.delay.error'));
      valid = false;
    }

    if (!valid) return;

    setSubmitting(true);
    const result = await onSubmit({
      mappingId,
      method,
      pathPattern: trimPath,
      statusCode: parsedStatus,
      delayMs: parsedDelay,
      headers,
      body,
    });
    setSubmitting(false);

    if (result && result.success === false) {
      setPathError(result.error);
    }
  }

  function handleCopy(pattern) {
    navigator.clipboard.writeText(pattern);
    showToast(t('flash.copied', { url: pattern }), 'success');
  }

  return (
    <Modal onClose={onClose}>
      <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable${showHelp ? ' mock-modal-expanded' : ''}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h1 className="modal-title fs-5">
              {isEditing ? t('mocks.modals.manage.editTitle') : t('mocks.modals.manage.addTitle')}
            </h1>
            <div className="mock-modal-header-actions">
              <button type="button" className={`btn btn-help${showHelp ? ' active' : ''}`} onClick={() => setShowHelp(!showHelp)} />
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
          </div>
          <div className={`modal-body${showHelp ? ' mock-modal-body-split' : ''}`}>
            <div className={showHelp ? 'mock-modal-form-pane' : undefined}>
              <form onSubmit={handleSubmit} noValidate>
                <div className="form-group">
                  <label className="form-label">
                    <span>{t('mocks.modals.manage.form.mapping.label')}</span>
                    <span className="form-label-hint">{t('mappings.modals.manage.form.required')}</span>
                  </label>
                  <select
                    className="form-input"
                    value={mappingId}
                    onChange={(e) => setMappingId(e.target.value)}
                  >
                    <option value="">{t('mocks.modals.manage.form.mapping.placeholder')}</option>
                    {sortedMappings.map((m) => (
                      <option key={m.id} value={m.id}>{m.domain}</option>
                    ))}
                  </select>
                  {mappingError && <div className="form-error visible">{mappingError}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span>{t('mocks.modals.manage.form.method.label')}</span>
                  </label>
                  <select
                    className="form-input"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    {HTTP_METHODS.map((m) => (
                      <option key={m} value={m}>{m === '*' ? t('mocks.modals.manage.form.method.any') : m}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span>{t('mocks.modals.manage.form.path.label')}</span>
                    <span className="form-label-hint">{t('mappings.modals.manage.form.required')}</span>
                  </label>
                  <input
                    ref={pathInputRef}
                    className="form-input"
                    placeholder='^/api/users/\d+$'
                    value={pathPattern}
                    onChange={(e) => setPathPattern(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div className="form-hint">{t('mocks.modals.manage.form.path.hint')}</div>
                  {pathError && <div className="form-error visible">{pathError}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span>{t('mocks.modals.manage.form.status.label')}</span>
                    <span className="form-label-hint">{t('mappings.modals.manage.form.required')}</span>
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    min="100"
                    max="599"
                    value={statusCode}
                    onChange={(e) => setStatusCode(e.target.value)}
                    autoComplete="off"
                  />
                  <div className="form-hint">{t('mocks.modals.manage.form.status.hint')}</div>
                  {statusError && <div className="form-error visible">{statusError}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span>{t('mocks.modals.manage.form.delay.label')}</span>
                    <span className="form-label-hint">{t('mappings.modals.manage.form.optional')}</span>
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    max="30000"
                    value={delayMs}
                    onChange={(e) => setDelayMs(e.target.value)}
                    autoComplete="off"
                  />
                  <div className="form-hint">{t('mocks.modals.manage.form.delay.hint')}</div>
                  {delayError && <div className="form-error visible">{delayError}</div>}
                </div>

                <HeaderListEditor
                  headers={headers}
                  onChange={setHeaders}
                  label={t('mocks.modals.manage.form.headers.label')}
                  hint={t('mocks.modals.manage.form.headers.hint')}
                  t={t}
                />

                <div className="form-group">
                  <label className="form-label">
                    <span>{t('mocks.modals.manage.form.body.label')}</span>
                    <span className="form-label-hint">{t('mappings.modals.manage.form.optional')}</span>
                  </label>
                  <textarea
                    className="form-input"
                    rows={6}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    spellCheck={false}
                  />
                  <div className="form-hint">{t('mocks.modals.manage.form.body.hint')}</div>
                </div>

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

            {showHelp && (
              <div className="mock-modal-help-pane">
                <h6 className="mb-2">{t('mocks.modals.manage.help.title')}</h6>
                <p className="form-hint">{t('mocks.modals.manage.help.intro')}</p>
                <table className="table table-borderless table-striped">
                  <thead>
                    <tr>
                      <th scope="col">{t('mocks.modals.manage.help.table.pattern')}</th>
                      <th scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {REGEX_EXAMPLES.map((example) => (
                      <tr key={example.pattern}>
                        <td className="log-path-cell">
                          <code>{example.pattern}</code>
                          <div className="form-hint mb-0">{t(example.descriptionKey)}</div>
                        </td>
                        <td className="text-end">
                          <Tooltip title={t('mocks.modals.manage.help.copy')}>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-copy"
                              onClick={() => handleCopy(example.pattern)}
                            >
                              <i className="bi bi-clipboard" />
                            </button>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
