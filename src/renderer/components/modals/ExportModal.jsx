import { useState } from 'react';
import Modal from './Modal.jsx';
import { useI18nT } from '../../js/i18nContext.js';

export default function ExportModal({ items, i18nPrefix, onClose, onSubmit }) {
  const t = useI18nT();
  const [selected, setSelected] = useState(() => new Set(items.map((i) => i.id)));
  const [submitting, setSubmitting] = useState(false);

  const allSelected = items.length > 0 && selected.size === items.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
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
            <h1 className="modal-title fs-5">{t(`${i18nPrefix}.title`)}</h1>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit} noValidate>
              <p className="form-hint mt-0">{t(`${i18nPrefix}.description`)}</p>

              <label className="checkbox-row">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                <span>{t(`${i18nPrefix}.selectAll`)}</span>
              </label>

              <div className="export-list">
                {items.map((item) => (
                  <label key={item.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleOne(item.id)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <div className="form-hint">
                {t(`${i18nPrefix}.selectedCount`, { count: selected.size, total: items.length })}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  {t('mappings.modals.manage.buttons.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting || selected.size === 0}>
                  {t(`${i18nPrefix}.buttons.submit`)}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Modal>
  );
}
