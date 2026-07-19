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

  const rl = await rateLimit(supabase, user.id, "monotributo:pagos", {
    limit: 60,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany(undefined, rl.retryAfter);

  const body = await request.json().catch(() => null);
  const periodo = body?.periodo;
  if (typeof periodo !== "string" || !/^\d{4}-\d{2}$/.test(periodo)) {
    return badRequest("Período inválido.");
  }

  const { error } = await supabase
    .from("monotributo_pagos")
    .upsert({ user_id: user.id, periodo });

  if (error) return internalError(error);

  return NextResponse.json({ ok: true });
}
