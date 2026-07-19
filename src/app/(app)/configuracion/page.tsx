import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ConfiguracionForm } from "@/components/configuracion-form";
import { LogoutButton } from "@/components/logout-button";

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: config } = await supabase
    .from("afip_config")
    .select("cuit, razon_social, punto_venta, ambiente")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Perfil</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{user?.email}</p>
      </header>

      <section>
        <h2 className="mb-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Configuración de ARCA
        </h2>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Se carga una sola vez. El certificado y la clave privada se guardan cifrados y nunca se
          muestran de nuevo.
        </p>
        <ConfiguracionForm
          existing={
            config
              ? {
                  cuit: config.cuit,
                  razonSocial: config.razon_social ?? "",
                  puntoVenta: config.punto_venta,
                  ambiente: config.ambiente as "homologacion" | "produccion",
                }
              : null
          }
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Más</h2>
        <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          <li>
            <Link
              href="/ayuda"
              className="flex items-center justify-between px-4 py-3 text-sm text-neutral-900 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-900"
            >
              <span>Ayuda</span>
              <span aria-hidden className="text-neutral-400">
                ›
              </span>
            </Link>
          </li>
          <li className="px-4 py-3">
            <LogoutButton />
          </li>
        </ul>
      </section>
    </div>
  );
}
