// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showToast } from '../../../src/renderer/js/toast.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="toast"></div>';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('showToast()', () => {
  it('appends a child element to the #toast container', () => {
    showToast('Hello', 'info');
    expect(document.getElementById('toast').children).toHaveLength(1);
  });

  it('applies the correct Bootstrap alert class for each type', () => {
    for (const type of ['success', 'error', 'info']) {
      document.body.innerHTML = '<div id="toast"></div>';
      showToast('msg', type);
      const el = document.getElementById('toast').firstElementChild;
      expect(el.className).toContain(`alert-${type}`);
    }
  });

  it('includes the message text in the element', () => {
    showToast('Something went wrong', 'error');
    expect(document.getElementById('toast').innerHTML).toContain('Something went wrong');
  });

  it('defaults to type "info" when no type argument is provided', () => {
    showToast('Default type');
    const el = document.getElementById('toast').firstElementChild;
    expect(el.className).toContain('alert-info');
  });

  it('removes the element after the specified duration', () => {
    showToast('Temp', 'info', 1000);
    expect(document.getElementById('toast').children).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(document.getElementById('toast').children).toHaveLength(0);
  });

  it('does not remove the element before the duration has elapsed', () => {
    showToast('Temp', 'info', 2000);
    vi.advanceTimersByTime(1999);
    expect(document.getElementById('toast').children).toHaveLength(1);
  });

  it('stacks multiple toasts in the container', () => {
    showToast('First', 'info', 5000);
    showToast('Second', 'success', 5000);
    expect(document.getElementById('toast').children).toHaveLength(2);
  });

  it('each toast is removed independently on its own timer', () => {
    showToast('Short', 'info', 500);
    showToast('Long', 'success', 3000);
    vi.advanceTimersByTime(500);
    expect(document.getElementById('toast').children).toHaveLength(1);
    vi.advanceTimersByTime(2500);
    expect(document.getElementById('toast').children).toHaveLength(0);
  });
});
