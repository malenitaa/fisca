"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function crearCuenta() {
      const supabase = createClient();
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setErrorMessage(error.message);
        setStatus("error");
        return;
      }
      // Sesión anónima creada; el usuario puede seguir sin cargar email.
      // Cuando quiera guardar la cuenta en otro dispositivo, la va a linkear
      // con email/Face ID desde Perfil.
      router.replace("/configuracion");
    }
    crearCuenta();
  }, [router]);

  if (status === "error") {
    return (
      <main
        className="flex h-dvh flex-col items-center justify-center bg-[#003366] px-6 text-center text-white"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <h1 className="mb-2 text-xl font-semibold">No se pudo crear la cuenta</h1>
        <p className="mb-6 text-sm text-[#7bb0e0]">{errorMessage}</p>
        <p className="mb-6 max-w-xs text-xs text-[#7bb0e0]">
          Puede ser que el signup anónimo no esté habilitado en Supabase. Andá al panel
          de Supabase → Authentication → Providers y activá &quot;Anonymous Sign-Ins&quot;.
        </p>
        <Link
          href="/login"
          className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-[#003366]"
        >
          Entrar con email
        </Link>
      </main>
    );
  }

  return (
    <main
      className="flex h-dvh flex-col items-center justify-center bg-[#003366] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <svg viewBox="0 0 512 512" className="mb-4 h-16 w-16" aria-hidden>
        <rect width="512" height="512" rx="115" fill="#003366" />
        <path
          d="M292 96 L172 300 H248 L226 416 L346 212 H270 Z"
          fill="#ffffff"
          stroke="#ffffff"
          strokeWidth="26"
          strokeLinejoin="round"
        />
      </svg>
      <p className="text-sm text-[#7bb0e0]">Preparando tu cuenta…</p>
    </main>
  );
}
