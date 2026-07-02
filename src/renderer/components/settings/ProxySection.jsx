export default function ProxySection({ settings, onSettingsChange, showToast, t }) {
  return (
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
  );
}
