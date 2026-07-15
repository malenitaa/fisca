import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NuevaFacturaForm } from "@/components/nueva-factura-form";

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

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Nueva factura C</h1>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            config.ambiente === "produccion"
              ? "bg-amber-100 text-amber-800"
              : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {config.ambiente === "produccion" ? "Producción" : "Homologación"}
        </span>
      </div>
      <NuevaFacturaForm />
    </div>
  );
}
