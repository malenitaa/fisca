"use client";

/**
 * Adapter para el plugin @aparajita/capacitor-biometric-auth cuando la app
 * corre dentro de Capacitor iOS. El plugin usa LocalAuthentication.framework
 * de iOS, o sea: es el prompt de Face ID / Touch ID nativo, sin WebAuthn.
 *
 * Como no queremos declarar dependencia en el bundle web (el plugin es
 * solo iOS/Android), lo accedemos via `Capacitor.Plugins.BiometricAuth`
 * cuando existe. Si no existe (browser normal, PWA), estas funciones
 * devuelven false y el flujo cae al WebAuthn o directo al PIN.
 */

const ENROLLED_KEY = "fisca.biometric.enrolled";

type BiometryResult = {
  isAvailable?: boolean;
  strongBiometryIsAvailable?: boolean;
};

interface BiometricAuthPlugin {
  checkBiometry: () => Promise<BiometryResult>;
  authenticate: (options?: {
    reason?: string;
    cancelTitle?: string;
    allowDeviceCredential?: boolean;
    iosFallbackTitle?: string;
  }) => Promise<void>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: { BiometricAuth?: BiometricAuthPlugin };
}

function getPlugin(): BiometricAuthPlugin | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.BiometricAuth ?? null;
}

export function isNativeBiometricAvailable(): boolean {
  return getPlugin() !== null;
}

export async function nativeBiometricSupportedByDevice(): Promise<boolean> {
  const plugin = getPlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.checkBiometry();
    return !!(result.isAvailable || result.strongBiometryIsAvailable);
  } catch {
    return false;
  }
}

export function isNativeBiometricEnrolled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ENROLLED_KEY) === "true";
}

/**
 * "Enrolar" acá es solo marcar en localStorage que la usuaria activó la
 * verificación por Face ID en este dispositivo. Antes de marcar, forzamos
 * un prompt real para verificar que puede autenticarse.
 */
export async function enrollNativeBiometric(): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) throw new Error("Face ID no disponible en este dispositivo.");

  await plugin.authenticate({
    reason: "Activá el reconocimiento facial para entrar más rápido.",
    cancelTitle: "Cancelar",
    iosFallbackTitle: "Usar código",
    allowDeviceCredential: false,
  });

  window.localStorage.setItem(ENROLLED_KEY, "true");
}

export async function authenticateNativeBiometric(): Promise<boolean> {
  const plugin = getPlugin();
  if (!plugin) return false;
  if (!isNativeBiometricEnrolled()) return false;
  try {
    await plugin.authenticate({
      reason: "Ingresá a Fisca con tu cara.",
      cancelTitle: "Cancelar",
      iosFallbackTitle: "Usar PIN",
      allowDeviceCredential: false,
    });
    return true;
  } catch {
    return false;
  }
}
