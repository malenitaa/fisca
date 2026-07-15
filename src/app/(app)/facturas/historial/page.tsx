import { createClient } from "@/lib/supabase/server";

export default async function HistorialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, punto_venta, numero_comprobante, fecha_emision, cliente_nombre, cliente_doc_nro, cliente_doc_tipo, importe_total, ambiente"
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-neutral-900">Historial de facturas</h1>

      {!invoices || invoices.length === 0 ? (
        <p className="text-sm text-neutral-500">Todavía no emitiste ninguna factura.</p>
      ) : (
        <div className="divide-y divide-neutral-200 border-t border-b border-neutral-200">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {String(inv.punto_venta).padStart(5, "0")}-
                  {String(inv.numero_comprobante).padStart(8, "0")}
                  {inv.ambiente === "homologacion" && (
                    <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                      Homologación
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-500">
                  {inv.fecha_emision} ·{" "}
                  {inv.cliente_doc_tipo === 99
                    ? "Consumidor Final"
                    : inv.cliente_nombre || inv.cliente_doc_nro}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-neutral-900">
                  ${Number(inv.importe_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </span>
                <a
                  href={`/api/facturas/${inv.id}/pdf`}
                  target="_blank"
                  className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                >
                  PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
