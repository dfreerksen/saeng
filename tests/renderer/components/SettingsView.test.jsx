// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/renderer/components/utilities/Tooltip.jsx', () => ({
  default: ({ children }) => children,
}));

vi.mock('../../../src/renderer/js/os.js', () => ({
  getOS: vi.fn().mockReturnValue('mac'),
}));

import { getOS } from '../../../src/renderer/js/os.js';
import SettingsView from '../../../src/renderer/components/SettingsView.jsx';

const t = (key) => key;

const SAMPLE_LOCALES = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'fr', name: 'Français', dir: 'ltr' },
];

const SAMPLE_SETTINGS = {
  colorMode: 'auto',
  locale: 'en',
  httpsEnabled: true,
  startOnLaunch: false,
  loggingEnabled: true,
};

function renderSettingsView(props = {}) {
  const defaults = {
    settings: SAMPLE_SETTINGS,
    locales: SAMPLE_LOCALES,
    caPath: '/path/to/ca.crt',
    caExpiry: null,
    setCaExpiry: vi.fn(),
    onSettingsChange: vi.fn().mockResolvedValue(undefined),
    onLocaleChange: vi.fn(),
    onColorModeChange: vi.fn(),
    showToast: vi.fn(),
    t,
  };
  return render(<SettingsView {...defaults} {...props} />);
}

beforeEach(() => {
  vi.mocked(getOS).mockReturnValue('mac');
  window.electronAPI = {
    ssl: {
      revealCA: vi.fn(),
      trustCA: vi.fn().mockResolvedValue({ success: true }),
      regenerateCA: vi.fn().mockResolvedValue(new Date(Date.now() + 365 * 86400000).toISOString()),
      deleteCA: vi.fn().mockResolvedValue({}),
    },
  };
});

describe('SettingsView — rendering', () => {
  it('renders the settings title', () => {
    renderSettingsView();
    expect(screen.getByText('settings.title')).toBeInTheDocument();
  });

  it('always has the active class (visibility controlled by parent)', () => {
    const { container } = renderSettingsView();
    expect(container.querySelector('#view-settings')).toHaveClass('active');
  });

  it('displays the CA path', () => {
    renderSettingsView({ caPath: '/Users/me/ca.crt' });
    expect(screen.getByText('/Users/me/ca.crt')).toBeInTheDocument();
  });

  it('shows generating placeholder when CA path is empty', () => {
    renderSettingsView({ caPath: '' });
    expect(screen.getByText('settings.cert.actions.generating')).toBeInTheDocument();
  });
});

describe('SettingsView — color mode', () => {
  it('renders color mode select with the current value', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, colorMode: 'dark' } });
    const select = container.querySelector('.color-mode-select');
    expect(select.value).toBe('dark');
  });

  it('calls onColorModeChange when color mode is changed', () => {
    const onColorModeChange = vi.fn();
    const { container } = renderSettingsView({ onColorModeChange });
    const select = container.querySelector('.color-mode-select');
    fireEvent.change(select, { target: { value: 'light' } });
    expect(onColorModeChange).toHaveBeenCalledWith('light');
  });

  it('defaults to auto when colorMode is not set', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, colorMode: undefined } });
    const select = container.querySelector('.color-mode-select');
    expect(select.value).toBe('auto');
  });
});

describe('SettingsView — locale', () => {
  it('renders locale select with the current locale', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, locale: 'fr' } });
    const select = container.querySelector('.locale-select');
    expect(select.value).toBe('fr');
  });

  it('renders all available locales as options', () => {
    const { container } = renderSettingsView();
    const options = container.querySelectorAll('.locale-select option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('English');
    expect(options[1]).toHaveTextContent('Français');
  });

  it('calls onLocaleChange when locale is changed', () => {
    const onLocaleChange = vi.fn();
    const { container } = renderSettingsView({ onLocaleChange });
    const select = container.querySelector('.locale-select');
    fireEvent.change(select, { target: { value: 'fr' } });
    expect(onLocaleChange).toHaveBeenCalledWith('fr');
  });
});

describe('SettingsView — icon mode', () => {
  it('renders icon mode select with the current value', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, iconMode: 'tray' } });
    const select = container.querySelector('.icon-mode-select');
    expect(select.value).toBe('tray');
  });

  it('defaults to both when iconMode is not set', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, iconMode: undefined } });
    const select = container.querySelector('.icon-mode-select');
    expect(select.value).toBe('both');
  });

  it('calls onSettingsChange when icon mode is changed', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange });
    const select = container.querySelector('.icon-mode-select');
    fireEvent.change(select, { target: { value: 'dock' } });
    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({ iconMode: 'dock' });
    });
  });

  it('shows a toast after changing icon mode', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSettingsView({ onSettingsChange, showToast });
    const select = container.querySelector('.icon-mode-select');
    fireEvent.change(select, { target: { value: 'tray' } });
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('flash.settings.updated', 'info');
    });
  });

  it('renders three options with OS-specific labels', () => {
    const { container } = renderSettingsView();
    const options = container.querySelectorAll('.icon-mode-select option');
    expect(options).toHaveLength(3);
    expect(options[0].value).toBe('both');
    expect(options[1].value).toBe('tray');
    expect(options[2].value).toBe('dock');
  });
});

describe('SettingsView — dashboard toggle', () => {
  it('renders the dashboard toggle as checked when dashboardEnabled is not set', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[0]).toBeChecked();
  });

  it('renders the dashboard toggle as checked when dashboardEnabled is true', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, dashboardEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[0]).toBeChecked();
  });

  it('renders the dashboard toggle as unchecked when dashboardEnabled is false', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, dashboardEnabled: false } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[0]).not.toBeChecked();
  });

  it('calls onSettingsChange with dashboardEnabled when toggled off', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange });
    const toggle = container.querySelectorAll('.toggle input[type="checkbox"]')[0];
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({ dashboardEnabled: false });
    });
  });

  it('shows a toast after toggling dashboard', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSettingsView({ onSettingsChange, showToast });
    const toggle = container.querySelectorAll('.toggle input[type="checkbox"]')[0];
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('flash.dashboard.disabled', 'info');
    });
  });
});

describe('SettingsView — proxy toggles', () => {
  it('renders httpsEnabled checkbox as checked when setting is true', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, httpsEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[1]).toBeChecked();
  });

  it('renders httpsEnabled checkbox as unchecked when setting is false', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, httpsEnabled: false } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[1]).not.toBeChecked();
  });

  it('calls onSettingsChange with httpsEnabled when toggled', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange });
    const httpsToggle = container.querySelectorAll('.toggle input[type="checkbox"]')[1];
    fireEvent.click(httpsToggle);
    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({ httpsEnabled: false });
    });
  });

  it('shows a toast after toggling httpsEnabled', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSettingsView({ onSettingsChange, showToast });
    const httpsToggle = container.querySelectorAll('.toggle input[type="checkbox"]')[1];
    fireEvent.click(httpsToggle);
    await waitFor(() => {
      expect(showToast).toHaveBeenCalled();
    });
  });

  it('renders startOnLaunch checkbox reflecting the setting', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, startOnLaunch: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[2]).toBeChecked();
  });

  it('calls onSettingsChange with startOnLaunch when toggled', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange });
    const startToggle = container.querySelectorAll('.toggle input[type="checkbox"]')[2];
    fireEvent.click(startToggle);
    expect(onSettingsChange).toHaveBeenCalledWith({ startOnLaunch: true });
  });

  it('shows a toast after toggling startOnLaunch', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSettingsView({ onSettingsChange, showToast });
    const startToggle = container.querySelectorAll('.toggle input[type="checkbox"]')[2];
    fireEvent.click(startToggle);
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('flash.settings.updated', 'info');
    });
  });
});

describe('SettingsView — logging enabled', () => {
  it('checks the toggle when loggingEnabled is true', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, loggingEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[3]).toBeChecked();
  });

  it('unchecks the toggle when loggingEnabled is false', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, loggingEnabled: false } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[3]).not.toBeChecked();
  });

  it('calls onSettingsChange when the toggle is changed', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, loggingEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    fireEvent.click(toggles[3]);
    expect(onSettingsChange).toHaveBeenCalledWith({ loggingEnabled: false });
  });

  it('hides the log max entries setting when logging is disabled', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, loggingEnabled: false } });
    expect(container.querySelector('.log-max-entries-input')).not.toBeInTheDocument();
  });

  it('shows the log max entries setting when logging is enabled', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, loggingEnabled: true } });
    expect(container.querySelector('.log-max-entries-input')).toBeInTheDocument();
  });
});

describe('SettingsView — log max entries', () => {
  it('renders the input with the current value', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, logMaxEntries: 1500 } });
    expect(container.querySelector('.log-max-entries-input').value).toBe('1500');
  });

  it('defaults to 300 when logMaxEntries is not set', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, logMaxEntries: undefined } });
    expect(container.querySelector('.log-max-entries-input').value).toBe('300');
  });

  it('commits the value on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, logMaxEntries: 300 } });
    const input = container.querySelector('.log-max-entries-input');
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);
    expect(onSettingsChange).toHaveBeenCalledWith({ logMaxEntries: 5000 });
  });

  it('shows a toast after committing a changed value', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSettingsView({ onSettingsChange, showToast, settings: { ...SAMPLE_SETTINGS, logMaxEntries: 300 } });
    const input = container.querySelector('.log-max-entries-input');
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);
    expect(showToast).toHaveBeenCalledWith('flash.settings.updated', 'info');
  });

  it('does not show a toast when the value is unchanged on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSettingsView({ onSettingsChange, showToast, settings: { ...SAMPLE_SETTINGS, logMaxEntries: 300 } });
    const input = container.querySelector('.log-max-entries-input');
    fireEvent.blur(input);
    expect(onSettingsChange).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('clamps values below the minimum to 100 on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, logMaxEntries: 300 } });
    const input = container.querySelector('.log-max-entries-input');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input);
    expect(input.value).toBe('100');
    expect(onSettingsChange).toHaveBeenCalledWith({ logMaxEntries: 100 });
  });

  it('clamps values above the maximum to 100000 on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, logMaxEntries: 300 } });
    const input = container.querySelector('.log-max-entries-input');
    fireEvent.change(input, { target: { value: '999999' } });
    fireEvent.blur(input);
    expect(input.value).toBe('100000');
    expect(onSettingsChange).toHaveBeenCalledWith({ logMaxEntries: 100000 });
  });

  it('falls back to the default value when the input is cleared on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, logMaxEntries: 5000 } });
    const input = container.querySelector('.log-max-entries-input');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('300');
    expect(onSettingsChange).toHaveBeenCalledWith({ logMaxEntries: 300 });
  });

  it('does not call onSettingsChange when the value is unchanged after clamping', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, logMaxEntries: 300 } });
    const input = container.querySelector('.log-max-entries-input');
    fireEvent.blur(input);
    expect(onSettingsChange).not.toHaveBeenCalled();
  });
});

describe('SettingsView — log headers / body', () => {
  it('does not render the log headers/body toggles when logging is disabled', () => {
    renderSettingsView({ settings: { ...SAMPLE_SETTINGS, loggingEnabled: false } });
    expect(screen.queryByText('settings.requestLogs.logHeaders.label')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.requestLogs.logBody.label')).not.toBeInTheDocument();
  });

  it('defaults the log headers toggle to unchecked', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, logHeadersEnabled: undefined } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[4]).not.toBeChecked();
  });

  it('checks the log headers toggle when logHeadersEnabled is true', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, logHeadersEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[4]).toBeChecked();
  });

  it('calls onSettingsChange with logHeadersEnabled when the headers toggle is changed', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, logHeadersEnabled: false } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    fireEvent.click(toggles[4]);
    expect(onSettingsChange).toHaveBeenCalledWith({ logHeadersEnabled: true });
  });

  it('defaults the log body toggle to unchecked', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, logBodyEnabled: undefined } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[5]).not.toBeChecked();
  });

  it('checks the log body toggle when logBodyEnabled is true', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, logBodyEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[5]).toBeChecked();
  });

  it('calls onSettingsChange with logBodyEnabled when the body toggle is changed', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, logBodyEnabled: false } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    fireEvent.click(toggles[5]);
    expect(onSettingsChange).toHaveBeenCalledWith({ logBodyEnabled: true });
  });
});

describe('SettingsView — health check enabled', () => {
  it('unchecks the toggle when healthCheckEnabled is not set', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[6]).not.toBeChecked();
  });

  it('checks the toggle when healthCheckEnabled is true', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[6]).toBeChecked();
  });

  it('calls onSettingsChange when the toggle is changed', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: false } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    fireEvent.click(toggles[6]);
    expect(onSettingsChange).toHaveBeenCalledWith({ healthCheckEnabled: true });
  });

  it('hides the interval and timeout inputs when disabled', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: false } });
    expect(container.querySelector('.health-check-interval-input')).not.toBeInTheDocument();
    expect(container.querySelector('.health-check-timeout-input')).not.toBeInTheDocument();
  });

  it('shows the interval and timeout inputs when enabled', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true } });
    expect(container.querySelector('.health-check-interval-input')).toBeInTheDocument();
    expect(container.querySelector('.health-check-timeout-input')).toBeInTheDocument();
  });
});

describe('SettingsView — health check interval', () => {
  it('renders the interval in seconds, converted from milliseconds', () => {
    const { container } = renderSettingsView({
      settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true, healthCheckIntervalMs: 30000 },
    });
    expect(container.querySelector('.health-check-interval-input').value).toBe('30');
  });

  it('defaults to 15 seconds when healthCheckIntervalMs is not set', () => {
    const { container } = renderSettingsView({
      settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true, healthCheckIntervalMs: undefined },
    });
    expect(container.querySelector('.health-check-interval-input').value).toBe('15');
  });

  it('commits the value on blur, converting seconds to milliseconds', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({
      onSettingsChange,
      settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true, healthCheckIntervalMs: 15000 },
    });
    const input = container.querySelector('.health-check-interval-input');
    fireEvent.change(input, { target: { value: '60' } });
    fireEvent.blur(input);
    expect(onSettingsChange).toHaveBeenCalledWith({ healthCheckIntervalMs: 60000 });
  });

  it('clamps values below the minimum to 5 seconds on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({
      onSettingsChange,
      settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true, healthCheckIntervalMs: 15000 },
    });
    const input = container.querySelector('.health-check-interval-input');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.blur(input);
    expect(input.value).toBe('5');
    expect(onSettingsChange).toHaveBeenCalledWith({ healthCheckIntervalMs: 5000 });
  });

  it('clamps values above the maximum to 300 seconds on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({
      onSettingsChange,
      settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true, healthCheckIntervalMs: 15000 },
    });
    const input = container.querySelector('.health-check-interval-input');
    fireEvent.change(input, { target: { value: '9999' } });
    fireEvent.blur(input);
    expect(input.value).toBe('300');
    expect(onSettingsChange).toHaveBeenCalledWith({ healthCheckIntervalMs: 300000 });
  });

  it('does not call onSettingsChange when the value is unchanged after clamping', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({
      onSettingsChange,
      settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true, healthCheckIntervalMs: 15000 },
    });
    const input = container.querySelector('.health-check-interval-input');
    fireEvent.blur(input);
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it('shows a toast after committing a changed value', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSettingsView({
      onSettingsChange,
      showToast,
      settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true, healthCheckIntervalMs: 15000 },
    });
    const input = container.querySelector('.health-check-interval-input');
    fireEvent.change(input, { target: { value: '60' } });
    fireEvent.blur(input);
    expect(showToast).toHaveBeenCalledWith('flash.settings.updated', 'info');
  });
});

describe('SettingsView — health check timeout', () => {
  it('renders the timeout in milliseconds', () => {
    const { container } = renderSettingsView({
      settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true, healthCheckTimeoutMs: 3000 },
    });
    expect(container.querySelector('.health-check-timeout-input').value).toBe('3000');
  });

  it('defaults to 2000ms when healthCheckTimeoutMs is not set', () => {
    const { container } = renderSettingsView({
      settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true, healthCheckTimeoutMs: undefined },
    });
    expect(container.querySelector('.health-check-timeout-input').value).toBe('2000');
  });

  it('commits the value on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({
      onSettingsChange,
      settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true, healthCheckTimeoutMs: 2000 },
    });
    const input = container.querySelector('.health-check-timeout-input');
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);
    expect(onSettingsChange).toHaveBeenCalledWith({ healthCheckTimeoutMs: 5000 });
  });

  it('clamps values below the minimum to 500ms on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({
      onSettingsChange,
      settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true, healthCheckTimeoutMs: 2000 },
    });
    const input = container.querySelector('.health-check-timeout-input');
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.blur(input);
    expect(input.value).toBe('500');
    expect(onSettingsChange).toHaveBeenCalledWith({ healthCheckTimeoutMs: 500 });
  });

  it('clamps values above the maximum to 30000ms on blur', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({
      onSettingsChange,
      settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true, healthCheckTimeoutMs: 2000 },
    });
    const input = container.querySelector('.health-check-timeout-input');
    fireEvent.change(input, { target: { value: '999999' } });
    fireEvent.blur(input);
    expect(input.value).toBe('30000');
    expect(onSettingsChange).toHaveBeenCalledWith({ healthCheckTimeoutMs: 30000 });
  });

  it('shows a toast after committing a changed value', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSettingsView({
      onSettingsChange,
      showToast,
      settings: { ...SAMPLE_SETTINGS, healthCheckEnabled: true, healthCheckTimeoutMs: 2000 },
    });
    const input = container.querySelector('.health-check-timeout-input');
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);
    expect(showToast).toHaveBeenCalledWith('flash.settings.updated', 'info');
  });
});

describe('SettingsView — CA management', () => {
  it('calls electronAPI.ssl.revealCA when reveal button is clicked', () => {
    renderSettingsView();
    const revealBtn = screen.getByText('settings.cert.actions.show.mac').closest('button');
    fireEvent.click(revealBtn);
    expect(window.electronAPI.ssl.revealCA).toHaveBeenCalledOnce();
  });

  it('calls electronAPI.ssl.trustCA when trust button is clicked', async () => {
    renderSettingsView();
    const trustBtn = screen.getByText('settings.cert.actions.install').closest('button');
    fireEvent.click(trustBtn);
    await waitFor(() => {
      expect(window.electronAPI.ssl.trustCA).toHaveBeenCalledOnce();
    });
  });

  it('shows success toast after trusting CA', async () => {
    const showToast = vi.fn();
    renderSettingsView({ showToast });
    fireEvent.click(screen.getByText('settings.cert.actions.install').closest('button'));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('flash.ca.trusted', 'success', 5000);
    });
  });

  it('shows error toast when trust CA fails', async () => {
    window.electronAPI.ssl.trustCA.mockResolvedValue({ success: false, message: 'Denied' });
    const showToast = vi.fn();
    renderSettingsView({ showToast });
    fireEvent.click(screen.getByText('settings.cert.actions.install').closest('button'));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Denied', 'error', 6000);
    });
  });

  it('calls electronAPI.ssl.regenerateCA when the confirm button is clicked', async () => {
    const { container } = renderSettingsView();
    fireEvent.click(screen.getByText('settings.cert.actions.regenerate').closest('button'));
    fireEvent.click(container.querySelector('.btn-confirm'));
    await waitFor(() => {
      expect(window.electronAPI.ssl.regenerateCA).toHaveBeenCalledOnce();
    });
  });

  it('does not call regenerateCA when the cancel button is clicked', () => {
    const { container } = renderSettingsView();
    fireEvent.click(screen.getByText('settings.cert.actions.regenerate').closest('button'));
    fireEvent.click(container.querySelector('.btn-cancel'));
    expect(window.electronAPI.ssl.regenerateCA).not.toHaveBeenCalled();
  });

  it('calls setCaExpiry with the new expiry after regeneration', async () => {
    const newExpiry = new Date(Date.now() + 365 * 86400000).toISOString();
    window.electronAPI.ssl.regenerateCA.mockResolvedValue(newExpiry);
    const setCaExpiry = vi.fn();
    const { container } = renderSettingsView({ setCaExpiry });
    fireEvent.click(screen.getByText('settings.cert.actions.regenerate').closest('button'));
    fireEvent.click(container.querySelector('.btn-confirm'));
    await waitFor(() => {
      expect(setCaExpiry).toHaveBeenCalledWith(newExpiry);
    });
  });

  it('calls electronAPI.ssl.deleteCA when the confirm button is clicked', async () => {
    const { container } = renderSettingsView();
    fireEvent.click(screen.getByText('settings.cert.actions.delete').closest('button'));
    fireEvent.click(container.querySelector('.btn-confirm'));
    await waitFor(() => {
      expect(window.electronAPI.ssl.deleteCA).toHaveBeenCalledOnce();
    });
  });

  it('does not call deleteCA when the cancel button is clicked', () => {
    const { container } = renderSettingsView();
    fireEvent.click(screen.getByText('settings.cert.actions.delete').closest('button'));
    fireEvent.click(container.querySelector('.btn-cancel'));
    expect(window.electronAPI.ssl.deleteCA).not.toHaveBeenCalled();
  });

  it('calls setCaExpiry(null) after deleting CA', async () => {
    const setCaExpiry = vi.fn();
    const { container } = renderSettingsView({ setCaExpiry });
    fireEvent.click(screen.getByText('settings.cert.actions.delete').closest('button'));
    fireEvent.click(container.querySelector('.btn-confirm'));
    await waitFor(() => {
      expect(setCaExpiry).toHaveBeenCalledWith(null);
    });
  });
});

describe('SettingsView — CA expiry', () => {
  it('shows expiry info when caExpiry is set', () => {
    const expiry = new Date(Date.now() + 400 * 86400000).toISOString();
    const { container } = renderSettingsView({ caExpiry: expiry });
    expect(container.querySelector('.ca-expiry')).toBeInTheDocument();
  });

  it('does not show expiry info when caExpiry is null', () => {
    const { container } = renderSettingsView({ caExpiry: null });
    expect(container.querySelector('.ca-expiry')).not.toBeInTheDocument();
  });

  it('applies danger urgency class when cert expires within a week', () => {
    const expiry = new Date(Date.now() + 3 * 86400000).toISOString();
    const { container } = renderSettingsView({ caExpiry: expiry });
    expect(container.querySelector('.ca-expiry--danger')).toBeInTheDocument();
  });

  it('applies warning urgency class when cert expires within three months', () => {
    const expiry = new Date(Date.now() + 30 * 86400000).toISOString();
    const { container } = renderSettingsView({ caExpiry: expiry });
    expect(container.querySelector('.ca-expiry--warning')).toBeInTheDocument();
  });
});

describe('SettingsView — platform notes', () => {
  it('shows the mac platform note on mac', () => {
    vi.mocked(getOS).mockReturnValue('mac');
    renderSettingsView();
    expect(screen.getByText('settings.cert.platformNote.mac')).toBeInTheDocument();
  });

  it('shows the windows platform note on windows', () => {
    vi.mocked(getOS).mockReturnValue('windows');
    renderSettingsView();
    expect(screen.getByText('settings.cert.platformNote.windows')).toBeInTheDocument();
  });

  it('does not show the mac note on windows', () => {
    vi.mocked(getOS).mockReturnValue('windows');
    renderSettingsView();
    expect(screen.queryByText('settings.cert.platformNote.mac')).not.toBeInTheDocument();
  });
});
