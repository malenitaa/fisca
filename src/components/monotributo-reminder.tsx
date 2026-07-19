"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MonotributoReminder({
  periodo,
  periodoLabel,
}: {
  periodo: string;
  periodoLabel: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [expanded, setExpanded] = useState(false);

  async function marcarPagado() {
    setStatus("loading");
    await fetch("/api/monotributo/pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodo }),
    });
    router.refresh();
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mb-4 flex w-full items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-left text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/40"
      >
        <span>
          Monotributo <strong>{periodoLabel}</strong> pendiente
        </span>
        <span aria-hidden className="text-amber-600 dark:text-amber-400">
          ›
        </span>
      </button>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm dark:border-amber-900 dark:bg-amber-950/30">
      <span className="text-amber-800 dark:text-amber-300">
        ¿Ya pagaste el monotributo de <strong>{periodoLabel}</strong>?
      </span>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <a
          href="https://www.afip.gob.ar/monotributo/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-amber-800 underline hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
        >
          Ir a ARCA
        </a>
        <button
          onClick={marcarPagado}
          disabled={status === "loading"}
          className="whitespace-nowrap rounded-md border border-amber-300 px-2.5 py-1 font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/40"
        >
          Ya pagué
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Ocultar"
          className="text-amber-600 hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-300"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
