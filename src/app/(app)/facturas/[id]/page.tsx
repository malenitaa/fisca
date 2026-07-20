import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/user";
import {
  CBTE_TIPO_FACTURA_E,
  CBTE_TIPO_NOTA_CREDITO_C,
  CBTE_TIPO_NOTA_CREDITO_E,
  MONEDAS,
} from "@/lib/afip/types";
import { FacturaDetalle } from "@/components/factura-detalle";

interface Params {
  params: Promise<{ id: string }>;
}

function tituloTipo(cbteTipo: number): string {
  switch (cbteTipo) {
    case CBTE_TIPO_NOTA_CREDITO_C:
      return "Nota de crédito C";
    case CBTE_TIPO_FACTURA_E:
      return "Factura E";
    case CBTE_TIPO_NOTA_CREDITO_E:
      return "Nota de crédito E";
    default:
      return "Factura C";
  }
}

function monedaSimbolo(value?: string): string {
  if (!value || value === "PES") return "$";
  return MONEDAS.find((m) => m.value === value)?.symbol ?? value;
}

export default async function FacturaDetallePage({ params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getCurrentUser();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!invoice) notFound();

  const numero = `${String(invoice.punto_venta).padStart(5, "0")}-${String(
    invoice.numero_comprobante
  ).padStart(8, "0")}`;

  const simbolo = monedaSimbolo(invoice.moneda);
  const total = `${simbolo}${Number(invoice.importe_total).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
  })}`;

  const esNC =
    invoice.cbte_tipo === CBTE_TIPO_NOTA_CREDITO_C ||
    invoice.cbte_tipo === CBTE_TIPO_NOTA_CREDITO_E;
  const esE =
    invoice.cbte_tipo === CBTE_TIPO_FACTURA_E ||
    invoice.cbte_tipo === CBTE_TIPO_NOTA_CREDITO_E;
  const clienteLinea = esE
    ? invoice.cliente_nombre || "Cliente extranjero"
    : invoice.cliente_doc_tipo === 99
    ? "Consumidor Final"
    : invoice.cliente_nombre || invoice.cliente_doc_nro;

  // ¿Se puede anular? Sólo Factura C (no NC, no E) que no esté ya anulada.
  const { data: yaAnulada } = await supabase
    .from("invoices")
    .select("id")
    .eq("comprobante_asociado_id", invoice.id)
    .maybeSingle();
  const puedeAnular = !esNC && !esE && !yaAnulada;

  return (
    <div className="pb-8">
      <Link
        href="/facturas/historial"
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        ‹ Historial
      </Link>

      <FacturaDetalle
        titulo={tituloTipo(invoice.cbte_tipo)}
        numero={numero}
        cae={invoice.cae}
        caeVencimiento={invoice.cae_vencimiento}
        fechaEmision={invoice.fecha_emision}
        total={total}
        clienteLinea={clienteLinea}
        facturaId={invoice.id}
        puedeAnular={puedeAnular}
      />
    </div>
  );
}
