"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { markUnlocked, isUnlockEnabled } from "@/lib/unlock";
import {
  authenticateBiometric,
  isBiometricSupported,
  hasBiometricEnrolled,
  getBiometryLabel,
} from "@/lib/biometric";
import { SplashView } from "@/components/splash-view";

type Step = "biometric" | "biometric-retry" | "pin" | "recover" | "recovered";

const MAX_BIOMETRIC_ATTEMPTS = 3;

export default function DesbloquearPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/facturas";
  // Cuando viene desde el callback de magic link, el gate corre igual
  // aunque la preferencia local "Bloquear al abrir la app" esté OFF —
  // es una capa extra sobre el auth por email, no la del toggle.
  const fromLogin = params.get("fromLogin") === "1";

  const [step, setStep] = useState<Step>("biometric");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recoveredEmail, setRecoveredEmail] = useState("");
  const [biometricAttempts, setBiometricAttempts] = useState(0);
  const [label, setLabel] = useState("Face ID");

  useEffect(() => {
    if (!fromLogin && !isUnlockEnabled()) {
      router.replace(next);
      return;
    }
    getBiometryLabel().then(setLabel);
    // Post-login vamos directo al PIN — el email magic-link ya autenticó,
    // no hace falta el atajo biométrico en ese punto y evita saltar el
    // paso de tipear el PIN, que es el segundo factor.
    if (fromLogin) {
      setStep("pin");
    } else {
      tryBiometric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryBiometric() {
    if (!isBiometricSupported()) {
      setStep("pin");
      return;
    }
    const has = await hasBiometricEnrolled();
    if (!has) {
      setStep("pin");
      return;
    }
    setStep("biometric");
    const ok = await authenticateBiometric();
    if (ok) {
      markUnlocked();
      router.replace(next);
      return;
    }
    const nextAttempt = biometricAttempts + 1;
    setBiometricAttempts(nextAttempt);
    if (nextAttempt >= MAX_BIOMETRIC_ATTEMPTS) {
      setStep("pin");
      return;
    }
    setStep("biometric-retry");
  }

  async function submitPin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/auth/pin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.ok) {
      markUnlocked();
      router.replace(next);
      return;
    }
    if (data.locked) {
      setStep("recover");
      return;
    }
    setError(data.error ?? "PIN incorrecto.");
    setAttemptsRemaining(typeof data.attemptsRemaining === "number" ? data.attemptsRemaining : null);
    setPin("");
  }

  async function requestRecover() {
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/auth/pin/recover", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "No pudimos enviar el mail.");
      return;
    }
    setRecoveredEmail(data.email ?? "");
    setStep("recovered");
  }

  // Step "biometric": el splash sigue visible mientras se dispara el
  // prompt nativo de Face ID / Huella. Se ve como una sola pantalla
  // continua de carga con el prompt encima, sin flash intermedio.
  if (step === "biometric") {
    return <SplashView />;
  }

  return (
    <main
      className="fixed inset-0 flex flex-col bg-white dark:bg-neutral-950"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex flex-1 flex-col justify-center px-6">
        <div className="mx-auto w-full max-w-sm">
          {step === "biometric-retry" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#003366] text-white dark:bg-[#4a90c8]">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 11a3 3 0 100-6 3 3 0 000 6z" />
                  <path d="M20 21v-2a4 4 0 00-3-3.87M4 21v-2a4 4 0 013-3.87" />
                </svg>
              </div>
              <div>
                <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  No pudimos verificarte
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Te quedan {MAX_BIOMETRIC_ATTEMPTS - biometricAttempts}{" "}
                  {MAX_BIOMETRIC_ATTEMPTS - biometricAttempts === 1 ? "intento" : "intentos"} con {label}.
                </p>
              </div>
              <button
                type="button"
                onClick={tryBiometric}
                className="w-full rounded-xl bg-[#003366] px-3 py-3 text-[15px] font-semibold text-white dark:bg-[#4a90c8]"
              >
                Reintentar {label}
              </button>
              <button
                type="button"
                onClick={() => setStep("pin")}
                className="block w-full text-center text-sm font-medium text-neutral-500 dark:text-neutral-400"
              >
                Usar PIN
              </button>
            </div>
          )}

          {step === "pin" && (
            <form onSubmit={submitPin} className="space-y-4">
              <div className="text-center">
                <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Ingresá tu PIN
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  6 dígitos para entrar.
                </p>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-center text-2xl tracking-[0.5em] outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
              />
              {error && (
                <p className="text-center text-sm text-red-600 dark:text-red-400">
                  {error}
                  {typeof attemptsRemaining === "number" && attemptsRemaining > 0 && (
                    <> {attemptsRemaining} {attemptsRemaining === 1 ? "intento" : "intentos"} restantes.</>
                  )}
                </p>
              )}
              <button
                type="submit"
                disabled={pin.length !== 6 || submitting}
                className="w-full rounded-xl bg-[#003366] px-3 py-3 text-[15px] font-semibold text-white disabled:opacity-40 dark:bg-[#4a90c8]"
              >
                {submitting ? "Verificando..." : "Entrar"}
              </button>
              <button
                type="button"
                onClick={() => setStep("recover")}
                className="block w-full text-center text-sm font-medium text-neutral-500 dark:text-neutral-400"
              >
                Olvidé mi PIN
              </button>
            </form>
          )}

          {step === "recover" && (
            <div className="space-y-4 text-center">
              <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                Recuperar acceso
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Te vamos a mandar un link al email que vinculaste. Cuando lo abras,
                vas a poder crear un nuevo PIN.
              </p>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <button
                onClick={requestRecover}
                disabled={submitting}
                className="w-full rounded-xl bg-[#003366] px-3 py-3 text-[15px] font-semibold text-white disabled:opacity-40 dark:bg-[#4a90c8]"
              >
                {submitting ? "Enviando..." : "Enviar link"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("pin");
                  setError("");
                }}
                className="block w-full text-center text-sm font-medium text-neutral-500 dark:text-neutral-400"
              >
                Volver
              </button>
            </div>
          )}

          {step === "recovered" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#003366] text-white dark:bg-[#4a90c8]">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                Revisá tu email
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Mandamos un link a <strong>{recoveredEmail}</strong>. Abrilo desde
                este mismo dispositivo.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
