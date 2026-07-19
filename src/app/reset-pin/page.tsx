"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { markUnlocked, setUnlockEnabled } from "@/lib/unlock";

export default function ResetPinPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [step, setStep] = useState<"pin" | "confirm">("pin");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    const res = await fetch("/api/auth/pin/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar el PIN.");
      setStep("pin");
      return;
    }
    setUnlockEnabled(true);
    markUnlocked();
    router.replace("/facturas");
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
          {step === "pin" ? (
            <form onSubmit={nextFromPin} className="space-y-4">
              <div>
                <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Nuevo PIN
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Creá un PIN nuevo de 6 dígitos.
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
          ) : (
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
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-center text-2xl tracking-[0.5em] outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
              />
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={pinConfirm.length !== 6 || submitting}
                className="w-full rounded-xl bg-[#003366] px-3 py-3 text-[15px] font-semibold text-white disabled:opacity-40 dark:bg-[#4a90c8]"
              >
                {submitting ? "Guardando..." : "Guardar"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
