import Tooltip from './Tooltip.jsx';

export default function MappingsView({ active, mappings, setMappings, settings, onAdd, onEdit, showToast, t }) {
  async function handleToggle(id) {
    const updated = await window.electronAPI.mappings.toggle(id);
    setMappings(updated);
  }

  async function handleDelete(id) {
    const mapping = mappings.find((m) => m.id === id);
    if (!mapping) return;
    if (!confirm(t('confirm.removeMapping', { domain: mapping.domain }))) return;
    const updated = await window.electronAPI.mappings.remove(id);
    setMappings(updated);
  }

  function handleCopy(id) {
    const mapping = mappings.find((m) => m.id === id);
    if (!mapping) return;
    const protocol = settings.httpsEnabled ? 'https' : 'http';
    const url = `${protocol}://${mapping.domain}`;
    showToast(t('toast.copied', { url }), 'success');
    navigator.clipboard.writeText(url);
  }

  return (
    <div className={`view${active ? ' active' : ''}`} id="view-mappings">
      <div className="view-header">
        <div>
          <div className="view-title">{t('mappings.title')}</div>
          <div className="view-subtitle">{t('mappings.subtitle')}</div>
        </div>
        <button className="btn btn-primary" onClick={onAdd}>
          <i className="bi bi-plus" />
          <span>{t('mappings.add')}</span>
        </button>
      </div>

      <div className="table-responsive">
        {mappings.length === 0 ? (
          <div className="empty-state" id="emptyState">
            <i className="bi bi-arrow-left-right fs-1" />
            <div className="empty-state-text">{t('mappings.empty')}</div>
            <div className="empty-state-hint">{t('mappings.emptyHint')}</div>
          </div>
        ) : (
          <table className="table table-borderless table-striped table-hover" id="mappingsTable">
            <thead>
              <tr>
                <th scope="col">{t('table.domain')}</th>
                <th scope="col">{t('table.label')}</th>
                <th scope="col">{t('table.protocol')}</th>
                <th scope="col">{t('table.enabled')}</th>
                <th scope="col" style={{ textAlign: 'right' }}>{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => {
                const proto = m.https ? 'https' : 'http';
                return (
                  <tr key={m.id}>
                    <td className="domain-cell">{m.domain}</td>
                    <td className="label-cell">{m.label || ''}</td>
                    <td>
                      <span className={`badge badge-${proto}`}>{proto.toUpperCase()}</span>
                    </td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          onChange={() => handleToggle(m.id)}
                        />
                        <span className="toggle-track" />
                      </label>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <Tooltip title={t('table.copyTitle')}>
                          <button
                            className="btn btn-outline-secondary btn-copy"
                            onClick={() => handleCopy(m.id)}
                          >
                            <i className="bi bi-clipboard-check" />
                          </button>
                        </Tooltip>
                        <Tooltip title={t('table.editTitle')}>
                          <button
                            className="btn btn-outline-primary btn-edit"
                            onClick={() => onEdit(m)}
                          >
                            <i className="bi bi-pencil" />
                          </button>
                        </Tooltip>
                        <Tooltip title={t('table.deleteTitle')}>
                          <button
                            className="btn btn-outline-danger btn-delete"
                            onClick={() => handleDelete(m.id)}
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
