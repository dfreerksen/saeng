import { memo, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { splitDomain } from '../js/utils.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, Filler);

const BUCKET_MINUTES = 30;

function computeTimeSeries(entries) {
  const now = Date.now();
  const cutoff = now - BUCKET_MINUTES * 60000;

  const bucketData = new Array(BUCKET_MINUTES);
  const labels = new Array(BUCKET_MINUTES);
  for (let i = 0; i < BUCKET_MINUTES; i++) {
    bucketData[i] = { count: 0, errors: 0, totalLatency: 0 };
    const d = new Date(cutoff + (i + 1) * 60000);
    labels[i] = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  for (const entry of entries) {
    if (entry.timestamp < cutoff) continue;
    const idx = Math.min(BUCKET_MINUTES - 1, Math.floor((entry.timestamp - cutoff) / 60000));
    bucketData[idx].count++;
    if (entry.status >= 400 || entry.error) bucketData[idx].errors++;
    if (entry.latencyMs) bucketData[idx].totalLatency += entry.latencyMs;
  }

  return {
    labels,
    requestsPerMin: bucketData.map((b) => b.count),
    errorRate: bucketData.map((b) => (b.count > 0 ? Math.round((b.errors / b.count) * 100) : 0)),
    avgLatency: bucketData.map((b) => (b.count > 0 ? Math.round(b.totalLatency / b.count) : 0)),
  };
}

function buildChartOptions(textColor, gridColor) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { color: textColor, maxTicksLimit: 8, font: { size: 11 } },
        grid: { color: gridColor },
      },
      y: {
        beginAtZero: true,
        ticks: { color: textColor, font: { size: 11 } },
        grid: { color: gridColor },
      },
    },
    elements: {
      point: { radius: 0, hitRadius: 10 },
      line: { tension: 0.3, borderWidth: 2 },
    },
  };
}

export default memo(function DashboardView({ entries, mappings, mocks, healthStatuses, settings, proxyRunning, t }) {
  const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
  const textColor = isDark ? '#a8a29e' : '#57534e';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const loggingEnabled = !!settings.loggingEnabled;

  const timeSeries = useMemo(() => computeTimeSeries(entries), [entries]);

  const totalRequests = entries.length;
  const errorCount = useMemo(() => entries.filter((e) => e.status >= 400 || e.error).length, [entries]);
  const errorRate = totalRequests > 0 ? Math.round((errorCount / totalRequests) * 100) : 0;
  const avgLatency = useMemo(() => {
    if (entries.length === 0) return 0;
    const sum = entries.reduce((acc, e) => acc + (e.latencyMs || 0), 0);
    return Math.round(sum / entries.length);
  }, [entries]);

  const healthEnabled = settings.healthCheckEnabled && proxyRunning;
  const { domainsUp, domainsDown } = useMemo(() => {
    if (!healthEnabled) return { domainsUp: 0, domainsDown: 0 };
    let up = 0;
    let down = 0;
    for (const status of Object.values(healthStatuses)) {
      if (status.status === 'up') up++;
      else down++;
    }
    return { domainsUp: up, domainsDown: down };
  }, [healthStatuses, healthEnabled]);

  const domainsDisabled = useMemo(() => mappings.filter((m) => !m.enabled).length, [mappings]);
  const mocksDisabled = useMemo(() => mocks.filter((m) => !m.enabled).length, [mocks]);

  const mappingGroups = useMemo(() => {
    const groups = {};
    for (const m of mappings) {
      const { domain, suffix } = splitDomain(m.domain);
      const key = domain + suffix;
      groups[key] = (groups[key] || 0) + 1;
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [mappings]);

  const mockGroups = useMemo(() => {
    const mappingById = new Map(mappings.map((m) => [m.id, m]));
    const groups = {};
    for (const mock of mocks) {
      const mapping = mappingById.get(mock.mappingId);
      if (!mapping) continue;
      const { domain, suffix } = splitDomain(mapping.domain);
      const key = domain + suffix;
      groups[key] = (groups[key] || 0) + 1;
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [mocks, mappings]);

  const chartOptions = useMemo(() => buildChartOptions(textColor, gridColor), [textColor, gridColor]);

  const requestsChartData = {
    labels: timeSeries.labels,
    datasets: [{
      data: timeSeries.requestsPerMin,
      borderColor: '#4c67e0',
      backgroundColor: 'rgba(76, 103, 224, 0.1)',
      fill: true,
    }],
  };

  const errorChartData = {
    labels: timeSeries.labels,
    datasets: [{
      data: timeSeries.errorRate,
      borderColor: '#dc3545',
      backgroundColor: 'rgba(220, 53, 69, 0.1)',
      fill: true,
    }],
  };

  const latencyChartData = {
    labels: timeSeries.labels,
    datasets: [{
      data: timeSeries.avgLatency,
      borderColor: '#198754',
      backgroundColor: 'rgba(25, 135, 84, 0.1)',
      fill: true,
    }],
  };

  return (
    <div className="view active" id="view-dashboard">
      <header className="container-fluid p-0 mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="m-0">
              <i className="bi bi-speedometer2 me-2" />
              {t('dashboard.title')}
            </h4>
            <h6 className="subtitle">{t('dashboard.subtitle')}</h6>
          </div>
        </div>
      </header>

      <div className="dashboard-stats">
        {loggingEnabled && (
          <>
            <div className="dashboard-stat-card">
              <div className="dashboard-stat-value">{totalRequests}</div>
              <div className="dashboard-stat-label">{t('dashboard.stats.totalRequests')}</div>
            </div>
            <div className="dashboard-stat-card">
              <div className={`dashboard-stat-value${errorRate > 0 ? ' dashboard-stat-value--danger' : ''}`}>
                {errorRate}%
              </div>
              <div className="dashboard-stat-label">{t('dashboard.stats.errorRate')}</div>
            </div>
            <div className="dashboard-stat-card">
              <div className="dashboard-stat-value">
                {avgLatency}<span className="dashboard-stat-unit">ms</span>
              </div>
              <div className="dashboard-stat-label">{t('dashboard.stats.avgLatency')}</div>
            </div>
          </>
        )}
        {healthEnabled && (
          <>
            <div className="dashboard-stat-card">
              <div className="dashboard-stat-value dashboard-stat-value--success">{domainsUp}</div>
              <div className="dashboard-stat-label">{t('dashboard.stats.domainsUp')}</div>
            </div>
            <div className="dashboard-stat-card">
              <div className={`dashboard-stat-value${domainsDown > 0 ? ' dashboard-stat-value--danger' : ''}`}>
                {domainsDown}
              </div>
              <div className="dashboard-stat-label">{t('dashboard.stats.domainsDown')}</div>
            </div>
          </>
        )}
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-value">{mappings.length - domainsDisabled}</div>
          <div className="dashboard-stat-label">{t('dashboard.stats.activeMappings')}</div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-value">{domainsDisabled}</div>
          <div className="dashboard-stat-label">{t('dashboard.stats.disabledMappings')}</div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-value">{mocks.length - mocksDisabled}</div>
          <div className="dashboard-stat-label">{t('dashboard.stats.activeMocks')}</div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-value">{mocksDisabled}</div>
          <div className="dashboard-stat-label">{t('dashboard.stats.disabledMocks')}</div>
        </div>
      </div>

      {loggingEnabled && (
        <div className="dashboard-charts">
          <div className="dashboard-chart-card">
            <div className="dashboard-chart-title">{t('dashboard.charts.requestsPerMin')}</div>
            <div className="dashboard-chart-body">
              {totalRequests === 0 ? (
                <div className="dashboard-chart-empty">{t('dashboard.charts.empty')}</div>
              ) : (
                <Line data={requestsChartData} options={chartOptions} />
              )}
            </div>
          </div>
          <div className="dashboard-chart-card">
            <div className="dashboard-chart-title">{t('dashboard.charts.errorRate')}</div>
            <div className="dashboard-chart-body">
              {totalRequests === 0 ? (
                <div className="dashboard-chart-empty">{t('dashboard.charts.empty')}</div>
              ) : (
                <Line data={errorChartData} options={chartOptions} />
              )}
            </div>
          </div>
          <div className="dashboard-chart-card">
            <div className="dashboard-chart-title">{t('dashboard.charts.latency')}</div>
            <div className="dashboard-chart-body">
              {totalRequests === 0 ? (
                <div className="dashboard-chart-empty">{t('dashboard.charts.empty')}</div>
              ) : (
                <Line data={latencyChartData} options={chartOptions} />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-groups">
        <div className="dashboard-group-card">
          <div className="dashboard-group-title">{t('dashboard.groups.mappings')}</div>
          {mappingGroups.length === 0 ? (
            <div className="dashboard-group-empty">{t('dashboard.groups.empty')}</div>
          ) : (
            mappingGroups.map(([group, count]) => (
              <div className="dashboard-group-row" key={group}>
                <span>{group}</span>
                <span className="dashboard-group-count">{count}</span>
              </div>
            ))
          )}
        </div>
        <div className="dashboard-group-card">
          <div className="dashboard-group-title">{t('dashboard.groups.mocks')}</div>
          {mockGroups.length === 0 ? (
            <div className="dashboard-group-empty">{t('dashboard.groups.empty')}</div>
          ) : (
            mockGroups.map(([group, count]) => (
              <div className="dashboard-group-row" key={group}>
                <span>{group}</span>
                <span className="dashboard-group-count">{count}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});
