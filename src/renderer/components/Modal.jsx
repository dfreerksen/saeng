import { useEffect } from 'react';

export default function Modal({ onClose, children }) {
  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {children}
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  );
}
