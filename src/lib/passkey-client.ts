"use client";

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";

export function isPasskeySupported(): boolean {
  return typeof window !== "undefined" && browserSupportsWebAuthn();
}

/** Registra una passkey nueva para el user actual. */
export async function registerPasskey(): Promise<void> {
  const optsRes = await fetch("/api/auth/passkey/register");
  if (!optsRes.ok) throw new Error("No se pudieron pedir las options.");
  const options = await optsRes.json();

  const attResp = await startRegistration({ optionsJSON: options });

  const verifyRes = await fetch("/api/auth/passkey/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(attResp),
  });
  if (!verifyRes.ok) {
    const err = await verifyRes.json().catch(() => ({}));
    throw new Error(err.error ?? "Registración fallida.");
  }
}

/** Autentica con la passkey. Resuelve true si ok, false si falló/canceló. */
export async function authenticateWithPasskey(): Promise<boolean> {
  try {
    const optsRes = await fetch("/api/auth/passkey/verify");
    if (!optsRes.ok) return false;
    const options = await optsRes.json();

    const assertion = await startAuthentication({ optionsJSON: options });

    const verifyRes = await fetch("/api/auth/passkey/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assertion),
    });
    return verifyRes.ok;
  } catch {
    return false;
  }
}

export async function userHasPasskey(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/passkey/has");
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.has;
  } catch {
    return false;
  }
}
