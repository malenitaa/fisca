import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { configuracionSchema } from "@/lib/validation";
import { badRequest, internalError, tooMany, unauthorized } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const rl = await rateLimit(supabase, user.id, "configuracion", {
    limit: 10,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany(undefined, rl.retryAfter);

  const json = await request.json().catch(() => null);
  const parsed = configuracionSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join(" "));
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

  if (error) return internalError(error);

  // Si cambió cert/ambiente, el TA cacheado (si había uno) queda inválido.
  await supabase.from("afip_tickets").delete().eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
