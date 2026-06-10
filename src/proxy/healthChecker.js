import net from 'net';

const DEFAULT_INTERVAL_MS = (60 * 1000); // 1 minute
const DEFAULT_TIMEOUT_MS = (2 * 1000); // 2 seconds

// Periodically probes each mapping's host:port with a raw TCP connection and
// keeps an in-memory map of the latest result, mirroring RequestLog's
// listener-based update pattern so the renderer can show live status badges.
class HealthChecker {
  constructor(intervalMs = DEFAULT_INTERVAL_MS, timeoutMs = DEFAULT_TIMEOUT_MS, enabled = true) {
    this.intervalMs = intervalMs;
    this.timeoutMs = timeoutMs;
    this.enabled = enabled;
    this.proxyRunning = true;
    this.mappings = [];
    this.statuses = new Map();
    this.listener = null;
    this.timer = null;
  }

  setListener(listener) {
    this.listener = listener;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.sync();
  }

  // Pings should only run while the proxy itself is running.
  setProxyRunning(running) {
    this.proxyRunning = running;
    this.sync();
  }

  sync() {
    if (this.enabled && this.proxyRunning) {
      if (this.timer) return;
      this.timer = setInterval(() => this.checkAll(), this.intervalMs);
      this.checkAll();
    } else {
      this.stop();
    }
  }

  setIntervalMs(intervalMs) {
    this.intervalMs = intervalMs;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = setInterval(() => this.checkAll(), this.intervalMs);
    }
  }

  setTimeoutMs(timeoutMs) {
    this.timeoutMs = timeoutMs;
  }

  start(mappings) {
    this.updateMappings(mappings);
    this.sync();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  updateMappings(mappings) {
    const previousActiveIds = new Set(this.mappings.filter((m) => m.enabled !== false).map((m) => m.id));
    this.mappings = mappings;
    const activeIds = new Set(mappings.filter((m) => m.enabled !== false).map((m) => m.id));
    for (const id of this.statuses.keys()) {
      if (!activeIds.has(id)) this.statuses.delete(id);
    }

    // Newly-enabled mappings shouldn't wait for the next scheduled tick to get a status.
    if (this.timer) {
      for (const mapping of mappings) {
        if (mapping.enabled !== false && !previousActiveIds.has(mapping.id)) {
          this.checkOne(mapping);
        }
      }
    }
  }

  getStatuses() {
    return Object.fromEntries(this.statuses);
  }

  getStatus(id) {
    return this.statuses.get(id) ?? null;
  }

  checkAll() {
    return Promise.all(this.mappings.filter((m) => m.enabled !== false).map((m) => this.checkOne(m)));
  }

  checkOne(mapping) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const target = `${mapping.host || '127.0.0.1'}:${mapping.port}`;
      console.log(`Saeng: health check - pinging ${mapping.domain} (${target})...`);

      const socket = net.connect({ host: mapping.host || '127.0.0.1', port: mapping.port });
      socket.setTimeout(this.timeoutMs);

      const finish = (status, error = null) => {
        socket.removeAllListeners();
        socket.destroy();
        const result = {
          id: mapping.id,
          status,
          latencyMs: Date.now() - startedAt,
          checkedAt: Date.now(),
          error,
        };
        this.statuses.set(mapping.id, result);
        this.listener?.(result);
        resolve(result);
      };

      socket.once('connect', () => {
        console.info(`Saeng: health check - ${mapping.domain} (${target}) is up`);
        finish('up');
      });
      socket.once('timeout', () => {
        console.warn(`Saeng: health check - ${mapping.domain} (${target}) timed out`);
        finish('down', 'timeout');
      });
      socket.once('error', (err) => {
        console.error(`Saeng: health check - ${mapping.domain} (${target}) is down: ${err.message}`);
        finish('down', err.message);
      });
    });
  }
}

export { HealthChecker, DEFAULT_INTERVAL_MS, DEFAULT_TIMEOUT_MS };
