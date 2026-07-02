// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConditionListEditor from '../../../src/renderer/components/ConditionListEditor.jsx';

const t = (key) => key;

function renderEditor(props = {}) {
  const defaults = {
    conditions: [],
    onChange: vi.fn(),
    t,
  };
  return render(<ConditionListEditor {...defaults} {...props} />);
}

describe('ConditionListEditor', () => {
  it('renders the label', () => {
    renderEditor();
    expect(screen.getByText('mocks.modals.manage.form.conditions.label')).toBeInTheDocument();
  });

  it('renders the "(optional)" indicator', () => {
    renderEditor();
    expect(screen.getByText('mappings.modals.manage.form.optional')).toBeInTheDocument();
  });

  it('renders no condition rows when conditions is empty', () => {
    const { container } = renderEditor({ conditions: [] });
    expect(container.querySelectorAll('.header-row')).toHaveLength(0);
  });

  it('renders a row with type, key, operator, and value populated', () => {
    const { container } = renderEditor({
      conditions: [{ type: 'header', key: 'X-Token', operator: 'equals', value: 'secret' }],
    });
    const row = container.querySelector('.header-row');
    const [typeSelect, keyInput, operatorSelect, valueInput] = row.querySelectorAll('.form-input');
    expect(typeSelect.value).toBe('header');
    expect(keyInput.value).toBe('X-Token');
    expect(operatorSelect.value).toBe('equals');
    expect(valueInput.value).toBe('secret');
  });

  it('hides the key input when type is body', () => {
    const { container } = renderEditor({
      conditions: [{ type: 'body', key: '', operator: 'contains', value: 'x' }],
    });
    const row = container.querySelector('.header-row');
    expect(row.querySelectorAll('.form-input')).toHaveLength(3);
  });

  it('hides the value input when operator is exists', () => {
    const { container } = renderEditor({
      conditions: [{ type: 'header', key: 'x-token', operator: 'exists', value: '' }],
    });
    const row = container.querySelector('.header-row');
    expect(row.querySelectorAll('.form-input')).toHaveLength(3);
  });

  it('hides both key and value inputs when type is body and operator is exists', () => {
    const { container } = renderEditor({
      conditions: [{ type: 'body', key: '', operator: 'exists', value: '' }],
    });
    const row = container.querySelector('.header-row');
    expect(row.querySelectorAll('.form-input')).toHaveLength(2);
  });

  it('renders the add button with the label text', () => {
    renderEditor();
    expect(screen.getByText('mocks.modals.manage.form.conditions.add')).toBeInTheDocument();
  });

  it('calls onChange with a new default row appended when the add button is clicked', () => {
    const onChange = vi.fn();
    renderEditor({ conditions: [], onChange });
    fireEvent.click(screen.getByText('mocks.modals.manage.form.conditions.add'));
    expect(onChange).toHaveBeenCalledWith([{ type: 'header', key: '', operator: 'equals', value: '' }]);
  });

  it('calls onChange with an updated type when the type select changes', () => {
    const onChange = vi.fn();
    const { container } = renderEditor({
      conditions: [{ type: 'header', key: 'x', operator: 'equals', value: 'y' }],
      onChange,
    });
    const typeSelect = container.querySelector('.header-row').querySelectorAll('.form-input')[0];
    fireEvent.change(typeSelect, { target: { value: 'query' } });
    expect(onChange).toHaveBeenCalledWith([{ type: 'query', key: 'x', operator: 'equals', value: 'y' }]);
  });

  it('calls onChange with an updated key when the key input changes', () => {
    const onChange = vi.fn();
    const { container } = renderEditor({
      conditions: [{ type: 'header', key: '', operator: 'equals', value: 'y' }],
      onChange,
    });
    const keyInput = container.querySelector('.header-row').querySelectorAll('.form-input')[1];
    fireEvent.change(keyInput, { target: { value: 'x-token' } });
    expect(onChange).toHaveBeenCalledWith([{ type: 'header', key: 'x-token', operator: 'equals', value: 'y' }]);
  });

  it('calls onChange with an updated operator when the operator select changes', () => {
    const onChange = vi.fn();
    const { container } = renderEditor({
      conditions: [{ type: 'header', key: 'x', operator: 'equals', value: 'y' }],
      onChange,
    });
    const operatorSelect = container.querySelector('.header-row').querySelectorAll('.form-input')[2];
    fireEvent.change(operatorSelect, { target: { value: 'contains' } });
    expect(onChange).toHaveBeenCalledWith([{ type: 'header', key: 'x', operator: 'contains', value: 'y' }]);
  });

  it('calls onChange with an updated value when the value input changes', () => {
    const onChange = vi.fn();
    const { container } = renderEditor({
      conditions: [{ type: 'header', key: 'x', operator: 'equals', value: '' }],
      onChange,
    });
    const valueInput = container.querySelector('.header-row').querySelectorAll('.form-input')[3];
    fireEvent.change(valueInput, { target: { value: 'y' } });
    expect(onChange).toHaveBeenCalledWith([{ type: 'header', key: 'x', operator: 'equals', value: 'y' }]);
  });

  it('calls onChange with the row removed when its remove button is clicked', () => {
    const onChange = vi.fn();
    const { container } = renderEditor({
      conditions: [
        { type: 'header', key: 'a', operator: 'equals', value: '1' },
        { type: 'query', key: 'b', operator: 'contains', value: '2' },
      ],
      onChange,
    });
    const rows = container.querySelectorAll('.header-row');
    fireEvent.click(rows[0].querySelector('button'));
    expect(onChange).toHaveBeenCalledWith([{ type: 'query', key: 'b', operator: 'contains', value: '2' }]);
  });

  it('sets an aria-label on the remove button from the translation', () => {
    renderEditor({ conditions: [{ type: 'header', key: 'a', operator: 'equals', value: '1' }] });
    expect(screen.getByLabelText('mocks.modals.manage.form.conditions.remove')).toBeInTheDocument();
  });
});
