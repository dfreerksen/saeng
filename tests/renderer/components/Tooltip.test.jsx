// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bootstrap', () => ({
  Tooltip: vi.fn(function BsTooltipMock() {
    this.hide = vi.fn();
    this.dispose = vi.fn();
  }),
}));

import { Tooltip as BsTooltip } from 'bootstrap';
import Tooltip from '../../../src/renderer/components/Tooltip.jsx';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.mocked(BsTooltip).mockClear();
  });

  it('renders the child element', () => {
    render(<Tooltip title="Hint"><button>Click me</button></Tooltip>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('creates a Bootstrap Tooltip on mount when title is provided', () => {
    render(<Tooltip title="My hint"><button>Hover</button></Tooltip>);
    expect(BsTooltip).toHaveBeenCalledOnce();
    expect(BsTooltip).toHaveBeenCalledWith(
      expect.any(Element),
      expect.objectContaining({ title: 'My hint', trigger: 'hover focus' })
    );
  });

  it('does not create a Bootstrap Tooltip when title is empty', () => {
    render(<Tooltip title=""><button>No tip</button></Tooltip>);
    expect(BsTooltip).not.toHaveBeenCalled();
  });

  it('does not create a Bootstrap Tooltip when title is falsy', () => {
    render(<Tooltip title={null}><button>No tip</button></Tooltip>);
    expect(BsTooltip).not.toHaveBeenCalled();
  });

  it('hides the tooltip when the child is clicked', () => {
    render(<Tooltip title="Hint"><button>Click</button></Tooltip>);
    const instance = vi.mocked(BsTooltip).mock.instances[0];
    fireEvent.click(screen.getByText('Click'));
    expect(instance.hide).toHaveBeenCalled();
  });

  it('hides and disposes the tooltip on unmount', () => {
    const { unmount } = render(<Tooltip title="Hint"><button>Btn</button></Tooltip>);
    const instance = vi.mocked(BsTooltip).mock.instances[0];
    unmount();
    expect(instance.hide).toHaveBeenCalled();
    expect(instance.dispose).toHaveBeenCalled();
  });
});
