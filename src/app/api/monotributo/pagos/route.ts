import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { periodo } = await request.json();
  if (typeof periodo !== "string" || !/^\d{4}-\d{2}$/.test(periodo)) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }

  const { error } = await supabase
    .from("monotributo_pagos")
    .upsert({ user_id: user.id, periodo });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
