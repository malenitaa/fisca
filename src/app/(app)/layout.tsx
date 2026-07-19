import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
          <nav className="order-2 flex w-full gap-4 overflow-x-auto text-sm sm:order-1 sm:w-auto">
            <Link href="/facturas" className="whitespace-nowrap font-medium text-neutral-900 dark:text-neutral-100">
              <span className="sm:hidden">Facturar</span>
              <span className="hidden sm:inline">Nueva factura</span>
            </Link>
            <Link
              href="/facturas/historial"
              className="whitespace-nowrap text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Historial
            </Link>
            <Link
              href="/configuracion"
              className="whitespace-nowrap text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              <span className="sm:hidden">Config</span>
              <span className="hidden sm:inline">Configuración</span>
            </Link>
            <Link
              href="/ayuda"
              className="whitespace-nowrap text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Ayuda
            </Link>
          </nav>
          <div className="order-1 flex items-center gap-4 sm:order-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
