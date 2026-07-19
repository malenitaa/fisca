/**
 * Estado de "unlock" cliente-side. La sesión de Supabase sigue viva; solo
 * bloqueamos la UI hasta que la usuaria pruebe Face ID / PIN.
 *
 * Diseño:
 * - `enabled` vive en localStorage (persiste entre app closes, es una
 *   preferencia del dispositivo).
 * - `unlocked` vive solo en memoria (variable de módulo). Cada vez que el
 *   WebView se recarga (o la app se abre desde cero), unlocked vuelve a
 *   false y la gate dispara.
 * - Además, si el WebView pasa a background (visibilitychange → hidden)
 *   limpiamos unlocked, así al volver la app pide re-auth aunque no se
 *   haya matado el proceso.
 */

const KEY_ENABLED = "fisca.unlock.enabled";

let unlocked = false;
let listenerInstalled = false;

function installListener() {
  if (listenerInstalled || typeof document === "undefined") return;
  listenerInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      unlocked = false;
    }
  });
}

export function isUnlockEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY_ENABLED) === "true";
}

export function setUnlockEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  if (enabled) {
    window.localStorage.setItem(KEY_ENABLED, "true");
  } else {
    window.localStorage.removeItem(KEY_ENABLED);
    unlocked = false;
  }
}

export function markUnlocked(): void {
  unlocked = true;
  installListener();
}

export function isCurrentlyUnlocked(): boolean {
  if (typeof window === "undefined") return true;
  if (!isUnlockEnabled()) return true;
  return unlocked;
}

export function clearUnlock(): void {
  unlocked = false;
}
