// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Modal from '../../../../src/renderer/components/modals/Modal.jsx';

afterEach(() => {
  document.body.classList.remove('modal-open');
});

describe('Modal', () => {
  it('adds modal-open class to document.body on mount', () => {
    render(<Modal onClose={() => {}}><div>Content</div></Modal>);
    expect(document.body).toHaveClass('modal-open');
  });

  it('removes modal-open class from document.body on unmount', () => {
    const { unmount } = render(<Modal onClose={() => {}}><div>Content</div></Modal>);
    unmount();
    expect(document.body).not.toHaveClass('modal-open');
  });

  it('renders children', () => {
    render(<Modal onClose={() => {}}><div>My modal content</div></Modal>);
    expect(screen.getByText('My modal content')).toBeInTheDocument();
  });

  it('renders the modal overlay with show class', () => {
    const { container } = render(<Modal onClose={() => {}}><div>X</div></Modal>);
    expect(container.querySelector('.modal.fade.show')).toBeInTheDocument();
  });

  it('renders the backdrop', () => {
    const { container } = render(<Modal onClose={() => {}}><div>X</div></Modal>);
    expect(container.querySelector('.modal-backdrop.fade.show')).toBeInTheDocument();
  });

  it('calls onClose when the overlay is pressed and released on itself (not a child)', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal onClose={onClose}><div>Content</div></Modal>);
    const overlay = container.querySelector('.modal.fade.show');
    // Simulate a normal click: mousedown and click both target the overlay background.
    fireEvent.mouseDown(overlay, { target: overlay });
    fireEvent.click(overlay, { target: overlay });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when inner content is clicked', () => {
    const onClose = vi.fn();
    render(<Modal onClose={onClose}><div>Inner content</div></Modal>);
    fireEvent.mouseDown(screen.getByText('Inner content'));
    fireEvent.click(screen.getByText('Inner content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not call onClose when mousedown starts on inner content but is released on the overlay (drag-out selection)', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal onClose={onClose}><div>Inner content</div></Modal>);
    const overlay = container.querySelector('.modal.fade.show');
    fireEvent.mouseDown(screen.getByText('Inner content'));
    fireEvent.click(overlay, { target: overlay });
    expect(onClose).not.toHaveBeenCalled();
  });
});
