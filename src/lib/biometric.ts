"use client";

import {
  isPasskeySupported,
  registerPasskey,
  authenticateWithPasskey,
  userHasPasskey,
} from "./passkey-client";
import {
  isNativeBiometricAvailable,
  enrollNativeBiometric,
  authenticateNativeBiometric,
  isNativeBiometricEnrolled,
  clearNativeBiometricEnrollment,
  getNativeBiometryLabel,
} from "./native-biometric";

/**
 * API pública de biometría. Elige la implementación en runtime:
 *
 * 1. **Native (Capacitor iOS)**: plugin @aparajita/capacitor-biometric-auth
 *    → prompt nativo de Face ID / Touch ID. No requiere Associated Domains
 *    ni Apple Developer pago. Se detecta cuando `Capacitor.Plugins.BiometricAuth`
 *    está expuesto en la WebView.
 * 2. **WebAuthn/Passkey (browser/PWA)**: fallback cuando corre en Safari o
 *    Chrome sin el shell nativo. Requiere Associated Domains configurados.
 *
 * El resto de la app usa esta API sin saber cuál está activa.
 */

type Strategy = "native" | "webauthn" | "none";

function getStrategy(): Strategy {
  if (isNativeBiometricAvailable()) return "native";
  if (isPasskeySupported()) return "webauthn";
  return "none";
}

export function isBiometricSupported(): boolean {
  return getStrategy() !== "none";
}

export async function hasBiometricEnrolled(): Promise<boolean> {
  const strategy = getStrategy();
  if (strategy === "native") return isNativeBiometricEnrolled();
  if (strategy === "webauthn") return userHasPasskey();
  return false;
}

export async function registerBiometric(): Promise<void> {
  const strategy = getStrategy();
  if (strategy === "native") return enrollNativeBiometric();
  if (strategy === "webauthn") return registerPasskey();
  throw new Error("Biometría no disponible en este dispositivo.");
}

export async function authenticateBiometric(): Promise<boolean> {
  const strategy = getStrategy();
  if (strategy === "native") return authenticateNativeBiometric();
  if (strategy === "webauthn") return authenticateWithPasskey();
  return false;
}

/** Label del método biométrico del dispositivo actual (Face ID / Huella / etc.),
 * para usar en copies de UI. En web/PWA cae a "Face ID" porque WebAuthn no
 * expone qué autenticador se usa. */
export async function getBiometryLabel(): Promise<string> {
  const strategy = getStrategy();
  if (strategy === "native") return getNativeBiometryLabel();
  return "Face ID";
}

export function disableBiometricShortcut(): void {
  clearNativeBiometricEnrollment();
}
