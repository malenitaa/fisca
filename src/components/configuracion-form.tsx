"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearAllLocalUnlockState } from "@/lib/unlock";

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
const secondaryButtonClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-3 py-3.5 text-[15.5px] font-semibold text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100";
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

export function ConfiguracionForm({
  existing,
  isAnonymous = false,
}: {
  existing: ExistingConfig | null;
  isAnonymous?: boolean;
}) {
  return existing ? (
    <EditarConfiguracion existing={existing} />
  ) : (
    <VincularArcaWizard isAnonymous={isAnonymous} />
  );
}

type Modo = "elegir" | "generar" | "subir";

function VincularArcaWizard({ isAnonymous }: { isAnonymous: boolean }) {
  const [modo, setModo] = useState<Modo>("elegir");

  if (modo === "elegir") {
    return <ElegirModo onModo={setModo} isAnonymous={isAnonymous} />;
  }
  if (modo === "generar") {
    return <GenerarCsrWizard onVolver={() => setModo("elegir")} />;
  }
  return <SubirCertificadoWizard onVolver={() => setModo("elegir")} />;
}

function ElegirModo({
  onModo,
  isAnonymous,
}: {
  onModo: (m: Modo) => void;
  isAnonymous: boolean;
}) {
  const router = useRouter();

  // "Atrás" solo tiene sentido para el flow de onboarding recién iniciado
  // (sesión anónima creada por /signup). Si la usuaria ya tiene email
  // vinculado pero cayó acá sin config ARCA, no queremos hacerle un signOut
  // silencioso — para ese caso queda el "Cerrar sesión" explícito abajo.
  async function volverALanding() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAllLocalUnlockState();
    router.push("/");
    router.refresh();
  }

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAllLocalUnlockState();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {isAnonymous && (
        <button
          type="button"
          onClick={volverALanding}
          className="-ml-1 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <span aria-hidden>‹</span> Volver
        </button>
      )}
      <div>
        <p className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
          VINCULAR CON ARCA
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          ¿Cómo querés arrancar?
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Para emitir facturas necesitás un certificado digital de ARCA. Elegí la opción que
          te quede más cómoda.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onModo("generar")}
        className={`${cardClass} text-left transition hover:border-[#003366] dark:hover:border-[#7bb0e0]`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#003366]/10 text-[#003366] dark:bg-[#4a90c8]/20 dark:text-[#7bb0e0]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">
              Ayudame a generarlo
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Recomendado. Nosotros generamos el pedido, vos lo subís al portal de ARCA y
              volvés con el certificado firmado.
            </p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onModo("subir")}
        className={`${cardClass} text-left transition hover:border-[#003366] dark:hover:border-[#7bb0e0]`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3v5h5M21 8v13H3V3h11l7 7z" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">
              Ya tengo mi certificado
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Si generaste tu par .crt/.key por tu cuenta con openssl.
            </p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={cerrarSesion}
        className="w-full pt-2 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400"
      >
        Cerrar sesión
      </button>
    </div>
  );
}

/** Wizard nuevo: nosotros generamos el CSR, la usuaria lo firma en ARCA y
 * vuelve con el .crt. Elimina el paso técnico de openssl. */
function GenerarCsrWizard({ onVolver }: { onVolver: () => void }) {
  const router = useRouter();
  const [paso, setPaso] = useState<1 | 2 | 3>(1);

  const [cuit, setCuit] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [ambiente, setAmbiente] = useState<"homologacion" | "produccion">("homologacion");

  const [draftId, setDraftId] = useState("");
  const [csrPem, setCsrPem] = useState("");
  const [copied, setCopied] = useState(false);

  const [crtFile, setCrtFile] = useState<File | null>(null);
  const [puntoVenta, setPuntoVenta] = useState("1");

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function generar(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");
    const cuitLimpio = cuit.replace(/\D/g, "");
    if (cuitLimpio.length !== 11) {
      setStatus("error");
      setErrorMessage("El CUIT debe tener 11 dígitos.");
      return;
    }
    const res = await fetch("/api/csr/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cuit: cuitLimpio, razonSocial }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("error");
      setErrorMessage(data.error ?? "No se pudo generar el pedido.");
      return;
    }
    setDraftId(data.draftId);
    setCsrPem(data.csrPem);
    setStatus("idle");
    setPaso(2);
  }

  async function copiarCsr() {
    try {
      await navigator.clipboard.writeText(csrPem);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Si clipboard falla (Capacitor viejo), el user puede descargar igual.
    }
  }

  function descargarCsr() {
    const blob = new Blob([csrPem], { type: "application/x-pem-file" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fisca-${cuit.replace(/\D/g, "")}.csr`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");
    if (!crtFile) {
      setStatus("error");
      setErrorMessage("Subí el certificado (.crt) firmado por ARCA.");
      return;
    }
    try {
      const crt = await readFileAsText(crtFile);
      const res = await fetch("/api/csr/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, crt, puntoVenta, ambiente, razonSocial }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error ?? "No se pudo guardar la configuración.");
        return;
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
      <form onSubmit={generar} className="space-y-4">
        <div>
          <button
            type="button"
            onClick={onVolver}
            className="mb-3 text-xs font-medium text-neutral-500 dark:text-neutral-400"
          >
            ← Volver
          </button>
          <p className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
            PASO 1 DE 3
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Tus datos
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            Con esto generamos el pedido de certificado (CSR) que vas a subir a ARCA.
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
              inputMode="numeric"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Nombre o razón social (opcional)</label>
            <input
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className={primaryButtonClass}
        >
          {status === "loading" ? "Generando..." : "Generar pedido"}
        </button>
      </form>
    );
  }

  if (paso === 2) {
    return (
      <div className="space-y-4">
        <div>
          <p className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
            PASO 2 DE 3
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Subilo a ARCA
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            Este es tu pedido de certificado. Copialo o descargalo, subilo en el portal de
            ARCA, y volvés con el certificado firmado (.crt).
          </p>
        </div>

        <div className={cardClass}>
          <pre className="max-h-52 overflow-auto rounded-lg bg-neutral-50 p-3 font-mono text-[10.5px] leading-tight text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
            {csrPem}
          </pre>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={copiarCsr}
              className={secondaryButtonClass}
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
            <button
              type="button"
              onClick={descargarCsr}
              className={secondaryButtonClass}
            >
              Descargar
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-neutral-300 px-3.5 py-3 text-[12.5px] leading-relaxed text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
          <p className="font-medium text-neutral-800 dark:text-neutral-200">
            Pasos en el portal de ARCA:
          </p>
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
            <li>Entrá a &quot;Administrador de Relaciones&quot; con tu clave fiscal.</li>
            <li>Seleccioná &quot;Servicios Interactivos → WSASS&quot; (o similar).</li>
            <li>Subí el pedido (CSR) de arriba.</li>
            <li>Descargá el certificado firmado (.crt) y volvé acá.</li>
          </ol>
        </div>

        <button
          type="button"
          onClick={() => setPaso(3)}
          className={primaryButtonClass}
        >
          Ya lo tengo, seguir
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
          PASO 3 DE 3
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Terminar
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Subí el .crt firmado por ARCA y elegí tu punto de venta.
        </p>
      </div>

      <div className={cardClass}>
        <div>
          <label className={labelClass}>Certificado firmado (.crt)</label>
          <input
            type="file"
            accept=".crt,.pem"
            onChange={(e) => setCrtFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-neutral-600 dark:text-neutral-400"
          />
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
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className={primaryButtonClass}
      >
        {status === "loading" ? "Guardando..." : "Empezar a facturar"}
      </button>
    </form>
  );
}

/** Wizard viejo: la usuaria ya tiene .crt y .key generados por su cuenta. */
function SubirCertificadoWizard({ onVolver }: { onVolver: () => void }) {
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
          <button
            type="button"
            onClick={onVolver}
            className="mb-3 text-xs font-medium text-neutral-500 dark:text-neutral-400"
          >
            ← Volver
          </button>
          <p className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
            PASO 1 DE 2
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Subí tu certificado
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            Usás tu CUIT y el certificado digital que ya generaste. No te pedimos ni
            guardamos tu Clave Fiscal.
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

/** Ya configurado: una sola pantalla de edición. */
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
