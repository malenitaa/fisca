"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "ratelimit">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    // Dentro del shell nativo de Capacitor el magic link tiene que volver
    // por fisca:// para reabrir la app. En browser/PWA es no-op.
    const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    const isNative = capacitor?.isNativePlatform?.() ?? false;
    const emailRedirectTo = isNative
      ? "fisca://auth-callback"
      : `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });

    if (error) {
      // Supabase free plan tiene un rate limit de 3 mails/hora por proyecto.
      // Cuando lo pisamos, devuelve el mensaje "email rate limit exceeded".
      // Lo tratamos como estado propio para explicarle a la usuaria la salida.
      if (/rate limit/i.test(error.message)) {
        setStatus("ratelimit");
      } else {
        setStatus("error");
        setErrorMessage(error.message);
      }
      return;
    }
    setStatus("sent");
  }

  return (
    <main
      className="fixed inset-0 h-dvh flex flex-col items-center justify-center bg-white px-6 dark:bg-neutral-950"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Entrar a Fisca
        </h1>
        <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
          Ingresá tu email y te mandamos un link para entrar.
        </p>

        {status === "sent" && (
          <p className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            Te mandamos el link a <strong>{email}</strong>. Abrilo desde el mismo
            dispositivo.
          </p>
        )}

        {status === "ratelimit" && (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              <p className="mb-2 font-medium">Se llegó al límite de mails por ahora.</p>
              <p>
                Supabase (nuestro proveedor de auth) permite 3 mails por hora en el plan
                gratis. Reintentá en un rato — o entrá sin email creando una cuenta
                anónima que después podés vincular.
              </p>
            </div>
            <Link
              href="/signup"
              className="block rounded-xl bg-[#003366] px-4 py-3 text-center text-sm font-semibold text-white dark:bg-[#4a90c8]"
            >
              Entrar sin email
            </Link>
          </div>
        )}

        {status !== "sent" && status !== "ratelimit" && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              autoFocus
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-100"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-xl bg-[#003366] px-3 py-3 text-[15px] font-semibold text-white disabled:opacity-50 dark:bg-[#4a90c8]"
            >
              {status === "sending" ? "Enviando..." : "Enviar link"}
            </button>
            {status === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            )}
            <Link
              href="/signup"
              className="mt-4 block text-center text-sm font-medium text-neutral-500 dark:text-neutral-400"
            >
              O entrar sin email
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
