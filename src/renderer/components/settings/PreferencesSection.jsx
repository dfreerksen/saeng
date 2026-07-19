import { getOS } from '../../js/os.js';

export default function PreferencesSection({ settings, locales, onSettingsChange, onLocaleChange, onColorModeChange, showToast, t }) {
  const os = getOS();

  return (
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
          <div className="setting-name">{t('settings.preferences.dashboard.label')}</div>
          <div className="setting-desc">{t('settings.preferences.dashboard.description')}</div>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={!!settings.dashboardEnabled}
            onChange={async (e) => {
              const checked = e.target.checked;
              await onSettingsChange({ dashboardEnabled: checked });
              showToast(checked ? t('flash.dashboard.enabled') : t('flash.dashboard.disabled'), 'info');
            }}
          />
          <span className="toggle-track" />
        </label>
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
  );
}
