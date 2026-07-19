/**
 * Config del Relying Party para WebAuthn/Passkeys.
 *
 * `rpID` es el dominio (sin protocolo ni puerto). En prod es fisca.vercel.app.
 * `origin` sí lleva https:// y matchea al Origin del browser. En Capacitor
 * WKWebView el origin es `capacitor://localhost` cuando la app está embebida —
 * lo aceptamos si NEXT_PUBLIC_CAPACITOR_ORIGIN está seteado.
 */

export function getRpConfig() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const url = new URL(siteUrl);
  const rpID = url.hostname;
  const origins = [url.origin];
  const capOrigin = process.env.NEXT_PUBLIC_CAPACITOR_ORIGIN;
  if (capOrigin) origins.push(capOrigin);
  return {
    rpID,
    rpName: "Fisca",
    origins,
  };
}
