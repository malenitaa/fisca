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
import { apiError, badRequest, internalError, notFound, tooMany, unauthorized } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Anula una factura C emitida por error emitiendo la Nota de Crédito C asociada. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return badRequest("ID inválido.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const rl = await rateLimit(supabase, user.id, "facturas:nc", {
    limit: 30,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany("Demasiadas anulaciones seguidas.", rl.retryAfter);

  const { data: original } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!original) return notFound("Factura no encontrada.");

  if (original.comprobante_asociado_id !== null) {
    return badRequest("Este comprobante ya es una Nota de Crédito, no se puede anular.");
  }

  if (
    original.cbte_tipo === CBTE_TIPO_FACTURA_E ||
    original.cbte_tipo === CBTE_TIPO_NOTA_CREDITO_E
  ) {
    return apiError(
      501,
      "La anulación de Facturas E todavía no está implementada. Pedile ayuda al soporte o esperá la próxima versión."
    );
  }

  const { data: yaAnulada } = await supabase
    .from("invoices")
    .select("id")
    .eq("comprobante_asociado_id", id)
    .maybeSingle();

  if (yaAnulada) return badRequest("Esta factura ya tiene una Nota de Crédito asociada.");

  const { data: config } = await supabase
    .from("afip_config")
    .select("cuit, punto_venta, ambiente, cert_encrypted, key_encrypted")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!config) return badRequest("Falta la configuración de ARCA.");

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
      console.error("[nota-credito] insert failed after CAE:", insertError);
      return apiError(
        500,
        `ARCA autorizó la Nota de Crédito (CAE ${cae.cae}) pero no se pudo guardar en el historial. Anotá el CAE.`
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
    if (err instanceof AfipError) return apiError(422, err.message);
    return internalError(err, "Error inesperado al anular la factura.");
  }
}
