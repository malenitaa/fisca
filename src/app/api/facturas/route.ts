import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { getTicketAcceso } from "@/lib/afip/ta-cache";
import {
  getCotizacionOficial,
  getProximoNumeroComprobante,
  importeTotal,
  solicitarCae,
} from "@/lib/afip/wsfe";
import { AfipError } from "@/lib/afip/errors";
import { CBTE_TIPO_FACTURA_C } from "@/lib/afip/types";
import { nuevaFacturaSchema } from "@/lib/validation";
import type { Ambiente } from "@/lib/afip/config";
import { apiError, badRequest, internalError, tooMany, unauthorized } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const rl = await rateLimit(supabase, user.id, "facturas:c", {
    limit: 120,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany("Facturaste muy rápido. Esperá un momento.", rl.retryAfter);

  const json = await request.json().catch(() => null);
  const parsed = nuevaFacturaSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join(" "));
  }
  const input = parsed.data;

  const { data: config } = await supabase
    .from("afip_config")
    .select("cuit, punto_venta, ambiente, cert_encrypted, key_encrypted")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!config) {
    return badRequest("Todavía no cargaste tu configuración de ARCA (CUIT, certificado, etc.).");
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
      fechaComprobante: input.fechaComprobante,
      fechaServicioDesde: input.fechaServicioDesde,
      fechaServicioHasta: input.fechaServicioHasta,
      fechaVtoPago: input.fechaVtoPago,
      monedaId: input.monedaId,
      monedaCotizacion: input.monedaCotizacion,
      canMisMonExt: input.canMisMonExt,
    };

    const cae = await solicitarCae({
      ambiente,
      auth,
      puntoVenta: config.punto_venta,
      numeroComprobante,
      factura: facturaInput,
      importeTotal: total,
    });

    const monedaId = input.monedaId && input.monedaId !== "PES" ? input.monedaId : "PES";
    const esMonedaExtranjera = monedaId !== "PES";

    // El CAE ya se otorgó con la cotización que corresponda (asignada por
    // ARCA si CanMisMonExt="S", o la informada si es en pesos). Esta consulta
    // es solo para guardar un valor de referencia en el historial/PDF —
    // nunca puede hacer fallar el guardado de una factura ya autorizada.
    let monedaCotizacionGuardada = 1;
    if (esMonedaExtranjera) {
      if (input.canMisMonExt === "S") {
        try {
          const oficial = await getCotizacionOficial({
            ambiente,
            auth,
            monedaId,
            fecha: cae.fechaEmision,
          });
          monedaCotizacionGuardada = oficial.monCotiz;
        } catch {
          monedaCotizacionGuardada = input.monedaCotizacion ?? 1;
        }
      } else {
        monedaCotizacionGuardada = input.monedaCotizacion ?? 1;
      }
    }

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
        moneda: monedaId,
        moneda_cotizacion: monedaCotizacionGuardada,
        fecha_emision: cae.fechaEmision,
        cae: cae.cae,
        cae_vencimiento: cae.caeFchVto,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      // El CAE ya fue otorgado por AFIP; lo devolvemos igual aunque falle el guardado local,
      // para no hacerle perder al usuario un comprobante que ya es legalmente válido.
      console.error("[facturas c] insert failed after CAE:", insertError);
      return apiError(
        500,
        `La factura fue autorizada por AFIP (CAE ${cae.cae}) pero no se pudo guardar en el historial. Anotá el CAE.`
      );
    }

    // Guardar/actualizar el cliente en la libreta de contactos para autocompletar
    // en la próxima factura. Consumidor Final (99) no se guarda (no hay identidad).
    if (input.docTipo !== 99 && facturaInput.docNro) {
      await supabase.from("clientes").upsert(
        {
          user_id: user.id,
          doc_tipo: input.docTipo,
          doc_numero: facturaInput.docNro,
          nombre: input.clienteNombre ?? "",
          condicion_iva_id: input.condicionIvaReceptorId,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "user_id,doc_tipo,doc_numero" }
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
    // AfipError es intencionalmente amigable (ya está sanitizado desde el SOAP).
    if (err instanceof AfipError) return apiError(422, err.message);
    return internalError(err, "Error inesperado al emitir la factura.");
  }
}
