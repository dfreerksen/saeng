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

describe('LogView — request/response details', () => {
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

  it('does not render a details column when header/body logging is disabled', () => {
    const { container } = renderLogView({
      entries: [ENTRY_WITH_DETAILS],
      settings: { logHeadersEnabled: false, logBodyEnabled: false },
    });
    expect(container.querySelector('.log-details-toggle')).not.toBeInTheDocument();
  });

  it('renders a details toggle when header logging is enabled and the entry has captured headers', () => {
    const { container } = renderLogView({
      entries: [ENTRY_WITH_DETAILS],
      settings: { logHeadersEnabled: true, logBodyEnabled: false },
    });
    expect(container.querySelector('.log-details-toggle')).toBeInTheDocument();
  });

  it('does not render a details toggle for entries without captured details', () => {
    const { container } = renderLogView({
      entries: SAMPLE_ENTRIES,
      settings: { logHeadersEnabled: true, logBodyEnabled: true },
    });
    expect(container.querySelector('.log-details-toggle')).not.toBeInTheDocument();
  });

  it('expands to show request/response headers and bodies when the toggle is clicked', () => {
    const { container } = renderLogView({
      entries: [ENTRY_WITH_DETAILS],
      settings: { logHeadersEnabled: true, logBodyEnabled: true },
    });

    expect(container.querySelector('.log-details-row')).not.toBeInTheDocument();

    fireEvent.click(container.querySelector('.log-details-toggle'));

    const detailsRow = container.querySelector('.log-details-row');
    expect(detailsRow).toBeInTheDocument();
    expect(screen.getAllByText('application/json')).toHaveLength(2);
    expect(screen.getByText('{"user":"alice"}')).toBeInTheDocument();
    expect(screen.getByText('{"ok":true}')).toBeInTheDocument();
  });

  it('collapses the details row when the toggle is clicked again', () => {
    const { container } = renderLogView({
      entries: [ENTRY_WITH_DETAILS],
      settings: { logHeadersEnabled: true, logBodyEnabled: true },
    });

    const toggle = container.querySelector('.log-details-toggle');
    fireEvent.click(toggle);
    expect(container.querySelector('.log-details-row')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(container.querySelector('.log-details-row')).not.toBeInTheDocument();
  });

  it('shows a truncated notice when a body was truncated', () => {
    const { container } = renderLogView({
      entries: [{ ...ENTRY_WITH_DETAILS, responseBodyTruncated: true }],
      settings: { logHeadersEnabled: false, logBodyEnabled: true },
    });

    fireEvent.click(container.querySelector('.log-details-toggle'));
    expect(screen.getByText('log.details.truncated')).toBeInTheDocument();
  });

  it('shows a placeholder when no headers were captured for an entry', () => {
    const { container } = renderLogView({
      entries: [{ ...ENTRY_WITH_DETAILS, requestHeaders: undefined, responseHeaders: undefined }],
      settings: { logHeadersEnabled: true, logBodyEnabled: false },
    });

    fireEvent.click(container.querySelector('.log-details-toggle'));
    expect(screen.getAllByText('log.details.noHeaders')).toHaveLength(2);
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
