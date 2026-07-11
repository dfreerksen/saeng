// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/renderer/components/utilities/Tooltip.jsx', () => ({
  default: ({ children }) => children,
}));

import MappingsView from '../../../src/renderer/components/MappingsView.jsx';

const t = (key) => key;

const SAMPLE_MAPPINGS = [
  { id: '1', domain: 'myapp.local', port: 3000, https: false, enabled: true },
  { id: '2', domain: 'api.myapp.local', port: 4000, https: true, enabled: false },
];

function renderMappingsView(props = {}) {
  const defaults = {
    mappings: [],
    setMappings: vi.fn(),
    proxyRunning: true,
    settings: { httpsEnabled: false, healthCheckEnabled: true },
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    showToast: vi.fn(),
    t,
  };
  return render(<MappingsView {...defaults} {...props} />);
}

beforeEach(() => {
  window.electronAPI = {
    mappings: {
      toggle: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue([]),
      setGroupEnabled: vi.fn().mockResolvedValue([]),
    },
  };
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn() },
    writable: true,
    configurable: true,
  });
});

describe('MappingsView — empty state', () => {
  it('shows the empty state element when there are no mappings', () => {
    renderMappingsView({ mappings: [] });
    expect(screen.getByText('mappings.empty')).toBeInTheDocument();
    expect(screen.getByText('mappings.emptyHint')).toBeInTheDocument();
  });

  it('does not render the mappings table when there are no mappings', () => {
    const { container } = renderMappingsView({ mappings: [] });
    expect(container.querySelector('#mappingsTable')).not.toBeInTheDocument();
  });
});

describe('MappingsView — table with mappings', () => {
  it('renders a table row for each mapping', () => {
    const { container } = renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    expect(container.querySelectorAll('tbody tr:not(.group-header-row)')).toHaveLength(2);
  });

  it('displays the domain in the table', () => {
    const { container } = renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    expect(container.querySelector('.domain-cell[data-domain="myapp.local"], td.domain-cell')).toBeInTheDocument();
    expect(container.querySelectorAll('td.domain-cell')).toHaveLength(2);
    expect(container.querySelectorAll('td.domain-cell')[0].textContent).toBe('myapp.local');
    expect(container.querySelectorAll('td.domain-cell')[1].textContent).toBe('api.myapp.local');
  });

  it('shows HTTP badge for a non-https mapping', () => {
    renderMappingsView({ mappings: [SAMPLE_MAPPINGS[0]] });
    expect(screen.getByText('HTTP')).toBeInTheDocument();
    const badge = screen.getByText('HTTP');
    expect(badge).toHaveClass('badge-http');
  });

  it('shows HTTPS badge for an https mapping', () => {
    renderMappingsView({ mappings: [SAMPLE_MAPPINGS[1]] });
    expect(screen.getByText('HTTPS')).toBeInTheDocument();
    const badge = screen.getByText('HTTPS');
    expect(badge).toHaveClass('badge-https');
  });

  it('reflects enabled state in the toggle checkbox', () => {
    const { container } = renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    const mappingCheckboxes = container.querySelectorAll('tr:not(.group-header-row) input[type="checkbox"]');
    expect(mappingCheckboxes[0]).toBeChecked();
    expect(mappingCheckboxes[1]).not.toBeChecked();
  });

  it('shows a mock indicator next to the domain when mocksEnabled is true', () => {
    const { container } = renderMappingsView({ mappings: [{ ...SAMPLE_MAPPINGS[0], mocksEnabled: true }] });
    expect(container.querySelector('td.domain-cell .mock-indicator')).toBeInTheDocument();
  });

  it('does not show a mock indicator when mocksEnabled is false', () => {
    const { container } = renderMappingsView({ mappings: [SAMPLE_MAPPINGS[0]] });
    expect(container.querySelector('td.domain-cell .mock-indicator')).not.toBeInTheDocument();
  });

  it('shows a rewrite indicator next to the domain when pathRewriteFrom is set', () => {
    const { container } = renderMappingsView({
      mappings: [{ ...SAMPLE_MAPPINGS[0], pathRewriteFrom: '/api/v2', pathRewriteTo: '/v3' }],
    });
    expect(container.querySelector('td.domain-cell .rewrite-indicator')).toBeInTheDocument();
  });

  it('does not show a rewrite indicator when pathRewriteFrom is empty', () => {
    const { container } = renderMappingsView({ mappings: [SAMPLE_MAPPINGS[0]] });
    expect(container.querySelector('td.domain-cell .rewrite-indicator')).not.toBeInTheDocument();
  });
});

describe('MappingsView — group headers', () => {
  it('renders one group header for mappings sharing a base domain', () => {
    const { container } = renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    expect(container.querySelectorAll('.group-header-row')).toHaveLength(1);
  });

  it('displays the base domain as the group name', () => {
    const { container } = renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    expect(container.querySelector('.group-name').textContent).toBe('myapp.local');
  });

  it('displays the number of mappings in the group as a count badge', () => {
    const { container } = renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    expect(container.querySelector('.group-count').textContent).toBe('(2)');
  });

  it('renders a separate group header for each distinct base domain', () => {
    const mappings = [
      { id: '1', domain: 'myapp.local', port: 3000, https: false, enabled: true },
      { id: '2', domain: 'other.local', port: 4000, https: false, enabled: true },
    ];
    const { container } = renderMappingsView({ mappings });
    expect(container.querySelectorAll('.group-header-row')).toHaveLength(2);
  });

  it('places subdomains under the same group as their base domain', () => {
    const { container } = renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    const tbody = container.querySelectorAll('tbody');
    expect(tbody).toHaveLength(1);
    expect(tbody[0].querySelectorAll('tr:not(.group-header-row)')).toHaveLength(2);
  });
});

describe('MappingsView — group member ordering', () => {
  it('places the bare domain before subdomains', () => {
    const mappings = [
      { id: '1', domain: 'api.myapp.local', port: 4000, https: false, enabled: true },
      { id: '2', domain: 'myapp.local', port: 3000, https: false, enabled: true },
    ];
    const { container } = renderMappingsView({ mappings });
    const cells = container.querySelectorAll('td.domain-cell');
    expect(cells[0].textContent).toBe('myapp.local');
    expect(cells[1].textContent).toBe('api.myapp.local');
  });

  it('places a wildcard subdomain after the bare domain and named subdomains', () => {
    const mappings = [
      { id: '1', domain: 'api.myapp.local', port: 4000, https: false, enabled: true },
      { id: '2', domain: '*.myapp.local', port: 3000, https: false, enabled: true },
      { id: '3', domain: 'myapp.local', port: 3000, https: false, enabled: true },
    ];
    const { container } = renderMappingsView({ mappings });
    const cells = container.querySelectorAll('td.domain-cell');
    expect(cells[0].textContent).toBe('myapp.local');
    expect(cells[1].textContent).toBe('api.myapp.local');
    expect(cells[2].textContent).toBe('*.myapp.local');
  });

  it('places numeric subdomains before alphabetic subdomains', () => {
    const mappings = [
      { id: '1', domain: 'web.myapp.local', port: 4000, https: false, enabled: true },
      { id: '2', domain: '1.myapp.local', port: 3000, https: false, enabled: true },
    ];
    const { container } = renderMappingsView({ mappings });
    const cells = container.querySelectorAll('td.domain-cell');
    expect(cells[0].textContent).toBe('1.myapp.local');
    expect(cells[1].textContent).toBe('web.myapp.local');
  });

  it('sorts numeric subdomains numerically rather than lexically', () => {
    const mappings = [
      { id: '1', domain: '10.myapp.local', port: 4000, https: false, enabled: true },
      { id: '2', domain: '2.myapp.local', port: 3000, https: false, enabled: true },
    ];
    const { container } = renderMappingsView({ mappings });
    const cells = container.querySelectorAll('td.domain-cell');
    expect(cells[0].textContent).toBe('2.myapp.local');
    expect(cells[1].textContent).toBe('10.myapp.local');
  });

  it('sorts alphabetic subdomains alphabetically', () => {
    const mappings = [
      { id: '1', domain: 'web.myapp.local', port: 4000, https: false, enabled: true },
      { id: '2', domain: 'api.myapp.local', port: 3000, https: false, enabled: true },
    ];
    const { container } = renderMappingsView({ mappings });
    const cells = container.querySelectorAll('td.domain-cell');
    expect(cells[0].textContent).toBe('api.myapp.local');
    expect(cells[1].textContent).toBe('web.myapp.local');
  });
});

describe('MappingsView — group toggle', () => {
  it('is checked when all mappings in the group are enabled', () => {
    const allEnabled = [
      { id: '1', domain: 'myapp.local', port: 3000, https: false, enabled: true },
      { id: '2', domain: 'api.myapp.local', port: 4000, https: false, enabled: true },
    ];
    const { container } = renderMappingsView({ mappings: allEnabled });
    expect(container.querySelector('.group-header-row input[type="checkbox"]')).toBeChecked();
  });

  it('is unchecked when any mapping in the group is disabled', () => {
    const { container } = renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    expect(container.querySelector('.group-header-row input[type="checkbox"]')).not.toBeChecked();
  });

  it('calls setGroupEnabled with all group ids and false when all are enabled', async () => {
    const allEnabled = [
      { id: '1', domain: 'myapp.local', port: 3000, https: false, enabled: true },
      { id: '2', domain: 'api.myapp.local', port: 4000, https: false, enabled: true },
    ];
    const { container } = renderMappingsView({ mappings: allEnabled });
    fireEvent.click(container.querySelector('.group-header-row input[type="checkbox"]'));
    await waitFor(() => {
      expect(window.electronAPI.mappings.setGroupEnabled).toHaveBeenCalledWith(['1', '2'], false);
    });
  });

  it('calls setGroupEnabled with all group ids and true when not all are enabled', async () => {
    const { container } = renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    fireEvent.click(container.querySelector('.group-header-row input[type="checkbox"]'));
    await waitFor(() => {
      expect(window.electronAPI.mappings.setGroupEnabled).toHaveBeenCalledWith(['1', '2'], true);
    });
  });

  it('updates mappings with the result from setGroupEnabled', async () => {
    const updated = [
      { id: '1', domain: 'myapp.local', port: 3000, https: false, enabled: false },
      { id: '2', domain: 'api.myapp.local', port: 4000, https: false, enabled: false },
    ];
    window.electronAPI.mappings.setGroupEnabled.mockResolvedValue(updated);
    const setMappings = vi.fn();
    const { container } = renderMappingsView({ mappings: SAMPLE_MAPPINGS, setMappings });
    fireEvent.click(container.querySelector('.group-header-row input[type="checkbox"]'));
    await waitFor(() => {
      expect(setMappings).toHaveBeenCalledWith(updated);
    });
  });
});

describe('MappingsView — active state', () => {
  it('always has the active class (visibility controlled by parent)', () => {
    const { container } = renderMappingsView();
    expect(container.querySelector('#view-mappings')).toHaveClass('active');
  });
});

describe('MappingsView — add button', () => {
  it('renders the add button', () => {
    renderMappingsView();
    expect(screen.getByText('mappings.actions.add')).toBeInTheDocument();
  });

  it('calls onAdd when the add button is clicked', () => {
    const onAdd = vi.fn();
    renderMappingsView({ onAdd });
    fireEvent.click(screen.getByText('mappings.actions.add').closest('button'));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});

describe('MappingsView — import button', () => {
  it('renders the import button', () => {
    renderMappingsView();
    expect(screen.getByText('mappings.actions.import')).toBeInTheDocument();
  });

  it('calls onImport when the import button is clicked', () => {
    const onImport = vi.fn();
    renderMappingsView({ onImport });
    fireEvent.click(screen.getByText('mappings.actions.import').closest('button'));
    expect(onImport).toHaveBeenCalledOnce();
  });

  it('is enabled even when there are no mappings', () => {
    renderMappingsView({ mappings: [] });
    expect(screen.getByText('mappings.actions.import').closest('button')).not.toBeDisabled();
  });
});

describe('MappingsView — export button', () => {
  it('renders the export button', () => {
    renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    expect(screen.getByText('mappings.actions.export')).toBeInTheDocument();
  });

  it('calls onExport when the export button is clicked', () => {
    const onExport = vi.fn();
    renderMappingsView({ mappings: SAMPLE_MAPPINGS, onExport });
    fireEvent.click(screen.getByText('mappings.actions.export').closest('button'));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('is disabled when there are no mappings', () => {
    renderMappingsView({ mappings: [] });
    expect(screen.getByText('mappings.actions.export').closest('button')).toBeDisabled();
  });

  it('is enabled when there are mappings', () => {
    renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    expect(screen.getByText('mappings.actions.export').closest('button')).not.toBeDisabled();
  });
});

describe('MappingsView — toggle', () => {
  it('calls electronAPI.mappings.toggle with the mapping id', async () => {
    const setMappings = vi.fn();
    const { container } = renderMappingsView({ mappings: SAMPLE_MAPPINGS, setMappings });
    const mappingCheckboxes = container.querySelectorAll('tr:not(.group-header-row) input[type="checkbox"]');
    fireEvent.click(mappingCheckboxes[0]);
    await waitFor(() => {
      expect(window.electronAPI.mappings.toggle).toHaveBeenCalledWith('1');
    });
  });

  it('updates mappings with the result from toggle', async () => {
    const updated = [{ id: '1', domain: 'myapp.local', port: 3000, https: false, enabled: false }];
    window.electronAPI.mappings.toggle.mockResolvedValue(updated);
    const setMappings = vi.fn();
    const { container } = renderMappingsView({ mappings: SAMPLE_MAPPINGS, setMappings });
    const mappingCheckboxes = container.querySelectorAll('tr:not(.group-header-row) input[type="checkbox"]');
    fireEvent.click(mappingCheckboxes[0]);
    await waitFor(() => {
      expect(setMappings).toHaveBeenCalledWith(updated);
    });
  });
});

describe('MappingsView — delete', () => {
  it('shows a confirm modal before deleting', () => {
    renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('btn-delete')));
    expect(screen.getByText('common.confirm.title')).toBeInTheDocument();
    expect(window.electronAPI.mappings.remove).not.toHaveBeenCalled();
  });

  it('calls electronAPI.mappings.remove when the confirm button is clicked', async () => {
    renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('btn-delete')));
    fireEvent.click(screen.getByText('mappings.table.actions.delete'));
    await waitFor(() => {
      expect(window.electronAPI.mappings.remove).toHaveBeenCalledWith('1');
    });
  });

  it('does not call remove and closes the modal when cancel is clicked', () => {
    renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('btn-delete')));
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.cancel'));
    expect(window.electronAPI.mappings.remove).not.toHaveBeenCalled();
    expect(screen.queryByText('common.confirm.title')).not.toBeInTheDocument();
  });
});

describe('MappingsView — edit', () => {
  it('calls onEdit with the mapping object when edit button is clicked', () => {
    const onEdit = vi.fn();
    renderMappingsView({ mappings: SAMPLE_MAPPINGS, onEdit });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('btn-edit')));
    expect(onEdit).toHaveBeenCalledWith(SAMPLE_MAPPINGS[0]);
  });
});

describe('MappingsView — health status', () => {
  it('shows an unknown dot when there is no health status for a mapping', () => {
    const { container } = renderMappingsView({ mappings: [SAMPLE_MAPPINGS[0]], healthStatuses: {} });
    expect(container.querySelector('.health-dot')).toHaveClass('unknown');
  });

  it('shows an up dot when the health status is up', () => {
    const { container } = renderMappingsView({
      mappings: [SAMPLE_MAPPINGS[0]],
      healthStatuses: { 1: { id: '1', status: 'up', latencyMs: 12, error: null } },
    });
    expect(container.querySelector('.health-dot')).toHaveClass('up');
  });

  it('shows a down dot when the health status is down', () => {
    const { container } = renderMappingsView({
      mappings: [SAMPLE_MAPPINGS[0]],
      healthStatuses: { 1: { id: '1', status: 'down', latencyMs: 2000, error: 'timeout' } },
    });
    expect(container.querySelector('.health-dot')).toHaveClass('down');
  });

  it('hides the health dot when health checks are disabled in settings', () => {
    const { container } = renderMappingsView({
      mappings: [SAMPLE_MAPPINGS[0]],
      healthStatuses: { 1: { id: '1', status: 'up', latencyMs: 12, error: null } },
      settings: { httpsEnabled: false, healthCheckEnabled: false },
    });
    expect(container.querySelector('.health-dot')).not.toBeInTheDocument();
  });

  it('shows an unknown dot for a disabled mapping even with a stale health status', () => {
    const { container } = renderMappingsView({
      mappings: [SAMPLE_MAPPINGS[1]],
      healthStatuses: { 2: { id: '2', status: 'up', latencyMs: 12, error: null } },
    });
    expect(container.querySelector('.health-dot')).toHaveClass('unknown');
  });

  it('shows an unknown dot when the proxy is stopped, even with a stale health status', () => {
    const { container } = renderMappingsView({
      mappings: [SAMPLE_MAPPINGS[0]],
      healthStatuses: { 1: { id: '1', status: 'up', latencyMs: 12, error: null } },
      proxyRunning: false,
    });
    expect(container.querySelector('.health-dot')).toHaveClass('unknown');
  });
});

describe('MappingsView — copy', () => {
  it('calls showToast when copy button is clicked', () => {
    const showToast = vi.fn();
    renderMappingsView({ mappings: SAMPLE_MAPPINGS, showToast });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('btn-copy')));
    expect(showToast).toHaveBeenCalledOnce();
  });

  it('writes the http URL to clipboard when httpsEnabled is false', () => {
    renderMappingsView({ mappings: [SAMPLE_MAPPINGS[0]], settings: { httpsEnabled: false } });
    fireEvent.click(screen.getByRole('button', { name: (_, el) => el.classList.contains('btn-copy') }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://myapp.local');
  });

  it('writes the https URL to clipboard when httpsEnabled is true', () => {
    renderMappingsView({ mappings: [SAMPLE_MAPPINGS[0]], settings: { httpsEnabled: true } });
    fireEvent.click(screen.getByRole('button', { name: (_, el) => el.classList.contains('btn-copy') }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://myapp.local');
  });

  it('writes the base domain to clipboard for a wildcard subdomain mapping', () => {
    const wildcardMapping = { id: '3', domain: '*.myapp.local', port: 5000, https: false, enabled: true };
    renderMappingsView({ mappings: [wildcardMapping], settings: { httpsEnabled: true } });
    fireEvent.click(screen.getByRole('button', { name: (_, el) => el.classList.contains('btn-copy') }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://myapp.local');
  });
});
