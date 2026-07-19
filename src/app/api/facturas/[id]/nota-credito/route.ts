import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { getTicketAcceso } from "@/lib/afip/ta-cache";
import { getProximoNumeroComprobante, solicitarCae } from "@/lib/afip/wsfe";
import { AfipError } from "@/lib/afip/errors";
import {
  CBTE_TIPO_FACTURA_E,
  CBTE_TIPO_NOTA_CREDITO_C,
  CBTE_TIPO_NOTA_CREDITO_E,
} from "@/lib/afip/types";
import type { Ambiente } from "@/lib/afip/config";

/** Anula una factura C emitida por error emitiendo la Nota de Crédito C asociada. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: original } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!original) {
    return NextResponse.json({ error: "Factura no encontrada." }, { status: 404 });
  }

  if (original.comprobante_asociado_id !== null) {
    return NextResponse.json(
      { error: "Este comprobante ya es una Nota de Crédito, no se puede anular." },
      { status: 400 }
    );
  }

  // Bloqueo: la anulación de Factura E (via NC E) usa WSFEXv1 — todavía no
  // está implementado. Se avisa explícitamente para no confundir al usuario.
  if (
    original.cbte_tipo === CBTE_TIPO_FACTURA_E ||
    original.cbte_tipo === CBTE_TIPO_NOTA_CREDITO_E
  ) {
    return NextResponse.json(
      {
        error:
          "La anulación de Facturas E todavía no está implementada. Pedile ayuda al soporte o esperá la próxima versión.",
      },
      { status: 501 }
    );
  }

  const { data: yaAnulada } = await supabase
    .from("invoices")
    .select("id")
    .eq("comprobante_asociado_id", id)
    .maybeSingle();

  if (yaAnulada) {
    return NextResponse.json(
      { error: "Esta factura ya tiene una Nota de Crédito asociada." },
      { status: 400 }
    );
  }

  const { data: config } = await supabase
    .from("afip_config")
    .select("cuit, punto_venta, ambiente, cert_encrypted, key_encrypted")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!config) {
    return NextResponse.json({ error: "Falta la configuración de ARCA." }, { status: 400 });
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
      puntoVenta: original.punto_venta,
      cbteTipo: CBTE_TIPO_NOTA_CREDITO_C,
    });

    const cae = await solicitarCae({
      ambiente,
      auth,
      puntoVenta: original.punto_venta,
      numeroComprobante,
      cbteTipo: CBTE_TIPO_NOTA_CREDITO_C,
      comprobantesAsociados: [
        {
          cbteTipo: original.cbte_tipo,
          puntoVenta: original.punto_venta,
          numeroComprobante: original.numero_comprobante,
        },
      ],
      factura: {
        concepto: original.concepto,
        docTipo: original.cliente_doc_tipo,
        docNro: original.cliente_doc_nro,
        clienteNombre: original.cliente_nombre ?? undefined,
        condicionIvaReceptorId: original.condicion_iva_receptor_id,
        items: original.items,
      },
      importeTotal: Number(original.importe_total),
    });

    const { data: inserted, error: insertError } = await supabase
      .from("invoices")
      .insert({
        user_id: user.id,
        ambiente,
        cbte_tipo: CBTE_TIPO_NOTA_CREDITO_C,
        punto_venta: original.punto_venta,
        numero_comprobante: numeroComprobante,
        concepto: original.concepto,
        cliente_doc_tipo: original.cliente_doc_tipo,
        cliente_doc_nro: original.cliente_doc_nro,
        cliente_nombre: original.cliente_nombre,
        condicion_iva_receptor_id: original.condicion_iva_receptor_id,
        items: original.items,
        importe_total: original.importe_total,
        moneda: original.moneda,
        fecha_emision: cae.fechaEmision,
        cae: cae.cae,
        cae_vencimiento: cae.caeFchVto,
        comprobante_asociado_id: original.id,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        {
          error: `ARCA autorizó la Nota de Crédito (CAE ${cae.cae}) pero no se pudo guardar en el historial: ${insertError?.message}. Anotá el CAE.`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      facturaId: inserted.id,
      cae: cae.cae,
      caeVencimiento: cae.caeFchVto,
      numeroComprobante,
      puntoVenta: original.punto_venta,
    });
  } catch (err) {
    if (err instanceof AfipError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error inesperado al anular la factura." },
      { status: 500 }
    );
  }
}
