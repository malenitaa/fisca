# Estado del proyecto (para retomar si se corta la sesión)

Último estado: **2026-07-27**. Esto es un log de situación real (qué está
hecho, qué falta, y decisiones tomadas) — no es documentación de usuario
(`README.md`) ni de arquitectura de código (`ARCHITECTURE.md`). Si venís
de una sesión anterior: entre el `2026-07-15` (fecha vieja de este
archivo) y hoy se agregó bastante que este documento no reflejaba —
PIN/Face ID/passkeys, wizard de CSR, feedback in-app, Factura E, y la
libreta de contactos — antes de asumir que algo "no está hecho", mirá
primero `ARCHITECTURE.md` (que ya está al día) en vez de confiar en la
sección "Pendiente" de más abajo a ciegas.

## Para retomar mañana (2026-07-28)

1. **Probar en homologación con datos reales** lo de hoy: fecha manual del
   comprobante, moneda extranjera en Factura C (probar los dos casos —
   pago en la misma moneda y en pesos), y el editar/borrar contacto. Nada
   de esto se probó en browser esta sesión (ver por qué abajo).
2. **Probar el build nativo (iOS)** — dijiste que lo ibas a hacer vos en
   otro momento, no está hecho.
3. Recién ahí, si todo anda: considerar el buscador en la libreta de
   contactos (única cosa que quedó "evaluada pero no construida" de esta
   sesión, ver el final del documento).

## Últimas features agregadas (sesión 2026-07-27, no probadas aún en browser real)

Implementadas, con `tsc`/`eslint`/`vitest` (41 tests) en verde, pero
**sin probar manualmente en un browser** porque este entorno no tenía
`.env.local` con credenciales de Supabase reales para levantar el dev
server y loguearse. Si sos la próxima sesión: probalas en homologación
antes de asumir que están 100% listas para producción. Ya está **pusheado**
a `origin/claude/monotributista-afip-invoicing-est2pz` (dos commits:
`3c1e5d0` fecha/moneda extranjera/historial, `9ca393f` editar/borrar
contacto) — Vercel ya debería tener el deploy nuevo andando, solo falta
probarlo con datos reales.

- **Fecha manual del comprobante en Factura C**: antes siempre usaba la
  fecha de hoy; ahora es editable dentro del rango real que acepta ARCA
  (±5 días si Concepto=Productos, ±10 si Servicios — confirmado contra la
  página oficial de ARCA). Bug de paso encontrado y arreglado: el
  `superRefine` de `nuevaFacturaSchema` cortaba temprano para Consumidor
  Final y se saltaba la validación de fechas de servicio.
- **Moneda extranjera en Factura C** (RG 5616/2024): campo `CanMisMonExt`
  nuevo en `FECAEDetRequest` (confirmado leyendo el manual técnico oficial
  de ARCA, no adivinado) — si el pago es en la misma moneda, se **omite**
  `MonCotiz` para que ARCA la asigne sola (evita error 10038 por no
  coincidir exacto); si es en pesos, se informa la cotización (con botón
  para traer la oficial vía el método nuevo `FEParamGetCotizacion`,
  `/api/facturas/cotizacion`). Antes esto solo existía para Factura E
  (WSFEX, fuente de cotización distinta).
- **Fix en `historial-list.tsx`**: los totales solo sumaban PES/DOL — una
  factura en EUR/GBP/BRL no aparecía en ningún total. Ahora agrupa por
  cualquier moneda de `MONEDAS`.
- **Editar/borrar un contacto guardado** en la libreta de Factura C:
  `PATCH`/`DELETE` nuevos en `/api/clientes/[id]` (solo nombre/condición
  IVA — el tipo/número de documento es la identidad del contacto y no se
  edita) y un modo "Editar contactos" en los chips del form que agrega un
  editor inline y una confirmación antes de borrar.
- Documentación (`README.md`, `ARCHITECTURE.md`, `.env.example`) puesta al
  día para reflejar todo lo de arriba **y** varias cosas que ya existían
  hace tiempo pero no estaban documentadas (ver sección siguiente).

## Nombres y URLs

- **Nombre de la app**: "Fisca" (ya actualizado en el código, título de la
  pestaña, y docs).
- **Repo de GitHub**: `malenitaa/fisca` (renombrado de `facturacionarca`).
- **Deploy**: <https://fisca.vercel.app> (renombrado de
  `facturacionarca.vercel.app`; el proyecto de Vercel y el Site
  URL/Redirect URLs de Supabase ya se actualizaron a esta URL nueva).
- **Rama de trabajo**: `claude/monotributista-afip-invoicing-est2pz` — es
  la que está deployada en Vercel. `main` sigue vacía, no se mergeó nada
  todavía.
- **Proyecto de Supabase**: ref `tujoniyojrisiwtkjmse`.

## Qué ya está corrido/probado (no hace falta repetirlo)

- Las 9 migraciones (`0001_init.sql` a `0009_rate_limits.sql`) corridas en
  Supabase — incluye `clientes`, `user_pins`/`user_passkeys`,
  `csr_drafts`, `feedback` y `api_rate_limits`, no solo las tres
  originales.
- Variables de entorno cargadas en Vercel (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CREDENTIALS_ENCRYPTION_KEY`). **Sin
  confirmar** si `RESEND_API_KEY`/`FEEDBACK_EMAIL_TO`/`FEEDBACK_EMAIL_FROM`
  ya están cargadas en Vercel — si no lo están, el feedback in-app sigue
  guardándose en la tabla igual, solo no manda el email de copia.
- Deployment Protection de Vercel: **desactivada** en Production (hacía
  falta para que el magic link funcione).
- "Allow anonymous sign-ins" habilitado en Supabase (lo necesita el
  onboarding trial-first, `/signup`).
- Certificado de **homologación** generado y cargado en Configuración:
  - CUIT: `27421034694` (Malena Villa Abrille)
  - Alias del certificado en WSASS: `aliasprueba`
  - Ya autorizado para el servicio `wsfe` en ARCA (homologación).
  - Ambiente activo en Configuración: **Homologación**, punto de venta `1`.
- Probado de punta a punta en homologación (hasta la sesión del
  2026-07-15): login, emisión de Factura C (CAE real), descarga de PDF,
  historial, anulación con Nota de Crédito, modo oscuro, página de Ayuda,
  recordatorio de pago del monotributo. Lo agregado después (PIN/Face ID,
  wizard de CSR, Factura E, contactos recientes, feedback) se fue
  probando en las sesiones correspondientes según los commits, pero no
  hay un registro tan explícito como este párrafo — si tenés dudas sobre
  si algo puntual quedó probado, es más confiable mirar el commit que
  agregó esa feature que asumir que sí por estar en `main`.
- Lo de la sesión 2026-07-27 (ver arriba): **no probado en browser**,
  solo verificado con `tsc`/`eslint`/`vitest`.

## Decisiones tomadas (para no volver a discutirlas)

- **Login por magic link**, no por código OTP tipeado: Supabase, en el
  plan free, no deja customizar el contenido de los mails de auth sin
  configurar SMTP propio o pagar Pro. El código OTP se armó y se
  abandonó por esto (ver historial de commits `Login: código OTP...` y
  `Login: volver a link-only...`). El PIN post-magic-link (ver
  `ARCHITECTURE.md` §5) es lo que terminó cubriendo la necesidad real de
  un segundo factor corto, sin tener que resolver el problema del SMTP.
- **SMTP custom de Supabase (para personalizar el mail de auth) quedó
  pausado** — no confundir con el uso de **Resend para el feedback
  in-app**, que es una integración distinta y separada (una llamada
  directa a la API de Resend desde `/api/feedback`, no el SMTP de
  Supabase Auth) y sí está construida y funcionando. Se había llegado a
  activar el toggle "Enable custom SMTP" en Supabase sin completar el
  Host, lo que tiraba un error de validación; se le dijo a la usuaria que
  lo desactivara. **Verificar que ese toggle siga apagado** antes de
  asumir que el mail de auth sigue funcionando con el servicio default de
  Supabase.
- **No se automatiza el pago del monotributo (VEP)**: no existe
  webservice público para eso, solo un portal interactivo. Automatizarlo
  requeriría manejar la Clave Fiscal real (no un certificado acotado),
  riesgo de seguridad que se descartó a propósito. En su lugar hay un
  recordatorio simple + link a ARCA.
- **No se construye un CRM de clientes, Pedidos ni Presupuestos** — la
  tabla `clientes` es deliberadamente liviana: se autocompleta sola al
  facturar, y desde el 2026-07-27 se puede corregir nombre/condición IVA
  o borrar un contacto (`/api/clientes/[id]`), pero no tiene alta manual
  ni es un sistema de gestión. Si en algún momento se pide un CRM de
  verdad, es una decisión de producto aparte, no un agregado menor.
- **iOS/Android**: se terminó optando por **Capacitor** (repo
  `fisca-app`, wrapper sin lógica propia sobre este mismo backend) en vez
  de Swift/SwiftUI nativo o quedarse solo con la PWA — ver
  `ARCHITECTURE.md` §8. La PWA (`manifest.ts`) sigue existiendo en
  paralelo, no se reemplazó.
- **Moneda extranjera en Factura C (RG 5616/2024), sesión 2026-07-27**:
  cuando el pago es en la misma moneda extranjera, se **omite** el campo
  `MonCotiz` en vez de intentar calcular/enviar un valor — el manual
  técnico de ARCA es explícito en que, si se informa, tiene que coincidir
  exacto con el registrado por ARCA o rechaza (error 10038). Es más
  seguro dejar que ARCA la asigne sola que arriesgarse a un mismatch.

## Pendiente real (mundo real, no código)

1. La usuaria **todavía no está inscripta como monotributista** — el plan
   es inscribirse en **agosto de 2026**.
2. Una vez inscripta: dar de alta un **punto de venta** para "Factura
   Electrónica - Web Services" en ARCA.
3. Generar el **certificado de producción** (mismo proceso que el de
   homologación, guía en el README).
4. En Configuración, cambiar CUIT/ambiente a **Producción** y cargar ese
   certificado.
5. (Opcional, no bloqueante) Terminar de configurar el SMTP custom de
   Supabase Auth si en algún momento se quiere volver a intentar el login
   por código en vez de link — no confundir con Resend del feedback
   in-app, que es independiente y ya funciona.

## Pendiente de producto, evaluado pero no construido

- **Buscador en la libreta de contactos** si la lista crece mucho más
  allá de los ~50 que trae hoy el endpoint (hoy no hay paginación ni
  filtro de texto).
- **Fecha manual del comprobante y moneda extranjera (RG 5616/2024),
  agregadas el 2026-07-27, son solo para Factura C** — Factura E no se
  tocó en esa sesión; si en algún momento hace falta fecha manual ahí
  también, es trabajo aparte (WSFEX puede tener sus propias reglas de
  fecha, no verificado).
- Sesión 2026-07-27 investigó (sin construir por ahora) si convenía traer
  la cotización del Banco Nación automáticamente para Factura C — se
  optó por cotización manual + el método oficial `FEParamGetCotizacion`
  de ARCA como ayuda, en vez de depender de una fuente externa (scraping
  del BNA) que se puede romper o dar un valor no oficial.
