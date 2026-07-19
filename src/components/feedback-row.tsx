"use client";

import { useState } from "react";
import { FeedbackModal } from "./feedback-modal";

export function FeedbackRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-sm text-neutral-900 dark:text-neutral-100"
      >
        <span>¿Queja o sugerencia?</span>
        <span aria-hidden className="shrink-0 text-neutral-400">
          ›
        </span>
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
