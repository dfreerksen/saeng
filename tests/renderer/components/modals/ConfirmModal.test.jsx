// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../src/renderer/components/modals/Modal.jsx', () => ({
  default: ({ children }) => <div data-testid="modal-wrapper">{children}</div>,
}));

import ConfirmModal from '../../../../src/renderer/components/modals/ConfirmModal.jsx';

function renderConfirmModal(props = {}) {
  const defaults = {
    title: 'Are you sure?',
    message: 'Remove myapp.local?',
    confirmLabel: 'Remove',
    cancelLabel: 'Cancel',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };
  return render(<ConfirmModal {...defaults} {...props} />);
}

describe('ConfirmModal — rendering', () => {
  it('renders the title', () => {
    renderConfirmModal();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders the message', () => {
    renderConfirmModal();
    expect(screen.getByText('Remove myapp.local?')).toBeInTheDocument();
  });

  it('renders the cancel and confirm button labels', () => {
    renderConfirmModal();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Remove')).toBeInTheDocument();
  });

  it('defaults the confirm button to the danger variant', () => {
    const { container } = renderConfirmModal();
    expect(container.querySelector('.btn-confirm')).toHaveClass('btn-danger');
  });

  it('uses a custom confirmVariant when provided', () => {
    const { container } = renderConfirmModal({ confirmVariant: 'warning' });
    expect(container.querySelector('.btn-confirm')).toHaveClass('btn-warning');
    expect(container.querySelector('.btn-confirm')).not.toHaveClass('btn-danger');
  });
});

describe('ConfirmModal — actions', () => {
  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    const { container } = renderConfirmModal({ onConfirm });
    fireEvent.click(container.querySelector('.btn-confirm'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onClose when the cancel button is clicked', () => {
    const onClose = vi.fn();
    const { container } = renderConfirmModal({ onClose });
    fireEvent.click(container.querySelector('.btn-cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the header close (×) button is clicked', () => {
    const onClose = vi.fn();
    renderConfirmModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onConfirm when cancel is clicked', () => {
    const onConfirm = vi.fn();
    const { container } = renderConfirmModal({ onConfirm });
    fireEvent.click(container.querySelector('.btn-cancel'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
