// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Toast from '../../../../src/renderer/components/utilities/Toast.jsx';

describe('Toast', () => {
  it('renders nothing when toasts array is empty', () => {
    const { container } = render(<Toast toasts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a toast message', () => {
    render(<Toast toasts={[{ id: 1, message: 'Hello world', type: 'info' }]} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    const toasts = [
      { id: 1, message: 'First', type: 'info' },
      { id: 2, message: 'Second', type: 'success' },
      { id: 3, message: 'Third', type: 'error' },
    ];
    render(<Toast toasts={toasts} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('applies alert-success class for success type', () => {
    const { container } = render(<Toast toasts={[{ id: 1, message: 'OK', type: 'success' }]} />);
    expect(container.querySelector('.alert-success')).toBeInTheDocument();
  });

  it('applies alert-error class for error type', () => {
    const { container } = render(<Toast toasts={[{ id: 1, message: 'Err', type: 'error' }]} />);
    expect(container.querySelector('.alert-error')).toBeInTheDocument();
  });

  it('applies alert-info class for info type', () => {
    const { container } = render(<Toast toasts={[{ id: 1, message: 'Info', type: 'info' }]} />);
    expect(container.querySelector('.alert-info')).toBeInTheDocument();
  });

  it('uses check-circle icon for success type', () => {
    const { container } = render(<Toast toasts={[{ id: 1, message: 'OK', type: 'success' }]} />);
    expect(container.querySelector('.bi-check-circle')).toBeInTheDocument();
  });

  it('uses x-circle icon for error type', () => {
    const { container } = render(<Toast toasts={[{ id: 1, message: 'Err', type: 'error' }]} />);
    expect(container.querySelector('.bi-x-circle')).toBeInTheDocument();
  });

  it('uses info-circle icon for info type', () => {
    const { container } = render(<Toast toasts={[{ id: 1, message: 'Info', type: 'info' }]} />);
    expect(container.querySelector('.bi-info-circle')).toBeInTheDocument();
  });

  it('falls back to info-circle icon for an unknown type', () => {
    const { container } = render(<Toast toasts={[{ id: 1, message: 'Hmm', type: 'warning' }]} />);
    expect(container.querySelector('.bi-info-circle')).toBeInTheDocument();
  });

  it('renders inside a #toast container', () => {
    const { container } = render(<Toast toasts={[{ id: 1, message: 'Hi', type: 'info' }]} />);
    expect(container.querySelector('#toast')).toBeInTheDocument();
  });
});
