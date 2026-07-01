# Logs

The Logs view shows a live record of every request that has passed through Saeng's proxy, making it easy to inspect traffic, diagnose routing issues, and export data for further analysis.

## Enabling Logging

Logging is controlled by **Settings → Logging**. When disabled, no new entries are recorded (existing entries are kept). When re-enabled, recording resumes immediately without restarting the proxy.

The log is a ring buffer — once the entry count reaches the configured maximum (**Settings → Log Max Entries**, default 300), the oldest entries are dropped. The maximum can be adjusted in Settings.

## Viewing Logs

Open the **Logs** view in the sidebar. Each row shows:

- **Method** — HTTP verb (GET, POST, etc.) or WS for WebSocket connections.
- **Domain** — the mapped domain that handled the request.
- **Path** — the request path and query string.
- **Status** — HTTP response status code, or an error reason on failure.
- **Latency** — round-trip time in milliseconds.
- **Time** — when the request occurred.
- **MOCK badge** — shown when the response was served by a mock rule rather than the backend.

Click any row to expand it and see full details, including request/response headers and body (when those capture options are enabled — see below).

## Filtering

A tab bar above the log lets you filter entries by type:

| Tab | Shows |
|---|---|
| All | Every entry |
| HTTP | Plain HTTP requests |
| HTTPS | Requests proxied over HTTPS |
| WS | WebSocket connections |
| JSON | Responses with a JSON content type |
| XHR | XMLHttpRequest / Fetch calls |
| Doc | HTML document requests |
| CSS | Stylesheet requests |
| JS | JavaScript requests |
| Font | Font file requests |
| Img | Image requests |
| Manifest | Web app manifest files |
| Wasm | WebAssembly files |
| GraphQL | Requests to `/graphql` paths |
| WML | WML requests |
| Other | Anything not matched by the above |

Filtering is applied client-side — no extra requests to the proxy are needed.

## Capturing Headers and Body

By default only metadata (method, status, latency, etc.) is recorded per request. You can enable richer capture in **Settings**:

- **Log Request/Response Headers** — attaches header tables to each log entry. Visible in the expanded row detail.
- **Log Request/Response Body** — captures up to 64 KB of request and response body. Larger bodies are captured up to that limit and marked as truncated. Visible in the expanded row detail.

These settings take effect immediately without restarting the proxy.

## Clearing Logs

Click **Clear** in the Logs toolbar to wipe all current entries from memory. This does not affect the log max setting or disable logging.

## Exporting as HAR

Click **Export HAR** to save the current log as a `.har` file. HAR (HTTP Archive) is a standard format supported by browser DevTools, Charles Proxy, and many other HTTP debugging tools.

The exported file contains all current log entries as HAR 1.2 `log.entries`, including request/response metadata, headers (if captured), timings, and a `_mocked: true` flag on any entry served by a mock rule.
