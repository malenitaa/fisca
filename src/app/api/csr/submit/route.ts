import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { certificateMatchesKey } from "@/lib/csr";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/**
 * La usuaria trae el .crt firmado por ARCA. Verificamos que corresponda al
 * par de claves generado, y lo guardamos junto con la clave (que ya teníamos
 * cifrada en csr_drafts) en afip_config.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const draftId = typeof body?.draftId === "string" ? body.draftId : "";
  const crt = typeof body?.crt === "string" ? body.crt : "";
  const puntoVentaRaw = body?.puntoVenta;
  const ambiente = body?.ambiente === "produccion" ? "produccion" : "homologacion";
  const razonSocial = typeof body?.razonSocial === "string" ? body.razonSocial.trim() : "";

  const puntoVenta = Number(puntoVentaRaw);
  if (!Number.isInteger(puntoVenta) || puntoVenta < 1) {
    return NextResponse.json({ error: "Punto de venta inválido." }, { status: 400 });
  }
  if (!draftId || !crt) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const { data: draft, error: draftError } = await supabase
    .from("csr_drafts")
    .select("id, cuit, razon_social, key_encrypted")
    .eq("id", draftId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (draftError || !draft) {
    return NextResponse.json({ error: "Borrador no encontrado." }, { status: 404 });
  }

  const keyPem = decryptSecret(draft.key_encrypted);
  if (!certificateMatchesKey(crt, keyPem)) {
    return NextResponse.json(
      {
        error:
          "El certificado no corresponde al CSR generado. Asegurate de subir el .crt que ARCA firmó a partir del CSR de esta sesión.",
      },
      { status: 400 }
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await Promise.all([
    supabase.from("csr_drafts").delete().eq("id", draft.id),
    supabase.from("afip_tickets").delete().eq("user_id", user.id),
  ]);

  return NextResponse.json({ ok: true });
}
