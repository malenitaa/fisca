import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest, internalError, tooMany, unauthorized } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const rl = await rateLimit(supabase, user.id, "feedback", {
    limit: 10,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany("Ya mandaste varios mensajes. Esperá un rato.", rl.retryAfter);

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const path = typeof body?.path === "string" ? body.path.slice(0, 200) : null;

  if (!message || message.length > 4000) return badRequest("Mensaje inválido.");

  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    message,
    user_agent: userAgent,
    path,
  });

  if (error) return internalError(error);
  return NextResponse.json({ ok: true });
}
