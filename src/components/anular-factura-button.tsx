"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AnularFacturaButton({
  facturaId,
  numero,
}: {
  facturaId: string;
  numero: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleAnular() {
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch(`/api/facturas/${facturaId}/nota-credito`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "No se pudo anular la factura.");
      }
      setConfirming(false);
      router.replace("/facturas/historial");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Error inesperado.");
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          ¿Emitir Nota de Crédito por {numero}?
        </span>
        <button
          onClick={handleAnular}
          disabled={status === "loading"}
          className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
        >
          {status === "loading" ? "Emitiendo..." : "Confirmar"}
        </button>
        <button
          onClick={() => {
            setConfirming(false);
            setStatus("idle");
            setErrorMessage("");
          }}
          className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          Cancelar
        </button>
        {status === "error" && (
          <span className="text-xs text-red-600 dark:text-red-400">{errorMessage}</span>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-sm font-medium text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400"
    >
      Anular
    </button>
  );
}
