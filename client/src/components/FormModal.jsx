import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

function FormModal({
  title,
  description,
  onClose,
  onSubmit,
  submitLabel,
  busyLabel = 'Saving…',
  busy = false,
  children
}) {
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !busyRef.current) closeRef.current();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <div
      className="form-modal-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="form-modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </header>
        <form className="form-modal-form" onSubmit={onSubmit}>
          <div className="form-modal-content">{children}</div>
          <footer className="form-modal-actions">
            <button
              type="button"
              className="button button-quiet"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? busyLabel : submitLabel}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default FormModal;
