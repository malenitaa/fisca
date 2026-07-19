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

  async function marcarPagado() {
    setStatus("loading");
    await fetch("/api/monotributo/pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodo }),
    });
    router.refresh();
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/30">
      <span className="text-amber-800 dark:text-amber-300">
        ¿Ya pagaste el monotributo de <strong>{periodoLabel}</strong>?
      </span>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
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
          className="whitespace-nowrap rounded-md border border-amber-300 px-3 py-1.5 font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/40"
        >
          Ya pagué
        </button>
      </div>
    </div>
  );
}
