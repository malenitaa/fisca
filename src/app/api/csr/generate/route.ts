import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCsr } from "@/lib/csr";
import { encryptSecret } from "@/lib/crypto";

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
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const cuit = typeof body?.cuit === "string" ? body.cuit.replace(/\D/g, "") : "";
  const razonSocial = typeof body?.razonSocial === "string" ? body.razonSocial.trim() : "";

  if (cuit.length !== 11) {
    return NextResponse.json({ error: "El CUIT debe tener 11 dígitos." }, { status: 400 });
  }

  let generated;
  try {
    generated = generateCsr({ cuit, razonSocial: razonSocial || null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo generar el CSR." },
      { status: 500 }
    );
  }

  // Solo un draft activo por user — si vuelve al wizard, arrancamos limpio.
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

  if (error || !draft) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo guardar el borrador." },
      { status: 500 }
    );
  }

  return NextResponse.json({ draftId: draft.id, csrPem: generated.csrPem });
}
