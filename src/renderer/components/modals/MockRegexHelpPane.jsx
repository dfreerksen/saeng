import Tooltip from '../utilities/Tooltip.jsx';

const REGEX_EXAMPLES = [
  { pattern: '^/api/users$', descriptionKey: 'mocks.modals.manage.help.examples.exact' },
  { pattern: '^/api/users/\\d+$', descriptionKey: 'mocks.modals.manage.help.examples.numericId' },
  { pattern: '^/api/users/[^/]+$', descriptionKey: 'mocks.modals.manage.help.examples.anySegment' },
  { pattern: '^/api/users(/.*)?$', descriptionKey: 'mocks.modals.manage.help.examples.prefix' },
  { pattern: '^/users/[a-fA-F\\d]{8}-([a-fA-F\\d]{4}-){3}[a-fA-F\\d]{12}$', descriptionKey: 'mocks.modals.manage.help.examples.uuid' },
  { pattern: '\\.json$', descriptionKey: 'mocks.modals.manage.help.examples.extension' },
  { pattern: '^/(users|accounts)$', descriptionKey: 'mocks.modals.manage.help.examples.alternation' },
  { pattern: '.*', descriptionKey: 'mocks.modals.manage.help.examples.any' },
];

export default function MockRegexHelpPane({ showToast, t }) {
  function handleCopy(pattern) {
    navigator.clipboard.writeText(pattern);
    showToast(t('flash.copied', { url: pattern }), 'success');
  }

  return (
    <div className="mock-modal-help-pane">
      <h6 className="mb-2">{t('mocks.modals.manage.help.title')}</h6>
      <p className="form-hint">{t('mocks.modals.manage.help.intro')}</p>
      <table className="table table-borderless table-striped">
        <thead>
          <tr>
            <th scope="col">{t('mocks.modals.manage.help.table.pattern')}</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {REGEX_EXAMPLES.map((example) => (
            <tr key={example.pattern}>
              <td className="log-path-cell">
                <code>{example.pattern}</code>
                <div className="form-hint mb-0">{t(example.descriptionKey)}</div>
              </td>
              <td className="text-end">
                <Tooltip title={t('mocks.modals.manage.help.copy')}>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-copy"
                    onClick={() => handleCopy(example.pattern)}
                  >
                    <i className="bi bi-clipboard" />
                  </button>
                </Tooltip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
