const DEFAULT_MAX_ENTRIES = 300;

// In-memory ring buffer of recently proxied requests, used to power the
// renderer's live request inspector. Metadata only — no bodies are kept —
// so it stays cheap to record on the proxy's hot path.
class RequestLog {
  constructor(maxEntries = DEFAULT_MAX_ENTRIES, enabled = true, logHeaders = false, logBody = false) {
    this.entries = [];
    this.nextId = 1;
    this.listener = null;
    this.maxEntries = maxEntries;
    this.enabled = enabled;
    this.logHeaders = logHeaders;
    this.logBody = logBody;
  }

  setListener(listener) {
    this.listener = listener;
  }

  setMaxEntries(maxEntries) {
    this.maxEntries = maxEntries;
    while (this.entries.length > this.maxEntries) this.entries.shift();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  setLogHeaders(logHeaders) {
    this.logHeaders = logHeaders;
  }

  setLogBody(logBody) {
    this.logBody = logBody;
  }

  add(entry) {
    if (!this.enabled) return null;

    const logEntry = { id: this.nextId++, ...entry };
    this.entries.push(logEntry);
    if (this.entries.length > this.maxEntries) this.entries.shift();
    this.listener?.(logEntry);
    return logEntry;
  }

  list() {
    return this.entries;
  }

  clear() {
    this.entries = [];
  }
}

export { RequestLog, DEFAULT_MAX_ENTRIES };
