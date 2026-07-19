import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { getTicketAcceso } from "@/lib/afip/ta-cache";
import { getCotizacionAfip } from "@/lib/afip/wsfex";
import { WSFEX_SERVICE_NAME, type Ambiente } from "@/lib/afip/config";
import { AfipError } from "@/lib/afip/errors";
import { apiError, badRequest, internalError, tooMany, unauthorized } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

const MONEDA_RE = /^[A-Z]{3}$/;
const FECHA_RE = /^\d{8}$/;

/** Cotización oficial de AFIP (WSFEXv1 FEXGetPARAM_Ctz). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const rl = await rateLimit(supabase, user.id, "cotizacion", {
    limit: 60,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany(undefined, rl.retryAfter);

  const { searchParams } = new URL(request.url);
  const monedaId = (searchParams.get("moneda") ?? "DOL").toUpperCase();
  const fecha = searchParams.get("fecha") ?? undefined;

  if (!MONEDA_RE.test(monedaId)) return badRequest("Moneda inválida.");
  if (fecha && !FECHA_RE.test(fecha)) return badRequest("Fecha inválida.");

  const { data: config } = await supabase
    .from("afip_config")
    .select("cuit, ambiente, cert_encrypted, key_encrypted")
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
      service: WSFEX_SERVICE_NAME,
    });

    const result = await getCotizacionAfip({
      ambiente,
      auth: { token, sign, cuit: config.cuit },
      monedaId,
      fecha: fecha ?? undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AfipError) return apiError(422, err.message);
    return internalError(err, "Error inesperado al consultar cotización.");
  }
}
