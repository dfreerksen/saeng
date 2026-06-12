import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../src/proxy/httpProxy.js', () => ({
  HttpProxy: vi.fn(function () {
    this.start = vi.fn().mockResolvedValue(54321);
    this.stop = vi.fn().mockResolvedValue(undefined);
    this.updateMappings = vi.fn();
    this.updateMocks = vi.fn();
  }),
}));

vi.mock('../../src/proxy/pacServer.js', () => ({
  PacServer: vi.fn(function () {
    this.start = vi.fn().mockResolvedValue(undefined);
    this.stop = vi.fn().mockResolvedValue(undefined);
    this.updateMappings = vi.fn();
  }),
}));

vi.mock('../../src/proxy/certManager.js', () => ({
  CertManager: { getInstance: vi.fn().mockReturnValue({}) },
}));

vi.mock('../../src/proxy/requestLog.js', () => ({
  RequestLog: vi.fn(function (maxEntries) {
    this.maxEntries = maxEntries;
  }),
}));

vi.mock('../../src/proxy/healthChecker.js', () => ({
  HealthChecker: vi.fn(function () {
    this.updateMappings = vi.fn();
    this.start = vi.fn();
    this.stop = vi.fn();
    this.setProxyRunning = vi.fn();
  }),
}));

vi.mock('../../src/systemProxy.js', () => ({
  setSystemProxy: vi.fn().mockResolvedValue(undefined),
  clearSystemProxy: vi.fn().mockResolvedValue(undefined),
}));

import { ProxyManager } from '../../src/proxy/manager.js';
import { HttpProxy } from '../../src/proxy/httpProxy.js';
import { PacServer } from '../../src/proxy/pacServer.js';
import { CertManager } from '../../src/proxy/certManager.js';
import { RequestLog } from '../../src/proxy/requestLog.js';
import { HealthChecker } from '../../src/proxy/healthChecker.js';
import { setSystemProxy, clearSystemProxy } from '../../src/systemProxy.js';

const mockStore = { getCertDir: () => '/tmp/test-certs', getSettings: () => ({ logMaxEntries: 300, loggingEnabled: true, logHeadersEnabled: false, logBodyEnabled: false }), getMocks: () => [] };
const mappings = [{ domain: 'myapp.local', port: 3000, enabled: true }];
const settings = { httpsEnabled: false };

beforeEach(() => vi.clearAllMocks());

describe('ProxyManager.isRunning()', () => {
  it('returns false initially', () => {
    const manager = new ProxyManager(mockStore);
    expect(manager.isRunning()).toBe(false);
  });

  it('returns true after start()', async () => {
    const manager = new ProxyManager(mockStore);
    await manager.start(mappings, settings);
    expect(manager.isRunning()).toBe(true);
  });

  it('returns false after stop()', async () => {
    const manager = new ProxyManager(mockStore);
    await manager.start(mappings, settings);
    await manager.stop();
    expect(manager.isRunning()).toBe(false);
  });
});

describe('ProxyManager.getStatus()', () => {
  it('reports not running with 0 uptime when stopped', () => {
    const status = new ProxyManager(mockStore).getStatus();
    expect(status.running).toBe(false);
    expect(status.uptime).toBe(0);
  });

  it('reports running with non-negative uptime after start()', async () => {
    const manager = new ProxyManager(mockStore);
    await manager.start(mappings, settings);
    const status = manager.getStatus();
    expect(status.running).toBe(true);
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });
});

describe('ProxyManager.start()', () => {
  it('wires the system proxy to the PAC URL on port 8181', async () => {
    const manager = new ProxyManager(mockStore);
    await manager.start(mappings, settings);
    expect(setSystemProxy).toHaveBeenCalledWith('http://127.0.0.1:8181/proxy.pac');
  });

  it('is idempotent — a second call does nothing', async () => {
    const manager = new ProxyManager(mockStore);
    await manager.start(mappings, settings);
    await manager.start(mappings, settings);
    expect(vi.mocked(setSystemProxy)).toHaveBeenCalledTimes(1);
  });

  it('passes the proxy port from HttpProxy to PacServer.start()', async () => {
    const manager = new ProxyManager(mockStore);
    await manager.start(mappings, settings);
    const pacInstance = vi.mocked(PacServer).mock.instances[0];
    expect(pacInstance.start).toHaveBeenCalledWith(54321);
  });
});

describe('ProxyManager — request log wiring', () => {
  it('creates a RequestLog sized from the store settings', () => {
    const manager = new ProxyManager(mockStore);
    expect(RequestLog).toHaveBeenCalledWith(300, true, false, false);
    expect(manager.requestLog).toBeInstanceOf(RequestLog);
  });

  it('passes the request log to HttpProxy on start', async () => {
    const manager = new ProxyManager(mockStore);
    await manager.start(mappings, settings);
    const certManager = vi.mocked(CertManager.getInstance).mock.results[0].value;
    expect(HttpProxy).toHaveBeenCalledWith(certManager, manager.requestLog);
  });
});

describe('ProxyManager.stop()', () => {
  it('clears the system proxy', async () => {
    const manager = new ProxyManager(mockStore);
    await manager.start(mappings, settings);
    await manager.stop();
    expect(clearSystemProxy).toHaveBeenCalledTimes(1);
  });

  it('stops both HttpProxy and PacServer', async () => {
    const manager = new ProxyManager(mockStore);
    await manager.start(mappings, settings);
    const httpInstance = vi.mocked(HttpProxy).mock.instances[0];
    const pacInstance = vi.mocked(PacServer).mock.instances[0];
    await manager.stop();
    expect(httpInstance.stop).toHaveBeenCalled();
    expect(pacInstance.stop).toHaveBeenCalled();
  });

  it('nulls out httpProxy and pacServer references', async () => {
    const manager = new ProxyManager(mockStore);
    await manager.start(mappings, settings);
    await manager.stop();
    expect(manager.httpProxy).toBeNull();
    expect(manager.pacServer).toBeNull();
  });

  it('is idempotent — a second call does nothing', async () => {
    const manager = new ProxyManager(mockStore);
    await manager.start(mappings, settings);
    await manager.stop();
    await manager.stop();
    expect(vi.mocked(clearSystemProxy)).toHaveBeenCalledTimes(1);
  });
});

describe('ProxyManager.updateMappings()', () => {
  it('does nothing to HttpProxy/PacServer when the proxy is not running', () => {
    const manager = new ProxyManager(mockStore);
    manager.updateMappings(mappings);
    expect(vi.mocked(HttpProxy)).not.toHaveBeenCalled();
  });

  it('pushes updates to both HttpProxy and PacServer when running', async () => {
    const manager = new ProxyManager(mockStore);
    await manager.start(mappings, settings);
    const httpInstance = vi.mocked(HttpProxy).mock.instances[0];
    const pacInstance = vi.mocked(PacServer).mock.instances[0];
    const newMappings = [{ domain: 'new.local', port: 4000, enabled: true }];
    manager.updateMappings(newMappings);
    expect(httpInstance.updateMappings).toHaveBeenCalledWith(newMappings);
    expect(pacInstance.updateMappings).toHaveBeenCalledWith(newMappings);
  });

  it('always pushes updates to the health checker, even when not running', () => {
    const manager = new ProxyManager(mockStore);
    manager.updateMappings(mappings);
    expect(manager.healthChecker.updateMappings).toHaveBeenCalledWith(mappings);
  });
});

describe('ProxyManager — mocks wiring', () => {
  it('pushes the store mocks to HttpProxy on start()', async () => {
    const mocks = [{ id: 'mock1', mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api$', statusCode: 200, headers: [], body: '' }];
    const store = { ...mockStore, getMocks: () => mocks };
    const manager = new ProxyManager(store);
    await manager.start(mappings, settings);
    const httpInstance = vi.mocked(HttpProxy).mock.instances[0];
    expect(httpInstance.updateMocks).toHaveBeenCalledWith(mocks);
  });

  describe('ProxyManager.updateMocks()', () => {
    it('does nothing when the proxy is not running', () => {
      const manager = new ProxyManager(mockStore);
      manager.updateMocks([]);
      expect(vi.mocked(HttpProxy)).not.toHaveBeenCalled();
    });

    it('pushes updates to HttpProxy when running', async () => {
      const manager = new ProxyManager(mockStore);
      await manager.start(mappings, settings);
      const httpInstance = vi.mocked(HttpProxy).mock.instances[0];
      const newMocks = [{ id: 'mock1', mappingId: 'm1', enabled: true, method: '*', pathPattern: '^/api$', statusCode: 200, headers: [], body: '' }];
      manager.updateMocks(newMocks);
      expect(httpInstance.updateMocks).toHaveBeenLastCalledWith(newMocks);
    });
  });
});

describe('ProxyManager — health checker wiring', () => {
  it('creates a HealthChecker', () => {
    const manager = new ProxyManager(mockStore);
    expect(manager.healthChecker).toBeInstanceOf(HealthChecker);
  });

  it('constructs the HealthChecker with the interval/timeout/enabled settings', () => {
    const store = {
      getCertDir: () => '/tmp/test-certs',
      getSettings: () => ({
        logMaxEntries: 300,
        loggingEnabled: true,
        healthCheckIntervalMs: 30000,
        healthCheckTimeoutMs: 5000,
        healthCheckEnabled: true,
      }),
      getMocks: () => [],
    };
    new ProxyManager(store);
    expect(vi.mocked(HealthChecker)).toHaveBeenCalledWith(30000, 5000, true);
  });

  it('marks the health checker as not running on construction', () => {
    const manager = new ProxyManager(mockStore);
    expect(manager.healthChecker.setProxyRunning).toHaveBeenCalledWith(false);
  });

  it('tells the health checker the proxy is running on start()', async () => {
    const manager = new ProxyManager(mockStore);
    await manager.start(mappings, settings);
    expect(manager.healthChecker.updateMappings).toHaveBeenCalledWith(mappings);
    expect(manager.healthChecker.setProxyRunning).toHaveBeenLastCalledWith(true);
  });

  it('tells the health checker the proxy has stopped on stop()', async () => {
    const manager = new ProxyManager(mockStore);
    await manager.start(mappings, settings);
    await manager.stop();
    expect(manager.healthChecker.setProxyRunning).toHaveBeenLastCalledWith(false);
  });
});
