"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Handle = { remove: () => void | Promise<void> };

interface CapacitorPluginsApp {
  addListener(
    event: "appUrlOpen",
    handler: (data: { url: string }) => void | Promise<void>
  ): Handle | Promise<Handle>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: { App?: CapacitorPluginsApp };
}

export function CapacitorDeepLink() {
  const router = useRouter();

  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const AppPlugin = cap.Plugins?.App;
    if (!AppPlugin) return;

    const result = AppPlugin.addListener("appUrlOpen", async ({ url }) => {
      if (!url.startsWith("fisca://auth-callback")) return;
      const parsed = new URL(url);
      const raw = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.search.slice(1);
      const params = new URLSearchParams(raw);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (!access_token || !refresh_token) return;
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (!error) router.replace("/facturas");
    });

    // El bridge de Capacitor devuelve el handle sincrónicamente, pero
    // el paquete @capacitor/app envuelve en Promise — soportamos ambos.
    let handle: Handle | undefined;
    if (result && typeof (result as Promise<Handle>).then === "function") {
      (result as Promise<Handle>).then((h) => {
        handle = h;
      });
    } else {
      handle = result as Handle;
    }

    return () => {
      handle?.remove();
    };
  }, [router]);

  return null;
}
