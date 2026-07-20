"use client";

import { useState } from "react";

interface FaqItem {
  pregunta: string;
  respuesta: React.ReactNode;
}

/** Accordion exclusivo: solo una respuesta abierta a la vez. Al tocar una
 * pregunta, si otra estaba abierta se cierra. */
export function FaqList({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white px-4 dark:divide-neutral-900 dark:border-neutral-800 dark:bg-neutral-950">
      {items.map((faq) => {
        const isOpen = open === faq.pregunta;
        return (
          <div key={faq.pregunta} className="py-3.5">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : faq.pregunta)}
              aria-expanded={isOpen}
              className="flex w-full items-start justify-between gap-3 text-left text-sm font-medium text-neutral-900 dark:text-neutral-100"
            >
              <span>{faq.pregunta}</span>
              <span
                aria-hidden
                className={`mt-0.5 shrink-0 text-neutral-400 transition-transform dark:text-neutral-500 ${
                  isOpen ? "rotate-90" : ""
                }`}
              >
                ›
              </span>
            </button>
            {isOpen && (
              <div className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {faq.respuesta}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
