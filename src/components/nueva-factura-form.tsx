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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {clientes.length > 0 && (
        <section>
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Facturar a
          </label>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {clientes.slice(0, 12).map((c) => {
              const isSelected =
                docTipo === c.doc_tipo && docNro === c.doc_numero && docTipo !== 99;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickCliente(c)}
                  className={`flex shrink-0 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-xs transition ${
                    isSelected
                      ? "border-[#003366] bg-[#003366]/10 dark:border-[#7bb0e0] dark:bg-[#7bb0e0]/15"
                      : "border-neutral-200 bg-white hover:border-[#003366]/40 hover:bg-[#003366]/5 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-[#7bb0e0]/40"
                  }`}
                >
                  <span className="max-w-[10rem] truncate font-medium text-neutral-900 dark:text-neutral-100">
                    {c.nombre || `${c.doc_tipo === 80 ? "CUIT" : "DNI"} ${c.doc_numero}`}
                  </span>
                  {c.nombre && (
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {c.doc_tipo === 80 ? "CUIT" : "DNI"} {c.doc_numero}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setDocTipo(99);
                setDocNro("");
                setClienteNombre("");
                setCondicionIva(5);
              }}
              className="flex shrink-0 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-transparent px-3 py-2 text-xs text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400"
            >
              Nuevo
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Concepto</label>
          <select
            value={concepto}
            onChange={(e) => setConcepto(Number(e.target.value))}
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
          >
            {CONCEPTOS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Condición IVA del cliente
          </label>
          <select
            value={condicionIva}
            onChange={(e) => setCondicionIva(Number(e.target.value))}
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
          >
            {CONDICION_IVA_RECEPTOR.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {concepto !== 1 && (
        <div className="grid grid-cols-1 gap-3 rounded-md bg-neutral-50 p-3 sm:grid-cols-3 dark:bg-neutral-900">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Servicio desde
            </label>
            <input
              type="date"
              value={fechaServicioDesde}
              onChange={(e) => setFechaServicioDesde(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Servicio hasta
            </label>
            <input
              type="date"
              value={fechaServicioHasta}
              onChange={(e) => setFechaServicioHasta(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Vencimiento de pago
            </label>
            <input
              type="date"
              value={fechaVtoPago}
              onChange={(e) => setFechaVtoPago(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
            />
          </div>
          {fieldErrors["fechaServicioDesde"] && (
            <p className="text-sm text-red-600 sm:col-span-3 dark:text-red-400">
              {fieldErrors["fechaServicioDesde"]}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Cliente</label>
          <select
            value={docTipo}
            onChange={(e) => setDocTipo(Number(e.target.value))}
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
          >
            {DOC_TIPOS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {docTipo === 99 ? "N° documento (no aplica)" : "N° documento"}
          </label>
          <input
            value={docTipo === 99 ? "" : docNro}
            onChange={(e) => setDocNro(e.target.value)}
            disabled={docTipo === 99}
            placeholder={docTipo === 80 ? "20111111112" : "12345678"}
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 disabled:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100 dark:disabled:bg-neutral-800"
          />
          {fieldErrors["docNro"] && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors["docNro"]}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Nombre (opcional)
          </label>
          <input
            value={clienteNombre}
            onChange={(e) => setClienteNombre(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Ítems
        </label>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2">
              <input
                value={item.descripcion}
                onChange={(e) => updateItem(index, { descripcion: e.target.value })}
                placeholder="Descripción"
                autoCapitalize="sentences"
                spellCheck
                className="col-span-6 rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
              />
              <input
                value={item.cantidad}
                onChange={(e) => updateItem(index, { cantidad: e.target.value })}
                type="number"
                min={0}
                step="any"
                placeholder="Cant."
                className="col-span-2 rounded-md border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
              />
              <input
                value={item.precioUnitario}
                onChange={(e) => updateItem(index, { precioUnitario: e.target.value })}
                type="number"
                min={0}
                step="any"
                placeholder="Precio"
                className="col-span-3 rounded-md border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="col-span-1 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                aria-label="Quitar ítem"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {fieldErrors["items"] && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors["items"]}</p>
        )}
        <button
          type="button"
          onClick={addItem}
          className="mt-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          + Agregar ítem
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">Total</span>
        <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          ${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
        </span>
      </div>

      {status === "error" && errorMessage && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-md bg-neutral-900 px-3 py-2.5 font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {status === "submitting" ? "Emitiendo..." : "Emitir factura"}
      </button>
    </form>
  );
}
