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
    const result = store.addMapping({ domain: 'MyApp.local ', port: '3000', https: false });
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

  it('persists the mapping so getMappings() includes it', () => {
    store.addMapping({ domain: 'myapp.local', port: 3000 });
    expect(store.getMappings()).toHaveLength(1);
  });

  it('defaults requestHeaders and responseHeaders to empty arrays', () => {
    const result = store.addMapping({ domain: 'myapp.local', port: 3000 });
    expect(result.requestHeaders).toEqual([]);
    expect(result.responseHeaders).toEqual([]);
  });

  it('sanitizes requestHeaders and responseHeaders, trimming values and dropping empty names', () => {
    const result = store.addMapping({
      domain: 'myapp.local',
      port: 3000,
      requestHeaders: [{ name: ' Authorization ', value: ' Bearer abc ' }, { name: '  ', value: 'ignored' }],
      responseHeaders: [{ name: 'X-Test', value: 'hello' }],
    });
    expect(result.requestHeaders).toEqual([{ name: 'Authorization', value: 'Bearer abc' }]);
    expect(result.responseHeaders).toEqual([{ name: 'X-Test', value: 'hello' }]);
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
  it('updates domain, port, https, and host', () => {
    const m = store.addMapping({ domain: 'old.local', port: 1, https: false, host: '127.0.0.1' });
    store.updateMapping(m.id, { domain: 'NEW.local ', port: '9000', https: true, host: '10.0.0.5' });
    const updated = store.getMappings().find((x) => x.id === m.id);
    expect(updated.domain).toBe('new.local');
    expect(updated.port).toBe(9000);
    expect(updated.https).toBe(true);
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

  it('updates and sanitizes requestHeaders and responseHeaders', () => {
    const m = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const result = store.updateMapping(m.id, {
      domain: 'myapp.local',
      port: 3000,
      requestHeaders: [{ name: 'X-Custom', value: ' 1 ' }, { name: '', value: 'ignored' }],
      responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: '*' }],
    });
    expect(result.requestHeaders).toEqual([{ name: 'X-Custom', value: '1' }]);
    expect(result.responseHeaders).toEqual([{ name: 'Access-Control-Allow-Origin', value: '*' }]);
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

describe('AppStore.setMappingsEnabled()', () => {
  it('enables all specified mappings', () => {
    const a = store.addMapping({ domain: 'a.local', port: 1 });
    const b = store.addMapping({ domain: 'b.local', port: 2 });
    store.toggleMapping(a.id);
    store.toggleMapping(b.id);
    store.setMappingsEnabled([a.id, b.id], true);
    const mappings = store.getMappings();
    expect(mappings.find((m) => m.id === a.id).enabled).toBe(true);
    expect(mappings.find((m) => m.id === b.id).enabled).toBe(true);
  });

  it('disables all specified mappings', () => {
    const a = store.addMapping({ domain: 'a.local', port: 1 });
    const b = store.addMapping({ domain: 'b.local', port: 2 });
    store.setMappingsEnabled([a.id, b.id], false);
    const mappings = store.getMappings();
    expect(mappings.find((m) => m.id === a.id).enabled).toBe(false);
    expect(mappings.find((m) => m.id === b.id).enabled).toBe(false);
  });

  it('does not affect mappings outside the given ids', () => {
    const a = store.addMapping({ domain: 'a.local', port: 1 });
    const b = store.addMapping({ domain: 'b.local', port: 2 });
    store.setMappingsEnabled([a.id], false);
    expect(store.getMappings().find((m) => m.id === b.id).enabled).toBe(true);
  });

  it('is a no-op for an empty ids array', () => {
    const a = store.addMapping({ domain: 'a.local', port: 1 });
    store.setMappingsEnabled([], false);
    expect(store.getMappings().find((m) => m.id === a.id).enabled).toBe(true);
  });

  it('silently ignores unknown ids', () => {
    const a = store.addMapping({ domain: 'a.local', port: 1 });
    expect(() => store.setMappingsEnabled(['nonexistent'], false)).not.toThrow();
    expect(store.getMappings().find((m) => m.id === a.id).enabled).toBe(true);
  });
});

describe('AppStore.exportMappings()', () => {
  it('returns all mappings stripped of id and createdAt when no ids given', () => {
    store.addMapping({ domain: 'a.local', port: 1, host: '127.0.0.1', https: false });
    const [result] = store.exportMappings();
    expect(result).toEqual({
      domain: 'a.local', host: '127.0.0.1', port: 1, https: false, enabled: true,
      requestHeaders: [], responseHeaders: [],
    });
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('createdAt');
  });

  it('includes requestHeaders and responseHeaders', () => {
    store.addMapping({
      domain: 'a.local',
      port: 1,
      requestHeaders: [{ name: 'X-Foo', value: 'bar' }],
      responseHeaders: [{ name: 'X-Bar', value: 'baz' }],
    });
    const [result] = store.exportMappings();
    expect(result.requestHeaders).toEqual([{ name: 'X-Foo', value: 'bar' }]);
    expect(result.responseHeaders).toEqual([{ name: 'X-Bar', value: 'baz' }]);
  });

  it('returns all mappings when ids is an empty array', () => {
    store.addMapping({ domain: 'a.local', port: 1 });
    store.addMapping({ domain: 'b.local', port: 2 });
    expect(store.exportMappings([])).toHaveLength(2);
  });

  it('returns only the mappings matching the given ids', () => {
    const a = store.addMapping({ domain: 'a.local', port: 1 });
    store.addMapping({ domain: 'b.local', port: 2 });
    const result = store.exportMappings([a.id]);
    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe('a.local');
  });
});

describe('AppStore.importMappings()', () => {
  it('adds valid entries and returns them in added', () => {
    const { added, skipped } = store.importMappings([
      { domain: 'New.Local ', host: '10.0.0.1', port: '3000', https: true },
    ]);
    expect(added).toHaveLength(1);
    expect(skipped).toHaveLength(0);
    expect(added[0].domain).toBe('new.local');
    expect(added[0].host).toBe('10.0.0.1');
    expect(added[0].port).toBe(3000);
    expect(added[0].https).toBe(true);
    expect(store.getMappings()).toHaveLength(1);
  });

  it('persists enabled as false when entry.enabled is false', () => {
    store.importMappings([{ domain: 'a.local', port: 1, enabled: false }]);
    expect(store.getMappings()[0].enabled).toBe(false);
  });

  it('skips entries with a missing or non-string domain', () => {
    const { added, skipped } = store.importMappings([{ port: 1 }, { domain: 42, port: 1 }]);
    expect(added).toHaveLength(0);
    expect(skipped).toEqual(['', 42]);
  });

  it('skips entries with an invalid port', () => {
    const { added, skipped } = store.importMappings([
      { domain: 'a.local', port: 'not-a-number' },
      { domain: 'b.local', port: 0 },
      { domain: 'c.local', port: 70000 },
    ]);
    expect(added).toHaveLength(0);
    expect(skipped).toEqual(['a.local', 'b.local', 'c.local']);
  });

  it('skips entries whose domain already exists', () => {
    store.addMapping({ domain: 'existing.local', port: 1 });
    const { added, skipped } = store.importMappings([{ domain: 'Existing.Local', port: 2 }]);
    expect(added).toHaveLength(0);
    expect(skipped).toEqual(['Existing.Local']);
  });

  it('skips duplicate domains within the same import list', () => {
    const { added, skipped } = store.importMappings([
      { domain: 'dup.local', port: 1 },
      { domain: 'DUP.local', port: 2 },
    ]);
    expect(added).toHaveLength(1);
    expect(skipped).toEqual(['DUP.local']);
  });

  it('imports requestHeaders and responseHeaders', () => {
    const { added } = store.importMappings([{
      domain: 'a.local',
      port: 1,
      requestHeaders: [{ name: 'X-Foo', value: 'bar' }],
      responseHeaders: [{ name: 'X-Bar', value: 'baz' }],
    }]);
    expect(added[0].requestHeaders).toEqual([{ name: 'X-Foo', value: 'bar' }]);
    expect(added[0].responseHeaders).toEqual([{ name: 'X-Bar', value: 'baz' }]);
  });
});

describe('AppStore mocksEnabled on mappings', () => {
  it('defaults mocksEnabled to false on addMapping', () => {
    const result = store.addMapping({ domain: 'myapp.local', port: 3000 });
    expect(result.mocksEnabled).toBe(false);
  });

  it('coerces mocksEnabled to a boolean on addMapping', () => {
    expect(store.addMapping({ domain: 'a.local', port: 1, mocksEnabled: 1 }).mocksEnabled).toBe(true);
    expect(store.addMapping({ domain: 'b.local', port: 2, mocksEnabled: 0 }).mocksEnabled).toBe(false);
    expect(store.addMapping({ domain: 'c.local', port: 3, mocksEnabled: true }).mocksEnabled).toBe(true);
  });

  it('updates mocksEnabled via updateMapping', () => {
    const m = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const updated = store.updateMapping(m.id, { domain: 'myapp.local', port: 3000, mocksEnabled: true });
    expect(updated.mocksEnabled).toBe(true);
  });
});

describe('AppStore.getMocks()', () => {
  it('returns an empty array when no mocks have been added', () => {
    expect(store.getMocks()).toEqual([]);
  });
});

describe('AppStore.addMock()', () => {
  it('returns the newly created mock with a generated id and createdAt', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const result = store.addMock({ mappingId: mapping.id, method: 'get', pathPattern: '^/api/ping$', statusCode: '200', body: '{"ok":true}' });
    expect(result.id).toBeDefined();
    expect(result.mappingId).toBe(mapping.id);
    expect(result.method).toBe('GET');
    expect(result.pathPattern).toBe('^/api/ping$');
    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('{"ok":true}');
    expect(() => new Date(result.createdAt)).not.toThrow();
  });

  it('defaults method to "*" when not provided', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const result = store.addMock({ mappingId: mapping.id, pathPattern: '.*' });
    expect(result.method).toBe('*');
  });

  it('defaults enabled to true', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const result = store.addMock({ mappingId: mapping.id, pathPattern: '.*' });
    expect(result.enabled).toBe(true);
  });

  it('persists enabled as false when explicitly set', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const result = store.addMock({ mappingId: mapping.id, pathPattern: '.*', enabled: false });
    expect(result.enabled).toBe(false);
  });

  it('clamps statusCode to the valid range', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    expect(store.addMock({ mappingId: mapping.id, pathPattern: '.*', statusCode: 50 }).statusCode).toBe(100);
    expect(store.addMock({ mappingId: mapping.id, pathPattern: '.*', statusCode: 999 }).statusCode).toBe(599);
  });

  it('defaults statusCode to 200 when not a number', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    expect(store.addMock({ mappingId: mapping.id, pathPattern: '.*', statusCode: 'banana' }).statusCode).toBe(200);
  });

  it('sanitizes headers', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const result = store.addMock({
      mappingId: mapping.id,
      pathPattern: '.*',
      headers: [{ name: ' X-Test ', value: ' 1 ' }, { name: '', value: 'ignored' }],
    });
    expect(result.headers).toEqual([{ name: 'X-Test', value: '1' }]);
  });

  it('throws a descriptive error for an invalid regex pathPattern', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    expect(() => store.addMock({ mappingId: mapping.id, pathPattern: '(unterminated' })).toThrow(/Invalid path pattern/);
  });

  it('does not persist a mock when pathPattern is invalid', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    expect(() => store.addMock({ mappingId: mapping.id, pathPattern: '(unterminated' })).toThrow();
    expect(store.getMocks()).toHaveLength(0);
  });

  it('persists the mock so getMocks() includes it', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    store.addMock({ mappingId: mapping.id, pathPattern: '.*' });
    expect(store.getMocks()).toHaveLength(1);
  });
});

describe('AppStore.updateMock()', () => {
  it('updates the mock fields and returns the updated mock', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const mock = store.addMock({ mappingId: mapping.id, method: 'get', pathPattern: '^/old$', statusCode: 200, body: 'old' });
    const updated = store.updateMock(mock.id, { mappingId: mapping.id, method: 'post', pathPattern: '^/new$', statusCode: 201, body: 'new' });
    expect(updated.method).toBe('POST');
    expect(updated.pathPattern).toBe('^/new$');
    expect(updated.statusCode).toBe(201);
    expect(updated.body).toBe('new');
  });

  it('does not change id or createdAt', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const mock = store.addMock({ mappingId: mapping.id, pathPattern: '.*' });
    const updated = store.updateMock(mock.id, { mappingId: mapping.id, pathPattern: '.*' });
    expect(updated.id).toBe(mock.id);
    expect(updated.createdAt).toBe(mock.createdAt);
  });

  it('throws a descriptive error for an invalid regex pathPattern and leaves the mock unchanged', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const mock = store.addMock({ mappingId: mapping.id, pathPattern: '^/old$' });
    expect(() => store.updateMock(mock.id, { mappingId: mapping.id, pathPattern: '(unterminated' })).toThrow(/Invalid path pattern/);
    expect(store.getMocks().find((m) => m.id === mock.id).pathPattern).toBe('^/old$');
  });
});

describe('AppStore.removeMock()', () => {
  it('removes the mock with the given id', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const mock = store.addMock({ mappingId: mapping.id, pathPattern: '.*' });
    store.removeMock(mock.id);
    expect(store.getMocks()).toHaveLength(0);
  });

  it('leaves other mocks untouched', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const a = store.addMock({ mappingId: mapping.id, pathPattern: '^/a$' });
    const b = store.addMock({ mappingId: mapping.id, pathPattern: '^/b$' });
    store.removeMock(a.id);
    const remaining = store.getMocks();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(b.id);
  });
});

describe('AppStore.toggleMock()', () => {
  it('flips enabled from true to false and back', () => {
    const mapping = store.addMapping({ domain: 'myapp.local', port: 3000 });
    const mock = store.addMock({ mappingId: mapping.id, pathPattern: '.*' });
    expect(mock.enabled).toBe(true);
    store.toggleMock(mock.id);
    expect(store.getMocks()[0].enabled).toBe(false);
    store.toggleMock(mock.id);
    expect(store.getMocks()[0].enabled).toBe(true);
  });
});

describe('AppStore.removeMocksForMapping()', () => {
  it('removes all mocks belonging to the given mapping', () => {
    const a = store.addMapping({ domain: 'a.local', port: 1 });
    const b = store.addMapping({ domain: 'b.local', port: 2 });
    store.addMock({ mappingId: a.id, pathPattern: '^/a1$' });
    store.addMock({ mappingId: a.id, pathPattern: '^/a2$' });
    const bMock = store.addMock({ mappingId: b.id, pathPattern: '^/b$' });
    store.removeMocksForMapping(a.id);
    const remaining = store.getMocks();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(bMock.id);
  });
});

describe('AppStore.exportMocks()', () => {
  it('returns mocks with the mapping domain instead of mappingId', () => {
    const mapping = store.addMapping({ domain: 'a.local', port: 1 });
    store.addMock({ mappingId: mapping.id, method: 'GET', pathPattern: '^/api$', statusCode: 200, body: 'hi' });
    const [result] = store.exportMocks();
    expect(result).toEqual({
      domain: 'a.local', enabled: true, method: 'GET', pathPattern: '^/api$', statusCode: 200, headers: [], body: 'hi',
    });
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('mappingId');
    expect(result).not.toHaveProperty('createdAt');
  });

  it('returns all mocks when ids is an empty array', () => {
    const mapping = store.addMapping({ domain: 'a.local', port: 1 });
    store.addMock({ mappingId: mapping.id, pathPattern: '^/a$' });
    store.addMock({ mappingId: mapping.id, pathPattern: '^/b$' });
    expect(store.exportMocks([])).toHaveLength(2);
  });

  it('returns only the mocks matching the given ids', () => {
    const mapping = store.addMapping({ domain: 'a.local', port: 1 });
    const a = store.addMock({ mappingId: mapping.id, pathPattern: '^/a$' });
    store.addMock({ mappingId: mapping.id, pathPattern: '^/b$' });
    const result = store.exportMocks([a.id]);
    expect(result).toHaveLength(1);
    expect(result[0].pathPattern).toBe('^/a$');
  });

  it('omits mocks whose mapping no longer exists', () => {
    const mapping = store.addMapping({ domain: 'a.local', port: 1 });
    store.addMock({ mappingId: mapping.id, pathPattern: '^/a$' });
    store.removeMapping(mapping.id);
    expect(store.exportMocks()).toHaveLength(0);
  });
});

describe('AppStore.importMocks()', () => {
  it('adds a mock matched to the mapping with the given domain', () => {
    const mapping = store.addMapping({ domain: 'a.local', port: 1 });
    const { added, skipped } = store.importMocks([
      { domain: 'A.Local', method: 'get', pathPattern: '^/api$', statusCode: '201', body: 'ok' },
    ]);
    expect(added).toHaveLength(1);
    expect(skipped).toHaveLength(0);
    expect(added[0].mappingId).toBe(mapping.id);
    expect(added[0].method).toBe('GET');
    expect(added[0].statusCode).toBe(201);
    expect(store.getMocks()).toHaveLength(1);
  });

  it('persists enabled as false when entry.enabled is false', () => {
    store.addMapping({ domain: 'a.local', port: 1 });
    store.importMocks([{ domain: 'a.local', pathPattern: '.*', enabled: false }]);
    expect(store.getMocks()[0].enabled).toBe(false);
  });

  it('skips entries whose domain does not match any mapping', () => {
    const { added, skipped } = store.importMocks([{ domain: 'missing.local', pathPattern: '.*' }]);
    expect(added).toHaveLength(0);
    expect(skipped).toEqual(['missing.local']);
  });

  it('skips entries with an invalid path pattern', () => {
    store.addMapping({ domain: 'a.local', port: 1 });
    const { added, skipped } = store.importMocks([{ domain: 'a.local', pathPattern: '(unterminated' }]);
    expect(added).toHaveLength(0);
    expect(skipped).toEqual(['a.local']);
  });

  it('imports headers', () => {
    store.addMapping({ domain: 'a.local', port: 1 });
    const { added } = store.importMocks([{
      domain: 'a.local',
      pathPattern: '.*',
      headers: [{ name: 'X-Foo', value: 'bar' }],
    }]);
    expect(added[0].headers).toEqual([{ name: 'X-Foo', value: 'bar' }]);
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

  it('getSettings() defaults logHeadersEnabled and logBodyEnabled to false', () => {
    expect(store.getSettings().logHeadersEnabled).toBe(false);
    expect(store.getSettings().logBodyEnabled).toBe(false);
  });

  it('setSettings() stores logHeadersEnabled and logBodyEnabled', () => {
    const result = store.setSettings({ logHeadersEnabled: true, logBodyEnabled: true });
    expect(result.logHeadersEnabled).toBe(true);
    expect(result.logBodyEnabled).toBe(true);
    expect(store.getSettings().logHeadersEnabled).toBe(true);
    expect(store.getSettings().logBodyEnabled).toBe(true);
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

  it('getSettings() defaults healthCheckEnabled to false', () => {
    expect(store.getSettings().healthCheckEnabled).toBe(false);
  });

  it('getSettings() defaults healthCheckIntervalMs to 15000', () => {
    expect(store.getSettings().healthCheckIntervalMs).toBe(60000);
  });

  it('getSettings() defaults healthCheckTimeoutMs to 2000', () => {
    expect(store.getSettings().healthCheckTimeoutMs).toBe(2000);
  });

  it('setSettings() stores a healthCheckEnabled value', () => {
    const result = store.setSettings({ healthCheckEnabled: true });
    expect(result.healthCheckEnabled).toBe(true);
    expect(store.getSettings().healthCheckEnabled).toBe(true);
  });

  it('setSettings() stores a valid healthCheckIntervalMs value', () => {
    const result = store.setSettings({ healthCheckIntervalMs: 30000 });
    expect(result.healthCheckIntervalMs).toBe(30000);
    expect(store.getSettings().healthCheckIntervalMs).toBe(30000);
  });

  it('setSettings() clamps healthCheckIntervalMs below the minimum to 5000', () => {
    expect(store.setSettings({ healthCheckIntervalMs: 1000 }).healthCheckIntervalMs).toBe(5000);
    expect(store.setSettings({ healthCheckIntervalMs: 0 }).healthCheckIntervalMs).toBe(5000);
  });

  it('setSettings() clamps healthCheckIntervalMs above the maximum to 300000', () => {
    expect(store.setSettings({ healthCheckIntervalMs: 999999 }).healthCheckIntervalMs).toBe(300000);
  });

  it('setSettings() falls back to the default when healthCheckIntervalMs is not a number', () => {
    expect(store.setSettings({ healthCheckIntervalMs: 'banana' }).healthCheckIntervalMs).toBe(60000);
  });

  it('setSettings() stores a valid healthCheckTimeoutMs value', () => {
    const result = store.setSettings({ healthCheckTimeoutMs: 5000 });
    expect(result.healthCheckTimeoutMs).toBe(5000);
    expect(store.getSettings().healthCheckTimeoutMs).toBe(5000);
  });

  it('setSettings() clamps healthCheckTimeoutMs below the minimum to 500', () => {
    expect(store.setSettings({ healthCheckTimeoutMs: 100 }).healthCheckTimeoutMs).toBe(500);
    expect(store.setSettings({ healthCheckTimeoutMs: 0 }).healthCheckTimeoutMs).toBe(500);
  });

  it('setSettings() clamps healthCheckTimeoutMs above the maximum to 30000', () => {
    expect(store.setSettings({ healthCheckTimeoutMs: 999999 }).healthCheckTimeoutMs).toBe(30000);
  });

  it('setSettings() falls back to the default when healthCheckTimeoutMs is not a number', () => {
    expect(store.setSettings({ healthCheckTimeoutMs: 'banana' }).healthCheckTimeoutMs).toBe(2000);
  });
});

describe('AppStore.getCertDir()', () => {
  it('returns a path inside the userData directory', () => {
    const certDir = store.getCertDir();
    expect(certDir).toBe(path.join('/tmp/test-saeng-userdata', 'certs'));
    expect(app.getPath).toHaveBeenCalledWith('userData');
  });
});
