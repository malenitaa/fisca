/**
 * Estado local de "unlock". El unlock es una gate cliente-side sobre el
 * WebView — la sesión de Supabase sigue viva; solo bloqueamos la UI hasta
 * que la usuaria pruebe Face ID / PIN.
 *
 * Se guarda en localStorage porque es específico del dispositivo: si mando
 * el link a otro celular, ese celular no debería estar "unlocked".
 */

const KEY_ENABLED = "fisca.unlock.enabled";
const KEY_UNLOCKED_AT = "fisca.unlock.unlocked_at";

// Duración de un unlock: cuánto tiempo pueden pasar sin volver a pedir
// biometría/PIN. 15 minutos alcanza para trabajar sin fricción y a la vez
// re-gatea si dejaste el celu sin bloquear.
const UNLOCK_TTL_MS = 15 * 60 * 1000;

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
    window.localStorage.removeItem(KEY_UNLOCKED_AT);
  }
}

export function markUnlocked(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_UNLOCKED_AT, String(Date.now()));
}

export function isCurrentlyUnlocked(): boolean {
  if (typeof window === "undefined") return true;
  if (!isUnlockEnabled()) return true;
  const at = window.localStorage.getItem(KEY_UNLOCKED_AT);
  if (!at) return false;
  const parsed = parseInt(at, 10);
  if (!Number.isFinite(parsed)) return false;
  return Date.now() - parsed < UNLOCK_TTL_MS;
}

export function clearUnlock(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_UNLOCKED_AT);
}
