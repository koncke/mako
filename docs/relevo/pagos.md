# Relevo — Pagos: la pasarela (Stripe y Mercado Pago), los cobros de MaKo y la tab Pagos del lead

**Al 17/10/2026, ~02:30 AR (cuenta 4, `claude4`).** El chat jefe «Pagos». Lo aprendido vive en
[hallazgos-pagos.md](../hallazgos-pagos.md) (la tab y las cuotas) y en
[hallazgos-planes-y-cobro.md](../hallazgos-planes-y-cobro.md) → «La pasarela» (Stripe, Mercado Pago, el plan de MaKo y
el cliente de agencia). La historia de cada cambio está en `git log`.

## Lo de esta sesión (rama `pagos-agencia-clientes`, en `C:/dev/wt-pagos`; pasada al Cerebro, sin pushear)

| Commit | Qué |
|---|---|
| `88be542a5` | **#871 «Baja del cliente»** en las cuotas: lo que no pagó deja de ser deuda en todos lados y lo cobrado queda. Mig **0307** (`pagos.baja_at`, `pagos.baja_vencia`). Botón en el bloque `cuotas`, «Deshacer la baja», y la API `baja_del_cliente` |
| `05f288bac` | La baja tolera una base sin la 0307 (lecturas con `*`), pedido del Cerebro |
| `b6dd0a6be` | **#866 y #867, el cliente de una agencia**: al abrirle la cuenta, el link de Mercado Pago de su primer mes; pagarlo lo habilita solo; su mes corre desde que termina el onboarding, y ahí nace la suscripción mensual (`start_date`). Mig **0308** (columnas en `cobros`). Precio en `/admin/cobros`. API `ver_pagos_clientes_agencia` |

Las dos migraciones las aplica el Cerebro ANTES del deploy que las lee.

## Lo que sigue, en orden

1. **Que Martín conecte la Mercado Pago de MaKo** en `/integraciones?ws=9` y cargue el **precio en pesos** del cliente de
   agencia en `/admin/cobros`. El 17/10 el ws9 tenía 0 claves de pasarela y 0 cobros. Sin las dos cosas, abrir la
   cuenta de un cliente de agencia queda como antes (espera la aprobación) y no sale ningún link.
2. **Medir con claves de PRUEBA** que MP acepte `start_date` en una suscripción sin plan y no cobre al autorizarla. Va
   con el resto de lo que espera esas claves (tabla de abajo).
3. **Mirarlo en el navegador, en el ws3 (nunca ws1)**: la tab Pagos con un ganado con cuotas, una suscripción y un lead
   abierto; la «Baja del cliente» sobre un ganado con cuotas vencidas; y la tarjeta de un cliente de agencia («Pagar su
   mes», «Activar renovación»). No se pudo: no hubo RAM para `next dev` (receta en docs/hallazgos-crm.md).
4. **La T3 (Customer Success en bloques) va con el CRM, al final.** Al pasarla, se borran juntos DealDetailsCard,
   EditarDeal, `?edit=1`, «Completar con IA», `saveDealSectionsAction` y `saveCuotasAction`.
5. **`pagos-mexico-guarda` (a075e1ae5) NO se integra** hasta que Martín conteste `cobrar-mako-en-mexico` en la Ticketera.

Hechos y tachados: `PlantillaTab` (ya importa lib/ficha/plantillas-tab.ts). El cast de `epico` en `bloques-cobro.tsx`
lo saca el CRM: no tocarlo.

## Decisiones de Martín (no se re-preguntan)

- Al pagar un plan de MaKo, **alta automática** (workspace + mail de acceso).
- Cada cliente conecta su pasarela **pegando sus claves** (BYOK), no OAuth/Connect.
- En Automations, **«Pagos» es un botón propio** del CRON.
- **Cliente de agencia** (16/10, llamada con Código Inmobiliario): **US$47 por cliente y US$97 la suscripción de
  agencia**; el link al cargarlo, sin que él apruebe; y el mes corre desde el fin del onboarding (lo aceptó Joan).
- **Baja del cliente** (16/10, llamada con Mauricio): una opción en las cuotas que conserva lo cobrado.

## Dónde vive cada cosa

| Qué | Dónde |
|---|---|
| Datos | mig 0255 (`cobros`, `pasarela_eventos`), 0295 (`nacio_cobrada`, un link vivo por cuota), 0307 (la baja), 0308 (el cliente de agencia) |
| El servicio (crear, aplicar, reembolsar, reconciliar, alta) | `lib/cobros.ts` · lo puro en `lib/cobros-reglas.ts`, `lib/cobros-tipos.ts`, `lib/pasarela-moneda.ts` |
| Proveedores y firmas | `lib/stripe-api.ts`, `lib/mercadopago-api.ts`, `lib/pasarela-firma.ts` |
| Webhooks y cron | `app/api/webhooks/{stripe,mercadopago}`, `lib/cobros-webhook.ts`, `lib/cobros-eventos.ts`, `app/api/cron/cobros-reconciliar` (también corre las renovaciones de agencia) |
| La tab Pagos del lead | `app/crm/lead-view/ficha/{reglas-pagos.ts, registro-pagos.tsx, pagos/}` · lo que dice: `lib/pagos-vistazo.ts` · lo cobrado: `lib/cobrado-lead.ts` |
| La baja del cliente | `lib/pagos-baja.ts` (el único que escribe `baja_at`) · `noEsDeuda` en lib/cobrado-lead.ts |
| El cliente de agencia | `lib/agencia-cobro.ts` (link, renovación, lo que ve la agencia) · `lib/agencia-cobro-reglas.ts` (puro) · `lib/agencia-habilitar.ts` (el pago aprueba; el aviso que comparte con la firma del super admin) · `app/customer-success/CuentaDeMaKo.tsx` |
| Páginas públicas | `app/pagar/[token]`, `/listo`, `app/api/pagar/email`, `app/reembolsos`, `/terminos` §8 |
| API de MaKo | área `cobros` (`lib/api-mako/areas/cobros.*`, con `baja_del_cliente`) y `ver_pagos_clientes_agencia` en el área `cs` |
| Super admin | `/admin/cobros` (vender un plan, el precio del cliente de agencia, cada alta) |

## Lo que está QUIETO, y qué lo destraba

| Qué | Lo destraba | Dónde |
|---|---|---|
| Si `rk_` lee `GET /v1/account`; si la `notification_url` de MP llega firmada; si MP respeta el vencimiento de una preferencia anulada; `coverage_applied` de un contracargo de MP; el estado de una suscripción de MP al llegar su `end_date`; **que MP acepte `start_date` y no cobre al autorizar**; un pago de punta a punta | las claves de PRUEBA de Martín | `lib/cobros-conexion.ts`, `lib/mercadopago-api.ts`, `app/api/webhooks/mercadopago/route.ts` |
| Vender planes de MaKo a México | Martín, Ticketera `cobrar-mako-en-mexico`. Con la A, se integra `pagos-mexico-guarda` (a075e1ae5) | `lib/cobros.ts` (`crearCobro`), `lib/cobros-reglas.ts` |
| La garantía del programa grupal | Martín, Ticketera `garantia-grupal` | `app/reembolsos/page.tsx` |
| Cortar el acceso a quien no paga (un plan dado de baja, una renovación de agencia sin autorizar) | no existe el estado de suscripción por workspace | docs/hallazgos-planes-y-cobro.md, «Lo que quedó SIN hacer» |

## Para que Martín lo use

1. Conectar la Stripe o la Mercado Pago **de MaKo** desde `/integraciones?ws=9` (con el `?ws=9`: si no, la clave queda en
   el workspace que esté mirando). En Mercado Pago, pegar en su panel la URL que muestra la tarjeta.
2. Vender un plan: `/admin/cobros` → «Vender un plan». El link es `hola-mako.com/pagar/<token>`.
3. Cliente de agencia: `/admin/cobros` → «Cliente de agencia», el monto en pesos de los US$47.
4. El aviso en el grupo: Automations → galería → «Aviso de pago recibido».
