# Estado del proyecto (para retomar si se corta la sesión)

Último estado: **2026-07-15**. Esto es un log de situación real (qué está
hecho, qué falta, y decisiones tomadas) — no es documentación de usuario
(`README.md`) ni de arquitectura de código (`ARCHITECTURE.md`).

## Nombres y URLs

- **Nombre de la app**: "Fisca" (ya actualizado en el código, título de la
  pestaña, y docs).
- **Repo de GitHub**: `malenitaa/facturacionarca` — el nombre técnico del
  repo y del proyecto de Vercel **todavía dicen "facturacionarca"**, no se
  renombraron. Pendiente de decisión: si se renombran, hay que volver a
  cargar las Redirect URLs en Supabase (Authentication → URL
  Configuration), igual que la vez que se armó el deploy.
- **Deploy**: <https://facturacionarca.vercel.app>
- **Rama de trabajo**: `claude/monotributista-afip-invoicing-est2pz` — es
  la que está deployada en Vercel. `main` sigue vacía, no se mergeó nada
  todavía.
- **Proyecto de Supabase**: ref `tujoniyojrisiwtkjmse`.

## Qué ya está corrido/probado (no hace falta repetirlo)

- Migraciones `0001_init.sql`, `0002_notas_credito.sql` y
  `0003_monotributo_pagos.sql` corridas en Supabase.
- Variables de entorno cargadas en Vercel (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CREDENTIALS_ENCRYPTION_KEY`).
- Deployment Protection de Vercel: **desactivada** en Production (hacía
  falta para que el magic link funcione).
- Certificado de **homologación** generado y cargado en Configuración:
  - CUIT: `27421034694` (Malena Villa Abrille)
  - Alias del certificado en WSASS: `aliasprueba`
  - Ya autorizado para el servicio `wsfe` en ARCA (homologación).
  - Ambiente activo en Configuración: **Homologación**, punto de venta `1`.
- Probado de punta a punta en homologación: login, emisión de Factura C
  (CAE real), descarga de PDF, historial, anulación con Nota de Crédito,
  modo oscuro, página de Ayuda, recordatorio de pago del monotributo.

## Decisiones tomadas (para no volver a discutirlas)

- **Login por magic link**, no por código OTP tipeado: Supabase, en el
  plan free, no deja customizar el contenido de los mails de auth sin
  configurar SMTP propio o pagar Pro. El código OTP se armó y se
  abandonó por esto (ver historial de commits `Login: código OTP...` y
  `Login: volver a link-only...`).
- **SMTP custom (Resend) quedó pausado**: se llegó a activar el toggle
  "Enable custom SMTP" en Supabase sin completar el Host, lo que tiraba
  un error de validación. Se le dijo a la usuaria que lo desactivara.
  **Verificar que ese toggle haya quedado apagado** antes de asumir que
  el mail sigue funcionando con el servicio de Supabase.
- **No se automatiza el pago del monotributo (VEP)**: no existe
  webservice público para eso, solo un portal interactivo. Automatizarlo
  requeriría manejar la Clave Fiscal real (no un certificado acotado),
  riesgo de seguridad que se descartó a propósito. En su lugar hay un
  recordatorio simple + link a ARCA.
- **No se construye CRM de clientes, Pedidos ni Presupuestos**: se evaluó
  y se descartó para no alejarse del objetivo original ("una pantalla
  para facturar rápido"). Si en algún momento se pide, es una decisión de
  producto aparte, no un agregado menor.
- **iOS**: se decidió arrancar con PWA (ya tiene `manifest.ts` + íconos
  para "agregar a inicio"), no con una app nativa. La app nativa queda
  documentada como opción futura en `ARCHITECTURE.md` § 7.

## Pendiente real (mundo real, no código)

1. La usuaria **todavía no está inscripta como monotributista** — el plan
   es inscribirse en **agosto de 2026**.
2. Una vez inscripta: dar de alta un **punto de venta** para "Factura
   Electrónica - Web Services" en ARCA.
3. Generar el **certificado de producción** (mismo proceso que el de
   homologación, guía en el README).
4. En Configuración, cambiar CUIT/ambiente a **Producción** y cargar ese
   certificado.
5. (Opcional, no bloqueante) Terminar de configurar Resend si en algún
   momento se quiere volver a intentar el login por código en vez de
   link.
6. (Opcional) Decidir si renombrar el repo/deploy de "facturacionarca" a
   "fisca".

## Pendiente de producto, evaluado pero no construido

- Autocompletar "clientes recientes" al facturar (sin ser una base de
  clientes completa) — se mencionó como posible mejora chica, no se
  construyó.
