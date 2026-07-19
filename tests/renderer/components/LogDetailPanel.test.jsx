// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/renderer/components/utilities/Tooltip.jsx', () => ({
  default: ({ children }) => children,
}));

import LogDetailPanel from '../../../src/renderer/components/LogDetailPanel.jsx';
import { I18nContext } from '../../../src/renderer/js/i18nContext.js';

const t = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);

const BASE_ENTRY = {
  hostname: 'myapp.local',
  path: '/api/users?debug=true',
  method: 'GET',
  status: 200,
  https: false,
  websocket: false,
  timestamp: Date.now(),
  latencyMs: 42,
};

function renderPanel(props = {}) {
  const defaults = {
    entry: BASE_ENTRY,
    settings: { logHeadersEnabled: false, logBodyEnabled: false },
    detailTab: 'general',
    setDetailTab: vi.fn(),
    onClose: vi.fn(),
    onConvertToMock: vi.fn(),
    t,
  };
  return render(
    <I18nContext value={t}>
      <LogDetailPanel {...defaults} {...props} />
    </I18nContext>
  );
}

describe('LogDetailPanel — tab bar', () => {
  it('renders all four tabs', () => {
    renderPanel();
    expect(screen.getByText('log.detail.general')).toBeInTheDocument();
    expect(screen.getByText('log.detail.queryParams')).toBeInTheDocument();
    expect(screen.getByText('log.detail.headers')).toBeInTheDocument();
    expect(screen.getByText('log.detail.response')).toBeInTheDocument();
  });

  it('marks the current detailTab as active', () => {
    renderPanel({ detailTab: 'headers' });
    expect(screen.getByText('log.detail.headers')).toHaveClass('active');
    expect(screen.getByText('log.detail.general')).not.toHaveClass('active');
  });

  it('calls setDetailTab with the clicked tab name', () => {
    const setDetailTab = vi.fn();
    renderPanel({ setDetailTab });
    fireEvent.click(screen.getByText('log.detail.response'));
    expect(setDetailTab).toHaveBeenCalledWith('response');
  });
});

describe('LogDetailPanel — close and convert actions', () => {
  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    fireEvent.click(screen.getByLabelText('log.detail.close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onConvertToMock with the entry when clicked', () => {
    const onConvertToMock = vi.fn();
    renderPanel({ onConvertToMock });
    fireEvent.click(screen.getByLabelText('log.actions.convertToMock'));
    expect(onConvertToMock).toHaveBeenCalledWith(BASE_ENTRY);
  });

  it('disables convert-to-mock for websocket entries', () => {
    renderPanel({ entry: { ...BASE_ENTRY, websocket: true } });
    expect(screen.getByLabelText('log.actions.convertToMock')).toBeDisabled();
  });

  it('disables convert-to-mock when the entry has no status (still pending)', () => {
    renderPanel({ entry: { ...BASE_ENTRY, status: null } });
    expect(screen.getByLabelText('log.actions.convertToMock')).toBeDisabled();
  });

  it('enables convert-to-mock for a completed non-websocket entry', () => {
    renderPanel({ entry: { ...BASE_ENTRY, status: 200, websocket: false } });
    expect(screen.getByLabelText('log.actions.convertToMock')).not.toBeDisabled();
  });
});

describe('LogDetailPanel — general tab', () => {
  it('renders the request URL, method, and protocol', () => {
    renderPanel({ detailTab: 'general' });
    expect(screen.getByText('http://myapp.local/api/users?debug=true')).toBeInTheDocument();
    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.getByText('HTTP')).toBeInTheDocument();
  });

  it('renders https and websocket in the protocol cell', () => {
    renderPanel({ detailTab: 'general', entry: { ...BASE_ENTRY, https: true, websocket: true } });
    expect(screen.getByText('HTTPS (WebSocket)')).toBeInTheDocument();
  });

  it('shows the status code with an error message when present', () => {
    renderPanel({ detailTab: 'general', entry: { ...BASE_ENTRY, status: null, error: 'ECONNREFUSED' } });
    expect(screen.getByText('ECONNREFUSED')).toBeInTheDocument();
  });

  it('shows a dash when latency is not available', () => {
    renderPanel({ detailTab: 'general', entry: { ...BASE_ENTRY, latencyMs: null } });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows latency in milliseconds when available', () => {
    renderPanel({ detailTab: 'general', entry: { ...BASE_ENTRY, latencyMs: 123 } });
    expect(screen.getByText('123 ms')).toBeInTheDocument();
  });
});

describe('LogDetailPanel — query params tab', () => {
  it('shows an empty state when there is no query string', () => {
    renderPanel({ detailTab: 'queryParams', entry: { ...BASE_ENTRY, path: '/api/users' } });
    expect(screen.getByText('log.details.noQueryParams')).toBeInTheDocument();
  });

  it('renders each query parameter as a row', () => {
    renderPanel({ detailTab: 'queryParams', entry: { ...BASE_ENTRY, path: '/api/users?debug=true&limit=10' } });
    expect(screen.getByText('debug')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('limit')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});

describe('LogDetailPanel — headers tab', () => {
  it('shows a hint instead of headers when logHeadersEnabled is false', () => {
    renderPanel({ detailTab: 'headers', settings: { logHeadersEnabled: false } });
    expect(screen.getByText('log.detail.enableHeaders')).toBeInTheDocument();
  });

  it('shows an empty state when there are no captured headers', () => {
    renderPanel({ detailTab: 'headers', settings: { logHeadersEnabled: true }, entry: { ...BASE_ENTRY } });
    expect(screen.getAllByText('log.details.noHeaders')).toHaveLength(2);
  });

  it('renders request and response headers when present', () => {
    renderPanel({
      detailTab: 'headers',
      settings: { logHeadersEnabled: true },
      entry: {
        ...BASE_ENTRY,
        requestHeaders: { 'content-type': 'application/json' },
        responseHeaders: { 'set-cookie': ['a=1', 'b=2'] },
      },
    });
    expect(screen.getByText('content-type')).toBeInTheDocument();
    expect(screen.getByText('application/json')).toBeInTheDocument();
    expect(screen.getByText('set-cookie')).toBeInTheDocument();
    expect(screen.getByText('a=1, b=2')).toBeInTheDocument();
  });
});

describe('LogDetailPanel — response tab', () => {
  it('shows a hint instead of bodies when logBodyEnabled is false', () => {
    renderPanel({ detailTab: 'response', settings: { logBodyEnabled: false } });
    expect(screen.getByText('log.detail.enableBody')).toBeInTheDocument();
  });

  it('shows a "no body" state when the body was not captured', () => {
    renderPanel({ detailTab: 'response', settings: { logBodyEnabled: true }, entry: { ...BASE_ENTRY } });
    expect(screen.getAllByText('log.details.noBody')).toHaveLength(2);
  });

  it('shows an "empty body" state when the body is an empty string', () => {
    renderPanel({
      detailTab: 'response',
      settings: { logBodyEnabled: true },
      entry: { ...BASE_ENTRY, requestBody: '', responseBody: '' },
    });
    expect(screen.getAllByText('log.details.emptyBody')).toHaveLength(2);
  });

  it('renders captured body content', () => {
    renderPanel({
      detailTab: 'response',
      settings: { logBodyEnabled: true },
      entry: { ...BASE_ENTRY, requestBody: '{"a":1}', responseBody: '{"ok":true}' },
    });
    expect(screen.getByText('{"a":1}')).toBeInTheDocument();
    expect(screen.getByText('{"ok":true}')).toBeInTheDocument();
  });

  it('shows a truncation notice when the body was truncated', () => {
    renderPanel({
      detailTab: 'response',
      settings: { logBodyEnabled: true },
      entry: { ...BASE_ENTRY, requestBody: 'partial...', requestBodyTruncated: true },
    });
    expect(screen.getByText('log.details.truncated:{"size":64}')).toBeInTheDocument();
  });
});
