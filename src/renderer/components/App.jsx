import { useState, useEffect, useCallback, useRef } from 'react';
import Titlebar from './Titlebar.jsx';
import Sidebar from './Sidebar.jsx';
import MappingsView from './MappingsView.jsx';
import MocksView from './MocksView.jsx';
import LogView from './LogView.jsx';
import SettingsView from './SettingsView.jsx';
import MappingModal from './MappingModal.jsx';
import MockModal from './MockModal.jsx';
import ExportModal from './ExportModal.jsx';
import AboutModal from './AboutModal.jsx';
import Toast from './Toast.jsx';
import { getOS } from '../js/os.js';

const DEFAULT_LOG_MAX_ENTRIES = 300;

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
  const [mocks, setMocks] = useState([]);
  const [requestLog, setRequestLog] = useState([]);
  const [healthStatuses, setHealthStatuses] = useState({});
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
  const [updateInfo, setUpdateInfo] = useState({ updateAvailable: false, latestVersion: null, url: null });
  const [i18nStrings, setI18nStrings] = useState({});
  const logMaxEntriesRef = useRef(DEFAULT_LOG_MAX_ENTRIES);

  useEffect(() => {
    const max = settings.logMaxEntries || DEFAULT_LOG_MAX_ENTRIES;
    logMaxEntriesRef.current = max;
    setRequestLog((prev) => (prev.length > max ? prev.slice(prev.length - max) : prev));
  }, [settings.logMaxEntries]);

  useEffect(() => {
    if (currentView === 'log' && settings.loggingEnabled === false) {
      setCurrentView('mappings');
    }
  }, [currentView, settings.loggingEnabled]);

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

      const [status, mList, mocksList, logEntries, healthList, appInfo, caPathVal, caExpiryVal, settingsData, localeList, updateStatus] = await Promise.all([
        window.electronAPI.proxy.status(),
        window.electronAPI.mappings.list(),
        window.electronAPI.mocks.list(),
        window.electronAPI.requestLog.list(),
        window.electronAPI.health.list(),
        window.electronAPI.app.getInfo(),
        window.electronAPI.ssl.getCAPath(),
        window.electronAPI.ssl.getCAExpiry(),
        window.electronAPI.settings.get(),
        window.electronAPI.i18n.getLocales(),
        window.electronAPI.update.getStatus(),
      ]);

      setProxyRunning(status.running);
      setMappings(mList);
      setMocks(mocksList);
      setRequestLog(logEntries);
      setHealthStatuses(healthList);
      setAppVersion(appInfo.version);
      setElectronVersion(appInfo.electron);
      setNodeVersion(appInfo.node);
      setCaPath(caPathVal);
      setCaExpiry(caExpiryVal);
      setSettingsState(settingsData);
      setLocales(localeList);
      setUpdateInfo(updateStatus);

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

    window.electronAPI.requestLog.onEntry((entry) => {
      setRequestLog((prev) => {
        const next = [...prev, entry];
        const max = logMaxEntriesRef.current;
        return next.length > max ? next.slice(next.length - max) : next;
      });
    });

    window.electronAPI.health.onUpdate((result) => {
      setHealthStatuses((prev) => ({ ...prev, [result.id]: result }));
    });

    window.electronAPI.update.onStatus((status) => {
      setUpdateInfo(status);
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
        showToast(t('flash.proxy.stopped'), 'info');
      } else {
        showToast(t('flash.proxy.stopFailed', { error: result.error }), 'error');
      }
    } else {
      const result = await window.electronAPI.proxy.start();
      if (result.success) {
        setProxyRunning(true);
        showToast(t('flash.proxy.started'), 'success');
      } else {
        showToast(t('flash.proxy.startFailed', { error: result.error }), 'error');
      }
    }
  }

  async function handleImportMappings() {
    const result = await window.electronAPI.mappings.import();
    if (result.canceled) return;
    if (result.success) {
      setMappings(result.mappings);
      showToast(t('flash.import.success', { added: result.added, skipped: result.skipped }), result.added > 0 ? 'success' : 'info');
    } else {
      showToast(t('flash.import.error', { error: result.error }), 'error');
    }
  }

  async function handleImportMocks() {
    const result = await window.electronAPI.mocks.import();
    if (result.canceled) return;
    if (result.success) {
      setMocks(result.mocks);
      showToast(t('flash.mocksImport.success', { added: result.added, skipped: result.skipped }), result.added > 0 ? 'success' : 'info');
    } else {
      showToast(t('flash.mocksImport.error', { error: result.error }), 'error');
    }
  }

  async function handleClearLog() {
    const cleared = await window.electronAPI.requestLog.clear();
    setRequestLog(cleared);
  }

  async function handleExportHar() {
    const result = await window.electronAPI.requestLog.exportHar();
    if (result.canceled) return;
    if (result.success) {
      showToast(t('flash.harExport.success', { count: result.count, path: result.path }), 'success');
    } else {
      showToast(t('flash.harExport.error', { error: result.error }), 'error');
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
    showToast(strings['flash.settings.updated'] ?? 'Settings have been updated.', 'info');
  }

  async function handleColorModeChange(mode) {
    await updateSettings({ colorMode: mode });
    applyColorMode(mode);
    showToast(t('flash.settings.updated'), 'info');
  }

  const mockableMappings = mappings.filter((m) => m.enabled && m.mocksEnabled);

  function mockModalMappings(mock) {
    if (!mock || mockableMappings.some((m) => m.id === mock.mappingId)) return mockableMappings;
    const current = mappings.find((m) => m.id === mock.mappingId);
    return current ? [...mockableMappings, current] : mockableMappings;
  }

  return (
    <div className="app">
      <Titlebar proxyRunning={proxyRunning} updateInfo={updateInfo} t={t} />
      <div className="main-layout">
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          loggingEnabled={settings.loggingEnabled !== false}
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
            healthStatuses={healthStatuses}
            proxyRunning={proxyRunning}
            settings={settings}
            onAdd={() => setModal({ type: 'add' })}
            onEdit={(mapping) => setModal({ type: 'edit', mapping })}
            onExport={() => setModal({ type: 'export' })}
            onImport={handleImportMappings}
            showToast={showToast}
            t={t}
          />
          <MocksView
            active={currentView === 'mocks'}
            mocks={mocks}
            mappings={mappings}
            mockableMappings={mockableMappings}
            setMocks={setMocks}
            onAdd={() => setModal({ type: 'addMock' })}
            onEdit={(mock) => setModal({ type: 'editMock', mock })}
            onExport={() => setModal({ type: 'exportMocks' })}
            onImport={handleImportMocks}
            showToast={showToast}
            t={t}
          />
          <LogView
            active={currentView === 'log'}
            entries={requestLog}
            onClear={handleClearLog}
            onExportHar={handleExportHar}
            settings={settings}
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
            showToast(t('flash.mapping.added', { domain: data.domain, host: data.host, port: data.port }), 'success');
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
            showToast(t('flash.mapping.updated', { domain: data.domain, host: data.host, port: data.port }), 'success');
          }}
          t={t}
        />
      )}

      {modal?.type === 'addMock' && (
        <MockModal
          mappings={mockableMappings}
          onClose={() => setModal(null)}
          onSubmit={async (data) => {
            const result = await window.electronAPI.mocks.add(data);
            if (result.success) {
              setMocks(result.mocks);
              setModal(null);
              showToast(t('flash.mock.added'), 'success');
            }
            return result;
          }}
          t={t}
        />
      )}

      {modal?.type === 'editMock' && (
        <MockModal
          mock={modal.mock}
          mappings={mockModalMappings(modal.mock)}
          onClose={() => setModal(null)}
          onSubmit={async (data) => {
            const result = await window.electronAPI.mocks.update(modal.mock.id, data);
            if (result.success) {
              setMocks(result.mocks);
              setModal(null);
              showToast(t('flash.mock.updated'), 'success');
            }
            return result;
          }}
          t={t}
        />
      )}

      {modal?.type === 'export' && (
        <ExportModal
          items={mappings.map((m) => ({ id: m.id, label: m.domain }))}
          i18nPrefix="mappings.modals.export"
          onClose={() => setModal(null)}
          onSubmit={async (ids) => {
            const result = await window.electronAPI.mappings.export(ids);
            if (result.canceled) return;
            if (result.success) {
              setModal(null);
              showToast(t('flash.export.success', { count: result.count, path: result.path }), 'success');
            } else {
              showToast(t('flash.export.error', { error: result.error }), 'error');
            }
          }}
          t={t}
        />
      )}

      {modal?.type === 'exportMocks' && (
        <ExportModal
          items={mocks.map((m) => ({
            id: m.id,
            label: `${m.method === '*' ? t('mocks.modals.manage.form.method.any') : m.method} ${m.pathPattern}`,
          }))}
          i18nPrefix="mocks.modals.export"
          onClose={() => setModal(null)}
          onSubmit={async (ids) => {
            const result = await window.electronAPI.mocks.export(ids);
            if (result.canceled) return;
            if (result.success) {
              setModal(null);
              showToast(t('flash.mocksExport.success', { count: result.count, path: result.path }), 'success');
            } else {
              showToast(t('flash.mocksExport.error', { error: result.error }), 'error');
            }
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
