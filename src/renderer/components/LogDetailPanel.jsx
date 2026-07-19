import { useMemo } from 'react';
import Tooltip from './utilities/Tooltip.jsx';
import { useI18nT } from '../js/i18nContext.js';

const BODY_CAPTURE_LIMIT_KB = 64;

function statusBadgeClass(status) {
  if (status == null) return 'badge-status-pending';
  if (status >= 500) return 'badge-status-error';
  if (status >= 400) return 'badge-status-warn';
  if (status >= 300) return 'badge-status-redirect';
  return 'badge-status-ok';
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short'
  });
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

function QueryParamsTab({ entry, t }) {
  const params = useMemo(() => {
    const queryString = entry.path?.split('?')[1];
    if (!queryString) return [];
    // Key by name=value plus an occurrence counter so repeated pairs stay unique
    // without falling back to array indexes.
    const seen = new Map();
    return [...new URLSearchParams(queryString).entries()].map(([key, value]) => {
      const occurrence = (seen.get(`${key}=${value}`) ?? 0) + 1;
      seen.set(`${key}=${value}`, occurrence);
      return { key, value, id: `${key}=${value}#${occurrence}` };
    });
  }, [entry.path]);

  if (params.length === 0) {
    return <div className="log-details-empty">{t('log.details.noQueryParams')}</div>;
  }
  return (
    <table className="log-details-headers">
      <tbody>
        {params.map(({ key, value, id }) => (
          <tr key={id}>
            <th scope="row">{key}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function LogDetailPanel({ entry, settings, detailTab, setDetailTab, onClose, onConvertToMock }) {
  const t = useI18nT();
  const tabs = ['general', 'queryParams', 'headers', 'response'];
  const canConvert = !entry.websocket && entry.status != null;
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
        <div className="log-detail-bar-actions">
          <Tooltip title={t('log.actions.convertToMock')}>
            <button
              className="log-detail-convert"
              onClick={() => onConvertToMock(entry)}
              disabled={!canConvert}
              aria-label={t('log.actions.convertToMock')}
            >
              <i className="bi bi-magic" />
            </button>
          </Tooltip>
          <button className="log-detail-close" onClick={onClose} aria-label={t('log.detail.close')}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
      </div>
      <div className="log-detail-content">
        {detailTab === 'general' && <GeneralTab entry={entry} t={t} />}
        {detailTab === 'queryParams' && <QueryParamsTab entry={entry} t={t} />}
        {detailTab === 'headers' && <HeadersTab entry={entry} settings={settings} t={t} />}
        {detailTab === 'response' && <ResponseTab entry={entry} settings={settings} t={t} />}
      </div>
    </div>
  );
}
