import ElectronStore from 'electron-store';
import { randomUUID } from 'crypto';
import path from 'path';
import { app } from 'electron';

const DEFAULT_LOG_MAX_ENTRIES = 300;
const MIN_LOG_MAX_ENTRIES = 100;
const MAX_LOG_MAX_ENTRIES = 100000;

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
        label: { type: 'string' },
        createdAt: { type: 'string' },
      },
    },
  },
  settings: {
    type: 'object',
    default: {
      httpsEnabled: true,
      startOnLaunch: true,
      colorMode: 'auto',
      locale: 'en',
      logMaxEntries: DEFAULT_LOG_MAX_ENTRIES,
    },
  },
};

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
      label: data.label || '',
      createdAt: new Date().toISOString(),
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
        label: data.label || '',
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

  getSettings() {
    return this.store.get('settings', { httpsEnabled: false, startOnLaunch: false, colorMode: 'auto', locale: 'en', logMaxEntries: DEFAULT_LOG_MAX_ENTRIES });
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
    this.store.set('settings', updated);
    return updated;
  }

  getCertDir() {
    return path.join(app.getPath('userData'), 'certs');
  }
}

export default AppStore;
