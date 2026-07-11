// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/renderer/components/utilities/Tooltip.jsx', () => ({
  default: ({ children }) => children,
}));

import MockRegexHelpPane from '../../../../src/renderer/components/modals/MockRegexHelpPane.jsx';

const t = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
});

function renderPane(props = {}) {
  const defaults = { showToast: vi.fn(), t };
  return render(<MockRegexHelpPane {...defaults} {...props} />);
}

describe('MockRegexHelpPane — rendering', () => {
  it('renders the help title and intro', () => {
    renderPane();
    expect(screen.getByText('mocks.modals.manage.help.title')).toBeInTheDocument();
    expect(screen.getByText('mocks.modals.manage.help.intro')).toBeInTheDocument();
  });

  it('renders every regex example pattern', () => {
    renderPane();
    expect(screen.getByText('^/api/users$')).toBeInTheDocument();
    expect(screen.getByText('^/api/users/\\d+$')).toBeInTheDocument();
    expect(screen.getByText('^/api/users/[^/]+$')).toBeInTheDocument();
    expect(screen.getByText('^/api/users(/.*)?$')).toBeInTheDocument();
    expect(screen.getByText('\\.json$')).toBeInTheDocument();
    expect(screen.getByText('^/(users|accounts)$')).toBeInTheDocument();
    expect(screen.getByText('.*')).toBeInTheDocument();
  });

  it('renders a description for each example', () => {
    renderPane();
    expect(screen.getByText('mocks.modals.manage.help.examples.exact')).toBeInTheDocument();
    expect(screen.getByText('mocks.modals.manage.help.examples.numericId')).toBeInTheDocument();
    expect(screen.getByText('mocks.modals.manage.help.examples.uuid')).toBeInTheDocument();
  });

  it('renders one copy button per example', () => {
    const { container } = renderPane();
    expect(container.querySelectorAll('.btn-copy')).toHaveLength(8);
  });
});

describe('MockRegexHelpPane — copy to clipboard', () => {
  it('copies the clicked pattern to the clipboard', () => {
    const { container } = renderPane();
    fireEvent.click(container.querySelectorAll('.btn-copy')[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('^/api/users$');
  });

  it('copies a different row\'s pattern when that row is clicked', () => {
    const { container } = renderPane();
    fireEvent.click(container.querySelectorAll('.btn-copy')[1]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('^/api/users/\\d+$');
  });

  it('shows a toast with the copied pattern', () => {
    const showToast = vi.fn();
    const { container } = renderPane({ showToast });
    fireEvent.click(container.querySelectorAll('.btn-copy')[0]);
    expect(showToast).toHaveBeenCalledWith('flash.copied:{"url":"^/api/users$"}', 'success');
  });
});
