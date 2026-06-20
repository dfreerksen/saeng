export default function Titlebar({ proxyRunning, updateInfo, onProxyToggle, t }) {
  return (
    <div className="titlebar">
      <span className="titlebar-title">{t('application.name')}</span>
      <div className="titlebar-spacer" />
      {updateInfo?.updateAvailable && (
        <button
          type="button"
          className="update-badge"
          onClick={() => window.electronAPI.app.openExternal(updateInfo.url)}
          title={t('update.tooltip', { version: updateInfo.latestVersion })}
        >
          <i className="bi bi-arrow-up-circle" />
          <span>{t('update.available')}</span>
        </button>
      )}
      <button
        type="button"
        className={`status-pill${proxyRunning ? ' running' : ''}`}
        onClick={onProxyToggle}
        title={proxyRunning ? t('proxy.action.stop') : t('proxy.action.start')}
      >
        <span className={`status-dot ${proxyRunning ? 'running' : 'stopped'}`} />
        <span>{proxyRunning ? t('proxy.status.running') : t('proxy.status.stopped')}</span>
      </button>
    </div>
  );
}
