import { useState, useEffect, useCallback } from 'react';
import Titlebar from './Titlebar.jsx';
import Sidebar from './Sidebar.jsx';
import MappingsView from './MappingsView.jsx';
import SettingsView from './SettingsView.jsx';
import MappingModal from './MappingModal.jsx';
import AboutModal from './AboutModal.jsx';
import Toast from './Toast.jsx';
import { getOS } from '../js/os.js';

function applyColorMode(mode) {
  const resolved = mode === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  document.documentElement.setAttribute('data-bs-theme', resolved);
  localStorage.setItem('theme', mode);
}

export default function App() {
  const [proxyRunning, setProxyRunning] = useState(false);
  const [mappings, setMappings] = useState([]);
  const [settings, setSettingsState] = useState({});
  const [locales, setLocales] = useState([]);
  const [currentView, setCurrentView] = useState('mappings');
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [appVersion, setAppVersion] = useState('');
  const [electronVersion, setElectronVersion] = useState('');
  const [nodeVersion, setNodeVersion] = useState('');
  const [caPath, setCaPath] = useState('');
  const [caExpiry, setCaExpiry] = useState(null);
  const [i18nStrings, setI18nStrings] = useState({});

  const t = useCallback((key, vars) => {
    let str = i18nStrings[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${k}}`, String(v));
      }
    }
    return str;
  }, [i18nStrings]);

  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), duration);
  }, []);

  useEffect(() => {
    document.body.classList.add(getOS());

    async function init() {
      const strings = await window.electronAPI.i18n.getStrings();
      setI18nStrings(strings);

      const [status, mList, appInfo, caPathVal, caExpiryVal, settingsData, localeList] = await Promise.all([
        window.electronAPI.proxy.status(),
        window.electronAPI.mappings.list(),
        window.electronAPI.app.getInfo(),
        window.electronAPI.ssl.getCAPath(),
        window.electronAPI.ssl.getCAExpiry(),
        window.electronAPI.settings.get(),
        window.electronAPI.i18n.getLocales(),
      ]);

      setProxyRunning(status.running);
      setMappings(mList);
      setAppVersion(appInfo.version);
      setElectronVersion(appInfo.electron);
      setNodeVersion(appInfo.node);
      setCaPath(caPathVal);
      setCaExpiry(caExpiryVal);
      setSettingsState(settingsData);
      setLocales(localeList);

      applyColorMode(settingsData.colorMode || 'auto');

      const currentLocale = settingsData.locale || 'en';
      const localeInfo = localeList.find((l) => l.code === currentLocale);
      document.documentElement.lang = currentLocale;
      document.documentElement.dir = localeInfo?.dir ?? 'ltr';
    }

    init();

    window.electronAPI.proxy.onStatusChanged((data) => {
      setProxyRunning(data.running);
    });

    function handleExternalLinks(e) {
      const anchor = e.target.closest('a[href]');
      if (!anchor) return;
      const url = anchor.href;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        e.preventDefault();
        window.electronAPI.app.openExternal(url);
      }
    }
    document.addEventListener('click', handleExternalLinks);
    return () => document.removeEventListener('click', handleExternalLinks);
  }, []);

  async function handleProxyToggle() {
    if (proxyRunning) {
      const result = await window.electronAPI.proxy.stop();
      if (result.success) {
        setProxyRunning(false);
        showToast(t('toast.proxyStopped'), 'info');
      } else {
        showToast(t('toast.proxyStopFailed', { error: result.error }), 'error');
      }
    } else {
      const result = await window.electronAPI.proxy.start();
      if (result.success) {
        setProxyRunning(true);
        showToast(t('toast.proxyStarted'), 'success');
      } else {
        showToast(t('toast.proxyStartFailed', { error: result.error }), 'error');
      }
    }
  }

  async function updateSettings(patch) {
    await window.electronAPI.settings.set(patch);
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }

  async function handleLocaleChange(locale) {
    const localeInfo = locales.find((l) => l.code === locale);
    const strings = await window.electronAPI.i18n.setLocale(locale);
    setI18nStrings(strings);
    document.documentElement.lang = locale;
    document.documentElement.dir = localeInfo?.dir ?? 'ltr';
    await updateSettings({ locale });
  }

  async function handleColorModeChange(mode) {
    await updateSettings({ colorMode: mode });
    applyColorMode(mode);
  }

  return (
    <div className="app">
      <Titlebar proxyRunning={proxyRunning} t={t} />
      <div className="main-layout">
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          proxyRunning={proxyRunning}
          onProxyToggle={handleProxyToggle}
          onAbout={() => setModal({ type: 'about' })}
          t={t}
        />
        <main className="content">
          <MappingsView
            active={currentView === 'mappings'}
            mappings={mappings}
            setMappings={setMappings}
            settings={settings}
            onAdd={() => setModal({ type: 'add' })}
            onEdit={(mapping) => setModal({ type: 'edit', mapping })}
            showToast={showToast}
            t={t}
          />
          <SettingsView
            active={currentView === 'settings'}
            settings={settings}
            locales={locales}
            caPath={caPath}
            caExpiry={caExpiry}
            setCaExpiry={setCaExpiry}
            onSettingsChange={updateSettings}
            onLocaleChange={handleLocaleChange}
            onColorModeChange={handleColorModeChange}
            showToast={showToast}
            t={t}
          />
        </main>
      </div>

      {modal?.type === 'add' && (
        <MappingModal
          mappings={mappings}
          onClose={() => setModal(null)}
          onSubmit={async (data) => {
            const updated = await window.electronAPI.mappings.add(data);
            setMappings(updated);
            setModal(null);
            showToast(t('toast.mappingAdded', { domain: data.domain, host: data.host, port: data.port }), 'success');
          }}
          t={t}
        />
      )}

      {modal?.type === 'edit' && (
        <MappingModal
          mapping={modal.mapping}
          mappings={mappings}
          onClose={() => setModal(null)}
          onSubmit={async (data) => {
            const updated = await window.electronAPI.mappings.update(modal.mapping.id, data);
            setMappings(updated);
            setModal(null);
            showToast(t('toast.mappingUpdated', { domain: data.domain, host: data.host, port: data.port }), 'success');
          }}
          t={t}
        />
      )}

      {modal?.type === 'about' && (
        <AboutModal
          version={appVersion}
          electronVersion={electronVersion}
          nodeVersion={nodeVersion}
          onClose={() => setModal(null)}
          t={t}
        />
      )}

      <Toast toasts={toasts} />
    </div>
  );
}
