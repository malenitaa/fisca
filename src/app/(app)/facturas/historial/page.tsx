import { createClient } from "@/lib/supabase/server";
import { HistorialList } from "@/components/historial-list";

export default async function HistorialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, cbte_tipo, punto_venta, numero_comprobante, fecha_emision, cliente_nombre, cliente_doc_nro, cliente_doc_tipo, importe_total, ambiente, comprobante_asociado_id, moneda"
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Historial
      </h1>

      {!invoices || invoices.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Todavía no emitiste ninguna factura.
        </p>
      ) : (
        <HistorialList invoices={invoices} />
      )}
    </div>
  );
}
