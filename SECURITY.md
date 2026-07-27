# Seguridad de Fisca

Documento vivo — se ajusta cada vez que se revisa algo nuevo. No es una
certificación de nada (ver la sección "Sobre NIST/ISO 27001" más abajo),
es el registro honesto de qué controles tiene la app, dónde viven en el
código, y qué falta.

**Última revisión completa**: 2026-07-20.

## Cómo reportar un problema

Por ahora no hay un canal formal — es un proyecto de un solo
desarrollador (con ayuda de Claude Code). Si encontrás algo, es directo
por el email de contacto del repo.

## OWASP Top 10 (2021) — estado actual

| # | Categoría | Estado | Dónde |
|---|---|---|---|
| A01 | Control de acceso roto | ✅ | RLS en **todas** las tablas de Supabase, con políticas `auth.uid() = user_id` — el aislamiento entre usuarias se aplica en la base de datos, no solo en el código de la API. Ver `supabase/migrations/0001_init.sql` en adelante. |
| A02 | Fallas criptográficas | ✅ | Certificado y clave privada de ARCA cifrados con AES-256-GCM (`src/lib/crypto.ts`). PIN hasheado con scrypt + comparación a tiempo constante, no vulnerable a timing attacks (`src/lib/pin.ts`). TLS/HSTS forzado (`Strict-Transport-Security` en `src/lib/supabase/proxy.ts`). |
| A03 | Inyección | ✅ | Texto ingresado por la usuaria se escapa antes de interpolarse en el XML SOAP de ARCA (`xmlEscape()` en `src/lib/afip/soap.ts`, usado por `wsfe.ts` y `wsfex.ts`). Supabase usa queries parametrizadas (no hay SQL armado a mano). **Corregido el 2026-07-20**: `docNro` en Factura C no pasaba por `xmlEscape` — ver Changelog abajo. |
| A04 | Diseño inseguro | ✅ | Rate limiting persistente por usuaria en endpoints sensibles (tabla más abajo). Errores internos nunca se filtran al cliente (`src/lib/api-errors.ts`). |
| A05 | Configuración insegura | ✅ | CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` en todas las respuestas (`src/lib/supabase/proxy.ts`). `frame-ancestors` es `'none'` en toda la app salvo `/api/facturas/[id]/pdf`, que se relaja a `'self'` a propósito (se embebe en un iframe propio para "Ver PDF") — nunca a un origen externo. |
| A06 | Componentes vulnerables | ✅ | `npm audit`: 0 vulnerabilidades (revisado 2026-07-20). Sin proceso automático que lo re-chequee — pendiente (ver Limitaciones). |
| A07 | Fallas de autenticación | ✅ | PIN se bloquea 24hs después de 3 intentos fallidos (`src/app/api/auth/pin/verify/route.ts`). Passkeys/Face ID vía WebAuthn estándar (`src/lib/webauthn.ts`, `src/lib/passkey-client.ts`), no una implementación propia de biometría. Login por magic link o cuenta anónima de Supabase. |
| A08 | Integridad de software/datos | ✅ | `package-lock.json` commiteado — instalaciones reproducibles. |
| A09 | Logging y monitoreo | ⚠️ | **Lo más flojo.** Hay `console.error` suelto en varios lados (visible en los logs de Vercel), pero no hay alertas activas ni un lugar centralizado para ver "algo raro está pasando" (ej. muchos intentos de PIN fallidos seguidos). Para una app de una sola usuaria el impacto es bajo, pero es la brecha más real hoy. |
| A10 | SSRF | ✅ N/A | Las URLs a las que el server pega (ARCA, Supabase) están hardcodeadas en `src/lib/afip/config.ts` — nunca vienen de input de la usuaria. |

## Rate limiting por endpoint

Todos persistentes en Postgres (`src/lib/rate-limit.ts`, tabla
`api_rate_limits`), por usuaria autenticada, ventana de 1 hora salvo que
se indique otra cosa:

| Endpoint | Límite/hora |
|---|---|
| `csr:generate` | 5 |
| `csr:submit` | 10 |
| `auth:pin-recover` | 3 |
| `auth:pin-reset` | 5 |
| `auth:passkey-register` | 5 |
| `auth:vincular` | 5 |
| `configuracion` | 10 |
| `monotributo:pagos` | 60 |
| `facturas:c` | 120 |
| `facturas:e` | 60 |
| `facturas:nc` (notas de crédito) | 30 |
| `cotizacion` (Factura E, WSFEX) | 60 |
| `cotizacion-c` (Factura C, WSFE — RG 5616/2024, agregado 2026-07-27) | 60 |
| `clientes:mutate` (editar/borrar contacto, agregado 2026-07-27) | 30 |
| `feedback` | 10 |

El PIN en sí (`/api/auth/pin/verify`) tiene su propio mecanismo, más
estricto: 3 intentos fallidos y se bloquea 24hs, no cuenta requests por
hora — ver A07 arriba.

## TLS con ARCA producción

Documentado en detalle en el [README, sección "TLS legacy de
AFIP"](README.md#tls-legacy-de-afip-en-producción): `servicios1.afip.gov.ar`
(WSFEv1/WSFEXv1 de producción) negocia TLS con un primo Diffie-Hellman
demasiado chico para OpenSSL 3 por default. Se baja el SECLEVEL de 2 a 1
**solo para ese host puntual** (`src/lib/afip/soap.ts`) — todo lo demás
(Supabase, WSAA, homologación) usa la configuración default de Node sin
tocar. No es una decisión nuestra floja, es infraestructura vieja de
ARCA que no controlamos.

## Limitaciones conocidas (honestas)

- **Sin logging/monitoreo centralizado** (A09 arriba) — el gap más real.
- **Sin auditoría externa ni pentest** — esta revisión la hizo Claude
  Code leyendo el código, no un tercero independiente.
- **Sin proceso automático de actualización de dependencias** —
  `npm audit` se corrió a mano el 2026-07-20, no hay un bot tipo
  Dependabot corriendo.
- **Un solo desarrollador** — no hay revisión de código por un segundo
  par de ojos humano en cada cambio (aunque sí hay dos sesiones de
  Claude Code trabajando y revisándose).

## Sobre NIST / ISO 27001

Esto **no** está certificado en NIST ni en ISO 27001, y decir que sí
sería falso. Son marcos de *gestión organizacional* — auditorías
externas, políticas formales, gestión de riesgo de una empresa — no
algo que se obtenga escribiendo código prolijo. Certificarse en ISO
27001 es un proceso de meses con auditor externo, pensado para
organizaciones con equipos y activos que gestionar; no aplica a una app
de un monotributista.

Lo que sí es cierto: los controles técnicos de acá (AES-256-GCM, RLS,
scrypt con salt, rate limiting, headers CSP) son prácticas que esos
marcos reconocen como buenas. Pero "usa controles alineados con buenas
prácticas" y "está certificado" son cosas distintas — no mezclarlas.

## Changelog

- **2026-07-20**: primera versión de este documento. Revisión completa
  contra OWASP Top 10. Encontrado y corregido: `docNro` de Factura C no
  pasaba por `xmlEscape()` antes de ir al XML de ARCA (commit
  `41369a9`) — defensa en profundidad, no explotable en la práctica
  porque el único caller real ya sanitizaba antes, pero la función de
  librería compartida no debía depender de eso.
- **2026-07-27**: agregado `cotizacion-c` (cotización oficial para
  Factura C en moneda extranjera) y `clientes:mutate` (editar/borrar
  contacto guardado) a la tabla de rate limiting. No es una revisión
  completa nueva contra OWASP — solo se actualizó esta tabla.
