const REPO = 'dfreerksen/saeng';
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const REPO_URL = `https://github.com/${REPO}`;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const FETCH_TIMEOUT_MS = 10 * 1000;

function parseVersion(version) {
  return String(version).replace(/^v/, '').split('.').map((part) => parseInt(part, 10) || 0);
}

// Compares dotted version strings (e.g. "1.6.1"), ignoring a leading "v".
function isNewerVersion(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ai = a[i] || 0;
    const bi = b[i] || 0;
    if (ai !== bi) return ai > bi;
  }
  return false;
}

// Periodically polls the GitHub releases API for a newer version than the
// running app, mirroring HealthChecker's listener-based update pattern so
// the renderer can show a live "update available" badge.
class UpdateChecker {
  constructor(currentVersion) {
    this.currentVersion = currentVersion;
    this.status = {
      updateAvailable: false,
      currentVersion,
      latestVersion: null,
      url: REPO_URL,
    };
    this.listener = null;
    this.timer = null;
  }

  setListener(listener) {
    this.listener = listener;
  }

  getStatus() {
    return this.status;
  }

  async check() {
    try {
      const response = await fetch(RELEASES_URL, {
        headers: { Accept: 'application/vnd.github+json' },
        // Abort a hung request instead of leaving the check pending forever
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (response.ok) {
        const data = await response.json();
        const latestVersion = String(data.tag_name || '').replace(/^v/, '');
        this.status = {
          updateAvailable: latestVersion ? isNewerVersion(latestVersion, this.currentVersion) : false,
          currentVersion: this.currentVersion,
          latestVersion: latestVersion || null,
          url: data.html_url || REPO_URL,
        };
      }
    } catch (err) {
      console.error('Saeng: update check failed:', err.message);
    }
    this.listener?.(this.status);
    return this.status;
  }

  start() {
    this.check();
    this.timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export { UpdateChecker, CHECK_INTERVAL_MS, isNewerVersion };
