import Modal from './Modal.jsx';

export default function ConfirmModal({ title, message, confirmLabel, cancelLabel, confirmVariant = 'danger', onConfirm, onClose }) {
  return (
    <Modal onClose={onClose}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h1 className="modal-title fs-5">{title}</h1>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body">
            <p className="mb-0">{message}</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-cancel" onClick={onClose}>
              {cancelLabel}
            </button>
            <button type="button" className={`btn btn-${confirmVariant} btn-confirm`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
