import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashPin, isValidPinFormat } from "@/lib/pin";

/**
 * Setea un nuevo PIN tras entrar por magic link.
 * Se accede desde /reset-pin cuando el user vino por recovery.
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
  const pin = body?.pin;
  if (!isValidPinFormat(pin)) {
    return NextResponse.json({ error: "El PIN debe tener 6 dígitos." }, { status: 400 });
  }

  const { error } = await supabase.from("user_pins").upsert({
    user_id: user.id,
    pin_hash: hashPin(pin),
    failed_attempts: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
