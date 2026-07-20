"use client";

import { useEffect, useState } from "react";
import { isUnlockEnabled, setUnlockEnabled } from "@/lib/unlock";

export function UnlockToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setEnabled(isUnlockEnabled());
    setMounted(true);
  }, []);

  function toggle() {
    const next = !enabled;
    setUnlockEnabled(next);
    setEnabled(next);
  }

  if (!mounted) return null;

  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm text-neutral-900 dark:text-neutral-100">
            Pedir Face ID o PIN al abrir
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Se pide cada vez que abrís la app.
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
    </div>
  );
}
