// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/renderer/components/modals/MappingModal.jsx', () => ({
  default: (props) => (
    <div data-testid="mapping-modal">
      <span data-testid="mapping-modal-mapping">{props.mapping ? props.mapping.id : ''}</span>
      <span data-testid="mapping-modal-https">{String(props.httpsEnabled)}</span>
      <button onClick={() => props.onSubmit({ domain: 'new.local', host: '127.0.0.1', port: 3000 })}>submit</button>
      <button onClick={props.onClose}>close</button>
    </div>
  ),
}));

vi.mock('../../../../src/renderer/components/modals/MockModal.jsx', () => ({
  default: (props) => (
    <div data-testid="mock-modal">
      <span data-testid="mock-modal-mock">{props.mock ? props.mock.id : ''}</span>
      <span data-testid="mock-modal-initial">{props.initialValues ? props.initialValues.pathPattern : ''}</span>
      <span data-testid="mock-modal-mappings">{props.mappings.map((m) => m.id).join(',')}</span>
      <button onClick={() => props.onSubmit({ pathPattern: '^/x$' })}>submit</button>
      <button onClick={props.onClose}>close</button>
    </div>
  ),
}));

vi.mock('../../../../src/renderer/components/modals/ExportModal.jsx', () => ({
  default: (props) => (
    <div data-testid="export-modal">
      <span data-testid="export-modal-prefix">{props.i18nPrefix}</span>
      <span data-testid="export-modal-items">{props.items.map((i) => i.label).join(',')}</span>
      <button onClick={() => props.onSubmit(['id1'])}>submit</button>
      <button onClick={props.onClose}>close</button>
    </div>
  ),
}));

vi.mock('../../../../src/renderer/components/modals/AboutModal.jsx', () => ({
  default: (props) => (
    <div data-testid="about-modal">
      <span data-testid="about-modal-version">{props.version}</span>
      <span data-testid="about-modal-electron">{props.electronVersion}</span>
      <span data-testid="about-modal-node">{props.nodeVersion}</span>
      <span data-testid="about-modal-bootstrap">{props.bootstrapVersion}</span>
      <button onClick={props.onClose}>close</button>
    </div>
  ),
}));

import AppModals from '../../../../src/renderer/components/modals/AppModals.jsx';
import { I18nContext } from '../../../../src/renderer/js/i18nContext.js';

const t = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);

const SAMPLE_MAPPINGS = [
  { id: 'm1', domain: 'myapp.local', port: 3000, https: false, enabled: true },
];

const SAMPLE_MOCKS = [
  { id: 'mock1', mappingId: 'm1', method: 'GET', pathPattern: '^/api$' },
];

function renderModals(props = {}) {
  const defaults = {
    modal: null,
    mappings: SAMPLE_MAPPINGS,
    setMappings: vi.fn(),
    mocks: SAMPLE_MOCKS,
    setMocks: vi.fn(),
    mockModalMappings: vi.fn().mockReturnValue(SAMPLE_MAPPINGS),
    settings: { httpsEnabled: true },
    appVersion: '1.0.0',
    electronVersion: '30.0.0',
    nodeVersion: '20.0.0',
    bootstrapVersion: '5.3.0',
    onClose: vi.fn(),
    setModal: vi.fn(),
    showToast: vi.fn(),
    t,
  };
  return render(
    <I18nContext value={t}>
      <AppModals {...defaults} {...props} />
    </I18nContext>
  );
}

beforeEach(() => {
  window.electronAPI = {
    mappings: {
      add: vi.fn().mockResolvedValue([{ id: 'm2' }]),
      update: vi.fn().mockResolvedValue([{ id: 'm1' }]),
      export: vi.fn().mockResolvedValue({ success: true, count: 1, path: '/tmp/out.json' }),
    },
    mocks: {
      add: vi.fn().mockResolvedValue({ success: true, mocks: [{ id: 'mock2' }] }),
      update: vi.fn().mockResolvedValue({ success: true, mocks: [{ id: 'mock1' }] }),
      export: vi.fn().mockResolvedValue({ success: true, count: 1, path: '/tmp/mocks.json' }),
    },
  };
});

describe('AppModals — no modal', () => {
  it('renders nothing when modal is null', () => {
    const { container } = renderModals({ modal: null });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an unknown modal type', () => {
    const { container } = renderModals({ modal: { type: 'unknown' } });
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AppModals — addMapping', () => {
  it('renders MappingModal in add mode, without a mapping prop', () => {
    renderModals({ modal: { type: 'addMapping' } });
    expect(screen.getByTestId('mapping-modal')).toBeInTheDocument();
    expect(screen.getByTestId('mapping-modal-mapping')).toHaveTextContent('');
  });

  it('passes httpsEnabled from settings', () => {
    renderModals({ modal: { type: 'addMapping' }, settings: { httpsEnabled: false } });
    expect(screen.getByTestId('mapping-modal-https')).toHaveTextContent('false');
  });

  it('adds a mapping, updates state, closes the modal, and shows a toast on submit', async () => {
    const setMappings = vi.fn();
    const setModal = vi.fn();
    const showToast = vi.fn();
    renderModals({ modal: { type: 'addMapping' }, setMappings, setModal, showToast });
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => {
      expect(window.electronAPI.mappings.add).toHaveBeenCalledWith({ domain: 'new.local', host: '127.0.0.1', port: 3000 });
      expect(setMappings).toHaveBeenCalledWith([{ id: 'm2' }]);
      expect(setModal).toHaveBeenCalledWith(null);
      expect(showToast).toHaveBeenCalledWith(
        'flash.mapping.added:{"domain":"new.local","host":"127.0.0.1","port":3000}',
        'success'
      );
    });
  });

  it('calls onClose when the modal requests closing', () => {
    const onClose = vi.fn();
    renderModals({ modal: { type: 'addMapping' }, onClose });
    fireEvent.click(screen.getByText('close'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('AppModals — editMapping', () => {
  const EXISTING_MAPPING = { id: 'm1', domain: 'myapp.local' };

  it('passes the mapping being edited', () => {
    renderModals({ modal: { type: 'editMapping', mapping: EXISTING_MAPPING } });
    expect(screen.getByTestId('mapping-modal-mapping')).toHaveTextContent('m1');
  });

  it('updates the mapping by id on submit', async () => {
    const setMappings = vi.fn();
    renderModals({ modal: { type: 'editMapping', mapping: EXISTING_MAPPING }, setMappings });
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => {
      expect(window.electronAPI.mappings.update).toHaveBeenCalledWith('m1', { domain: 'new.local', host: '127.0.0.1', port: 3000 });
      expect(setMappings).toHaveBeenCalledWith([{ id: 'm1' }]);
    });
  });
});

describe('AppModals — exportMappings', () => {
  it('passes mapping items as id/label pairs and the mappings export prefix', () => {
    renderModals({ modal: { type: 'exportMappings' } });
    expect(screen.getByTestId('export-modal-prefix')).toHaveTextContent('mappings.modals.export');
    expect(screen.getByTestId('export-modal-items')).toHaveTextContent('myapp.local');
  });

  it('exports, closes the modal, and shows a success toast', async () => {
    const setModal = vi.fn();
    const showToast = vi.fn();
    renderModals({ modal: { type: 'exportMappings' }, setModal, showToast });
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => {
      expect(window.electronAPI.mappings.export).toHaveBeenCalledWith(['id1']);
      expect(setModal).toHaveBeenCalledWith(null);
      expect(showToast).toHaveBeenCalledWith(
        'flash.export.success:{"count":1,"path":"/tmp/out.json"}',
        'success'
      );
    });
  });

  it('shows an error toast and does not close when export fails', async () => {
    window.electronAPI.mappings.export.mockResolvedValue({ success: false, error: 'boom' });
    const setModal = vi.fn();
    const showToast = vi.fn();
    renderModals({ modal: { type: 'exportMappings' }, setModal, showToast });
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('flash.export.error:{"error":"boom"}', 'error');
    });
    expect(setModal).not.toHaveBeenCalled();
  });

  it('does nothing when the export dialog is canceled', async () => {
    window.electronAPI.mappings.export.mockResolvedValue({ canceled: true });
    const setModal = vi.fn();
    const showToast = vi.fn();
    renderModals({ modal: { type: 'exportMappings' }, setModal, showToast });
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => {
      expect(window.electronAPI.mappings.export).toHaveBeenCalled();
    });
    expect(setModal).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});

describe('AppModals — addMock', () => {
  it('uses mockModalMappings() (with no argument) for the mappings list', () => {
    const mockModalMappings = vi.fn().mockReturnValue(SAMPLE_MAPPINGS);
    renderModals({ modal: { type: 'addMock' }, mockModalMappings });
    expect(mockModalMappings).toHaveBeenCalledWith();
    expect(screen.getByTestId('mock-modal-mappings')).toHaveTextContent('m1');
  });

  it('adds a mock, updates state, closes the modal, and shows a toast on submit', async () => {
    const setMocks = vi.fn();
    const setModal = vi.fn();
    const showToast = vi.fn();
    renderModals({ modal: { type: 'addMock' }, setMocks, setModal, showToast });
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => {
      expect(window.electronAPI.mocks.add).toHaveBeenCalledWith({ pathPattern: '^/x$' });
      expect(setMocks).toHaveBeenCalledWith([{ id: 'mock2' }]);
      expect(setModal).toHaveBeenCalledWith(null);
      expect(showToast).toHaveBeenCalledWith('flash.mock.added', 'success');
    });
  });

  it('does not update state or close when the add fails', async () => {
    window.electronAPI.mocks.add.mockResolvedValue({ success: false, error: 'bad regex' });
    const setMocks = vi.fn();
    const setModal = vi.fn();
    renderModals({ modal: { type: 'addMock' }, setMocks, setModal });
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => {
      expect(window.electronAPI.mocks.add).toHaveBeenCalled();
    });
    expect(setMocks).not.toHaveBeenCalled();
    expect(setModal).not.toHaveBeenCalled();
  });
});

describe('AppModals — editMock', () => {
  const EXISTING_MOCK = { id: 'mock1', mappingId: 'm1' };

  it('passes mockModalMappings(mock) and the mock being edited', () => {
    const mockModalMappings = vi.fn().mockReturnValue(SAMPLE_MAPPINGS);
    renderModals({ modal: { type: 'editMock', mock: EXISTING_MOCK }, mockModalMappings });
    expect(mockModalMappings).toHaveBeenCalledWith(EXISTING_MOCK);
    expect(screen.getByTestId('mock-modal-mock')).toHaveTextContent('mock1');
  });

  it('updates the mock by id on submit', async () => {
    const setMocks = vi.fn();
    const showToast = vi.fn();
    renderModals({ modal: { type: 'editMock', mock: EXISTING_MOCK }, setMocks, showToast });
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => {
      expect(window.electronAPI.mocks.update).toHaveBeenCalledWith('mock1', { pathPattern: '^/x$' });
      expect(setMocks).toHaveBeenCalledWith([{ id: 'mock1' }]);
      expect(showToast).toHaveBeenCalledWith('flash.mock.updated', 'success');
    });
  });
});

describe('AppModals — exportMocks', () => {
  it('formats mock items with method and path pattern', () => {
    renderModals({ modal: { type: 'exportMocks' } });
    expect(screen.getByTestId('export-modal-prefix')).toHaveTextContent('mocks.modals.export');
    expect(screen.getByTestId('export-modal-items')).toHaveTextContent('GET ^/api$');
  });

  it('renders "any" for wildcard method mocks', () => {
    renderModals({ modal: { type: 'exportMocks' }, mocks: [{ id: 'mock1', method: '*', pathPattern: '^/x$' }] });
    expect(screen.getByTestId('export-modal-items')).toHaveTextContent('mocks.modals.manage.form.method.any ^/x$');
  });

  it('exports, closes the modal, and shows a success toast', async () => {
    const setModal = vi.fn();
    const showToast = vi.fn();
    renderModals({ modal: { type: 'exportMocks' }, setModal, showToast });
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => {
      expect(window.electronAPI.mocks.export).toHaveBeenCalledWith(['id1']);
      expect(setModal).toHaveBeenCalledWith(null);
      expect(showToast).toHaveBeenCalledWith(
        'flash.mocksExport.success:{"count":1,"path":"/tmp/mocks.json"}',
        'success'
      );
    });
  });
});

describe('AppModals — convertToMock', () => {
  it('passes initialValues through to MockModal and resolves mappings by mappingId', () => {
    const mockModalMappings = vi.fn().mockReturnValue(SAMPLE_MAPPINGS);
    renderModals({
      modal: { type: 'convertToMock', mappingId: 'm1', initialValues: { pathPattern: '^/converted$' } },
      mockModalMappings,
    });
    expect(mockModalMappings).toHaveBeenCalledWith({ mappingId: 'm1' });
    expect(screen.getByTestId('mock-modal-initial')).toHaveTextContent('^/converted$');
  });

  it('adds the converted mock and shows the mock-added toast', async () => {
    const setMocks = vi.fn();
    const showToast = vi.fn();
    renderModals({
      modal: { type: 'convertToMock', mappingId: 'm1', initialValues: { pathPattern: '^/converted$' } },
      setMocks,
      showToast,
    });
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => {
      expect(window.electronAPI.mocks.add).toHaveBeenCalledWith({ pathPattern: '^/x$' });
      expect(setMocks).toHaveBeenCalledWith([{ id: 'mock2' }]);
      expect(showToast).toHaveBeenCalledWith('flash.mock.added', 'success');
    });
  });
});

describe('AppModals — about', () => {
  it('passes app metadata through to AboutModal', () => {
    renderModals({ modal: { type: 'about' } });
    expect(screen.getByTestId('about-modal-version')).toHaveTextContent('1.0.0');
    expect(screen.getByTestId('about-modal-electron')).toHaveTextContent('30.0.0');
    expect(screen.getByTestId('about-modal-node')).toHaveTextContent('20.0.0');
    expect(screen.getByTestId('about-modal-bootstrap')).toHaveTextContent('5.3.0');
  });

  it('calls onClose when closed', () => {
    const onClose = vi.fn();
    renderModals({ modal: { type: 'about' }, onClose });
    fireEvent.click(screen.getByText('close'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
