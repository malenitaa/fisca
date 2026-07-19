"use client";

import { useEffect, useState } from "react";

/**
 * Detección de "shake" del dispositivo (patrón iOS): al sacudir el
 * teléfono se abre un modal para dar feedback. Como iOS 13+ pide
 * permiso explícito para acceder a los sensores de movimiento, el
 * listener se instala sólo si el usuario ya lo autorizó — de otro modo
 * el feature queda dormido sin molestar.
 */
export function ShakeToFeedback() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("DeviceMotionEvent" in window)) return;

    let last = 0;
    let lastX = 0;
    let lastY = 0;
    let lastZ = 0;
    const THRESHOLD = 25; // aceleración total delta — ajustable
    const COOLDOWN_MS = 2000;

    function onMotion(e: DeviceMotionEvent) {
      const acc = e.accelerationIncludingGravity;
      if (!acc || acc.x == null || acc.y == null || acc.z == null) return;
      const dx = Math.abs(acc.x - lastX);
      const dy = Math.abs(acc.y - lastY);
      const dz = Math.abs(acc.z - lastZ);
      const delta = dx + dy + dz;
      const now = Date.now();
      if (delta > THRESHOLD && now - last > COOLDOWN_MS) {
        last = now;
        setOpen(true);
      }
      lastX = acc.x;
      lastY = acc.y;
      lastZ = acc.z;
    }

    // iOS 13+: DeviceMotionEvent tiene un método requestPermission.
    // Sólo lo llamamos si ya fue concedido; si no, no rompemos nada.
    const DME = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (typeof DME.requestPermission === "function") {
      // No podemos pedir permiso sin gesto del usuario. Escuchamos igual;
      // si el permiso no está dado, no dispara.
      window.addEventListener("devicemotion", onMotion);
    } else {
      // Android / desktop: no hace falta permiso.
      window.addEventListener("devicemotion", onMotion);
    }

    return () => {
      window.removeEventListener("devicemotion", onMotion);
    };
  }, []);

  if (!open) return null;

  const mailto = `mailto:malvertva99@gmail.com?subject=${encodeURIComponent(
    "Feedback Fisca"
  )}&body=${encodeURIComponent(
    "Qué querés reportar?\n\n---\nInfo del dispositivo (dejar tal cual):\n" +
      (typeof navigator !== "undefined" ? navigator.userAgent : "")
  )}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          ¿Querés enviar feedback?
        </h2>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          Detectamos que sacudiste el teléfono. Contame qué está mal o qué te falta —
          se envía por mail.
        </p>
        <div className="flex flex-col gap-2">
          <a
            href={mailto}
            onClick={() => setOpen(false)}
            className="rounded-xl bg-[#003366] px-4 py-3 text-center text-sm font-semibold text-white dark:bg-[#4a90c8]"
          >
            Enviar feedback
          </a>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
