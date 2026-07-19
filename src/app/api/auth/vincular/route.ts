import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashPin, isValidPinFormat } from "@/lib/pin";

/**
 * Vincula la cuenta anónima con un email + setea el PIN de re-entry.
 * Supabase envía un magic link al email para confirmarlo — el flujo de
 * "olvidé mi PIN" reutiliza ese mismo email.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const pin = body?.pin;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }
  if (!isValidPinFormat(pin)) {
    return NextResponse.json({ error: "El PIN debe tener 6 dígitos." }, { status: 400 });
  }

  const { error: pinError } = await supabase.from("user_pins").upsert({
    user_id: user.id,
    pin_hash: hashPin(pin),
    failed_attempts: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  });
  if (pinError) {
    return NextResponse.json({ error: pinError.message }, { status: 500 });
  }

  // Asocia el email al user (Supabase manda un magic link para confirmar).
  // Guardamos también en user_metadata para poder resolver el email en el
  // flujo de recuperación aun si el confirm todavía está pendiente.
  const { error: updateError } = await supabase.auth.updateUser({
    email,
    data: { linked_email: email },
  });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
