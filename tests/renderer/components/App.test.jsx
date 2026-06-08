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
    requestLog: {
      list: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue([]),
      onEntry: vi.fn(),
      ...overrides.requestLog,
    },
    settings: {
      get: vi.fn().mockResolvedValue({ httpsEnabled: true, startOnLaunch: false, colorMode: 'auto', locale: 'en' }),
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
    expect(screen.getByText('Saeng')).toBeInTheDocument();
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
  it('shows the mappings view by default', async () => {
    await renderApp();
    expect(document.querySelector('#view-mappings')).toHaveClass('active');
    expect(document.querySelector('#view-settings')).not.toHaveClass('active');
  });

  it('switches to settings view when settings nav item is clicked', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('nav.settings').closest('button'));
    expect(document.querySelector('#view-settings')).toHaveClass('active');
    expect(document.querySelector('#view-mappings')).not.toHaveClass('active');
  });

  it('switches back to mappings view when mappings nav item is clicked', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('nav.settings').closest('button'));
    fireEvent.click(screen.getByText('nav.mappings').closest('button'));
    expect(document.querySelector('#view-mappings')).toHaveClass('active');
  });

  it('switches to the log view when the log nav item is clicked', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('nav.log').closest('button'));
    expect(document.querySelector('#view-log')).toHaveClass('active');
    expect(document.querySelector('#view-mappings')).not.toHaveClass('active');
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

    fireEvent.click(screen.getByText('log.clear').closest('button'));

    await waitFor(() => {
      expect(clear).toHaveBeenCalledOnce();
      expect(screen.queryByText('myapp.local')).not.toBeInTheDocument();
    });
  });
});

describe('App — proxy toggle', () => {
  it('starts the proxy when toggle is clicked while stopped', async () => {
    await renderApp();
    fireEvent.click(document.querySelector('.proxy-toggle-btn'));
    await waitFor(() => {
      expect(window.electronAPI.proxy.start).toHaveBeenCalledOnce();
    });
  });

  it('updates the proxy status dot to running after start', async () => {
    await renderApp();
    fireEvent.click(document.querySelector('.proxy-toggle-btn'));
    await waitFor(() => {
      expect(document.querySelector('.status-dot')).toHaveClass('running');
    });
  });

  it('stops the proxy when toggle is clicked while running', async () => {
    await renderApp({ proxy: { status: vi.fn().mockResolvedValue({ running: true }) } });
    fireEvent.click(document.querySelector('.proxy-toggle-btn'));
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
    fireEvent.click(screen.getByText('mappings.add').closest('button'));
    expect(screen.getByText('modal.addTitle')).toBeInTheDocument();
  });

  it('closes the add mapping modal when cancel is clicked', async () => {
    await renderApp();
    fireEvent.click(screen.getByText('mappings.add').closest('button'));
    fireEvent.click(screen.getByText('modal.cancel'));
    await waitFor(() => {
      expect(screen.queryByText('modal.addTitle')).not.toBeInTheDocument();
    });
  });
});

describe('App — import mappings', () => {
  it('does nothing when the import dialog is canceled', async () => {
    const importFn = vi.fn().mockResolvedValue({ canceled: true });
    await renderApp({ mappings: { import: importFn } });
    fireEvent.click(screen.getByText('mappings.import').closest('button'));
    await waitFor(() => expect(importFn).toHaveBeenCalledOnce());
    expect(screen.queryByText('toast.importResult')).not.toBeInTheDocument();
    expect(screen.queryByText('toast.importFailed')).not.toBeInTheDocument();
  });

  it('refreshes mappings and shows a result toast on successful import', async () => {
    const newMappings = [{ id: 'm1', domain: 'imported.local', host: '127.0.0.1', port: 1, https: false, enabled: true, label: '' }];
    const importFn = vi.fn().mockResolvedValue({ canceled: false, success: true, added: 1, skipped: 0, mappings: newMappings });
    await renderApp({ mappings: { import: importFn } });
    fireEvent.click(screen.getByText('mappings.import').closest('button'));
    await waitFor(() => {
      expect(screen.getByText('toast.importResult')).toBeInTheDocument();
    });
    expect(screen.getByText('imported.local')).toBeInTheDocument();
  });

  it('shows an error toast when import fails', async () => {
    const importFn = vi.fn().mockResolvedValue({ canceled: false, success: false, error: 'boom' });
    await renderApp({ mappings: { import: importFn } });
    fireEvent.click(screen.getByText('mappings.import').closest('button'));
    await waitFor(() => {
      expect(screen.getByText('toast.importFailed')).toBeInTheDocument();
    });
  });
});

describe('App — export mappings', () => {
  const sampleMappings = [
    { id: 'm1', domain: 'a.local', host: '127.0.0.1', port: 1, https: false, enabled: true, label: '' },
  ];

  it('opens the export modal when the export button is clicked', async () => {
    await renderApp({ mappings: { list: vi.fn().mockResolvedValue(sampleMappings) } });
    fireEvent.click(screen.getByText('mappings.export').closest('button'));
    expect(screen.getByText('export.title')).toBeInTheDocument();
  });

  it('keeps the modal open without toasting when export is canceled', async () => {
    const exportFn = vi.fn().mockResolvedValue({ canceled: true });
    await renderApp({ mappings: { list: vi.fn().mockResolvedValue(sampleMappings), export: exportFn } });
    fireEvent.click(screen.getByText('mappings.export').closest('button'));
    fireEvent.click(screen.getByText('export.submit'));
    await waitFor(() => expect(exportFn).toHaveBeenCalledWith(['m1']));
    expect(screen.getByText('export.title')).toBeInTheDocument();
    expect(screen.queryByText('toast.exportSuccess')).not.toBeInTheDocument();
  });

  it('closes the modal and shows a success toast on successful export', async () => {
    const exportFn = vi.fn().mockResolvedValue({ canceled: false, success: true, count: 1, path: '/tmp/export.json' });
    await renderApp({ mappings: { list: vi.fn().mockResolvedValue(sampleMappings), export: exportFn } });
    fireEvent.click(screen.getByText('mappings.export').closest('button'));
    fireEvent.click(screen.getByText('export.submit'));
    await waitFor(() => {
      expect(screen.queryByText('export.title')).not.toBeInTheDocument();
      expect(screen.getByText('toast.exportSuccess')).toBeInTheDocument();
    });
  });

  it('keeps the modal open and shows an error toast when export fails', async () => {
    const exportFn = vi.fn().mockResolvedValue({ canceled: false, success: false, error: 'boom' });
    await renderApp({ mappings: { list: vi.fn().mockResolvedValue(sampleMappings), export: exportFn } });
    fireEvent.click(screen.getByText('mappings.export').closest('button'));
    fireEvent.click(screen.getByText('export.submit'));
    await waitFor(() => {
      expect(screen.getByText('toast.exportFailed')).toBeInTheDocument();
    });
    expect(screen.getByText('export.title')).toBeInTheDocument();
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
