import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCsr } from "@/lib/csr";
import { encryptSecret } from "@/lib/crypto";
import { badRequest, internalError, tooMany, unauthorized } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Genera par de claves + CSR para que la usuaria firme en ARCA. La clave
 * privada nunca vuelve al cliente — se guarda cifrada en csr_drafts hasta
 * que traiga el .crt en /api/csr/submit.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const rl = await rateLimit(supabase, user.id, "csr:generate", {
    limit: 5,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany("Ya generaste varios pedidos. Esperá un momento.", rl.retryAfter);

  const body = await request.json().catch(() => null);
  const cuit = typeof body?.cuit === "string" ? body.cuit.replace(/\D/g, "") : "";
  const razonSocial = typeof body?.razonSocial === "string" ? body.razonSocial.trim() : "";

  if (cuit.length !== 11) return badRequest("El CUIT debe tener 11 dígitos.");
  if (razonSocial.length > 200) return badRequest("La razón social es demasiado larga.");

  let generated;
  try {
    generated = generateCsr({ cuit, razonSocial: razonSocial || null });
  } catch (err) {
    return internalError(err, "No se pudo generar el CSR.");
  }

  await supabase.from("csr_drafts").delete().eq("user_id", user.id);

  const { data: draft, error } = await supabase
    .from("csr_drafts")
    .insert({
      user_id: user.id,
      cuit,
      razon_social: razonSocial || null,
      key_encrypted: encryptSecret(generated.privateKeyPem),
    })
    .select("id")
    .single();

  if (error || !draft) return internalError(error, "No se pudo guardar el borrador.");

  return NextResponse.json({ draftId: draft.id, csrPem: generated.csrPem });
}
