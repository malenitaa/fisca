import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS_STARTSWITH = [
  "/login",
  "/signup",
  "/auth/callback",
  // Rutas del PWA que Safari/Chrome piden sin sesión para reconocer
  // la app como instalable ("Agregar a inicio"). Si redirigen a /login,
  // el ícono/manifest no se leen y la instalación no queda como app.
  "/manifest.webmanifest",
  "/apple-icon",
  "/icon",
  "/favicon",
  // Estado de ARCA: pin público sin auth, se muestra tanto en /ayuda como
  // en /login (antes de tener sesión).
  "/api/afip/status",
];

/** Rutas que sirven marketing público (landing) — SEO indexable, sin sesión. */
const PUBLIC_PATHS_EXACT = ["/"];

/**
 * Headers de seguridad aplicados a todas las respuestas. Notas:
 * - CSP permite `unsafe-inline` / `unsafe-eval` porque Next 16 lo requiere
 *   para hidratación y runtime; el resto restringe orígenes de scripts,
 *   frames, etc. `frame-ancestors 'none'` reemplaza X-Frame-Options en
 *   navegadores modernos.
 * - `connect-src` incluye Supabase y (opcionalmente) el origin de Capacitor
 *   para que fetch/websocket funcionen dentro del WebView.
 */
// /api/facturas/[id]/pdf se embebe a propósito en un <iframe> propio
// (FacturaDetalle → "Ver PDF"), mismo origen. DENY/'none' rompía eso: el
// navegador se niega a mostrar cualquier respuesta con esos headers
// dentro de un frame, aunque sea la misma app. Se relaja SOLO acá, a
// SAMEORIGIN/'self' — nunca a un origen externo.
const SELF_FRAMEABLE_PATH = /^\/api\/facturas\/[^/]+\/pdf$/;

function applySecurityHeaders(response: NextResponse, path: string) {
  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
    : "";
  const capOrigin = process.env.NEXT_PUBLIC_CAPACITOR_ORIGIN ?? "";
  const allowSelfFraming = SELF_FRAMEABLE_PATH.test(path);

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} ${capOrigin}`.trim(),
    `frame-ancestors ${allowSelfFraming ? "'self'" : "'none'"}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", allowSelfFraming ? "SAMEORIGIN" : "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  return response;
}

/** Refresca la sesión de Supabase y redirige a /login si no hay usuario autenticado. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicPath =
    PUBLIC_PATHS_STARTSWITH.some((p) => path.startsWith(p)) ||
    PUBLIC_PATHS_EXACT.includes(path);

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return applySecurityHeaders(NextResponse.redirect(loginUrl), path);
  }

  return applySecurityHeaders(response, path);
}
