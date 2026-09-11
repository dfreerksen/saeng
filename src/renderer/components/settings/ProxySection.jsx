import { useState } from 'react';
import { useI18nT } from '../../js/i18nContext.js';

const PROXY_PORT_MIN = 1;
const PROXY_PORT_MAX = 65535;
const PROXY_PORT_DEFAULT = 8282;

// Mirrors PAC_PORT in src/proxy/manager.js — the PAC server always owns this
// port, so store.js silently rejects a proxyPort set to the same value.
const PAC_PORT = 8181;

function clampProxyPort(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return PROXY_PORT_DEFAULT;
  return Math.min(PROXY_PORT_MAX, Math.max(PROXY_PORT_MIN, parsed));
}

export default function ProxySection({ settings, onSettingsChange, showToast }) {
  const t = useI18nT();
  const [proxyPortDraft, setProxyPortDraft] = useState(
    String(settings.proxyPort ?? PROXY_PORT_DEFAULT)
  );

  // Re-sync the draft when the setting changes from outside this component
  // (adjust-state-during-render pattern, in place of a useEffect mirror).
  const [prevProxyPort, setPrevProxyPort] = useState(settings.proxyPort);
  if (settings.proxyPort !== prevProxyPort) {
    setPrevProxyPort(settings.proxyPort);
    setProxyPortDraft(String(settings.proxyPort ?? PROXY_PORT_DEFAULT));
  }

  function commitProxyPort() {
    const clamped = clampProxyPort(proxyPortDraft);
    if (clamped === PAC_PORT) {
      // store.js refuses this value (it's the fixed PAC server port) and
      // keeps the previous setting — reflect that instead of drifting.
      setProxyPortDraft(String(settings.proxyPort ?? PROXY_PORT_DEFAULT));
      showToast(t('flash.proxyPort.conflict', { port: PAC_PORT }), 'error');
      return;
    }
    setProxyPortDraft(String(clamped));
    if (clamped !== settings.proxyPort) {
      onSettingsChange({ proxyPort: clamped });
      showToast(t('flash.proxyPort.updated', { port: clamped }), 'info');
    }
  }

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

      <div className="setting-row">
        <div className="setting-info">
          <div className="setting-name">{t('settings.proxy.proxyPort.label')}</div>
          <div className="setting-desc">{t('settings.proxy.proxyPort.description')}</div>
        </div>
        <input
          className="proxy-port-input"
          type="number"
          min={PROXY_PORT_MIN}
          max={PROXY_PORT_MAX}
          value={proxyPortDraft}
          onChange={(e) => setProxyPortDraft(e.target.value)}
          onBlur={commitProxyPort}
        />
      </div>
    </div>
  );
}
