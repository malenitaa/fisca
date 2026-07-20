"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isCurrentlyUnlocked, isUnlockEnabled } from "@/lib/unlock";
import { SplashView } from "@/components/splash-view";

/**
 * Gate cliente-side sobre el layout autenticado. Redirige a /desbloquear
 * cuando el user activó el unlock y el estado in-memory dice "no unlocked"
 * (recién abrió la app, o el WebView volvió del background).
 */
export function UnlockGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    function check() {
      if (!isUnlockEnabled()) {
        setChecked(true);
        return;
      }
      if (isCurrentlyUnlocked()) {
        setChecked(true);
        return;
      }
      setChecked(false);
      router.replace(`/desbloquear?next=${encodeURIComponent(pathname)}`);
    }
    check();

    // Al volver del background el estado in-memory ya se limpió; re-chequeamos.
    function onVisibility() {
      if (document.visibilityState === "visible") check();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pathname, router]);

  if (!checked) return <SplashView />;
  return <>{children}</>;
}
