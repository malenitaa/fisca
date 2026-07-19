import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { getTicketAcceso } from "@/lib/afip/ta-cache";
import { getCotizacionAfip } from "@/lib/afip/wsfex";
import { WSFEX_SERVICE_NAME, type Ambiente } from "@/lib/afip/config";
import { AfipError } from "@/lib/afip/errors";

/** Devuelve la cotización oficial de AFIP (WSFEXv1 `FEXGetPARAM_Ctz`) para
 * una moneda + fecha. Es la única fuente que ARCA acepta al emitir Factura
 * E — dolarapi.com puede diferir en decimales. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const monedaId = (searchParams.get("moneda") ?? "DOL").toUpperCase();
  const fecha = searchParams.get("fecha") ?? undefined;

  const { data: config } = await supabase
    .from("afip_config")
    .select("cuit, ambiente, cert_encrypted, key_encrypted")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!config) {
    return NextResponse.json(
      { error: "Falta la configuración de ARCA." },
      { status: 400 }
    );
  }

  try {
    const cert = decryptSecret(config.cert_encrypted);
    const key = decryptSecret(config.key_encrypted);
    const ambiente = config.ambiente as Ambiente;

    const { token, sign } = await getTicketAcceso({
      supabase,
      userId: user.id,
      cert,
      key,
      ambiente,
      service: WSFEX_SERVICE_NAME,
    });

    const result = await getCotizacionAfip({
      ambiente,
      auth: { token, sign, cuit: config.cuit },
      monedaId,
      fecha: fecha ?? undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AfipError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error inesperado al consultar cotización.",
      },
      { status: 500 }
    );
  }
}
