"use client";

import { useState } from "react";
import { AnularFacturaButton } from "@/components/anular-factura-button";

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

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
  const [downloading, setDownloading] = useState(false);

  async function fetchPdfBlob(): Promise<Blob> {
    const res = await fetch(`/api/facturas/${facturaId}/pdf`);
    if (!res.ok) throw new Error("No se pudo obtener el PDF.");
    return res.blob();
  }

  /** Descarga in-app: en Capacitor abrimos el share sheet nativo con el
   * archivo (permite "Save to Files", "Enviar por AirDrop", etc.); en
   * browser común, guardamos vía <a download> con blob URL. Nunca abrimos
   * SFSafariViewController porque su cookie jar es distinto y pide login. */
  async function descargar(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    setDownloading(true);
    try {
      const blob = await fetchPdfBlob();
      const filename = `factura-${numero}.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });

      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
      const isNative = cap?.isNativePlatform?.() ?? false;

      if (isNative && nav.share && nav.canShare?.({ files: [file] })) {
        // iOS share sheet: incluye "Guardar en archivos" como opción.
        await nav.share({ files: [file], title: filename });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      // Cancelado o error — no-op.
    } finally {
      setDownloading(false);
    }
  }

  async function compartir() {
    setSharing(true);
    const texto = `${titulo} ${numero}\nTotal: ${total}\nCAE: ${cae}`;
    try {
      const blob = await fetchPdfBlob();
      const file = new File([blob], `factura-${numero}.pdf`, {
        type: "application/pdf",
      });
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };

      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: `${titulo} ${numero}`, text: texto });
      } else if (nav.share) {
        await nav.share({ title: `${titulo} ${numero}`, text: texto });
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
      }
    } catch {
      // Cancelado o error — no-op.
    } finally {
      setSharing(false);
    }
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
          onClick={descargar}
          className="rounded-xl border-[1.5px] border-[#003366] px-4 py-3 text-center text-sm font-semibold text-[#003366] hover:bg-[#003366]/5 dark:border-[#7bb0e0] dark:text-[#7bb0e0]"
        >
          {downloading ? "Descargando..." : "Descargar PDF"}
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
