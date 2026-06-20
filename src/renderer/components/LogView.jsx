import { useState } from 'react';
import { FILTER_TABS, matchesFilter } from '../js/logFilter.js';
import Tooltip from './Tooltip.jsx';

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

function GeneralTab({ entry, t }) {
  return (
    <table className="log-detail-info">
      <tbody>
        <tr>
          <th>{t('log.detail.requestUrl')}</th>
          <td className="log-detail-url">{`${entry.https ? 'https' : 'http'}://${entry.hostname}${entry.path}`}</td>
        </tr>
        <tr>
          <th>{t('log.detail.requestMethod')}</th>
          <td>{entry.method}</td>
        </tr>
        <tr>
          <th>{t('log.detail.statusCode')}</th>
          <td>
            <span className={`badge ${statusBadgeClass(entry.status)}`}>{entry.status ?? '—'}</span>
            {entry.error && <span className="log-detail-error">{entry.error}</span>}
          </td>
        </tr>
        <tr>
          <th>{t('log.detail.protocol')}</th>
          <td>{entry.https ? 'HTTPS' : 'HTTP'}{entry.websocket ? ' (WebSocket)' : ''}</td>
        </tr>
        <tr>
          <th>{t('log.table.time')}</th>
          <td>{formatTime(entry.timestamp)}</td>
        </tr>
        <tr>
          <th>{t('log.table.latency')}</th>
          <td>{entry.latencyMs != null ? `${entry.latencyMs} ms` : '—'}</td>
        </tr>
      </tbody>
    </table>
  );
}

function HeadersTab({ entry, settings, t }) {
  if (!settings?.logHeadersEnabled) {
    return <div className="log-detail-hint">{t('log.detail.enableHeaders')}</div>;
  }
  return (
    <div className="log-detail-sections">
      <details open>
        <summary>{t('log.details.requestHeaders')}</summary>
        <HeadersTable headers={entry.requestHeaders} t={t} />
      </details>
      <details open>
        <summary>{t('log.details.responseHeaders')}</summary>
        <HeadersTable headers={entry.responseHeaders} t={t} />
      </details>
    </div>
  );
}

function ResponseTab({ entry, settings, t }) {
  if (!settings?.logBodyEnabled) {
    return <div className="log-detail-hint">{t('log.detail.enableBody')}</div>;
  }
  return (
    <div className="log-detail-sections">
      <details open>
        <summary>{t('log.details.requestBody')}</summary>
        <BodyContent body={entry.requestBody} truncated={entry.requestBodyTruncated} t={t} />
      </details>
      <details open>
        <summary>{t('log.details.responseBody')}</summary>
        <BodyContent body={entry.responseBody} truncated={entry.responseBodyTruncated} t={t} />
      </details>
    </div>
  );
}

function DetailPanel({ entry, settings, detailTab, setDetailTab, onClose, t }) {
  const tabs = ['general', 'headers', 'response'];
  return (
    <div className="log-detail-panel">
      <div className="log-detail-bar">
        <div className="log-detail-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`log-detail-tab${detailTab === tab ? ' active' : ''}`}
              onClick={() => setDetailTab(tab)}
            >
              {t(`log.detail.${tab}`)}
            </button>
          ))}
        </div>
        <button className="log-detail-close" onClick={onClose} aria-label={t('log.detail.close')}>
          <i className="bi bi-x-lg" />
        </button>
      </div>
      <div className="log-detail-content">
        {detailTab === 'general' && <GeneralTab entry={entry} t={t} />}
        {detailTab === 'headers' && <HeadersTab entry={entry} settings={settings} t={t} />}
        {detailTab === 'response' && <ResponseTab entry={entry} settings={settings} t={t} />}
      </div>
    </div>
  );
}

export default function LogView({ active, entries, onClear, onExportHar, settings, t }) {
  const [selectedId, setSelectedId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [detailTab, setDetailTab] = useState('general');

  const filteredEntries = activeFilter === 'all'
    ? entries
    : entries.filter((e) => matchesFilter(e, activeFilter));

  const reversedEntries = [...filteredEntries].reverse();

  const selectedEntry = selectedId != null
    ? entries.find((e) => e.id === selectedId) ?? null
    : null;

  function selectEntry(id) {
    if (selectedId === id) {
      setSelectedId(null);
    } else {
      setSelectedId(id);
      setDetailTab('general');
    }
  }

  return (
    <div className={`view${active ? ' active' : ''}`} id="view-log">
      <header className="container-fluid p-0 mb-3">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="m-0">{t('log.title')}</h4>
            <h6 className="subtitle">{t('log.subtitle')}</h6>
          </div>
          <div class="btn-group" role="group" aria-label="Actions">
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
          <i className="bi bi-funnel fs-1" />
          <div className="empty-state-text">{t('log.filterEmpty')}</div>
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
            <DetailPanel
              entry={selectedEntry}
              settings={settings}
              detailTab={detailTab}
              setDetailTab={setDetailTab}
              onClose={() => setSelectedId(null)}
              t={t}
            />
          )}
        </div>
      )}
    </div>
  );
}
