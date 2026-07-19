"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SuccessProps {
  titulo: string;
  numero: string;
  cae: string;
  caeVencimiento: string;
  total: string; // formateado con símbolo, ej. "US$100,00" o "$230.000,00"
  clienteLinea: string; // "Consumidor Final" o "Deel Inc. · Estados Unidos"
  facturaId: string;
  onReset: () => void;
}

export function FacturaEmitidaSuccess({
  titulo,
  numero,
  cae,
  caeVencimiento,
  total,
  clienteLinea,
  facturaId,
  onReset,
}: SuccessProps) {
  const router = useRouter();
  const [sharing, setSharing] = useState(false);

  async function compartir() {
    const pdfUrl = `${window.location.origin}/api/facturas/${facturaId}/pdf`;
    const texto = `${titulo} ${numero}\nTotal: ${total}\nCAE: ${cae}\nPDF: ${pdfUrl}`;

    // Web Share API — en iOS abre la hoja de share nativa con WhatsApp
    // y demás apps. Fallback: link wa.me directo.
    if (typeof navigator !== "undefined" && navigator.share) {
      setSharing(true);
      try {
        await navigator.share({ title: `${titulo} ${numero}`, text: texto, url: pdfUrl });
      } catch {
        // el user canceló, no-op
      } finally {
        setSharing(false);
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  }

  return (
    <div className="flex flex-col items-center py-4">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#003366] text-white dark:bg-[#4a90c8]">
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        {titulo} autorizada
      </h2>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">{numero}</p>

      <div className="mb-6 w-full max-w-sm divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">Total</span>
          <span className="font-medium text-neutral-900 dark:text-neutral-100">{total}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">CAE</span>
          <span className="font-mono text-neutral-900 dark:text-neutral-100">{cae}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">Vence</span>
          <span className="text-neutral-900 dark:text-neutral-100">{caeVencimiento}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">Cliente</span>
          <span className="truncate pl-4 text-right text-neutral-900 dark:text-neutral-100">
            {clienteLinea}
          </span>
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-2">
        <button
          type="button"
          onClick={compartir}
          disabled={sharing}
          className="rounded-lg bg-[#003366] px-4 py-3 text-sm font-medium text-white hover:bg-[#002855] disabled:opacity-50 dark:bg-[#4a90c8] dark:hover:bg-[#3d7ba8]"
        >
          {sharing ? "Compartiendo..." : "Compartir por WhatsApp"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`/api/facturas/${facturaId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-neutral-300 px-4 py-3 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Descargar PDF
          </a>
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Nueva factura
          </button>
        </div>
        <button
          type="button"
          onClick={() => router.push("/facturas/historial")}
          className="mt-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          Ver historial ›
        </button>
      </div>
    </div>
  );
}
