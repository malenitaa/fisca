import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

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
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <nav className="flex gap-4 text-sm">
            <Link href="/facturas" className="font-medium text-neutral-900">
              Nueva factura
            </Link>
            <Link href="/facturas/historial" className="text-neutral-500 hover:text-neutral-900">
              Historial
            </Link>
            <Link href="/configuracion" className="text-neutral-500 hover:text-neutral-900">
              Configuración
            </Link>
          </nav>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
