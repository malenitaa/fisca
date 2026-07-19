import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Fallback si el user olvidó el PIN: enviamos magic link al email vinculado.
 * Cuando clickea, entra con nueva sesión y va a /reset-pin.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const email =
    user.email ||
    (typeof user.user_metadata?.linked_email === "string"
      ? user.user_metadata.linked_email
      : null);

  if (!email) {
    return NextResponse.json(
      { error: "Esta cuenta no tiene email vinculado." },
      { status: 400 }
    );
  }

  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin.origin}/auth/callback?next=/reset-pin`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email });
}
