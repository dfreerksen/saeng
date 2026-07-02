// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Titlebar from '../../../../src/renderer/components/layout/Titlebar.jsx';

const t = (key) => key;

beforeEach(() => {
  window.electronAPI = { app: { openExternal: vi.fn() } };
});

describe('Titlebar', () => {
  it('renders the app name', () => {
    render(<Titlebar proxyRunning={false} t={t} />);
    expect(screen.getByText('application.name')).toBeInTheDocument();
  });

  it('delegates the app name to the t() function', () => {
    const customT = vi.fn((key) => `[${key}]`);
    render(<Titlebar proxyRunning={false} t={customT} />);
    expect(customT).toHaveBeenCalledWith('application.name');
    expect(screen.getByText('[application.name]')).toBeInTheDocument();
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

  it('adds running class to status-pill when proxy is running', () => {
    const { container } = render(<Titlebar proxyRunning={true} t={t} />);
    expect(container.querySelector('.status-pill')).toHaveClass('running');
  });

  it('does not add running class to status-pill when proxy is not running', () => {
    const { container } = render(<Titlebar proxyRunning={false} t={t} />);
    expect(container.querySelector('.status-pill')).not.toHaveClass('running');
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

  it('shows stop action title on status-pill when proxy is running', () => {
    const { container } = render(<Titlebar proxyRunning={true} t={t} />);
    expect(container.querySelector('.status-pill')).toHaveAttribute('title', 'proxy.action.stop');
  });

  it('shows start action title on status-pill when proxy is not running', () => {
    const { container } = render(<Titlebar proxyRunning={false} t={t} />);
    expect(container.querySelector('.status-pill')).toHaveAttribute('title', 'proxy.action.start');
  });

  it('calls onProxyToggle when status-pill is clicked', () => {
    const onProxyToggle = vi.fn();
    const { container } = render(<Titlebar proxyRunning={false} onProxyToggle={onProxyToggle} t={t} />);
    fireEvent.click(container.querySelector('.status-pill'));
    expect(onProxyToggle).toHaveBeenCalledOnce();
  });

  it('does not show an update badge when no update is available', () => {
    render(<Titlebar proxyRunning={false} updateInfo={{ updateAvailable: false }} t={t} />);
    expect(screen.queryByText('update.available')).not.toBeInTheDocument();
  });

  it('shows an update badge when an update is available', () => {
    const updateInfo = { updateAvailable: true, latestVersion: '1.7.0', url: 'https://github.com/dfreerksen/saeng/releases/tag/v1.7.0' };
    render(<Titlebar proxyRunning={false} updateInfo={updateInfo} t={t} />);
    expect(screen.getByText('update.available')).toBeInTheDocument();
  });

  it('opens the release URL when the update badge is clicked', () => {
    const updateInfo = { updateAvailable: true, latestVersion: '1.7.0', url: 'https://github.com/dfreerksen/saeng/releases/tag/v1.7.0' };
    render(<Titlebar proxyRunning={false} updateInfo={updateInfo} t={t} />);

    fireEvent.click(screen.getByText('update.available'));
    expect(window.electronAPI.app.openExternal).toHaveBeenCalledWith(updateInfo.url);
  });
});
