"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface ExistingConfig {
  cuit: string;
  razonSocial: string;
  puntoVenta: number;
  ambiente: "homologacion" | "produccion";
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function ConfiguracionForm({ existing }: { existing: ExistingConfig | null }) {
  const router = useRouter();
  const [cuit, setCuit] = useState(existing?.cuit ?? "");
  const [razonSocial, setRazonSocial] = useState(existing?.razonSocial ?? "");
  const [puntoVenta, setPuntoVenta] = useState(existing?.puntoVenta?.toString() ?? "1");
  const [ambiente, setAmbiente] = useState<"homologacion" | "produccion">(
    existing?.ambiente ?? "homologacion"
  );
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
        body: JSON.stringify({
          cuit,
          razonSocial,
          puntoVenta,
          ambiente,
          cert,
          key,
        }),
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {ambiente === "produccion" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Ambiente de <strong>producción</strong>: las facturas que emitas van a ser reales ante
          ARCA.
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Ambiente</label>
        <select
          value={ambiente}
          onChange={(e) => setAmbiente(e.target.value as "homologacion" | "produccion")}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900"
        >
          <option value="homologacion">Homologación (testing)</option>
          <option value="produccion">Producción</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">CUIT</label>
        <input
          required
          value={cuit}
          onChange={(e) => setCuit(e.target.value)}
          placeholder="20111111112"
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Razón social / nombre (opcional, aparece en el PDF)
        </label>
        <input
          value={razonSocial}
          onChange={(e) => setRazonSocial(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Punto de venta</label>
        <input
          required
          type="number"
          min={1}
          value={puntoVenta}
          onChange={(e) => setPuntoVenta(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Certificado (.crt) {existing && "— ya cargado, subilo de nuevo solo si querés reemplazarlo"}
        </label>
        <input
          type="file"
          accept=".crt,.pem"
          onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Clave privada (.key) {existing && "— ya cargada, subila de nuevo solo si querés reemplazarla"}
        </label>
        <input
          type="file"
          accept=".key,.pem"
          onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={status === "saving"}
        className="w-full rounded-md bg-neutral-900 px-3 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {status === "saving" ? "Guardando..." : "Guardar"}
      </button>

      {status === "saved" && (
        <p className="text-sm text-green-700">Configuración guardada.</p>
      )}
      {status === "error" && <p className="text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
