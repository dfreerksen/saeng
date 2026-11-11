// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoadingScreen from '../../../../src/renderer/components/layout/LoadingScreen.jsx';
import { I18nContext } from '../../../../src/renderer/js/i18nContext.js';

describe('LoadingScreen', () => {
  it('renders a spinner with a translated accessible label', () => {
    const t = vi.fn((key) => `[${key}]`);
    render(
      <I18nContext value={t}>
        <LoadingScreen />
      </I18nContext>
    );
    expect(screen.getByRole('status')).toHaveTextContent('[common.loading]');
  });

  it('adds the exit class only while fading out', () => {
    const { container, rerender } = render(<LoadingScreen fadingOut={false} />);
    const el = container.querySelector('.app-loading');
    expect(el).not.toHaveClass('app-loading-exit');
    rerender(<LoadingScreen fadingOut />);
    expect(el).toHaveClass('app-loading-exit');
  });

  it('calls onExited when its own opacity transition ends', () => {
    const onExited = vi.fn();
    const { container } = render(<LoadingScreen fadingOut onExited={onExited} />);
    const el = container.querySelector('.app-loading');
    fireEvent.transitionEnd(el, { propertyName: 'transform' });
    expect(onExited).not.toHaveBeenCalled();
    fireEvent.transitionEnd(el, { propertyName: 'opacity' });
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it('ignores opacity transitions bubbling up from children', () => {
    const onExited = vi.fn();
    const { container } = render(<LoadingScreen fadingOut onExited={onExited} />);
    fireEvent.transitionEnd(container.querySelector('.app-loading-logo'), { propertyName: 'opacity' });
    expect(onExited).not.toHaveBeenCalled();
  });
});
