export default function Titlebar({ proxyRunning, updateInfo, t }) {
  return (
    <div className="titlebar">
      <span className="titlebar-title">{t('titleBar.title')}</span>
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
      <div className="status-pill">
        <span className={`status-dot ${proxyRunning ? 'running' : 'stopped'}`} />
        <span>{proxyRunning ? t('proxy.status.running') : t('proxy.status.stopped')}</span>
      </div>
    </div>
  );
}
