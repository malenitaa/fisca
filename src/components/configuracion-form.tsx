"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface ExistingConfig {
  cuit: string;
  razonSocial: string;
  puntoVenta: number;
  ambiente: "homologacion" | "produccion";
}

const inputClass =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-base text-neutral-900 outline-none focus:border-[#003366] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-[#7bb0e0]";
const labelClass = "mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300";
const primaryButtonClass =
  "w-full rounded-xl bg-[#003366] px-3 py-3.5 text-[15.5px] font-semibold text-white disabled:opacity-50 dark:bg-[#4a90c8]";
const cardClass =
  "space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950";

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function ConfiguracionForm({ existing }: { existing: ExistingConfig | null }) {
  return existing ? <EditarConfiguracion existing={existing} /> : <VincularArcaWizard />;
}

/** Primera vez: wizard guiado en 2 pasos — separa la parte técnica
 * (certificado) de la liviana (punto de venta), para no mostrarle 6 campos
 * de una a alguien que no sabe qué es un certificado digital. */
function VincularArcaWizard() {
  const router = useRouter();
  const [paso, setPaso] = useState<1 | 2>(1);

  const [cuit, setCuit] = useState("");
  const [ambiente, setAmbiente] = useState<"homologacion" | "produccion">("homologacion");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [paso1Error, setPaso1Error] = useState("");

  const [razonSocial, setRazonSocial] = useState("");
  const [puntoVenta, setPuntoVenta] = useState("1");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  function continuar(e: FormEvent) {
    e.preventDefault();
    const cuitLimpio = cuit.replace(/[^0-9]/g, "");
    if (cuitLimpio.length !== 11) {
      setPaso1Error("El CUIT debe tener 11 dígitos.");
      return;
    }
    if (!certFile || !keyFile) {
      setPaso1Error("Subí el certificado (.crt) y la clave privada (.key).");
      return;
    }
    setPaso1Error("");
    setPaso(2);
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    try {
      const [cert, key] = await Promise.all([
        readFileAsText(certFile!),
        readFileAsText(keyFile!),
      ]);

      const res = await fetch("/api/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuit, razonSocial, puntoVenta, ambiente, cert, key }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "No se pudo guardar la configuración.");
      }

      router.push("/facturas");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Error inesperado.");
    }
  }

  if (paso === 1) {
    return (
      <form onSubmit={continuar} className="space-y-4">
        <div>
          <p className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
            PASO 1 DE 2
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Vincular con ARCA
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            Usás tu CUIT y el certificado digital que generás en el portal de ARCA. No te
            pedimos ni guardamos tu Clave Fiscal.
          </p>
        </div>

        <div className={cardClass}>
          <div>
            <label className={labelClass}>Ambiente</label>
            <select
              value={ambiente}
              onChange={(e) => setAmbiente(e.target.value as "homologacion" | "produccion")}
              className={inputClass}
            >
              <option value="homologacion">Homologación — modo de prueba</option>
              <option value="produccion">Producción — factura real</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>CUIT</label>
            <input
              required
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
              placeholder="20111111112"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Certificado (.crt)</label>
            <input
              type="file"
              accept=".crt,.pem"
              onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-neutral-600 dark:text-neutral-400"
            />
          </div>

          <div>
            <label className={labelClass}>Clave privada (.key)</label>
            <input
              type="file"
              accept=".key,.pem"
              onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-neutral-600 dark:text-neutral-400"
            />
          </div>
        </div>

        <p className="rounded-xl border border-dashed border-neutral-300 px-3.5 py-3 text-[12.5px] leading-relaxed text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          ¿No generaste el certificado todavía?{" "}
          <Link href="/ayuda" className="font-medium text-[#003366] dark:text-[#7bb0e0]">
            Te guiamos paso a paso
          </Link>
          .
        </p>

        {paso1Error && (
          <p className="text-sm text-red-600 dark:text-red-400">{paso1Error}</p>
        )}

        <button type="submit" className={primaryButtonClass}>
          Continuar
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={confirmar} className="space-y-4">
      <div>
        <p className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
          PASO 2 DE 2
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Configurá tu facturación
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Ya casi. Esto es lo mínimo para poder emitir tu primera factura.
        </p>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-900">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">CUIT</span>
          <span className="flex items-center gap-1.5 font-mono text-sm text-neutral-900 dark:text-neutral-100">
            {cuit}
            <button
              type="button"
              onClick={() => setPaso(1)}
              className="ml-1 text-xs font-sans font-medium text-[#003366] dark:text-[#7bb0e0]"
            >
              editar
            </button>
          </span>
        </div>

        <div>
          <label className={labelClass}>Punto de venta</label>
          <input
            required
            type="number"
            min={1}
            value={puntoVenta}
            onChange={(e) => setPuntoVenta(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Nombre (aparece en el PDF, opcional)</label>
          <input
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <button type="submit" disabled={status === "saving"} className={primaryButtonClass}>
        {status === "saving" ? "Guardando..." : "Empezar a facturar"}
      </button>

      {status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
      )}
    </form>
  );
}

/** Ya configurado: una sola pantalla de edición, sin el marco de "paso X de
 * 2" (eso es solo para la primera vez). */
function EditarConfiguracion({ existing }: { existing: ExistingConfig }) {
  const router = useRouter();
  const [cuit, setCuit] = useState(existing.cuit);
  const [razonSocial, setRazonSocial] = useState(existing.razonSocial);
  const [puntoVenta, setPuntoVenta] = useState(existing.puntoVenta.toString());
  const [ambiente, setAmbiente] = useState(existing.ambiente);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    try {
      if (!certFile || !keyFile) {
        throw new Error("Subí el certificado (.crt) y la clave privada (.key).");
      }
      const [cert, key] = await Promise.all([readFileAsText(certFile), readFileAsText(keyFile)]);

      const res = await fetch("/api/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuit, razonSocial, puntoVenta, ambiente, cert, key }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "No se pudo guardar la configuración.");
      }

      setStatus("saved");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Error inesperado.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      {ambiente === "produccion" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Ambiente de <strong>producción</strong>: las facturas que emitas van a ser reales ante
          ARCA.
        </div>
      )}

      <div>
        <label className={labelClass}>Ambiente</label>
        <select
          value={ambiente}
          onChange={(e) => setAmbiente(e.target.value as "homologacion" | "produccion")}
          className={inputClass}
        >
          <option value="homologacion">Homologación (testing)</option>
          <option value="produccion">Producción</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>CUIT</label>
        <input
          required
          value={cuit}
          onChange={(e) => setCuit(e.target.value)}
          placeholder="20111111112"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Razón social / nombre (opcional, aparece en el PDF)</label>
        <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Punto de venta</label>
        <input
          required
          type="number"
          min={1}
          value={puntoVenta}
          onChange={(e) => setPuntoVenta(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Certificado (.crt) — ya cargado, subilo de nuevo solo si querés reemplazarlo</label>
        <input
          type="file"
          accept=".crt,.pem"
          onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-neutral-600 dark:text-neutral-400"
        />
      </div>

      <div>
        <label className={labelClass}>Clave privada (.key) — ya cargada, subila de nuevo solo si querés reemplazarla</label>
        <input
          type="file"
          accept=".key,.pem"
          onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-neutral-600 dark:text-neutral-400"
        />
      </div>

      <button type="submit" disabled={status === "saving"} className={primaryButtonClass}>
        {status === "saving" ? "Guardando..." : "Guardar"}
      </button>

      {status === "saved" && <p className="text-sm text-green-700 dark:text-green-400">Configuración guardada.</p>}
      {status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>}
    </form>
  );
}
