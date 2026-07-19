import { useState } from 'react';
import { useI18nT } from '../../js/i18nContext.js';

const LOG_MAX_ENTRIES_MIN = 100;
const LOG_MAX_ENTRIES_MAX = 100000;
const LOG_MAX_ENTRIES_STEP = 100;
const LOG_MAX_ENTRIES_DEFAULT = 300;

const BODY_CAPTURE_LIMIT_KB = 64;

function clampLogMaxEntries(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return LOG_MAX_ENTRIES_DEFAULT;
  return Math.min(LOG_MAX_ENTRIES_MAX, Math.max(LOG_MAX_ENTRIES_MIN, parsed));
}

export default function RequestLogsSection({ settings, onSettingsChange, showToast }) {
  const t = useI18nT();
  const [logMaxEntriesDraft, setLogMaxEntriesDraft] = useState(
    String(settings.logMaxEntries ?? LOG_MAX_ENTRIES_DEFAULT)
  );

  // Re-sync the draft when the setting changes from outside this component
  // (adjust-state-during-render pattern, in place of a useEffect mirror).
  const [prevLogMaxEntries, setPrevLogMaxEntries] = useState(settings.logMaxEntries);
  if (settings.logMaxEntries !== prevLogMaxEntries) {
    setPrevLogMaxEntries(settings.logMaxEntries);
    setLogMaxEntriesDraft(String(settings.logMaxEntries ?? LOG_MAX_ENTRIES_DEFAULT));
  }

  function commitLogMaxEntries() {
    const clamped = clampLogMaxEntries(logMaxEntriesDraft);
    setLogMaxEntriesDraft(String(clamped));
    if (clamped !== settings.logMaxEntries) {
      onSettingsChange({ logMaxEntries: clamped });
      showToast(t('flash.settings.updated'), 'info');
    }
  }

  return (
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
  );
}
