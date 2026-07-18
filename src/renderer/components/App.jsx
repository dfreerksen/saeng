import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Titlebar from './layout/Titlebar.jsx';
import Sidebar from './layout/Sidebar.jsx';
import DashboardView from './DashboardView.jsx';
import MappingsView from './MappingsView.jsx';
import MocksView from './MocksView.jsx';
import LogView from './LogView.jsx';
import SettingsView from './SettingsView.jsx';
import AppModals from './modals/AppModals.jsx';
import Toast from './utilities/Toast.jsx';
import { getOS } from '../js/os.js';
import { Tooltip as BsTooltip } from 'bootstrap';

const DEFAULT_LOG_MAX_ENTRIES = 300;

const MOCK_DRAFT_HEADERS = new Set(['content-type', 'content-length']);

function buildMockDraftFromEntry(entry, mappingId) {
  const pathOnly = (entry.path || '').split('?')[0];
  const pathPattern = '^' + pathOnly.replace(/[.+*?^${}()|[\]\\]/g, '\\$&') + '$';
  const headers = entry.responseHeaders
    ? Object.entries(entry.responseHeaders)
        .filter(([name]) => MOCK_DRAFT_HEADERS.has(name.toLowerCase()))
        .map(([name, value]) => ({ name, value: Array.isArray(value) ? value.join(', ') : String(value) }))
    : [];
  return { mappingId, method: entry.method || '*', pathPattern, statusCode: entry.status || 200, delayMs: 0, headers, body: entry.responseBody || '' };
}

function applyColorMode(mode) {
  const resolved = mode === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  document.documentElement.setAttribute('data-bs-theme', resolved);
  localStorage.setItem('theme', mode);
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [proxyRunning, setProxyRunning] = useState(false);
  const [mappings, setMappings] = useState([]);
  const [mocks, setMocks] = useState([]);
  const [requestLog, setRequestLog] = useState([]);
  const [healthStatuses, setHealthStatuses] = useState({});
  const [settings, setSettings] = useState({});
  const [locales, setLocales] = useState([]);
  const [currentView, setCurrentView] = useState('mappings');
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [appVersion, setAppVersion] = useState('');
  const [electronVersion, setElectronVersion] = useState('');
  const [nodeVersion, setNodeVersion] = useState('');
  const bootstrapVersion = BsTooltip.VERSION || '';
  const [caPath, setCaPath] = useState('');
  const [caExpiry, setCaExpiry] = useState(null);
  const [updateInfo, setUpdateInfo] = useState({ updateAvailable: false, latestVersion: null, url: null });
  const [i18nStrings, setI18nStrings] = useState({});
  const logMaxEntriesRef = useRef(DEFAULT_LOG_MAX_ENTRIES);

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
      setSettings(settingsData);
      logMaxEntriesRef.current = settingsData.logMaxEntries || DEFAULT_LOG_MAX_ENTRIES;
      setLocales(localeList);
      setUpdateInfo(updateStatus);

      if (settingsData.dashboardEnabled !== false) {
        setCurrentView('dashboard');
      }

      applyColorMode(settingsData.colorMode || 'auto');

      const currentLocale = settingsData.locale || 'en';
      const localeInfo = localeList.find((l) => l.code === currentLocale);
      document.documentElement.lang = currentLocale;
      document.documentElement.dir = localeInfo?.dir ?? 'ltr';

      setIsLoading(false);
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

  const handleProxyToggle = useCallback(async () => {
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
  }, [proxyRunning, showToast, t]);

  const handleImportMappings = useCallback(async () => {
    const result = await window.electronAPI.mappings.import();
    if (result.canceled) return;
    if (result.success) {
      setMappings(result.mappings);
      showToast(t('flash.import.success', { added: result.added, skipped: result.skipped }), result.added > 0 ? 'success' : 'info');
    } else {
      showToast(t('flash.import.error', { error: result.error }), 'error');
    }
  }, [showToast, t]);

  const handleImportMocks = useCallback(async () => {
    const result = await window.electronAPI.mocks.import();
    if (result.canceled) return;
    if (result.success) {
      setMocks(result.mocks);
      showToast(t('flash.mocksImport.success', { added: result.added, skipped: result.skipped }), result.added > 0 ? 'success' : 'info');
    } else {
      showToast(t('flash.mocksImport.error', { error: result.error }), 'error');
    }
  }, [showToast, t]);

  const handleClearLog = useCallback(async () => {
    const cleared = await window.electronAPI.requestLog.clear();
    setRequestLog(cleared);
  }, []);

  const handleExportHar = useCallback(async () => {
    const result = await window.electronAPI.requestLog.exportHar();
    if (result.canceled) return;
    if (result.success) {
      showToast(t('flash.harExport.success', { count: result.count, path: result.path }), 'success');
    } else {
      showToast(t('flash.harExport.error', { error: result.error }), 'error');
    }
  }, [showToast, t]);

  const updateSettings = useCallback(async (patch) => {
    await window.electronAPI.settings.set(patch);
    setSettings((prev) => ({ ...prev, ...patch }));
    if ('logMaxEntries' in patch) {
      const max = patch.logMaxEntries || DEFAULT_LOG_MAX_ENTRIES;
      logMaxEntriesRef.current = max;
      setRequestLog((prev) => (prev.length > max ? prev.slice(prev.length - max) : prev));
    }
    if (patch.dashboardEnabled === false) {
      setCurrentView((view) => (view === 'dashboard' ? 'mappings' : view));
    }
    if (patch.loggingEnabled === false) {
      setCurrentView((view) => (view === 'log' ? 'mappings' : view));
    }
  }, []);

  const handleLocaleChange = useCallback(async (locale) => {
    const localeInfo = locales.find((l) => l.code === locale);
    const strings = await window.electronAPI.i18n.setLocale(locale);
    setI18nStrings(strings);
    document.documentElement.lang = locale;
    document.documentElement.dir = localeInfo?.dir ?? 'ltr';
    await updateSettings({ locale });
    showToast(strings['flash.settings.updated'] ?? 'Settings have been updated.', 'info');
  }, [locales, updateSettings, showToast]);

  const handleColorModeChange = useCallback(async (mode) => {
    await updateSettings({ colorMode: mode });
    applyColorMode(mode);
    showToast(t('flash.settings.updated'), 'info');
  }, [updateSettings, showToast, t]);

  const mockableMappings = useMemo(() => mappings.filter((m) => m.enabled && m.mocksEnabled), [mappings]);

  const handleOpenAddModal = useCallback(() => setModal({ type: 'addMapping' }), []);
  const handleOpenEditModal = useCallback((mapping) => setModal({ type: 'editMapping', mapping }), []);
  const handleOpenExportModal = useCallback(() => setModal({ type: 'exportMappings' }), []);
  const handleOpenAddMockModal = useCallback(() => setModal({ type: 'addMock' }), []);
  const handleOpenEditMockModal = useCallback((mock) => setModal({ type: 'editMock', mock }), []);
  const handleOpenExportMocksModal = useCallback(() => setModal({ type: 'exportMocks' }), []);
  const handleOpenAboutModal = useCallback(() => setModal({ type: 'about' }), []);
  const handleCloseModal = useCallback(() => setModal(null), []);

  const handleConvertToMock = useCallback((entry) => {
    const mapping = mappings.find((m) => m.domain === entry.hostname);
    if (!mapping) {
      showToast(t('log.actions.convertToMock.noMapping'), 'error');
      return;
    }
    setModal({
      type: 'convertToMock',
      mappingId: mapping.id,
      initialValues: buildMockDraftFromEntry(entry, mapping.id),
    });
  }, [mappings, showToast, t]);

  function mockModalMappings(mock) {
    if (!mock || mockableMappings.some((m) => m.id === mock.mappingId)) return mockableMappings;
    const current = mappings.find((m) => m.id === mock.mappingId);
    return current ? [...mockableMappings, current] : mockableMappings;
  }

  if (isLoading) {
    return (
      <div className="app app-loading d-flex flex-column align-items-center justify-content-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Titlebar proxyRunning={proxyRunning} updateInfo={updateInfo} onProxyToggle={handleProxyToggle} t={t} />
      <div className="main-layout">
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          dashboardEnabled={settings.dashboardEnabled !== false}
          loggingEnabled={settings.loggingEnabled !== false}
          onAbout={handleOpenAboutModal}
          t={t}
        />
        <main className="content">
          {currentView === 'dashboard' && (
            <DashboardView
              entries={requestLog}
              mappings={mappings}
              mocks={mocks}
              healthStatuses={healthStatuses}
              settings={settings}
              proxyRunning={proxyRunning}
              t={t}
            />
          )}
          {currentView === 'mappings' && (
            <MappingsView
              mappings={mappings}
              setMappings={setMappings}
              healthStatuses={healthStatuses}
              proxyRunning={proxyRunning}
              settings={settings}
              onAdd={handleOpenAddModal}
              onEdit={handleOpenEditModal}
              onExport={handleOpenExportModal}
              onImport={handleImportMappings}
              showToast={showToast}
              t={t}
            />
          )}
          {currentView === 'mocks' && (
            <MocksView
              mocks={mocks}
              mappings={mappings}
              mockableMappings={mockableMappings}
              setMocks={setMocks}
              onAdd={handleOpenAddMockModal}
              onEdit={handleOpenEditMockModal}
              onExport={handleOpenExportMocksModal}
              onImport={handleImportMocks}
              t={t}
            />
          )}
          {currentView === 'log' && (
            <LogView
              entries={requestLog}
              onClear={handleClearLog}
              onExportHar={handleExportHar}
              onConvertToMock={handleConvertToMock}
              settings={settings}
              t={t}
            />
          )}
          {currentView === 'settings' && (
            <SettingsView
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
          )}
        </main>
      </div>

      <AppModals
        modal={modal}
        mappings={mappings}
        setMappings={setMappings}
        mocks={mocks}
        setMocks={setMocks}
        mockModalMappings={mockModalMappings}
        settings={settings}
        appVersion={appVersion}
        electronVersion={electronVersion}
        nodeVersion={nodeVersion}
        bootstrapVersion={bootstrapVersion}
        onClose={handleCloseModal}
        setModal={setModal}
        showToast={showToast}
        t={t}
      />

      <Toast toasts={toasts} />
    </div>
  );
}
