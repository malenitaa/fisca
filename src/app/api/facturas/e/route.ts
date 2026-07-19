import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { getTicketAcceso } from "@/lib/afip/ta-cache";
import { getProximoNumeroComprobanteE, importeTotalE, solicitarCaeE } from "@/lib/afip/wsfex";
import { WSFEX_SERVICE_NAME, type Ambiente } from "@/lib/afip/config";
import { AfipError } from "@/lib/afip/errors";
import { CBTE_TIPO_FACTURA_E } from "@/lib/afip/types";
import { nuevaFacturaESchema } from "@/lib/validation";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const json = await request.json();
  const parsed = nuevaFacturaESchema.safeParse(json);
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

    // Factura E usa un TA distinto (servicio wsfex) al de Factura C.
    const { token, sign } = await getTicketAcceso({
      supabase,
      userId: user.id,
      cert,
      key,
      ambiente,
      service: WSFEX_SERVICE_NAME,
    });

    const auth = { token, sign, cuit: config.cuit };

    const numeroComprobante = await getProximoNumeroComprobanteE({
      ambiente,
      auth,
      puntoVenta: config.punto_venta,
    });

    const items = input.items.map((it) => ({
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
    }));

    const total = importeTotalE(items);

    const cae = await solicitarCaeE({
      ambiente,
      auth,
      puntoVenta: config.punto_venta,
      numeroComprobante,
      importeTotal: total,
      factura: {
        clienteNombre: input.clienteNombre,
        clientePais: input.clientePais,
        clienteCuitPais: input.clienteCuitPais,
        clienteDomicilio: input.clienteDomicilio,
        clienteIdImpositivo: input.clienteIdImpositivo,
        monedaId: input.monedaId,
        monedaCotizacion: input.monedaCotizacion,
        tipoExpo: input.tipoExpo as 1 | 2 | 4,
        idiomaCbte: input.idiomaCbte as 1 | 2 | 3,
        items,
      },
    });

    const { data: inserted, error: insertError } = await supabase
      .from("invoices")
      .insert({
        user_id: user.id,
        ambiente,
        cbte_tipo: CBTE_TIPO_FACTURA_E,
        punto_venta: config.punto_venta,
        numero_comprobante: numeroComprobante,
        concepto: input.tipoExpo === 2 ? 1 : 2, // best-effort: bienes=1, servicios/otros=2
        cliente_doc_tipo: null,
        cliente_doc_nro: null,
        cliente_nombre: input.clienteNombre,
        condicion_iva_receptor_id: null,
        items: input.items,
        importe_total: total,
        moneda: input.monedaId,
        moneda_cotizacion: input.monedaCotizacion,
        cliente_pais: input.clientePais,
        cliente_domicilio: input.clienteDomicilio ?? null,
        cliente_id_impositivo: input.clienteIdImpositivo ?? null,
        tipo_expo: input.tipoExpo,
        idioma_cbte: input.idiomaCbte,
        fecha_emision: cae.fechaEmision,
        cae: cae.cae,
        cae_vencimiento: cae.caeFchVto,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        {
          error: `La Factura E fue autorizada por AFIP (CAE ${cae.cae}) pero no se pudo guardar en el historial: ${insertError?.message}. Anotá el CAE.`,
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
      moneda: input.monedaId,
    });
  } catch (err) {
    if (err instanceof AfipError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error inesperado al emitir la Factura E.",
      },
      { status: 500 }
    );
  }
}
