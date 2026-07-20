"use client";

import { useEffect, useState } from "react";
import { isUnlockEnabled, setUnlockEnabled } from "@/lib/unlock";
import {
  isBiometricSupported,
  hasBiometricEnrolled,
  registerBiometric,
  disableBiometricShortcut,
  getBiometryLabel,
} from "@/lib/biometric";

export function UnlockToggle() {
  const [enabled, setEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [label, setLabel] = useState("Face ID");
  const [busy, setBusy] = useState(false);
  const [biometricError, setBiometricError] = useState("");

  useEffect(() => {
    setEnabled(isUnlockEnabled());
    setBiometricSupported(isBiometricSupported());
    hasBiometricEnrolled().then(setBiometricEnabled);
    getBiometryLabel().then(setLabel);
    setMounted(true);
  }, []);

  function toggle() {
    const next = !enabled;
    setUnlockEnabled(next);
    setEnabled(next);
  }

  async function toggleBiometric() {
    setBiometricError("");
    if (biometricEnabled) {
      disableBiometricShortcut();
      setBiometricEnabled(false);
      return;
    }
    setBusy(true);
    try {
      await registerBiometric();
      setBiometricEnabled(true);
    } catch (err) {
      setBiometricError(err instanceof Error ? err.message : `No se pudo activar ${label}.`);
    }
    setBusy(false);
  }

  if (!mounted) return null;

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm text-neutral-900 dark:text-neutral-100">
              Bloquear al abrir la app
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Pide tu PIN cada vez que abrís Fisca.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={toggle}
            className={`relative h-6 w-10 rounded-full transition ${
              enabled ? "bg-[#003366] dark:bg-[#4a90c8]" : "bg-neutral-300 dark:bg-neutral-700"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                enabled ? "left-[calc(100%-1.375rem)]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {enabled && biometricSupported && (
          <div className="border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm text-neutral-900 dark:text-neutral-100">
                  Usar {label} como acceso rápido
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Si falla, siempre podés entrar con el PIN.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={biometricEnabled}
                disabled={busy}
                onClick={toggleBiometric}
                className={`relative h-6 w-10 rounded-full transition disabled:opacity-50 ${
                  biometricEnabled
                    ? "bg-[#003366] dark:bg-[#4a90c8]"
                    : "bg-neutral-300 dark:bg-neutral-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                    biometricEnabled ? "left-[calc(100%-1.375rem)]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            {biometricError && (
              <p className="border-t border-neutral-200 px-4 py-2 text-xs text-red-600 dark:border-neutral-800 dark:text-red-400">
                {biometricError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
