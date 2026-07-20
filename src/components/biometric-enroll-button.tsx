"use client";

import { useEffect, useState } from "react";
import {
  isBiometricSupported,
  hasBiometricEnrolled,
  registerBiometric,
} from "@/lib/biometric";
import { getBiometricDiagnostic } from "@/lib/biometric-diagnostic";

/** Botón para enrolar Face ID desde Perfil > Seguridad. Incluye un panel
 * de diagnóstico visible si la biometría no está soportada o falla, para
 * poder debuggear sin devtools (no tenemos acceso a Safari Web Inspector
 * en el celu de la usuaria). */
export function BiometricEnrollButton() {
  const [supported, setSupported] = useState(false);
  const [enrolled, setEnrolled] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"idle" | "enrolling" | "error" | "done">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [diagnostic, setDiagnostic] = useState<string>("");
  const [showDiag, setShowDiag] = useState(false);

  useEffect(() => {
    setSupported(isBiometricSupported());
    hasBiometricEnrolled().then((v) => {
      setEnrolled(v);
      setMounted(true);
    });
    getBiometricDiagnostic().then(setDiagnostic);
  }, []);

  if (!mounted) return null;
  if (enrolled && status !== "done") return null;

  async function enroll() {
    setStatus("enrolling");
    setErrorMessage("");
    try {
      await registerBiometric();
      setEnrolled(true);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      setErrorMessage(msg);
      getBiometricDiagnostic().then(setDiagnostic);
    }
  }

  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={enroll}
        disabled={status === "enrolling" || !supported}
        className="flex w-full items-center justify-between px-4 py-3 text-left disabled:opacity-50"
      >
        <div>
          <p className="text-sm text-neutral-900 dark:text-neutral-100">
            {status === "done" ? "Face ID activado" : "Activar Face ID"}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {!supported
              ? "No disponible en este dispositivo"
              : status === "enrolling"
                ? "Autenticando..."
                : status === "done"
                  ? "Ya podés desbloquear la app con tu cara."
                  : "Entrás sin escribir el PIN."}
          </p>
        </div>
        <span aria-hidden className="text-neutral-400">
          {status === "done" ? "✓" : "›"}
        </span>
      </button>
      {status === "error" && (
        <div className="border-t border-neutral-200 px-4 py-2 text-xs dark:border-neutral-800">
          <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
        </div>
      )}
      <div className="border-t border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setShowDiag((v) => !v)}
          className="w-full px-4 py-2 text-left text-[11px] text-neutral-500 dark:text-neutral-400"
        >
          {showDiag ? "Ocultar" : "Ver"} detalles técnicos
        </button>
        {showDiag && diagnostic && (
          <pre className="whitespace-pre-wrap border-t border-neutral-200 px-4 py-2 font-mono text-[10.5px] leading-snug text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
            {diagnostic}
          </pre>
        )}
      </div>
    </div>
  );
}
