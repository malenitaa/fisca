import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FacturaTabs } from "@/components/factura-tabs";
import { MonotributoReminder } from "@/components/monotributo-reminder";
import { periodoActual, periodoLabel } from "@/lib/monotributo";
import { LogoIcon } from "@/components/logo";

export default async function NuevaFacturaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: config } = await supabase
    .from("afip_config")
    .select("ambiente, punto_venta")
    .eq("user_id", user!.id)
    .maybeSingle();

  // Sin configuración de ARCA todavía → mostramos un estado vacío en la
  // pantalla de Facturar con CTA al Perfil, en vez de redirigir (que era
  // confuso porque el usuario tocaba "Facturar" y aterrizaba en "Perfil").
  if (!config) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <LogoIcon className="mb-4 h-14 w-14" />
        <h1 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Falta configurar tu cuenta
        </h1>
        <p className="mb-6 max-w-xs text-sm text-neutral-500 dark:text-neutral-400">
          Para emitir facturas necesitás cargar tu CUIT, punto de venta y
          certificado de ARCA una sola vez.
        </p>
        <Link
          href="/configuracion"
          className="rounded-xl bg-[#003366] px-6 py-3 text-sm font-semibold text-white dark:bg-[#4a90c8]"
        >
          Ir a Perfil
        </Link>
      </div>
    );
  }

  const periodo = periodoActual();
  const { data: pago } = await supabase
    .from("monotributo_pagos")
    .select("periodo")
    .eq("user_id", user!.id)
    .eq("periodo", periodo)
    .maybeSingle();

  const pvLabel = `P.V. ${String(config.punto_venta).padStart(5, "0")}`;

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoIcon className="h-6 w-6" />
          <h1 className="text-[19px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Nueva factura
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-neutral-100 px-2 py-1 font-mono text-[11px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {pvLabel}
          </span>
          {config.ambiente !== "produccion" && (
            <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Homolog.
            </span>
          )}
        </div>
      </header>

      {!pago && <MonotributoReminder periodo={periodo} periodoLabel={periodoLabel(periodo)} />}

      <FacturaTabs />
    </div>
  );
}
