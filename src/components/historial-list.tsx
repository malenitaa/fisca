"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CBTE_TIPO_FACTURA_E,
  CBTE_TIPO_NOTA_CREDITO_C,
  CBTE_TIPO_NOTA_CREDITO_E,
  MONEDAS,
} from "@/lib/afip/types";

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

  // Totales de lo filtrado, separados por moneda. Excluimos NC (son la
  // contraparte contable de una anulada, sumarlas cuenta doble) y las
  // anuladas mismas (ya no valen). O sea: es el neto realmente facturado
  // dentro del filtro.
  const totales = useMemo(() => {
    const validas = filtered.filter(
      (i) =>
        !idsAnulados.has(i.id) &&
        i.cbte_tipo !== CBTE_TIPO_NOTA_CREDITO_C &&
        i.cbte_tipo !== CBTE_TIPO_NOTA_CREDITO_E
    );
    const ars = validas
      .filter((i) => !i.moneda || i.moneda === "PES")
      .reduce((s, i) => s + Number(i.importe_total), 0);
    const usd = validas
      .filter((i) => i.moneda === "DOL")
      .reduce((s, i) => s + Number(i.importe_total), 0);
    return { ars, usd, tieneAmbas: ars > 0 && usd > 0 };
  }, [filtered, idsAnulados]);

  // Resumen del período actual (mes en curso). Muestra sólo facturas
  // VÁLIDAS (no anuladas), separando por moneda. Excluye las notas de
  // crédito de la suma porque conceptualmente son la anulación de la
  // factura correspondiente — sumarlas contaría dos veces (una la
  // factura, otra su NC), y como al anularse la factura ya se filtró,
  // sumar la NC daría un total al revés.
  const currentMonth = new Date().toISOString().slice(0, 7);
  const summary = useMemo(() => {
    const filas = invoices.filter(
      (i) =>
        i.fecha_emision.startsWith(currentMonth) &&
        !idsAnulados.has(i.id) &&
        i.cbte_tipo !== CBTE_TIPO_NOTA_CREDITO_C &&
        i.cbte_tipo !== CBTE_TIPO_NOTA_CREDITO_E
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
      {/* Card resumen: la moneda con mayor volumen se muestra como principal
       * (destacado grande). La otra, si existe, va abajo con tamaño chico.
       * Comparamos por valor absoluto; el peso argentino es típicamente
       * mucho más "grande" numéricamente que USD, así que también miramos
       * el equivalente en pesos aproximado — pero para no depender de una
       * cotización, comparamos por cantidad de facturas y usamos como
       * criterio cuál tiene mayor total en su propia moneda. */}
      {(() => {
        const arsCount = summary.totalArs > 0 ? 1 : 0;
        const usdCount = summary.totalUsd > 0 ? 1 : 0;
        // Si solo hay USD, USD es principal. Si solo ARS, ARS principal.
        // Si hay ambas, mostramos como principal la que tenga MAYOR
        // magnitud comparada en su propia unidad (más facturas emitidas
        // en esa moneda).
        const arsInvoices = invoices.filter(
          (i) =>
            i.fecha_emision.startsWith(currentMonth) &&
            !idsAnulados.has(i.id) &&
            i.cbte_tipo !== CBTE_TIPO_NOTA_CREDITO_C &&
            i.cbte_tipo !== CBTE_TIPO_NOTA_CREDITO_E &&
            (!i.moneda || i.moneda === "PES")
        ).length;
        const usdInvoices = invoices.filter(
          (i) =>
            i.fecha_emision.startsWith(currentMonth) &&
            !idsAnulados.has(i.id) &&
            i.cbte_tipo !== CBTE_TIPO_NOTA_CREDITO_C &&
            i.cbte_tipo !== CBTE_TIPO_NOTA_CREDITO_E &&
            i.moneda === "DOL"
        ).length;
        const usdEsPrincipal =
          usdCount > 0 && (arsCount === 0 || usdInvoices >= arsInvoices);
        const principal = usdEsPrincipal
          ? { symbol: "US$", total: summary.totalUsd }
          : { symbol: "$", total: summary.totalArs };
        const secundario = usdEsPrincipal
          ? summary.totalArs > 0
            ? { symbol: "$", total: summary.totalArs }
            : null
          : summary.totalUsd > 0
          ? { symbol: "US$", total: summary.totalUsd }
          : null;
        return (
          <div className="mb-4 rounded-2xl bg-[#003366] p-4 text-white dark:bg-[#4a90c8]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs opacity-80">Facturado este mes</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {principal.symbol}
                  {principal.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </p>
                {secundario && (
                  <p className="mt-1 text-sm opacity-90 tabular-nums">
                    + {secundario.symbol}
                    {secundario.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs opacity-80">Comprobantes</p>
                <p className="mt-1 text-2xl font-semibold">{summary.count}</p>
              </div>
            </div>
          </div>
        );
      })()}

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
          <span className="text-right">
            {totales.ars === 0 && totales.usd === 0 ? (
              <span className="italic">Sin válidas</span>
            ) : (
              <>
                {totales.ars > 0 && (
                  <>Neto: ${totales.ars.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</>
                )}
                {totales.tieneAmbas && <> · </>}
                {totales.usd > 0 && (
                  <>{totales.ars > 0 ? "" : "Neto: "}US${totales.usd.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</>
                )}
              </>
            )}
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
              <Link
                key={inv.id}
                href={`/facturas/${inv.id}`}
                className={`flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3 transition hover:border-[#003366]/40 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-[#7bb0e0]/40 ${
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
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 text-neutral-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
