export default function HeaderListEditor({ headers, onChange, label, hint, t }) {
  function updateRow(index, field, value) {
    onChange(headers.map((h, i) => (i === index ? { ...h, [field]: value } : h)));
  }

  function addRow() {
    onChange([...headers, { name: '', value: '' }]);
  }

  function removeRow(index) {
    onChange(headers.filter((_, i) => i !== index));
  }

  return (
    <div className="form-group">
      <label className="form-label">
        <span>{label}</span>
        <span className="form-label-hint">{t('mappings.modals.manage.form.optional')}</span>
      </label>
      {headers.map((header, index) => (
        <div className="header-row" key={index}>
          <input
            className="form-input flex-1"
            placeholder={t('mappings.modals.manage.form.headers.name.placeholder')}
            value={header.name}
            onChange={(e) => updateRow(index, 'name', e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <input
            className="form-input flex-1-5"
            placeholder={t('mappings.modals.manage.form.headers.value.placeholder')}
            value={header.value}
            onChange={(e) => updateRow(index, 'value', e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="btn btn-outline-danger"
            aria-label={t('mappings.modals.manage.form.headers.remove')}
            onClick={() => removeRow(index)}
          >
            <i className="bi bi-trash" />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addRow}>
        {t('mappings.modals.manage.form.headers.add')}
      </button>
      <div className="form-hint">{hint}</div>
    </div>
  );
}
