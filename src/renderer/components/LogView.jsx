import { Fragment, useState } from 'react';

const BODY_CAPTURE_LIMIT_KB = 64;

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

function hasDetails(entry) {
  return !!(entry.requestHeaders || entry.responseHeaders
    || entry.requestBody !== undefined || entry.responseBody !== undefined);
}

function HeadersTable({ headers, t }) {
  const names = headers ? Object.keys(headers) : [];
  if (names.length === 0) {
    return <div className="log-details-empty">{t('log.details.noHeaders')}</div>;
  }
  return (
    <table className="log-details-headers">
      <tbody>
        {names.map((name) => (
          <tr key={name}>
            <th scope="row">{name}</th>
            <td>{Array.isArray(headers[name]) ? headers[name].join(', ') : String(headers[name])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BodyContent({ body, truncated, t }) {
  if (body === undefined) {
    return <div className="log-details-empty">{t('log.details.noBody')}</div>;
  }
  if (body === '') {
    return <div className="log-details-empty">{t('log.details.emptyBody')}</div>;
  }
  return (
    <>
      <pre className="log-details-body">{body}</pre>
      {truncated && (
        <div className="log-details-truncated">{t('log.details.truncated', { size: BODY_CAPTURE_LIMIT_KB })}</div>
      )}
    </>
  );
}

export default function LogView({ active, entries, onClear, onExportHar, settings, t }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const showDetails = !!(settings?.logHeadersEnabled || settings?.logBodyEnabled);

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={`view${active ? ' active' : ''}`} id="view-log">
      <div className="view-header">
        <div>
          <div className="view-title">{t('log.title')}</div>
          <div className="view-subtitle">{t('log.subtitle')}</div>
        </div>
        <div className="view-header-actions">
          <button className="btn btn-outline-secondary" onClick={onExportHar} disabled={entries.length === 0}>
            <i className="bi bi-download" />
            <span>{t('log.actions.exportHar')}</span>
          </button>
          <button className="btn btn-outline-secondary" onClick={onClear} disabled={entries.length === 0}>
            <i className="bi bi-trash" />
            <span>{t('log.actions.clear')}</span>
          </button>
        </div>
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
                <th scope="col">{t('log.table.time')}</th>
                <th scope="col">{t('log.table.method')}</th>
                <th scope="col">{t('log.table.host')}</th>
                <th scope="col">{t('log.table.path')}</th>
                <th scope="col">{t('log.table.status')}</th>
                <th scope="col" className="text-end">{t('log.table.latency')}</th>
                {showDetails && <th scope="col" />}
              </tr>
            </thead>
            <tbody>
              {[...entries].reverse().map((entry) => {
                const expandable = showDetails && hasDetails(entry);
                const isExpanded = expandable && expandedIds.has(entry.id);
                return (
                  <Fragment key={entry.id}>
                    <tr>
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
                        {entry.mocked && (
                          <span className="badge badge-mock">{t('log.table.mock')}</span>
                        )}
                      </td>
                      <td className="text-end">
                        {entry.latencyMs != null ? `${entry.latencyMs} ms` : '—'}
                      </td>
                      {showDetails && (
                        <td className="text-end">
                          {expandable && (
                            <button
                              className="btn btn-sm btn-link log-details-toggle"
                              onClick={() => toggleExpanded(entry.id)}
                              aria-label={t(isExpanded ? 'log.actions.collapse' : 'log.actions.expand')}
                              aria-expanded={isExpanded}
                            >
                              <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'}`} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                    {isExpanded && (
                      <tr className="log-details-row">
                        <td colSpan={7}>
                          <div className="log-details">
                            {settings?.logHeadersEnabled && (
                              <div className="log-details-section">
                                <div className="log-details-title">{t('log.details.requestHeaders')}</div>
                                <HeadersTable headers={entry.requestHeaders} t={t} />
                              </div>
                            )}
                            {settings?.logHeadersEnabled && (
                              <div className="log-details-section">
                                <div className="log-details-title">{t('log.details.responseHeaders')}</div>
                                <HeadersTable headers={entry.responseHeaders} t={t} />
                              </div>
                            )}
                            {settings?.logBodyEnabled && (
                              <div className="log-details-section">
                                <div className="log-details-title">{t('log.details.requestBody')}</div>
                                <BodyContent body={entry.requestBody} truncated={entry.requestBodyTruncated} t={t} />
                              </div>
                            )}
                            {settings?.logBodyEnabled && (
                              <div className="log-details-section">
                                <div className="log-details-title">{t('log.details.responseBody')}</div>
                                <BodyContent body={entry.responseBody} truncated={entry.responseBodyTruncated} t={t} />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
