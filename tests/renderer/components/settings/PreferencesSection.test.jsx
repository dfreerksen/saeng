// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/renderer/js/os.js', () => ({
  getOS: vi.fn().mockReturnValue('mac'),
}));

import { getOS } from '../../../../src/renderer/js/os.js';
import PreferencesSection from '../../../../src/renderer/components/settings/PreferencesSection.jsx';

const t = (key) => key;

const SAMPLE_LOCALES = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'fr', name: 'Français', dir: 'ltr' },
];

const SAMPLE_SETTINGS = {
  colorMode: 'auto',
  locale: 'en',
  dashboardEnabled: true,
  iconMode: 'both',
};

function renderSection(props = {}) {
  const defaults = {
    settings: SAMPLE_SETTINGS,
    locales: SAMPLE_LOCALES,
    onSettingsChange: vi.fn().mockResolvedValue(undefined),
    onLocaleChange: vi.fn(),
    onColorModeChange: vi.fn(),
    showToast: vi.fn(),
    t,
  };
  return render(<PreferencesSection {...defaults} {...props} />);
}

beforeEach(() => {
  vi.mocked(getOS).mockReturnValue('mac');
});

describe('PreferencesSection — rendering', () => {
  it('renders the section title', () => {
    renderSection();
    expect(screen.getByText('settings.preferences.title')).toBeInTheDocument();
  });
});

describe('PreferencesSection — color mode', () => {
  it('renders the select with the current value', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, colorMode: 'dark' } });
    expect(container.querySelector('.color-mode-select').value).toBe('dark');
  });

  it('defaults to auto when colorMode is not set', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, colorMode: undefined } });
    expect(container.querySelector('.color-mode-select').value).toBe('auto');
  });

  it('calls onColorModeChange when changed', () => {
    const onColorModeChange = vi.fn();
    const { container } = renderSection({ onColorModeChange });
    fireEvent.change(container.querySelector('.color-mode-select'), { target: { value: 'light' } });
    expect(onColorModeChange).toHaveBeenCalledWith('light');
  });
});

describe('PreferencesSection — locale', () => {
  it('renders the select with the current locale', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, locale: 'fr' } });
    expect(container.querySelector('.locale-select').value).toBe('fr');
  });

  it('renders all available locales as options', () => {
    const { container } = renderSection();
    const options = container.querySelectorAll('.locale-select option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('English');
    expect(options[1]).toHaveTextContent('Français');
  });

  it('calls onLocaleChange when changed', () => {
    const onLocaleChange = vi.fn();
    const { container } = renderSection({ onLocaleChange });
    fireEvent.change(container.querySelector('.locale-select'), { target: { value: 'fr' } });
    expect(onLocaleChange).toHaveBeenCalledWith('fr');
  });
});

describe('PreferencesSection — dashboard toggle', () => {
  it('is checked when dashboardEnabled is not set (defaults true)', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, dashboardEnabled: undefined } });
    expect(container.querySelector('.toggle input[type="checkbox"]')).toBeChecked();
  });

  it('is unchecked when dashboardEnabled is false', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, dashboardEnabled: false } });
    expect(container.querySelector('.toggle input[type="checkbox"]')).not.toBeChecked();
  });

  it('calls onSettingsChange when toggled', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, dashboardEnabled: true } });
    fireEvent.click(container.querySelector('.toggle input[type="checkbox"]'));
    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({ dashboardEnabled: false });
    });
  });

  it('shows a toast after toggling', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSection({ onSettingsChange, showToast, settings: { ...SAMPLE_SETTINGS, dashboardEnabled: true } });
    fireEvent.click(container.querySelector('.toggle input[type="checkbox"]'));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('flash.dashboard.disabled', 'info');
    });
  });
});

describe('PreferencesSection — icon mode', () => {
  it('renders the select with the current value', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, iconMode: 'tray' } });
    expect(container.querySelector('.icon-mode-select').value).toBe('tray');
  });

  it('defaults to both when iconMode is not set', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, iconMode: undefined } });
    expect(container.querySelector('.icon-mode-select').value).toBe('both');
  });

  it('renders three options', () => {
    const { container } = renderSection();
    const options = container.querySelectorAll('.icon-mode-select option');
    expect(options).toHaveLength(3);
    expect(options[0].value).toBe('both');
    expect(options[1].value).toBe('tray');
    expect(options[2].value).toBe('dock');
  });

  it('calls onSettingsChange when changed', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange });
    fireEvent.change(container.querySelector('.icon-mode-select'), { target: { value: 'dock' } });
    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({ iconMode: 'dock' });
    });
  });

  it('shows a toast after changing', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSection({ onSettingsChange, showToast });
    fireEvent.change(container.querySelector('.icon-mode-select'), { target: { value: 'tray' } });
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('flash.settings.updated', 'info');
    });
  });

  it('uses OS-specific option labels', () => {
    vi.mocked(getOS).mockReturnValue('windows');
    const { container } = renderSection();
    const options = container.querySelectorAll('.icon-mode-select option');
    expect(options[0]).toHaveTextContent('settings.preferences.iconMode.options.both.windows');
    expect(options[1]).toHaveTextContent('settings.preferences.iconMode.options.tray.windows');
    expect(options[2]).toHaveTextContent('settings.preferences.iconMode.options.dock.windows');
  });
});
