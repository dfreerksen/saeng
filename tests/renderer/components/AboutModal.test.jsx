// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/renderer/components/Modal.jsx', () => ({
  default: ({ children }) => <div data-testid="modal-wrapper">{children}</div>,
}));

import AboutModal from '../../../src/renderer/components/AboutModal.jsx';

const t = (key) => key;

describe('AboutModal', () => {
  it('renders the app name in the about header via t()', () => {
    const { container } = render(<AboutModal version="1.2.3" onClose={() => {}} t={t} />);
    expect(container.querySelector('.about-name')).toHaveTextContent('application.name');
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

  it('renders the logo image with translated alt text', () => {
    render(<AboutModal version="1.0.0" onClose={() => {}} t={t} />);
    const img = screen.getByAltText('application.name');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'images/logo.svg');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<AboutModal version="1.0.0" onClose={onClose} t={t} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders the close button text via t(about.modals.buttons.close)', () => {
    render(<AboutModal version="1.0.0" onClose={() => {}} t={t} />);
    expect(screen.getByText('about.modals.buttons.close')).toBeInTheDocument();
  });

  it('renders the GitHub link', () => {
    render(<AboutModal version="1.0.0" onClose={() => {}} t={t} />);
    const link = screen.getByText('github.com/dfreerksen/saeng');
    expect(link).toHaveAttribute('href', 'https://github.com/dfreerksen/saeng');
  });

  it('renders the contributors section', () => {
    render(<AboutModal version="1.0.0" onClose={() => {}} t={t} />);
    expect(screen.getByText('about.contributors')).toBeInTheDocument();
    expect(screen.getByText('David Freerksen')).toBeInTheDocument();
  });

  it('renders tech logos with version alt text when versions are provided', () => {
    render(
      <AboutModal
        version="1.0.0"
        electronVersion="30.0.0"
        nodeVersion="20.0.0"
        reactVersion="19.0.0"
        bootstrapVersion="5.3.0"
        onClose={() => {}}
        t={t}
      />
    );
    expect(screen.getByAltText('Electron v30.0.0')).toHaveAttribute('src', 'images/tech/electron.svg');
    expect(screen.getByAltText('Node.js v20.0.0')).toHaveAttribute('src', 'images/tech/nodejs.svg');
    expect(screen.getByAltText('React v19.0.0')).toHaveAttribute('src', 'images/tech/react.svg');
    expect(screen.getByAltText('Bootstrap v5.3.0')).toHaveAttribute('src', 'images/tech/bootstrap.svg');
  });

  it('renders tech logos with plain names when versions are not provided', () => {
    render(<AboutModal version="1.0.0" onClose={() => {}} t={t} />);
    expect(screen.getByAltText('Electron')).toBeInTheDocument();
    expect(screen.getByAltText('Node.js')).toBeInTheDocument();
    expect(screen.getByAltText('React')).toBeInTheDocument();
    expect(screen.getByAltText('Bootstrap')).toBeInTheDocument();
  });
});
