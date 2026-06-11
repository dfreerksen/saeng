// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/renderer/components/Modal.jsx', () => ({
  default: ({ children }) => <div data-testid="modal-wrapper">{children}</div>,
}));

import ExportModal from '../../../src/renderer/components/ExportModal.jsx';

const t = (key) => key;

const SAMPLE_MAPPINGS = [
  { id: '1', domain: 'myapp.local' },
  { id: '2', domain: 'api.local' },
];

function renderExportModal(props = {}) {
  const defaults = {
    mappings: SAMPLE_MAPPINGS,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    t,
  };
  return render(<ExportModal {...defaults} {...props} />);
}

function checkboxFor(domainText) {
  return screen.getByText(domainText).closest('label').querySelector('input[type="checkbox"]');
}

describe('ExportModal — rendering', () => {
  it('renders the title and subtitle', () => {
    renderExportModal();
    expect(screen.getByText('mappings.modals.export.title')).toBeInTheDocument();
    expect(screen.getByText('mappings.modals.export.description')).toBeInTheDocument();
  });

  it('renders a checkbox row for each mapping showing domain', () => {
    renderExportModal();
    expect(screen.getByText('myapp.local')).toBeInTheDocument();
    expect(screen.getByText('api.local')).toBeInTheDocument();
  });

  it('starts with every mapping selected', () => {
    renderExportModal();
    expect(checkboxFor('myapp.local')).toBeChecked();
    expect(checkboxFor('api.local')).toBeChecked();
  });

  it('starts with the select-all checkbox checked', () => {
    renderExportModal();
    const [selectAll] = screen.getAllByRole('checkbox');
    expect(selectAll).toBeChecked();
  });
});

describe('ExportModal — selection', () => {
  it('deselects every mapping when select-all is unchecked', () => {
    renderExportModal();
    const [selectAll] = screen.getAllByRole('checkbox');
    fireEvent.click(selectAll);
    expect(checkboxFor('myapp.local')).not.toBeChecked();
    expect(checkboxFor('api.local')).not.toBeChecked();
    expect(selectAll).not.toBeChecked();
  });

  it('reselects every mapping when select-all is checked again', () => {
    renderExportModal();
    const [selectAll] = screen.getAllByRole('checkbox');
    fireEvent.click(selectAll);
    fireEvent.click(selectAll);
    expect(checkboxFor('myapp.local')).toBeChecked();
    expect(checkboxFor('api.local')).toBeChecked();
  });

  it('toggles a single mapping without affecting the others', () => {
    renderExportModal();
    fireEvent.click(checkboxFor('myapp.local'));
    expect(checkboxFor('myapp.local')).not.toBeChecked();
    expect(checkboxFor('api.local')).toBeChecked();
  });

  it('unchecks select-all once any single mapping is deselected', () => {
    renderExportModal();
    fireEvent.click(checkboxFor('myapp.local'));
    const [selectAll] = screen.getAllByRole('checkbox');
    expect(selectAll).not.toBeChecked();
  });
});

describe('ExportModal — submit button state', () => {
  it('is enabled while at least one mapping is selected', () => {
    renderExportModal();
    expect(screen.getByText('mappings.modals.export.buttons.submit').closest('button')).not.toBeDisabled();
  });

  it('is disabled once every mapping is deselected', () => {
    renderExportModal();
    const [selectAll] = screen.getAllByRole('checkbox');
    fireEvent.click(selectAll);
    expect(screen.getByText('mappings.modals.export.buttons.submit').closest('button')).toBeDisabled();
  });
});

describe('ExportModal — submit', () => {
  it('calls onSubmit with the ids of the selected mappings', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderExportModal({ onSubmit });
    fireEvent.click(screen.getByText('mappings.modals.export.buttons.submit').closest('button'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(['1', '2']);
  });

  it('calls onSubmit with only the ids that remain selected', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderExportModal({ onSubmit });
    fireEvent.click(checkboxFor('api.local'));
    fireEvent.click(screen.getByText('mappings.modals.export.buttons.submit').closest('button'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(['1']);
  });

  it('disables the submit button while the submission is in flight', async () => {
    let resolveSubmit;
    const onSubmit = vi.fn(() => new Promise((resolve) => { resolveSubmit = resolve; }));
    renderExportModal({ onSubmit });
    fireEvent.click(screen.getByText('mappings.modals.export.buttons.submit').closest('button'));
    await waitFor(() => expect(screen.getByText('mappings.modals.export.buttons.submit').closest('button')).toBeDisabled());
    resolveSubmit();
    await waitFor(() => expect(screen.getByText('mappings.modals.export.buttons.submit').closest('button')).not.toBeDisabled());
  });
});

describe('ExportModal — close', () => {
  it('calls onClose when the close (X) button is clicked', () => {
    const onClose = vi.fn();
    renderExportModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the cancel button is clicked', () => {
    const onClose = vi.fn();
    renderExportModal({ onClose });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
