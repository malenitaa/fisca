"use client";

import { useEffect, useState } from "react";
import {
  isBiometricSupported,
  hasBiometricEnrolled,
  registerBiometric,
} from "@/lib/biometric";

/**
 * Botón secundario en Perfil > Seguridad para enrolar Face ID / Touch ID
 * cuando la usuaria ya tenía PIN configurado desde antes. Se muestra solo si:
 * - El dispositivo soporta biometría
 * - No hay biometría enrolada todavía (evita duplicar prompt cuando ya está)
 */
export function BiometricEnrollButton() {
  const [supported, setSupported] = useState(false);
  const [enrolled, setEnrolled] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"idle" | "enrolling" | "error" | "done">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setSupported(isBiometricSupported());
    hasBiometricEnrolled().then((v) => {
      setEnrolled(v);
      setMounted(true);
    });
  }, []);

  if (!mounted || !supported || enrolled) return null;

  async function enroll() {
    setStatus("enrolling");
    setErrorMessage("");
    try {
      await registerBiometric();
      setEnrolled(true);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "No se pudo activar.");
    }
  }

  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={enroll}
        disabled={status === "enrolling"}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm text-neutral-900 dark:text-neutral-100">
            {status === "done" ? "Face ID activado" : "Activar Face ID"}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {status === "enrolling"
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
        <p className="border-t border-neutral-200 px-4 py-2 text-xs text-red-600 dark:border-neutral-800 dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
