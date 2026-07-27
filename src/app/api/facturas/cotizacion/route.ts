import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { getTicketAcceso } from "@/lib/afip/ta-cache";
import { getCotizacionOficial } from "@/lib/afip/wsfe";
import type { Ambiente } from "@/lib/afip/config";
import { AfipError } from "@/lib/afip/errors";
import { apiError, badRequest, internalError, tooMany, unauthorized } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

const MONEDA_RE = /^[A-Z0-9]{3,4}$/;

/** Cotización oficial de AFIP para mercado interno (WSFEv1 FEParamGetCotizacion),
 * usada por Factura C en moneda extranjera. Distinta del endpoint de Factura E
 * (`/api/facturas/e/cotizacion`), que consulta WSFEX. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const rl = await rateLimit(supabase, user.id, "cotizacion-c", {
    limit: 60,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany(undefined, rl.retryAfter);

  const { searchParams } = new URL(request.url);
  const monedaId = (searchParams.get("moneda") ?? "DOL").toUpperCase();

  if (!MONEDA_RE.test(monedaId)) return badRequest("Moneda inválida.");

  const { data: config } = await supabase
    .from("afip_config")
    .select("cuit, ambiente, cert_encrypted, key_encrypted")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!config) return badRequest("Todavía no cargaste tu configuración de ARCA.");

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

    const result = await getCotizacionOficial({
      ambiente,
      auth: { token, sign, cuit: config.cuit },
      monedaId,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AfipError) return apiError(422, err.message);
    return internalError(err, "Error inesperado al consultar cotización.");
  }
}
