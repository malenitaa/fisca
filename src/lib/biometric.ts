"use client";

import {
  isPasskeySupported,
  registerPasskey,
  authenticateWithPasskey,
  userHasPasskey,
} from "./passkey-client";

/**
 * API pública de biometría. Hoy delega en WebAuthn/Passkeys porque la app
 * corre en un WebView que carga fisca.vercel.app. Cuando migremos a
 * bundled (Capacitor con `webDir`) vamos a agregar una implementación
 * nativa (LocalAuthentication.framework via plugin de Capacitor) y este
 * módulo va a elegir el backend en runtime — el resto de la app no
 * necesita saber cuál.
 *
 * Contrato:
 *   isBiometricSupported() → ¿el dispositivo puede hacer biometría?
 *   hasBiometricEnrolled() → ¿este user ya enroló su cara/huella?
 *   registerBiometric()    → enrola. Puede tirar error si el user cancela.
 *   authenticateBiometric() → prompt de cara/huella. true si ok, false si
 *                            falló/canceló.
 */

type Strategy = "webauthn" | "native";

/** Elegimos el backend en runtime. Por ahora siempre WebAuthn. Cuando
 * agreguemos el plugin nativo de Capacitor, retornamos "native" si
 * `Capacitor.isNativePlatform()`. */
function getStrategy(): Strategy {
  return "webauthn";
}

export function isBiometricSupported(): boolean {
  return getStrategy() === "webauthn" ? isPasskeySupported() : false;
}

export async function hasBiometricEnrolled(): Promise<boolean> {
  return getStrategy() === "webauthn" ? userHasPasskey() : false;
}

export async function registerBiometric(): Promise<void> {
  if (getStrategy() === "webauthn") return registerPasskey();
  throw new Error("Biometría no disponible en este dispositivo.");
}

export async function authenticateBiometric(): Promise<boolean> {
  return getStrategy() === "webauthn" ? authenticateWithPasskey() : false;
}
