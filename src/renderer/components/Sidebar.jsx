export default function Sidebar({ currentView, setCurrentView, proxyRunning, onProxyToggle, onAbout, t }) {
  return (
    <nav className="sidebar">
      <button
        className={`nav-item${currentView === 'mappings' ? ' active' : ''}`}
        onClick={() => setCurrentView('mappings')}
      >
        <i className="bi bi-arrow-left-right" />
        <span>{t('nav.mappings')}</span>
      </button>
      <button
        className={`nav-item${currentView === 'settings' ? ' active' : ''}`}
        onClick={() => setCurrentView('settings')}
      >
        <i className="bi bi-gear-wide-connected" />
        <span>{t('nav.settings')}</span>
      </button>
      <button className="nav-item" onClick={onAbout}>
        <i className="bi bi-info-circle" />
        <span>{t('nav.about')}</span>
      </button>
      <div className="sidebar-footer">
        <button
          className={`proxy-toggle-btn${proxyRunning ? ' running' : ''}`}
          onClick={onProxyToggle}
        >
          {proxyRunning ? t('proxy.stop') : t('proxy.start')}
        </button>
      </div>
    </nav>
  );
}
