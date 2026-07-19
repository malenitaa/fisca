"use client";

import { useEffect, useState } from "react";
import { FeedbackModal } from "./feedback-modal";

/**
 * Detección de "shake" del dispositivo (patrón iOS): al sacudir el
 * teléfono se abre el modal de feedback in-app.
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
    const THRESHOLD = 25;
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

    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, []);

  return (
    <FeedbackModal
      open={open}
      onClose={() => setOpen(false)}
      reason="Detectamos que sacudiste el teléfono. Contame qué está mal."
    />
  );
}
