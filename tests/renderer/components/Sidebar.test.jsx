// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from '../../../src/renderer/components/Sidebar.jsx';

const t = (key) => key;

function renderSidebar(props = {}) {
  const defaults = {
    currentView: 'mappings',
    setCurrentView: vi.fn(),
    loggingEnabled: true,
    onAbout: vi.fn(),
    t,
  };
  return render(<Sidebar {...defaults} {...props} />);
}

describe('Sidebar', () => {
  it('renders the dashboard nav item when dashboardEnabled is true', () => {
    renderSidebar({ dashboardEnabled: true });
    expect(screen.getByText('nav.dashboard')).toBeInTheDocument();
  });

  it('hides the dashboard nav item when dashboardEnabled is false', () => {
    renderSidebar({ dashboardEnabled: false });
    expect(screen.queryByText('nav.dashboard')).not.toBeInTheDocument();
  });

  it('renders the mappings nav item', () => {
    renderSidebar();
    expect(screen.getByText('nav.mappings')).toBeInTheDocument();
  });

  it('renders the mocks nav item', () => {
    renderSidebar();
    expect(screen.getByText('nav.mocks')).toBeInTheDocument();
  });

  it('renders the log nav item', () => {
    renderSidebar();
    expect(screen.getByText('nav.log')).toBeInTheDocument();
  });

  it('hides the log nav item when logging is disabled', () => {
    renderSidebar({ loggingEnabled: false });
    expect(screen.queryByText('nav.log')).not.toBeInTheDocument();
  });

  it('renders the settings nav item', () => {
    renderSidebar();
    expect(screen.getByText('nav.settings')).toBeInTheDocument();
  });

  it('renders the about nav item', () => {
    renderSidebar();
    expect(screen.getByText('nav.about')).toBeInTheDocument();
  });

  it('applies active class to dashboard button when currentView is dashboard', () => {
    const { container } = renderSidebar({ dashboardEnabled: true, currentView: 'dashboard' });
    const navItems = container.querySelectorAll('.nav-item');
    expect(navItems[0]).toHaveClass('active');
    expect(navItems[1]).not.toHaveClass('active');
  });

  it('applies active class to mappings button when currentView is mappings', () => {
    const { container } = renderSidebar({ currentView: 'mappings' });
    const navItems = container.querySelectorAll('.nav-item');
    expect(navItems[0]).toHaveClass('active');
    expect(navItems[1]).not.toHaveClass('active');
  });

  it('applies active class to mocks button when currentView is mocks', () => {
    const { container } = renderSidebar({ currentView: 'mocks' });
    const navItems = container.querySelectorAll('.nav-item');
    expect(navItems[0]).not.toHaveClass('active');
    expect(navItems[1]).toHaveClass('active');
    expect(navItems[2]).not.toHaveClass('active');
  });

  it('applies active class to log button when currentView is log', () => {
    const { container } = renderSidebar({ currentView: 'log' });
    const navItems = container.querySelectorAll('.nav-item');
    expect(navItems[0]).not.toHaveClass('active');
    expect(navItems[1]).not.toHaveClass('active');
    expect(navItems[2]).toHaveClass('active');
    expect(navItems[3]).not.toHaveClass('active');
  });

  it('applies active class to settings button when currentView is settings', () => {
    const { container } = renderSidebar({ currentView: 'settings' });
    const navItems = container.querySelectorAll('.nav-item');
    expect(navItems[0]).not.toHaveClass('active');
    expect(navItems[1]).not.toHaveClass('active');
    expect(navItems[2]).not.toHaveClass('active');
    expect(navItems[3]).toHaveClass('active');
  });

  it('calls setCurrentView("dashboard") when dashboard button is clicked', () => {
    const setCurrentView = vi.fn();
    renderSidebar({ dashboardEnabled: true, setCurrentView });
    fireEvent.click(screen.getByText('nav.dashboard').closest('button'));
    expect(setCurrentView).toHaveBeenCalledWith('dashboard');
  });

  it('calls setCurrentView("mappings") when mappings button is clicked', () => {
    const setCurrentView = vi.fn();
    renderSidebar({ setCurrentView });
    fireEvent.click(screen.getByText('nav.mappings').closest('button'));
    expect(setCurrentView).toHaveBeenCalledWith('mappings');
  });

  it('calls setCurrentView("mocks") when mocks button is clicked', () => {
    const setCurrentView = vi.fn();
    renderSidebar({ setCurrentView });
    fireEvent.click(screen.getByText('nav.mocks').closest('button'));
    expect(setCurrentView).toHaveBeenCalledWith('mocks');
  });

  it('calls setCurrentView("log") when log button is clicked', () => {
    const setCurrentView = vi.fn();
    renderSidebar({ setCurrentView });
    fireEvent.click(screen.getByText('nav.log').closest('button'));
    expect(setCurrentView).toHaveBeenCalledWith('log');
  });

  it('calls setCurrentView("settings") when settings button is clicked', () => {
    const setCurrentView = vi.fn();
    renderSidebar({ setCurrentView });
    fireEvent.click(screen.getByText('nav.settings').closest('button'));
    expect(setCurrentView).toHaveBeenCalledWith('settings');
  });

  it('calls onAbout when the about button is clicked', () => {
    const onAbout = vi.fn();
    renderSidebar({ onAbout });
    fireEvent.click(screen.getByText('nav.about').closest('button'));
    expect(onAbout).toHaveBeenCalledOnce();
  });

});
