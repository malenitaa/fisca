import { createClient } from "@/lib/supabase/server";
import { CBTE_TIPO_NOTA_CREDITO_C } from "@/lib/afip/types";
import { AnularFacturaButton } from "@/components/anular-factura-button";

export default async function HistorialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, cbte_tipo, punto_venta, numero_comprobante, fecha_emision, cliente_nombre, cliente_doc_nro, cliente_doc_tipo, importe_total, ambiente, comprobante_asociado_id"
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const idsAnulados = new Set(
    (invoices ?? []).map((inv) => inv.comprobante_asociado_id).filter(Boolean)
  );

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Historial de facturas
        </h1>
        {invoices && invoices.length > 0 && (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {invoices.length} comprobante{invoices.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {!invoices || invoices.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Todavía no emitiste ninguna factura.
        </p>
      ) : (
        <div className="divide-y divide-neutral-200 border-t border-b border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {invoices.map((inv) => {
            const esNotaCredito = inv.cbte_tipo === CBTE_TIPO_NOTA_CREDITO_C;
            const estaAnulada = idsAnulados.has(inv.id);
            return (
              <div key={inv.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {String(inv.punto_venta).padStart(5, "0")}-
                    {String(inv.numero_comprobante).padStart(8, "0")}
                    <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                      {esNotaCredito ? "Nota de Crédito C" : "Factura C"}
                    </span>
                    {estaAnulada && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
                        Anulada
                      </span>
                    )}
                    {inv.ambiente === "homologacion" && (
                      <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                        Homologación
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {inv.fecha_emision} ·{" "}
                    {inv.cliente_doc_tipo === 99
                      ? "Consumidor Final"
                      : inv.cliente_nombre || inv.cliente_doc_nro}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    $
                    {Number(inv.importe_total).toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <a
                    href={`/api/facturas/${inv.id}/pdf`}
                    target="_blank"
                    className="text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                  >
                    PDF
                  </a>
                  {!esNotaCredito && !estaAnulada && (
                    <AnularFacturaButton
                      facturaId={inv.id}
                      numero={`${String(inv.punto_venta).padStart(5, "0")}-${String(
                        inv.numero_comprobante
                      ).padStart(8, "0")}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
