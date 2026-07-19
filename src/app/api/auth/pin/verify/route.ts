import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyPin, isValidPinFormat } from "@/lib/pin";
import { badRequest, internalError, notFound, unauthorized } from "@/lib/api-errors";

const MAX_ATTEMPTS = 3;
// Bloqueo largo: si te comiste 3 intentos, tenés que ir por magic link.
const LOCK_MINUTES = 60 * 24;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const pin = body?.pin;
  if (!isValidPinFormat(pin)) return badRequest("PIN inválido.");

  const { data: row, error } = await supabase
    .from("user_pins")
    .select("pin_hash, failed_attempts, locked_until")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return internalError(error);
  if (!row) return notFound("No hay PIN configurado.");

  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    return NextResponse.json(
      { error: "PIN bloqueado. Recuperá el acceso por email.", locked: true },
      { status: 429 }
    );
  }

  const ok = verifyPin(pin, row.pin_hash);

  if (ok) {
    await supabase
      .from("user_pins")
      .update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  }

  const nextAttempts = row.failed_attempts + 1;
  const shouldLock = nextAttempts >= MAX_ATTEMPTS;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
    : null;

  await supabase
    .from("user_pins")
    .update({
      failed_attempts: nextAttempts,
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  return NextResponse.json(
    {
      error: shouldLock
        ? "PIN bloqueado. Recuperá el acceso por email."
        : "PIN incorrecto.",
      locked: shouldLock,
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS - nextAttempts),
    },
    { status: shouldLock ? 429 : 401 }
  );
}
