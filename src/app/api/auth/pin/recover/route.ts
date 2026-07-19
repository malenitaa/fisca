import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest, internalError, tooMany, unauthorized } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Fallback si el user olvidó el PIN: enviamos magic link al email vinculado.
 * Cuando clickea, entra con nueva sesión y va a /reset-pin.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const rl = await rateLimit(supabase, user.id, "auth:pin-recover", {
    limit: 3,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany("Ya pediste el link hace un rato. Revisá tu casilla.", rl.retryAfter);

  const email =
    user.email ||
    (typeof user.user_metadata?.linked_email === "string"
      ? user.user_metadata.linked_email
      : null);

  if (!email) return badRequest("Esta cuenta no tiene email vinculado.");

  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin.origin}/auth/callback?next=/reset-pin`,
      shouldCreateUser: false,
    },
  });

  if (error) return internalError(error, "No pudimos enviar el mail. Reintentá.");

  return NextResponse.json({ ok: true, email });
}
