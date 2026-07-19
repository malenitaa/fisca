import { NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";
import { getRpConfig } from "@/lib/webauthn";
import { cookies } from "next/headers";
import { badRequest, notFound, unauthorized } from "@/lib/api-errors";

const CHALLENGE_COOKIE = "fisca_wa_auth_challenge";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const { rpID } = getRpConfig();
  const { data: credentials } = await supabase
    .from("user_passkeys")
    .select("id, transports")
    .eq("user_id", user.id);

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: (credentials ?? []).map((c) => ({
      id: c.id,
      transports: (c.transports ?? undefined) as AuthenticatorTransport[] | undefined,
    })),
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

  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get(CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) return badRequest("Sesión de autenticación expirada.");

  const body = (await request.json().catch(() => null)) as AuthenticationResponseJSON | null;
  if (!body?.id) return badRequest("Datos inválidos.");

  const { data: cred } = await supabase
    .from("user_passkeys")
    .select("id, public_key, counter, transports")
    .eq("id", body.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!cred) return notFound("Credencial desconocida.");

  const { rpID, origins } = getRpConfig();

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      credential: {
        id: cred.id,
        publicKey: new Uint8Array(Buffer.from(cred.public_key)),
        counter: Number(cred.counter),
        transports: (cred.transports ?? undefined) as AuthenticatorTransport[] | undefined,
      },
      requireUserVerification: true,
    });
  } catch (err) {
    console.error("[passkey verify]", err);
    return badRequest("No se pudo verificar.");
  }

  if (!verification.verified) return badRequest("No se pudo verificar.");

  await supabase
    .from("user_passkeys")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", cred.id);

  cookieStore.delete(CHALLENGE_COOKIE);

  return NextResponse.json({ ok: true });
}
