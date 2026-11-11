import { useI18nT } from '../../js/i18nContext.js';

export default function LoadingScreen({ fadingOut, onExited }) {
  const t = useI18nT();
  return (
    <div
      className={`app app-loading d-flex flex-column align-items-center justify-content-center vh-100${fadingOut ? ' app-loading-exit' : ''}`}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === 'opacity') onExited?.();
      }}
    >
      <img src="images/loading.svg" className="app-loading-logo" alt="" />
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">{t('common.loading')}</span>
      </div>
    </div>
  );
}
