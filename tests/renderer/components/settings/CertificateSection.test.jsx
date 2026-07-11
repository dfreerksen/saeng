// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/renderer/components/utilities/Tooltip.jsx', () => ({
  default: ({ children }) => children,
}));

vi.mock('../../../../src/renderer/js/os.js', () => ({
  getOS: vi.fn().mockReturnValue('mac'),
}));

import { getOS } from '../../../../src/renderer/js/os.js';
import CertificateSection from '../../../../src/renderer/components/settings/CertificateSection.jsx';

const t = (key) => key;

function renderSection(props = {}) {
  const defaults = {
    caPath: '/path/to/ca.crt',
    caExpiry: null,
    setCaExpiry: vi.fn(),
    showToast: vi.fn(),
    t,
  };
  return render(<CertificateSection {...defaults} {...props} />);
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

describe('CertificateSection — rendering', () => {
  it('renders the section title', () => {
    renderSection();
    expect(screen.getByText('settings.cert.title')).toBeInTheDocument();
  });

  it('displays the CA path', () => {
    renderSection({ caPath: '/Users/me/ca.crt' });
    expect(screen.getByText('/Users/me/ca.crt')).toBeInTheDocument();
  });

  it('shows the generating placeholder when the CA path is empty', () => {
    renderSection({ caPath: '' });
    expect(screen.getByText('settings.cert.actions.generating')).toBeInTheDocument();
  });
});

describe('CertificateSection — CA expiry', () => {
  it('does not show expiry info when caExpiry is null', () => {
    const { container } = renderSection({ caExpiry: null });
    expect(container.querySelector('.ca-expiry')).not.toBeInTheDocument();
  });

  it('shows expiry info when caExpiry is set', () => {
    const expiry = new Date(Date.now() + 400 * 86400000).toISOString();
    const { container } = renderSection({ caExpiry: expiry });
    expect(container.querySelector('.ca-expiry')).toBeInTheDocument();
  });

  it('applies the danger urgency class when the cert expires within a week', () => {
    const expiry = new Date(Date.now() + 3 * 86400000).toISOString();
    const { container } = renderSection({ caExpiry: expiry });
    expect(container.querySelector('.ca-expiry--danger')).toBeInTheDocument();
  });

  it('applies the warning urgency class when the cert expires within three months', () => {
    const expiry = new Date(Date.now() + 30 * 86400000).toISOString();
    const { container } = renderSection({ caExpiry: expiry });
    expect(container.querySelector('.ca-expiry--warning')).toBeInTheDocument();
  });
});

describe('CertificateSection — reveal CA', () => {
  it('calls electronAPI.ssl.revealCA when the reveal button is clicked', () => {
    renderSection();
    const revealBtn = screen.getByText('settings.cert.actions.show.mac').closest('button');
    fireEvent.click(revealBtn);
    expect(window.electronAPI.ssl.revealCA).toHaveBeenCalledOnce();
  });
});

describe('CertificateSection — trust CA', () => {
  it('calls electronAPI.ssl.trustCA when the trust button is clicked', async () => {
    renderSection();
    fireEvent.click(screen.getByText('settings.cert.actions.install').closest('button'));
    await waitFor(() => {
      expect(window.electronAPI.ssl.trustCA).toHaveBeenCalledOnce();
    });
  });

  it('shows a success toast after trusting the CA', async () => {
    const showToast = vi.fn();
    renderSection({ showToast });
    fireEvent.click(screen.getByText('settings.cert.actions.install').closest('button'));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('flash.ca.trusted', 'success', 5000);
    });
  });

  it('shows an error toast when trusting the CA fails', async () => {
    window.electronAPI.ssl.trustCA.mockResolvedValue({ success: false, message: 'Denied' });
    const showToast = vi.fn();
    renderSection({ showToast });
    fireEvent.click(screen.getByText('settings.cert.actions.install').closest('button'));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Denied', 'error', 6000);
    });
  });
});

describe('CertificateSection — regenerate CA', () => {
  it('calls electronAPI.ssl.regenerateCA when confirmed', async () => {
    window.confirm.mockReturnValue(true);
    renderSection();
    fireEvent.click(screen.getByText('settings.cert.actions.regenerate').closest('button'));
    await waitFor(() => {
      expect(window.electronAPI.ssl.regenerateCA).toHaveBeenCalledOnce();
    });
  });

  it('does not call regenerateCA when confirmation is denied', () => {
    window.confirm.mockReturnValue(false);
    renderSection();
    fireEvent.click(screen.getByText('settings.cert.actions.regenerate').closest('button'));
    expect(window.electronAPI.ssl.regenerateCA).not.toHaveBeenCalled();
  });

  it('calls setCaExpiry with the new expiry after regeneration', async () => {
    const newExpiry = new Date(Date.now() + 365 * 86400000).toISOString();
    window.electronAPI.ssl.regenerateCA.mockResolvedValue(newExpiry);
    const setCaExpiry = vi.fn();
    renderSection({ setCaExpiry });
    fireEvent.click(screen.getByText('settings.cert.actions.regenerate').closest('button'));
    await waitFor(() => {
      expect(setCaExpiry).toHaveBeenCalledWith(newExpiry);
    });
  });
});

describe('CertificateSection — delete CA', () => {
  it('calls electronAPI.ssl.deleteCA when confirmed', async () => {
    renderSection();
    fireEvent.click(screen.getByText('settings.cert.actions.delete').closest('button'));
    await waitFor(() => {
      expect(window.electronAPI.ssl.deleteCA).toHaveBeenCalledOnce();
    });
  });

  it('does not call deleteCA when confirmation is denied', () => {
    window.confirm.mockReturnValue(false);
    renderSection();
    fireEvent.click(screen.getByText('settings.cert.actions.delete').closest('button'));
    expect(window.electronAPI.ssl.deleteCA).not.toHaveBeenCalled();
  });

  it('calls setCaExpiry(null) after deleting the CA', async () => {
    const setCaExpiry = vi.fn();
    renderSection({ setCaExpiry });
    fireEvent.click(screen.getByText('settings.cert.actions.delete').closest('button'));
    await waitFor(() => {
      expect(setCaExpiry).toHaveBeenCalledWith(null);
    });
  });

  it('shows an additional warning toast when the delete result includes one', async () => {
    window.electronAPI.ssl.deleteCA.mockResolvedValue({ warning: 'CA still trusted elsewhere' });
    const showToast = vi.fn();
    renderSection({ showToast });
    fireEvent.click(screen.getByText('settings.cert.actions.delete').closest('button'));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('CA still trusted elsewhere', 'info', 6000);
    });
  });
});

describe('CertificateSection — platform notes', () => {
  it('shows the mac show-CA label and platform note on mac', () => {
    vi.mocked(getOS).mockReturnValue('mac');
    renderSection();
    expect(screen.getByText('settings.cert.actions.show.mac')).toBeInTheDocument();
    expect(screen.getByText('settings.cert.platformNote.mac')).toBeInTheDocument();
  });

  it('shows the windows show-CA label and platform note on windows', () => {
    vi.mocked(getOS).mockReturnValue('windows');
    renderSection();
    expect(screen.getByText('settings.cert.actions.show.windows')).toBeInTheDocument();
    expect(screen.getByText('settings.cert.platformNote.windows')).toBeInTheDocument();
  });
});
