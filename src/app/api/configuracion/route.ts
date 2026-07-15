import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { configuracionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const json = await request.json();
  const parsed = configuracionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 }
    );
  }

  const { cuit, razonSocial, puntoVenta, ambiente, cert, key } = parsed.data;

  const { error } = await supabase.from("afip_config").upsert({
    user_id: user.id,
    cuit,
    razon_social: razonSocial ?? null,
    punto_venta: puntoVenta,
    ambiente,
    cert_encrypted: encryptSecret(cert),
    key_encrypted: encryptSecret(key),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Si cambió cert/ambiente, el TA cacheado (si había uno) queda inválido.
  await supabase.from("afip_tickets").delete().eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
