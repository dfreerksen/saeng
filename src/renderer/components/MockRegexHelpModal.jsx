import Modal from './Modal.jsx';
import Tooltip from './Tooltip.jsx';

const REGEX_EXAMPLES = [
  { pattern: '^/api/users$', descriptionKey: 'mocks.modals.regexHelp.examples.exact' },
  { pattern: '^/api/users/\\d+$', descriptionKey: 'mocks.modals.regexHelp.examples.numericId' },
  { pattern: '^/api/users/[^/]+$', descriptionKey: 'mocks.modals.regexHelp.examples.anySegment' },
  { pattern: '^/api/users(/.*)?$', descriptionKey: 'mocks.modals.regexHelp.examples.prefix' },
  { pattern: '^/api/users/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$', descriptionKey: 'mocks.modals.regexHelp.examples.uuid' },
  { pattern: '\\.json$', descriptionKey: 'mocks.modals.regexHelp.examples.extension' },
  { pattern: '^/(users|accounts)$', descriptionKey: 'mocks.modals.regexHelp.examples.alternation' },
  { pattern: '.*', descriptionKey: 'mocks.modals.regexHelp.examples.any' },
];

export default function MockRegexHelpModal({ onClose, showToast, t }) {
  function handleCopy(pattern) {
    navigator.clipboard.writeText(pattern);
    showToast(t('flash.copied', { url: pattern }), 'success');
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h1 className="modal-title fs-5">{t('mocks.modals.regexHelp.title')}</h1>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body">
            <p className="form-hint">{t('mocks.modals.regexHelp.intro')}</p>
            <table className="table table-borderless table-striped">
              <thead>
                <tr>
                  <th scope="col">{t('mocks.modals.regexHelp.table.pattern')}</th>
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
                      <Tooltip title={t('mocks.modals.regexHelp.copy')}>
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
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('about.modals.buttons.close')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
