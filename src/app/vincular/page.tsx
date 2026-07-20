"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { markUnlocked, setUnlockEnabled } from "@/lib/unlock";
import { isBiometricSupported, registerBiometric, getBiometryLabel } from "@/lib/biometric";

type Step = "email" | "pin" | "confirm" | "faceid" | "sent";

export default function VincularPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [biometryLabel, setBiometryLabel] = useState("Face ID");

  useEffect(() => {
    getBiometryLabel().then(setBiometryLabel);
  }, []);

  function nextFromEmail(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email inválido.");
      return;
    }
    setStep("pin");
  }

  function nextFromPin(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(pin)) {
      setError("El PIN debe tener 6 dígitos.");
      return;
    }
    setStep("confirm");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (pin !== pinConfirm) {
      setError("Los PINs no coinciden.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/auth/vincular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, pin }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo vincular la cuenta.");
      setStep("pin");
      return;
    }
    setUnlockEnabled(true);
    markUnlocked();
    if (isBiometricSupported()) {
      setStep("faceid");
    } else {
      setStep("sent");
    }
  }

  async function enrollFaceId() {
    setError("");
    setSubmitting(true);
    try {
      await registerBiometric();
    } catch (err) {
      // Si el user cancela o el WebView no soporta, seguimos con PIN nomás.
      setError(err instanceof Error ? err.message : `No se pudo activar ${biometryLabel}.`);
    }
    setSubmitting(false);
    setStep("sent");
  }

  return (
    <main
      className="fixed inset-0 flex flex-col bg-white dark:bg-neutral-950"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-center px-4 py-3">
        <Link
          href="/configuracion"
          className="text-sm text-neutral-500 dark:text-neutral-400"
        >
          Cancelar
        </Link>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6">
        <div className="mx-auto w-full max-w-sm">
          {step === "email" && (
            <form onSubmit={nextFromEmail} className="space-y-4">
              <div>
                <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Vinculá tu cuenta
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Con tu email podés recuperar el acceso desde otro dispositivo o si
                  olvidás el PIN.
                </p>
              </div>
              <input
                type="email"
                required
                autoFocus
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
              />
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="submit"
                className="w-full rounded-xl bg-[#003366] px-3 py-3 text-[15px] font-semibold text-white dark:bg-[#4a90c8]"
              >
                Continuar
              </button>
            </form>
          )}

          {step === "pin" && (
            <form onSubmit={nextFromPin} className="space-y-4">
              <div>
                <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Creá un PIN
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  6 dígitos para entrar a Fisca cuando no funcione el desbloqueo biométrico.
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
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={pin.length !== 6}
                className="w-full rounded-xl bg-[#003366] px-3 py-3 text-[15px] font-semibold text-white disabled:opacity-40 dark:bg-[#4a90c8]"
              >
                Continuar
              </button>
            </form>
          )}

          {step === "confirm" && (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Repetí el PIN
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Confirmá los 6 dígitos.
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
                value={pinConfirm}
                onChange={(e) =>
                  setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-center text-2xl tracking-[0.5em] outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
              />
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={pinConfirm.length !== 6 || submitting}
                className="w-full rounded-xl bg-[#003366] px-3 py-3 text-[15px] font-semibold text-white disabled:opacity-40 dark:bg-[#4a90c8]"
              >
                {submitting ? "Guardando..." : "Vincular"}
              </button>
            </form>
          )}

          {step === "faceid" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#003366] text-white dark:bg-[#4a90c8]">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="4" />
                  <path d="M8 9v1M16 9v1M8 15c1.333 1 2.667 1.5 4 1.5s2.667-.5 4-1.5" />
                </svg>
              </div>
              <div>
                <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  ¿Activar {biometryLabel}?
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Entrás sin escribir el PIN. El PIN queda de respaldo.
                </p>
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="button"
                onClick={enrollFaceId}
                disabled={submitting}
                className="w-full rounded-xl bg-[#003366] px-3 py-3 text-[15px] font-semibold text-white disabled:opacity-40 dark:bg-[#4a90c8]"
              >
                {submitting ? "Activando..." : `Activar ${biometryLabel}`}
              </button>
              <button
                type="button"
                onClick={() => setStep("sent")}
                className="block w-full text-center text-sm font-medium text-neutral-500 dark:text-neutral-400"
              >
                Ahora no
              </button>
            </div>
          )}

          {step === "sent" && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#003366] text-white dark:bg-[#4a90c8]">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Listo
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Te mandamos un mail a <strong>{email}</strong> para confirmar. Tu PIN
                  ya quedó activo.
                </p>
              </div>
              <button
                onClick={() => router.replace("/configuracion")}
                className="w-full rounded-xl bg-[#003366] px-3 py-3 text-[15px] font-semibold text-white dark:bg-[#4a90c8]"
              >
                Volver
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
