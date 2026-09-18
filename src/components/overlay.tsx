"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
export function Overlay({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const overflow = document.body.style.overflow;
    const position = { left: window.scrollX, top: window.scrollY };
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      window.scrollTo({ ...position, behavior: "instant" });
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="overlay"
      aria-labelledby={titleId}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="overlay-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="secondary"
          aria-label="Close dialog"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      {open && children}
    </dialog>
  );
}
