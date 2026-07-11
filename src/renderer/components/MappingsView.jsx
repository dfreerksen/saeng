import { memo, useMemo, useState } from 'react';
import { splitDomain, compareMappingsByDomain } from '../js/utils.js';
import Tooltip from './utilities/Tooltip.jsx';
import ConfirmModal from './modals/ConfirmModal.jsx';

function buildGroups(mappings) {
  const groups = new Map();
  for (const m of mappings) {
    const { domain, suffix } = splitDomain(m.domain);
    const key = domain + suffix;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  for (const groupMappings of groups.values()) {
    groupMappings.sort(compareMappingsByDomain);
  }
  return groups;
}

function healthTooltip(health, t) {
  if (!health) return t('mappings.table.health.unknown');
  if (health.status === 'up') return t('mappings.table.health.up', { latency: health.latencyMs });
  return t('mappings.table.health.down', { error: health.error });
}

export default memo(function MappingsView({ mappings, setMappings, healthStatuses, proxyRunning, settings, onAdd, onEdit, onExport, onImport, showToast, t }) {
  const [pendingDelete, setPendingDelete] = useState(null);

  async function handleToggle(id) {
    const updated = await window.electronAPI.mappings.toggle(id);
    setMappings(updated);
  }

  async function handleGroupToggle(groupMappings) {
    const allEnabled = groupMappings.every((m) => m.enabled);
    const ids = groupMappings.map((m) => m.id);
    const updated = await window.electronAPI.mappings.setGroupEnabled(ids, !allEnabled);
    setMappings(updated);
  }

  function handleDeleteClick(id) {
    const mapping = mappings.find((m) => m.id === id);
    if (!mapping) return;
    setPendingDelete(mapping);
  }

  async function confirmDelete() {
    const id = pendingDelete.id;
    setPendingDelete(null);
    const updated = await window.electronAPI.mappings.remove(id);
    setMappings(updated);
  }

  function handleCopy(id) {
    const mapping = mappings.find((m) => m.id === id);
    if (!mapping) return;
    const protocol = settings.httpsEnabled ? 'https' : 'http';
    const { subdomain, domain, suffix } = splitDomain(mapping.domain);
    const host = subdomain === '*' ? `${domain}${suffix}` : mapping.domain;
    const url = `${protocol}://${host}`;
    showToast(t('flash.copied', { url }), 'success');
    navigator.clipboard.writeText(url);
  }

  const groups = useMemo(() => buildGroups(mappings), [mappings]);

  return (
    <div className="view active" id="view-mappings">
      <header className="container-fluid p-0 mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="m-0">
              <i className="bi bi-arrow-left-right me-2" />
              {t('mappings.title')}
            </h4>
            <h6 className="subtitle">{t('mappings.subtitle')}</h6>
          </div>
          <div className="btn-group" role="group" aria-label="Actions">
            <Tooltip title={t('mappings.actions.import')}>
              <button className="btn btn-outline-secondary" onClick={onImport}>
                <i className="bi bi-upload" />
                <span className="ms-2 d-none d-lg-inline">{t('mappings.actions.import')}</span>
              </button>
            </Tooltip>
            <Tooltip title={t('mappings.actions.export')}>
              <button className="btn btn-outline-secondary" onClick={onExport} disabled={mappings.length === 0}>
                <i className="bi bi-download" />
                <span className="ms-2 d-none d-lg-inline">{t('mappings.actions.export')}</span>
              </button>
            </Tooltip>
            <Tooltip title={t('mappings.actions.add')}>
              <button className="btn btn-primary" onClick={onAdd}>
                <i className="bi bi-plus" />
                <span className="ms-2 d-none d-lg-inline">{t('mappings.actions.add')}</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

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
                <th scope="col">{t('mappings.table.domain')}</th>
                <th scope="col">{t('mappings.table.protocol')}</th>
                <th scope="col">{t('mappings.table.enabled')}</th>
                <th scope="col" className="text-end">{t('mappings.table.actions')}</th>
              </tr>
            </thead>
            {[...groups.entries()].map(([groupKey, groupMappings]) => {
              const allEnabled = groupMappings.every((m) => m.enabled);
              return (
                <tbody key={groupKey}>
                  <tr className="group-header-row">
                    <td colSpan={4}>
                      <div className="group-header">
                        <span className="group-name">{groupKey}</span>
                        <span className="group-count">({groupMappings.length})</span>
                        <Tooltip title={t('mappings.table.groupToggleAll')}>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={allEnabled}
                              onChange={() => handleGroupToggle(groupMappings)}
                            />
                            <span className="toggle-track" />
                          </label>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                  {groupMappings.map((m) => {
                    const proto = m.https ? 'https' : 'http';
                    const health = m.enabled && proxyRunning ? healthStatuses?.[m.id] : null;
                    const healthState = health?.status ?? 'unknown';
                    return (
                      <tr key={m.id}>
                        <td className="domain-cell">
                          {settings.healthCheckEnabled && (
                            <Tooltip title={healthTooltip(health, t)}>
                              <span className={`health-dot ${healthState}`} />
                            </Tooltip>
                          )}
                          {m.domain}
                          {m.mocksEnabled && (
                            <Tooltip title={t('mappings.table.mocksEnabled')}>
                              <i className="bi bi-magic mock-indicator" />
                            </Tooltip>
                          )}
                          {m.pathRewriteFrom && (
                            <Tooltip title={t('mappings.table.pathRewrite', { from: m.pathRewriteFrom, to: m.pathRewriteTo || '/' })}>
                              <i className="bi bi-signpost-split rewrite-indicator" />
                            </Tooltip>
                          )}
                        </td>
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
                            <Tooltip title={t('mappings.table.actions.copy')}>
                              <button
                                className="btn btn-outline-secondary btn-copy"
                                onClick={() => handleCopy(m.id)}
                              >
                                <i className="bi bi-clipboard-check" />
                              </button>
                            </Tooltip>
                            <Tooltip title={t('mappings.table.actions.edit')}>
                              <button
                                className="btn btn-outline-primary btn-edit"
                                onClick={() => onEdit(m)}
                              >
                                <i className="bi bi-pencil" />
                              </button>
                            </Tooltip>
                            <Tooltip title={t('mappings.table.actions.delete')}>
                              <button
                                className="btn btn-outline-danger btn-delete"
                                onClick={() => handleDeleteClick(m.id)}
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
              );
            })}
          </table>
        )}
      </div>

      {pendingDelete && (
        <ConfirmModal
          title={t('common.confirm.title')}
          message={t('mappings.table.actions.confirm.remove', { domain: pendingDelete.domain })}
          confirmLabel={t('mappings.table.actions.delete')}
          cancelLabel={t('mappings.modals.manage.buttons.cancel')}
          onConfirm={confirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
});
