import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Devuelve si el user tiene al menos una passkey registrada. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ has: false }, { status: 401 });

  const { count } = await supabase
    .from("user_passkeys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return NextResponse.json({ has: (count ?? 0) > 0 });
}
