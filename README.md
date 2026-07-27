# Fisca

Web app minimalista para que un monotributista emita **Facturas C** con CAE
usando los webservices de ARCA (ex AFIP) — sin sistema contable, sin
dashboards, sin funciones que no vas a usar. Una pantalla para facturar, un
historial, listo.

## Qué hace

1. **Probás sin dar el mail**: al entrar por primera vez se crea una cuenta
   anónima de Supabase, así podés recorrer la app antes de comprometerte a
   nada. `/vincular` es el wizard (email → PIN → confirmar PIN → Face ID
   opcional) que asocia esa cuenta a un email real.
2. **Login recurrente por magic link** (sin contraseña) + **PIN de 4-6
   dígitos como segundo factor** obligatorio después de tocar el link, y
   **Face ID/Touch ID/huella** como atajo opcional en aperturas siguientes
   (nativo vía Capacitor en la app instalada, WebAuthn/passkey en browser o
   PWA — el resto de la app no sabe cuál de las dos está activa). Ver
   `SECURITY.md` para el detalle de cada control.
3. **Configuración inicial** (una sola vez): CUIT, punto de venta, ambiente
   (homologación/producción) y el certificado + clave privada de ARCA. Se
   guardan **cifrados** en la base y nunca se vuelven a mostrar. La clave
   privada y el CSR se generan **en el servidor** con un wizard propio — no
   hace falta tener OpenSSL instalado (ver Setup § 1).
4. **Nueva factura**: fecha del comprobante (por defecto hoy, editable
   dentro del rango que acepta ARCA), concepto, cliente (CUIT/DNI o
   Consumidor Final, con autocompletado de contactos recientes), condición
   frente al IVA del receptor, moneda extranjera opcional (RG 5616/2024,
   con cotización oficial o asignada automáticamente por ARCA si el pago es
   en la misma moneda), ítems con descripción/cantidad/precio. Valida todo
   antes de mandarlo a ARCA. Factura E (exportación) es una pestaña aparte,
   ver más abajo.
5. Al confirmar, la app pide el CAE a WSFEv1 (o WSFEXv1 para Factura E) y
   genera un PDF con los datos legales (CAE, vencimiento, QR de ARCA).
6. **Historial** de facturas emitidas, con re-descarga del PDF y totales
   por moneda.
7. **Anular una factura mal emitida**: emite la Nota de Crédito asociada
   (no se puede "borrar" un comprobante con CAE, ver `/ayuda`).
8. **Modo oscuro** (según preferencia del sistema, con toggle manual) y una
   página de **Ayuda** con preguntas frecuentes (no es un chatbot).
9. **Recordatorio de pago del monotributo**: un aviso simple en la pantalla
   principal con un botón "Ya pagué" y un link directo a ARCA para generar
   el VEP. No automatiza el pago (eso implicaría manejar tu Clave Fiscal
   real, ver sección de seguridad).
10. **Feedback in-app**: sacudir el teléfono (o un botón en Ayuda) abre un
    formulario corto; queda guardado en la base y, si está configurado
    Resend, también llega por email (`src/app/api/feedback/route.ts`).

### Por qué no hay opción "Factura D" ni "Factura A/B" en el formulario

- No existe un tipo de comprobante "D" en la codificación de ARCA — no es un
  recorte del MVP, directamente no existe.
- Como monotributista, legalmente solo podés emitir **Factura C** para
  mercado interno. Las Facturas A/B son para responsables inscriptos.
- La app sí soporta **Factura E** (exportación de servicios/bienes, ej.
  contractors facturando a Deel/Upwork) como una pestaña aparte en
  "Nueva factura" — se autoriza contra un webservice completamente distinto
  (**WSFEXv1**, no WSFEv1), con su propio esquema de datos (`src/lib/afip/
  wsfex.ts`, `nueva-factura-e-form.tsx`).

## Cómo está resuelta la integración con ARCA (y por qué)

Este proyecto **no usa `@afipsdk/afip.js`** (la librería más popular). Esa
librería, en su versión actual, ya no habla directo con ARCA: para armar el
Ticket de Acceso (WSAA) manda tu certificado y tu clave privada a un servidor
de un tercero (`app.afipsdk.com`), y requiere un `access_token` de esa
plataforma. Para una clave fiscal, ese modelo de custodia por un tercero no
es aceptable acá.

En cambio, `src/lib/afip/` implementa un cliente WSAA/WSFEv1 propio y chico:

- `wsaa.ts`: arma el TRA (XML), lo firma como CMS/PKCS#7 con `node-forge`
  (JS puro, sin depender de `openssl` como binario externo) usando tu
  certificado y clave privada, y llama directo al SOAP de WSAA de ARCA.
- `ta-cache.ts`: cachea el Ticket de Acceso resultante (válido 12hs) en la
  tabla `afip_tickets`.
- `wsfe.ts`: llama a WSFEv1 (`FECompUltimoAutorizado`, `FECAESolicitar`,
  `FEParamGetCotizacion`) para Factura C — próximo número de comprobante,
  CAE, y cotización oficial de referencia para facturar en moneda
  extranjera (RG 5616/2024).
- `wsfex.ts`: lo mismo pero contra **WSFEXv1** para Factura E
  (exportación) — es un webservice y un esquema de datos distintos, con su
  propio Ticket de Acceso (ver `service` en `ta-cache.ts`).
- `qr.ts`: genera el QR obligatorio (RG 4892) para el PDF.
- `src/lib/csr.ts`: la misma filosofía de "nada de terceros" se extiende a
  generar el certificado — arma el par de claves RSA-2048 y el CSR (PKCS#10)
  con `node-forge`, **en el servidor**, sin depender de OpenSSL local. La
  usuaria solo copia el CSR a ARCA y sube el `.crt` que le devuelven.

Tu clave privada nunca sale de tu propio servidor — ni al browser, ni a
ningún servicio de terceros. Solo viaja (cifrada en tránsito por HTTPS) a
los servidores de ARCA, que son el destinatario legítimo.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth por magic link)
- `node-forge` para firmar CMS/PKCS#7, `fast-xml-parser` para parsear las
  respuestas SOAP, `qrcode` para el QR, `@react-pdf/renderer` para el PDF
- Cifrado del certificado/clave privada en reposo con AES-256-GCM
  (`src/lib/crypto.ts`), con una master key que vive solo en el servidor

## Setup

### 1. Generar el certificado digital en el portal de ARCA

Necesitás un certificado (.crt) asociado al webservice **wsfe**
(Facturación Electrónica). El proceso es distinto para homologación
(testing) y producción, y **hay que probar todo en homologación antes de
tocar producción**.

#### Camino recomendado: el wizard de la app (sin OpenSSL)

Dentro de la app, en **Configuración → Certificado ARCA**, el wizard
(`/api/csr/generate`, `src/lib/csr.ts`) genera el par de claves RSA-2048 y
el CSR (PKCS#10) **en el servidor** — no hace falta tener OpenSSL
instalado ni manejar la clave privada a mano. Los pasos:

1. Completás CUIT y razón social; la app arma el CSR y te lo muestra para
   copiar/descargar. La clave privada queda guardada cifrada en
   `csr_drafts` hasta que vuelvas con el `.crt`.
2. Pegás ese CSR en ARCA (ver "Homologación" o "Producción" abajo) y
   descargás el `.crt` que te devuelven.
3. Subís ese `.crt` de vuelta al wizard (`/api/csr/submit`) — la app
   verifica que corresponda exactamente a la clave que generó
   (`certificateMatchesKey` en `src/lib/csr.ts`) antes de guardarlo en
   `afip_config`.

#### Alternativa: generar el CSR vos mismo con OpenSSL

Si preferís no generar la clave privada en el servidor (por ejemplo, para
correr todo local sin pasar por Vercel), podés armar el CSR a mano:

```bash
openssl genrsa -out privada.key 2048
openssl req -new -key privada.key -subj "/C=AR/O=Tu Nombre o Razón Social/CN=MonotributoFacturacion/serialNumber=CUIT 20XXXXXXXXX" -out pedido.csr
```

Reemplazá `CUIT 20XXXXXXXXX` por tu CUIT sin guiones. Vas a terminar con dos
archivos: `privada.key` (nunca la subas a ningún lado, ni siquiera a ARCA) y
`pedido.csr` (esto sí se sube). Subís el `.crt` resultante directamente en
Configuración (no por el wizard, que asume que la clave la generó él).

#### Homologación (testing) — servicio WSASS

1. Entrá a [www.arca.gob.ar](https://www.arca.gob.ar) con tu Clave Fiscal
   (tiene que ser una Clave Fiscal de persona física, no de la empresa).
2. Si todavía no tenés el servicio habilitado: "Administrador de Relaciones
   de Clave Fiscal" → "Adherir Servicio" → AFIP/ARCA → "Servicios
   Interactivos" → buscá **WSASS** (Web Service de Administración de
   Certificados Digitales Simplificado) y adherite. Cerrá sesión y volvé a
   entrar.
3. Buscá y abrí **WSASS**.
4. "Crear nuevo certificado": ponele un alias, pegá el contenido del CSR
   (el que te dio el wizard de la app, o `pedido.csr` si lo generaste a
   mano) en el campo de la solicitud (formato PKCS#10), y confirmá.
5. En el mismo flujo, asigná el certificado al CUIT y al servicio **wsfe -
   Facturación Electrónica**.
6. Descargá el `.crt` que te da ARCA.

Este certificado de homologación solo funciona contra los endpoints de
testing (`wsaahomo`/`wswhomo`), que son los que usa esta app cuando elegís
"Homologación" en la Configuración.

#### Producción

1. Con tu Clave Fiscal, entrá a **"Administración de Certificados
   Digitales"** (si no aparece, habilitala primero desde "Administrador de
   Relaciones de Clave Fiscal", igual que en homologación).
2. Subí el mismo CSR (del wizard) o uno nuevo, y descargá el `.crt` de
   producción.
3. Andá a **"Administrador de Relaciones de Clave Fiscal"** → creá una
   nueva relación → tu CUIT como representado → servicio **"ws -
   Facturación Electrónica"** (WSFEv1) → asociá el certificado que acabás
   de generar.

Si generaste el CSR a mano, guardá `pedido.csr`/`privada.key` en un lugar
seguro — si perdés la clave privada tenés que generar un certificado
nuevo. Si lo generó el wizard de la app, la clave ya vive cifrada en la
base y no necesitás guardar nada vos.

### 2. Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Corré **todas** las migraciones de `supabase/migrations/` en orden (hoy
   son 9: `0001_init.sql` → `0009_rate_limits.sql`) en el SQL Editor, o
   `supabase db push` si usás la CLI. Cada una agrega una feature —
   `0004_clientes.sql` (libreta de contactos), `0005_factura_e.sql`
   (exportación), `0006_user_pins.sql` (PIN + passkeys), `0007_csr_drafts.sql`
   (wizard de certificado), `0008_feedback.sql`, `0009_rate_limits.sql`
   (rate limiting persistente) — si te salteás alguna, esa parte de la app
   rompe en runtime, no en build.
3. En Authentication → Providers, dejá habilitado el login por Email
   (magic link / OTP) y **habilitá "Allow anonymous sign-ins"** (Settings →
   Auth) — el onboarding arranca con una cuenta anónima antes de pedir
   email.
4. Copiá `Project URL` y `anon public key` a tu `.env.local`.

### 3. Variables de entorno

```bash
cp .env.example .env.local
```

Completá `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y
generá la clave de cifrado:

```bash
openssl rand -base64 32
```

Pegala en `CREDENTIALS_ENCRYPTION_KEY`. El ambiente (homologación/
producción) **no** es una variable de entorno: se elige por usuario, en la
pantalla de Configuración de la app.

Opcional — `RESEND_API_KEY`, `FEEDBACK_EMAIL_TO`, `FEEDBACK_EMAIL_FROM`:
si no las completás, el feedback in-app sigue guardándose en la tabla
`feedback` igual, simplemente no se manda copia por email
(`src/app/api/feedback/route.ts`).

### 4. Correr local

```bash
npm install
npm run dev
```

Entrá, iniciá sesión con tu email, y en **Configuración** cargá el CUIT, el
punto de venta, elegí **Homologación**, y subí el certificado/clave de
homologación del paso 1. Emití un par de facturas de prueba antes de pensar
en pasar a producción — en homologación ARCA no reclama nada real, es
exactamente para eso.

### 5. Pasar a producción

Cuando ya probaste el flujo completo en homologación:

1. Generá (o reusá) el certificado de **producción** (paso 1).
2. En Configuración, cambiá el ambiente a **Producción** y subí ese
   certificado/clave. Esto invalida el ticket de acceso cacheado, así que la
   próxima factura pide uno nuevo automáticamente.
3. La primera factura que emitas en producción es una factura real ante
   ARCA — no hay vuelta atrás. Confirmá el punto de venta y los datos antes.

### TLS legacy de AFIP en producción

`servicios1.afip.gov.ar` (WSFEv1 y WSFEXv1 de **producción** — no
homologación, no WSAA) todavía negocia TLS con un primo Diffie-Hellman
demasiado chico para el nivel de seguridad default de OpenSSL 3. Con
Node 18+ esto rompe con:

```
TypeError: fetch failed
[cause]: Error: ...SSL routines:tls_process_ske_dhe:dh key too small...
```

Es un problema conocido de la infraestructura de ARCA (no algo que
podamos arreglar de su lado) — reportado también por otras integraciones
como [facturajs](https://github.com/emilioastarita/facturajs/issues/12),
[pyafipws](https://github.com/reingart/pyafipws/issues/94) y
[python-zeep](https://github.com/mvantellingen/python-zeep/issues/1229).

**Cómo lo resolvimos** (`src/lib/afip/soap.ts`): en vez de bajar el nivel
de seguridad de TLS globalmente (lo que debilitaría *todas* las
conexiones del proceso, incluida Supabase), armamos un `https.Agent` de
Node con `ciphers: "DEFAULT@SECLEVEL=1"` — sigue exigiendo TLS 1.2+ y
cifrado fuerte, solo permite primos DH más chicos — y lo aplicamos
**únicamente** a pedidos hacia `servicios1.afip.gov.ar`. Todo lo demás
(WSAA, homologación, Supabase) sigue con la configuración default de
Node/OpenSSL sin tocar.

No se puede lograr lo mismo pasándole un `dispatcher` de `undici` (el
paquete de npm) a `fetch`: el undici interno de Node y el de npm no son
intercambiables entre sí (rompe con `invalid onRequestStart method`), así
que para ese host puntual el POST se hace con `node:https` en vez de
`fetch`. Ver los tests en `src/lib/afip/__tests__/soap.test.ts`, que
confirman que la relajación de TLS no se filtra a otros hosts.

## Manejo de errores

Cuando ARCA rechaza una factura (WSAA o WSFEv1), la app muestra el motivo
real devuelto por el webservice (código + mensaje de AFIP), no un error
genérico — ver `src/lib/afip/errors.ts` y cómo se propaga en
`src/app/api/facturas/route.ts`.

## Estructura

```
src/lib/afip/         cliente WSAA + WSFEv1/WSFEXv1 propio (sin terceros)
src/lib/csr.ts        generación de CSR/clave privada en el servidor (node-forge)
src/lib/crypto.ts     cifrado AES-256-GCM del certificado/clave en reposo
src/lib/pin.ts        hash + verificación de PIN (scrypt, timing-safe)
src/lib/webauthn.ts, src/lib/passkey-client.ts, src/lib/biometric.ts
                      passkeys/Face ID — nativo (Capacitor) o WebAuthn según plataforma
src/lib/pdf/          generación del PDF de la factura
src/app/(app)/        pantallas autenticadas (nueva factura, historial, config)
src/app/api/          route handlers que hablan con ARCA y Supabase
src/app/api/csr/      wizard de generación/carga de certificado
src/app/api/auth/     PIN, passkeys, vínculo cuenta anónima → email
src/app/api/feedback/ feedback in-app (+ email vía Resend, opcional)
supabase/migrations/  schema de la base (9 migraciones)
```

## App nativa (iOS/Android)

El repo hermano `fisca-app` (Capacitor) es un wrapper puro sin lógica de
facturación propia: `capacitor.config.ts` apunta `server.url` directo a
`https://fisca.vercel.app`, así que **cualquier cambio en este repo se
refleja solo en la próxima vez que la app nativa cargue esa URL** — no
hace falta re-buildear ni re-publicar nada para la mayoría de los cambios.
Lo único que vive del lado nativo es: los plugins de Capacitor (biometría,
`@capacitor/app`, `@capacitor/browser`), íconos/splash, y la config de
deep link (`fisca://auth-callback`) para que el magic link vuelva a abrir
la app instalada en vez del browser. Estado: recién arrancado (bundle id
`ar.malenitaa.fisca`), Face ID probado en iOS, permiso de biometría
agregado en Android pero sin probar en dispositivo, todavía no publicado
en ninguna store.
