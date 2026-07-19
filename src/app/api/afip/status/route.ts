import { NextResponse } from "next/server";
import { getAfipStatus } from "@/lib/afip/status";

/** Sin auth a propósito: se usa desde /ayuda (ya autenticado) pero también
 * tiene que poder mostrarse en /login, antes de tener sesión. */
export async function GET() {
  const status = await getAfipStatus();
  return NextResponse.json(status);
}
