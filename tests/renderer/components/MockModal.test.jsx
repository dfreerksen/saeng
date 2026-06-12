// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/renderer/components/Modal.jsx', () => ({
  default: ({ children }) => <div data-testid="modal-wrapper">{children}</div>,
}));

import MockModal from '../../../src/renderer/components/MockModal.jsx';

const t = (key) => key;

const SAMPLE_MAPPINGS = [
  { id: 'm1', domain: 'myapp.local', port: 3000, https: false, enabled: true },
  { id: 'm2', domain: 'api.myapp.local', port: 4000, https: true, enabled: true },
];

const EXISTING_MOCK = {
  id: 'mock1',
  mappingId: 'm2',
  method: 'POST',
  pathPattern: '^/api/ping$',
  statusCode: 201,
  headers: [{ name: 'X-Mock', value: 'yes' }],
  body: '{"ok":true}',
};

function renderAddModal(props = {}) {
  const defaults = {
    mappings: SAMPLE_MAPPINGS,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    t,
  };
  return render(<MockModal {...defaults} {...props} />);
}

function renderEditModal(props = {}) {
  return renderAddModal({ mock: EXISTING_MOCK, ...props });
}

describe('MockModal — add mode', () => {
  it('renders the add title', () => {
    renderAddModal();
    expect(screen.getByText('mocks.modals.manage.addTitle')).toBeInTheDocument();
  });

  it('does not render the edit title', () => {
    renderAddModal();
    expect(screen.queryByText('mocks.modals.manage.editTitle')).not.toBeInTheDocument();
  });

  it('renders the add submit button', () => {
    renderAddModal();
    expect(screen.getByText('mappings.modals.manage.buttons.add')).toBeInTheDocument();
  });

  it('defaults the mapping select to the first mapping', () => {
    const { container } = renderAddModal();
    const mappingSelect = container.querySelectorAll('.form-input')[0];
    expect(mappingSelect.value).toBe('m1');
  });

  it('defaults the method select to "*"', () => {
    const { container } = renderAddModal();
    const methodSelect = container.querySelectorAll('.form-input')[1];
    expect(methodSelect.value).toBe('*');
  });

  it('shows "any" translation for the "*" method option', () => {
    renderAddModal();
    expect(screen.getByText('mocks.modals.manage.form.method.any')).toBeInTheDocument();
  });

  it('starts with an empty path pattern field', () => {
    const { container } = renderAddModal();
    const pathInput = container.querySelectorAll('.form-input')[2];
    expect(pathInput.value).toBe('');
  });

  it('focuses the path pattern field on mount', () => {
    const { container } = renderAddModal();
    const pathInput = container.querySelectorAll('.form-input')[2];
    expect(document.activeElement).toBe(pathInput);
  });

  it('starts with status code defaulting to 200', () => {
    const { container } = renderAddModal();
    const statusInput = container.querySelector('input[type="number"]');
    expect(statusInput.value).toBe('200');
  });

  it('starts with an empty body field', () => {
    const { container } = renderAddModal();
    const bodyTextarea = container.querySelector('textarea');
    expect(bodyTextarea.value).toBe('');
  });

  it('starts with no header rows', () => {
    const { container } = renderAddModal();
    expect(container.querySelectorAll('.header-row')).toHaveLength(0);
  });
});

describe('MockModal — edit mode', () => {
  it('renders the edit title', () => {
    renderEditModal();
    expect(screen.getByText('mocks.modals.manage.editTitle')).toBeInTheDocument();
  });

  it('renders the edit submit button', () => {
    renderEditModal();
    expect(screen.getByText('mappings.modals.manage.buttons.update')).toBeInTheDocument();
  });

  it('pre-fills the mapping select', () => {
    const { container } = renderEditModal();
    const mappingSelect = container.querySelectorAll('.form-input')[0];
    expect(mappingSelect.value).toBe('m2');
  });

  it('pre-fills the method select', () => {
    const { container } = renderEditModal();
    const methodSelect = container.querySelectorAll('.form-input')[1];
    expect(methodSelect.value).toBe('POST');
  });

  it('pre-fills the path pattern field', () => {
    const { container } = renderEditModal();
    const pathInput = container.querySelectorAll('.form-input')[2];
    expect(pathInput.value).toBe('^/api/ping$');
  });

  it('pre-fills the status code field', () => {
    const { container } = renderEditModal();
    const statusInput = container.querySelector('input[type="number"]');
    expect(statusInput.value).toBe('201');
  });

  it('pre-fills the body field', () => {
    const { container } = renderEditModal();
    const bodyTextarea = container.querySelector('textarea');
    expect(bodyTextarea.value).toBe('{"ok":true}');
  });

  it('pre-fills header rows', () => {
    const { container } = renderEditModal();
    const headerRows = container.querySelectorAll('.header-row');
    expect(headerRows).toHaveLength(1);
    expect(headerRows[0].querySelectorAll('.form-input')[0].value).toBe('X-Mock');
    expect(headerRows[0].querySelectorAll('.form-input')[1].value).toBe('yes');
  });
});

describe('MockModal — cancel', () => {
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

describe('MockModal — validation', () => {
  it('shows a mapping error when there are no mappings to select from', async () => {
    const onSubmit = vi.fn();
    const { container } = renderAddModal({ mappings: [], onSubmit });
    const pathInput = container.querySelectorAll('.form-input')[2];
    fireEvent.change(pathInput, { target: { value: '^/api$' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('mocks.modals.manage.form.mapping.error')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows a path error when the path pattern is empty', async () => {
    const onSubmit = vi.fn();
    renderAddModal({ onSubmit });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('mocks.modals.manage.form.path.error.required')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows a path error when the path pattern is not a valid regex', async () => {
    const onSubmit = vi.fn();
    const { container } = renderAddModal({ onSubmit });
    const pathInput = container.querySelectorAll('.form-input')[2];
    fireEvent.change(pathInput, { target: { value: '(unterminated' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('mocks.modals.manage.form.path.error.invalid')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows a status error when the status code is out of range', async () => {
    const onSubmit = vi.fn();
    const { container } = renderAddModal({ onSubmit });
    const pathInput = container.querySelectorAll('.form-input')[2];
    const statusInput = container.querySelector('input[type="number"]');
    fireEvent.change(pathInput, { target: { value: '^/api$' } });
    fireEvent.change(statusInput, { target: { value: '700' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('mocks.modals.manage.form.status.error')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows a status error when the status code is zero', async () => {
    const onSubmit = vi.fn();
    const { container } = renderAddModal({ onSubmit });
    const pathInput = container.querySelectorAll('.form-input')[2];
    const statusInput = container.querySelector('input[type="number"]');
    fireEvent.change(pathInput, { target: { value: '^/api$' } });
    fireEvent.change(statusInput, { target: { value: '0' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('mocks.modals.manage.form.status.error')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('MockModal — successful submit', () => {
  it('calls onSubmit with the expected payload shape', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderAddModal({ onSubmit });
    const pathInput = container.querySelectorAll('.form-input')[2];
    fireEvent.change(pathInput, { target: { value: '^/api/ping$' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        mappingId: 'm1',
        method: '*',
        pathPattern: '^/api/ping$',
        statusCode: 200,
        headers: [],
        body: '',
      });
    });
  });

  it('trims the path pattern before submitting', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderAddModal({ onSubmit });
    const pathInput = container.querySelectorAll('.form-input')[2];
    fireEvent.change(pathInput, { target: { value: '  ^/api/ping$  ' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ pathPattern: '^/api/ping$' }));
    });
  });

  it('includes the selected mapping, method, and status code', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderAddModal({ onSubmit });
    const mappingSelect = container.querySelectorAll('.form-input')[0];
    const methodSelect = container.querySelectorAll('.form-input')[1];
    const pathInput = container.querySelectorAll('.form-input')[2];
    const statusInput = container.querySelector('input[type="number"]');
    fireEvent.change(mappingSelect, { target: { value: 'm2' } });
    fireEvent.change(methodSelect, { target: { value: 'GET' } });
    fireEvent.change(pathInput, { target: { value: '^/users$' } });
    fireEvent.change(statusInput, { target: { value: '404' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        mappingId: 'm2',
        method: 'GET',
        pathPattern: '^/users$',
        statusCode: 404,
      }));
    });
  });

  it('includes headers added via the header list editor', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderAddModal({ onSubmit });
    const pathInput = container.querySelectorAll('.form-input')[2];
    fireEvent.change(pathInput, { target: { value: '^/api$' } });

    fireEvent.click(screen.getByText('mappings.modals.manage.form.headers.add'));
    const headerRow = container.querySelector('.header-row');
    const headerInputs = headerRow.querySelectorAll('.form-input');
    fireEvent.change(headerInputs[0], { target: { value: 'Content-Type' } });
    fireEvent.change(headerInputs[1], { target: { value: 'application/json' } });

    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        headers: [{ name: 'Content-Type', value: 'application/json' }],
      }));
    });
  });

  it('includes the response body', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderAddModal({ onSubmit });
    const pathInput = container.querySelectorAll('.form-input')[2];
    const bodyTextarea = container.querySelector('textarea');
    fireEvent.change(pathInput, { target: { value: '^/api$' } });
    fireEvent.change(bodyTextarea, { target: { value: '{"ok":true}' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ body: '{"ok":true}' }));
    });
  });

  it('disables the submit button while submitting', async () => {
    let resolve;
    const onSubmit = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
    const { container } = renderAddModal({ onSubmit });
    const pathInput = container.querySelectorAll('.form-input')[2];
    fireEvent.change(pathInput, { target: { value: '^/api$' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('mappings.modals.manage.buttons.add')).toBeDisabled();
    });
    await act(async () => { resolve(); });
  });

  it('surfaces a server-side error returned from onSubmit as a path error', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: false, error: 'Invalid path pattern: boom' });
    const { container } = renderAddModal({ onSubmit });
    const pathInput = container.querySelectorAll('.form-input')[2];
    fireEvent.change(pathInput, { target: { value: '^/api$' } });
    fireEvent.click(screen.getByText('mappings.modals.manage.buttons.add'));
    await waitFor(() => {
      expect(screen.getByText('Invalid path pattern: boom')).toBeInTheDocument();
    });
  });
});
