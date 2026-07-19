"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LogoBolt } from "@/components/logo";

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
        className="fixed inset-0 h-dvh flex flex-col items-center justify-center bg-[#003366] px-6 text-center text-white"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <h1 className="mb-2 text-xl font-semibold">No se pudo crear la cuenta</h1>
        <p className="mb-6 text-sm text-[#7bb0e0]">{errorMessage}</p>
        <p className="mb-6 max-w-xs text-xs text-[#7bb0e0]">
          Reintentá en un rato, o entrá con tu email si ya tenés cuenta.
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
      className="fixed inset-0 h-dvh flex flex-col items-center justify-center bg-[#003366] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div style={{ animation: "fisca-splash-in .9s cubic-bezier(.2,.8,.2,1) both" }}>
        <LogoBolt className="h-16 w-16" pulse />
      </div>
      <p
        className="absolute bottom-14 text-sm text-[#7bb0e0]"
        style={{ animation: "fisca-splash-in .9s .15s cubic-bezier(.2,.8,.2,1) both" }}
      >
        Preparando tu cuenta…
      </p>
    </main>
  );
}
