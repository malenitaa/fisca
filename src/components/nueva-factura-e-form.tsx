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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section>
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Cliente extranjero
        </label>
        <input
          value={clienteNombre}
          onChange={(e) => setClienteNombre(e.target.value)}
          placeholder=""
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
        />
        {fieldErrors["clienteNombre"] && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors["clienteNombre"]}</p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            País de destino
          </label>
          <select
            value={paisIdx}
            onChange={(e) => setPaisIdx(Number(e.target.value))}
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
          >
            {PAISES.map((p, i) => (
              <option key={p.codigoPais} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            ID fiscal extranjero (opcional)
          </label>
          <input
            value={clienteIdImpositivo}
            onChange={(e) => setClienteIdImpositivo(e.target.value)}
            placeholder=""
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Domicilio del cliente
        </label>
        <input
          value={clienteDomicilio}
          onChange={(e) => setClienteDomicilio(e.target.value)}
          placeholder=""
          autoCapitalize="words"
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
        />
        {fieldErrors["clienteDomicilio"] && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {fieldErrors["clienteDomicilio"]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Moneda
          </label>
          <select
            value={monedaId}
            onChange={(e) => setMonedaId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
          >
            {MONEDAS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Cotización → ARS
          </label>
          <div className="flex gap-2">
            <input
              value={monedaCotizacion}
              onChange={(e) => setMonedaCotizacion(e.target.value)}
              type="number"
              min={0}
              step="any"
              placeholder=""
              className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
            />
            <button
              type="button"
              onClick={traerCotizacion}
              disabled={cotizStatus === "loading"}
              className="shrink-0 rounded-md border border-[#003366] px-3 text-xs font-medium text-[#003366] hover:bg-[#003366]/5 disabled:opacity-50 dark:border-[#7bb0e0] dark:text-[#7bb0e0] dark:hover:bg-[#7bb0e0]/10"
            >
              {cotizStatus === "loading" ? "..." : "Traer"}
            </button>
          </div>
          {fieldErrors["monedaCotizacion"] && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {fieldErrors["monedaCotizacion"]}
            </p>
          )}
          {cotizStatus === "error" && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              No se pudo traer la cotización — cargala a mano.
            </p>
          )}
        </div>
      </div>
      <p className="-mt-4 text-xs text-neutral-500 dark:text-neutral-400">
        &quot;Traer&quot; consulta la cotización oficial que AFIP tiene registrada
        para hoy — es exactamente la que ARCA acepta al emitir la Factura E.
      </p>

      {(tipoExpo === 2 || tipoExpo === 4) && (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Fecha de pago
          </label>
          <input
            type="date"
            value={fechaPago}
            onChange={(e) => setFechaPago(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
          />
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            AFIP exige la fecha de pago en Factura E de servicios. Default: 30 días
            desde hoy.
          </p>
          {fieldErrors["fechaPago"] && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {fieldErrors["fechaPago"]}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Tipo de exportación
          </label>
          <select
            value={tipoExpo}
            onChange={(e) => setTipoExpo(Number(e.target.value))}
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
          >
            {TIPO_EXPO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Idioma del comprobante
          </label>
          <select
            value={idiomaCbte}
            onChange={(e) => setIdiomaCbte(Number(e.target.value))}
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
          >
            {IDIOMA_CBTE.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
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
                placeholder=""
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
                placeholder=""
                className="col-span-2 rounded-md border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
              />
              <input
                value={item.precioUnitario}
                onChange={(e) => updateItem(index, { precioUnitario: e.target.value })}
                type="number"
                min={0}
                step="any"
                placeholder=""
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

      {status === "error" && errorMessage && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      {/* Sticky abajo, justo arriba del tab bar */}
      <div className="sticky bottom-0 -mx-4 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
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
          className="w-full rounded-xl bg-[#003366] px-3 py-3.5 text-[15px] font-semibold text-white disabled:opacity-50 hover:bg-[#002855] dark:bg-[#4a90c8] dark:hover:bg-[#3d7ba8]"
        >
          {status === "submitting" ? "Emitiendo..." : "Emitir factura E"}
        </button>
      </div>
    </form>
  );
}
