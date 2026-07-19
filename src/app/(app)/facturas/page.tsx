import { redirect } from "next/navigation";
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

  if (!config) {
    redirect("/configuracion");
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
        <div className="flex items-center gap-2">
          <LogoIcon className="h-7 w-7" />
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Nueva factura
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{pvLabel}</span>
          {config.ambiente !== "produccion" && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
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
