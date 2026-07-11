// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import ProxySection from '../../../../src/renderer/components/settings/ProxySection.jsx';

const t = (key) => key;

const SAMPLE_SETTINGS = {
  httpsEnabled: true,
  startOnLaunch: false,
};

function renderSection(props = {}) {
  const defaults = {
    settings: SAMPLE_SETTINGS,
    onSettingsChange: vi.fn().mockResolvedValue(undefined),
    showToast: vi.fn(),
    t,
  };
  return render(<ProxySection {...defaults} {...props} />);
}

describe('ProxySection — rendering', () => {
  it('renders the section title', () => {
    renderSection();
    expect(screen.getByText('settings.proxy.title')).toBeInTheDocument();
  });

  it('renders exactly two toggles', () => {
    const { container } = renderSection();
    expect(container.querySelectorAll('.toggle input[type="checkbox"]')).toHaveLength(2);
  });
});

describe('ProxySection — httpsEnabled', () => {
  it('checks the toggle when httpsEnabled is true', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, httpsEnabled: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[0]).toBeChecked();
  });

  it('unchecks the toggle when httpsEnabled is false', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, httpsEnabled: false } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[0]).not.toBeChecked();
  });

  it('calls onSettingsChange with the new value when toggled', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, httpsEnabled: true } });
    const toggle = container.querySelectorAll('.toggle input[type="checkbox"]')[0];
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({ httpsEnabled: false });
    });
  });

  it('shows an "enabled" toast when turned on', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSection({ onSettingsChange, showToast, settings: { ...SAMPLE_SETTINGS, httpsEnabled: false } });
    const toggle = container.querySelectorAll('.toggle input[type="checkbox"]')[0];
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('flash.https.enabled', 'info');
    });
  });

  it('shows a "disabled" toast when turned off', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSection({ onSettingsChange, showToast, settings: { ...SAMPLE_SETTINGS, httpsEnabled: true } });
    const toggle = container.querySelectorAll('.toggle input[type="checkbox"]')[0];
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('flash.https.disabled', 'info');
    });
  });
});

describe('ProxySection — startOnLaunch', () => {
  it('checks the toggle when startOnLaunch is true', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, startOnLaunch: true } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[1]).toBeChecked();
  });

  it('unchecks the toggle when startOnLaunch is false', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, startOnLaunch: false } });
    const toggles = container.querySelectorAll('.toggle input[type="checkbox"]');
    expect(toggles[1]).not.toBeChecked();
  });

  it('calls onSettingsChange with the new value when toggled', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, startOnLaunch: false } });
    const toggle = container.querySelectorAll('.toggle input[type="checkbox"]')[1];
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({ startOnLaunch: true });
    });
  });

  it('shows a generic settings-updated toast when toggled', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSection({ onSettingsChange, showToast, settings: { ...SAMPLE_SETTINGS, startOnLaunch: false } });
    const toggle = container.querySelectorAll('.toggle input[type="checkbox"]')[1];
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('flash.settings.updated', 'info');
    });
  });
});
