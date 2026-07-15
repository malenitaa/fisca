import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NuevaFacturaForm } from "@/components/nueva-factura-form";
import { MonotributoReminder } from "@/components/monotributo-reminder";
import { periodoActual, periodoLabel } from "@/lib/monotributo";

export default async function NuevaFacturaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: config } = await supabase
    .from("afip_config")
    .select("ambiente")
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

  return (
    <div>
      {!pago && <MonotributoReminder periodo={periodo} periodoLabel={periodoLabel(periodo)} />}
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Nueva factura C
        </h1>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            config.ambiente === "produccion"
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
          }`}
        >
          {config.ambiente === "produccion" ? "Producción" : "Homologación"}
        </span>
      </div>
      <NuevaFacturaForm />
    </div>
  );
}
