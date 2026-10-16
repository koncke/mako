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

**14/10/2026 — la revisión de b2 (Pagos campo por campo, rama del CRM `crm-bloques-b2`):** las dos ALTAS y las seis
MEDIAS están cerradas. Las altas y tres medias, en commits del chat CRM sobre `crm-bloques-b2`; las otras tres
medias (la cuota reprogramada sin recordatorio, el link vivo de una cuota cobrada a mano, el plazo de la suscripción
al reactivar), en la rama `pagos-b2-medias` del chat de Pagos, que el CRM mergea en b2. Nada de esto está en `main`
todavía: entra cuando Estrategia integre la tanda B. Quedan las seis BAJAS de esa revisión (lista en
docs/hallazgos-crm.md, «Una cuota reprogramada…»). La migración XXXX de b2 ahora suma `leads.suscripcion_meses_antes`.
Después se cerraron también las seis BAJAS (docs/hallazgos-crm.md, «Las seis bajas de b2»). Todo vive en UNA rama,
`crm-bloques-b2`, y espera la decisión de integrar (tablero, ref `crm-bloques-b2-integrar`). Las ramas `pagos-pasarela` y
`pagos-automations` no tienen nada que no esté en `main`: se pueden borrar (las borra su chat, no éste).

**15/10/2026 — `pagos-pendientes` (cda1bf49f), integrada por Estrategia en la tanda con b2; sale con el próximo push.**
Quitar la clave de una pasarela desconecta del todo (campos, ruteo y el aviso de MaKo en la cuenta de Stripe), las
claves de cobro del ws1 ya no van a `process.env`, el «ya es de otro» del cambio de email gasta el intento y los avisos
de MP sin dueño dejan una fila por día. Lo aprendido, en docs/hallazgos-integraciones.md («Quitar la clave de una
pasarela…», «Prohibir el lector no alcanza…») y docs/hallazgos-planes-y-cobro.md. Las ramas `pagos-automations` y su
worktree están borradas; `pagos-rojo-cobranza` no tiene nada fuera de `main`.

### Lo que está QUIETO, y qué lo destraba

| Qué | Lo destraba | Dónde |
|---|---|---|
| Si una clave restringida (`rk_`) lee `GET /v1/account`; si la `notification_url` de MP llega firmada y con `data.id` en el query; si MP respeta el vencimiento de una preferencia anulada con el checkout ya abierto; qué dice `coverage_applied` de un contracargo de MP; en qué estado queda una suscripción de MP al llegar su `end_date`; un pago de punta a punta en modo prueba | las claves de PRUEBA de Martín (Stripe `sk_test_`/`rk_test_`, una cuenta de prueba de MP) | `lib/cobros-conexion.ts`, `lib/metodo-catalogo.ts`, `app/api/webhooks/mercadopago/route.ts` |
| Stripe no abre cuentas a negocios de Argentina; la primera venta a un mexicano arranca el reloj del RFC | Martín (precio y fiscal): pasa ANTES por Estrategia, que lo mira con este chat cuando b2 esté en `main` | `app/admin/dev/pricing/modelo.ts` |
| Los BORRADORES legales de `/reembolsos` y `/terminos` §8 | que Martín los lea; igual que el RFC, pasa antes por Estrategia | `app/reembolsos/page.tsx`, `app/terminos/page.tsx` |

Las otras cuatro «decisiones de Martín» que estaban acá se DECIDIERON el 15/10 con la vara de AGENTS.md (copiar a Stripe y
Mercado Pago, o contestar con lo escrito): el lead ganado que recibe un reembolso se queda donde está; un pago único que
paga una suscripción sigue de pago único y la mensualidad cuenta en el MRR; un flujo puede reembolsar (lo decidió Martín
el 08/10); y un contracargo se muestra y desmarca la cuota sólo si la plata salió. El porqué, en
docs/hallazgos-planes-y-cobro.md → «Cuatro «decisiones de Martín» que no eran suyas». Antes de mandar CUALQUIER
pregunta a la Ticketera: `node --import tsx scripts/decisiones.ts listar`, y la vara de AGENTS.md.

### Lo que sigue SIN bloqueo (código; casi todo vive en archivos de b2, así que va DESPUÉS de que b2 esté en `main`)

En este orden, de lo que más plata toca a lo que menos:
1. ~~Un link de MP anulado se puede pagar igual y nadie avisa~~ → HECHO el 15/10 (rama `pagos-mp-anulado`): al anular, MaKo vence la preferencia de MP (o cancela la suscripción sin autorizar); si igual entra un pago, lo dice el cobro y el historial («la plata entró dos veces» si la cuota ya estaba cobrada), y el cron relee los anulados.
2. ~~Un reembolso de Stripe se da por hecho con `pending`~~ → HECHO el 15/10 (rama `pagos-reembolso-stripe`): se escucha `refund.failed` y una devolución que falla se revierte (cobro y cuota); los avisos ya registrados se ponen al día antes de reembolsar.
3. ~~El Outstanding del Dashboard cuenta como deuda las cuotas devueltas~~ → HECHO el 15/10 (rama `pagos-outstanding-devueltas`): el Outstanding, «A quién cobrarle» y el Revenue con «Todo» sacan las devueltas con `esCuotaDevuelta`.
3b. ~~Contracargos~~ → HECHO el 15/10 (rama `pagos-contracargos`): Stripe escucha las disputas y mueve la cuota con lo que dice la disputa releída; Mercado Pago se cuenta sin mover la cuota (su documentación se contradice; medirlo es de la fila de claves de prueba). El cron pone al día los avisos de Stripe una vez por día.
3c. ~~El MRR cuenta la mensualidad de un link de suscripción pagado por un lead de pago único~~ → HECHO el 15/10 (rama `pagos-mrr-cobros`, `mrrDeLaPasarela`).
4. ~~Un producto de suscripción con plazo se cobra sin fin~~ → HECHO el 15/10 (rama `pagos-suscripcion-plazo`): `cancel_at` en Stripe al primer pago, `end_date` en MP al crear, y el lead ganado con su plazo.
5. ~~La fecha de la cuota y el MRR al cancelar~~ → HECHO el 15/10 (rama `pagos-fecha-cuota`): la cuota con la fecha del pago, y la cancelada por la pasarela sale del MRR en el acto (la que terminó su plazo, no se marca cancelada).
6. ~~En `/mako/revisar`, el `cobroId` de un reembolso se puede editar~~ → HECHO el 15/10 (rama `pagos-revisar-reembolso`, `fijoAlRevisar`). Las acciones de plata de Ads y Email tienen el mismo agujero: la lista en docs/hallazgos-api-mako.md.
7. El cambio de email tras el alta: falta un código al email ACTUAL (`app/pagar/cambio-email.ts`, `app/api/pagar/email/route.ts`).
8. Más grandes, con su propio diseño: precios en moneda local en el catálogo (`lib/productos.ts`), `crear_link_pago` en el «⚡ Acción» (área de Automations, `lib/editor-acciones.ts`), y los topes de `/api/pagar/email` fuera de la memoria (`lib/rate-limit.ts`).
