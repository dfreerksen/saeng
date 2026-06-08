function statusBadgeClass(status) {
  if (status == null) return 'badge-status-pending';
  if (status >= 500) return 'badge-status-error';
  if (status >= 400) return 'badge-status-warn';
  if (status >= 300) return 'badge-status-redirect';
  return 'badge-status-ok';
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString();
}

export default function LogView({ active, entries, onClear, t }) {
  return (
    <div className={`view${active ? ' active' : ''}`} id="view-log">
      <div className="view-header">
        <div>
          <div className="view-title">{t('log.title')}</div>
          <div className="view-subtitle">{t('log.subtitle')}</div>
        </div>
        <button className="btn btn-outline-secondary" onClick={onClear} disabled={entries.length === 0}>
          <i className="bi bi-trash" />
          <span>{t('log.clear')}</span>
        </button>
      </div>

      <div className="table-responsive">
        {entries.length === 0 ? (
          <div className="empty-state" id="logEmptyState">
            <i className="bi bi-list-columns-reverse fs-1" />
            <div className="empty-state-text">{t('log.empty')}</div>
            <div className="empty-state-hint">{t('log.emptyHint')}</div>
          </div>
        ) : (
          <table className="table table-borderless table-striped table-hover" id="logTable">
            <thead>
              <tr>
                <th scope="col">{t('log.time')}</th>
                <th scope="col">{t('log.method')}</th>
                <th scope="col">{t('log.host')}</th>
                <th scope="col">{t('log.path')}</th>
                <th scope="col">{t('log.status')}</th>
                <th scope="col" style={{ textAlign: 'right' }}>{t('log.latency')}</th>
              </tr>
            </thead>
            <tbody>
              {[...entries].reverse().map((entry) => (
                <tr key={entry.id}>
                  <td className="log-time-cell">{formatTime(entry.timestamp)}</td>
                  <td>
                    <span className={`badge badge-${entry.https ? 'https' : 'http'}`}>{entry.method}</span>
                  </td>
                  <td className="domain-cell">{entry.hostname}</td>
                  <td className="log-path-cell">{entry.path}</td>
                  <td>
                    <span className={`badge ${statusBadgeClass(entry.status)}`} title={entry.error || undefined}>
                      {entry.status ?? '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {entry.latencyMs != null ? `${entry.latencyMs} ms` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
