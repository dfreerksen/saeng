import Tooltip from '../utilities/Tooltip.jsx';
import { useI18nT } from '../../js/i18nContext.js';

function CodeBlock({ text, onCopy }) {
  return (
    <div className="cli-code-block">
      <pre>{text}</pre>
      <Tooltip title={onCopy.label}>
        <button
          type="button"
          className="btn btn-outline-secondary btn-copy"
          onClick={() => onCopy.handler(text)}
        >
          <i className="bi bi-clipboard" />
        </button>
      </Tooltip>
    </div>
  );
}

export default function CliAccessSection({ settings, caPath, showToast }) {
  const t = useI18nT();
  const port = settings.proxyPort;

  function handleCopy(text) {
    navigator.clipboard.writeText(text);
    showToast(t('flash.copied', { url: text }), 'success');
  }

  const envVarBlock = [
    `export http_proxy=http://127.0.0.1:${port}`,
    `export https_proxy=http://127.0.0.1:${port}`,
  ].join('\n');

  const caBundleBlock = [
    `export CURL_CA_BUNDLE="${caPath ?? ''}"`,
    `export SSL_CERT_FILE="${caPath ?? ''}"`,
  ].join('\n');

  const exampleCommand = settings.httpsEnabled
    ? 'curl https://your-domain.local/'
    : 'curl http://your-domain.local/';

  return (
    <div className="settings-section">
      <div className="settings-section-title">{t('settings.cli.title')}</div>

      <p className="cert-description">{t('settings.cli.description')}</p>

      <div className="cli-step">
        <div className="cli-step-title">{t('settings.cli.step1.title')}</div>
        <p className="cert-description">{t('settings.cli.step1.description')}</p>
        <CodeBlock text={envVarBlock} onCopy={{ label: t('settings.cli.copy'), handler: handleCopy }} />
      </div>

      {settings.httpsEnabled && (
        <div className="cli-step">
          <div className="cli-step-title">{t('settings.cli.step2.title')}</div>
          <p className="cert-description">{t('settings.cli.step2.description')}</p>
          <p className="cert-platform-note">{t('settings.cli.step2.altLabel')}</p>
          <CodeBlock text={caBundleBlock} onCopy={{ label: t('settings.cli.copy'), handler: handleCopy }} />
        </div>
      )}

      <div className="cli-step">
        <div className="cli-step-title">{t('settings.cli.example.title')}</div>
        <CodeBlock text={exampleCommand} onCopy={{ label: t('settings.cli.copy'), handler: handleCopy }} />
      </div>
    </div>
  );
}
