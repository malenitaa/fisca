import type { SupabaseClient } from "@supabase/supabase-js";
import { requestTicketAcceso } from "./wsaa";
import { WSFE_SERVICE_NAME, type Ambiente } from "./config";

/**
 * Devuelve un Ticket de Acceso (TA) válido para el usuario, reusando el
 * cacheado en `afip_tickets` si todavía no venció. Si no hay uno vigente,
 * pide uno nuevo a WSAA (firmando el TRA con el cert/key del usuario) y lo
 * cachea para las próximas 12hs.
 */
export async function getTicketAcceso(params: {
  supabase: SupabaseClient;
  userId: string;
  cert: string;
  key: string;
  ambiente: Ambiente;
}): Promise<{ token: string; sign: string }> {
  const { supabase, userId, cert, key, ambiente } = params;

  const { data: cached } = await supabase
    .from("afip_tickets")
    .select("token, sign, expiration_time")
    .eq("user_id", userId)
    .eq("ambiente", ambiente)
    .maybeSingle();

  // Le damos 5 minutos de margen antes del vencimiento real para evitar
  // usar un ticket que expire a mitad de la request.
  const safetyMarginMs = 5 * 60_000;
  if (cached && new Date(cached.expiration_time).getTime() - safetyMarginMs > Date.now()) {
    return { token: cached.token, sign: cached.sign };
  }

  const ticket = await requestTicketAcceso({
    cert,
    key,
    service: WSFE_SERVICE_NAME,
    ambiente,
  });

  await supabase.from("afip_tickets").upsert({
    user_id: userId,
    ambiente,
    token: ticket.token,
    sign: ticket.sign,
    expiration_time: ticket.expirationTime,
  });

  return { token: ticket.token, sign: ticket.sign };
}
