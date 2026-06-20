import Modal from './Modal.jsx';
import Tooltip from './Tooltip.jsx';

export default function AboutModal({ version, electronVersion, nodeVersion, reactVersion, bootstrapVersion, onClose, t }) {
  return (
    <Modal onClose={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-body">
            <div className="about-header text-center">
              <img src="images/logo.svg" className="about-icon" alt={t('application.name')} />
              <div className="about-name">{t('application.name')}</div>
              <div className="about-version">{version ? `v${version}` : ''}</div>
            </div>
            <p className="about-desc text-center px-5 mb-3">{t('about.desc')}</p>
            <p className="text-center">
              <span>{t('about.github')}</span><br />
              <a href="https://github.com/dfreerksen/saeng" target="_blank" rel="noopener noreferrer">github.com/dfreerksen/saeng</a><br />
              <span>{t('about.thanks')}</span>
            </p>
            <p className="text-center">
              <span className="fw-bold">{t('about.contributors')}</span><br />
              <a href="https://github.com/dfreerksen" target="_blank" rel="noopener noreferrer">David Freerksen</a>
              <span className="ms-2 fst-italic">{t('about.contribution.creator')}</span>
            </p>
            <div className="container text-center mt-3 mb-3">
              <div className="row align-items-start">
                <div className="col-3 p-6">
                  <Tooltip title={electronVersion ? `Electron v${electronVersion}` : 'Electron'}>
                    <img src="images/tech/electron.svg" style={{ width: '64px' }} alt={electronVersion ? `Electron v${electronVersion}` : 'Electron'} />
                  </Tooltip>
                </div>
                <div className="col-3 p-6">
                  <Tooltip title={nodeVersion ? `Node.js v${nodeVersion}` : 'Node.js'}>
                    <img src="images/tech/nodejs.svg" style={{ width: '64px' }} alt={nodeVersion ? `Node.js v${nodeVersion}` : 'Node.js'} />
                  </Tooltip>
                </div>
                <div className="col-3 p-6">
                  <Tooltip title={reactVersion ? `React v${reactVersion}` : 'React'}>
                    <img src="images/tech/react.svg" style={{ width: '64px' }} alt={reactVersion ? `React v${reactVersion}` : 'React'} />
                  </Tooltip>
                </div>
                <div className="col-3 p-6">
                  <Tooltip title={bootstrapVersion ? `Bootstrap v${bootstrapVersion}` : 'Bootstrap'}>
                    <img src="images/tech/bootstrap.svg" style={{ width: '64px' }} alt={bootstrapVersion ? `Bootstrap v${bootstrapVersion}` : 'Bootstrap'} />
                  </Tooltip>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={onClose} aria-label="Close">
                {t('about.modals.buttons.close')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
