// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bootstrap', () => ({
  Tooltip: vi.fn(function BsTooltipMock() {
    this.hide = vi.fn();
    this.dispose = vi.fn();
  }),
}));

vi.mock('../../../src/renderer/js/os.js', () => ({
  getOS: vi.fn().mockReturnValue('mac'),
}));

import App from '../../../src/renderer/components/App.jsx';

function makeElectronAPI(overrides = {}) {
  return {
    platform: 'darwin',
    proxy: {
      status: vi.fn().mockResolvedValue({ running: false }),
      start: vi.fn().mockResolvedValue({ success: true }),
      stop: vi.fn().mockResolvedValue({ success: true }),
      onStatusChanged: vi.fn(),
      ...overrides.proxy,
    },
    mappings: {
      list: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue([]),
      toggle: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue([]),
      export: vi.fn().mockResolvedValue({ canceled: true }),
      import: vi.fn().mockResolvedValue({ canceled: true }),
      ...overrides.mappings,
    },
    mocks: {
      list: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue({ success: true, mocks: [] }),
      update: vi.fn().mockResolvedValue({ success: true, mocks: [] }),
      remove: vi.fn().mockResolvedValue([]),
      toggle: vi.fn().mockResolvedValue([]),
      ...overrides.mocks,
    },
    requestLog: {
      list: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue([]),
      exportHar: vi.fn().mockResolvedValue({ canceled: true }),
      onEntry: vi.fn(),
      ...overrides.requestLog,
    },
    health: {
      list: vi.fn().mockResolvedValue({}),
      onUpdate: vi.fn(),
      ...overrides.health,
    },
    settings: {
      get: vi.fn().mockResolvedValue({ httpsEnabled: true, startOnLaunch: false, colorMode: 'auto', locale: 'en', healthCheckEnabled: true, dashboardEnabled: false }),
      set: vi.fn().mockResolvedValue(undefined),
      ...overrides.settings,
    },
    ssl: {
      getCAPath: vi.fn().mockResolvedValue('/path/to/ca.crt'),
      getCAExpiry: vi.fn().mockResolvedValue(null),
      trustCA: vi.fn().mockResolvedValue({ success: true }),
      regenerateCA: vi.fn().mockResolvedValue(null),
      deleteCA: vi.fn().mockResolvedValue({}),
      revealCA: vi.fn(),
      ...overrides.ssl,
    },
    app: {
      getInfo: vi.fn().mockResolvedValue({ version: '1.2.3' }),
      openExternal: vi.fn(),
      ...overrides.app,
    },
    i18n: {
      getStrings: vi.fn().mockResolvedValue({}),
      getLocales: vi.fn().mockResolvedValue([{ code: 'en', name: 'English', dir: 'ltr' }]),
      setLocale: vi.fn().mockResolvedValue({}),
      ...overrides.i18n,
    },
    update: {
      getStatus: vi.fn().mockResolvedValue({ updateAvailable: false, currentVersion: '1.2.3', latestVersion: null, url: null }),
      onStatus: vi.fn(),
      ...overrides.update,
    },
  };
}

beforeEach(() => {
  window.electronAPI = makeElectronAPI();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn() },
    writable: true,
    configurable: true,
  });
});

async function renderApp(overrides = {}) {
  window.electronAPI = makeElectronAPI(overrides);
  let result;
  await act(async () => {
    result = render(<App />);
  });
  return result;
}

describe('App — initial render', () => {
  it('renders without crashing', async () => {
    await renderApp();
    expect(screen.getByText('application.name')).toBeInTheDocument();
  });

  it('calls all required electronAPI methods during init', async () => {
    await renderApp();
    expect(window.electronAPI.i18n.getStrings).toHaveBeenCalled();
    expect(window.electronAPI.proxy.status).toHaveBeenCalled();
    expect(window.electronAPI.mappings.list).toHaveBeenCalled();
    expect(window.electronAPI.app.getInfo).toHaveBeenCalled();
    expect(window.electronAPI.ssl.getCAPath).toHaveBeenCalled();
    expect(window.electronAPI.ssl.getCAExpiry).toHaveBeenCalled();
    expect(window.electronAPI.settings.get).toHaveBeenCalled();
    expect(window.electronAPI.i18n.getLocales).toHaveBeenCalled();
  });

  it('registers a proxy status change listener', async () => {
    await renderApp();
    expect(window.electronAPI.proxy.onStatusChanged).toHaveBeenCalledOnce();
  });

  it('shows stopped proxy status initially', async () => {
    await renderApp();
    expect(document.querySelector('.status-dot')).toHaveClass('stopped');
  });

  it('shows running proxy status when proxy reports running', async () => {
    await renderApp({ proxy: { status: vi.fn().mockResolvedValue({ running: true }) } });
    expect(document.querySelector('.status-dot')).toHaveClass('running');
  });
});

describe('App — navigation', () => {
  it('shows the mappings view by default when dashboard is disabled', async () => {
    await renderApp();
    expect(document.querySelector('#view-mappings')).toBeInTheDocument();
    expect(document.querySelector('#view-settings')).not.toBeInTheDocument();
  });

  it('shows the dashboard view on init when dashboardEnabled is true', async () => {
    await renderApp({
      settings: {
        get: vi.fn().mockResolvedValue({ httpsEnabled: true, startOnLaunch: false, colorMode: 'auto', locale: 'en', healthCheckEnabled: true, dashboardEnabled: true }),
      },
    });
    expect(document.querySelector('#view-dashboard')).toBeInTheDocument();
    expect(document.querySelector('#view-mappings')).not.toBeInTheDocument();
  });

  it('redirects from dashboard to mappings when dashboardEnabled becomes false', async () => {
    let settingsData = { httpsEnabled: true, startOnLaunch: false, colorMode: 'auto', locale: 'en', healthCheckEnabled: true, dashboardEnabled: true };
    const setFn = vi.fn().mockImplementation((patch) => {
      settingsData = { ...settingsData, ...patch };
      return Promise.resolve(settingsData);
    });
    await renderApp({
      settings: {
        get: vi.fn().mockResolvedValue(settingsData),
        set: setFn,
      },
    });
    expect(document.querySelector('#view-dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByText('nav.settings').closest('button'));
    const toggles = document.querySelectorAll('.toggle input[type="checkbox"]');
    await act(async () => {
      fireEvent.click(toggles[0]);
    });

    await waitFor(() => {
      expect(document.querySelector('#view-dashboard')).not.toBeInTheDocument();
    });
  });

  it('switches to settings view when settings nav item is clicked', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('nav.settings').closest('button'));
    expect(document.querySelector('#view-settings')).toBeInTheDocument();
    expect(document.querySelector('#view-mappings')).not.toBeInTheDocument();
  });

  it('switches back to mappings view when mappings nav item is clicked', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('nav.settings').closest('button'));
    fireEvent.click(screen.getByText('nav.mappings').closest('button'));
    expect(document.querySelector('#view-mappings')).toBeInTheDocument();
  });

  it('switches to the log view when the log nav item is clicked', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('nav.log').closest('button'));
    expect(document.querySelector('#view-log')).toBeInTheDocument();
    expect(document.querySelector('#view-mappings')).not.toBeInTheDocument();
  });
});

describe('App — settings toasts', () => {
  it('shows a toast after changing the color mode', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('nav.settings').closest('button'));
    const select = document.querySelector('.color-mode-select');
    fireEvent.change(select, { target: { value: 'dark' } });
    await waitFor(() => {
      expect(window.electronAPI.settings.set).toHaveBeenCalledWith({ colorMode: 'dark' });
      expect(screen.getByText('flash.settings.updated')).toBeInTheDocument();
    });
  });

  it('shows a toast after changing the language', async () => {
    await renderApp({
      i18n: {
        getLocales: vi.fn().mockResolvedValue([
          { code: 'en', name: 'English', dir: 'ltr' },
          { code: 'fr', name: 'Français', dir: 'ltr' },
        ]),
      },
    });
    fireEvent.click(screen.getByText('nav.settings').closest('button'));
    const select = document.querySelector('.locale-select');
    fireEvent.change(select, { target: { value: 'fr' } });
    await waitFor(() => {
      expect(window.electronAPI.settings.set).toHaveBeenCalledWith({ locale: 'fr' });
      expect(screen.getByText('Settings have been updated.')).toBeInTheDocument();
    });
  });
});

describe('App — request log', () => {
  it('loads request log entries on init', async () => {
    const entries = [{ id: '1', timestamp: 1700000000000, method: 'GET', hostname: 'myapp.local', path: '/', status: 200, latencyMs: 10, https: false }];
    await renderApp({ requestLog: { list: vi.fn().mockResolvedValue(entries) } });
    fireEvent.click(screen.getByText('nav.log').closest('button'));
    expect(window.electronAPI.requestLog.list).toHaveBeenCalled();
    expect(screen.getByText('myapp.local')).toBeInTheDocument();
  });

  it('registers a request log entry listener', async () => {
    await renderApp();
    expect(window.electronAPI.requestLog.onEntry).toHaveBeenCalledOnce();
  });

  it('appends incoming entries pushed via onEntry to the log view', async () => {
    let pushEntry;
    await renderApp({
      requestLog: {
        onEntry: vi.fn((cb) => { pushEntry = cb; }),
      },
    });
    fireEvent.click(screen.getByText('nav.log').closest('button'));
    expect(screen.getByText('log.empty')).toBeInTheDocument();

    act(() => {
      pushEntry({ id: 'e1', timestamp: Date.now(), method: 'GET', hostname: 'myapp.local', path: '/home', status: 200, latencyMs: 5, https: false });
    });

    expect(await screen.findByText('myapp.local')).toBeInTheDocument();
    expect(screen.getByText('/home')).toBeInTheDocument();
  });

  it('trims appended entries to the configured logMaxEntries', async () => {
    let pushEntry;
    await renderApp({
      requestLog: {
        onEntry: vi.fn((cb) => { pushEntry = cb; }),
      },
      settings: {
        get: vi.fn().mockResolvedValue({ httpsEnabled: true, startOnLaunch: false, colorMode: 'auto', locale: 'en', logMaxEntries: 1 }),
      },
    });
    fireEvent.click(screen.getByText('nav.log').closest('button'));

    act(() => {
      pushEntry({ id: 'e1', timestamp: Date.now(), method: 'GET', hostname: 'first.local', path: '/one', status: 200, latencyMs: 5, https: false });
    });
    act(() => {
      pushEntry({ id: 'e2', timestamp: Date.now(), method: 'GET', hostname: 'second.local', path: '/two', status: 200, latencyMs: 5, https: false });
    });

    await waitFor(() => {
      expect(screen.getByText('second.local')).toBeInTheDocument();
    });
    expect(screen.queryByText('first.local')).not.toBeInTheDocument();
  });

  it('clears the request log when the clear button is clicked', async () => {
    const entries = [{ id: '1', timestamp: 1700000000000, method: 'GET', hostname: 'myapp.local', path: '/', status: 200, latencyMs: 10, https: false }];
    const clear = vi.fn().mockResolvedValue([]);
    await renderApp({ requestLog: { list: vi.fn().mockResolvedValue(entries), clear } });
    fireEvent.click(screen.getByText('nav.log').closest('button'));
    expect(screen.getByText('myapp.local')).toBeInTheDocument();

    fireEvent.click(screen.getByText('log.actions.clear').closest('button'));

    await waitFor(() => {
      expect(clear).toHaveBeenCalledOnce();
      expect(screen.queryByText('myapp.local')).not.toBeInTheDocument();
    });
  });

  it('exports the request log as HAR and shows a success toast', async () => {
    const entries = [{ id: '1', timestamp: 1700000000000, method: 'GET', hostname: 'myapp.local', path: '/', status: 200, latencyMs: 10, https: false }];
    const exportHar = vi.fn().mockResolvedValue({ success: true, count: 1, path: '/tmp/saeng-requests.har' });
    await renderApp({ requestLog: { list: vi.fn().mockResolvedValue(entries), exportHar } });
    fireEvent.click(screen.getByText('nav.log').closest('button'));

    fireEvent.click(screen.getByText('log.actions.exportHar').closest('button'));

    await waitFor(() => {
      expect(exportHar).toHaveBeenCalledOnce();
      expect(screen.getByText('flash.harExport.success')).toBeInTheDocument();
    });
  });

  it('shows an error toast when exporting the request log as HAR fails', async () => {
    const entries = [{ id: '1', timestamp: 1700000000000, method: 'GET', hostname: 'myapp.local', path: '/', status: 200, latencyMs: 10, https: false }];
    const exportHar = vi.fn().mockResolvedValue({ success: false, error: 'disk full' });
    await renderApp({ requestLog: { list: vi.fn().mockResolvedValue(entries), exportHar } });
    fireEvent.click(screen.getByText('nav.log').closest('button'));

    fireEvent.click(screen.getByText('log.actions.exportHar').closest('button'));

    await waitFor(() => {
      expect(screen.getByText('flash.harExport.error')).toBeInTheDocument();
    });
  });

  it('does not show a toast when the HAR export dialog is canceled', async () => {
    const entries = [{ id: '1', timestamp: 1700000000000, method: 'GET', hostname: 'myapp.local', path: '/', status: 200, latencyMs: 10, https: false }];
    const exportHar = vi.fn().mockResolvedValue({ canceled: true });
    await renderApp({ requestLog: { list: vi.fn().mockResolvedValue(entries), exportHar } });
    fireEvent.click(screen.getByText('nav.log').closest('button'));

    fireEvent.click(screen.getByText('log.actions.exportHar').closest('button'));

    await waitFor(() => expect(exportHar).toHaveBeenCalledOnce());
    expect(screen.queryByText('flash.harExport.success')).not.toBeInTheDocument();
    expect(screen.queryByText('flash.harExport.error')).not.toBeInTheDocument();
  });
});

describe('App — health checks', () => {
  const sampleMappings = [{ id: '1', domain: 'myapp.local', port: 3000, https: false, enabled: true }];

  it('loads health statuses on init and reflects them in the mappings table', async () => {
    const healthList = { 1: { id: '1', status: 'up', latencyMs: 5, error: null } };
    await renderApp({
      mappings: { list: vi.fn().mockResolvedValue(sampleMappings) },
      health: { list: vi.fn().mockResolvedValue(healthList) },
      proxy: { status: vi.fn().mockResolvedValue({ running: true }) },
    });
    expect(window.electronAPI.health.list).toHaveBeenCalled();
    expect(document.querySelector('.health-dot')).toHaveClass('up');
  });

  it('shows an unknown status dot before any health result arrives', async () => {
    await renderApp({ mappings: { list: vi.fn().mockResolvedValue(sampleMappings) } });
    expect(document.querySelector('.health-dot')).toHaveClass('unknown');
  });

  it('shows an unknown status dot when the proxy is stopped, even with a stale health status', async () => {
    const healthList = { 1: { id: '1', status: 'up', latencyMs: 5, error: null } };
    await renderApp({
      mappings: { list: vi.fn().mockResolvedValue(sampleMappings) },
      health: { list: vi.fn().mockResolvedValue(healthList) },
      proxy: { status: vi.fn().mockResolvedValue({ running: false }) },
    });
    expect(document.querySelector('.health-dot')).toHaveClass('unknown');
  });

  it('registers a health update listener', async () => {
    await renderApp();
    expect(window.electronAPI.health.onUpdate).toHaveBeenCalledOnce();
  });

  it('applies incoming health updates pushed via onUpdate', async () => {
    let pushUpdate;
    await renderApp({
      mappings: { list: vi.fn().mockResolvedValue(sampleMappings) },
      health: { onUpdate: vi.fn((cb) => { pushUpdate = cb; }) },
      proxy: { status: vi.fn().mockResolvedValue({ running: true }) },
    });
    expect(document.querySelector('.health-dot')).toHaveClass('unknown');

    act(() => {
      pushUpdate({ id: '1', status: 'down', latencyMs: 2000, error: 'timeout' });
    });

    expect(document.querySelector('.health-dot')).toHaveClass('down');
  });
});

describe('App — proxy toggle', () => {
  it('starts the proxy when toggle is clicked while stopped', async () => {
    await renderApp();
    fireEvent.click(document.querySelector('.status-pill'));
    await waitFor(() => {
      expect(window.electronAPI.proxy.start).toHaveBeenCalledOnce();
    });
  });

  it('updates the proxy status dot to running after start', async () => {
    await renderApp();
    fireEvent.click(document.querySelector('.status-pill'));
    await waitFor(() => {
      expect(document.querySelector('.status-dot')).toHaveClass('running');
    });
  });

  it('stops the proxy when toggle is clicked while running', async () => {
    await renderApp({ proxy: { status: vi.fn().mockResolvedValue({ running: true }) } });
    fireEvent.click(document.querySelector('.status-pill'));
    await waitFor(() => {
      expect(window.electronAPI.proxy.stop).toHaveBeenCalledOnce();
    });
  });
});

describe('App — about modal', () => {
  it('opens the about modal when about nav item is clicked', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('nav.about').closest('button'));
    expect(screen.getByText('about.desc')).toBeInTheDocument();
  });

  it('closes the about modal when the close button is clicked', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('nav.about').closest('button'));
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => {
      expect(screen.queryByText('about.desc')).not.toBeInTheDocument();
    });
  });
});

describe('App — add mapping modal', () => {
  it('opens the add mapping modal when add button is clicked', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('mappings.actions.add').closest('button'));
    expect(screen.getByText('mappings.modals.manage.addTitle')).toBeInTheDocument();
  });

  it('closes the add mapping modal when cancel is clicked', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('mappings.actions.add').closest('button'));
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.cancel'));
    await waitFor(() => {
      expect(screen.queryByText('mappings.modals.manage.addTitle')).not.toBeInTheDocument();
    });
  });
});

describe('App — import mappings', () => {
  it('does nothing when the import dialog is canceled', async () => {
    const importFn = vi.fn().mockResolvedValue({ canceled: true });
    await renderApp({ mappings: { import: importFn } });
    fireEvent.click(screen.getByText('mappings.actions.import').closest('button'));
    await waitFor(() => expect(importFn).toHaveBeenCalledOnce());
    expect(screen.queryByText('flash.import.success')).not.toBeInTheDocument();
    expect(screen.queryByText('flash.import.error')).not.toBeInTheDocument();
  });

  it('refreshes mappings and shows a result toast on successful import', async () => {
    const newMappings = [{ id: 'm1', domain: 'imported.local', host: '127.0.0.1', port: 1, https: false, enabled: true }];
    const importFn = vi.fn().mockResolvedValue({ canceled: false, success: true, added: 1, skipped: 0, mappings: newMappings });
    await renderApp({ mappings: { import: importFn } });
    fireEvent.click(screen.getByText('mappings.actions.import').closest('button'));
    await waitFor(() => {
      expect(screen.getByText('flash.import.success')).toBeInTheDocument();
    });
    expect(screen.getAllByText('imported.local')[0]).toBeInTheDocument();
  });

  it('shows an error toast when import fails', async () => {
    const importFn = vi.fn().mockResolvedValue({ canceled: false, success: false, error: 'boom' });
    await renderApp({ mappings: { import: importFn } });
    fireEvent.click(screen.getByText('mappings.actions.import').closest('button'));
    await waitFor(() => {
      expect(screen.getByText('flash.import.error')).toBeInTheDocument();
    });
  });
});

describe('App — export mappings', () => {
  const sampleMappings = [
    { id: 'm1', domain: 'a.local', host: '127.0.0.1', port: 1, https: false, enabled: true },
  ];

  it('opens the export modal when the export button is clicked', async () => {
    await renderApp({ mappings: { list: vi.fn().mockResolvedValue(sampleMappings) } });
    fireEvent.click(screen.getByText('mappings.actions.export').closest('button'));
    expect(screen.getByText('mappings.modals.export.title')).toBeInTheDocument();
  });

  it('keeps the modal open without toasting when export is canceled', async () => {
    const exportFn = vi.fn().mockResolvedValue({ canceled: true });
    await renderApp({ mappings: { list: vi.fn().mockResolvedValue(sampleMappings), export: exportFn } });
    fireEvent.click(screen.getByText('mappings.actions.export').closest('button'));
    fireEvent.click(screen.getByText('mappings.modals.export.buttons.submit'));
    await waitFor(() => expect(exportFn).toHaveBeenCalledWith(['m1']));
    expect(screen.getByText('mappings.modals.export.title')).toBeInTheDocument();
    expect(screen.queryByText('flash.export.success')).not.toBeInTheDocument();
  });

  it('closes the modal and shows a success toast on successful export', async () => {
    const exportFn = vi.fn().mockResolvedValue({ canceled: false, success: true, count: 1, path: '/tmp/export.json' });
    await renderApp({ mappings: { list: vi.fn().mockResolvedValue(sampleMappings), export: exportFn } });
    fireEvent.click(screen.getByText('mappings.actions.export').closest('button'));
    fireEvent.click(screen.getByText('mappings.modals.export.buttons.submit'));
    await waitFor(() => {
      expect(screen.queryByText('mappings.modals.export.title')).not.toBeInTheDocument();
      expect(screen.getByText('flash.export.success')).toBeInTheDocument();
    });
  });

  it('keeps the modal open and shows an error toast when export fails', async () => {
    const exportFn = vi.fn().mockResolvedValue({ canceled: false, success: false, error: 'boom' });
    await renderApp({ mappings: { list: vi.fn().mockResolvedValue(sampleMappings), export: exportFn } });
    fireEvent.click(screen.getByText('mappings.actions.export').closest('button'));
    fireEvent.click(screen.getByText('mappings.modals.export.buttons.submit'));
    await waitFor(() => {
      expect(screen.getByText('flash.export.error')).toBeInTheDocument();
    });
    expect(screen.getByText('mappings.modals.export.title')).toBeInTheDocument();
  });
});

describe('App — import mocks', () => {
  it('does nothing when the import dialog is canceled', async () => {
    const importFn = vi.fn().mockResolvedValue({ canceled: true });
    await renderApp({ mocks: { import: importFn } });
    fireEvent.click(screen.getByText('nav.mocks').closest('button'));
    fireEvent.click(screen.getByText('mocks.actions.import').closest('button'));
    await waitFor(() => expect(importFn).toHaveBeenCalledOnce());
    expect(screen.queryByText('flash.mocksImport.success')).not.toBeInTheDocument();
    expect(screen.queryByText('flash.mocksImport.error')).not.toBeInTheDocument();
  });

  it('refreshes mocks and shows a result toast on successful import', async () => {
    const newMocks = [{ id: 'mock1', mappingId: 'm1', method: 'GET', pathPattern: '^/api$', statusCode: 200, enabled: true }];
    const importFn = vi.fn().mockResolvedValue({ canceled: false, success: true, added: 1, skipped: 0, mocks: newMocks });
    await renderApp({ mocks: { import: importFn } });
    fireEvent.click(screen.getByText('nav.mocks').closest('button'));
    fireEvent.click(screen.getByText('mocks.actions.import').closest('button'));
    await waitFor(() => {
      expect(screen.getByText('flash.mocksImport.success')).toBeInTheDocument();
    });
    expect(screen.getByText('^/api$')).toBeInTheDocument();
  });

  it('shows an error toast when import fails', async () => {
    const importFn = vi.fn().mockResolvedValue({ canceled: false, success: false, error: 'boom' });
    await renderApp({ mocks: { import: importFn } });
    fireEvent.click(screen.getByText('nav.mocks').closest('button'));
    fireEvent.click(screen.getByText('mocks.actions.import').closest('button'));
    await waitFor(() => {
      expect(screen.getByText('flash.mocksImport.error')).toBeInTheDocument();
    });
  });
});

describe('App — export mocks', () => {
  const sampleMocks = [
    { id: 'mock1', mappingId: 'm1', method: 'GET', pathPattern: '^/api$', statusCode: 200, enabled: true },
  ];

  it('opens the export modal when the export button is clicked', async () => {
    await renderApp({ mocks: { list: vi.fn().mockResolvedValue(sampleMocks) } });
    fireEvent.click(screen.getByText('nav.mocks').closest('button'));
    fireEvent.click(screen.getByText('mocks.actions.export').closest('button'));
    expect(screen.getByText('mocks.modals.export.title')).toBeInTheDocument();
  });

  it('keeps the modal open without toasting when export is canceled', async () => {
    const exportFn = vi.fn().mockResolvedValue({ canceled: true });
    await renderApp({ mocks: { list: vi.fn().mockResolvedValue(sampleMocks), export: exportFn } });
    fireEvent.click(screen.getByText('nav.mocks').closest('button'));
    fireEvent.click(screen.getByText('mocks.actions.export').closest('button'));
    fireEvent.click(screen.getByText('mocks.modals.export.buttons.submit'));
    await waitFor(() => expect(exportFn).toHaveBeenCalledWith(['mock1']));
    expect(screen.getByText('mocks.modals.export.title')).toBeInTheDocument();
    expect(screen.queryByText('flash.mocksExport.success')).not.toBeInTheDocument();
  });

  it('closes the modal and shows a success toast on successful export', async () => {
    const exportFn = vi.fn().mockResolvedValue({ canceled: false, success: true, count: 1, path: '/tmp/export.json' });
    await renderApp({ mocks: { list: vi.fn().mockResolvedValue(sampleMocks), export: exportFn } });
    fireEvent.click(screen.getByText('nav.mocks').closest('button'));
    fireEvent.click(screen.getByText('mocks.actions.export').closest('button'));
    fireEvent.click(screen.getByText('mocks.modals.export.buttons.submit'));
    await waitFor(() => {
      expect(screen.queryByText('mocks.modals.export.title')).not.toBeInTheDocument();
      expect(screen.getByText('flash.mocksExport.success')).toBeInTheDocument();
    });
  });

  it('keeps the modal open and shows an error toast when export fails', async () => {
    const exportFn = vi.fn().mockResolvedValue({ canceled: false, success: false, error: 'boom' });
    await renderApp({ mocks: { list: vi.fn().mockResolvedValue(sampleMocks), export: exportFn } });
    fireEvent.click(screen.getByText('nav.mocks').closest('button'));
    fireEvent.click(screen.getByText('mocks.actions.export').closest('button'));
    fireEvent.click(screen.getByText('mocks.modals.export.buttons.submit'));
    await waitFor(() => {
      expect(screen.getByText('flash.mocksExport.error')).toBeInTheDocument();
    });
    expect(screen.getByText('mocks.modals.export.title')).toBeInTheDocument();
  });
});

describe('App — add mock modal', () => {
  const mockableMappings = [
    { id: 'm1', domain: 'myapp.local', host: '127.0.0.1', port: 3000, https: false, enabled: true, mocksEnabled: true },
  ];

  it('opens the add mock modal when the add button is clicked', async () => {
    await renderApp({ mappings: { list: vi.fn().mockResolvedValue(mockableMappings) } });
    fireEvent.click(screen.getByText('nav.mocks').closest('button'));
    fireEvent.click(screen.getByText('mocks.actions.add').closest('button'));
    expect(screen.getByText('mocks.modals.manage.addTitle')).toBeInTheDocument();
  });

  it('closes the add mock modal when cancel is clicked', async () => {
    await renderApp({ mappings: { list: vi.fn().mockResolvedValue(mockableMappings) } });
    fireEvent.click(screen.getByText('nav.mocks').closest('button'));
    fireEvent.click(screen.getByText('mocks.actions.add').closest('button'));
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.cancel'));
    await waitFor(() => {
      expect(screen.queryByText('mocks.modals.manage.addTitle')).not.toBeInTheDocument();
    });
  });

  it('adds a mock, refreshes the list, closes the modal, and shows a success toast', async () => {
    const newMocks = [{ id: 'mock1', mappingId: 'm1', method: '*', pathPattern: '^/api$', statusCode: 200, enabled: true }];
    const addFn = vi.fn().mockResolvedValue({ success: true, mocks: newMocks });
    await renderApp({ mappings: { list: vi.fn().mockResolvedValue(mockableMappings) }, mocks: { add: addFn } });
    fireEvent.click(screen.getByText('nav.mocks').closest('button'));
    fireEvent.click(screen.getByText('mocks.actions.add').closest('button'));
    const pathInput = screen.getByPlaceholderText('^/api/users/\\d+$');
    fireEvent.change(pathInput, { target: { value: '^/api$' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(addFn).toHaveBeenCalledWith(expect.objectContaining({ mappingId: 'm1', pathPattern: '^/api$' }));
      expect(screen.getByText('flash.mock.added')).toBeInTheDocument();
      expect(screen.queryByText('mocks.modals.manage.addTitle')).not.toBeInTheDocument();
    });
    expect(screen.getByText('^/api$')).toBeInTheDocument();
  });
});

describe('App — edit mock modal', () => {
  const sampleMocks = [
    { id: 'mock1', mappingId: 'm1', method: 'GET', pathPattern: '^/api$', statusCode: 200, enabled: true },
  ];

  it('opens the edit mock modal pre-filled when the edit button is clicked', async () => {
    const sampleMappings = [
      { id: 'm1', domain: 'myapp.local', host: '127.0.0.1', port: 3000, https: false, enabled: true, mocksEnabled: true },
    ];
    const { container } = await renderApp({
      mappings: { list: vi.fn().mockResolvedValue(sampleMappings) },
      mocks: { list: vi.fn().mockResolvedValue(sampleMocks) },
    });
    fireEvent.click(screen.getByText('nav.mocks').closest('button'));
    fireEvent.click(container.querySelector('#view-mocks .btn-edit'));
    expect(screen.getByText('mocks.modals.manage.editTitle')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('^/api/users/\\d+$').value).toBe('^/api$');
  });

  it('updates a mock, refreshes the list, closes the modal, and shows a success toast', async () => {
    const sampleMappings = [
      { id: 'm1', domain: 'myapp.local', host: '127.0.0.1', port: 3000, https: false, enabled: true, mocksEnabled: true },
    ];
    const updatedMocks = [{ ...sampleMocks[0], pathPattern: '^/api/v2$' }];
    const updateFn = vi.fn().mockResolvedValue({ success: true, mocks: updatedMocks });
    const { container } = await renderApp({
      mappings: { list: vi.fn().mockResolvedValue(sampleMappings) },
      mocks: { list: vi.fn().mockResolvedValue(sampleMocks), update: updateFn },
    });
    fireEvent.click(screen.getByText('nav.mocks').closest('button'));
    fireEvent.click(container.querySelector('#view-mocks .btn-edit'));
    const pathInput = screen.getByPlaceholderText('^/api/users/\\d+$');
    fireEvent.change(pathInput, { target: { value: '^/api/v2$' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.update'));
    await waitFor(() => {
      expect(updateFn).toHaveBeenCalledWith('mock1', expect.objectContaining({ pathPattern: '^/api/v2$' }));
      expect(screen.getByText('flash.mock.updated')).toBeInTheDocument();
      expect(screen.queryByText('mocks.modals.manage.editTitle')).not.toBeInTheDocument();
    });
    expect(screen.getByText('^/api/v2$')).toBeInTheDocument();
  });

  it('includes the mock\'s current mapping in the select even when mocking is disabled for it', async () => {
    const sampleMappings = [
      { id: 'm1', domain: 'myapp.local', host: '127.0.0.1', port: 3000, https: false, enabled: true, mocksEnabled: false },
      { id: 'm2', domain: 'other.local', host: '127.0.0.1', port: 4000, https: false, enabled: true, mocksEnabled: true },
    ];
    const { container } = await renderApp({
      mappings: { list: vi.fn().mockResolvedValue(sampleMappings) },
      mocks: { list: vi.fn().mockResolvedValue(sampleMocks) },
    });
    fireEvent.click(screen.getByText('nav.mocks').closest('button'));
    fireEvent.click(container.querySelector('#view-mocks .btn-edit'));
    const mappingSelect = container.querySelector('.modal-body select');
    expect(mappingSelect.value).toBe('m1');
    const optionDomains = [...mappingSelect.querySelectorAll('option')].map((o) => o.textContent);
    expect(optionDomains).toContain('myapp.local');
    expect(optionDomains).toContain('other.local');
  });
});

describe('App — convert to mock', () => {
  const matchingMapping = {
    id: 'm1', domain: 'myapp.local', host: '127.0.0.1', port: 3000,
    https: false, enabled: true, mocksEnabled: true,
  };
  const logEntry = {
    id: 'e1', timestamp: 1700000000000, method: 'GET',
    hostname: 'myapp.local', path: '/api/users', status: 200, latencyMs: 10, https: false,
  };
  const unmatchedEntry = { ...logEntry, id: 'e2', hostname: 'unknown.local' };

  it('shows an error toast when no mapping matches the log entry hostname', async () => {
    const { container } = await renderApp({
      requestLog: { list: vi.fn().mockResolvedValue([unmatchedEntry]) },
    });
    fireEvent.click(screen.getByText('nav.log').closest('button'));
    fireEvent.click(container.querySelector('.log-row'));
    fireEvent.click(container.querySelector('.log-detail-convert'));
    await waitFor(() => {
      expect(screen.getByText('log.actions.convertToMock.noMapping')).toBeInTheDocument();
    });
  });

  it('opens the MockModal in add mode when a matching mapping is found', async () => {
    const { container } = await renderApp({
      mappings: { list: vi.fn().mockResolvedValue([matchingMapping]) },
      requestLog: { list: vi.fn().mockResolvedValue([logEntry]) },
    });
    fireEvent.click(screen.getByText('nav.log').closest('button'));
    fireEvent.click(container.querySelector('.log-row'));
    fireEvent.click(container.querySelector('.log-detail-convert'));
    await waitFor(() => {
      expect(screen.getByText('mocks.modals.manage.addTitle')).toBeInTheDocument();
    });
    expect(screen.queryByText('mocks.modals.manage.editTitle')).not.toBeInTheDocument();
  });

  it('pre-fills the path pattern with an escaped regex from the log entry path', async () => {
    const { container } = await renderApp({
      mappings: { list: vi.fn().mockResolvedValue([matchingMapping]) },
      requestLog: { list: vi.fn().mockResolvedValue([logEntry]) },
    });
    fireEvent.click(screen.getByText('nav.log').closest('button'));
    fireEvent.click(container.querySelector('.log-row'));
    fireEvent.click(container.querySelector('.log-detail-convert'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('^/api/users/\\d+$').value).toBe('^/api/users$');
    });
  });

  it('pre-fills the status code from the log entry', async () => {
    const { container } = await renderApp({
      mappings: { list: vi.fn().mockResolvedValue([matchingMapping]) },
      requestLog: { list: vi.fn().mockResolvedValue([logEntry]) },
    });
    fireEvent.click(screen.getByText('nav.log').closest('button'));
    fireEvent.click(container.querySelector('.log-row'));
    fireEvent.click(container.querySelector('.log-detail-convert'));
    await waitFor(() => {
      expect(screen.getByText('mocks.modals.manage.addTitle')).toBeInTheDocument();
    });
    const statusInput = document.querySelector('input[type="number"]');
    expect(statusInput.value).toBe('200');
  });

  it('submits via mocks.add, closes the modal, and shows a success toast', async () => {
    const addFn = vi.fn().mockResolvedValue({ success: true, mocks: [] });
    const { container } = await renderApp({
      mappings: { list: vi.fn().mockResolvedValue([matchingMapping]) },
      requestLog: { list: vi.fn().mockResolvedValue([logEntry]) },
      mocks: { add: addFn },
    });
    fireEvent.click(screen.getByText('nav.log').closest('button'));
    fireEvent.click(container.querySelector('.log-row'));
    fireEvent.click(container.querySelector('.log-detail-convert'));
    await waitFor(() => {
      expect(screen.getByText('mocks.modals.manage.addTitle')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(addFn).toHaveBeenCalledWith(expect.objectContaining({ mappingId: 'm1', pathPattern: '^/api/users$' }));
      expect(screen.getByText('flash.mock.added')).toBeInTheDocument();
      expect(screen.queryByText('mocks.modals.manage.addTitle')).not.toBeInTheDocument();
    });
  });
});

describe('App — external link handling', () => {
  it('intercepts http link clicks and opens them externally', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('nav.about').closest('button'));
    const link = screen.getByRole('link', { name: 'David Freerksen' });
    fireEvent.click(link);
    expect(window.electronAPI.app.openExternal).toHaveBeenCalledWith(link.href);
  });
});
