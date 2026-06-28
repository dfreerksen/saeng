import ElectronStore from 'electron-store';
import { randomUUID } from 'crypto';
import path from 'path';
import { app } from 'electron';
import { DEFAULT_INTERVAL_MS as DEFAULT_HEALTH_CHECK_INTERVAL_MS, DEFAULT_TIMEOUT_MS as DEFAULT_HEALTH_CHECK_TIMEOUT_MS } from './proxy/healthChecker.js';

const DEFAULT_LOG_MAX_ENTRIES = 300;
const MIN_LOG_MAX_ENTRIES = 100;
const MAX_LOG_MAX_ENTRIES = 100000;

const MIN_HEALTH_CHECK_INTERVAL_MS = 5000;
const MAX_HEALTH_CHECK_INTERVAL_MS = 300000;

const MIN_HEALTH_CHECK_TIMEOUT_MS = 500;
const MAX_HEALTH_CHECK_TIMEOUT_MS = 30000;

const headerListSchema = {
  type: 'array',
  default: [],
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      value: { type: 'string' },
    },
  },
};

const MIN_MOCK_STATUS_CODE = 100;
const MAX_MOCK_STATUS_CODE = 599;
const DEFAULT_MOCK_STATUS_CODE = 200;

const MIN_MOCK_DELAY_MS = 0;
const MAX_MOCK_DELAY_MS = 30000;
const DEFAULT_MOCK_DELAY_MS = 0;

const schema = {
  mappings: {
    type: 'array',
    default: [],
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        domain: { type: 'string' },
        host: { type: 'string' },
        port: { type: 'number' },
        https: { type: 'boolean' },
        enabled: { type: 'boolean' },
        createdAt: { type: 'string' },
        requestHeaders: headerListSchema,
        responseHeaders: headerListSchema,
        mocksEnabled: { type: 'boolean', default: false },
      },
    },
  },
  mocks: {
    type: 'array',
    default: [],
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        mappingId: { type: 'string' },
        enabled: { type: 'boolean' },
        method: { type: 'string' },
        pathPattern: { type: 'string' },
        statusCode: { type: 'number' },
        headers: headerListSchema,
        body: { type: 'string' },
        delayMs: { type: 'number', default: 0 },
        createdAt: { type: 'string' },
      },
    },
  },
  windowBounds: {
    type: 'object',
    properties: {
      width: { type: 'number' },
      height: { type: 'number' },
    },
    default: {
      width: 940,
      height: 680
    },
  },
  settings: {
    type: 'object',
    default: {
      httpsEnabled: true,
      startOnLaunch: true,
      colorMode: 'auto',
      locale: 'en',
      iconMode: 'both',
      dashboardEnabled: false,
      logMaxEntries: DEFAULT_LOG_MAX_ENTRIES,
      loggingEnabled: true,
      logHeadersEnabled: false,
      logBodyEnabled: false,
      healthCheckEnabled: false,
      healthCheckIntervalMs: DEFAULT_HEALTH_CHECK_INTERVAL_MS,
      healthCheckTimeoutMs: DEFAULT_HEALTH_CHECK_TIMEOUT_MS,
    },
  },
};

function sanitizeHeaders(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((h) => ({ name: String(h?.name ?? '').trim(), value: String(h?.value ?? '').trim() }))
    .filter((h) => h.name);
}

function sanitizeMockMethod(method) {
  const trimmed = String(method ?? '').trim().toUpperCase();
  return trimmed || '*';
}

function sanitizeMockStatusCode(statusCode) {
  const parsed = parseInt(statusCode, 10);
  if (Number.isNaN(parsed)) return DEFAULT_MOCK_STATUS_CODE;
  return Math.min(MAX_MOCK_STATUS_CODE, Math.max(MIN_MOCK_STATUS_CODE, parsed));
}

function sanitizeMockDelayMs(delayMs) {
  const parsed = parseInt(delayMs, 10);
  if (Number.isNaN(parsed)) return DEFAULT_MOCK_DELAY_MS;
  return Math.min(MAX_MOCK_DELAY_MS, Math.max(MIN_MOCK_DELAY_MS, parsed));
}

// Throws a descriptive error if `pattern` is not a valid regular expression.
function validatePathPattern(pattern) {
  try {
    new RegExp(pattern);
  } catch (err) {
    throw new Error(`Invalid path pattern: ${err.message}`, { cause: err });
  }
}

class AppStore {
  constructor() {
    this.store = new ElectronStore({ schema, name: 'config' });
  }

  getMappings() {
    return this.store.get('mappings', []);
  }

  addMapping(data) {
    const mappings = this.getMappings();
    const mapping = {
      id: randomUUID(),
      domain: data.domain.toLowerCase().trim(),
      host: data.host || '127.0.0.1',
      port: parseInt(data.port, 10),
      https: !!data.https,
      enabled: true,
      createdAt: new Date().toISOString(),
      requestHeaders: sanitizeHeaders(data.requestHeaders),
      responseHeaders: sanitizeHeaders(data.responseHeaders),
      mocksEnabled: !!data.mocksEnabled,
    };
    mappings.push(mapping);
    this.store.set('mappings', mappings);
    return mapping;
  }

  removeMapping(id) {
    const mappings = this.getMappings().filter((m) => m.id !== id);
    this.store.set('mappings', mappings);
  }

  updateMapping(id, data) {
    const mappings = this.getMappings().map((m) => {
      if (m.id !== id) return m;
      return {
        ...m,
        domain: data.domain.toLowerCase().trim(),
        host: data.host || '127.0.0.1',
        port: parseInt(data.port, 10),
        https: !!data.https,
        requestHeaders: sanitizeHeaders(data.requestHeaders),
        responseHeaders: sanitizeHeaders(data.responseHeaders),
        mocksEnabled: !!data.mocksEnabled,
      };
    });
    this.store.set('mappings', mappings);
    return mappings.find((m) => m.id === id);
  }

  toggleMapping(id) {
    const mappings = this.getMappings().map((m) =>
      m.id === id ? { ...m, enabled: !m.enabled } : m
    );
    this.store.set('mappings', mappings);
    return mappings.find((m) => m.id === id);
  }

  setMappingsEnabled(ids, enabled) {
    const idSet = new Set(ids);
    const mappings = this.getMappings().map((m) =>
      idSet.has(m.id) ? { ...m, enabled: !!enabled } : m
    );
    this.store.set('mappings', mappings);
  }

  exportMappings(ids) {
    const mappings = this.getMappings();
    const selected = Array.isArray(ids) && ids.length > 0
      ? mappings.filter((m) => ids.includes(m.id))
      : mappings;
    return selected.map(({ domain, host, port, https, enabled, requestHeaders, responseHeaders }) => ({
      domain, host, port, https, enabled, requestHeaders, responseHeaders,
    }));
  }

  importMappings(list) {
    const existingDomains = new Set(this.getMappings().map((m) => m.domain));
    const added = [];
    const skipped = [];
    for (const entry of list) {
      const domain = typeof entry?.domain === 'string' ? entry.domain.toLowerCase().trim() : '';
      const port = parseInt(entry?.port, 10);
      if (!domain || !Number.isInteger(port) || port < 1 || port > 65535 || existingDomains.has(domain)) {
        skipped.push(entry?.domain ?? '');
        continue;
      }
      const mapping = this.addMapping({
        domain,
        host: entry.host,
        port,
        https: entry.https,
        requestHeaders: entry.requestHeaders,
        responseHeaders: entry.responseHeaders,
      });
      if (entry.enabled === false) this.toggleMapping(mapping.id);
      existingDomains.add(domain);
      added.push(mapping);
    }
    return { added, skipped };
  }

  getMocks() {
    return this.store.get('mocks', []);
  }

  addMock(data) {
    const pathPattern = String(data?.pathPattern ?? '');
    validatePathPattern(pathPattern);
    const mocks = this.getMocks();
    const mock = {
      id: randomUUID(),
      mappingId: data.mappingId,
      enabled: data.enabled !== false,
      method: sanitizeMockMethod(data.method),
      pathPattern,
      statusCode: sanitizeMockStatusCode(data.statusCode),
      headers: sanitizeHeaders(data.headers),
      body: String(data?.body ?? ''),
      delayMs: sanitizeMockDelayMs(data.delayMs),
      createdAt: new Date().toISOString(),
    };
    mocks.push(mock);
    this.store.set('mocks', mocks);
    return mock;
  }

  updateMock(id, data) {
    const pathPattern = String(data?.pathPattern ?? '');
    validatePathPattern(pathPattern);
    const mocks = this.getMocks().map((m) => {
      if (m.id !== id) return m;
      return {
        ...m,
        mappingId: data.mappingId,
        enabled: data.enabled !== false,
        method: sanitizeMockMethod(data.method),
        pathPattern,
        statusCode: sanitizeMockStatusCode(data.statusCode),
        headers: sanitizeHeaders(data.headers),
        body: String(data?.body ?? ''),
        delayMs: sanitizeMockDelayMs(data.delayMs),
      };
    });
    this.store.set('mocks', mocks);
    return mocks.find((m) => m.id === id);
  }

  removeMock(id) {
    const mocks = this.getMocks().filter((m) => m.id !== id);
    this.store.set('mocks', mocks);
  }

  toggleMock(id) {
    const mocks = this.getMocks().map((m) =>
      m.id === id ? { ...m, enabled: !m.enabled } : m
    );
    this.store.set('mocks', mocks);
    return mocks.find((m) => m.id === id);
  }

  removeMocksForMapping(mappingId) {
    const mocks = this.getMocks().filter((m) => m.mappingId !== mappingId);
    this.store.set('mocks', mocks);
  }

  exportMocks(ids) {
    const mocks = this.getMocks();
    const mappingById = new Map(this.getMappings().map((m) => [m.id, m]));
    const selected = Array.isArray(ids) && ids.length > 0
      ? mocks.filter((m) => ids.includes(m.id))
      : mocks;
    return selected
      .map((m) => {
        const mapping = mappingById.get(m.mappingId);
        if (!mapping) return null;
        const { enabled, method, pathPattern, statusCode, headers, body, delayMs } = m;
        return { domain: mapping.domain, enabled, method, pathPattern, statusCode, headers, body, delayMs };
      })
      .filter((entry) => entry !== null);
  }

  importMocks(list) {
    const mappingByDomain = new Map(this.getMappings().map((m) => [m.domain.toLowerCase(), m]));
    const added = [];
    const skipped = [];
    for (const entry of list) {
      const domain = typeof entry?.domain === 'string' ? entry.domain.toLowerCase().trim() : '';
      const mapping = mappingByDomain.get(domain);
      if (!mapping) {
        skipped.push(entry?.domain ?? '');
        continue;
      }
      try {
        const mock = this.addMock({
          mappingId: mapping.id,
          enabled: entry.enabled,
          method: entry.method,
          pathPattern: entry.pathPattern,
          statusCode: entry.statusCode,
          headers: entry.headers,
          body: entry.body,
          delayMs: entry.delayMs,
        });
        added.push(mock);
      } catch {
        skipped.push(entry?.domain ?? '');
      }
    }
    return { added, skipped };
  }

  getSettings() {
    return this.store.get('settings', {
      httpsEnabled: false,
      startOnLaunch: false,
      colorMode: 'auto',
      locale: 'en',
      iconMode: 'both',
      dashboardEnabled: false,
      logMaxEntries: DEFAULT_LOG_MAX_ENTRIES,
      loggingEnabled: true,
      logHeadersEnabled: false,
      logBodyEnabled: false,
      healthCheckEnabled: false,
      healthCheckIntervalMs: DEFAULT_HEALTH_CHECK_INTERVAL_MS,
      healthCheckTimeoutMs: DEFAULT_HEALTH_CHECK_TIMEOUT_MS,
    });
  }

  setSettings(patch) {
    const current = this.getSettings();
    const updated = { ...current, ...patch };
    if ('logMaxEntries' in patch) {
      const parsed = parseInt(patch.logMaxEntries, 10);
      updated.logMaxEntries = Number.isNaN(parsed)
        ? DEFAULT_LOG_MAX_ENTRIES
        : Math.min(MAX_LOG_MAX_ENTRIES, Math.max(MIN_LOG_MAX_ENTRIES, parsed));
    }
    if ('healthCheckIntervalMs' in patch) {
      const parsed = parseInt(patch.healthCheckIntervalMs, 10);
      updated.healthCheckIntervalMs = Number.isNaN(parsed)
        ? DEFAULT_HEALTH_CHECK_INTERVAL_MS
        : Math.min(MAX_HEALTH_CHECK_INTERVAL_MS, Math.max(MIN_HEALTH_CHECK_INTERVAL_MS, parsed));
    }
    if ('healthCheckTimeoutMs' in patch) {
      const parsed = parseInt(patch.healthCheckTimeoutMs, 10);
      updated.healthCheckTimeoutMs = Number.isNaN(parsed)
        ? DEFAULT_HEALTH_CHECK_TIMEOUT_MS
        : Math.min(MAX_HEALTH_CHECK_TIMEOUT_MS, Math.max(MIN_HEALTH_CHECK_TIMEOUT_MS, parsed));
    }
    if ('iconMode' in patch) {
      const valid = ['both', 'tray', 'dock'];
      if (!valid.includes(patch.iconMode)) {
        updated.iconMode = 'both';
      }
    }
    this.store.set('settings', updated);
    return updated;
  }

  getWindowBounds() {
    return this.store.get('windowBounds', { width: 940, height: 680 });
  }

  setWindowBounds(bounds) {
    this.store.set('windowBounds', { width: bounds.width, height: bounds.height });
  }

  getCertDir() {
    return path.join(app.getPath('userData'), 'certs');
  }
}

export default AppStore;
