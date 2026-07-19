import { memo } from 'react';
import PreferencesSection from './settings/PreferencesSection.jsx';
import ProxySection from './settings/ProxySection.jsx';
import RequestLogsSection from './settings/RequestLogsSection.jsx';
import HealthChecksSection from './settings/HealthChecksSection.jsx';
import CertificateSection from './settings/CertificateSection.jsx';
import { useI18nT } from '../js/i18nContext.js';

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
}) {
  const t = useI18nT();
  return (
    <div className="view active" id="view-settings">
      <header className="container-fluid p-0 mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="m-0">
              <i className="bi bi-gear-wide-connected me-2" />
              {t('settings.title')}
            </h4>
            <h6 className="subtitle">{t('settings.subtitle')}</h6>
          </div>
        </div>
      </header>

      <PreferencesSection
        settings={settings}
        locales={locales}
        onSettingsChange={onSettingsChange}
        onLocaleChange={onLocaleChange}
        onColorModeChange={onColorModeChange}
        showToast={showToast}
      />

      <ProxySection settings={settings} onSettingsChange={onSettingsChange} showToast={showToast} />

      <RequestLogsSection settings={settings} onSettingsChange={onSettingsChange} showToast={showToast} />

      <HealthChecksSection settings={settings} onSettingsChange={onSettingsChange} showToast={showToast} />

      <CertificateSection caPath={caPath} caExpiry={caExpiry} setCaExpiry={setCaExpiry} showToast={showToast} />
    </div>
  );
});
