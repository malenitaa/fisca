import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clienteUpdateSchema } from "@/lib/validation";
import { badRequest, internalError, notFound, tooMany, unauthorized } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Edita un contacto guardado (nombre / condición IVA) — el tipo/número de
 * documento no se puede editar acá, es la identidad del contacto. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return badRequest("ID inválido.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const rl = await rateLimit(supabase, user.id, "clientes:mutate", {
    limit: 30,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany(undefined, rl.retryAfter);

  const json = await request.json().catch(() => null);
  const parsed = clienteUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join(" "));
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.nombre !== undefined) patch.nombre = parsed.data.nombre;
  if (parsed.data.condicionIvaId !== undefined) patch.condicion_iva_id = parsed.data.condicionIvaId;

  const { data, error } = await supabase
    .from("clientes")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, nombre, doc_tipo, doc_numero, condicion_iva_id, last_used_at")
    .maybeSingle();

  if (error) return internalError(error);
  if (!data) return notFound("Contacto no encontrado.");

  return NextResponse.json({ cliente: data });
}

/** Borra un contacto guardado de la libreta. No afecta las facturas ya
 * emitidas (invoices guarda los datos del cliente en el momento, no una
 * referencia a esta tabla). */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return badRequest("ID inválido.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  const rl = await rateLimit(supabase, user.id, "clientes:mutate", {
    limit: 30,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany(undefined, rl.retryAfter);

  const { data, error } = await supabase
    .from("clientes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return internalError(error);
  if (!data) return notFound("Contacto no encontrado.");

  return NextResponse.json({ ok: true });
}
