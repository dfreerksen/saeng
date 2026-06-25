import { memo, useEffect, useState } from 'react';
import { getExpiryInfo } from '../js/utils.js';
import { getOS } from '../js/os.js';
import Tooltip from './Tooltip.jsx';

const LOG_MAX_ENTRIES_MIN = 100;
const LOG_MAX_ENTRIES_MAX = 100000;
const LOG_MAX_ENTRIES_STEP = 100;
const LOG_MAX_ENTRIES_DEFAULT = 300;

const HEALTH_CHECK_INTERVAL_MIN_S = 5;
const HEALTH_CHECK_INTERVAL_MAX_S = 300;
const HEALTH_CHECK_INTERVAL_DEFAULT_S = 15;

const HEALTH_CHECK_TIMEOUT_MIN_MS = 500;
const HEALTH_CHECK_TIMEOUT_MAX_MS = 30000;
const HEALTH_CHECK_TIMEOUT_STEP_MS = 100;
const HEALTH_CHECK_TIMEOUT_DEFAULT_MS = 2000;

const BODY_CAPTURE_LIMIT_KB = 64;

function clampLogMaxEntries(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return LOG_MAX_ENTRIES_DEFAULT;
  return Math.min(LOG_MAX_ENTRIES_MAX, Math.max(LOG_MAX_ENTRIES_MIN, parsed));
}

function clampHealthCheckIntervalSeconds(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return HEALTH_CHECK_INTERVAL_DEFAULT_S;
  return Math.min(HEALTH_CHECK_INTERVAL_MAX_S, Math.max(HEALTH_CHECK_INTERVAL_MIN_S, parsed));
}

function clampHealthCheckTimeoutMs(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return HEALTH_CHECK_TIMEOUT_DEFAULT_MS;
  return Math.min(HEALTH_CHECK_TIMEOUT_MAX_MS, Math.max(HEALTH_CHECK_TIMEOUT_MIN_MS, parsed));
}

export default memo(function SettingsView({
  settings,
  locales,
  caPath,
  caExpiry,
  setCaExpiry,
  onSettingsChange,
  onLocaleChange,
  onColorModeChange,
  showToast,
  t,
}) {
  const [trustingCA, setTrustingCA] = useState(false);
  const [regeneratingCA, setRegeneratingCA] = useState(false);
  const [deletingCA, setDeletingCA] = useState(false);
  const [logMaxEntriesDraft, setLogMaxEntriesDraft] = useState(
    String(settings.logMaxEntries ?? LOG_MAX_ENTRIES_DEFAULT)
  );
  const [healthCheckIntervalDraft, setHealthCheckIntervalDraft] = useState(
    String(Math.round((settings.healthCheckIntervalMs ?? HEALTH_CHECK_INTERVAL_DEFAULT_S * 1000) / 1000))
  );
  const [healthCheckTimeoutDraft, setHealthCheckTimeoutDraft] = useState(
    String(settings.healthCheckTimeoutMs ?? HEALTH_CHECK_TIMEOUT_DEFAULT_MS)
  );

  useEffect(() => {
    setLogMaxEntriesDraft(String(settings.logMaxEntries ?? LOG_MAX_ENTRIES_DEFAULT));
  }, [settings.logMaxEntries]);

  useEffect(() => {
    setHealthCheckIntervalDraft(
      String(Math.round((settings.healthCheckIntervalMs ?? HEALTH_CHECK_INTERVAL_DEFAULT_S * 1000) / 1000))
    );
  }, [settings.healthCheckIntervalMs]);

  useEffect(() => {
    setHealthCheckTimeoutDraft(String(settings.healthCheckTimeoutMs ?? HEALTH_CHECK_TIMEOUT_DEFAULT_MS));
  }, [settings.healthCheckTimeoutMs]);

  function commitLogMaxEntries() {
    const clamped = clampLogMaxEntries(logMaxEntriesDraft);
    setLogMaxEntriesDraft(String(clamped));
    if (clamped !== settings.logMaxEntries) {
      onSettingsChange({ logMaxEntries: clamped });
      showToast(t('flash.settings.updated'), 'info');
    }
  }

  function commitHealthCheckInterval() {
    const clampedSeconds = clampHealthCheckIntervalSeconds(healthCheckIntervalDraft);
    setHealthCheckIntervalDraft(String(clampedSeconds));
    const ms = clampedSeconds * 1000;
    if (ms !== settings.healthCheckIntervalMs) {
      onSettingsChange({ healthCheckIntervalMs: ms });
      showToast(t('flash.settings.updated'), 'info');
    }
  }

  function commitHealthCheckTimeout() {
    const clamped = clampHealthCheckTimeoutMs(healthCheckTimeoutDraft);
    setHealthCheckTimeoutDraft(String(clamped));
    if (clamped !== settings.healthCheckTimeoutMs) {
      onSettingsChange({ healthCheckTimeoutMs: clamped });
      showToast(t('flash.settings.updated'), 'info');
    }
  }

  const expiryInfo = getExpiryInfo(caExpiry);
  const os = getOS();

  return (
    <div className="view active" id="view-settings">
      <header className="container-fluid p-0 mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="m-0">{t('settings.title')}</h4>
            <h6 className="subtitle">{t('settings.subtitle')}</h6>
          </div>
        </div>
      </header>

      <div className="settings-section">
        <div className="settings-section-title">{t('settings.preferences.title')}</div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">{t('settings.preferences.colorMode.label')}</div>
            <div className="setting-desc">{t('settings.preferences.colorMode.description')}</div>
          </div>
          <select
            className="color-mode-select"
            value={settings.colorMode || 'auto'}
            onChange={(e) => onColorModeChange(e.target.value)}
          >
            <option value="auto">{t('settings.preferences.colorMode.options.auto')}</option>
            <option value="light">{t('settings.preferences.colorMode.options.light')}</option>
            <option value="dark">{t('settings.preferences.colorMode.options.dark')}</option>
          </select>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">{t('settings.preferences.language.label')}</div>
            <div className="setting-desc">{t('settings.preferences.language.description')}</div>
          </div>
          <select
            className="locale-select"
            value={settings.locale || 'en'}
            onChange={(e) => onLocaleChange(e.target.value)}
          >
            {locales.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">{t('settings.preferences.iconMode.label')}</div>
            <div className="setting-desc">{t('settings.preferences.iconMode.description')}</div>
          </div>
          <select
            className="icon-mode-select"
            value={settings.iconMode || 'both'}
            onChange={async (e) => {
              await onSettingsChange({ iconMode: e.target.value });
              showToast(t('flash.settings.updated'), 'info');
            }}
          >
            <option value="both">{t(`settings.preferences.iconMode.options.both.${os}`)}</option>
            <option value="tray">{t(`settings.preferences.iconMode.options.tray.${os}`)}</option>
            <option value="dock">{t(`settings.preferences.iconMode.options.dock.${os}`)}</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t('settings.proxy.title')}</div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">{t('settings.proxy.httpsEnabled.label')}</div>
            <div className="setting-desc">{t('settings.proxy.httpsEnabled.description')}</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!settings.httpsEnabled}
              onChange={async (e) => {
                const checked = e.target.checked;
                await onSettingsChange({ httpsEnabled: checked });
                showToast(checked ? t('flash.https.enabled') : t('flash.https.disabled'), 'info');
              }}
            />
            <span className="toggle-track" />
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">{t('settings.proxy.startOnLaunch.label')}</div>
            <div className="setting-desc">{t('settings.proxy.startOnLaunch.description')}</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!settings.startOnLaunch}
              onChange={async (e) => {
                await onSettingsChange({ startOnLaunch: e.target.checked });
                showToast(t('flash.settings.updated'), 'info');
              }}
            />
            <span className="toggle-track" />
          </label>
        </div>

      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t('settings.requestLogs.title')}</div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">{t('settings.requestLogs.logRequests.label')}</div>
            <div className="setting-desc">{t('settings.requestLogs.logRequests.description')}</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!settings.loggingEnabled}
              onChange={async (e) => {
                const checked = e.target.checked;
                await onSettingsChange({ loggingEnabled: checked });
                showToast(checked ? t('flash.logging.enabled') : t('flash.logging.disabled'), 'info');
              }}
            />
            <span className="toggle-track" />
          </label>
        </div>

        {settings.loggingEnabled && (
          <>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-name">{t('settings.requestLogs.logMaxEntries.label')}</div>
                <div className="setting-desc">
                  {t('settings.requestLogs.logMaxEntries.description', {
                    min: LOG_MAX_ENTRIES_MIN.toLocaleString(),
                    max: LOG_MAX_ENTRIES_MAX.toLocaleString(),
                  })}
                </div>
              </div>
              <input
                className="log-max-entries-input"
                type="number"
                min={LOG_MAX_ENTRIES_MIN}
                max={LOG_MAX_ENTRIES_MAX}
                step={LOG_MAX_ENTRIES_STEP}
                value={logMaxEntriesDraft}
                onChange={(e) => setLogMaxEntriesDraft(e.target.value)}
                onBlur={commitLogMaxEntries}
              />
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-name">{t('settings.requestLogs.logHeaders.label')}</div>
                <div className="setting-desc">{t('settings.requestLogs.logHeaders.description')}</div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={!!settings.logHeadersEnabled}
                  onChange={async (e) => {
                    const checked = e.target.checked;
                    await onSettingsChange({ logHeadersEnabled: checked });
                    showToast(checked ? t('flash.logHeaders.enabled') : t('flash.logHeaders.disabled'), 'info');
                  }}
                />
                <span className="toggle-track" />
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-name">{t('settings.requestLogs.logBody.label')}</div>
                <div className="setting-desc">
                  {t('settings.requestLogs.logBody.description', { size: BODY_CAPTURE_LIMIT_KB })}
                </div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={!!settings.logBodyEnabled}
                  onChange={async (e) => {
                    const checked = e.target.checked;
                    await onSettingsChange({ logBodyEnabled: checked });
                    showToast(checked ? t('flash.logBody.enabled') : t('flash.logBody.disabled'), 'info');
                  }}
                />
                <span className="toggle-track" />
              </label>
            </div>
          </>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t('settings.healthChecks.title')}</div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">{t('settings.healthChecks.enableCheck.label')}</div>
            <div className="setting-desc">{t('settings.healthChecks.enableCheck.description')}</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!settings.healthCheckEnabled}
              onChange={async (e) => {
                const checked = e.target.checked;
                await onSettingsChange({ healthCheckEnabled: checked });
                showToast(checked ? t('flash.healthCheck.enabled') : t('flash.healthCheck.disabled'), 'info');
              }}
            />
            <span className="toggle-track" />
          </label>
        </div>

        {settings.healthCheckEnabled && (
          <>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-name">{t('settings.healthChecks.interval.label')}</div>
                <div className="setting-desc">
                  {t('settings.healthChecks.interval.description', {
                    min: HEALTH_CHECK_INTERVAL_MIN_S,
                    max: HEALTH_CHECK_INTERVAL_MAX_S,
                  })}
                </div>
              </div>
              <input
                className="health-check-interval-input"
                type="number"
                min={HEALTH_CHECK_INTERVAL_MIN_S}
                max={HEALTH_CHECK_INTERVAL_MAX_S}
                value={healthCheckIntervalDraft}
                onChange={(e) => setHealthCheckIntervalDraft(e.target.value)}
                onBlur={commitHealthCheckInterval}
              />
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-name">{t('settings.healthChecks.timeout.label')}</div>
                <div className="setting-desc">
                  {t('settings.healthChecks.timeout.description', {
                    min: HEALTH_CHECK_TIMEOUT_MIN_MS,
                    max: HEALTH_CHECK_TIMEOUT_MAX_MS,
                  })}
                </div>
              </div>
              <input
                className="health-check-timeout-input"
                type="number"
                min={HEALTH_CHECK_TIMEOUT_MIN_MS}
                max={HEALTH_CHECK_TIMEOUT_MAX_MS}
                step={HEALTH_CHECK_TIMEOUT_STEP_MS}
                value={healthCheckTimeoutDraft}
                onChange={(e) => setHealthCheckTimeoutDraft(e.target.value)}
                onBlur={commitHealthCheckTimeout}
              />
            </div>
          </>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t('settings.cert.title')}</div>

        <p className="cert-description">
          {t('settings.cert.description')}
        </p>

        <div className="ca-info-box">{caPath || t('settings.cert.actions.generating')}</div>
        {expiryInfo && (
          <div className={`ca-expiry${expiryInfo.urgency ? ` ca-expiry--${expiryInfo.urgency}` : ''}`}>
            {expiryInfo.text}
          </div>
        )}

        <div className="btn-group" role="group" aria-label="Certificate Actions">
          <Tooltip title={t(`settings.cert.actions.show.${os}`)}>
            <button
              className="btn btn-outline-secondary"
              onClick={() => window.electronAPI.ssl.revealCA()}
            >
              <i className="bi bi-folder2-open" />
              <span className="ms-2 d-none d-lg-inline">{t(`settings.cert.actions.show.${os}`)}</span>
            </button>
          </Tooltip>

          <Tooltip title={t('settings.cert.actions.install')}>
            <button
              className="btn btn-outline-primary"
              disabled={trustingCA}
              onClick={async () => {
                setTrustingCA(true);
                const result = await window.electronAPI.ssl.trustCA();
                setTrustingCA(false);
                if (result.success) {
                  showToast(t('flash.ca.trusted'), 'success', 5000);
                } else {
                  showToast(result.message, 'error', 6000);
                }
              }}
            >
              <i className="bi bi-shield-check" />
              <span className="ms-2 d-none d-lg-inline">
                {trustingCA ? t('settings.cert.actions.installing') : t('settings.cert.actions.install')}
              </span>
            </button>
          </Tooltip>

          <Tooltip title={t('settings.cert.actions.regenerate')}>
            <button
              className="btn btn-outline-warning"
              disabled={regeneratingCA}
              onClick={async () => {
                if (!confirm(t('settings.cert.confirm.regenerate'))) return;
                setRegeneratingCA(true);
                const newExpiry = await window.electronAPI.ssl.regenerateCA();
                setCaExpiry(newExpiry);
                setRegeneratingCA(false);
                showToast(t('flash.ca.regenerated'), 'success', 5000);
              }}
            >
              <i className="bi bi-arrow-repeat" />
              <span className="ms-2 d-none d-lg-inline">{t('settings.cert.actions.regenerate')}</span>
            </button>
          </Tooltip>

          <Tooltip title={t('settings.cert.actions.delete')}>
            <button
              className="btn btn-outline-danger"
              disabled={deletingCA}
              onClick={async () => {
                if (!confirm(t('settings.cert.confirm.delete'))) return;
                setDeletingCA(true);
                const result = await window.electronAPI.ssl.deleteCA();
                setCaExpiry(null);
                setDeletingCA(false);
                showToast(t('flash.ca.deleted'), 'info', 5000);
                if (result?.warning) showToast(result.warning, 'info', 6000);
              }}
            >
              <i className="bi bi-trash" />
              <span className="ms-2 d-none d-lg-inline">{t('settings.cert.actions.delete')}</span>
            </button>
          </Tooltip>
        </div>

        <p className="cert-platform-note">{t(`settings.cert.platformNote.${os}`)}</p>
      </div>
    </div>
  );
});
