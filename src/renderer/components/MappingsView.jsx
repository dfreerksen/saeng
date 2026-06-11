import { splitDomain } from '../js/utils.js';
import Tooltip from './Tooltip.jsx';

function subdomainRank(subdomain) {
  if (subdomain === '') return 0;
  if (subdomain === '*') return 2;
  return 1;
}

function compareMappings(a, b) {
  const subA = splitDomain(a.domain).subdomain;
  const subB = splitDomain(b.domain).subdomain;
  const rankDiff = subdomainRank(subA) - subdomainRank(subB);
  if (rankDiff !== 0) return rankDiff;
  return subA.localeCompare(subB, undefined, { numeric: true });
}

function buildGroups(mappings) {
  const groups = new Map();
  for (const m of mappings) {
    const { domain, suffix } = splitDomain(m.domain);
    const key = domain + suffix;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  for (const groupMappings of groups.values()) {
    groupMappings.sort(compareMappings);
  }
  return groups;
}

function healthTooltip(health, t) {
  if (!health) return t('mappings.table.health.unknown');
  if (health.status === 'up') return t('mappings.table.health.up', { latency: health.latencyMs });
  return t('mappings.table.health.down', { error: health.error });
}

export default function MappingsView({ active, mappings, setMappings, healthStatuses, proxyRunning, settings, onAdd, onEdit, onExport, onImport, showToast, t }) {
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

  async function handleDelete(id) {
    const mapping = mappings.find((m) => m.id === id);
    if (!mapping) return;
    if (!confirm(t('mappings.table.actions.confirm.remove', { domain: mapping.domain }))) return;
    const updated = await window.electronAPI.mappings.remove(id);
    setMappings(updated);
  }

  function handleCopy(id) {
    const mapping = mappings.find((m) => m.id === id);
    if (!mapping) return;
    const protocol = settings.httpsEnabled ? 'https' : 'http';
    const url = `${protocol}://${mapping.domain}`;
    showToast(t('flash.copied', { url }), 'success');
    navigator.clipboard.writeText(url);
  }

  const groups = buildGroups(mappings);

  return (
    <div className={`view${active ? ' active' : ''}`} id="view-mappings">
      <div className="view-header">
        <div>
          <div className="view-title">{t('mappings.title')}</div>
          <div className="view-subtitle">{t('mappings.subtitle')}</div>
        </div>
        <div className="view-header-actions">
          <button className="btn btn-outline-secondary" onClick={onImport}>
            <i className="bi bi-upload" />
            <span>{t('mappings.actions.import')}</span>
          </button>
          <button className="btn btn-outline-secondary" onClick={onExport} disabled={mappings.length === 0}>
            <i className="bi bi-download" />
            <span>{t('mappings.actions.export')}</span>
          </button>
          <button className="btn btn-primary" onClick={onAdd}>
            <i className="bi bi-plus" />
            <span>{t('mappings.actions.add')}</span>
          </button>
        </div>
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
                <th scope="col">{t('mappings.table.domain')}</th>
                <th scope="col">{t('mappings.table.protocol')}</th>
                <th scope="col">{t('mappings.table.enabled')}</th>
                <th scope="col" style={{ textAlign: 'right' }}>{t('mappings.table.actions')}</th>
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
              );
            })}
          </table>
        )}
      </div>
    </div>
  );
}
