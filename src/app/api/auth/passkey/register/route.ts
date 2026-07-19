import { NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";
import { getRpConfig } from "@/lib/webauthn";
import { cookies } from "next/headers";
import { badRequest, internalError, tooMany, unauthorized } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

const CHALLENGE_COOKIE = "fisca_wa_reg_challenge";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const { rpID, rpName } = getRpConfig();

  const { data: existing } = await supabase
    .from("user_passkeys")
    .select("id, transports")
    .eq("user_id", user.id);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email ?? user.id,
    attestationType: "none",
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.id,
      transports: (c.transports ?? undefined) as AuthenticatorTransport[] | undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 5,
    path: "/",
  });

  return NextResponse.json(options);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const rl = await rateLimit(supabase, user.id, "auth:passkey-register", {
    limit: 5,
    windowSeconds: 3600,
  });
  if (!rl.ok) return tooMany(undefined, rl.retryAfter);

  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get(CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) return badRequest("Sesión de registro expirada. Reintentá.");

  const body = (await request.json().catch(() => null)) as RegistrationResponseJSON | null;
  if (!body) return badRequest("Datos inválidos.");

  const { rpID, origins } = getRpConfig();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (err) {
    // No exponemos el mensaje interno de simplewebauthn — puede revelar
    // detalles del formato del challenge, dispositivo, etc.
    console.error("[passkey register]", err);
    return badRequest("No se pudo verificar el dispositivo.");
  }

  if (!verification.verified || !verification.registrationInfo) {
    return badRequest("No se pudo verificar el dispositivo.");
  }

  const { credential } = verification.registrationInfo;

  const { error } = await supabase.from("user_passkeys").insert({
    id: credential.id,
    user_id: user.id,
    public_key: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: body.response.transports ?? null,
  });

  cookieStore.delete(CHALLENGE_COOKIE);

  if (error) return internalError(error);
  return NextResponse.json({ ok: true });
}
