// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: vi.fn(),
  LinearScale: vi.fn(),
  PointElement: vi.fn(),
  LineElement: vi.fn(),
  Tooltip: vi.fn(),
  Filler: vi.fn(),
}));

vi.mock('react-chartjs-2', () => ({
  Line: () => <canvas data-testid="chart" />,
}));

import DashboardView from '../../../src/renderer/components/DashboardView.jsx';

const t = (key) => key;

const SAMPLE_MAPPINGS = [
  { id: 'm1', domain: 'app.local', host: '127.0.0.1', port: 3000, https: false, enabled: true },
  { id: 'm2', domain: 'api.local', host: '127.0.0.1', port: 4000, https: false, enabled: true },
  { id: 'm3', domain: 'admin.local', host: '127.0.0.1', port: 5000, https: false, enabled: false },
];

const SAMPLE_MOCKS = [
  { id: 'mock1', mappingId: 'm1', method: 'GET', pathPattern: '^/api$', statusCode: 200, enabled: true },
  { id: 'mock2', mappingId: 'm1', method: 'POST', pathPattern: '^/api$', statusCode: 201, enabled: false },
  { id: 'mock3', mappingId: 'm2', method: '*', pathPattern: '^/$', statusCode: 200, enabled: true },
];

const SAMPLE_ENTRIES = [
  { id: 'e1', timestamp: Date.now(), method: 'GET', hostname: 'app.local', path: '/', status: 200, latencyMs: 10, https: false },
  { id: 'e2', timestamp: Date.now(), method: 'GET', hostname: 'app.local', path: '/fail', status: 500, latencyMs: 50, https: false },
];

function renderDashboard(props = {}) {
  const defaults = {
    entries: [],
    mappings: [],
    mocks: [],
    healthStatuses: {},
    settings: { loggingEnabled: true, healthCheckEnabled: false },
    proxyRunning: false,
    t,
  };
  return render(<DashboardView {...defaults} {...props} />);
}

describe('DashboardView — rendering', () => {
  it('renders the title', () => {
    renderDashboard();
    expect(screen.getByText('dashboard.title')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    renderDashboard();
    expect(screen.getByText('dashboard.subtitle')).toBeInTheDocument();
  });

  it('has the view-dashboard id', () => {
    const { container } = renderDashboard();
    expect(container.querySelector('#view-dashboard')).toBeInTheDocument();
  });
});

describe('DashboardView — logging stats', () => {
  it('shows total requests, error rate, and avg latency when logging is enabled', () => {
    renderDashboard({ entries: SAMPLE_ENTRIES, settings: { loggingEnabled: true } });
    expect(screen.getByText('dashboard.stats.totalRequests')).toBeInTheDocument();
    expect(screen.getByText('dashboard.stats.errorRate')).toBeInTheDocument();
    expect(screen.getByText('dashboard.stats.avgLatency')).toBeInTheDocument();
  });

  it('hides total requests, error rate, and avg latency when logging is disabled', () => {
    renderDashboard({ settings: { loggingEnabled: false } });
    expect(screen.queryByText('dashboard.stats.totalRequests')).not.toBeInTheDocument();
    expect(screen.queryByText('dashboard.stats.errorRate')).not.toBeInTheDocument();
    expect(screen.queryByText('dashboard.stats.avgLatency')).not.toBeInTheDocument();
  });

  it('displays the correct total request count', () => {
    renderDashboard({ entries: SAMPLE_ENTRIES });
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays the correct error rate', () => {
    renderDashboard({ entries: SAMPLE_ENTRIES });
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('applies danger class when error rate is above zero', () => {
    const { container } = renderDashboard({ entries: SAMPLE_ENTRIES });
    expect(container.querySelector('.dashboard-stat-value--danger')).toBeInTheDocument();
  });

  it('does not apply danger class when error rate is zero', () => {
    const entries = [{ ...SAMPLE_ENTRIES[0] }];
    const { container } = renderDashboard({ entries });
    expect(container.querySelector('.dashboard-stat-value--danger')).not.toBeInTheDocument();
  });

  it('displays the correct avg latency', () => {
    renderDashboard({ entries: SAMPLE_ENTRIES });
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('displays zero avg latency when there are no entries', () => {
    renderDashboard({ entries: [] });
    const label = screen.getByText('dashboard.stats.avgLatency');
    const card = label.closest('.dashboard-stat-card');
    expect(card.querySelector('.dashboard-stat-value')).toHaveTextContent('0');
  });
});

describe('DashboardView — health stats', () => {
  it('shows domains up and down when health checks are enabled and proxy is running', () => {
    renderDashboard({
      settings: { healthCheckEnabled: true },
      proxyRunning: true,
      healthStatuses: { 1: { status: 'up' }, 2: { status: 'down' } },
    });
    expect(screen.getByText('dashboard.stats.domainsUp')).toBeInTheDocument();
    expect(screen.getByText('dashboard.stats.domainsDown')).toBeInTheDocument();
  });

  it('hides domains up and down when health checks are disabled', () => {
    renderDashboard({ settings: { healthCheckEnabled: false }, proxyRunning: true });
    expect(screen.queryByText('dashboard.stats.domainsUp')).not.toBeInTheDocument();
    expect(screen.queryByText('dashboard.stats.domainsDown')).not.toBeInTheDocument();
  });

  it('hides domains up and down when proxy is not running', () => {
    renderDashboard({ settings: { healthCheckEnabled: true }, proxyRunning: false });
    expect(screen.queryByText('dashboard.stats.domainsUp')).not.toBeInTheDocument();
    expect(screen.queryByText('dashboard.stats.domainsDown')).not.toBeInTheDocument();
  });

  it('counts domains up and down correctly', () => {
    const { container } = renderDashboard({
      settings: { healthCheckEnabled: true },
      proxyRunning: true,
      healthStatuses: {
        1: { status: 'up' },
        2: { status: 'up' },
        3: { status: 'down' },
      },
    });
    const successValue = container.querySelector('.dashboard-stat-value--success');
    expect(successValue).toHaveTextContent('2');
  });
});

describe('DashboardView — mapping and mock counts', () => {
  it('displays the correct active mappings count', () => {
    renderDashboard({ mappings: SAMPLE_MAPPINGS, settings: { loggingEnabled: false } });
    const labels = screen.getAllByText('dashboard.stats.activeMappings');
    const card = labels[0].closest('.dashboard-stat-card');
    expect(card.querySelector('.dashboard-stat-value')).toHaveTextContent('2');
  });

  it('displays the correct disabled mappings count', () => {
    renderDashboard({ mappings: SAMPLE_MAPPINGS, settings: { loggingEnabled: false } });
    const labels = screen.getAllByText('dashboard.stats.disabledMappings');
    const card = labels[0].closest('.dashboard-stat-card');
    expect(card.querySelector('.dashboard-stat-value')).toHaveTextContent('1');
  });

  it('displays the correct active mocks count', () => {
    renderDashboard({ mocks: SAMPLE_MOCKS, settings: { loggingEnabled: false } });
    const labels = screen.getAllByText('dashboard.stats.activeMocks');
    const card = labels[0].closest('.dashboard-stat-card');
    expect(card.querySelector('.dashboard-stat-value')).toHaveTextContent('2');
  });

  it('displays the correct disabled mocks count', () => {
    renderDashboard({ mocks: SAMPLE_MOCKS, settings: { loggingEnabled: false } });
    const labels = screen.getAllByText('dashboard.stats.disabledMocks');
    const card = labels[0].closest('.dashboard-stat-card');
    expect(card.querySelector('.dashboard-stat-value')).toHaveTextContent('1');
  });

  it('shows zero active mappings when all are disabled', () => {
    const mappings = [{ ...SAMPLE_MAPPINGS[2] }];
    renderDashboard({ mappings, settings: { loggingEnabled: false } });
    const labels = screen.getAllByText('dashboard.stats.activeMappings');
    const card = labels[0].closest('.dashboard-stat-card');
    expect(card.querySelector('.dashboard-stat-value')).toHaveTextContent('0');
  });
});

describe('DashboardView — charts', () => {
  it('renders three charts when logging is enabled', () => {
    const { container } = renderDashboard({ settings: { loggingEnabled: true } });
    expect(container.querySelectorAll('[data-testid="chart"]')).toHaveLength(3);
    expect(screen.getByText('dashboard.charts.requestsPerMin')).toBeInTheDocument();
    expect(screen.getByText('dashboard.charts.errorRate')).toBeInTheDocument();
    expect(screen.getByText('dashboard.charts.latency')).toBeInTheDocument();
  });

  it('hides charts when logging is disabled', () => {
    const { container } = renderDashboard({ settings: { loggingEnabled: false } });
    expect(container.querySelectorAll('[data-testid="chart"]')).toHaveLength(0);
    expect(screen.queryByText('dashboard.charts.requestsPerMin')).not.toBeInTheDocument();
  });
});

describe('DashboardView — groups', () => {
  it('renders mapping groups with counts', () => {
    renderDashboard({ mappings: SAMPLE_MAPPINGS });
    expect(screen.getByText('dashboard.groups.mappings')).toBeInTheDocument();
    expect(screen.getByText('app.local')).toBeInTheDocument();
    expect(screen.getByText('api.local')).toBeInTheDocument();
    expect(screen.getByText('admin.local')).toBeInTheDocument();
  });

  it('renders mock groups with counts', () => {
    renderDashboard({ mappings: SAMPLE_MAPPINGS, mocks: SAMPLE_MOCKS });
    expect(screen.getByText('dashboard.groups.mocks')).toBeInTheDocument();
  });

  it('shows empty message when there are no mappings', () => {
    renderDashboard({ mappings: [] });
    const empties = screen.getAllByText('dashboard.groups.empty');
    expect(empties.length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty message when there are no mocks', () => {
    renderDashboard({ mocks: [] });
    const empties = screen.getAllByText('dashboard.groups.empty');
    expect(empties.length).toBeGreaterThanOrEqual(1);
  });
});
