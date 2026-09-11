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

describe('ProxySection — proxyPort', () => {
  it('renders the current proxyPort value', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, proxyPort: 9191 } });
    expect(container.querySelector('.proxy-port-input')).toHaveValue(9191);
  });

  it('defaults to 8282 when proxyPort is not set', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, proxyPort: undefined } });
    expect(container.querySelector('.proxy-port-input')).toHaveValue(8282);
  });

  it('commits a valid new value on blur', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSection({ onSettingsChange, showToast, settings: { ...SAMPLE_SETTINGS, proxyPort: 8282 } });
    const input = container.querySelector('.proxy-port-input');
    fireEvent.change(input, { target: { value: '9000' } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({ proxyPort: 9000 });
      expect(showToast).toHaveBeenCalledWith('flash.proxyPort.updated', 'info');
    });
  });

  it('clamps a value below the minimum to 1 on blur', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, proxyPort: 8282 } });
    const input = container.querySelector('.proxy-port-input');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({ proxyPort: 1 });
    });
  });

  it('clamps a value above the maximum to 65535 on blur', async () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, proxyPort: 8282 } });
    const input = container.querySelector('.proxy-port-input');
    fireEvent.change(input, { target: { value: '100000' } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({ proxyPort: 65535 });
    });
  });

  it('does not call onSettingsChange when the value is unchanged', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const { container } = renderSection({ onSettingsChange, settings: { ...SAMPLE_SETTINGS, proxyPort: 8282 } });
    const input = container.querySelector('.proxy-port-input');
    fireEvent.blur(input);
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it('rejects the reserved PAC server port (8181), reverts, and shows a conflict toast', () => {
    const onSettingsChange = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    const { container } = renderSection({ onSettingsChange, showToast, settings: { ...SAMPLE_SETTINGS, proxyPort: 9000 } });
    const input = container.querySelector('.proxy-port-input');
    fireEvent.change(input, { target: { value: '8181' } });
    fireEvent.blur(input);
    expect(onSettingsChange).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('flash.proxyPort.conflict', 'error');
    expect(input).toHaveValue(9000);
  });
});
