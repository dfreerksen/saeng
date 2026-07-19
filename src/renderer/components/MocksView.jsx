import { memo, useMemo, useState } from 'react';
import { statusBadgeClass } from '../js/utils.js';
import Tooltip from './utilities/Tooltip.jsx';
import ConfirmModal from './modals/ConfirmModal.jsx';
import { useI18nT } from '../js/i18nContext.js';

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

export default memo(function MocksView({ mocks, mappings, mockableMappings, setMocks, onAdd, onEdit, onExport, onImport }) {
  const t = useI18nT();
  const [pendingDelete, setPendingDelete] = useState(null);

  async function handleToggle(id) {
    const updated = await window.electronAPI.mocks.toggle(id);
    setMocks(updated);
  }

  function handleDeleteClick(id) {
    const mock = mocks.find((m) => m.id === id);
    if (!mock) return;
    setPendingDelete(mock);
  }

  async function confirmDelete() {
    const id = pendingDelete.id;
    setPendingDelete(null);
    const updated = await window.electronAPI.mocks.remove(id);
    setMocks(updated);
  }

  const mapById = useMemo(() => new Map(mappings.map((m) => [m.id, m])), [mappings]);
  const groups = useMemo(() => buildGroups(mocks, mapById), [mocks, mapById]);

  return (
    <div className="view active" id="view-mocks">
      <header className="container-fluid p-0 mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="m-0">
              <i className="bi bi-magic me-2" />
              {t('mocks.title')}
            </h4>
            <h6 className="subtitle">{t('mocks.subtitle')}</h6>
          </div>
          <div className="btn-group" role="group" aria-label="Actions">
            <Tooltip title={t('mocks.actions.import')}>
              <button className="btn btn-outline-secondary" onClick={onImport}>
                <i className="bi bi-upload" />
                <span className="ms-2 d-none d-lg-inline">{t('mocks.actions.import')}</span>
              </button>
            </Tooltip>
            <Tooltip title={t('mocks.actions.export')}>
              <button className="btn btn-outline-secondary" onClick={onExport} disabled={mocks.length === 0}>
                <i className="bi bi-download" />
                <span className="ms-2 d-none d-lg-inline">{t('mocks.actions.export')}</span>
              </button>
            </Tooltip>
            <Tooltip title={t('mocks.actions.add')}>
              <button className="btn btn-primary" onClick={onAdd} disabled={mockableMappings.length === 0}>
                <i className="bi bi-plus" />
                <span className="ms-2 d-none d-lg-inline">{t('mocks.actions.add')}</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

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
                <th scope="col" className="text-end">{t('mocks.table.actions')}</th>
              </tr>
            </thead>
            {[...groups.entries()].map(([groupKey, groupMocks]) => (
              <tbody key={groupKey}>
                <tr className="group-header-row">
                  <td colSpan={5}>
                    <div className="group-header">
                      <span className="group-name">{groupKey}</span>
                      <span className="group-count">({groupMocks.length})</span>
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
                    <td className="log-path-cell">
                      <code>{mock.pathPattern}</code>
                      {mock.conditions?.length > 0 && (
                        <span className="badge badge-conditions">{t('mocks.table.conditionsBadge', { count: mock.conditions.length })}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(mock.statusCode)}`}>{mock.statusCode}</span>
                    </td>
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
                          <button className="btn btn-outline-danger btn-delete" onClick={() => handleDeleteClick(mock.id)}>
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

      {pendingDelete && (
        <ConfirmModal
          title={t('common.confirm.title')}
          message={t('mocks.table.actions.confirm.remove')}
          confirmLabel={t('mappings.table.actions.delete')}
          cancelLabel={t('mappings.modals.manage.buttons.cancel')}
          onConfirm={confirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
});
