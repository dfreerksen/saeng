import { useState, useRef, useEffect, useMemo } from 'react';
import Modal from './Modal.jsx';
import HeaderListEditor from '../HeaderListEditor.jsx';
import ConditionListEditor from '../ConditionListEditor.jsx';
import MockRegexHelpPane from './MockRegexHelpPane.jsx';
import { compareMappingsByDomain } from '../../js/utils.js';
import { useI18nT } from '../../js/i18nContext.js';

const HTTP_METHODS = ['*', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export default function MockModal({ mock, initialValues, mappings, onClose, onSubmit, showToast }) {
  const t = useI18nT();
  const isEditing = !!mock;
  const init = mock ?? initialValues ?? {};

  const sortedMappings = useMemo(() => [...mappings].sort(compareMappingsByDomain), [mappings]);
  const [mappingId, setMappingId] = useState(init.mappingId ?? sortedMappings[0]?.id ?? '');
  const [method, setMethod] = useState(init.method ?? '*');
  const [pathPattern, setPathPattern] = useState(init.pathPattern ?? '');
  const [statusCode, setStatusCode] = useState(init.statusCode ?? 200);
  const [delayMs, setDelayMs] = useState(init.delayMs ?? 0);
  const [headers, setHeaders] = useState(init.headers ?? []);
  const [body, setBody] = useState(init.body ?? '');
  const [conditions, setConditions] = useState(init.conditions ?? []);
  const [mappingError, setMappingError] = useState('');
  const [pathError, setPathError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [delayError, setDelayError] = useState('');
  const [conditionsError, setConditionsError] = useState('');
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
    setConditionsError('');

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

    for (const condition of conditions) {
      if (condition.operator !== 'regex') continue;
      try {
        new RegExp(condition.value);
      } catch {
        setConditionsError(t('mocks.modals.manage.form.conditions.error.invalidRegex'));
        valid = false;
        break;
      }
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
      conditions,
    });
    setSubmitting(false);

    if (result && result.success === false) {
      setPathError(result.error);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className={`modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable${showHelp ? ' mock-modal-expanded' : ''}`}>
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

                <ConditionListEditor conditions={conditions} onChange={setConditions} />
                {conditionsError && <div className="form-error visible">{conditionsError}</div>}

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

            {showHelp && <MockRegexHelpPane showToast={showToast} />}
          </div>
        </div>
      </div>
    </Modal>
  );
}
