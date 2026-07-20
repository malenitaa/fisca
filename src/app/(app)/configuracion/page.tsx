import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ConfiguracionForm } from "@/components/configuracion-form";
import { LogoutButton } from "@/components/logout-button";
import { UnlockToggle } from "@/components/unlock-toggle";

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: config }, { data: pinRow }] = await Promise.all([
    supabase
      .from("afip_config")
      .select("cuit, razon_social, punto_venta, ambiente")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("user_pins")
      .select("user_id")
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);

  const isAnonymous = user?.is_anonymous === true;
  const hasPin = !!pinRow;

  const existing = config
    ? {
        cuit: config.cuit,
        razonSocial: config.razon_social ?? "",
        puntoVenta: config.punto_venta,
        ambiente: config.ambiente as "homologacion" | "produccion",
      }
    : null;

  // Primera vez: el wizard de ConfiguracionForm ya trae su propio título y
  // texto de "paso X de 2" — no duplicamos header ni mostramos todavía el
  // resto de Perfil (Ayuda/cerrar sesión), la persona ni tiene cuenta
  // vinculada aún.
  if (!existing) {
    return <ConfiguracionForm existing={null} />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Perfil</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {user?.email || (isAnonymous ? "Cuenta sin vincular" : "")}
        </p>
      </header>

      {isAnonymous && (
        <Link
          href="/vincular"
          className="block rounded-2xl border border-[#003366]/20 bg-[#003366]/5 p-4 dark:border-[#4a90c8]/30 dark:bg-[#4a90c8]/10"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#003366] dark:text-[#7bb0e0]">
                Vinculá tu cuenta
              </p>
              <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                Con email y PIN podés recuperar el acceso desde otro dispositivo.
              </p>
            </div>
            <span aria-hidden className="text-lg text-[#003366] dark:text-[#7bb0e0]">
              ›
            </span>
          </div>
        </Link>
      )}

      <section>
        <h2 className="mb-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Configuración de ARCA
        </h2>
        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Se carga una sola vez. El certificado y la clave privada se guardan cifrados y nunca se
          muestran de nuevo.
        </p>
        <ConfiguracionForm existing={existing} />
      </section>

      {hasPin ? (
        <section className="space-y-2">
          <h2 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Seguridad
          </h2>
          <UnlockToggle />
        </section>
      ) : !isAnonymous ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Seguridad
          </h2>
          <Link
            href="/configurar-pin"
            className="flex items-center justify-between rounded-md border border-neutral-200 px-4 py-3 text-sm text-neutral-900 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-900"
          >
            <div>
              <p className="font-medium">Activar bloqueo al abrir la app</p>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                Con PIN y desbloqueo biométrico si tu dispositivo lo permite.
              </p>
            </div>
            <span aria-hidden className="text-neutral-400">
              ›
            </span>
          </Link>
        </section>
      ) : null}

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
