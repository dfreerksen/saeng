import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpdateChecker, isNewerVersion } from '../src/updateChecker.js';

describe('isNewerVersion()', () => {
  it('returns true when the latest major version is higher', () => {
    expect(isNewerVersion('2.0.0', '1.6.1')).toBe(true);
  });

  it('returns true when the latest patch version is higher', () => {
    expect(isNewerVersion('1.6.2', '1.6.1')).toBe(true);
  });

  it('returns false when versions are equal', () => {
    expect(isNewerVersion('1.6.1', '1.6.1')).toBe(false);
  });

  it('returns false when the latest version is older', () => {
    expect(isNewerVersion('1.5.0', '1.6.1')).toBe(false);
  });

  it('ignores a leading "v" prefix', () => {
    expect(isNewerVersion('v1.7.0', '1.6.1')).toBe(true);
  });
});

describe('UpdateChecker.check()', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports an update when a newer release is published', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v1.7.0', html_url: 'https://github.com/dfreerksen/saeng/releases/tag/v1.7.0' }),
    });

    const checker = new UpdateChecker('1.6.1');
    const status = await checker.check();

    expect(status.updateAvailable).toBe(true);
    expect(status.latestVersion).toBe('1.7.0');
    expect(status.url).toBe('https://github.com/dfreerksen/saeng/releases/tag/v1.7.0');
  });

  it('reports no update when already on the latest release', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v1.6.1', html_url: 'https://github.com/dfreerksen/saeng/releases/tag/v1.6.1' }),
    });

    const checker = new UpdateChecker('1.6.1');
    const status = await checker.check();

    expect(status.updateAvailable).toBe(false);
    expect(status.latestVersion).toBe('1.6.1');
  });

  it('keeps the previous status when the request fails', async () => {
    fetch.mockResolvedValue({ ok: false });

    const checker = new UpdateChecker('1.6.1');
    const status = await checker.check();

    expect(status.updateAvailable).toBe(false);
    expect(status.latestVersion).toBeNull();
  });

  it('keeps the previous status when fetch throws', async () => {
    fetch.mockRejectedValue(new Error('network error'));

    const checker = new UpdateChecker('1.6.1');
    const status = await checker.check();

    expect(status.updateAvailable).toBe(false);
    expect(status.latestVersion).toBeNull();
  });

  it('notifies the listener with the resulting status', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v1.7.0', html_url: 'https://github.com/dfreerksen/saeng/releases/tag/v1.7.0' }),
    });

    const listener = vi.fn();
    const checker = new UpdateChecker('1.6.1');
    checker.setListener(listener);
    const status = await checker.check();

    expect(listener).toHaveBeenCalledWith(status);
  });
});

describe('UpdateChecker.start()/stop()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v1.6.1', html_url: 'https://github.com/dfreerksen/saeng/releases/tag/v1.6.1' }),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('checks immediately and then once per day', async () => {
    const checker = new UpdateChecker('1.6.1');
    checker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(fetch).toHaveBeenCalledTimes(2);

    checker.stop();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
