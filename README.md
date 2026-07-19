# Fisca

Web app minimalista para que un monotributista emita **Facturas C** con CAE
usando los webservices de ARCA (ex AFIP) — sin sistema contable, sin
dashboards, sin funciones que no vas a usar. Una pantalla para facturar, un
historial, listo.

## Qué hace

1. **Login por magic link** (sin usuario/contraseña).
2. **Configuración inicial** (una sola vez): CUIT, punto de venta, ambiente
   (homologación/producción) y el certificado + clave privada de ARCA. Se
   guardan **cifrados** en la base y nunca se vuelven a mostrar.
3. **Nueva factura**: concepto, cliente (CUIT/DNI o Consumidor Final),
   condición frente al IVA del receptor, ítems con descripción/cantidad/
   precio. Valida todo antes de mandarlo a ARCA.
4. Al confirmar, la app pide el CAE a WSFEv1 y genera un PDF con los datos
   legales (CAE, vencimiento, QR de ARCA).
5. **Historial** de facturas emitidas, con re-descarga del PDF y cantidad
   total de comprobantes.
6. **Anular una factura mal emitida**: emite la Nota de Crédito C asociada
   (no se puede "borrar" un comprobante con CAE, ver `/ayuda`).
7. **Modo oscuro** (según preferencia del sistema, con toggle manual) y una
   página de **Ayuda** con preguntas frecuentes (no es un chatbot).
8. **Recordatorio de pago del monotributo**: un aviso simple en la pantalla
   principal con un botón "Ya pagué" y un link directo a ARCA para generar
   el VEP. No automatiza el pago (eso implicaría manejar tu Clave Fiscal
   real, ver sección de seguridad).

### Por qué no hay opción "Factura D" ni "Factura E" en el formulario

- No existe un tipo de comprobante "D" en la codificación de ARCA — no es un
  recorte del MVP, directamente no existe.
- Como monotributista, legalmente solo podés emitir **Factura C**. Las
  Facturas A/B son para responsables inscriptos.
- La Factura E (exportación) se autoriza contra un webservice completamente
  distinto (**WSFEXv1**, no WSFEv1), con otro esquema de datos. Queda fuera
  de este MVP; si en algún momento facturás exportaciones, es una integración
  aparte.

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
- `wsfe.ts`: llama a WSFEv1 (`FECompUltimoAutorizado`, `FECAESolicitar`)
  para obtener el próximo número de comprobante y el CAE.
- `qr.ts`: genera el QR obligatorio (RG 4892) para el PDF.

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

Necesitás un certificado (.crt) y su clave privada (.key) asociados al
webservice **wsfe** (Facturación Electrónica). El proceso es distinto para
homologación (testing) y producción, y **hay que probar todo en
homologación antes de tocar producción**.

#### Generar el pedido de certificado (CSR) — igual para ambos ambientes

Con OpenSSL instalado localmente:

```bash
openssl genrsa -out privada.key 2048
openssl req -new -key privada.key -subj "/C=AR/O=Tu Nombre o Razón Social/CN=MonotributoFacturacion/serialNumber=CUIT 20XXXXXXXXX" -out pedido.csr
```

Reemplazá `CUIT 20XXXXXXXXX` por tu CUIT sin guiones. Vas a terminar con dos
archivos: `privada.key` (nunca la subas a ningún lado, ni siquiera a ARCA) y
`pedido.csr` (esto sí se sube).

#### Homologación (testing) — servicio WSASS

1. Entrá a [www.arca.gob.ar](https://www.arca.gob.ar) con tu Clave Fiscal
   (tiene que ser una Clave Fiscal de persona física, no de la empresa).
2. Si todavía no tenés el servicio habilitado: "Administrador de Relaciones
   de Clave Fiscal" → "Adherir Servicio" → AFIP/ARCA → "Servicios
   Interactivos" → buscá **WSASS** (Web Service de Administración de
   Certificados Digitales Simplificado) y adherite. Cerrá sesión y volvé a
   entrar.
3. Buscá y abrí **WSASS**.
4. "Crear nuevo certificado": ponele un alias, pegá el contenido de
   `pedido.csr` en el campo de la solicitud (formato PKCS#10), y confirmá.
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
2. Subí el mismo (o un nuevo) `pedido.csr` y descargá el `.crt` de
   producción.
3. Andá a **"Administrador de Relaciones de Clave Fiscal"** → creá una
   nueva relación → tu CUIT como representado → servicio **"ws -
   Facturación Electrónica"** (WSFEv1) → asociá el certificado que acabás
   de generar.

Guardá `pedido.csr`/`privada.key` en un lugar seguro — si perdés la clave
privada tenés que generar un certificado nuevo.

### 2. Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Corré las migraciones de `supabase/migrations/` en orden (`0001_init.sql`,
   `0002_notas_credito.sql`, `0003_monotributo_pagos.sql`) en el SQL Editor,
   o `supabase db push` si usás la CLI.
3. En Authentication → Providers, dejá habilitado el login por Email
   (magic link / OTP). No hace falta configurar contraseña.
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
src/lib/afip/       cliente WSAA + WSFEv1 propio (sin terceros)
src/lib/crypto.ts    cifrado AES-256-GCM del certificado/clave en reposo
src/lib/pdf/         generación del PDF de la factura
src/app/(app)/       pantallas autenticadas (nueva factura, historial, config)
src/app/api/         route handlers que hablan con ARCA y Supabase
supabase/migrations/ schema de la base
```
