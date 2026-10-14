# Relevo — la pasarela de pagos (Stripe y Mercado Pago)

**Al 11/10/2026.** Pedido de Martín: «Esta tab se llama "Integraciones". Quiero que implementes end-to-end la
integración con Mercado Pago y con Stripe, tipo pasarela de pagos... Lo voy a utilizar yo como superadmin para
vender MaKo, pero también los usuarios pueden alojarlo... revisa si hay que meterlo en diferentes lugares, como
la API de MaKo, como automatios, como el CRM, etc...».

## Lo que hay que leer primero

1. [docs/diseno-pasarela-pagos.md](../diseno-pasarela-pagos.md) — el contrato (y su §4.10: lo que cambió al construirlo).
2. [docs/hallazgos-planes-y-cobro.md](../hallazgos-planes-y-cobro.md) → «La pasarela» — lo que costó, y la tabla
   «Lo que quedó SIN hacer» (las filas que empiezan con **Pasarela:**).
3. AGENTS.md → «Un cobro pasa por `lib/cobros.ts`, y la clave de una pasarela se lee con `credDelCliente`».

## Decisiones de Martín (no se re-preguntan)

- Al pagar un plan de MaKo, **alta automática** (workspace + mail de acceso; en la página de retorno puede cambiar
  la cuenta de Google con la que entra).
- Cada cliente conecta **pegando sus claves** (BYOK), no OAuth/Connect.
- En Automations, **«Pagos» es un botón propio** del CRON (grilla 4+3).

## Dónde vive cada cosa

| Qué | Dónde |
|---|---|
| Datos | `supabase/migrations/0255_cobros_pasarela.sql` (`cobros`, `pasarela_eventos`, columnas de proveedor en `pagos`) |
| El servicio (crear, aplicar, reembolsar, reconciliar, alta) | `lib/cobros.ts` · lo puro en `lib/cobros-reglas.ts`, `lib/cobros-tipos.ts`, `lib/pasarela-moneda.ts` |
| Proveedores y firmas | `lib/stripe-api.ts`, `lib/stripe-form.ts`, `lib/mercadopago-api.ts`, `lib/pasarela-firma.ts` |
| Conectar en /integraciones | `lib/cobros-conexion.ts` + los tres registros (catálogo, campos, ping) y el logo |
| Webhooks y cron | `app/api/webhooks/stripe`, `app/api/webhooks/mercadopago`, `lib/cobros-webhook.ts`, `lib/cobros-eventos.ts`, `lib/pasarela-eventos.ts`, `app/api/cron/cobros-reconciliar` |
| Páginas públicas | `app/pagar/[token]` (redirige al checkout vivo), `app/pagar/[token]/listo`, `app/api/pagar/email`, `app/reembolsos`, `/terminos` §8 |
| Ficha del lead | `app/crm/[id]/cobros-actions.ts`, `CobrarConLink.tsx`, `CobrosDelLead.tsx` (montados en `DealDetailsCard`) |
| API de MaKo | área `cobros` (`lib/api-mako/areas/cobros.*`), el doer (`esPedidoDeCobro`), `{{link_pago}}` |
| Super admin | `/admin/cobros` (vender un plan, ver cada alta) |
| Automations | CRON «Pagos» (`TRIGGER_PAGO`, `lib/pago-entrante.ts`) y el evento de MaKo «Entra un pago» (`mako-pago`) |

## Para que Martín lo use

1. Conectar la Stripe o la Mercado Pago **de MaKo** desde `/integraciones?ws=9` (el workspace de la plataforma: sin el
   `?ws=9`, si su sesión está en otro workspace, la clave quedaría en ése).
2. En Mercado Pago, pegar en su panel («Tus integraciones → Webhooks») la URL que muestra la tarjeta y copiar de ahí la
   clave secreta.
3. Vender: `/admin/cobros` → «Vender un plan». El link que sale es `hola-mako.com/pagar/<token>`.
4. Para recibir el aviso en el grupo: Automations → galería → «Aviso de pago recibido».
5. Revisar los BORRADORES de `/reembolsos` y de la sección 8 de `/terminos`.

## Lo que falta verificar con claves reales

- Si una clave restringida de Stripe (`rk_`) puede leer `GET /v1/account` (si no, el tutorial tiene que pedir `sk_`).
- Si la `notification_url` de Mercado Pago llega firmada y con `data.id` en el query.
- Un pago de punta a punta en modo prueba (Stripe `sk_test_`; en MP los pagos de prueba NO avisan: entran por el cron
  de reconciliación, cada 30 min).

**13/10/2026:** las tres siguen sin hacer. No se pueden medir sin las claves de prueba de Martín (se las pidió el chat de
Integraciones). Lo demás de la pasarela está cerrado: el commit que había quedado suelto en el worktree
`C:/dev/wt-pagos-auto` ya está en `main` como `67b7695d`.
