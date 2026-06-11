// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/renderer/components/Modal.jsx', () => ({
  default: ({ children }) => <div data-testid="modal-wrapper">{children}</div>,
}));

import MappingModal from '../../../src/renderer/components/MappingModal.jsx';

const t = (key) => key;

const EXISTING_MAPPING = {
  id: 'abc',
  domain: 'api.myapp.local',
  host: '192.168.1.10',
  port: 4000,
  https: true,
  enabled: true,
};

const OTHER_MAPPINGS = [
  { id: 'xyz', domain: 'other.local', port: 5000, https: false, enabled: true },
];

function renderAddModal(props = {}) {
  const defaults = {
    mappings: [],
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    t,
  };
  return render(<MappingModal {...defaults} {...props} />);
}

function renderEditModal(props = {}) {
  return renderAddModal({ mapping: EXISTING_MAPPING, ...props });
}

describe('MappingModal — add mode', () => {
  it('renders the add title', () => {
    renderAddModal();
    expect(screen.getByText('mappings.modals.manage.addTitle')).toBeInTheDocument();
  });

  it('does not render the edit title', () => {
    renderAddModal();
    expect(screen.queryByText('mappings.modals.manage.editTitle')).not.toBeInTheDocument();
  });

  it('renders the add submit button', () => {
    renderAddModal();
    expect(screen.getByText('mappings.modals.manage.buttons.add')).toBeInTheDocument();
  });

  it('starts with an empty domain field', () => {
    const { container } = renderAddModal();
    const domainInput = container.querySelectorAll('.form-input')[1];
    expect(domainInput.value).toBe('');
  });

  it('starts with port defaulting to 3000', () => {
    const { container } = renderAddModal();
    const portInput = container.querySelector('input[type="number"]');
    expect(portInput.value).toBe('3000');
  });

  it('starts with host defaulting to 127.0.0.1', () => {
    const { container } = renderAddModal();
    const hostInput = container.querySelectorAll('.form-input')[2];
    expect(hostInput.value).toBe('127.0.0.1');
  });

  it('starts with https unchecked', () => {
    const { container } = renderAddModal();
    const httpsCheckbox = container.querySelector('.checkbox-row input[type="checkbox"]');
    expect(httpsCheckbox).not.toBeChecked();
  });
});

describe('MappingModal — edit mode', () => {
  it('renders the edit title', () => {
    renderEditModal();
    expect(screen.getByText('mappings.modals.manage.editTitle')).toBeInTheDocument();
  });

  it('pre-fills the domain input', () => {
    const { container } = renderEditModal();
    const domainInput = container.querySelectorAll('.form-input')[1];
    expect(domainInput.value).toBe('myapp');
  });

  it('pre-fills the subdomain input', () => {
    const { container } = renderEditModal();
    const subdomainInput = container.querySelectorAll('.form-input')[0];
    expect(subdomainInput.value).toBe('api');
  });

  it('pre-fills the port input', () => {
    const { container } = renderEditModal();
    const portInput = container.querySelector('input[type="number"]');
    expect(portInput.value).toBe('4000');
  });

  it('pre-fills the https checkbox', () => {
    const { container } = renderEditModal();
    const httpsCheckbox = container.querySelector('.checkbox-row input[type="checkbox"]');
    expect(httpsCheckbox).toBeChecked();
  });

  it('pre-fills the host input', () => {
    const { container } = renderEditModal();
    const hostInput = container.querySelectorAll('.form-input')[2];
    expect(hostInput.value).toBe('192.168.1.10');
  });

  it('renders the edit submit button', () => {
    renderEditModal();
    expect(screen.getByText('mappings.modals.manage.buttons.update')).toBeInTheDocument();
  });
});

describe('MappingModal — input lowercasing', () => {
  it('lowercases the domain as the user types', () => {
    const { container } = renderAddModal();
    const domainInput = container.querySelectorAll('.form-input')[1];
    fireEvent.change(domainInput, { target: { value: 'MyApp' } });
    expect(domainInput.value).toBe('myapp');
  });

  it('lowercases the subdomain as the user types', () => {
    const { container } = renderAddModal();
    const subdomainInput = container.querySelectorAll('.form-input')[0];
    fireEvent.change(subdomainInput, { target: { value: 'API' } });
    expect(subdomainInput.value).toBe('api');
  });
});

describe('MappingModal — cancel', () => {
  it('calls onClose when the cancel button is clicked', () => {
    const onClose = vi.fn();
    renderAddModal({ onClose });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the close (×) button is clicked', () => {
    const onClose = vi.fn();
    renderAddModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('MappingModal — validation', () => {
  it('shows domain error when domain is empty on submit', async () => {
    renderAddModal();
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('mappings.modals.manage.form.domain.error.invalid')).toBeInTheDocument();
    });
  });

  it('shows domain error when domain is invalid', async () => {
    const { container } = renderAddModal();
    const domainInput = container.querySelectorAll('.form-input')[1];
    fireEvent.change(domainInput, { target: { value: '-invalid' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('mappings.modals.manage.form.domain.error.invalid')).toBeInTheDocument();
    });
  });

  it('shows subdomain error when subdomain is invalid', async () => {
    const { container } = renderAddModal();
    const subdomainInput = container.querySelectorAll('.form-input')[0];
    const domainInput = container.querySelectorAll('.form-input')[1];
    fireEvent.change(subdomainInput, { target: { value: '-bad' } });
    fireEvent.change(domainInput, { target: { value: 'myapp' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('mappings.modals.manage.form.subdomain.error')).toBeInTheDocument();
    });
  });

  it('shows port error when port is zero', async () => {
    const { container } = renderAddModal();
    const domainInput = container.querySelectorAll('.form-input')[1];
    const portInput = container.querySelector('input[type="number"]');
    fireEvent.change(domainInput, { target: { value: 'myapp' } });
    fireEvent.change(portInput, { target: { value: '0' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('mappings.modals.manage.form.port.error')).toBeInTheDocument();
    });
  });

  it('shows port error when port is out of range', async () => {
    const { container } = renderAddModal();
    const domainInput = container.querySelectorAll('.form-input')[1];
    const portInput = container.querySelector('input[type="number"]');
    fireEvent.change(domainInput, { target: { value: 'myapp' } });
    fireEvent.change(portInput, { target: { value: '99999' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('mappings.modals.manage.form.port.error')).toBeInTheDocument();
    });
  });

  it('shows duplicate domain error when the domain already exists', async () => {
    const { container } = renderAddModal({
      mappings: [{ id: 'other', domain: 'myapp.local', port: 3000, https: false, enabled: true }],
    });
    const domainInput = container.querySelectorAll('.form-input')[1];
    fireEvent.change(domainInput, { target: { value: 'myapp' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('mappings.modals.manage.form.domain.error.duplicate')).toBeInTheDocument();
    });
  });

  it('does not call onSubmit when validation fails', async () => {
    const onSubmit = vi.fn();
    renderAddModal({ onSubmit });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('mappings.modals.manage.form.domain.error.invalid')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('MappingModal — successful submit', () => {
  it('calls onSubmit with the correct domain when no subdomain', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderAddModal({ onSubmit });
    const domainInput = container.querySelectorAll('.form-input')[1];
    fireEvent.change(domainInput, { target: { value: 'myapp' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ domain: 'myapp.local', port: 3000 })
      );
    });
  });

  it('calls onSubmit with default host when host is not changed', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderAddModal({ onSubmit });
    const domainInput = container.querySelectorAll('.form-input')[1];
    fireEvent.change(domainInput, { target: { value: 'myapp' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ host: '127.0.0.1' }));
    });
  });

  it('calls onSubmit with a custom host when host is changed', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderAddModal({ onSubmit });
    const domainInput = container.querySelectorAll('.form-input')[1];
    const hostInput = container.querySelectorAll('.form-input')[2];
    fireEvent.change(domainInput, { target: { value: 'myapp' } });
    fireEvent.change(hostInput, { target: { value: '10.0.0.5' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ host: '10.0.0.5' }));
    });
  });

  it('falls back to 127.0.0.1 when host is cleared', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderAddModal({ onSubmit });
    const domainInput = container.querySelectorAll('.form-input')[1];
    const hostInput = container.querySelectorAll('.form-input')[2];
    fireEvent.change(domainInput, { target: { value: 'myapp' } });
    fireEvent.change(hostInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ host: '127.0.0.1' }));
    });
  });

  it('calls onSubmit with subdomain prepended when subdomain is provided', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderAddModal({ onSubmit });
    const subdomainInput = container.querySelectorAll('.form-input')[0];
    const domainInput = container.querySelectorAll('.form-input')[1];
    fireEvent.change(subdomainInput, { target: { value: 'api' } });
    fireEvent.change(domainInput, { target: { value: 'myapp' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ domain: 'api.myapp.local' })
      );
    });
  });

  it('calls onSubmit with a wildcard domain when subdomain is *', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderAddModal({ onSubmit });
    const subdomainInput = container.querySelectorAll('.form-input')[0];
    const domainInput = container.querySelectorAll('.form-input')[1];
    fireEvent.change(subdomainInput, { target: { value: '*' } });
    fireEvent.change(domainInput, { target: { value: 'myapp' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ domain: '*.myapp.local' })
      );
    });
  });

  it('calls onSubmit with the correct port', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderAddModal({ onSubmit });
    const domainInput = container.querySelectorAll('.form-input')[1];
    const portInput = container.querySelector('input[type="number"]');
    fireEvent.change(domainInput, { target: { value: 'myapp' } });
    fireEvent.change(portInput, { target: { value: '8080' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ port: 8080 }));
    });
  });

  it('disables the submit button while submitting', async () => {
    let resolve;
    const onSubmit = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
    const { container } = renderAddModal({ onSubmit });
    const domainInput = container.querySelectorAll('.form-input')[1];
    fireEvent.change(domainInput, { target: { value: 'myapp' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('mappings.modals.manage.buttons.add')).toBeDisabled();
    });
    await act(async () => { resolve(); });
  });
});
