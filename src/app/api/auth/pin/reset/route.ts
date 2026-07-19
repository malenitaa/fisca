import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashPin, isValidPinFormat } from "@/lib/pin";
import { badRequest, internalError, tooMany, unauthorized } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Setea un nuevo PIN tras entrar por magic link.
 * Se accede desde /reset-pin cuando el user vino por recovery.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const rl = await rateLimit(supabase, user.id, "auth:pin-reset", {
    limit: 5,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany("Demasiados intentos. Esperá un momento.", rl.retryAfter);

  const body = await request.json().catch(() => null);
  const pin = body?.pin;
  if (!isValidPinFormat(pin)) return badRequest("El PIN debe tener 6 dígitos.");

  const { error } = await supabase.from("user_pins").upsert({
    user_id: user.id,
    pin_hash: hashPin(pin),
    failed_attempts: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  });

  if (error) return internalError(error);

  return NextResponse.json({ ok: true });
}
