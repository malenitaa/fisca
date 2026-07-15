"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Si la persona clickea el link del mail en vez de tipear el código,
        // esto lo manda a la ruta que efectivamente intercambia el code por
        // una sesión (ver src/app/auth/callback/route.ts). Sin esto, Supabase
        // redirige a la Site URL "pelada" y el login queda a mitad de camino.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("idle");
    setStep("code");
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    router.push("/facturas");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900">Facturación ARCA</h1>

        {step === "email" ? (
          <>
            <p className="mb-8 text-sm text-neutral-500">
              Ingresá tu email y te mandamos un código de acceso.
            </p>
            <form onSubmit={handleSendCode} className="space-y-3">
              <input
                type="email"
                required
                autoFocus
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base outline-none focus:border-neutral-900"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full rounded-md bg-neutral-900 px-3 py-2.5 font-medium text-white disabled:opacity-50"
              >
                {status === "loading" ? "Enviando..." : "Enviar código"}
              </button>
              {status === "error" && <p className="text-sm text-red-600">{errorMessage}</p>}
            </form>
          </>
        ) : (
          <>
            <p className="mb-8 text-sm text-neutral-500">
              Te mandamos un código de 6 dígitos a <strong>{email}</strong>. Escribilo acá abajo.
            </p>
            <form onSubmit={handleVerifyCode} className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-center text-lg tracking-widest outline-none focus:border-neutral-900"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full rounded-md bg-neutral-900 px-3 py-2.5 font-medium text-white disabled:opacity-50"
              >
                {status === "loading" ? "Verificando..." : "Ingresar"}
              </button>
              {status === "error" && <p className="text-sm text-red-600">{errorMessage}</p>}
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setStatus("idle");
                  setErrorMessage("");
                }}
                className="w-full text-sm text-neutral-500 hover:text-neutral-900"
              >
                Usar otro email
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
