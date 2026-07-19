"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isCurrentlyUnlocked, isUnlockEnabled } from "@/lib/unlock";

/**
 * Gate cliente-side sobre el layout autenticado. Si el user activó el
 * unlock y ya se venció la ventana de 15min, redirige a /desbloquear
 * pasando el pathname actual como `next` para volver acá cuando termine.
 */
export function UnlockGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isUnlockEnabled()) {
      setChecked(true);
      return;
    }
    if (isCurrentlyUnlocked()) {
      setChecked(true);
      return;
    }
    router.replace(`/desbloquear?next=${encodeURIComponent(pathname)}`);
  }, [pathname, router]);

  if (!checked) return null;
  return <>{children}</>;
}
