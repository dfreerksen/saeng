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
import Tooltip from '../../../../src/renderer/components/utilities/Tooltip.jsx';

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

  it('blurs the child when clicked, instead of forcing the tooltip closed', () => {
    render(<Tooltip title="Hint"><button>Click</button></Tooltip>);
    const instance = vi.mocked(BsTooltip).mock.instances[0];
    const button = screen.getByText('Click');
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(document.activeElement).not.toBe(button);
    expect(instance.hide).not.toHaveBeenCalled();
  });

  it('disposes the tooltip on unmount without calling hide() first', () => {
    // dispose() alone tears down the tip element/listeners regardless of
    // shown state. Calling hide() first would queue a post-transition
    // callback that later runs against an already-disposed (nulled-out)
    // instance and throws - see the About-modal rapid-toggle crash.
    const { unmount } = render(<Tooltip title="Hint"><button>Btn</button></Tooltip>);
    const instance = vi.mocked(BsTooltip).mock.instances[0];
    unmount();
    expect(instance.hide).not.toHaveBeenCalled();
    expect(instance.dispose).toHaveBeenCalled();
  });
});
