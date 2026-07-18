import { useEffect, useRef } from 'react';

export default function Modal({ onClose, children }) {
  const mouseDownOnBackdropRef = useRef(false);

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
        onMouseDown={(e) => { mouseDownOnBackdropRef.current = e.target === e.currentTarget; }}
        onClick={(e) => {
          if (mouseDownOnBackdropRef.current && e.target === e.currentTarget) onClose();
          mouseDownOnBackdropRef.current = false;
        }}
      >
        {children}
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
