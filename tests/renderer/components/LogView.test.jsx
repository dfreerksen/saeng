// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LogView from '../../../src/renderer/components/LogView.jsx';

const t = (key) => key;

const SAMPLE_ENTRIES = [
  {
    id: '1',
    timestamp: 1700000000000,
    method: 'GET',
    hostname: 'myapp.local',
    path: '/',
    status: 200,
    latencyMs: 12,
    https: false,
  },
  {
    id: '2',
    timestamp: 1700000001000,
    method: 'POST',
    hostname: 'api.myapp.local',
    path: '/users',
    status: 500,
    latencyMs: 340,
    https: true,
    error: 'connect ECONNREFUSED 127.0.0.1:9999',
  },
  {
    id: '3',
    timestamp: 1700000002000,
    method: 'GET',
    hostname: 'myapp.local',
    path: '/pending',
    status: null,
    latencyMs: null,
    https: false,
  },
];

function renderLogView(props = {}) {
  const defaults = {
    active: true,
    entries: [],
    onClear: vi.fn(),
    onExportHar: vi.fn(),
    t,
  };
  return render(<LogView {...defaults} {...props} />);
}

describe('LogView — empty state', () => {
  it('shows the empty state element when there are no entries', () => {
    renderLogView({ entries: [] });
    expect(screen.getByText('log.empty')).toBeInTheDocument();
    expect(screen.getByText('log.emptyHint')).toBeInTheDocument();
  });

  it('does not render the log table when there are no entries', () => {
    const { container } = renderLogView({ entries: [] });
    expect(container.querySelector('#logTable')).not.toBeInTheDocument();
  });

  it('disables the clear button when there are no entries', () => {
    renderLogView({ entries: [] });
    expect(screen.getByText('log.actions.clear').closest('button')).toBeDisabled();
  });

  it('disables the export HAR button when there are no entries', () => {
    renderLogView({ entries: [] });
    expect(screen.getByText('log.actions.exportHar').closest('button')).toBeDisabled();
  });
});

describe('LogView — table with entries', () => {
  it('renders a table row for each entry', () => {
    const { container } = renderLogView({ entries: SAMPLE_ENTRIES });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('renders the most recent entry first', () => {
    const { container } = renderLogView({ entries: SAMPLE_ENTRIES });
    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0]).toHaveTextContent('/pending');
    expect(rows[2]).toHaveTextContent('/');
  });

  it('displays the hostname and path for an entry', () => {
    renderLogView({ entries: SAMPLE_ENTRIES });
    expect(screen.getAllByText('myapp.local')).toHaveLength(2);
    expect(screen.getByText('/users')).toBeInTheDocument();
  });

  it('shows an https badge for https entries and an http badge otherwise', () => {
    renderLogView({ entries: SAMPLE_ENTRIES });
    const badges = screen.getAllByText(/^(GET|POST)$/);
    expect(badges[1]).toHaveClass('badge-https');
    expect(badges[2]).toHaveClass('badge-http');
  });

  it('applies status badge classes based on the status code', () => {
    renderLogView({ entries: SAMPLE_ENTRIES });
    expect(screen.getByText('200')).toHaveClass('badge-status-ok');
    expect(screen.getByText('500')).toHaveClass('badge-status-error');
  });

  it('shows the backend error message as a tooltip on the status badge when present', () => {
    renderLogView({ entries: SAMPLE_ENTRIES });
    expect(screen.getByText('500')).toHaveAttribute('title', 'connect ECONNREFUSED 127.0.0.1:9999');
  });

  it('does not set a tooltip on the status badge when there is no error', () => {
    renderLogView({ entries: SAMPLE_ENTRIES });
    expect(screen.getByText('200')).not.toHaveAttribute('title');
  });

  it('shows a placeholder for entries without a status or latency yet', () => {
    const { container } = renderLogView({ entries: [SAMPLE_ENTRIES[2]] });
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(container.querySelector('.badge-status-pending')).toHaveTextContent('—');
  });

  it('formats latency in milliseconds when present', () => {
    renderLogView({ entries: [SAMPLE_ENTRIES[0]] });
    expect(screen.getByText('12 ms')).toBeInTheDocument();
  });

  it('shows a MOCK badge for mocked entries', () => {
    renderLogView({ entries: [{ ...SAMPLE_ENTRIES[0], mocked: true }] });
    expect(screen.getByText('log.table.mock')).toHaveClass('badge-mock');
  });

  it('does not show a MOCK badge for non-mocked entries', () => {
    renderLogView({ entries: SAMPLE_ENTRIES });
    expect(screen.queryByText('log.table.mock')).not.toBeInTheDocument();
  });

  it('enables the clear button and calls onClear when clicked', () => {
    const onClear = vi.fn();
    renderLogView({ entries: SAMPLE_ENTRIES, onClear });
    const button = screen.getByText('log.actions.clear').closest('button');
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('enables the export HAR button and calls onExportHar when clicked', () => {
    const onExportHar = vi.fn();
    renderLogView({ entries: SAMPLE_ENTRIES, onExportHar });
    const button = screen.getByText('log.actions.exportHar').closest('button');
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onExportHar).toHaveBeenCalledOnce();
  });
});

describe('LogView — detail panel', () => {
  const ENTRY_WITH_DETAILS = {
    id: '4',
    timestamp: 1700000003000,
    method: 'POST',
    hostname: 'api.myapp.local',
    path: '/login',
    status: 200,
    latencyMs: 20,
    https: false,
    requestHeaders: { host: 'api.myapp.local', 'content-type': 'application/json' },
    responseHeaders: { 'content-type': 'application/json' },
    requestBody: '{"user":"alice"}',
    requestBodyTruncated: false,
    responseBody: '{"ok":true}',
    responseBodyTruncated: false,
  };

  it('does not show the detail panel initially', () => {
    const { container } = renderLogView({ entries: [ENTRY_WITH_DETAILS] });
    expect(container.querySelector('.log-detail-panel')).not.toBeInTheDocument();
  });

  it('shows the detail panel when a row is clicked', () => {
    const { container } = renderLogView({ entries: [ENTRY_WITH_DETAILS] });
    fireEvent.click(container.querySelector('.log-row'));
    expect(container.querySelector('.log-detail-panel')).toBeInTheDocument();
  });

  it('shows general info in the default tab', () => {
    const { container } = renderLogView({ entries: [ENTRY_WITH_DETAILS] });
    fireEvent.click(container.querySelector('.log-row'));
    expect(screen.getByText('http://api.myapp.local/login')).toBeInTheDocument();
  });

  it('shows request/response headers when the headers tab is clicked', () => {
    const { container } = renderLogView({
      entries: [ENTRY_WITH_DETAILS],
      settings: { logHeadersEnabled: true, logBodyEnabled: false },
    });
    fireEvent.click(container.querySelector('.log-row'));
    fireEvent.click(screen.getByText('log.detail.headers'));
    expect(screen.getAllByText('application/json')).toHaveLength(2);
  });

  it('shows request/response bodies when the response tab is clicked', () => {
    const { container } = renderLogView({
      entries: [ENTRY_WITH_DETAILS],
      settings: { logHeadersEnabled: false, logBodyEnabled: true },
    });
    fireEvent.click(container.querySelector('.log-row'));
    fireEvent.click(screen.getByText('log.detail.response'));
    expect(screen.getByText('{"user":"alice"}')).toBeInTheDocument();
    expect(screen.getByText('{"ok":true}')).toBeInTheDocument();
  });

  it('hides the detail panel when the same row is clicked again', () => {
    const { container } = renderLogView({ entries: [ENTRY_WITH_DETAILS] });
    fireEvent.click(container.querySelector('.log-row'));
    expect(container.querySelector('.log-detail-panel')).toBeInTheDocument();
    fireEvent.click(container.querySelector('.log-row'));
    expect(container.querySelector('.log-detail-panel')).not.toBeInTheDocument();
  });

  it('hides the detail panel when the close button is clicked', () => {
    const { container } = renderLogView({ entries: [ENTRY_WITH_DETAILS] });
    fireEvent.click(container.querySelector('.log-row'));
    fireEvent.click(container.querySelector('.log-detail-close'));
    expect(container.querySelector('.log-detail-panel')).not.toBeInTheDocument();
  });

  it('shows a truncated notice when a body was truncated', () => {
    const { container } = renderLogView({
      entries: [{ ...ENTRY_WITH_DETAILS, responseBodyTruncated: true }],
      settings: { logHeadersEnabled: false, logBodyEnabled: true },
    });
    fireEvent.click(container.querySelector('.log-row'));
    fireEvent.click(screen.getByText('log.detail.response'));
    expect(screen.getByText('log.details.truncated')).toBeInTheDocument();
  });

  it('shows a placeholder when no headers were captured for an entry', () => {
    const { container } = renderLogView({
      entries: [{ ...ENTRY_WITH_DETAILS, requestHeaders: undefined, responseHeaders: undefined }],
      settings: { logHeadersEnabled: true, logBodyEnabled: false },
    });
    fireEvent.click(container.querySelector('.log-row'));
    fireEvent.click(screen.getByText('log.detail.headers'));
    expect(screen.getAllByText('log.details.noHeaders')).toHaveLength(2);
  });

  it('shows an enable headers hint when header logging is disabled', () => {
    const { container } = renderLogView({
      entries: [ENTRY_WITH_DETAILS],
      settings: { logHeadersEnabled: false, logBodyEnabled: false },
    });
    fireEvent.click(container.querySelector('.log-row'));
    fireEvent.click(screen.getByText('log.detail.headers'));
    expect(screen.getByText('log.detail.enableHeaders')).toBeInTheDocument();
  });

  it('shows an enable body hint when body logging is disabled', () => {
    const { container } = renderLogView({
      entries: [ENTRY_WITH_DETAILS],
      settings: { logHeadersEnabled: false, logBodyEnabled: false },
    });
    fireEvent.click(container.querySelector('.log-row'));
    fireEvent.click(screen.getByText('log.detail.response'));
    expect(screen.getByText('log.detail.enableBody')).toBeInTheDocument();
  });
});

describe('LogView — filter bar', () => {
  const FILTER_ENTRIES = [
    {
      id: 'f1',
      timestamp: 1700000000000,
      method: 'GET',
      hostname: 'myapp.local',
      path: '/index.html',
      status: 200,
      latencyMs: 10,
      https: false,
      responseHeaders: { 'content-type': 'text/html' },
    },
    {
      id: 'f2',
      timestamp: 1700000001000,
      method: 'GET',
      hostname: 'myapp.local',
      path: '/app.js',
      status: 200,
      latencyMs: 5,
      https: false,
      responseHeaders: { 'content-type': 'application/javascript' },
    },
    {
      id: 'f3',
      timestamp: 1700000002000,
      method: 'GET',
      hostname: 'myapp.local',
      path: '/api/data',
      status: 200,
      latencyMs: 20,
      https: true,
      responseHeaders: {},
    },
  ];

  it('renders a button for every filter tab', () => {
    const { container } = renderLogView({ entries: FILTER_ENTRIES });
    const buttons = container.querySelectorAll('.log-filter-btn');
    expect(buttons).toHaveLength(14);
  });

  it('marks the "all" tab active by default', () => {
    const { container } = renderLogView({ entries: FILTER_ENTRIES });
    const active = container.querySelector('.log-filter-btn.active');
    expect(active).toHaveTextContent('log.filter.all');
  });

  it('moves the active class to the clicked tab', () => {
    const { container } = renderLogView({ entries: FILTER_ENTRIES });
    fireEvent.click(screen.getByText('log.filter.js'));
    expect(container.querySelector('.log-filter-btn.active')).toHaveTextContent('log.filter.js');
  });

  it('filters rows to only the matching entries', () => {
    const { container } = renderLogView({ entries: FILTER_ENTRIES });
    fireEvent.click(screen.getByText('log.filter.js'));
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(screen.getByText('/app.js')).toBeInTheDocument();
  });

  it('shows all entries when the "all" tab is active', () => {
    const { container } = renderLogView({ entries: FILTER_ENTRIES });
    fireEvent.click(screen.getByText('log.filter.js'));
    fireEvent.click(screen.getByText('log.filter.all'));
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('shows the filter empty state when no entries match the active filter', () => {
    renderLogView({ entries: FILTER_ENTRIES });
    fireEvent.click(screen.getByText('log.filter.ws'));
    expect(screen.getByText('log.filterEmpty')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('does not show the filter empty state when switching back to a matching filter', () => {
    renderLogView({ entries: FILTER_ENTRIES });
    fireEvent.click(screen.getByText('log.filter.ws'));
    fireEvent.click(screen.getByText('log.filter.all'));
    expect(screen.queryByText('log.filterEmpty')).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('filters other entries correctly', () => {
    const { container } = renderLogView({ entries: FILTER_ENTRIES });
    fireEvent.click(screen.getByText('log.filter.other'));
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(screen.getByText('/api/data')).toBeInTheDocument();
  });

  it('filters doc entries correctly', () => {
    const { container } = renderLogView({ entries: FILTER_ENTRIES });
    fireEvent.click(screen.getByText('log.filter.doc'));
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(screen.getByText('/index.html')).toBeInTheDocument();
  });
});

describe('LogView — active state', () => {
  it('applies the active class when active is true', () => {
    const { container } = renderLogView({ active: true });
    expect(container.querySelector('#view-log')).toHaveClass('active');
  });

  it('does not apply the active class when active is false', () => {
    const { container } = renderLogView({ active: false });
    expect(container.querySelector('#view-log')).not.toHaveClass('active');
  });
});
