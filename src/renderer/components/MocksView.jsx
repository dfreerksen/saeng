import { useState } from 'react';
import Tooltip from './Tooltip.jsx';
import MockRegexHelpModal from './MockRegexHelpModal.jsx';

function buildGroups(mocks, mapById) {
  const groups = new Map();
  for (const mock of mocks) {
    const mapping = mapById.get(mock.mappingId);
    const key = mapping ? mapping.domain : mock.mappingId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mock);
  }
  return groups;
}

export default function MocksView({ active, mocks, mappings, mockableMappings, setMocks, onAdd, onEdit, onExport, onImport, showToast, t }) {
  const [showHelp, setShowHelp] = useState(false);

  async function handleToggle(id) {
    const updated = await window.electronAPI.mocks.toggle(id);
    setMocks(updated);
  }

  async function handleDelete(id) {
    const mock = mocks.find((m) => m.id === id);
    if (!mock) return;
    if (!confirm(t('mocks.table.actions.confirm.remove'))) return;
    const updated = await window.electronAPI.mocks.remove(id);
    setMocks(updated);
  }

  const mapById = new Map(mappings.map((m) => [m.id, m]));
  const groups = buildGroups(mocks, mapById);

  return (
    <div className={`view${active ? ' active' : ''}`} id="view-mocks">
      <div className="view-header">
        <div>
          <div className="view-title">{t('mocks.title')}</div>
          <div className="view-subtitle">{t('mocks.subtitle')}</div>
        </div>
        <div className="view-header-actions">
          <button className="btn btn-outline-secondary" onClick={onImport}>
            <i className="bi bi-upload" />
            <span>{t('mocks.actions.import')}</span>
          </button>
          <button className="btn btn-outline-secondary" onClick={onExport} disabled={mocks.length === 0}>
            <i className="bi bi-download" />
            <span>{t('mocks.actions.export')}</span>
          </button>
          <button className="btn btn-outline-secondary" onClick={() => setShowHelp(true)}>
            <i className="bi bi-question-circle" />
            <span>{t('mocks.actions.help')}</span>
          </button>
          <button className="btn btn-primary" onClick={onAdd} disabled={mockableMappings.length === 0}>
            <i className="bi bi-plus" />
            <span>{t('mocks.actions.add')}</span>
          </button>
        </div>
      </div>

      {showHelp && (
        <MockRegexHelpModal onClose={() => setShowHelp(false)} showToast={showToast} t={t} />
      )}

      <div className="table-responsive">
        {mocks.length === 0 ? (
          <div className="empty-state" id="mocksEmptyState">
            <i className="bi bi-magic fs-1" />
            <div className="empty-state-text">{t('mocks.empty')}</div>
            <div className="empty-state-hint">{t('mocks.emptyHint')}</div>
          </div>
        ) : (
          <table className="table table-borderless table-striped table-hover" id="mocksTable">
            <thead>
              <tr>
                <th scope="col">{t('mocks.table.method')}</th>
                <th scope="col">{t('mocks.table.path')}</th>
                <th scope="col">{t('mocks.table.status')}</th>
                <th scope="col">{t('mocks.table.enabled')}</th>
                <th scope="col" style={{ textAlign: 'right' }}>{t('mocks.table.actions')}</th>
              </tr>
            </thead>
            {[...groups.entries()].map(([groupKey, groupMocks]) => (
              <tbody key={groupKey}>
                <tr className="group-header-row">
                  <td colSpan={5}>
                    <div className="group-header">
                      <span className="group-name">{groupKey}</span>
                    </div>
                  </td>
                </tr>
                {groupMocks.map((mock) => {
                  const mappingDisabled = !mapById.get(mock.mappingId)?.enabled;
                  return (
                  <tr key={mock.id}>
                    <td>
                      <span className="badge badge-http">
                        {mock.method === '*' ? t('mocks.modals.manage.form.method.any') : mock.method}
                      </span>
                    </td>
                    <td className="log-path-cell"><code>{mock.pathPattern}</code></td>
                    <td>{mock.statusCode}</td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={mock.enabled}
                          disabled={mappingDisabled}
                          onChange={() => handleToggle(mock.id)}
                        />
                        <span className="toggle-track" />
                      </label>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <Tooltip title={t('mappings.table.actions.edit')}>
                          <button className="btn btn-outline-primary btn-edit" onClick={() => onEdit(mock)} disabled={mappingDisabled}>
                            <i className="bi bi-pencil" />
                          </button>
                        </Tooltip>
                        <Tooltip title={t('mappings.table.actions.delete')}>
                          <button className="btn btn-outline-danger btn-delete" onClick={() => handleDelete(mock.id)}>
                            <i className="bi bi-trash" />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        )}
      </div>
    </div>
  );
}
