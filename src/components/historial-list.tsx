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

  // Resumen del período actual (mes en curso), separando por moneda para
  // no mezclar pesos con dólares. Ignora anuladas.
  const currentMonth = new Date().toISOString().slice(0, 7);
  const summary = useMemo(() => {
    const filas = invoices.filter(
      (i) => i.fecha_emision.startsWith(currentMonth) && !idsAnulados.has(i.id)
    );
    const totalArs = filas
      .filter((i) => !i.moneda || i.moneda === "PES")
      .reduce((s, i) => s + Number(i.importe_total), 0);
    const totalUsd = filas
      .filter((i) => i.moneda === "DOL")
      .reduce((s, i) => s + Number(i.importe_total), 0);
    return { totalArs, totalUsd, count: filas.length };
  }, [invoices, idsAnulados, currentMonth]);

  return (
    <div>
      {/* Card resumen del mes en curso — separado por moneda para no mezclar
       * pesos con dólares. Si sólo hay una moneda, se muestra sólo esa. */}
      <div className="mb-4 rounded-2xl bg-[#003366] p-4 text-white dark:bg-[#4a90c8]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs opacity-80">Facturado este mes</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              $
              {summary.totalArs.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </p>
            {summary.totalUsd > 0 && (
              <p className="mt-1 text-sm opacity-90 tabular-nums">
                + US$
                {summary.totalUsd.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs opacity-80">Comprobantes</p>
            <p className="mt-1 text-2xl font-semibold">{summary.count}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="todos">Todos</option>
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
          <option value="nota">N. de crédito</option>
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
        <div className="space-y-2">
          {filtered.map((inv) => {
            const esNotaCredito =
              inv.cbte_tipo === CBTE_TIPO_NOTA_CREDITO_C ||
              inv.cbte_tipo === CBTE_TIPO_NOTA_CREDITO_E;
            const esE =
              inv.cbte_tipo === CBTE_TIPO_FACTURA_E ||
              inv.cbte_tipo === CBTE_TIPO_NOTA_CREDITO_E;
            const estaAnulada = idsAnulados.has(inv.id);
            const simbolo = monedaSimbolo(inv.moneda);
            const tipoAbrev = badgeForTipo(inv.cbte_tipo).replace("Factura ", "");
            const numeroCorto = `${tipoAbrev} ${String(inv.punto_venta).padStart(5, "0")}-${String(
              inv.numero_comprobante
            ).padStart(8, "0")}`;
            const nombreCliente = esE
              ? inv.cliente_nombre || "Cliente extranjero"
              : inv.cliente_doc_tipo === 99
              ? "Consumidor Final"
              : inv.cliente_nombre
              ? `${inv.cliente_nombre}${inv.cliente_doc_tipo === 96 ? " · DNI" : ""}`
              : inv.cliente_doc_nro ?? "Cliente";
            return (
              <div
                key={inv.id}
                className={`flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950 ${
                  estaAnulada ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    <span className="truncate">{nombreCliente}</span>
                    {estaAnulada && (
                      <span className="rounded-md border border-red-200 px-1.5 py-0 text-[10px] font-semibold uppercase text-red-600 dark:border-red-900/60 dark:text-red-400">
                        ANULADA
                      </span>
                    )}
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                    {numeroCorto} · {inv.fecha_emision}
                    {inv.ambiente === "homologacion" && " · homolog."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      esNotaCredito
                        ? "text-red-600 dark:text-red-400"
                        : "text-neutral-900 dark:text-neutral-100"
                    }`}
                  >
                    {esNotaCredito && "−"}
                    {simbolo}
                    {Number(inv.importe_total).toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <a
                    href={`/api/facturas/${inv.id}/pdf`}
                    download
                    aria-label="Descargar PDF"
                    className="text-neutral-400 hover:text-[#003366] dark:hover:text-[#7bb0e0]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
                    </svg>
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
