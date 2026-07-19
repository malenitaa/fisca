import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashPin, isValidPinFormat } from "@/lib/pin";
import { badRequest, internalError, tooMany, unauthorized } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/**
 * Vincula la cuenta anónima con un email + setea el PIN de re-entry.
 * El magic link de verificación lo envía Supabase; el flujo de "olvidé
 * mi PIN" reutiliza ese mismo email.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const rl = await rateLimit(supabase, user.id, "auth:vincular", {
    limit: 5,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany("Intentaste vincular demasiadas veces. Esperá un rato.", rl.retryAfter);

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const pin = body?.pin;

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return badRequest("Email inválido.");
  }
  if (!isValidPinFormat(pin)) {
    return badRequest("El PIN debe tener 6 dígitos.");
  }

  const { error: pinError } = await supabase.from("user_pins").upsert({
    user_id: user.id,
    pin_hash: hashPin(pin),
    failed_attempts: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  });
  if (pinError) return internalError(pinError);

  const { error: updateError } = await supabase.auth.updateUser({
    email,
    data: { linked_email: email },
  });
  if (updateError) return internalError(updateError, "No se pudo vincular el email.");

  return NextResponse.json({ ok: true });
}
