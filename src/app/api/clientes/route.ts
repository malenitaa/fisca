import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { internalError, unauthorized } from "@/lib/api-errors";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombre, doc_tipo, doc_numero, condicion_iva_id, last_used_at")
    .eq("user_id", user.id)
    .order("last_used_at", { ascending: false })
    .limit(50);

  if (error) return internalError(error);

  return NextResponse.json({ clientes: data ?? [] });
}
