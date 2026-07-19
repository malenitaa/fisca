"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { IDIOMA_CBTE, MONEDAS, PAISES, TIPO_EXPO } from "@/lib/afip/types";
import { nuevaFacturaESchema } from "@/lib/validation";

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
  const router = useRouter();
  const [clienteNombre, setClienteNombre] = useState("");
  const [paisIdx, setPaisIdx] = useState(0);
  const [clienteDomicilio, setClienteDomicilio] = useState("");
  const [clienteIdImpositivo, setClienteIdImpositivo] = useState("");
  const [monedaId, setMonedaId] = useState<string>("DOL");
  const [monedaCotizacion, setMonedaCotizacion] = useState("");
  const [tipoExpo, setTipoExpo] = useState<number>(2);
  const [idiomaCbte, setIdiomaCbte] = useState<number>(1);
  const [items, setItems] = useState<ItemRow[]>([{ ...emptyItem }]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<EmitResult | null>(null);
  const [cotizStatus, setCotizStatus] = useState<"idle" | "loading" | "error">("idle");

  const traerCotizacion = useCallback(async () => {
    setCotizStatus("loading");
    try {
      // dolarapi.com espeja el TC oficial del BCRA (~ BNA vendedor).
      // Para USD usamos "oficial"; para otras monedas la app no autofetchea
      // todavía y el usuario tipea el valor a mano.
      const endpoint =
        monedaId === "DOL" ? "https://dolarapi.com/v1/dolares/oficial" : null;
      if (!endpoint) {
        setCotizStatus("error");
        return;
      }
      const res = await fetch(endpoint);
      const body = (await res.json()) as { venta?: number };
      if (body.venta) {
        setMonedaCotizacion(String(body.venta));
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
      <div className="rounded-md border border-green-200 bg-green-50 p-5 dark:border-green-900 dark:bg-green-950/30">
        <p className="mb-1 font-medium text-green-900 dark:text-green-300">
          Factura E N° {result.puntoVenta.toString().padStart(5, "0")}-
          {result.numeroComprobante.toString().padStart(8, "0")} autorizada
        </p>
        <p className="mb-4 text-sm text-green-800 dark:text-green-400">
          CAE {result.cae} · vence {result.caeVencimiento} · {result.moneda}
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/api/facturas/${result.facturaId}/pdf`}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            Descargar PDF
          </a>
          <button
            onClick={() => {
              setResult(null);
              setItems([{ ...emptyItem }]);
              setClienteNombre("");
              setClienteDomicilio("");
              setClienteIdImpositivo("");
              setMonedaCotizacion("");
            }}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
          >
            Nueva Factura E
          </button>
          <button
            onClick={() => router.push("/facturas/historial")}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
          >
            Ver historial
          </button>
        </div>
      </div>
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
          placeholder="Ej: Deel Inc."
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
            placeholder="TIN, VAT, EIN..."
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Domicilio del cliente (opcional)
        </label>
        <input
          value={clienteDomicilio}
          onChange={(e) => setClienteDomicilio(e.target.value)}
          placeholder="Calle, ciudad, estado"
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
        />
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
              step="0.01"
              placeholder="Ej: 1350.00"
              className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
            />
            {monedaId === "DOL" && (
              <button
                type="button"
                onClick={traerCotizacion}
                disabled={cotizStatus === "loading"}
                className="shrink-0 rounded-md border border-[#003366] px-3 text-xs font-medium text-[#003366] hover:bg-[#003366]/5 disabled:opacity-50 dark:border-[#7bb0e0] dark:text-[#7bb0e0] dark:hover:bg-[#7bb0e0]/10"
              >
                {cotizStatus === "loading" ? "..." : "Traer"}
              </button>
            )}
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
        &quot;Traer&quot; usa el tipo de cambio oficial (BCRA) — muy cercano al BNA
        vendedor que exige ARCA. Fuente:{" "}
        <a
          href="https://www.bna.com.ar/Personas"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#003366] underline dark:text-[#7bb0e0]"
        >
          bna.com.ar
        </a>{" "}
        para verificar el valor exacto.
      </p>

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
                placeholder="Descripción del servicio"
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
                placeholder={`Precio ${moneda.symbol}`}
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

      <div className="space-y-1 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Total en {moneda.symbol}
          </span>
          <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {moneda.symbol}
            {total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </span>
        </div>
        {totalArs > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Equivalente en pesos (informativo)
            </span>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              $
              {totalArs.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {status === "error" && errorMessage && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-md bg-[#003366] px-3 py-2.5 font-medium text-white disabled:opacity-50 hover:bg-[#002855] dark:bg-[#4a90c8] dark:hover:bg-[#3d7ba8]"
      >
        {status === "submitting" ? "Emitiendo..." : "Emitir Factura E"}
      </button>
    </form>
  );
}
