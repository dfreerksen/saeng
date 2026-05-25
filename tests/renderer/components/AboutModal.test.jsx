// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/renderer/components/Modal.jsx', () => ({
  default: ({ children }) => <div data-testid="modal-wrapper">{children}</div>,
}));

import AboutModal from '../../../src/renderer/components/AboutModal.jsx';

const t = (key) => key;

describe('AboutModal', () => {
  it('renders the Saeng name in the about header', () => {
    const { container } = render(<AboutModal version="1.2.3" onClose={() => {}} t={t} />);
    expect(container.querySelector('.about-name')).toHaveTextContent('Saeng');
  });

  it('shows the version with a v prefix', () => {
    const { container } = render(<AboutModal version="1.2.3" onClose={() => {}} t={t} />);
    expect(container.querySelector('.about-version')).toHaveTextContent('v1.2.3');
  });

  it('shows empty version text when version is not provided', () => {
    const { container } = render(<AboutModal version="" onClose={() => {}} t={t} />);
    expect(container.querySelector('.about-version')).toHaveTextContent('');
  });

  it('renders the about description via t()', () => {
    render(<AboutModal version="1.0.0" onClose={() => {}} t={t} />);
    expect(screen.getByText('about.desc')).toBeInTheDocument();
  });

  it('renders the logo image', () => {
    render(<AboutModal version="1.0.0" onClose={() => {}} t={t} />);
    const img = screen.getByAltText('Saeng');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'images/logo.svg');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<AboutModal version="1.0.0" onClose={onClose} t={t} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders the close button text via t(modal.close)', () => {
    render(<AboutModal version="1.0.0" onClose={() => {}} t={t} />);
    expect(screen.getByText('modal.close')).toBeInTheDocument();
  });
});
