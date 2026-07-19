"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<{
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  matches: (path: string) => boolean;
}> = [
  {
    href: "/facturas",
    label: "Facturar",
    matches: (p) => p === "/facturas" || p.startsWith("/facturas/nueva") || p === "/",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className={`h-6 w-6 ${active ? "text-[#003366] dark:text-[#7bb0e0]" : "text-neutral-500"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 3h16v18l-4-2-4 2-4-2-4 2V3z" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </svg>
    ),
  },
  {
    href: "/facturas/historial",
    label: "Historial",
    matches: (p) => p.startsWith("/facturas/historial"),
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className={`h-6 w-6 ${active ? "text-[#003366] dark:text-[#7bb0e0]" : "text-neutral-500"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    href: "/configuracion",
    label: "Perfil",
    matches: (p) => p.startsWith("/configuracion") || p.startsWith("/perfil") || p.startsWith("/ayuda"),
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className={`h-6 w-6 ${active ? "text-[#003366] dark:text-[#7bb0e0]" : "text-neutral-500"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </svg>
    ),
  },
];

export function BottomTabs() {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          const active = tab.matches(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center gap-1 py-2 text-xs"
            >
              {tab.icon(active)}
              <span
                className={
                  active
                    ? "font-medium text-[#003366] dark:text-[#7bb0e0]"
                    : "text-neutral-500"
                }
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
