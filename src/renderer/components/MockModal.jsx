import { useState, useRef, useEffect } from 'react';
import Modal from './Modal.jsx';
import HeaderListEditor from './HeaderListEditor.jsx';

const HTTP_METHODS = ['*', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export default function MockModal({ mock, mappings, onClose, onSubmit, t }) {
  const isEditing = !!mock;

  const [mappingId, setMappingId] = useState(mock?.mappingId ?? mappings[0]?.id ?? '');
  const [method, setMethod] = useState(mock?.method ?? '*');
  const [pathPattern, setPathPattern] = useState(mock?.pathPattern ?? '');
  const [statusCode, setStatusCode] = useState(mock?.statusCode ?? 200);
  const [headers, setHeaders] = useState(mock?.headers ?? []);
  const [body, setBody] = useState(mock?.body ?? '');
  const [mappingError, setMappingError] = useState('');
  const [pathError, setPathError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pathInputRef = useRef(null);

  useEffect(() => {
    pathInputRef.current?.focus();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMappingError('');
    setPathError('');
    setStatusError('');

    const trimPath = pathPattern.trim();
    const parsedStatus = parseInt(String(statusCode).trim(), 10);

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

    if (!valid) return;

    setSubmitting(true);
    const result = await onSubmit({
      mappingId,
      method,
      pathPattern: trimPath,
      statusCode: parsedStatus,
      headers,
      body,
    });
    setSubmitting(false);

    if (result && result.success === false) {
      setPathError(result.error);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h1 className="modal-title fs-5">
              {isEditing ? t('mocks.modals.manage.editTitle') : t('mocks.modals.manage.addTitle')}
            </h1>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label">
                  <span>{t('mocks.modals.manage.form.mapping.label')}</span>
                  <span style={{ color: 'var(--saeng-text-muted)' }}>{t('mappings.modals.manage.form.required')}</span>
                </label>
                <select
                  className="form-input"
                  value={mappingId}
                  onChange={(e) => setMappingId(e.target.value)}
                >
                  <option value="">{t('mocks.modals.manage.form.mapping.placeholder')}</option>
                  {mappings.map((m) => (
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
                  <span style={{ color: 'var(--saeng-text-muted)' }}>{t('mappings.modals.manage.form.required')}</span>
                </label>
                <input
                  ref={pathInputRef}
                  className="form-input"
                  placeholder={t('mocks.modals.manage.form.path.placeholder')}
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
                  <span style={{ color: 'var(--saeng-text-muted)' }}>{t('mappings.modals.manage.form.required')}</span>
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
                  <span style={{ color: 'var(--saeng-text-muted)' }}>{t('mappings.modals.manage.form.optional')}</span>
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
        </div>
      </div>
    </Modal>
  );
}
