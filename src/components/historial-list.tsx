"use client";

import { useMemo, useState } from "react";
import {
  CBTE_TIPO_FACTURA_E,
  CBTE_TIPO_NOTA_CREDITO_C,
  CBTE_TIPO_NOTA_CREDITO_E,
  MONEDAS,
} from "@/lib/afip/types";
import { AnularFacturaButton } from "@/components/anular-factura-button";

interface Invoice {
  id: string;
  cbte_tipo: number;
  punto_venta: number;
  numero_comprobante: number;
  fecha_emision: string;
  cliente_nombre: string | null;
  cliente_doc_nro: string | null;
  cliente_doc_tipo: number | null;
  importe_total: number;
  ambiente: string;
  comprobante_asociado_id: string | null;
  moneda?: string;
}

function badgeForTipo(cbteTipo: number): string {
  switch (cbteTipo) {
    case CBTE_TIPO_NOTA_CREDITO_C:
      return "NC C";
    case CBTE_TIPO_FACTURA_E:
      return "Factura E";
    case CBTE_TIPO_NOTA_CREDITO_E:
      return "NC E";
    default:
      return "Factura C";
  }
}

function monedaSimbolo(value?: string): string {
  if (!value || value === "PES") return "$";
  return MONEDAS.find((m) => m.value === value)?.symbol ?? value;
}

type Estado = "todos" | "validos" | "anulados";
type Tipo = "todos" | "factura_c" | "factura_e" | "nota";

const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function periodoLabel(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MESES[Number(m) - 1]} ${y}`;
}

export function HistorialList({ invoices }: { invoices: Invoice[] }) {
  const idsAnulados = useMemo(
    () => new Set(invoices.map((inv) => inv.comprobante_asociado_id).filter(Boolean)),
    [invoices]
  );

  const periodos = useMemo(() => {
    const set = new Set<string>();
    for (const inv of invoices) {
      if (inv.fecha_emision) set.add(inv.fecha_emision.slice(0, 7));
    }
    return Array.from(set).sort().reverse();
  }, [invoices]);

  const [periodo, setPeriodo] = useState<string>("todos");
  const [estado, setEstado] = useState<Estado>("todos");
  const [tipo, setTipo] = useState<Tipo>("todos");

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (periodo !== "todos" && !inv.fecha_emision.startsWith(periodo)) return false;
      const esNC =
        inv.cbte_tipo === CBTE_TIPO_NOTA_CREDITO_C ||
        inv.cbte_tipo === CBTE_TIPO_NOTA_CREDITO_E;
      if (tipo === "factura_c" && inv.cbte_tipo !== 11) return false;
      if (tipo === "factura_e" && inv.cbte_tipo !== CBTE_TIPO_FACTURA_E) return false;
      if (tipo === "nota" && !esNC) return false;
      const anulada = idsAnulados.has(inv.id);
      if (estado === "anulados" && !anulada) return false;
      if (estado === "validos" && anulada) return false;
      return true;
    });
  }, [invoices, periodo, estado, tipo, idsAnulados]);

  const total = useMemo(
    () => filtered.reduce((sum, i) => sum + Number(i.importe_total), 0),
    [filtered]
  );

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="todos">Todos los meses</option>
          {periodos.map((p) => (
            <option key={p} value={p}>
              {periodoLabel(p)}
            </option>
          ))}
        </select>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as Estado)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="todos">Estado</option>
          <option value="validos">Válidas</option>
          <option value="anulados">Anuladas</option>
        </select>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as Tipo)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="todos">Tipo</option>
          <option value="factura_c">Factura C</option>
          <option value="factura_e">Factura E</option>
          <option value="nota">Notas de crédito</option>
        </select>
      </div>

      {filtered.length > 0 && (
        <div className="mb-3 flex items-center justify-between border-b border-neutral-200 pb-2 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <span>
            {filtered.length} comprobante{filtered.length === 1 ? "" : "s"}
          </span>
          <span>
            Total: ${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          No hay comprobantes que coincidan con los filtros.
        </p>
      ) : (
        <div className="divide-y divide-neutral-200 border-b border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {filtered.map((inv) => {
            const esNotaCredito =
              inv.cbte_tipo === CBTE_TIPO_NOTA_CREDITO_C ||
              inv.cbte_tipo === CBTE_TIPO_NOTA_CREDITO_E;
            const esE =
              inv.cbte_tipo === CBTE_TIPO_FACTURA_E ||
              inv.cbte_tipo === CBTE_TIPO_NOTA_CREDITO_E;
            const estaAnulada = idsAnulados.has(inv.id);
            const simbolo = monedaSimbolo(inv.moneda);
            return (
              <div
                key={inv.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    <span>
                      {String(inv.punto_venta).padStart(5, "0")}-
                      {String(inv.numero_comprobante).padStart(8, "0")}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                      {badgeForTipo(inv.cbte_tipo)}
                    </span>
                    {estaAnulada && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
                        Anulada
                      </span>
                    )}
                    {inv.ambiente === "homologacion" && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                        Homolog.
                      </span>
                    )}
                  </p>
                  <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {inv.fecha_emision} ·{" "}
                    {esE
                      ? inv.cliente_nombre || "Cliente extranjero"
                      : inv.cliente_doc_tipo === 99
                      ? "Consumidor Final"
                      : inv.cliente_nombre || inv.cliente_doc_nro}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {simbolo}
                    {Number(inv.importe_total).toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <a
                    href={`/api/facturas/${inv.id}/pdf`}
                    target="_blank"
                    className="text-sm font-medium text-[#003366] hover:underline dark:text-[#7bb0e0]"
                  >
                    PDF
                  </a>
                  {!esNotaCredito && !esE && !estaAnulada && (
                    <AnularFacturaButton
                      facturaId={inv.id}
                      numero={`${String(inv.punto_venta).padStart(5, "0")}-${String(
                        inv.numero_comprobante
                      ).padStart(8, "0")}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
