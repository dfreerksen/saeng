// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import HealthChecksSection from '../../../../src/renderer/components/settings/HealthChecksSection.jsx';

const t = (key) => key;

const SAMPLE_SETTINGS = {
  healthCheckEnabled: true,
  healthCheckIntervalMs: 15000,
  healthCheckTimeoutMs: 2000,
};

function renderSection(props = {}) {
  const defaults = {
    settings: SAMPLE_SETTINGS,
    onSettingsChange: vi.fn().mockResolvedValue(undefined),
    showToast: vi.fn(),
    t,
  };
  return render(<HealthChecksSection {...defaults} {...props} />);
}

describe('HealthChecksSection — rendering', () => {
  it('renders the section title', () => {
    renderSection();
    expect(screen.getByText('settings.healthChecks.title')).toBeInTheDocument();
  });
});

describe('HealthChecksSection — enabled toggle', () => {
  it('unchecks the toggle when healthCheckEnabled is not set', () => {
    const { container } = renderSection({ settings: {} });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[0]).not.toBeChecked();
  });

  it('checks the toggle when healthCheckEnabled is true', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[0]).toBeChecked();
  });

  it('calls onSettingsChange when the toggle is changed', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: false } });
    fireEvent.click(container.querySelectorAll('.toggle input[type="checkbox"]')[0]);
    expect(onSettingsChange).toHaveBeenCalledWith({ healthCheckEnabled: true });
  });

  it('hides the interval and timeout inputs when disabled', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: false } });
    expect(container.querySelector('.health-check-interval-input')).not.toBeInTheDocument();
    expect(container.querySelector('.health-check-timeout-input')).not.toBeInTheDocument();
  });

  it('shows the interval and timeout inputs when enabled', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true } });
    expect(container.querySelector('.health-check-interval-input')).toBeInTheDocument();
    expect(container.querySelector('.health-check-timeout-input')).toBeInTheDocument();
  });
});

describe('HealthChecksSection — interval', () => {
  it('renders the interval in seconds, converted from milliseconds', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, healthCheckIntervalMs: 30000 } });
    expect(container.querySelector('.health-check-interval-input').value).toBe('30');
  });

  it('defaults to 15 seconds when healthCheckIntervalMs is not set', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, healthCheckIntervalMs: undefined } });
    expect(container.querySelector('.health-check-interval-input').value).toBe('15');
  });

  it('commits the value on blur, converting seconds to milliseconds', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange });
    const input = container.querySelector('.health-check-interval-input');
    fireEvent.change(input, { target: { value: '60' } });
    fireEvent.blur(input);
    expect(onSettingsChange).toHaveBeenCalledWith({ healthCheckIntervalMs: 60000 });
  });

  it('clamps values below the minimum to 5 seconds on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange });
    const input = container.querySelector('.health-check-interval-input');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.blur(input);
    expect(input.value).toBe('5');
    expect(onSettingsChange).toHaveBeenCalledWith({ healthCheckIntervalMs: 5000 });
  });

  it('clamps values above the maximum to 300 seconds on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange });
    const input = container.querySelector('.health-check-interval-input');
    fireEvent.change(input, { target: { value: '9999' } });
    fireEvent.blur(input);
    expect(input.value).toBe('300');
    expect(onSettingsChange).toHaveBeenCalledWith({ healthCheckIntervalMs: 300000 });
  });

  it('does not call onSettingsChange when the value is unchanged after clamping', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange });
    fireEvent.blur(container.querySelector('.health-check-interval-input'));
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it('shows a toast after committing a changed value', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSection({ onSettingsChange, showToast });
    const input = container.querySelector('.health-check-interval-input');
    fireEvent.change(input, { target: { value: '60' } });
    fireEvent.blur(input);
    expect(showToast).toHaveBeenCalledWith('flash.settings.updated', 'info');
  });
});

describe('HealthChecksSection — timeout', () => {
  it('renders the timeout in milliseconds', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, healthCheckTimeoutMs: 3000 } });
    expect(container.querySelector('.health-check-timeout-input').value).toBe('3000');
  });

  it('defaults to 2000ms when healthCheckTimeoutMs is not set', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, healthCheckTimeoutMs: undefined } });
    expect(container.querySelector('.health-check-timeout-input').value).toBe('2000');
  });

  it('commits the value on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange });
    const input = container.querySelector('.health-check-timeout-input');
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);
    expect(onSettingsChange).toHaveBeenCalledWith({ healthCheckTimeoutMs: 5000 });
  });

  it('clamps values below the minimum to 500ms on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange });
    const input = container.querySelector('.health-check-timeout-input');
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.blur(input);
    expect(input.value).toBe('500');
    expect(onSettingsChange).toHaveBeenCalledWith({ healthCheckTimeoutMs: 500 });
  });

  it('clamps values above the maximum to 30000ms on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange });
    const input = container.querySelector('.health-check-timeout-input');
    fireEvent.change(input, { target: { value: '999999' } });
    fireEvent.blur(input);
    expect(input.value).toBe('30000');
    expect(onSettingsChange).toHaveBeenCalledWith({ healthCheckTimeoutMs: 30000 });
  });

  it('shows a toast after committing a changed value', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSection({ onSettingsChange, showToast });
    const input = container.querySelector('.health-check-timeout-input');
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);
    expect(showToast).toHaveBeenCalledWith('flash.settings.updated', 'info');
  });
});
