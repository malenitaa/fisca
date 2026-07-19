import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { certificateMatchesKey } from "@/lib/csr";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { badRequest, internalError, notFound, tooMany, unauthorized } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const rl = await rateLimit(supabase, user.id, "csr:submit", {
    limit: 10,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany(undefined, rl.retryAfter);

  const body = await request.json().catch(() => null);
  const draftId = typeof body?.draftId === "string" ? body.draftId : "";
  const crt = typeof body?.crt === "string" ? body.crt : "";
  const puntoVentaRaw = body?.puntoVenta;
  const ambiente = body?.ambiente === "produccion" ? "produccion" : "homologacion";
  const razonSocial = typeof body?.razonSocial === "string" ? body.razonSocial.trim() : "";

  const puntoVenta = Number(puntoVentaRaw);
  if (!Number.isInteger(puntoVenta) || puntoVenta < 1 || puntoVenta > 9999) {
    return badRequest("Punto de venta inválido.");
  }
  if (!UUID_RE.test(draftId)) return badRequest("Borrador inválido.");
  if (!crt || crt.length > 8000 || !crt.includes("BEGIN CERTIFICATE")) {
    return badRequest("Certificado inválido.");
  }
  if (razonSocial.length > 200) return badRequest("Razón social demasiado larga.");

  const { data: draft, error: draftError } = await supabase
    .from("csr_drafts")
    .select("id, cuit, razon_social, key_encrypted")
    .eq("id", draftId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (draftError) return internalError(draftError);
  if (!draft) return notFound("Borrador no encontrado.");

  const keyPem = decryptSecret(draft.key_encrypted);
  if (!certificateMatchesKey(crt, keyPem)) {
    return badRequest(
      "El certificado no corresponde al CSR generado. Asegurate de subir el .crt que ARCA firmó a partir del CSR de esta sesión."
    );
  }

  const razonSocialFinal = razonSocial || draft.razon_social || null;

  const { error } = await supabase.from("afip_config").upsert({
    user_id: user.id,
    cuit: draft.cuit,
    razon_social: razonSocialFinal,
    punto_venta: puntoVenta,
    ambiente,
    cert_encrypted: encryptSecret(crt),
    key_encrypted: encryptSecret(keyPem),
    updated_at: new Date().toISOString(),
  });

  if (error) return internalError(error);

  await Promise.all([
    supabase.from("csr_drafts").delete().eq("id", draft.id),
    supabase.from("afip_tickets").delete().eq("user_id", user.id),
  ]);

  return NextResponse.json({ ok: true });
}
