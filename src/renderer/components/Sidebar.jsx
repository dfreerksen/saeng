import { memo } from 'react';

export default memo(function Sidebar({ currentView, setCurrentView, loggingEnabled, onAbout, t }) {
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
        className={`nav-item${currentView === 'mocks' ? ' active' : ''}`}
        onClick={() => setCurrentView('mocks')}
      >
        <i className="bi bi-magic" />
        <span>{t('nav.mocks')}</span>
      </button>
      {loggingEnabled && (
        <button
          className={`nav-item${currentView === 'log' ? ' active' : ''}`}
          onClick={() => setCurrentView('log')}
        >
          <i className="bi bi-list-columns-reverse" />
          <span>{t('nav.log')}</span>
        </button>
      )}
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
    </nav>
  );
});
