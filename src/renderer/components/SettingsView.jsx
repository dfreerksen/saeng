import { useEffect, useState } from 'react';
import { getExpiryInfo } from '../js/utils.js';
import { getOS } from '../js/os.js';
import Tooltip from './Tooltip.jsx';

const LOG_MAX_ENTRIES_MIN = 100;
const LOG_MAX_ENTRIES_MAX = 100000;
const LOG_MAX_ENTRIES_STEP = 100;
const LOG_MAX_ENTRIES_DEFAULT = 300;

function clampLogMaxEntries(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return LOG_MAX_ENTRIES_DEFAULT;
  return Math.min(LOG_MAX_ENTRIES_MAX, Math.max(LOG_MAX_ENTRIES_MIN, parsed));
}

export default function SettingsView({
  active,
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

  useEffect(() => {
    setLogMaxEntriesDraft(String(settings.logMaxEntries ?? LOG_MAX_ENTRIES_DEFAULT));
  }, [settings.logMaxEntries]);

  function commitLogMaxEntries() {
    const clamped = clampLogMaxEntries(logMaxEntriesDraft);
    setLogMaxEntriesDraft(String(clamped));
    if (clamped !== settings.logMaxEntries) {
      onSettingsChange({ logMaxEntries: clamped });
    }
  }

  const expiryInfo = getExpiryInfo(caExpiry);
  const os = getOS();

  return (
    <div className={`view${active ? ' active' : ''}`} id="view-settings">
      <div className="view-header">
        <div>
          <div className="view-title">{t('settings.title')}</div>
          <div className="view-subtitle">{t('settings.subtitle')}</div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t('settings.preferences')}</div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">{t('settings.colorMode')}</div>
            <div className="setting-desc">{t('settings.colorModeDesc')}</div>
          </div>
          <select
            className="color-mode-select"
            value={settings.colorMode || 'auto'}
            onChange={(e) => onColorModeChange(e.target.value)}
          >
            <option value="auto">{t('settings.colorModeAuto')}</option>
            <option value="light">{t('settings.colorModeLight')}</option>
            <option value="dark">{t('settings.colorModeDark')}</option>
          </select>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">{t('settings.language')}</div>
            <div className="setting-desc">{t('settings.languageDesc')}</div>
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
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t('settings.proxy')}</div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">{t('settings.httpsEnabled')}</div>
            <div className="setting-desc">{t('settings.httpsEnabledDesc')}</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!settings.httpsEnabled}
              onChange={async (e) => {
                await onSettingsChange({ httpsEnabled: e.target.checked });
                showToast(
                  e.target.checked ? t('toast.httpsEnabled') : t('toast.httpsDisabled'),
                  'info'
                );
              }}
            />
            <span className="toggle-track" />
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">{t('settings.startOnLaunch')}</div>
            <div className="setting-desc">{t('settings.startOnLaunchDesc')}</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!settings.startOnLaunch}
              onChange={(e) => onSettingsChange({ startOnLaunch: e.target.checked })}
            />
            <span className="toggle-track" />
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">{t('settings.logMaxEntries')}</div>
            <div className="setting-desc">
              {t('settings.logMaxEntriesDesc', {
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
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t('settings.caTitle')}</div>

        <p
          style={{ fontSize: 13, color: 'var(--saeng-primary-complement-color)', marginBottom: 12, lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: t('settings.caDesc') }}
        />

        <div className="ca-info-box">{caPath || t('settings.caGenerating')}</div>
        {expiryInfo && (
          <div className={`ca-expiry${expiryInfo.urgency ? ` ca-expiry--${expiryInfo.urgency}` : ''}`}>
            {expiryInfo.text}
          </div>
        )}

        <Tooltip title={t('settings.revealCa')}>
          <button
            className="btn btn-outline-secondary"
            onClick={() => window.electronAPI.ssl.revealCA()}
          >
            <i className="bi bi-folder2-open" />
            <span className="d-none d-md-inline">{t('settings.revealCa')}</span>
          </button>
        </Tooltip>

        <Tooltip title={t('settings.trustCa')}>
          <button
            className="btn btn-outline-primary"
            disabled={trustingCA}
            onClick={async () => {
              setTrustingCA(true);
              const result = await window.electronAPI.ssl.trustCA();
              setTrustingCA(false);
              if (result.success) {
                showToast(t('toast.caTrusted'), 'success', 5000);
              } else {
                showToast(result.message, 'error', 6000);
              }
            }}
          >
            <i className="bi bi-shield-check" />
            <span className="d-none d-md-inline">
              {trustingCA ? t('settings.caInstalling') : t('settings.trustCa')}
            </span>
          </button>
        </Tooltip>

        <Tooltip title={t('settings.regenerateCa')}>
          <button
            className="btn btn-outline-warning"
            disabled={regeneratingCA}
            onClick={async () => {
              if (!confirm(t('settings.regenerateCaConfirm'))) return;
              setRegeneratingCA(true);
              const newExpiry = await window.electronAPI.ssl.regenerateCA();
              setCaExpiry(newExpiry);
              setRegeneratingCA(false);
              showToast(t('toast.caRegenerated'), 'success', 5000);
            }}
          >
            <i className="bi bi-arrow-repeat" />
            <span className="d-none d-md-inline">{t('settings.regenerateCa')}</span>
          </button>
        </Tooltip>

        <Tooltip title={t('settings.deleteCa')}>
          <button
            className="btn btn-outline-danger"
            disabled={deletingCA}
            onClick={async () => {
              if (!confirm(t('settings.deleteCaConfirm'))) return;
              setDeletingCA(true);
              const result = await window.electronAPI.ssl.deleteCA();
              setCaExpiry(null);
              setDeletingCA(false);
              showToast(t('toast.caDeleted'), 'info', 5000);
              if (result?.warning) showToast(result.warning, 'info', 6000);
            }}
          >
            <i className="bi bi-trash" />
            <span className="d-none d-md-inline">{t('settings.deleteCa')}</span>
          </button>
        </Tooltip>

        {os === 'mac' && (
          <p
            style={{ fontSize: 'var(--saeng-font-size-small)', color: 'var(--saeng-text-muted)', marginTop: 10 }}
            dangerouslySetInnerHTML={{ __html: t('settings.caPlatformNoteMac') }}
          />
        )}
        {os === 'windows' && (
          <p
            style={{ fontSize: 'var(--saeng-font-size-small)', color: 'var(--saeng-text-muted)', marginTop: 10 }}
            dangerouslySetInnerHTML={{ __html: t('settings.caPlatformNoteWindows') }}
          />
        )}
      </div>
    </div>
  );
}
