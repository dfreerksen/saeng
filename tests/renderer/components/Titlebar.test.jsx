// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Titlebar from '../../../src/renderer/components/Titlebar.jsx';

const t = (key) => key;

describe('Titlebar', () => {
  it('renders the app name', () => {
    render(<Titlebar proxyRunning={false} t={t} />);
    expect(screen.getByText('Saeng')).toBeInTheDocument();
  });

  it('shows stopped status dot when proxy is not running', () => {
    const { container } = render(<Titlebar proxyRunning={false} t={t} />);
    expect(container.querySelector('.status-dot')).toHaveClass('stopped');
    expect(container.querySelector('.status-dot')).not.toHaveClass('running');
  });

  it('shows running status dot when proxy is running', () => {
    const { container } = render(<Titlebar proxyRunning={true} t={t} />);
    expect(container.querySelector('.status-dot')).toHaveClass('running');
    expect(container.querySelector('.status-dot')).not.toHaveClass('stopped');
  });

  it('shows stopped status text when proxy is not running', () => {
    render(<Titlebar proxyRunning={false} t={t} />);
    expect(screen.getByText('proxy.status.stopped')).toBeInTheDocument();
  });

  it('shows running status text when proxy is running', () => {
    render(<Titlebar proxyRunning={true} t={t} />);
    expect(screen.getByText('proxy.status.running')).toBeInTheDocument();
  });

  it('delegates status text to the t() function', () => {
    const customT = vi.fn((key) => `[${key}]`);
    render(<Titlebar proxyRunning={false} t={customT} />);
    expect(customT).toHaveBeenCalledWith('proxy.status.stopped');
    expect(screen.getByText('[proxy.status.stopped]')).toBeInTheDocument();
  });
});
