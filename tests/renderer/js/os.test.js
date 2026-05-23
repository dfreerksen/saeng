// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getOS, isMac, isWindows, isLinux } from '../../../src/renderer/js/os.js';

beforeEach(() => {
  window.electronAPI = { platform: 'darwin' };
});

describe('getOS()', () => {
  it('returns "mac" for darwin', () => {
    window.electronAPI.platform = 'darwin';
    expect(getOS()).toBe('mac');
  });

  it('returns "windows" for win32', () => {
    window.electronAPI.platform = 'win32';
    expect(getOS()).toBe('windows');
  });

  it('returns "linux" for linux', () => {
    window.electronAPI.platform = 'linux';
    expect(getOS()).toBe('linux');
  });

  it('returns "unknown" for an unrecognised platform', () => {
    window.electronAPI.platform = 'freebsd';
    expect(getOS()).toBe('unknown');
  });
});

describe('isMac()', () => {
  it('returns true on darwin', () => {
    window.electronAPI.platform = 'darwin';
    expect(isMac()).toBe(true);
  });

  it('returns false on win32', () => {
    window.electronAPI.platform = 'win32';
    expect(isMac()).toBe(false);
  });
});

describe('isWindows()', () => {
  it('returns true on win32', () => {
    window.electronAPI.platform = 'win32';
    expect(isWindows()).toBe(true);
  });

  it('returns false on darwin', () => {
    window.electronAPI.platform = 'darwin';
    expect(isWindows()).toBe(false);
  });
});

describe('isLinux()', () => {
  it('returns true on linux', () => {
    window.electronAPI.platform = 'linux';
    expect(isLinux()).toBe(true);
  });

  it('returns false on darwin', () => {
    window.electronAPI.platform = 'darwin';
    expect(isLinux()).toBe(false);
  });
});

describe('platform predicates are mutually exclusive', () => {
  it('only isMac() is true on darwin', () => {
    window.electronAPI.platform = 'darwin';
    expect([isMac(), isWindows(), isLinux()].filter(Boolean)).toHaveLength(1);
    expect(isMac()).toBe(true);
  });

  it('only isWindows() is true on win32', () => {
    window.electronAPI.platform = 'win32';
    expect([isMac(), isWindows(), isLinux()].filter(Boolean)).toHaveLength(1);
    expect(isWindows()).toBe(true);
  });

  it('only isLinux() is true on linux', () => {
    window.electronAPI.platform = 'linux';
    expect([isMac(), isWindows(), isLinux()].filter(Boolean)).toHaveLength(1);
    expect(isLinux()).toBe(true);
  });
});
