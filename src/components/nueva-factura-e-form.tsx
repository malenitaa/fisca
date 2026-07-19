"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { IDIOMA_CBTE, MONEDAS, PAISES, TIPO_EXPO } from "@/lib/afip/types";
import { nuevaFacturaESchema } from "@/lib/validation";
import { FacturaEmitidaSuccess } from "@/components/factura-emitida-success";

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
  moneda: string;
}

export function NuevaFacturaEForm() {
  const [clienteNombre, setClienteNombre] = useState("");
  const [paisIdx, setPaisIdx] = useState(0);
  const [clienteDomicilio, setClienteDomicilio] = useState("");
  const [clienteIdImpositivo, setClienteIdImpositivo] = useState("");
  const [monedaId, setMonedaId] = useState<string>("DOL");
  const [monedaCotizacion, setMonedaCotizacion] = useState("");
  const [tipoExpo, setTipoExpo] = useState<number>(2);
  const [idiomaCbte, setIdiomaCbte] = useState<number>(1);
  const [fechaPago, setFechaPago] = useState<string>(() => {
    // Default: hoy + 30 días (razonable para servicios facturados por Deel).
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [items, setItems] = useState<ItemRow[]>([{ ...emptyItem }]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<EmitResult | null>(null);
  const [cotizStatus, setCotizStatus] = useState<"idle" | "loading" | "error">("idle");

  const traerCotizacion = useCallback(async () => {
    setCotizStatus("loading");
    try {
      // Consulta directa a AFIP (WSFEXv1 FEXGetPARAM_Ctz) por nuestro
      // backend. Es la única fuente que ARCA acepta sin rechazar por
      // diferencia de decimales al emitir Factura E.
      const res = await fetch(`/api/facturas/e/cotizacion?moneda=${monedaId}`);
      const body = (await res.json()) as { cotizacion?: number; error?: string };
      if (body.cotizacion) {
        setMonedaCotizacion(String(body.cotizacion));
        setCotizStatus("idle");
      } else {
        setCotizStatus("error");
      }
    } catch {
      setCotizStatus("error");
    }
  }, [monedaId]);

  // Al abrir el form (o cambiar a USD), auto-cargamos la cotización oficial.
  // Si falla el fetch, queda vacío y el usuario puede cargarla a mano.
  useEffect(() => {
    if (monedaId === "DOL" && !monedaCotizacion) {
      void traerCotizacion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monedaId]);

  const pais = PAISES[paisIdx];
  const moneda = MONEDAS.find((m) => m.value === monedaId) ?? MONEDAS[0];

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        const cantidad = Number(item.cantidad) || 0;
        const precio = Number(item.precioUnitario) || 0;
        return sum + cantidad * precio;
      }, 0),
    [items]
  );

  const totalArs = total * (Number(monedaCotizacion) || 0);

  const puedeEmitir = useMemo(() => {
    if (!clienteNombre.trim()) return false;
    if (!clienteDomicilio.trim()) return false;
    if (!(Number(monedaCotizacion) > 0)) return false;
    if ((tipoExpo === 2 || tipoExpo === 4) && !fechaPago) return false;
    const hayItemValido = items.some(
      (it) =>
        it.descripcion.trim().length > 0 &&
        Number(it.precioUnitario) > 0 &&
        Number(it.cantidad) > 0
    );
    return hayItemValido;
  }, [clienteNombre, clienteDomicilio, monedaCotizacion, tipoExpo, fechaPago, items]);

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
      clienteNombre: capitalize(clienteNombre.trim()),
      clientePais: pais.codigoPais,
      clienteCuitPais: pais.cuitPais,
      clienteDomicilio: clienteDomicilio || undefined,
      clienteIdImpositivo: clienteIdImpositivo || undefined,
      monedaId,
      monedaCotizacion,
      tipoExpo,
      idiomaCbte,
      fechaPago: fechaPago || undefined,
      items: items.map((it) => ({
        descripcion: capitalize(it.descripcion.trim()),
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
      })),
    };

    const parsed = nuevaFacturaESchema.safeParse(payload);
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
      const res = await fetch("/api/facturas/e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "AFIP rechazó la Factura E.");
      setResult(body);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Error inesperado.");
    }
  }

  if (result) {
    return (
      <FacturaEmitidaSuccess
        titulo="Factura E"
        numero={`N° ${String(result.puntoVenta).padStart(5, "0")}-${String(
          result.numeroComprobante
        ).padStart(8, "0")}`}
        cae={result.cae}
        caeVencimiento={result.caeVencimiento}
        total={`${moneda.symbol}${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
        clienteLinea={`${clienteNombre} · ${pais.label}`}
        facturaId={result.facturaId}
        onReset={() => {
          setResult(null);
          setItems([{ ...emptyItem }]);
          setClienteNombre("");
          setClienteDomicilio("");
          setClienteIdImpositivo("");
          setMonedaCotizacion("");
        }}
      />
    );
  }

  const tipoExpoLabel = TIPO_EXPO.find((t) => t.value === tipoExpo)?.label ?? "";
  const idiomaLabel = IDIOMA_CBTE.find((l) => l.value === idiomaCbte)?.label ?? "";
  const monedaFull = MONEDAS.find((m) => m.value === monedaId) ?? MONEDAS[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-32">
      {/* CLIENTE DEL EXTERIOR */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Cliente del exterior
        </h3>
        <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
          <div data-field="clienteNombre" className="px-4 py-3 text-sm">
            <input
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              autoCapitalize="words"
              placeholder="Nombre / Razón social"
              className="w-full border-0 bg-transparent p-0 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-0 dark:text-neutral-100"
            />
            {fieldErrors["clienteNombre"] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {fieldErrors["clienteNombre"]}
              </p>
            )}
          </div>
          <label className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">País</span>
            <div className="relative flex items-center">
              <span className="pr-1 text-neutral-900 dark:text-neutral-100">{pais.label}</span>
              <span className="text-neutral-400">›</span>
              <select
                value={paisIdx}
                onChange={(e) => setPaisIdx(Number(e.target.value))}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="País de destino"
              >
                {PAISES.map((p, i) => (
                  <option key={p.codigoPais} value={i}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <div data-field="clienteDomicilio" className="px-4 py-3 text-sm">
            <input
              value={clienteDomicilio}
              onChange={(e) => setClienteDomicilio(e.target.value)}
              autoCapitalize="words"
              placeholder="Domicilio"
              className="w-full border-0 bg-transparent p-0 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-0 dark:text-neutral-100"
            />
            {fieldErrors["clienteDomicilio"] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {fieldErrors["clienteDomicilio"]}
              </p>
            )}
          </div>
          <div className="px-4 py-3 text-sm">
            <input
              value={clienteIdImpositivo}
              onChange={(e) => setClienteIdImpositivo(e.target.value)}
              placeholder="ID fiscal extranjero (opcional)"
              className="w-full border-0 bg-transparent p-0 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-0 dark:text-neutral-100"
            />
          </div>
        </div>
      </section>

      {/* COMPROBANTE */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Comprobante
        </h3>
        <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
          <label className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">Moneda</span>
            <div className="relative flex items-center">
              <span className="pr-1 text-neutral-900 dark:text-neutral-100">
                {monedaFull.label}
              </span>
              <span className="text-neutral-400">›</span>
              <select
                value={monedaId}
                onChange={(e) => setMonedaId(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Moneda"
              >
                {MONEDAS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <div data-field="monedaCotizacion" className="px-4 py-3 text-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Cotización oficial de AFIP
              </span>
              <button
                type="button"
                onClick={traerCotizacion}
                disabled={cotizStatus === "loading"}
                className="text-xs font-semibold text-[#003366] disabled:opacity-50 dark:text-[#7bb0e0]"
              >
                {cotizStatus === "loading" ? "..." : "Traer"}
              </button>
            </div>
            <input
              value={monedaCotizacion}
              onChange={(e) => setMonedaCotizacion(e.target.value)}
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              className="w-full border-0 bg-transparent p-0 text-base tabular-nums text-neutral-900 outline-none focus:ring-0 dark:text-neutral-100"
            />
            {(fieldErrors["monedaCotizacion"] || cotizStatus === "error") && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors["monedaCotizacion"] ??
                  "No se pudo traer la cotización — cargala a mano."}
              </p>
            )}
          </div>
          {(tipoExpo === 2 || tipoExpo === 4) && (
            <div data-field="fechaPago" className="px-4 py-3 text-sm">
              <span className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">
                Fecha de pago
              </span>
              <input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="w-full border-0 bg-transparent p-0 text-base text-neutral-900 outline-none focus:ring-0 dark:text-neutral-100"
              />
              {fieldErrors["fechaPago"] && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {fieldErrors["fechaPago"]}
                </p>
              )}
            </div>
          )}
          <label className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">Tipo</span>
            <div className="relative flex items-center">
              <span className="pr-1 text-neutral-900 dark:text-neutral-100">{tipoExpoLabel}</span>
              <span className="text-neutral-400">›</span>
              <select
                value={tipoExpo}
                onChange={(e) => setTipoExpo(Number(e.target.value))}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Tipo de exportación"
              >
                {TIPO_EXPO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">Idioma</span>
            <div className="relative flex items-center">
              <span className="pr-1 text-neutral-900 dark:text-neutral-100">{idiomaLabel}</span>
              <span className="text-neutral-400">›</span>
              <select
                value={idiomaCbte}
                onChange={(e) => setIdiomaCbte(Number(e.target.value))}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Idioma del comprobante"
              >
                {IDIOMA_CBTE.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </label>
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
              <div key={index} className="px-4 py-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <input
                    value={item.descripcion}
                    onChange={(e) => updateItem(index, { descripcion: e.target.value })}
                    autoCapitalize="sentences"
                    spellCheck
                    className="flex-1 border-0 bg-transparent p-0 text-[14px] font-medium text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-0 dark:text-neutral-100"
                  />
                  <span className="min-w-[5rem] text-right text-sm font-semibold text-neutral-900 tabular-nums dark:text-neutral-100">
                    {monedaFull.symbol}
                    {subtotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
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

      {/* Fixed arriba del tab bar */}
      <div
        className="fixed inset-x-0 z-20 border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 3.5rem)",
          willChange: "transform",
          transform: "translateZ(0)",
        }}
      >
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">Total</span>
            <span className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
              {moneda.symbol}
              {total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          {totalArs > 0 && (
            <div className="mb-2 flex items-baseline justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span>En pesos</span>
              <span className="tabular-nums">
                ${totalArs.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <button
            type="submit"
            disabled={status === "submitting"}
            className={`w-full rounded-xl px-3 py-3.5 text-[15px] font-semibold text-white ${
              puedeEmitir
                ? "bg-[#003366] hover:bg-[#002855] dark:bg-[#4a90c8] dark:hover:bg-[#3d7ba8]"
                : "bg-neutral-300 dark:bg-neutral-700"
            } disabled:opacity-50`}
          >
            {status === "submitting" ? "Emitiendo..." : "Emitir factura E"}
          </button>
        </div>
      </div>
    </form>
  );
}
