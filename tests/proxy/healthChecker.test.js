import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import net from 'net';
import { HealthChecker } from '../../src/proxy/healthChecker.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

describe('HealthChecker.checkOne()', () => {
  let server;
  let port;

  beforeEach(async () => {
    server = net.createServer((socket) => socket.on('data', () => {}));
    port = await listen(server);
  });

  afterEach(async () => {
    await close(server);
  });

  it('reports "up" for a reachable host:port', async () => {
    const checker = new HealthChecker();
    const result = await checker.checkOne({ id: '1', domain: 'myapp.local', host: '127.0.0.1', port });
    expect(result.status).toBe('up');
    expect(result.id).toBe('1');
    expect(result.error).toBeNull();
  });

  it('reports "down" for a closed port', async () => {
    await close(server);
    const checker = new HealthChecker();
    const result = await checker.checkOne({ id: '1', domain: 'myapp.local', host: '127.0.0.1', port });
    expect(result.status).toBe('down');
    expect(result.error).toBeTruthy();
  });

  it('reports "down" with a timeout error when the connection hangs', async () => {
    const checker = new HealthChecker(15000, 50);
    // 10.255.255.1 is a non-routable address commonly used to simulate a hang
    const result = await checker.checkOne({ id: '1', domain: 'myapp.local', host: '10.255.255.1', port: 81 });
    expect(result.status).toBe('down');
  }, 10000);

  it('records the result in statuses and notifies the listener', async () => {
    const listener = vi.fn();
    const checker = new HealthChecker();
    checker.setListener(listener);
    const result = await checker.checkOne({ id: 'abc', host: '127.0.0.1', port });
    expect(checker.getStatus('abc')).toEqual(result);
    expect(listener).toHaveBeenCalledWith(result);
  });
});

describe('HealthChecker.checkOne() — console logging', () => {
  let logSpy, infoSpy, warnSpy, errorSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs when a ping starts and logs info on success', async () => {
    const server = net.createServer();
    const port = await listen(server);
    const checker = new HealthChecker();

    await checker.checkOne({ id: '1', domain: 'myapp.local', host: '127.0.0.1', port });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('myapp.local'));
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('myapp.local'));
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    await close(server);
  });

  it('logs an error when the ping fails conclusively (connection refused)', async () => {
    const server = net.createServer();
    const port = await listen(server);
    await close(server);
    const checker = new HealthChecker();

    await checker.checkOne({ id: '1', domain: 'myapp.local', host: '127.0.0.1', port });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('myapp.local'));
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs a warning when the ping is inconclusive (timeout)', async () => {
    const checker = new HealthChecker(15000, 50);

    await checker.checkOne({ id: '1', domain: 'myapp.local', host: '10.255.255.1', port: 81 });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('myapp.local'));
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  }, 10000);
});

describe('HealthChecker.updateMappings()', () => {
  it('drops statuses for mappings that no longer exist', async () => {
    const server = net.createServer();
    const port = await listen(server);
    const checker = new HealthChecker();
    await checker.checkOne({ id: '1', host: '127.0.0.1', port });
    expect(checker.getStatus('1')).not.toBeNull();

    checker.updateMappings([]);
    expect(checker.getStatus('1')).toBeNull();
    await close(server);
  });

  it('keeps statuses for mappings that still exist', async () => {
    const server = net.createServer();
    const port = await listen(server);
    const checker = new HealthChecker();
    await checker.checkOne({ id: '1', host: '127.0.0.1', port });

    checker.updateMappings([{ id: '1', host: '127.0.0.1', port }]);
    expect(checker.getStatus('1')).not.toBeNull();
    await close(server);
  });

  it('drops statuses for mappings that are disabled', async () => {
    const server = net.createServer();
    const port = await listen(server);
    const checker = new HealthChecker();
    await checker.checkOne({ id: '1', host: '127.0.0.1', port, enabled: true });
    expect(checker.getStatus('1')).not.toBeNull();

    checker.updateMappings([{ id: '1', host: '127.0.0.1', port, enabled: false }]);
    expect(checker.getStatus('1')).toBeNull();
    await close(server);
  });

  it('immediately pings a mapping that becomes enabled while running', async () => {
    const server = net.createServer();
    const port = await listen(server);
    const checker = new HealthChecker(15000);
    checker.start([{ id: '1', host: '127.0.0.1', port, enabled: false }]);
    expect(checker.getStatus('1')).toBeNull();

    checker.updateMappings([{ id: '1', host: '127.0.0.1', port, enabled: true }]);

    await vi.waitFor(() => {
      expect(checker.getStatus('1')?.status).toBe('up');
    });

    checker.stop();
    await close(server);
  });

  it('does not immediately ping a newly-enabled mapping when not running', () => {
    const checker = new HealthChecker();
    const spy = vi.spyOn(checker, 'checkOne');

    checker.updateMappings([{ id: '1', host: '127.0.0.1', port: 1, enabled: true }]);

    expect(spy).not.toHaveBeenCalled();
  });

  it('does not double-ping a mapping that was already enabled', async () => {
    const server = net.createServer();
    const port = await listen(server);
    const checker = new HealthChecker(15000);
    checker.start([{ id: '1', host: '127.0.0.1', port, enabled: true }]);
    const spy = vi.spyOn(checker, 'checkOne');

    checker.updateMappings([{ id: '1', host: '127.0.0.1', port, enabled: true }]);

    expect(spy).not.toHaveBeenCalled();
    checker.stop();
    await close(server);
  });
});

describe('HealthChecker.checkAll()', () => {
  it('skips disabled mappings', async () => {
    const server = net.createServer();
    const port = await listen(server);
    const checker = new HealthChecker();
    const spy = vi.spyOn(checker, 'checkOne');

    checker.updateMappings([
      { id: '1', host: '127.0.0.1', port, enabled: true },
      { id: '2', host: '127.0.0.1', port, enabled: false },
    ]);
    await checker.checkAll();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    expect(checker.getStatus('1')).not.toBeNull();
    expect(checker.getStatus('2')).toBeNull();
    await close(server);
  });
});

describe('HealthChecker.start() / stop()', () => {
  it('checks all mappings immediately on start()', async () => {
    const server = net.createServer();
    const port = await listen(server);
    const checker = new HealthChecker(15000);
    checker.start([{ id: '1', host: '127.0.0.1', port }]);

    await vi.waitFor(() => {
      expect(checker.getStatus('1')?.status).toBe('up');
    });

    checker.stop();
    await close(server);
  });

  it('stop() prevents further scheduled checks', async () => {
    vi.useFakeTimers();
    const checker = new HealthChecker(1000);
    const spy = vi.spyOn(checker, 'checkAll').mockResolvedValue();
    checker.start([]);
    expect(spy).toHaveBeenCalledTimes(1);

    checker.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('start() does nothing when constructed with enabled=false', async () => {
    vi.useFakeTimers();
    const checker = new HealthChecker(1000, 2000, false);
    const spy = vi.spyOn(checker, 'checkAll').mockResolvedValue();
    checker.start([{ id: '1', host: '127.0.0.1', port: 1 }]);
    expect(spy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    expect(spy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('HealthChecker.setEnabled()', () => {
  it('starts the timer and checks immediately when enabled', async () => {
    vi.useFakeTimers();
    const checker = new HealthChecker(1000, 2000, false);
    const spy = vi.spyOn(checker, 'checkAll').mockResolvedValue();

    checker.setEnabled(true);
    expect(spy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(spy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('stops the timer and prevents further checks when disabled', async () => {
    vi.useFakeTimers();
    const checker = new HealthChecker(1000);
    const spy = vi.spyOn(checker, 'checkAll').mockResolvedValue();
    checker.start([]);
    expect(spy).toHaveBeenCalledTimes(1);

    checker.setEnabled(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('HealthChecker.setProxyRunning()', () => {
  it('does not start the timer on start() while the proxy is not running', async () => {
    vi.useFakeTimers();
    const checker = new HealthChecker(1000);
    checker.setProxyRunning(false);
    const spy = vi.spyOn(checker, 'checkAll').mockResolvedValue();

    checker.start([]);
    expect(spy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    expect(spy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('starts the timer and checks immediately once the proxy starts running', async () => {
    vi.useFakeTimers();
    const checker = new HealthChecker(1000);
    checker.setProxyRunning(false);
    const spy = vi.spyOn(checker, 'checkAll').mockResolvedValue();
    checker.start([]);
    expect(spy).not.toHaveBeenCalled();

    checker.setProxyRunning(true);
    expect(spy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(spy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('stops the timer when the proxy stops running', async () => {
    vi.useFakeTimers();
    const checker = new HealthChecker(1000);
    const spy = vi.spyOn(checker, 'checkAll').mockResolvedValue();
    checker.start([]);
    expect(spy).toHaveBeenCalledTimes(1);

    checker.setProxyRunning(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('does not start the timer if health checks are disabled, even when the proxy is running', async () => {
    vi.useFakeTimers();
    const checker = new HealthChecker(1000, 2000, false);
    checker.setProxyRunning(false);
    const spy = vi.spyOn(checker, 'checkAll').mockResolvedValue();

    checker.setProxyRunning(true);
    expect(spy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    expect(spy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('HealthChecker.setIntervalMs()', () => {
  it('reschedules the running timer with the new interval', async () => {
    vi.useFakeTimers();
    const checker = new HealthChecker(1000);
    const spy = vi.spyOn(checker, 'checkAll').mockResolvedValue();
    checker.start([]);
    expect(spy).toHaveBeenCalledTimes(1);

    checker.setIntervalMs(5000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(spy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4000);
    expect(spy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does not start a timer if the checker is not running', () => {
    const checker = new HealthChecker(1000, 2000, false);
    checker.setIntervalMs(5000);
    expect(checker.intervalMs).toBe(5000);
    expect(checker.timer).toBeNull();
  });
});

describe('HealthChecker.setTimeoutMs()', () => {
  it('updates the timeout used for subsequent checks', () => {
    const checker = new HealthChecker();
    checker.setTimeoutMs(5000);
    expect(checker.timeoutMs).toBe(5000);
  });
});

describe('HealthChecker.getStatuses()', () => {
  it('returns a plain object keyed by mapping id', async () => {
    const server = net.createServer();
    const port = await listen(server);
    const checker = new HealthChecker();
    await checker.checkOne({ id: 'a', host: '127.0.0.1', port });
    expect(checker.getStatuses()).toHaveProperty('a');
    expect(checker.getStatuses().a.status).toBe('up');
    await close(server);
  });
});
