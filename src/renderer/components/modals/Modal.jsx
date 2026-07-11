import { useEffect, useRef } from 'react';

export default function Modal({ onClose, children }) {
  const mouseDownOnBackdrop = useRef(false);

  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div
        className="modal fade show d-block"
        onMouseDown={(e) => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
        onClick={(e) => {
          if (mouseDownOnBackdrop.current && e.target === e.currentTarget) onClose();
          mouseDownOnBackdrop.current = false;
        }}
      >
        {children}
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
