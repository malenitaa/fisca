import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("next") ?? "/facturas";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Si la usuaria tiene PIN configurado, pasamos por /desbloquear —
      // el email magic-link solo comprueba que controla el mail, no
      // reemplaza el PIN como segundo factor.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: pinRow } = await supabase
          .from("user_pins")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (pinRow) {
          const gateUrl = new URL(`${origin}/desbloquear`);
          gateUrl.searchParams.set("next", redirectTo);
          gateUrl.searchParams.set("fromLogin", "1");
          return NextResponse.redirect(gateUrl.toString());
        }
      }
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
