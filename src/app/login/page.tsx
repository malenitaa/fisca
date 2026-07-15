"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Facturación ARCA
        </h1>
        <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
          Ingresá tu email y te mandamos un link para entrar.
        </p>

        {status === "sent" ? (
          <p className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            Te enviamos un link de acceso a <strong>{email}</strong>. Abrilo desde el mismo
            dispositivo/navegador donde lo pediste.
          </p>
        ) : (
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
              className="w-full rounded-md bg-neutral-900 px-3 py-2.5 font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {status === "sending" ? "Enviando..." : "Enviar link de acceso"}
            </button>
            {status === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
