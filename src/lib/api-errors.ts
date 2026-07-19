import { NextResponse } from "next/server";

/**
 * Helpers para responder errores desde route handlers sin filtrar
 * información interna al cliente.
 *
 * Regla: solo mensajes que YO escribo (validación, "no encontrado",
 * "PIN incorrecto", etc.) pueden salir al cliente. Mensajes de Postgres,
 * Supabase, node-forge, etc. van solo al log del server.
 */

export function apiError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function badRequest(message: string) {
  return apiError(400, message);
}

export function unauthorized(message = "No autenticado.") {
  return apiError(401, message);
}

export function notFound(message = "No encontrado.") {
  return apiError(404, message);
}

export function tooMany(message = "Demasiadas solicitudes. Esperá un momento.", retryAfterSeconds?: number) {
  const res = NextResponse.json({ error: message }, { status: 429 });
  if (retryAfterSeconds != null) {
    res.headers.set("Retry-After", String(Math.max(1, Math.ceil(retryAfterSeconds))));
  }
  return res;
}

export function internalError(err: unknown, publicMessage = "Algo salió mal. Reintentá.") {
  // El error real va al log de Vercel (visible solo para nosotros).
  console.error("[api]", err);
  return NextResponse.json({ error: publicMessage }, { status: 500 });
}
