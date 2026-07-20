"use client";

import { Capacitor } from "@capacitor/core";
import {
  BiometricAuth,
  BiometryError,
  BiometryType,
} from "@aparajita/capacitor-biometric-auth";

/**
 * Adapter para el plugin @aparajita/capacitor-biometric-auth cuando la app
 * corre dentro de Capacitor iOS. El plugin usa LocalAuthentication.framework
 * de iOS, o sea: es el prompt de Face ID / Touch ID nativo, sin WebAuthn.
 *
 * Requiere que el proyecto Capacitor (fisca-app) tenga instalado el pod
 * `AparajitaCapacitorBiometricAuth` (via `npx cap sync ios` + rebuild).
 */

const ENROLLED_KEY = "fisca.biometric.enrolled";

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isNativeBiometricAvailable(): boolean {
  return isNative();
}

export async function nativeBiometricSupportedByDevice(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const result = await BiometricAuth.checkBiometry();
    return !!(result.isAvailable || result.strongBiometryIsAvailable);
  } catch {
    return false;
  }
}

export async function getNativeBiometryLabel(): Promise<string> {
  if (!isNative()) return "Face ID";
  try {
    const result = await BiometricAuth.checkBiometry();
    return biometryTypeLabel(result.biometryType);
  } catch {
    return "Face ID";
  }
}

function biometryTypeLabel(type: BiometryType): string {
  switch (type) {
    case BiometryType.faceId:
      return "Face ID";
    case BiometryType.touchId:
      return "Touch ID";
    case BiometryType.fingerprintAuthentication:
      return "Huella";
    case BiometryType.faceAuthentication:
      return "Reconocimiento facial";
    case BiometryType.irisAuthentication:
      return "Escaneo de iris";
    default:
      return "Face ID";
  }
}

export function isNativeBiometricEnrolled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ENROLLED_KEY) === "true";
}

export function clearNativeBiometricEnrollment(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ENROLLED_KEY);
}

/** Forzamos un prompt real y solo marcamos como enrolado si pasa. */
export async function enrollNativeBiometric(): Promise<void> {
  if (!isNative()) {
    throw new Error("La biometría no está disponible fuera de la app.");
  }
  try {
    await BiometricAuth.authenticate({
      reason: "Activá el desbloqueo biométrico para entrar más rápido.",
      cancelTitle: "Cancelar",
      iosFallbackTitle: "Usar código",
      androidTitle: "Activar desbloqueo biométrico",
      androidSubtitle: "Entrás sin escribir el PIN",
      allowDeviceCredential: false,
    });
    window.localStorage.setItem(ENROLLED_KEY, "true");
  } catch (err) {
    if (err instanceof BiometryError) {
      throw new Error(err.message);
    }
    throw err;
  }
}

export async function authenticateNativeBiometric(): Promise<boolean> {
  if (!isNative()) return false;
  if (!isNativeBiometricEnrolled()) return false;
  try {
    await BiometricAuth.authenticate({
      reason: "Ingresá a Fisca.",
      cancelTitle: "Cancelar",
      iosFallbackTitle: "Usar PIN",
      androidTitle: "Ingresá a Fisca",
      androidSubtitle: "Usá tu biometría o el PIN",
      allowDeviceCredential: false,
    });
    return true;
  } catch {
    return false;
  }
}
