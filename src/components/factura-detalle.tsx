"use client";

import { useState } from "react";
import { AnularFacturaButton } from "@/components/anular-factura-button";

interface Props {
  titulo: string;
  numero: string;
  cae: string;
  caeVencimiento: string;
  fechaEmision: string;
  total: string;
  clienteLinea: string;
  facturaId: string;
  puedeAnular: boolean;
}

export function FacturaDetalle({
  titulo,
  numero,
  cae,
  caeVencimiento,
  fechaEmision,
  total,
  clienteLinea,
  facturaId,
  puedeAnular,
}: Props) {
  const [sharing, setSharing] = useState(false);

  async function compartir() {
    const pdfUrl = `${window.location.origin}/api/facturas/${facturaId}/pdf`;
    const texto = `${titulo} ${numero}\nTotal: ${total}\nCAE: ${cae}\nPDF: ${pdfUrl}`;

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
    <div className="flex flex-col items-center">
      <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        {titulo}
      </h1>
      <p className="mb-6 font-mono text-sm text-neutral-500 dark:text-neutral-400">{numero}</p>

      <div className="mb-6 w-full max-w-sm divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">Total</span>
          <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {total}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">CAE</span>
          <span className="font-mono text-xs text-neutral-900 dark:text-neutral-100">{cae}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">Emitida</span>
          <span className="text-neutral-900 dark:text-neutral-100">{fechaEmision}</span>
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

      <div className="flex w-full max-w-sm flex-col gap-2.5">
        <button
          type="button"
          onClick={compartir}
          disabled={sharing}
          className="rounded-xl bg-[#003366] px-4 py-3.5 text-[15px] font-semibold text-white hover:bg-[#002855] disabled:opacity-50 dark:bg-[#4a90c8] dark:hover:bg-[#3d7ba8]"
        >
          {sharing ? "Compartiendo..." : "Compartir por WhatsApp"}
        </button>
        <a
          href={`/api/facturas/${facturaId}/pdf`}
          download
          className="rounded-xl border-[1.5px] border-[#003366] px-4 py-3 text-center text-sm font-semibold text-[#003366] hover:bg-[#003366]/5 dark:border-[#7bb0e0] dark:text-[#7bb0e0]"
        >
          Descargar PDF
        </a>
        {puedeAnular && (
          <div className="mt-4 border-t border-neutral-200 pt-4 text-center dark:border-neutral-800">
            <AnularFacturaButton facturaId={facturaId} numero={numero} />
          </div>
        )}
      </div>
    </div>
  );
}
