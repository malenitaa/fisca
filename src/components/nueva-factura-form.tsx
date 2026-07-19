"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CONCEPTOS, CONDICION_IVA_RECEPTOR, DOC_TIPOS } from "@/lib/afip/types";
import { nuevaFacturaSchema } from "@/lib/validation";
import { FacturaEmitidaSuccess } from "@/components/factura-emitida-success";

interface Cliente {
  id: string;
  nombre: string;
  doc_tipo: number;
  doc_numero: string;
  condicion_iva_id: number;
}

interface ItemRow {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
}

const emptyItem: ItemRow = { descripcion: "", cantidad: "1", precioUnitario: "" };

interface EmitResult {
  facturaId: string;
  cae: string;
  caeVencimiento: string;
  numeroComprobante: number;
  puntoVenta: number;
}

export function NuevaFacturaForm() {
  const [concepto, setConcepto] = useState(1);
  const [docTipo, setDocTipo] = useState(99);
  const [docNro, setDocNro] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [condicionIva, setCondicionIva] = useState(5);
  const [items, setItems] = useState<ItemRow[]>([{ ...emptyItem }]);
  const [fechaServicioDesde, setFechaServicioDesde] = useState("");
  const [fechaServicioHasta, setFechaServicioHasta] = useState("");
  const [fechaVtoPago, setFechaVtoPago] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<EmitResult | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => (r.ok ? r.json() : { clientes: [] }))
      .then((body) => setClientes(body.clientes ?? []))
      .catch(() => setClientes([]));
  }, []);

  function pickCliente(c: Cliente) {
    setDocTipo(c.doc_tipo);
    setDocNro(c.doc_numero);
    setClienteNombre(c.nombre);
    setCondicionIva(c.condicion_iva_id);
  }

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        const cantidad = Number(item.cantidad) || 0;
        const precio = Number(item.precioUnitario) || 0;
        return sum + cantidad * precio;
      }, 0),
    [items]
  );

  const puedeEmitir = useMemo(() => {
    const hayItemValido = items.some(
      (it) =>
        it.descripcion.trim().length > 0 &&
        Number(it.precioUnitario) > 0 &&
        Number(it.cantidad) > 0
    );
    if (!hayItemValido) return false;
    if (docTipo !== 99 && !docNro.trim()) return false;
    if (
      concepto !== 1 &&
      (!fechaServicioDesde || !fechaServicioHasta || !fechaVtoPago)
    ) {
      return false;
    }
    return true;
  }, [items, docTipo, docNro, concepto, fechaServicioDesde, fechaServicioHasta, fechaVtoPago]);

  function scrollToField(path: string) {
    const el = document.querySelector<HTMLElement>(`[data-field="${path}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(
      "input, select, textarea"
    );
    setTimeout(() => input?.focus(), 300);
  }

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");
    setFieldErrors({});

    const capitalize = (s: string) =>
      s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;

    const payload = {
      concepto,
      docTipo,
      docNro: docTipo === 99 ? "0" : docNro,
      clienteNombre: clienteNombre || undefined,
      condicionIvaReceptorId: condicionIva,
      items: items.map((it) => ({
        descripcion: capitalize(it.descripcion.trim()),
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
      })),
      fechaServicioDesde: fechaServicioDesde || undefined,
      fechaServicioHasta: fechaServicioHasta || undefined,
      fechaVtoPago: fechaVtoPago || undefined,
    };

    const parsed = nuevaFacturaSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path.join(".")] = issue.message;
      }
      setFieldErrors(errs);
      setStatus("error");
      setErrorMessage("Revisá los campos marcados antes de continuar.");
      const firstErrorPath = parsed.error.issues[0]?.path.join(".");
      if (firstErrorPath) scrollToField(firstErrorPath);
      return;
    }

    try {
      const res = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "AFIP rechazó la factura.");
      }
      setResult(body);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Error inesperado.");
    }
  }

  if (result) {
    const clienteLinea =
      docTipo === 99
        ? "Consumidor Final"
        : clienteNombre
        ? `${clienteNombre} · ${docTipo === 80 ? "CUIT" : "DNI"} ${docNro}`
        : `${docTipo === 80 ? "CUIT" : "DNI"} ${docNro}`;
    return (
      <FacturaEmitidaSuccess
        titulo="Factura C"
        numero={`N° ${String(result.puntoVenta).padStart(5, "0")}-${String(
          result.numeroComprobante
        ).padStart(8, "0")}`}
        cae={result.cae}
        caeVencimiento={result.caeVencimiento}
        total={`$${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
        clienteLinea={clienteLinea}
        facturaId={result.facturaId}
        onReset={() => {
          setResult(null);
          setItems([{ ...emptyItem }]);
          setDocNro("");
          setClienteNombre("");
        }}
      />
    );
  }

  const conceptoLabel = CONCEPTOS.find((c) => c.value === concepto)?.label ?? "";
  const condIvaLabel = CONDICION_IVA_RECEPTOR.find((c) => c.value === condicionIva)?.label ?? "";
  const clienteEsCF = docTipo === 99;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* CLIENTE */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Cliente
        </h3>
        <div className="mb-3 flex flex-wrap gap-2">
          {/* Consumidor Final default siempre primero */}
          <button
            type="button"
            onClick={() => {
              setDocTipo(99);
              setDocNro("");
              setClienteNombre("");
              setCondicionIva(5);
            }}
            className={`flex shrink-0 items-center rounded-lg border px-3 py-2 text-xs font-medium transition ${
              clienteEsCF
                ? "border-[#003366] bg-[#003366]/10 text-[#003366] dark:border-[#7bb0e0] dark:bg-[#7bb0e0]/15 dark:text-[#7bb0e0]"
                : "border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
            }`}
          >
            Consumidor Final
          </button>
          {clientes.slice(0, 12).map((c) => {
            const isSelected = !clienteEsCF && docTipo === c.doc_tipo && docNro === c.doc_numero;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCliente(c)}
                className={`flex shrink-0 items-center rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  isSelected
                    ? "border-[#003366] bg-[#003366]/10 text-[#003366] dark:border-[#7bb0e0] dark:bg-[#7bb0e0]/15 dark:text-[#7bb0e0]"
                    : "border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                }`}
              >
                {c.nombre
                  ? `${c.nombre} · ${c.doc_tipo === 80 ? "CUIT" : "DNI"}`
                  : `${c.doc_tipo === 80 ? "CUIT" : "DNI"} ${c.doc_numero}`}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setDocTipo(80);
              setDocNro("");
              setClienteNombre("");
              setCondicionIva(1);
            }}
            className="flex shrink-0 items-center rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
          >
            + Nuevo
          </button>
        </div>

        <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
          <label className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">Concepto</span>
            <div className="relative flex items-center">
              <span className="pr-1 text-neutral-900 dark:text-neutral-100">{conceptoLabel}</span>
              <span className="text-neutral-400">›</span>
              <select
                value={concepto}
                onChange={(e) => setConcepto(Number(e.target.value))}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Concepto"
              >
                {CONCEPTOS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">Condición IVA</span>
            <div className="relative flex items-center">
              <span className="max-w-[12rem] truncate pr-1 text-neutral-900 dark:text-neutral-100">
                {condIvaLabel}
              </span>
              <span className="text-neutral-400">›</span>
              <select
                value={condicionIva}
                onChange={(e) => setCondicionIva(Number(e.target.value))}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Condición IVA"
              >
                {CONDICION_IVA_RECEPTOR.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </label>

          {!clienteEsCF && (
            <>
              <label className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">Tipo</span>
                <div className="relative flex items-center">
                  <span className="pr-1 text-neutral-900 dark:text-neutral-100">
                    {docTipo === 80 ? "CUIT" : "DNI"}
                  </span>
                  <span className="text-neutral-400">›</span>
                  <select
                    value={docTipo}
                    onChange={(e) => setDocTipo(Number(e.target.value))}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Tipo de documento"
                  >
                    {DOC_TIPOS.filter((d) => d.value !== 99).map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <label
                data-field="docNro"
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="text-neutral-500 dark:text-neutral-400">Número</span>
                <input
                  value={docNro}
                  onChange={(e) => setDocNro(e.target.value)}
                  inputMode="numeric"
                  placeholder={docTipo === 80 ? "CUIT" : "DNI"}
                  className="w-1/2 border-0 bg-transparent p-0 text-right text-base text-neutral-900 outline-none focus:ring-0 dark:text-neutral-100"
                />
              </label>
              {fieldErrors["docNro"] && (
                <p className="px-4 pb-2 text-sm text-red-600 dark:text-red-400">
                  {fieldErrors["docNro"]}
                </p>
              )}
              <div className="px-4 py-3 text-sm">
                <input
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  autoCapitalize="words"
                  placeholder="Nombre / Razón social"
                  className="w-full border-0 bg-transparent p-0 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-0 dark:text-neutral-100"
                />
              </div>
            </>
          )}

          {concepto !== 1 && (
            <div
              data-field="fechaServicioDesde"
              className="grid grid-cols-1 gap-3 bg-neutral-50 px-4 py-3 text-sm sm:grid-cols-3 dark:bg-neutral-900/50"
            >
              <div>
                <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">
                  Servicio desde
                </span>
                <input
                  type="date"
                  value={fechaServicioDesde}
                  onChange={(e) => setFechaServicioDesde(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-base dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
              <div>
                <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">
                  Servicio hasta
                </span>
                <input
                  type="date"
                  value={fechaServicioHasta}
                  onChange={(e) => setFechaServicioHasta(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-base dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
              <div>
                <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">
                  Vto. pago
                </span>
                <input
                  type="date"
                  value={fechaVtoPago}
                  onChange={(e) => setFechaVtoPago(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-base dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
              {fieldErrors["fechaServicioDesde"] && (
                <p className="text-sm text-red-600 sm:col-span-3 dark:text-red-400">
                  {fieldErrors["fechaServicioDesde"]}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ÍTEMS */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Ítems
        </h3>
        <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
          {items.map((item, index) => {
            const cantN = Number(item.cantidad) || 0;
            const precN = Number(item.precioUnitario) || 0;
            const subtotal = cantN * precN;
            return (
              <div key={index} data-field={`items.${index}.descripcion`} className="px-4 py-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <input
                    value={item.descripcion}
                    onChange={(e) => updateItem(index, { descripcion: e.target.value })}
                    placeholder=""
                    autoCapitalize="sentences"
                    spellCheck
                    className="flex-1 border-0 bg-transparent p-0 text-[14px] font-medium text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-0 dark:text-neutral-100"
                  />
                  <span className="min-w-[5rem] text-right text-sm font-semibold text-neutral-900 tabular-nums dark:text-neutral-100">
                    ${subtotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                  <input
                    value={item.cantidad}
                    onChange={(e) => updateItem(index, { cantidad: e.target.value })}
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    placeholder=""
                    className="w-12 rounded-md border border-neutral-200 px-1.5 py-0.5 text-xs text-neutral-700 outline-none focus:border-[#003366] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:focus:border-[#7bb0e0]"
                  />
                  <span>×</span>
                  <input
                    value={item.precioUnitario}
                    onChange={(e) => updateItem(index, { precioUnitario: e.target.value })}
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    placeholder=""
                    className="flex-1 rounded-md border border-neutral-200 px-1.5 py-0.5 text-xs text-neutral-700 outline-none focus:border-[#003366] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:focus:border-[#7bb0e0]"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      aria-label="Quitar ítem"
                      className="text-neutral-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addItem}
            className="w-full px-4 py-3 text-left text-sm font-semibold text-[#003366] hover:bg-[#003366]/5 dark:text-[#7bb0e0] dark:hover:bg-[#7bb0e0]/10"
          >
            + Agregar ítem
          </button>
        </div>
        {fieldErrors["items"] && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors["items"]}</p>
        )}
      </section>

      {status === "error" && errorMessage && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      {/* Sticky al fondo del scroll container (main). Como main llega hasta
       * el tab bar (que es shrink-0), el Emitir se pega justo arriba. */}
      <div className="sticky bottom-0 -mx-4 border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">Total</span>
            <span className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
              ${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <button
            type="submit"
            disabled={status === "submitting"}
            className={`w-full rounded-xl px-3 py-3.5 text-[15px] font-semibold text-white ${
              puedeEmitir
                ? "bg-[#003366] hover:bg-[#002855] dark:bg-[#4a90c8] dark:hover:bg-[#3d7ba8]"
                : "bg-neutral-300 dark:bg-neutral-700"
            } disabled:opacity-50`}
          >
            {status === "submitting" ? "Emitiendo..." : "Emitir factura C"}
          </button>
        </div>
      </div>
    </form>
  );
}
