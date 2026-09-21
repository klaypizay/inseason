"use client";
import { useEffect, useId, useRef } from "react";

export function AIGenerationOverlay({
  active,
  title,
  description,
}: {
  active: boolean;
  title: string;
  description: string;
}) {
  return active ? (
    <GenerationDialog title={title} description={description} />
  ) : null;
}

function GenerationDialog({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    dialog.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="ai-generation-overlay no-print"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="true"
      tabIndex={-1}
      onCancel={(event) => event.preventDefault()}
    >
      <div className="ai-generation-card">
        <svg
          className="ai-generation-logo"
          viewBox="0 0 100 100"
          aria-hidden="true"
          focusable="false"
        >
          <circle className="ai-generation-track" cx="50" cy="50" r="42" />
          <circle className="ai-generation-center" cx="50" cy="50" r="28" />
          <g className="ai-generation-orbit">
            <circle className="ai-generation-ring" cx="50" cy="50" r="42" />
            <circle className="ai-generation-dot" cx="50" cy="8" r="4" />
          </g>
        </svg>
        <p className="ai-generation-brand">SEASON COACH</p>
        <div role="status" aria-live="polite" aria-atomic="true">
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
        </div>
        <p className="ai-generation-note">
          Your draft will appear here, ready for your review.
        </p>
      </div>
    </dialog>
  );
}
