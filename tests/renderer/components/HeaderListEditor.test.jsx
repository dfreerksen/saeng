// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HeaderListEditor from '../../../src/renderer/components/HeaderListEditor.jsx';

const t = (key) => key;

function renderEditor(props = {}) {
  const defaults = {
    headers: [],
    onChange: vi.fn(),
    label: 'Request Headers',
    hint: 'Some hint text',
    t,
  };
  return render(<HeaderListEditor {...defaults} {...props} />);
}

describe('HeaderListEditor', () => {
  it('renders the label', () => {
    renderEditor({ label: 'Request Headers' });
    expect(screen.getByText('Request Headers')).toBeInTheDocument();
  });

  it('renders the "(optional)" indicator', () => {
    renderEditor();
    expect(screen.getByText('mappings.modals.manage.form.optional')).toBeInTheDocument();
  });

  it('renders the hint text', () => {
    renderEditor({ hint: 'Some hint text' });
    expect(screen.getByText('Some hint text')).toBeInTheDocument();
  });

  it('renders no header rows when headers is empty', () => {
    const { container } = renderEditor({ headers: [] });
    expect(container.querySelectorAll('.header-row')).toHaveLength(0);
  });

  it('renders a row for each header with name and value populated', () => {
    const { container } = renderEditor({
      headers: [{ name: 'X-Foo', value: 'bar' }, { name: 'X-Baz', value: 'qux' }],
    });
    const rows = container.querySelectorAll('.header-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelectorAll('.form-input')[0].value).toBe('X-Foo');
    expect(rows[0].querySelectorAll('.form-input')[1].value).toBe('bar');
    expect(rows[1].querySelectorAll('.form-input')[0].value).toBe('X-Baz');
    expect(rows[1].querySelectorAll('.form-input')[1].value).toBe('qux');
  });

  it('renders the add button with the label text', () => {
    renderEditor();
    expect(screen.getByText('mappings.modals.manage.form.headers.add')).toBeInTheDocument();
  });

  it('calls onChange with a new empty row appended when the add button is clicked', () => {
    const onChange = vi.fn();
    renderEditor({ headers: [{ name: 'X-Foo', value: 'bar' }], onChange });
    fireEvent.click(screen.getByText('mappings.modals.manage.form.headers.add'));
    expect(onChange).toHaveBeenCalledWith([{ name: 'X-Foo', value: 'bar' }, { name: '', value: '' }]);
  });

  it('calls onChange with an updated name when the name input changes', () => {
    const onChange = vi.fn();
    const { container } = renderEditor({ headers: [{ name: '', value: 'bar' }], onChange });
    const nameInput = container.querySelector('.header-row').querySelectorAll('.form-input')[0];
    fireEvent.change(nameInput, { target: { value: 'X-Foo' } });
    expect(onChange).toHaveBeenCalledWith([{ name: 'X-Foo', value: 'bar' }]);
  });

  it('calls onChange with an updated value when the value input changes', () => {
    const onChange = vi.fn();
    const { container } = renderEditor({ headers: [{ name: 'X-Foo', value: '' }], onChange });
    const valueInput = container.querySelector('.header-row').querySelectorAll('.form-input')[1];
    fireEvent.change(valueInput, { target: { value: 'bar' } });
    expect(onChange).toHaveBeenCalledWith([{ name: 'X-Foo', value: 'bar' }]);
  });

  it('calls onChange with the row removed when its remove button is clicked', () => {
    const onChange = vi.fn();
    const { container } = renderEditor({
      headers: [{ name: 'X-Foo', value: 'bar' }, { name: 'X-Baz', value: 'qux' }],
      onChange,
    });
    const rows = container.querySelectorAll('.header-row');
    fireEvent.click(rows[0].querySelector('button'));
    expect(onChange).toHaveBeenCalledWith([{ name: 'X-Baz', value: 'qux' }]);
  });

  it('sets an aria-label on the remove button from the translation', () => {
    renderEditor({ headers: [{ name: 'X-Foo', value: 'bar' }] });
    expect(screen.getByLabelText('mappings.modals.manage.form.headers.remove')).toBeInTheDocument();
  });
});
