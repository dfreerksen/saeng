import { useState } from 'react';
import Modal from './Modal.jsx';

export default function ExportModal({ mappings, onClose, onSubmit, t }) {
  const [selected, setSelected] = useState(() => new Set(mappings.map((m) => m.id)));
  const [submitting, setSubmitting] = useState(false);

  const allSelected = mappings.length > 0 && selected.size === mappings.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(mappings.map((m) => m.id)));
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (selected.size === 0) return;
    setSubmitting(true);
    await onSubmit(Array.from(selected));
    setSubmitting(false);
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h1 className="modal-title fs-5">{t('export.title')}</h1>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit} noValidate>
              <p className="form-hint" style={{ marginTop: 0 }}>{t('export.subtitle')}</p>

              <label className="checkbox-row">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                <span>{t('export.selectAll')}</span>
              </label>

              <div className="export-list">
                {mappings.map((m) => (
                  <label key={m.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={() => toggleOne(m.id)}
                    />
                    <span>{m.domain}</span>
                  </label>
                ))}
              </div>

              <div className="form-hint">
                {t('export.selectedCount', { count: selected.size, total: mappings.length })}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  {t('modal.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting || selected.size === 0}>
                  {t('export.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Modal>
  );
}
