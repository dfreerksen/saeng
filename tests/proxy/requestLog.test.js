import { describe, it, expect, vi } from 'vitest';
import { RequestLog, DEFAULT_MAX_ENTRIES } from '../../src/proxy/requestLog.js';

describe('RequestLog', () => {
  it('defaults to a max of 300 entries', () => {
    expect(DEFAULT_MAX_ENTRIES).toBe(300);
    const log = new RequestLog();
    for (let i = 0; i < 305; i++) log.add({ method: 'GET', path: `/${i}` });
    expect(log.list()).toHaveLength(300);
  });

  it('respects a custom max passed to the constructor', () => {
    const log = new RequestLog(2);
    log.add({ method: 'GET', path: '/a' });
    log.add({ method: 'GET', path: '/b' });
    log.add({ method: 'GET', path: '/c' });
    expect(log.list().map((e) => e.path)).toEqual(['/b', '/c']);
  });

  it('drops the oldest entries first once the cap is reached', () => {
    const log = new RequestLog(3);
    ['a', 'b', 'c', 'd'].forEach((p) => log.add({ method: 'GET', path: `/${p}` }));
    expect(log.list().map((e) => e.path)).toEqual(['/b', '/c', '/d']);
  });

  it('setMaxEntries() raises the cap without dropping existing entries', () => {
    const log = new RequestLog(2);
    log.add({ method: 'GET', path: '/a' });
    log.add({ method: 'GET', path: '/b' });
    log.setMaxEntries(5);
    log.add({ method: 'GET', path: '/c' });
    expect(log.list().map((e) => e.path)).toEqual(['/a', '/b', '/c']);
  });

  it('setMaxEntries() lowering the cap immediately trims to the newest entries', () => {
    const log = new RequestLog(5);
    ['a', 'b', 'c', 'd', 'e'].forEach((p) => log.add({ method: 'GET', path: `/${p}` }));
    log.setMaxEntries(2);
    expect(log.list().map((e) => e.path)).toEqual(['/d', '/e']);
  });

  it('assigns incrementing ids and notifies the listener', () => {
    const listener = vi.fn();
    const log = new RequestLog();
    log.setListener(listener);
    const a = log.add({ method: 'GET', path: '/a' });
    const b = log.add({ method: 'GET', path: '/b' });
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(2, b);
  });

  it('clear() empties the log', () => {
    const log = new RequestLog();
    log.add({ method: 'GET', path: '/a' });
    log.clear();
    expect(log.list()).toEqual([]);
  });
});
