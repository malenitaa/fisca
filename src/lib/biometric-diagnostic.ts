"use client";

import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";

/**
 * Devuelve un texto plano con el estado de la biometría, para mostrarle
 * a la usuaria cuando algo no funciona. No tenemos consola/devtools en el
 * celu, así que este panel reemplaza al debug del browser.
 */
export async function getBiometricDiagnostic(): Promise<string> {
  const lines: string[] = [];

  try {
    lines.push(`isNative: ${Capacitor.isNativePlatform()}`);
    lines.push(`platform: ${Capacitor.getPlatform()}`);
  } catch (e) {
    lines.push(`Capacitor error: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!Capacitor.isNativePlatform()) {
    lines.push("→ Estás en el browser, no en la app nativa.");
    return lines.join("\n");
  }

  try {
    const info = await BiometricAuth.checkBiometry();
    lines.push(`isAvailable: ${info.isAvailable}`);
    lines.push(`strongBiometryIsAvailable: ${info.strongBiometryIsAvailable}`);
    if ("biometryType" in info) lines.push(`biometryType: ${JSON.stringify(info.biometryType)}`);
    if ("reason" in info) lines.push(`reason: ${JSON.stringify(info.reason)}`);
    if ("code" in info) lines.push(`code: ${JSON.stringify(info.code)}`);
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    lines.push(`checkBiometry falló: ${msg}`);
    lines.push("→ El plugin no está registrado o falta un rebuild en Xcode.");
  }

  return lines.join("\n");
}
