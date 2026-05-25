// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/renderer/components/Tooltip.jsx', () => ({
  default: ({ children }) => children,
}));

import MappingsView from '../../../src/renderer/components/MappingsView.jsx';

const t = (key) => key;

const SAMPLE_MAPPINGS = [
  { id: '1', domain: 'myapp.local', port: 3000, https: false, enabled: true, label: 'My App' },
  { id: '2', domain: 'api.myapp.local', port: 4000, https: true, enabled: false, label: '' },
];

function renderMappingsView(props = {}) {
  const defaults = {
    active: true,
    mappings: [],
    setMappings: vi.fn(),
    settings: { httpsEnabled: false },
    onAdd: vi.fn(),
    onEdit: vi.fn(),
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
    },
  };
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn() },
    writable: true,
    configurable: true,
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
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
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('displays the domain in the table', () => {
    renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    expect(screen.getByText('myapp.local')).toBeInTheDocument();
    expect(screen.getByText('api.myapp.local')).toBeInTheDocument();
  });

  it('displays the label in the table', () => {
    renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    expect(screen.getByText('My App')).toBeInTheDocument();
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
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });
});

describe('MappingsView — active state', () => {
  it('adds active class to the view when active=true', () => {
    const { container } = renderMappingsView({ active: true });
    expect(container.querySelector('#view-mappings')).toHaveClass('active');
  });

  it('does not add active class when active=false', () => {
    const { container } = renderMappingsView({ active: false });
    expect(container.querySelector('#view-mappings')).not.toHaveClass('active');
  });
});

describe('MappingsView — add button', () => {
  it('renders the add button', () => {
    renderMappingsView();
    expect(screen.getByText('mappings.add')).toBeInTheDocument();
  });

  it('calls onAdd when the add button is clicked', () => {
    const onAdd = vi.fn();
    renderMappingsView({ onAdd });
    fireEvent.click(screen.getByText('mappings.add').closest('button'));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});

describe('MappingsView — toggle', () => {
  it('calls electronAPI.mappings.toggle with the mapping id', async () => {
    const setMappings = vi.fn();
    const { container } = renderMappingsView({ mappings: SAMPLE_MAPPINGS, setMappings });
    fireEvent.click(container.querySelectorAll('input[type="checkbox"]')[0]);
    await waitFor(() => {
      expect(window.electronAPI.mappings.toggle).toHaveBeenCalledWith('1');
    });
  });

  it('updates mappings with the result from toggle', async () => {
    const updated = [{ id: '1', domain: 'myapp.local', port: 3000, https: false, enabled: false, label: '' }];
    window.electronAPI.mappings.toggle.mockResolvedValue(updated);
    const setMappings = vi.fn();
    const { container } = renderMappingsView({ mappings: SAMPLE_MAPPINGS, setMappings });
    fireEvent.click(container.querySelectorAll('input[type="checkbox"]')[0]);
    await waitFor(() => {
      expect(setMappings).toHaveBeenCalledWith(updated);
    });
  });
});

describe('MappingsView — delete', () => {
  it('calls confirm before deleting', async () => {
    renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('btn-delete')));
    expect(window.confirm).toHaveBeenCalled();
  });

  it('calls electronAPI.mappings.remove when confirmed', async () => {
    window.confirm.mockReturnValue(true);
    renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('btn-delete')));
    await waitFor(() => {
      expect(window.electronAPI.mappings.remove).toHaveBeenCalledWith('1');
    });
  });

  it('does not call remove when confirmation is denied', () => {
    window.confirm.mockReturnValue(false);
    renderMappingsView({ mappings: SAMPLE_MAPPINGS });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('btn-delete')));
    expect(window.electronAPI.mappings.remove).not.toHaveBeenCalled();
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
});
