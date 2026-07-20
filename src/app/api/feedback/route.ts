import { NextResponse } from "next/server";
import { Resend } from "resend";
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

  // Envío por email best-effort: si Resend falla o no está configurado, el
  // feedback ya quedó en la DB y devolvemos 200 igual — no queremos hacer
  // fallar el request de la usuaria por un problema del proveedor de mail.
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_EMAIL_TO;
  const from = process.env.FEEDBACK_EMAIL_FROM || "onboarding@resend.dev";
  if (apiKey && to) {
    try {
      const resend = new Resend(apiKey);
      const identidad = user.email || (user.is_anonymous ? "usuaria anónima" : user.id);
      await resend.emails.send({
        from,
        to,
        subject: `Fisca — feedback de ${identidad}`,
        text: [
          `De: ${identidad}`,
          `User ID: ${user.id}`,
          path ? `Pantalla: ${path}` : null,
          userAgent ? `User-Agent: ${userAgent}` : null,
          "",
          message,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    } catch (err) {
      console.error("[feedback] no se pudo enviar email:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
