"use client";

import { useEffect, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";

export function FeedbackModal({
  open,
  onClose,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  reason?: string;
}) {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setMessage("");
      setStatus("idle");
      setError("");
    }
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("sending");
    setError("");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.trim(), path: pathname }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus("error");
      setError(data.error ?? "No se pudo enviar.");
      return;
    }
    setStatus("sent");
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "sent" ? (
          <div className="text-center">
            <h2 className="mb-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Gracias
            </h2>
            <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
              Recibí tu mensaje. Lo miro apenas pueda.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-[#003366] px-4 py-3 text-sm font-semibold text-white dark:bg-[#4a90c8]"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 className="mb-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {reason ?? "Contame qué está mal"}
            </h2>
            <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
              Se envía anónimamente al equipo. No te pedimos tu email.
            </p>
            <textarea
              autoFocus
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={4000}
              placeholder="Qué querés reportar…"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#003366] dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-[#7bb0e0]"
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="submit"
                disabled={status === "sending" || !message.trim()}
                className="rounded-xl bg-[#003366] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-[#4a90c8]"
              >
                {status === "sending" ? "Enviando..." : "Enviar"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
