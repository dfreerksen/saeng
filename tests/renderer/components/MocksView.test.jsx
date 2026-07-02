// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/renderer/components/Tooltip.jsx', () => ({
  default: ({ children }) => children,
}));

import MocksView from '../../../src/renderer/components/MocksView.jsx';

const t = (key) => key;

const SAMPLE_MAPPINGS = [
  { id: 'm1', domain: 'myapp.local', port: 3000, https: false, enabled: true },
  { id: 'm2', domain: 'api.myapp.local', port: 4000, https: true, enabled: true },
];

const SAMPLE_MOCKS = [
  { id: 'mock1', mappingId: 'm1', method: 'GET', pathPattern: '^/api/ping$', statusCode: 200, enabled: true },
  { id: 'mock2', mappingId: 'm2', method: '*', pathPattern: '^/users', statusCode: 404, enabled: false },
];

function renderMocksView(props = {}) {
  const defaults = {
    mocks: [],
    mappings: SAMPLE_MAPPINGS,
    mockableMappings: SAMPLE_MAPPINGS,
    setMocks: vi.fn(),
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    t,
  };
  return render(<MocksView {...defaults} {...props} />);
}

beforeEach(() => {
  window.electronAPI = {
    mocks: {
      toggle: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue([]),
    },
  };
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('MocksView — empty state', () => {
  it('shows the empty state element when there are no mocks', () => {
    renderMocksView({ mocks: [] });
    expect(screen.getByText('mocks.empty')).toBeInTheDocument();
    expect(screen.getByText('mocks.emptyHint')).toBeInTheDocument();
  });

  it('shows the bi-magic icon in the empty state', () => {
    const { container } = renderMocksView({ mocks: [] });
    expect(container.querySelector('#mocksEmptyState .bi-magic')).toBeInTheDocument();
  });

  it('does not render the mocks table when there are no mocks', () => {
    const { container } = renderMocksView({ mocks: [] });
    expect(container.querySelector('#mocksTable')).not.toBeInTheDocument();
  });
});

describe('MocksView — add button', () => {
  it('renders the add button', () => {
    renderMocksView();
    expect(screen.getByText('mocks.actions.add')).toBeInTheDocument();
  });

  it('disables the add button when there are no mockable mappings', () => {
    renderMocksView({ mockableMappings: [] });
    expect(screen.getByText('mocks.actions.add').closest('button')).toBeDisabled();
  });

  it('disables the add button when mappings exist but none have mocking enabled', () => {
    renderMocksView({ mappings: SAMPLE_MAPPINGS, mockableMappings: [] });
    expect(screen.getByText('mocks.actions.add').closest('button')).toBeDisabled();
  });

  it('enables the add button when there are mockable mappings', () => {
    renderMocksView({ mockableMappings: SAMPLE_MAPPINGS });
    expect(screen.getByText('mocks.actions.add').closest('button')).not.toBeDisabled();
  });

  it('calls onAdd when the add button is clicked', () => {
    const onAdd = vi.fn();
    renderMocksView({ onAdd });
    fireEvent.click(screen.getByText('mocks.actions.add').closest('button'));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});

describe('MocksView — table with mocks', () => {
  it('renders a table row for each mock', () => {
    const { container } = renderMocksView({ mocks: SAMPLE_MOCKS });
    expect(container.querySelectorAll('tbody tr:not(.group-header-row)')).toHaveLength(2);
  });

  it('groups mocks by mapping domain', () => {
    const { container } = renderMocksView({ mocks: SAMPLE_MOCKS });
    const groupNames = [...container.querySelectorAll('.group-name')].map((el) => el.textContent);
    expect(groupNames).toEqual(['myapp.local', 'api.myapp.local']);
  });

  it('falls back to the mappingId as the group name when the mapping no longer exists', () => {
    const { container } = renderMocksView({
      mocks: [{ id: 'mock3', mappingId: 'missing', method: 'GET', pathPattern: '^/x$', statusCode: 200, enabled: true }],
      mappings: SAMPLE_MAPPINGS,
    });
    expect(container.querySelector('.group-name').textContent).toBe('missing');
  });

  it('shows the method as a badge', () => {
    renderMocksView({ mocks: [SAMPLE_MOCKS[0]] });
    const badge = screen.getByText('GET');
    expect(badge).toHaveClass('badge-http');
  });

  it('shows "any" translation for a wildcard method', () => {
    renderMocksView({ mocks: [SAMPLE_MOCKS[1]] });
    expect(screen.getByText('mocks.modals.manage.form.method.any')).toBeInTheDocument();
  });

  it('shows the path pattern in a code element', () => {
    const { container } = renderMocksView({ mocks: [SAMPLE_MOCKS[0]] });
    expect(container.querySelector('.log-path-cell code').textContent).toBe('^/api/ping$');
  });

  it('shows the status code', () => {
    renderMocksView({ mocks: [SAMPLE_MOCKS[0]] });
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('reflects the enabled state in the toggle checkbox', () => {
    const { container } = renderMocksView({ mocks: SAMPLE_MOCKS });
    const toggles = container.querySelectorAll('input[type="checkbox"]');
    expect(toggles[0]).toBeChecked();
    expect(toggles[1]).not.toBeChecked();
  });

  it('does not show a conditions badge when the mock has no conditions', () => {
    renderMocksView({ mocks: [SAMPLE_MOCKS[0]] });
    expect(screen.queryByText('mocks.table.conditionsBadge')).not.toBeInTheDocument();
  });

  it('shows a conditions badge when the mock has conditions', () => {
    const mockWithConditions = {
      ...SAMPLE_MOCKS[0],
      conditions: [{ type: 'header', key: 'x-token', operator: 'exists' }],
    };
    const { container } = renderMocksView({ mocks: [mockWithConditions] });
    const badge = screen.getByText('mocks.table.conditionsBadge');
    expect(badge).toHaveClass('badge-conditions');
    expect(container.querySelector('.log-path-cell').contains(badge)).toBe(true);
  });
});

describe('MocksView — disabled mapping', () => {
  const DISABLED_MAPPINGS = [
    { id: 'm1', domain: 'myapp.local', port: 3000, https: false, enabled: false },
    { id: 'm2', domain: 'api.myapp.local', port: 4000, https: true, enabled: true },
  ];

  it('disables the toggle for a mock whose mapping is disabled', () => {
    const { container } = renderMocksView({ mocks: SAMPLE_MOCKS, mappings: DISABLED_MAPPINGS });
    const toggles = container.querySelectorAll('input[type="checkbox"]');
    expect(toggles[0]).toBeDisabled();
    expect(toggles[1]).not.toBeDisabled();
  });

  it('disables the edit button for a mock whose mapping is disabled', () => {
    const { container } = renderMocksView({ mocks: SAMPLE_MOCKS, mappings: DISABLED_MAPPINGS });
    const editButtons = [...container.querySelectorAll('.btn-edit')];
    expect(editButtons[0]).toBeDisabled();
    expect(editButtons[1]).not.toBeDisabled();
  });

  it('does not disable the delete button for a mock whose mapping is disabled', () => {
    const { container } = renderMocksView({ mocks: SAMPLE_MOCKS, mappings: DISABLED_MAPPINGS });
    const deleteButtons = [...container.querySelectorAll('.btn-delete')];
    expect(deleteButtons[0]).not.toBeDisabled();
  });
});

describe('MocksView — toggle', () => {
  it('calls electronAPI.mocks.toggle with the mock id', async () => {
    const { container } = renderMocksView({ mocks: SAMPLE_MOCKS });
    const toggles = container.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(toggles[0]);
    await waitFor(() => {
      expect(window.electronAPI.mocks.toggle).toHaveBeenCalledWith('mock1');
    });
  });

  it('updates mocks with the result from toggle', async () => {
    const updated = [{ ...SAMPLE_MOCKS[0], enabled: false }];
    window.electronAPI.mocks.toggle.mockResolvedValue(updated);
    const setMocks = vi.fn();
    const { container } = renderMocksView({ mocks: SAMPLE_MOCKS, setMocks });
    const toggles = container.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(toggles[0]);
    await waitFor(() => {
      expect(setMocks).toHaveBeenCalledWith(updated);
    });
  });
});

describe('MocksView — edit', () => {
  it('calls onEdit with the mock object when the edit button is clicked', () => {
    const onEdit = vi.fn();
    renderMocksView({ mocks: SAMPLE_MOCKS, onEdit });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('btn-edit')));
    expect(onEdit).toHaveBeenCalledWith(SAMPLE_MOCKS[0]);
  });
});

describe('MocksView — delete', () => {
  it('calls confirm before deleting', () => {
    renderMocksView({ mocks: SAMPLE_MOCKS });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('btn-delete')));
    expect(window.confirm).toHaveBeenCalled();
  });

  it('calls electronAPI.mocks.remove when confirmed', async () => {
    window.confirm.mockReturnValue(true);
    renderMocksView({ mocks: SAMPLE_MOCKS });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('btn-delete')));
    await waitFor(() => {
      expect(window.electronAPI.mocks.remove).toHaveBeenCalledWith('mock1');
    });
  });

  it('does not call remove when confirmation is denied', () => {
    window.confirm.mockReturnValue(false);
    renderMocksView({ mocks: SAMPLE_MOCKS });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('btn-delete')));
    expect(window.electronAPI.mocks.remove).not.toHaveBeenCalled();
  });

  it('updates mocks with the result from remove', async () => {
    const updated = [SAMPLE_MOCKS[1]];
    window.electronAPI.mocks.remove.mockResolvedValue(updated);
    const setMocks = vi.fn();
    renderMocksView({ mocks: SAMPLE_MOCKS, setMocks });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('btn-delete')));
    await waitFor(() => {
      expect(setMocks).toHaveBeenCalledWith(updated);
    });
  });
});

describe('MocksView — import button', () => {
  it('renders the import button', () => {
    renderMocksView();
    expect(screen.getByText('mocks.actions.import')).toBeInTheDocument();
  });

  it('calls onImport when the import button is clicked', () => {
    const onImport = vi.fn();
    renderMocksView({ onImport });
    fireEvent.click(screen.getByText('mocks.actions.import').closest('button'));
    expect(onImport).toHaveBeenCalledOnce();
  });

  it('is enabled even when there are no mocks', () => {
    renderMocksView({ mocks: [] });
    expect(screen.getByText('mocks.actions.import').closest('button')).not.toBeDisabled();
  });
});

describe('MocksView — export button', () => {
  it('renders the export button', () => {
    renderMocksView({ mocks: SAMPLE_MOCKS });
    expect(screen.getByText('mocks.actions.export')).toBeInTheDocument();
  });

  it('calls onExport when the export button is clicked', () => {
    const onExport = vi.fn();
    renderMocksView({ mocks: SAMPLE_MOCKS, onExport });
    fireEvent.click(screen.getByText('mocks.actions.export').closest('button'));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('is disabled when there are no mocks', () => {
    renderMocksView({ mocks: [] });
    expect(screen.getByText('mocks.actions.export').closest('button')).toBeDisabled();
  });

  it('is enabled when there are mocks', () => {
    renderMocksView({ mocks: SAMPLE_MOCKS });
    expect(screen.getByText('mocks.actions.export').closest('button')).not.toBeDisabled();
  });
});

describe('MocksView — active state', () => {
  it('always has the active class (visibility controlled by parent)', () => {
    const { container } = renderMocksView();
    expect(container.querySelector('#view-mocks')).toHaveClass('active');
  });
});
