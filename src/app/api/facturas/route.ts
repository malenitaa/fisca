import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { getTicketAcceso } from "@/lib/afip/ta-cache";
import { getProximoNumeroComprobante, importeTotal, solicitarCae } from "@/lib/afip/wsfe";
import { AfipError } from "@/lib/afip/errors";
import { CBTE_TIPO_FACTURA_C } from "@/lib/afip/types";
import { nuevaFacturaSchema } from "@/lib/validation";
import type { Ambiente } from "@/lib/afip/config";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const json = await request.json();
  const parsed = nuevaFacturaSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const { data: config } = await supabase
    .from("afip_config")
    .select("cuit, punto_venta, ambiente, cert_encrypted, key_encrypted")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!config) {
    return NextResponse.json(
      { error: "Todavía no cargaste tu configuración de ARCA (CUIT, certificado, etc.)." },
      { status: 400 }
    );
  }

  try {
    const cert = decryptSecret(config.cert_encrypted);
    const key = decryptSecret(config.key_encrypted);
    const ambiente = config.ambiente as Ambiente;

    const { token, sign } = await getTicketAcceso({
      supabase,
      userId: user.id,
      cert,
      key,
      ambiente,
    });

    const auth = { token, sign, cuit: config.cuit };

    const numeroComprobante = await getProximoNumeroComprobante({
      ambiente,
      auth,
      puntoVenta: config.punto_venta,
    });

    const total = importeTotal(
      input.items.map((it) => ({
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
      }))
    );

    const facturaInput = {
      concepto: input.concepto as 1 | 2 | 3,
      docTipo: input.docTipo as 80 | 96 | 99,
      docNro: input.docTipo === 99 ? "0" : input.docNro.replace(/[^0-9]/g, ""),
      clienteNombre: input.clienteNombre,
      condicionIvaReceptorId: input.condicionIvaReceptorId,
      items: input.items,
      fechaServicioDesde: input.fechaServicioDesde,
      fechaServicioHasta: input.fechaServicioHasta,
      fechaVtoPago: input.fechaVtoPago,
    };

    const cae = await solicitarCae({
      ambiente,
      auth,
      puntoVenta: config.punto_venta,
      numeroComprobante,
      factura: facturaInput,
      importeTotal: total,
    });

    const { data: inserted, error: insertError } = await supabase
      .from("invoices")
      .insert({
        user_id: user.id,
        ambiente,
        cbte_tipo: CBTE_TIPO_FACTURA_C,
        punto_venta: config.punto_venta,
        numero_comprobante: numeroComprobante,
        concepto: input.concepto,
        cliente_doc_tipo: input.docTipo,
        cliente_doc_nro: facturaInput.docNro,
        cliente_nombre: input.clienteNombre ?? null,
        condicion_iva_receptor_id: input.condicionIvaReceptorId,
        items: input.items,
        importe_total: total,
        moneda: "PES",
        fecha_emision: cae.fechaEmision,
        cae: cae.cae,
        cae_vencimiento: cae.caeFchVto,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      // El CAE ya fue otorgado por AFIP; lo devolvemos igual aunque falle el guardado local,
      // para no hacerle perder al usuario un comprobante que ya es legalmente válido.
      console.error("[api/facturas] Error guardando factura en historial", insertError);
      return NextResponse.json(
        {
          error: `La factura fue autorizada por AFIP (CAE ${cae.cae}) pero no se pudo guardar en el historial. Anotá el CAE.`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      facturaId: inserted.id,
      cae: cae.cae,
      caeVencimiento: cae.caeFchVto,
      numeroComprobante,
      puntoVenta: config.punto_venta,
    });
  } catch (err) {
    if (err instanceof AfipError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("[api/facturas]", err);
    return NextResponse.json(
      { error: "Error inesperado al emitir la factura. Intentá de nuevo." },
      { status: 500 }
    );
  }
}
