import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarQrDataUrl } from "@/lib/afip/qr";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: "Factura no encontrada." }, { status: 404 });
  }

  const { data: config } = await supabase
    .from("afip_config")
    .select("cuit, razon_social")
    .eq("user_id", user.id)
    .maybeSingle();

  let comprobanteAsociado: { puntoVenta: number; numeroComprobante: number } | null = null;
  if (invoice.comprobante_asociado_id) {
    const { data: original } = await supabase
      .from("invoices")
      .select("punto_venta, numero_comprobante")
      .eq("id", invoice.comprobante_asociado_id)
      .maybeSingle();
    if (original) {
      comprobanteAsociado = {
        puntoVenta: original.punto_venta,
        numeroComprobante: original.numero_comprobante,
      };
    }
  }

  const qrDataUrl = await generarQrDataUrl({
    cuitEmisor: config?.cuit ?? "",
    fechaEmision: invoice.fecha_emision,
    puntoVenta: invoice.punto_venta,
    cbteTipo: invoice.cbte_tipo,
    numeroComprobante: invoice.numero_comprobante,
    importeTotal: Number(invoice.importe_total),
    docTipoReceptor: invoice.cliente_doc_tipo,
    docNroReceptor: invoice.cliente_doc_nro,
    cae: invoice.cae,
    moneda: invoice.moneda,
    cotizacion: Number(invoice.moneda_cotizacion ?? 1),
  });

  const pdfBuffer = await renderInvoicePdf({
    cbteTipo: invoice.cbte_tipo,
    emisorCuit: config?.cuit ?? "",
    emisorRazonSocial: config?.razon_social ?? "",
    puntoVenta: invoice.punto_venta,
    numeroComprobante: invoice.numero_comprobante,
    fechaEmision: invoice.fecha_emision,
    clienteDocTipo: invoice.cliente_doc_tipo,
    clienteDocNro: invoice.cliente_doc_nro,
    clienteNombre: invoice.cliente_nombre,
    condicionIvaReceptorId: invoice.condicion_iva_receptor_id,
    clientePais: invoice.cliente_pais,
    clienteDomicilio: invoice.cliente_domicilio,
    clienteIdImpositivo: invoice.cliente_id_impositivo,
    moneda: invoice.moneda,
    monedaCotizacion: Number(invoice.moneda_cotizacion ?? 1),
    items: invoice.items,
    importeTotal: Number(invoice.importe_total),
    cae: invoice.cae,
    caeVencimiento: invoice.cae_vencimiento,
    qrDataUrl,
    comprobanteAsociado,
  });

  // `attachment` fuerza el download nativo del sistema en vez de abrir en
  // una tab nueva de Safari (que rompía la sesión de PWA). En iOS abre
  // el share sheet directamente para guardar en Files o compartir.
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="factura-${invoice.punto_venta}-${invoice.numero_comprobante}.pdf"`,
    },
  });
}
