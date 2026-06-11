import { Tooltip as BsTooltip } from 'bootstrap';
import Modal from './Modal.jsx';

export default function AboutModal({ version, electronVersion, nodeVersion, onClose, t }) {
  return (
    <Modal onClose={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-body">
            <div className="about-header text-center">
              <img src="images/logo.svg" className="about-icon" alt="Saeng" />
              <div className="about-name">Saeng</div>
              <div className="about-version">{version ? `v${version}` : ''}</div>
            </div>
            <p className="about-desc text-center">{t('about.desc')}</p>
            <p>
              Technologies:<br />
              {electronVersion ? `Electron (v${electronVersion})` : 'Electron'}<br />
              {nodeVersion ? `Node.js (v${nodeVersion})` : 'Node.js'}<br />
              Bootstrap (v{BsTooltip.VERSION})
            </p>
            <p>
              Contributors:<br />
              <a href="https://github.com/dfreerksen">David Freerksen</a> (Development, Design, Testing)
            </p>
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
