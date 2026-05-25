export default function Titlebar({ proxyRunning, t }) {
  return (
    <div className="titlebar">
      <span className="titlebar-title">Saeng</span>
      <div className="titlebar-spacer" />
      <div className="status-pill">
        <span className={`status-dot ${proxyRunning ? 'running' : 'stopped'}`} />
        <span>{proxyRunning ? t('proxy.status.running') : t('proxy.status.stopped')}</span>
      </div>
    </div>
  );
}
