// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/renderer/components/Tooltip.jsx', () => ({
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
    active: true,
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
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('SettingsView — rendering', () => {
  it('renders the settings title', () => {
    renderSettingsView();
    expect(screen.getByText('settings.title')).toBeInTheDocument();
  });

  it('adds active class when active=true', () => {
    const { container } = renderSettingsView({ active: true });
    expect(container.querySelector('#view-settings')).toHaveClass('active');
  });

  it('does not add active class when active=false', () => {
    const { container } = renderSettingsView({ active: false });
    expect(container.querySelector('#view-settings')).not.toHaveClass('active');
  });

  it('displays the CA path', () => {
    renderSettingsView({ caPath: '/Users/me/ca.crt' });
    expect(screen.getByText('/Users/me/ca.crt')).toBeInTheDocument();
  });

  it('shows generating placeholder when CA path is empty', () => {
    renderSettingsView({ caPath: '' });
    expect(screen.getByText('settings.caGenerating')).toBeInTheDocument();
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

describe('SettingsView — proxy toggles', () => {
  it('renders httpsEnabled checkbox as checked when setting is true', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, httpsEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[0]).toBeChecked();
  });

  it('renders httpsEnabled checkbox as unchecked when setting is false', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, httpsEnabled: false } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[0]).not.toBeChecked();
  });

  it('calls onSettingsChange with httpsEnabled when toggled', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange });
    const httpsToggle = container.querySelectorAll('.toggle input[type="checkbox"]')[0];
    fireEvent.click(httpsToggle);
    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({ httpsEnabled: false });
    });
  });

  it('shows a toast after toggling httpsEnabled', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSettingsView({ onSettingsChange, showToast });
    const httpsToggle = container.querySelectorAll('.toggle input[type="checkbox"]')[0];
    fireEvent.click(httpsToggle);
    await waitFor(() => {
      expect(showToast).toHaveBeenCalled();
    });
  });

  it('renders startOnLaunch checkbox reflecting the setting', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, startOnLaunch: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[1]).toBeChecked();
  });

  it('calls onSettingsChange with startOnLaunch when toggled', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange });
    const startToggle = container.querySelectorAll('.toggle input[type="checkbox"]')[1];
    fireEvent.click(startToggle);
    expect(onSettingsChange).toHaveBeenCalledWith({ startOnLaunch: true });
  });
});

describe('SettingsView — logging enabled', () => {
  it('checks the toggle when loggingEnabled is true', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, loggingEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[2]).toBeChecked();
  });

  it('unchecks the toggle when loggingEnabled is false', () => {
    const { container } = renderSettingsView({ settings: { ...SAMPLE_SETTINGS, loggingEnabled: false } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[2]).not.toBeChecked();
  });

  it('calls onSettingsChange when the toggle is changed', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSettingsView({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, loggingEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    fireEvent.click(toggles[2]);
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

describe('SettingsView — CA management', () => {
  it('calls electronAPI.ssl.revealCA when reveal button is clicked', () => {
    renderSettingsView();
    const revealBtn = screen.getByText('settings.revealCa').closest('button');
    fireEvent.click(revealBtn);
    expect(window.electronAPI.ssl.revealCA).toHaveBeenCalledOnce();
  });

  it('calls electronAPI.ssl.trustCA when trust button is clicked', async () => {
    renderSettingsView();
    const trustBtn = screen.getByText('settings.trustCa').closest('button');
    fireEvent.click(trustBtn);
    await waitFor(() => {
      expect(window.electronAPI.ssl.trustCA).toHaveBeenCalledOnce();
    });
  });

  it('shows success toast after trusting CA', async () => {
    const showToast = vi.fn();
    renderSettingsView({ showToast });
    fireEvent.click(screen.getByText('settings.trustCa').closest('button'));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('toast.caTrusted', 'success', 5000);
    });
  });

  it('shows error toast when trust CA fails', async () => {
    window.electronAPI.ssl.trustCA.mockResolvedValue({ success: false, message: 'Denied' });
    const showToast = vi.fn();
    renderSettingsView({ showToast });
    fireEvent.click(screen.getByText('settings.trustCa').closest('button'));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Denied', 'error', 6000);
    });
  });

  it('calls electronAPI.ssl.regenerateCA when confirmed', async () => {
    window.confirm.mockReturnValue(true);
    renderSettingsView();
    fireEvent.click(screen.getByText('settings.regenerateCa').closest('button'));
    await waitFor(() => {
      expect(window.electronAPI.ssl.regenerateCA).toHaveBeenCalledOnce();
    });
  });

  it('does not call regenerateCA when confirmation is denied', () => {
    window.confirm.mockReturnValue(false);
    renderSettingsView();
    fireEvent.click(screen.getByText('settings.regenerateCa').closest('button'));
    expect(window.electronAPI.ssl.regenerateCA).not.toHaveBeenCalled();
  });

  it('calls setCaExpiry with the new expiry after regeneration', async () => {
    const newExpiry = new Date(Date.now() + 365 * 86400000).toISOString();
    window.electronAPI.ssl.regenerateCA.mockResolvedValue(newExpiry);
    window.confirm.mockReturnValue(true);
    const setCaExpiry = vi.fn();
    renderSettingsView({ setCaExpiry });
    fireEvent.click(screen.getByText('settings.regenerateCa').closest('button'));
    await waitFor(() => {
      expect(setCaExpiry).toHaveBeenCalledWith(newExpiry);
    });
  });

  it('calls electronAPI.ssl.deleteCA when confirmed', async () => {
    window.confirm.mockReturnValue(true);
    renderSettingsView();
    fireEvent.click(screen.getByText('settings.deleteCa').closest('button'));
    await waitFor(() => {
      expect(window.electronAPI.ssl.deleteCA).toHaveBeenCalledOnce();
    });
  });

  it('does not call deleteCA when confirmation is denied', () => {
    window.confirm.mockReturnValue(false);
    renderSettingsView();
    fireEvent.click(screen.getByText('settings.deleteCa').closest('button'));
    expect(window.electronAPI.ssl.deleteCA).not.toHaveBeenCalled();
  });

  it('calls setCaExpiry(null) after deleting CA', async () => {
    window.confirm.mockReturnValue(true);
    const setCaExpiry = vi.fn();
    renderSettingsView({ setCaExpiry });
    fireEvent.click(screen.getByText('settings.deleteCa').closest('button'));
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
    expect(screen.getByText('settings.caPlatformNoteMac')).toBeInTheDocument();
  });

  it('shows the windows platform note on windows', () => {
    vi.mocked(getOS).mockReturnValue('windows');
    renderSettingsView();
    expect(screen.getByText('settings.caPlatformNoteWindows')).toBeInTheDocument();
  });

  it('does not show the mac note on windows', () => {
    vi.mocked(getOS).mockReturnValue('windows');
    renderSettingsView();
    expect(screen.queryByText('settings.caPlatformNoteMac')).not.toBeInTheDocument();
  });
});
