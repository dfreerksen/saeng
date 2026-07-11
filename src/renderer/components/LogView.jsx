import { memo, useState, useMemo } from 'react';
import { FILTER_TABS, matchesFilter } from '../js/logFilter.js';
import { statusBadgeClass } from '../js/utils.js';
import Tooltip from './utilities/Tooltip.jsx';
import LogDetailPanel from './LogDetailPanel.jsx';

function matchHeaders(headers, q) {
  if (!headers) return false;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase().includes(q)) return true;
    const v = Array.isArray(value) ? value.join(', ') : String(value);
    if (v.toLowerCase().includes(q)) return true;
  }
  return false;
}

export default memo(function LogView({ entries, onClear, onExportHar, onConvertToMock, settings, t }) {
  const [selectedId, setSelectedId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailTab, setDetailTab] = useState('general');

  const filteredEntries = useMemo(() => {
    let result = activeFilter === 'all' ? entries : entries.filter((e) => matchesFilter(e, activeFilter));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) =>
        (e.hostname && e.hostname.toLowerCase().includes(q)) ||
        (e.path && e.path.toLowerCase().includes(q)) ||
        (e.method && e.method.toLowerCase().includes(q)) ||
        (e.status != null && String(e.status).includes(q)) ||
        matchHeaders(e.requestHeaders, q) ||
        matchHeaders(e.responseHeaders, q) ||
        (e.responseBody && e.responseBody.toLowerCase().includes(q))
      );
    }
    return result;
  }, [entries, activeFilter, searchQuery]);

  const reversedEntries = useMemo(() => [...filteredEntries].reverse(), [filteredEntries]);

  const selectedEntry = useMemo(
    () => selectedId != null ? entries.find((e) => e.id === selectedId) ?? null : null,
    [entries, selectedId]
  );

  function selectEntry(id) {
    if (selectedId === id) {
      setSelectedId(null);
    } else {
      setSelectedId(id);
      setDetailTab('general');
    }
  }

  return (
    <div className="view active" id="view-log">
      <header className="container-fluid p-0 mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="m-0">
              <i className="bi bi-list-columns-reverse me-2" />
              {t('log.title')}
            </h4>
            <h6 className="subtitle">{t('log.subtitle')}</h6>
          </div>
          <div className="btn-group" role="group" aria-label="Actions">
            <Tooltip title={t('log.actions.exportHar')}>
              <button className="btn btn-outline-secondary" onClick={onExportHar} disabled={entries.length === 0}>
                <i className="bi bi-download" />
                <span className="ms-2 d-none d-lg-inline">{t('log.actions.exportHar')}</span>
              </button>
            </Tooltip>
            <Tooltip title={t('log.actions.clear')}>
              <button className="btn btn-outline-secondary" onClick={onClear} disabled={entries.length === 0}>
                <i className="bi bi-trash" />
                <span className="ms-2 d-none d-lg-inline">{t('log.actions.clear')}</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

      <div className="log-search-bar">
        <i className="bi bi-search log-search-icon" />
        <input
          type="text"
          className="log-search-input"
          placeholder={t('log.search.placeholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="log-search-clear" onClick={() => setSearchQuery('')} aria-label={t('log.search.clear')}>
            <i className="bi bi-x-lg" />
          </button>
        )}
      </div>

      <div className="log-filter-bar">
        {FILTER_TABS.map((f) => (
          <button
            key={f}
            className={`log-filter-btn${activeFilter === f ? ' active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {t(`log.filter.${f}`)}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="empty-state" id="logEmptyState">
          <i className="bi bi-list-columns-reverse fs-1" />
          <div className="empty-state-text">{t('log.empty')}</div>
          <div className="empty-state-hint">{t('log.emptyHint')}</div>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="empty-state">
          <i className={`bi ${searchQuery ? 'bi-search' : 'bi-funnel'} fs-1`} />
          <div className="empty-state-text">{t(searchQuery ? 'log.searchEmpty' : 'log.filterEmpty')}</div>
        </div>
      ) : (
        <div className="log-devtools">
          <div className="log-request-list">
            <table className="table table-borderless table-hover" id="logTable">
              <thead>
                <tr>
                  <th scope="col">{t('log.table.method')}</th>
                  <th scope="col">{t('log.table.host')}</th>
                  <th scope="col">{t('log.table.path')}</th>
                  <th scope="col">{t('log.table.status')}</th>
                  <th scope="col" className="text-end">{t('log.table.latency')}</th>
                </tr>
              </thead>
              <tbody>
                {reversedEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`log-row${selectedId === entry.id ? ' selected' : ''}`}
                    onClick={() => selectEntry(entry.id)}
                  >
                    <td>
                      <span className={`badge badge-${entry.https ? 'https' : 'http'}`}>{entry.method}</span>
                    </td>
                    <td className="domain-cell">{entry.hostname}</td>
                    <td className="log-path-cell">{entry.path}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(entry.status)}`} title={entry.error || undefined}>
                        {entry.status ?? '—'}
                      </span>
                      {entry.mocked && (
                        <span className="badge badge-mock">{t('log.table.mock')}</span>
                      )}
                    </td>
                    <td className="text-end log-latency-cell">
                      {entry.latencyMs != null ? `${entry.latencyMs} ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedEntry && (
            <LogDetailPanel
              entry={selectedEntry}
              settings={settings}
              detailTab={detailTab}
              setDetailTab={setDetailTab}
              onClose={() => setSelectedId(null)}
              onConvertToMock={onConvertToMock}
              t={t}
            />
          )}
        </div>
      )}
    </div>
  );
});
