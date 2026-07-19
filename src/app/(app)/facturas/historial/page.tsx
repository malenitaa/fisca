import { createClient } from "@/lib/supabase/server";
import { HistorialList } from "@/components/historial-list";
import { PullToRefresh } from "@/components/pull-to-refresh";

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

  const now = new Date();
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const mesActual = `${meses[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <PullToRefresh>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-[19px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Historial
        </h1>
        <span className="rounded-md border border-neutral-200 px-2 py-1 font-mono text-[11px] text-[#003366] dark:border-neutral-800 dark:text-[#7bb0e0]">
          {mesActual}
        </span>
      </header>

      {!invoices || invoices.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Todavía no emitiste ninguna factura.
        </p>
      ) : (
        <HistorialList invoices={invoices} />
      )}
    </PullToRefresh>
  );
}
