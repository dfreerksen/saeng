// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Modal from '../../../src/renderer/components/Modal.jsx';

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

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal onClose={onClose}><div>Content</div></Modal>);
    fireEvent.click(container.querySelector('.modal-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the modal overlay itself is clicked (not a child)', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal onClose={onClose}><div>Content</div></Modal>);
    const overlay = container.querySelector('.modal.fade.show');
    // Simulate click where target === currentTarget (clicking the overlay background)
    fireEvent.click(overlay, { target: overlay });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when inner content is clicked', () => {
    const onClose = vi.fn();
    render(<Modal onClose={onClose}><div>Inner content</div></Modal>);
    fireEvent.click(screen.getByText('Inner content'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
