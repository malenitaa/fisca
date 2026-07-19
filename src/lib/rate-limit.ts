import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rate limiting persistente en Postgres. En serverless no podemos usar
 * memoria porque cada request va a una lambda distinta.
 *
 * Uso:
 *   const check = await rateLimit(supabase, user.id, "csr:generate", { limit: 5, windowSeconds: 3600 });
 *   if (!check.ok) return tooMany("Demasiadas solicitudes.", check.retryAfter);
 */
export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfter?: number;
}

export async function rateLimit(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const now = new Date();
  const windowMs = options.windowSeconds * 1000;

  const { data: existing, error } = await supabase
    .from("api_rate_limits")
    .select("count, window_start")
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (error) {
    // Si el rate limit falla (tabla mal, RLS mal, etc.), permitimos la
    // request y logueamos — mejor que dejar la app caída.
    console.error("[rate-limit] read error:", error);
    return { ok: true };
  }

  if (!existing) {
    const { error: insertError } = await supabase
      .from("api_rate_limits")
      .insert({
        user_id: userId,
        endpoint,
        window_start: now.toISOString(),
        count: 1,
      });
    if (insertError) console.error("[rate-limit] insert error:", insertError);
    return { ok: true };
  }

  const windowStart = new Date(existing.window_start).getTime();
  const elapsed = now.getTime() - windowStart;

  if (elapsed > windowMs) {
    // Ventana expiró, reseteamos.
    await supabase
      .from("api_rate_limits")
      .update({ window_start: now.toISOString(), count: 1 })
      .eq("user_id", userId)
      .eq("endpoint", endpoint);
    return { ok: true };
  }

  if (existing.count >= options.limit) {
    const retryAfter = Math.ceil((windowMs - elapsed) / 1000);
    return { ok: false, retryAfter };
  }

  await supabase
    .from("api_rate_limits")
    .update({ count: existing.count + 1 })
    .eq("user_id", userId)
    .eq("endpoint", endpoint);
  return { ok: true };
}
