// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import RequestLogsSection from '../../../../src/renderer/components/settings/RequestLogsSection.jsx';

const t = (key) => key;

const SAMPLE_SETTINGS = {
  loggingEnabled: true,
  logMaxEntries: 300,
  logHeadersEnabled: false,
  logBodyEnabled: false,
};

function renderSection(props = {}) {
  const defaults = {
    settings: SAMPLE_SETTINGS,
    onSettingsChange: vi.fn().mockResolvedValue(undefined),
    showToast: vi.fn(),
    t,
  };
  return render(<RequestLogsSection {...defaults} {...props} />);
}

describe('RequestLogsSection — rendering', () => {
  it('renders the section title', () => {
    renderSection();
    expect(screen.getByText('settings.requestLogs.title')).toBeInTheDocument();
  });
});

describe('RequestLogsSection — logging enabled', () => {
  it('checks the toggle when loggingEnabled is true', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, loggingEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[0]).toBeChecked();
  });

  it('unchecks the toggle when loggingEnabled is false', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, loggingEnabled: false } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[0]).not.toBeChecked();
  });

  it('calls onSettingsChange when the toggle is changed', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, loggingEnabled: true } });
    fireEvent.click(container.querySelectorAll('.toggle input[type="checkbox"]')[0]);
    expect(onSettingsChange).toHaveBeenCalledWith({ loggingEnabled: false });
  });

  it('hides the dependent settings when logging is disabled', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, loggingEnabled: false } });
    expect(container.querySelector('.log-max-entries-input')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.requestLogs.logHeaders.label')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.requestLogs.logBody.label')).not.toBeInTheDocument();
  });

  it('shows the dependent settings when logging is enabled', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, loggingEnabled: true } });
    expect(container.querySelector('.log-max-entries-input')).toBeInTheDocument();
    expect(screen.getByText('settings.requestLogs.logHeaders.label')).toBeInTheDocument();
    expect(screen.getByText('settings.requestLogs.logBody.label')).toBeInTheDocument();
  });
});

describe('RequestLogsSection — log max entries', () => {
  it('renders the input with the current value', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, logMaxEntries: 1500 } });
    expect(container.querySelector('.log-max-entries-input').value).toBe('1500');
  });

  it('defaults to 300 when logMaxEntries is not set', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, logMaxEntries: undefined } });
    expect(container.querySelector('.log-max-entries-input').value).toBe('300');
  });

  it('commits the value on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange });
    const input = container.querySelector('.log-max-entries-input');
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);
    expect(onSettingsChange).toHaveBeenCalledWith({ logMaxEntries: 5000 });
  });

  it('clamps values below the minimum to 100 on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange });
    const input = container.querySelector('.log-max-entries-input');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input);
    expect(input.value).toBe('100');
    expect(onSettingsChange).toHaveBeenCalledWith({ logMaxEntries: 100 });
  });

  it('clamps values above the maximum to 100000 on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange });
    const input = container.querySelector('.log-max-entries-input');
    fireEvent.change(input, { target: { value: '999999' } });
    fireEvent.blur(input);
    expect(input.value).toBe('100000');
    expect(onSettingsChange).toHaveBeenCalledWith({ logMaxEntries: 100000 });
  });

  it('falls back to the default when cleared on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, logMaxEntries: 5000 } });
    const input = container.querySelector('.log-max-entries-input');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('300');
    expect(onSettingsChange).toHaveBeenCalledWith({ logMaxEntries: 300 });
  });

  it('does not call onSettingsChange when the value is unchanged on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange });
    fireEvent.blur(container.querySelector('.log-max-entries-input'));
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it('shows a toast after committing a changed value', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSection({ onSettingsChange, showToast });
    const input = container.querySelector('.log-max-entries-input');
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);
    expect(showToast).toHaveBeenCalledWith('flash.settings.updated', 'info');
  });
});

describe('RequestLogsSection — log headers', () => {
  it('defaults to unchecked when logHeadersEnabled is not set', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, logHeadersEnabled: undefined } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[1]).not.toBeChecked();
  });

  it('checks the toggle when logHeadersEnabled is true', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, logHeadersEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[1]).toBeChecked();
  });

  it('calls onSettingsChange with logHeadersEnabled when toggled', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, logHeadersEnabled: false } });
    fireEvent.click(container.querySelectorAll('.toggle input[type="checkbox"]')[1]);
    expect(onSettingsChange).toHaveBeenCalledWith({ logHeadersEnabled: true });
  });
});

describe('RequestLogsSection — log body', () => {
  it('defaults to unchecked when logBodyEnabled is not set', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, logBodyEnabled: undefined } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[2]).not.toBeChecked();
  });

  it('checks the toggle when logBodyEnabled is true', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, logBodyEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[2]).toBeChecked();
  });

  it('calls onSettingsChange with logBodyEnabled when toggled', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, logBodyEnabled: false } });
    fireEvent.click(container.querySelectorAll('.toggle input[type="checkbox"]')[2]);
    expect(onSettingsChange).toHaveBeenCalledWith({ logBodyEnabled: true });
  });
});
