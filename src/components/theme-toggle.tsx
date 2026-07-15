"use client";

import { useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

function readInitialIsDark(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(readInitialIsDark);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
