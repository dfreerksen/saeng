// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/renderer/components/Tooltip.jsx', () => ({
  default: ({ children }) => children,
}));

import MockRegexHelpModal from '../../../src/renderer/components/MockRegexHelpModal.jsx';

const t = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
});

describe('MockRegexHelpModal', () => {
  it('renders the title and intro text', () => {
    render(<MockRegexHelpModal onClose={vi.fn()} showToast={vi.fn()} t={t} />);
    expect(screen.getByText('mocks.modals.regexHelp.title')).toBeInTheDocument();
    expect(screen.getByText('mocks.modals.regexHelp.intro')).toBeInTheDocument();
  });

  it('renders a row for each regex example with a code pattern and description', () => {
    const { container } = render(<MockRegexHelpModal onClose={vi.fn()} showToast={vi.fn()} t={t} />);
    const codeEls = container.querySelectorAll('tbody tr code');
    expect(codeEls.length).toBeGreaterThan(0);
    expect(screen.getByText('mocks.modals.regexHelp.examples.exact')).toBeInTheDocument();
    expect(screen.getByText('^/api/users$')).toBeInTheDocument();
  });

  it('copies the pattern to the clipboard and shows a toast when the copy button is clicked', () => {
    const showToast = vi.fn();
    const { container } = render(<MockRegexHelpModal onClose={vi.fn()} showToast={showToast} t={t} />);
    const firstCopyButton = container.querySelector('tbody tr .btn-copy');
    fireEvent.click(firstCopyButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('^/api/users$');
    expect(showToast).toHaveBeenCalledWith('flash.copied:{"url":"^/api/users$"}', 'success');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<MockRegexHelpModal onClose={onClose} showToast={vi.fn()} t={t} />);
    fireEvent.click(screen.getByText('about.modals.buttons.close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the header close button is clicked', () => {
    const onClose = vi.fn();
    render(<MockRegexHelpModal onClose={onClose} showToast={vi.fn()} t={t} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
