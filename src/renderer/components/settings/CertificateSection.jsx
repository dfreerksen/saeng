import { useState } from 'react';
import { getExpiryInfo } from '../../js/utils.js';
import { getOS } from '../../js/os.js';
import Tooltip from '../utilities/Tooltip.jsx';

export default function CertificateSection({ caPath, caExpiry, setCaExpiry, showToast, t }) {
  const [trustingCA, setTrustingCA] = useState(false);
  const [regeneratingCA, setRegeneratingCA] = useState(false);
  const [deletingCA, setDeletingCA] = useState(false);

  const expiryInfo = getExpiryInfo(caExpiry);
  const os = getOS();

  return (
    <div className="settings-section">
      <div className="settings-section-title">{t('settings.cert.title')}</div>

      <p className="cert-description">
        {t('settings.cert.description')}
      </p>

      <div className="ca-info-box">{caPath || t('settings.cert.actions.generating')}</div>
      {expiryInfo && (
        <div className={`ca-expiry${expiryInfo.urgency ? ` ca-expiry--${expiryInfo.urgency}` : ''}`}>
          {expiryInfo.text}
        </div>
      )}

      <div className="btn-group" role="group" aria-label="Certificate Actions">
        <Tooltip title={t(`settings.cert.actions.show.${os}`)}>
          <button
            className="btn btn-outline-secondary"
            onClick={() => window.electronAPI.ssl.revealCA()}
          >
            <i className="bi bi-folder2-open" />
            <span className="ms-2 d-none d-lg-inline">{t(`settings.cert.actions.show.${os}`)}</span>
          </button>
        </Tooltip>

        <Tooltip title={t('settings.cert.actions.install')}>
          <button
            className="btn btn-outline-primary"
            disabled={trustingCA}
            onClick={async () => {
              setTrustingCA(true);
              const result = await window.electronAPI.ssl.trustCA();
              setTrustingCA(false);
              if (result.success) {
                showToast(t('flash.ca.trusted'), 'success', 5000);
              } else {
                showToast(result.message, 'error', 6000);
              }
            }}
          >
            <i className="bi bi-shield-check" />
            <span className="ms-2 d-none d-lg-inline">
              {trustingCA ? t('settings.cert.actions.installing') : t('settings.cert.actions.install')}
            </span>
          </button>
        </Tooltip>

        <Tooltip title={t('settings.cert.actions.regenerate')}>
          <button
            className="btn btn-outline-warning"
            disabled={regeneratingCA}
            onClick={async () => {
              if (!confirm(t('settings.cert.confirm.regenerate'))) return;
              setRegeneratingCA(true);
              const newExpiry = await window.electronAPI.ssl.regenerateCA();
              setCaExpiry(newExpiry);
              setRegeneratingCA(false);
              showToast(t('flash.ca.regenerated'), 'success', 5000);
            }}
          >
            <i className="bi bi-arrow-repeat" />
            <span className="ms-2 d-none d-lg-inline">{t('settings.cert.actions.regenerate')}</span>
          </button>
        </Tooltip>

        <Tooltip title={t('settings.cert.actions.delete')}>
          <button
            className="btn btn-outline-danger"
            disabled={deletingCA}
            onClick={async () => {
              if (!confirm(t('settings.cert.confirm.delete'))) return;
              setDeletingCA(true);
              const result = await window.electronAPI.ssl.deleteCA();
              setCaExpiry(null);
              setDeletingCA(false);
              showToast(t('flash.ca.deleted'), 'info', 5000);
              if (result?.warning) showToast(result.warning, 'info', 6000);
            }}
          >
            <i className="bi bi-trash" />
            <span className="ms-2 d-none d-lg-inline">{t('settings.cert.actions.delete')}</span>
          </button>
        </Tooltip>
      </div>

      <p className="cert-platform-note">{t(`settings.cert.platformNote.${os}`)}</p>
    </div>
  );
}
