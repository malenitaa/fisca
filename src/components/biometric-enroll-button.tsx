"use client";

import { useEffect, useState } from "react";
import {
  isBiometricSupported,
  hasBiometricEnrolled,
  registerBiometric,
} from "@/lib/biometric";
import { getBiometricDiagnostic } from "@/lib/biometric-diagnostic";
import { clearNativeBiometricEnrollment } from "@/lib/native-biometric";

/** Botón para enrolar Face ID desde Perfil > Seguridad. Siempre visible
 * cuando la biometría es soportada, para poder debuggear sin devtools.
 * Ofrece resetear el flag local si algo salió mal. */
export function BiometricEnrollButton() {
  const [supported, setSupported] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"idle" | "enrolling" | "error" | "done">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [diagnostic, setDiagnostic] = useState<string>("");
  const [showDiag, setShowDiag] = useState(false);

  useEffect(() => {
    setSupported(isBiometricSupported());
    hasBiometricEnrolled().then((v) => setEnrolled(v));
    getBiometricDiagnostic().then(setDiagnostic);
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!supported) return null;

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

  function reset() {
    clearNativeBiometricEnrollment();
    setEnrolled(false);
    setStatus("idle");
    setErrorMessage("");
  }

  const label =
    status === "done" || enrolled
      ? "Reconfigurar Face ID"
      : "Activar Face ID";
  const subtitle =
    status === "enrolling"
      ? "Autenticando..."
      : status === "done" || enrolled
        ? "Ya está activo. Tocá para reconfigurar."
        : "Entrás sin escribir el PIN.";

  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={enroll}
        disabled={status === "enrolling"}
        className="flex w-full items-center justify-between px-4 py-3 text-left disabled:opacity-50"
      >
        <div>
          <p className="text-sm text-neutral-900 dark:text-neutral-100">{label}</p>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>
        </div>
        <span aria-hidden className="text-neutral-400">
          {enrolled || status === "done" ? "✓" : "›"}
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
        {showDiag && (
          <div className="border-t border-neutral-200 dark:border-neutral-800">
            <pre className="whitespace-pre-wrap px-4 py-2 font-mono text-[10.5px] leading-snug text-neutral-600 dark:text-neutral-400">
              {diagnostic || "Cargando..."}
            </pre>
            {enrolled && (
              <button
                type="button"
                onClick={reset}
                className="w-full border-t border-neutral-200 px-4 py-2 text-left text-[11px] font-medium text-red-600 dark:border-neutral-800 dark:text-red-400"
              >
                Resetear flag &quot;Face ID enrolado&quot;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
