// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CliAccessSection from '../../../../src/renderer/components/settings/CliAccessSection.jsx';

const SAMPLE_SETTINGS = {
  httpsEnabled: true,
  proxyPort: 8282,
};

function renderSection(props = {}) {
  const defaults = {
    settings: SAMPLE_SETTINGS,
    caPath: '/Users/test/Library/Application Support/saeng/certs/ca.crt',
    showToast: vi.fn(),
  };
  return render(<CliAccessSection {...defaults} {...props} />);
}

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn() },
    writable: true,
    configurable: true,
  });
});

describe('CliAccessSection — rendering', () => {
  it('renders the section title', () => {
    renderSection();
    expect(screen.getByText('settings.cli.title')).toBeInTheDocument();
  });

  it('includes the configured proxy port in the env var snippet', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, proxyPort: 9191 } });
    expect(container.textContent).toContain('http://127.0.0.1:9191');
  });

  it('shows the CA trust step when httpsEnabled is true', () => {
    renderSection({ settings: { ...SAMPLE_SETTINGS, httpsEnabled: true } });
    expect(screen.getByText('settings.cli.step2.title')).toBeInTheDocument();
  });

  it('hides the CA trust step when httpsEnabled is false', () => {
    renderSection({ settings: { ...SAMPLE_SETTINGS, httpsEnabled: false } });
    expect(screen.queryByText('settings.cli.step2.title')).not.toBeInTheDocument();
  });

  it('shows an http example when httpsEnabled is false', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, httpsEnabled: false } });
    expect(container.textContent).toContain('curl http://your-domain.local/');
  });

  it('shows an https example when httpsEnabled is true', () => {
    const { container } = renderSection({ settings: { ...SAMPLE_SETTINGS, httpsEnabled: true } });
    expect(container.textContent).toContain('curl https://your-domain.local/');
  });

  it('includes the CA path in the alternative CURL_CA_BUNDLE snippet', () => {
    const { container } = renderSection();
    expect(container.textContent).toContain(SAMPLE_SETTINGS.caPath ?? '');
    expect(container.textContent).toContain('/Users/test/Library/Application Support/saeng/certs/ca.crt');
  });
});

describe('CliAccessSection — copy buttons', () => {
  it('copies the env var block to the clipboard and shows a toast', () => {
    const showToast = vi.fn();
    renderSection({ showToast });
    const [copyButton] = screen.getAllByRole('button');
    fireEvent.click(copyButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('export http_proxy=http://127.0.0.1:8282')
    );
    expect(showToast).toHaveBeenCalledWith('flash.copied', 'success');
  });
});
