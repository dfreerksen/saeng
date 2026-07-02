import { useEffect, useState } from 'react';

const HEALTH_CHECK_INTERVAL_MIN_S = 5;
const HEALTH_CHECK_INTERVAL_MAX_S = 300;
const HEALTH_CHECK_INTERVAL_DEFAULT_S = 15;

const HEALTH_CHECK_TIMEOUT_MIN_MS = 500;
const HEALTH_CHECK_TIMEOUT_MAX_MS = 30000;
const HEALTH_CHECK_TIMEOUT_STEP_MS = 100;
const HEALTH_CHECK_TIMEOUT_DEFAULT_MS = 2000;

function clampHealthCheckIntervalSeconds(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return HEALTH_CHECK_INTERVAL_DEFAULT_S;
  return Math.min(HEALTH_CHECK_INTERVAL_MAX_S, Math.max(HEALTH_CHECK_INTERVAL_MIN_S, parsed));
}

function clampHealthCheckTimeoutMs(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return HEALTH_CHECK_TIMEOUT_DEFAULT_MS;
  return Math.min(HEALTH_CHECK_TIMEOUT_MAX_MS, Math.max(HEALTH_CHECK_TIMEOUT_MIN_MS, parsed));
}

export default function HealthChecksSection({ settings, onSettingsChange, showToast, t }) {
  const [healthCheckIntervalDraft, setHealthCheckIntervalDraft] = useState(
    String(Math.round((settings.healthCheckIntervalMs ?? HEALTH_CHECK_INTERVAL_DEFAULT_S * 1000) / 1000))
  );
  const [healthCheckTimeoutDraft, setHealthCheckTimeoutDraft] = useState(
    String(settings.healthCheckTimeoutMs ?? HEALTH_CHECK_TIMEOUT_DEFAULT_MS)
  );

  useEffect(() => {
    setHealthCheckIntervalDraft(
      String(Math.round((settings.healthCheckIntervalMs ?? HEALTH_CHECK_INTERVAL_DEFAULT_S * 1000) / 1000))
    );
  }, [settings.healthCheckIntervalMs]);

  useEffect(() => {
    setHealthCheckTimeoutDraft(String(settings.healthCheckTimeoutMs ?? HEALTH_CHECK_TIMEOUT_DEFAULT_MS));
  }, [settings.healthCheckTimeoutMs]);

  function commitHealthCheckInterval() {
    const clampedSeconds = clampHealthCheckIntervalSeconds(healthCheckIntervalDraft);
    setHealthCheckIntervalDraft(String(clampedSeconds));
    const ms = clampedSeconds * 1000;
    if (ms !== settings.healthCheckIntervalMs) {
      onSettingsChange({ healthCheckIntervalMs: ms });
      showToast(t('flash.settings.updated'), 'info');
    }
  }

  function commitHealthCheckTimeout() {
    const clamped = clampHealthCheckTimeoutMs(healthCheckTimeoutDraft);
    setHealthCheckTimeoutDraft(String(clamped));
    if (clamped !== settings.healthCheckTimeoutMs) {
      onSettingsChange({ healthCheckTimeoutMs: clamped });
      showToast(t('flash.settings.updated'), 'info');
    }
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title">{t('settings.healthChecks.title')}</div>

      <div className="setting-row">
        <div className="setting-info">
          <div className="setting-name">{t('settings.healthChecks.enableCheck.label')}</div>
          <div className="setting-desc">{t('settings.healthChecks.enableCheck.description')}</div>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={!!settings.healthCheckEnabled}
            onChange={async (e) => {
              const checked = e.target.checked;
              await onSettingsChange({ healthCheckEnabled: checked });
              showToast(checked ? t('flash.healthCheck.enabled') : t('flash.healthCheck.disabled'), 'info');
            }}
          />
          <span className="toggle-track" />
        </label>
      </div>

      {settings.healthCheckEnabled && (
        <>
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-name">{t('settings.healthChecks.interval.label')}</div>
              <div className="setting-desc">
                {t('settings.healthChecks.interval.description', {
                  min: HEALTH_CHECK_INTERVAL_MIN_S,
                  max: HEALTH_CHECK_INTERVAL_MAX_S,
                })}
              </div>
            </div>
            <input
              className="health-check-interval-input"
              type="number"
              min={HEALTH_CHECK_INTERVAL_MIN_S}
              max={HEALTH_CHECK_INTERVAL_MAX_S}
              value={healthCheckIntervalDraft}
              onChange={(e) => setHealthCheckIntervalDraft(e.target.value)}
              onBlur={commitHealthCheckInterval}
            />
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-name">{t('settings.healthChecks.timeout.label')}</div>
              <div className="setting-desc">
                {t('settings.healthChecks.timeout.description', {
                  min: HEALTH_CHECK_TIMEOUT_MIN_MS,
                  max: HEALTH_CHECK_TIMEOUT_MAX_MS,
                })}
              </div>
            </div>
            <input
              className="health-check-timeout-input"
              type="number"
              min={HEALTH_CHECK_TIMEOUT_MIN_MS}
              max={HEALTH_CHECK_TIMEOUT_MAX_MS}
              step={HEALTH_CHECK_TIMEOUT_STEP_MS}
              value={healthCheckTimeoutDraft}
              onChange={(e) => setHealthCheckTimeoutDraft(e.target.value)}
              onBlur={commitHealthCheckTimeout}
            />
          </div>
        </>
      )}
    </div>
  );
}
