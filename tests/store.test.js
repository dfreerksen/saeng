import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('electron-store', () => ({
  default: class MockElectronStore {
    #data = {};
    get(key, defaultValue) {
      return key in this.#data ? this.#data[key] : defaultValue;
    }
    set(key, value) {
      this.#data[key] = value;
    }
  },
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/test-saeng-userdata') },
}));

import AppStore from '../src/store.js';
import { app } from 'electron';
import path from 'path';

let store;

beforeEach(() => {
  store = new AppStore();
});

describe('AppStore.getMappings()', () => {
  it('returns an empty array when no mappings have been added', () => {
    expect(store.getMappings()).toEqual([]);
  });
});

describe('AppStore.addMapping()', () => {
  it('returns the newly created mapping', () => {
    const result = store.addMapping({ domain: 'MyApp.local ', port: '3000', https: false, label: 'dev' });
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
  });

  it('lowercases and trims the domain', () => {
    const result = store.addMapping({ domain: '  MyApp.Local  ', port: '3000' });
    expect(result.domain).toBe('myapp.local');
  });

  it('parses port as an integer', () => {
    const result = store.addMapping({ domain: 'api.local', port: '8080' });
    expect(result.port).toBe(8080);
    expect(typeof result.port).toBe('number');
  });

  it('coerces https to a boolean', () => {
    expect(store.addMapping({ domain: 'a.local', port: 3000, https: 1 }).https).toBe(true);
    expect(store.addMapping({ domain: 'b.local', port: 3001, https: 0 }).https).toBe(false);
    expect(store.addMapping({ domain: 'c.local', port: 3002, https: true }).https).toBe(true);
  });

  it('sets enabled to true by default', () => {
    const result = store.addMapping({ domain: 'myapp.local', port: 3000 });
    expect(result.enabled).toBe(true);
  });

  it('generates a unique ID for each mapping', () => {
    const a = store.addMapping({ domain: 'a.local', port: 1 });
    const b = store.addMapping({ domain: 'b.local', port: 2 });
    expect(a.id).not.toBe(b.id);
  });

  it('stores a createdAt ISO timestamp', () => {
    const result = store.addMapping({ domain: 'myapp.local', port: 3000 });
    expect(() => new Date(result.createdAt)).not.toThrow();
    expect(new Date(result.createdAt).getTime()).toBeGreaterThan(0);
  });

  it('defaults host to 127.0.0.1 when not provided', () => {
    const result = store.addMapping({ domain: 'myapp.local', port: 3000 });
    expect(result.host).toBe('127.0.0.1');
  });

  it('stores the provided host', () => {
    const result = store.addMapping({ domain: 'myapp.local', port: 3000, host: '10.0.0.5' });
    expect(result.host).toBe('10.0.0.5');
  });

  it('uses an empty string for label when omitted', () => {
    const result = store.addMapping({ domain: 'myapp.local', port: 3000 });
    expect(result.label).toBe('');
  });

  it('persists the mapping so getMappings() includes it', () => {
    store.addMapping({ domain: 'myapp.local', port: 3000 });
    expect(store.getMappings()).toHaveLength(1);
  });
});

describe('AppStore.removeMapping()', () => {
  it('removes the mapping with the given id', () => {
    const m = store.addMapping({ domain: 'myapp.local', port: 3000 });
    store.removeMapping(m.id);
    expect(store.getMappings()).toHaveLength(0);
  });

  it('leaves other mappings untouched', () => {
    const a = store.addMapping({ domain: 'a.local', port: 1 });
    const b = store.addMapping({ domain: 'b.local', port: 2 });
    store.removeMapping(a.id);
    const remaining = store.getMappings();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(b.id);
  });

  it('is a no-op for an unknown id', () => {
    store.addMapping({ domain: 'myapp.local', port: 3000 });
    store.removeMapping('nonexistent-id');
    expect(store.getMappings()).toHaveLength(1);
  });
});

describe('AppStore.updateMapping()', () => {
  it('updates domain, port, https, label, and host', () => {
    const m = store.addMapping({ domain: 'old.local', port: 1, https: false, label: '', host: '127.0.0.1' });
    store.updateMapping(m.id, { domain: 'NEW.local ', port: '9000', https: true, label: 'updated', host: '10.0.0.5' });
    const updated = store.getMappings().find((x) => x.id === m.id);
    expect(updated.domain).toBe('new.local');
    expect(updated.port).toBe(9000);
    expect(updated.https).toBe(true);
    expect(updated.label).toBe('updated');
    expect(updated.host).toBe('10.0.0.5');
  });

  it('does not change id or createdAt', () => {
    const m = store.addMapping({ domain: 'myapp.local', port: 3000 });
    store.updateMapping(m.id, { domain: 'other.local', port: 4000 });
    const updated = store.getMappings().find((x) => x.id === m.id);
    expect(updated.id).toBe(m.id);
    expect(updated.createdAt).toBe(m.createdAt);
  });

  it('returns the updated mapping', () => {
    const m = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const result = store.updateMapping(m.id, { domain: 'new.local', port: 4000 });
    expect(result.domain).toBe('new.local');
  });
});

describe('AppStore.toggleMapping()', () => {
  it('flips enabled from true to false', () => {
    const m = store.addMapping({ domain: 'myapp.local', port: 3000 });
    expect(m.enabled).toBe(true);
    store.toggleMapping(m.id);
    expect(store.getMappings()[0].enabled).toBe(false);
  });

  it('flips enabled from false back to true', () => {
    const m = store.addMapping({ domain: 'myapp.local', port: 3000 });
    store.toggleMapping(m.id);
    store.toggleMapping(m.id);
    expect(store.getMappings()[0].enabled).toBe(true);
  });

  it('returns the toggled mapping', () => {
    const m = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const result = store.toggleMapping(m.id);
    expect(result.enabled).toBe(false);
  });

  it('does not affect other mappings', () => {
    const a = store.addMapping({ domain: 'a.local', port: 1 });
    const b = store.addMapping({ domain: 'b.local', port: 2 });
    store.toggleMapping(a.id);
    expect(store.getMappings().find((m) => m.id === b.id).enabled).toBe(true);
  });
});

describe('AppStore.getSettings() / setSettings()', () => {
  it('getSettings() returns the default settings when nothing has been set', () => {
    const settings = store.getSettings();
    expect(settings).toMatchObject({
      httpsEnabled: false,
      startOnLaunch: false,
      colorMode: 'auto',
      locale: 'en',
    });
  });

  it('setSettings() merges the patch over the current settings', () => {
    store.setSettings({ httpsEnabled: true });
    const settings = store.getSettings();
    expect(settings.httpsEnabled).toBe(true);
    expect(settings.startOnLaunch).toBe(false); // untouched
  });

  it('setSettings() returns the merged settings', () => {
    const result = store.setSettings({ locale: 'fr' });
    expect(result.locale).toBe('fr');
    expect(result.httpsEnabled).toBe(false);
  });

  it('multiple setSettings() calls accumulate correctly', () => {
    store.setSettings({ httpsEnabled: true });
    store.setSettings({ startOnLaunch: true });
    const settings = store.getSettings();
    expect(settings.httpsEnabled).toBe(true);
    expect(settings.startOnLaunch).toBe(true);
  });

  it('getSettings() defaults logMaxEntries to 300', () => {
    expect(store.getSettings().logMaxEntries).toBe(300);
  });

  it('setSettings() stores a valid logMaxEntries value', () => {
    const result = store.setSettings({ logMaxEntries: 5000 });
    expect(result.logMaxEntries).toBe(5000);
    expect(store.getSettings().logMaxEntries).toBe(5000);
  });

  it('setSettings() clamps logMaxEntries below the minimum to 100', () => {
    expect(store.setSettings({ logMaxEntries: 1 }).logMaxEntries).toBe(100);
    expect(store.setSettings({ logMaxEntries: 0 }).logMaxEntries).toBe(100);
    expect(store.setSettings({ logMaxEntries: -50 }).logMaxEntries).toBe(100);
  });

  it('setSettings() clamps logMaxEntries above the maximum to 100000', () => {
    expect(store.setSettings({ logMaxEntries: 250000 }).logMaxEntries).toBe(100000);
  });

  it('setSettings() falls back to the default when logMaxEntries is not a number', () => {
    expect(store.setSettings({ logMaxEntries: 'banana' }).logMaxEntries).toBe(300);
  });

  it('setSettings() leaves logMaxEntries untouched when not present in the patch', () => {
    store.setSettings({ logMaxEntries: 500 });
    const result = store.setSettings({ httpsEnabled: true });
    expect(result.logMaxEntries).toBe(500);
  });
});

describe('AppStore.getCertDir()', () => {
  it('returns a path inside the userData directory', () => {
    const certDir = store.getCertDir();
    expect(certDir).toBe(path.join('/tmp/test-saeng-userdata', 'certs'));
    expect(app.getPath).toHaveBeenCalledWith('userData');
  });
});
