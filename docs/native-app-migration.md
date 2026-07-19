# Migración a "solo app" (bundled)

Estado de preparación para pasar de Capacitor-shell-de-URL a Capacitor
bundled (frontend estático dentro del `.ipa`, backend queda en Vercel).

## Ya listo (mergeado)
- **CORS** en `proxy.ts` para orígenes `capacitor://localhost`,
  `ionic://localhost`, `https://localhost` y el que se configure en
  `NEXT_PUBLIC_CAPACITOR_ORIGIN`. Preflight OPTIONS también responde.
- **Abstracción de biometría** en `src/lib/biometric.ts`: el resto de la
  app usa `isBiometricSupported`, `registerBiometric`, `authenticateBiometric`,
  `hasBiometricEnrolled`. Hoy delega en WebAuthn; cuando bundleemos,
  agregamos rama nativa sin tocar callers.

## Lo que falta para bundled (cuando Malena decida)
1. **Next config**: `output: 'export'` — todas las páginas tienen que
   ser client components o static.
   - Páginas actuales que usan Server Components con `cookies()`:
     `(app)/facturas/*`, `(app)/configuracion/page.tsx`, `(app)/ayuda/page.tsx`,
     `(app)/facturas/[id]/page.tsx`. Todas hacen queries a Supabase server-side.
   - Migración: mover data fetching a client components con SWR o `useEffect + fetch`.
   - Alternativa más liviana: cambiar a `cache: 'no-store'` fetch en client.

2. **Capacitor plugin nativo de biometría**:
   - `npm install @aparajita/capacitor-biometric-auth` (o similar)
   - Agregar rama en `src/lib/biometric.ts`:
     ```ts
     if (getStrategy() === "native") return BiometricAuth.authenticate(...)
     ```
   - `npx cap sync ios` + rebuild.
   - Ya no hace falta el AASA ni Associated Domains.

3. **Capacitor config**:
   ```
   // capacitor.config.ts
   {
     appId: 'ar.malenitaa.fisca',
     appName: 'Fisca',
     webDir: 'out',  // ← lo que exporta `next build`
     // eliminar server.url que hoy apunta a fisca.vercel.app
   }
   ```

4. **Env de API**: los fetches del cliente que hoy pegan a rutas relativas
   (`/api/facturas`) necesitan un absolute URL cuando la app está bundleada.
   - Agregar `NEXT_PUBLIC_API_BASE_URL=https://fisca.vercel.app`
   - Helper `apiUrl(path)` que prependa el base URL cuando corre en Capacitor
     nativo.

5. **Auth cookies cross-origin**: cuando el WebView está en
   `capacitor://localhost` y la API en `https://fisca.vercel.app`, las
   cookies son cross-site. Supabase ya usa `SameSite=Lax` por default —
   hay que verificar que funcione o usar `SameSite=None; Secure`.

## Lo que NO cambia
- Toda la lógica de facturación (WSFE, WSFEX, TA, CAE, PDF, QR)
- Auth (Supabase, RLS, PIN, magic link)
- Rate limiting, error sanitization
- CSR wizard, config ARCA
- Todo el visual
