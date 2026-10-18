# Relevo — Pagos: la pasarela (Stripe y Mercado Pago), los cobros de MaKo y la tab Pagos del lead

**Al 17/10/2026, ~02:30 AR (cuenta 4, `claude4`).** El chat jefe «Pagos». Lo aprendido vive en
[hallazgos-pagos.md](../hallazgos-pagos.md) (la tab y las cuotas) y en
[hallazgos-planes-y-cobro.md](../hallazgos-planes-y-cobro.md) → «La pasarela» (Stripe, Mercado Pago, el plan de MaKo y
el cliente de agencia). La historia de cada cambio está en `git log`.

## 17/10/2026 · los pendientes B4 (rama `pend-b4-1710`, agente «Pendientes B4: Ads y plata»)

Lo aprendido: `docs/hallazgos-pagos.md` §5 y `docs/hallazgos-planes-y-cobro.md` → «Quien deja de pagar deja de entrar».

| Qué | Dónde |
|---|---|
| **Quien deja de pagar su lugar deja de entrar**: el cron de la pasarela pausa el negocio cuando se terminó lo pagado (+5 días) y lo reabre al pagar; un negocio pausado va a /cuenta-pausada y la API contesta 403 | lib/plan-acceso{,-reglas}.ts · lib/workspace.ts · app/cuenta-pausada |
| Marcar a mano una cuota cuyo link ya se cobró no cuenta la plata dos veces | lib/pagos.ts · lib/cobros.ts (`asentarLinkPagadoDeCuota`) |
| El cartel «no está en tu plan» y el corte de la API por plan | lib/tab-access.ts · lib/api-tab.ts |
| Identidades fiscales sólo del admin; la moneda del negocio con pantalla | app/crm/[id]/deal-actions.ts · app/configuraciones/MonedaNegocioPanel.tsx |
| La cobranza lee todas las cuotas (cortaba en 1.000); la renovación desde el último cobro; «De baja» en el Dashboard | lib/pagos.ts · lib/cobrado-lead.ts · lib/graficos-datos.ts |

**Medido** (sólo lectura): el `in` sobre `ctx->>cuotaId` no traba guardar cuotas ni cerrar en Ganado. **0 cobros en
producción** el 17/10: el corte por falta de pago no toca a nadie hoy.

### ⚠️ APAGADOS por la revisión adversarial del 17/10 (para después del 20/10): se prenden SÓLO con su arreglo y su revisión

La revisión de 65e299c2e confirmó 9 defectos reales, todos en tres cambios que quedaron en el código con un interruptor en
`false` (el informe: scratchpad/revision-b4.md de la sesión del Cerebro del 17/10):

| Interruptor | Qué apaga | Los defectos que hay que arreglar antes de prenderlo |
|---|---|---|
| `CORTE_DE_ACCESO_PRENDIDO` (lib/plan-acceso-reglas.ts) | El cron que pausa y reabre por falta de pago, y que un negocio pausado no se abra (/cuenta-pausada, el 403 de la API) | (alta) el cron sólo ve los cobros con `alta_ws`: un plan nuevo vendido a una cuenta que ya existía (`ya_tenia_cuenta`) queda afuera y la pausa no se levanta aunque pague · (media) un primer pago DEVUELTO con la suscripción activa da «vencido» y pausa a quien paga (un reembolso no cancela la suscripción) · (media/baja) las cuotas de los lugares se leen sin paginar (`plan-acceso.ts:84`) · (baja) el tope de 5 y el orden de los pasos |
| `CORTE_POR_PLAN_PRENDIDO` (lib/api-tab.ts) | El corte de la API por plan y el cartel «no está en tu plan» (`requireCapa` vuelve al redirect a la casa del plan) | (baja, de cara al cliente) un negocio con capa `pm` entra por /inicio a /general y ve «No está en tu plan»: el repartidor de /inicio manda a una tab que esa capa no tiene |
| `MIRAR_LINK_ANTES_DE_MARCAR` (lib/pagos.ts) | Preguntarle a la pasarela antes de marcar una cuota a mano | (alta) con un link en estado «pagado», `asentarLinkPagadoDeCuota` (lib/cobros.ts) da la cuota por cobrada aunque `aplicarPagoAprobado` no marque nada: una cuota destildada por error (ws1) ya no se puede volver a marcar y queda IMPAGA para siempre, y cada intento repite «Entró un pago» · (media) el paso 1 tiene que exigir que la cuota NO esté asentada por ese pago, no sólo que el cobro esté pagado |

Con los tres en `false` el producto se comporta como antes del 17/10 en esas tres cosas (marcar a mano vuelve a poder contar
dos veces un link pagado sin asentar; quien no paga sigue entrando). Los tests que dependen de ellos fijan que están
apagados (tests/plan-acceso.test.ts, tests/api-tab.test.ts, tests/pagos-link-ya-pagado.test.ts).

**Lo que quedó SIN hacer, con el porqué (para después del 20/10: corte de consumo del Cerebro, 17/10):**
- **Precios en moneda local en el catálogo** (`lib/productos.ts`, `lib/api-mako/areas/cobros.run.ts`): pide una columna
  nueva en `productos` (migración) y su pantalla; no entró en esta corrida.
- **Los bloques de Pagos que no se dibujan** (`confirmacion-de-pago`, `recordatorios-de-cobro`, `excepciones`,
  `cliente-en-cs`, app/crm/lead-view/ficha/reglas-pagos.ts): cada uno necesita su lectura, y los recordatorios por lead
  piden la columna `lead_id` (mig 0186). No entró.
- **Mirar en el ws3** la tab Pagos, la «Baja del cliente» y la tarjeta del cliente de agencia (leads 2739 y 2740), y
  /cuenta-pausada: no hubo RAM para un build.
- **Que el corte avise**: hoy queda en el log del cron y en el chip «pausado» de /admin. Un aviso a Martín (y al cliente)
  sería un Evento de MaKo del catálogo de avisos, que es del chat de Automations.

## Lo de esta sesión (rama `pagos-agencia-clientes`, en `C:/dev/wt-pagos`; pasada al Cerebro, sin pushear)

| Commit | Qué |
|---|---|
| `88be542a5` | **#871 «Baja del cliente»** en las cuotas: lo que no pagó deja de ser deuda en todos lados y lo cobrado queda. Mig **0307** (`pagos.baja_at`, `pagos.baja_vencia`). Botón en el bloque `cuotas`, «Deshacer la baja», y la API `baja_del_cliente` |
| `05f288bac` | La baja tolera una base sin la 0307 (lecturas con `*`), pedido del Cerebro |
| `b6dd0a6be` | **#866 y #867, el cliente de una agencia**: al abrirle la cuenta, el link de Mercado Pago de su primer mes; pagarlo lo habilita solo; su mes corre desde que termina el onboarding, y ahí nace la suscripción mensual (`start_date`). Mig **0308** (columnas en `cobros`). Precio en `/admin/cobros`. API `ver_pagos_clientes_agencia` |
| `344503de7` | **#891**: «Quitar» una cuota se ve en el acto (la confirmación se cierra al confirmar, el renglón dice «Quitando…»). No falló la primera vez: tardó sin decir nada. **#890** verificado leyendo el ws1: es un DATO (la cuota 3 de Adrián Medina está sin cobrar), no un bug de General; su cierre está propuesto en /plan/revisar/propmvc7x28lhhqis |

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
   **Casos cargados en el ws3 el 17/10** (no había ningún ganado con cuotas ni suscripción): el lead **2739** «Francisco
   (prueba de Pagos)», US$6.000 con US$4.000 cobrados y dos cuotas vencidas, y el **2740** «Suscripción (prueba de
   Pagos)», US$800 por mes con un mes sin registrar. El lead abierto es el 2664.
4. **La T3 (Customer Success en bloques) va con el CRM, al final.** Al pasarla, se borran juntos DealDetailsCard,
   EditarDeal, `?edit=1`, «Completar con IA», `saveDealSectionsAction` y `saveCuotasAction`.
5. **`pagos-mexico-guarda` (a075e1ae5) NO se integra** hasta que Martín conteste `cobrar-mako-en-mexico` en la Ticketera.

Hechos y tachados: `PlantillaTab` (ya importa lib/ficha/plantillas-tab.ts) y el cast de `epico` (lo sacó el CRM, e92688cd2).
Queda un ajuste chico: marcar a mano una cuota cuyo link ya se pagó pero no se asentó cuenta la plata dos veces
(lib/pagos.ts, `cobrarCuota`; hallazgos-pagos.md §4).

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
| El cliente de agencia | `lib/agencia-cobro.ts` (link, renovación, lo que ve la agencia) · `lib/agencia-cobro-reglas.ts` (puro) · `lib/agencia-habilitar.ts` (el pago aprueba; el aviso que comparte con la firma del super admin) · `app/partners/PartnersApp.tsx` (lo que ve la agencia, en /partners desde el 17/10/2026) |
| Páginas públicas | `app/pagar/[token]`, `/listo`, `app/api/pagar/email`, `app/reembolsos`, `/terminos` §8 |
| API de MaKo | área `cobros` (`lib/api-mako/areas/cobros.*`, con `baja_del_cliente`) y `ver_pagos_clientes_agencia` en el área `cs` |
| Super admin | `/admin/cobros` (vender un plan, el precio del cliente de agencia, cada alta) |

## Lo que está QUIETO, y qué lo destraba

| Qué | Lo destraba | Dónde |
|---|---|---|
| Si `rk_` lee `GET /v1/account`; si la `notification_url` de MP llega firmada; si MP respeta el vencimiento de una preferencia anulada; `coverage_applied` de un contracargo de MP; el estado de una suscripción de MP al llegar su `end_date`; **que MP acepte `start_date` y no cobre al autorizar**; un pago de punta a punta | las claves de PRUEBA de Martín | `lib/cobros-conexion.ts`, `lib/mercadopago-api.ts`, `app/api/webhooks/mercadopago/route.ts` |
| Vender planes de MaKo a México | Martín, Ticketera `cobrar-mako-en-mexico`. Con la A, se integra `pagos-mexico-guarda` (a075e1ae5) | `lib/cobros.ts` (`crearCobro`), `lib/cobros-reglas.ts` |
| La garantía del programa grupal | Martín, Ticketera `garantia-grupal` | `app/reembolsos/page.tsx` |
| ~~Cortar el acceso a quien no paga~~ **Hecho el 17/10/2026 (B4)**: el cron de la pasarela pausa y reabre (lib/plan-acceso.ts) | — | docs/hallazgos-planes-y-cobro.md, «Quien deja de pagar deja de entrar» |

## Para que Martín lo use

1. Conectar la Stripe o la Mercado Pago **de MaKo** desde `/integraciones?ws=9` (con el `?ws=9`: si no, la clave queda en
   el workspace que esté mirando). En Mercado Pago, pegar en su panel la URL que muestra la tarjeta.
2. Vender un plan: `/admin/cobros` → «Vender un plan». El link es `hola-mako.com/pagar/<token>`.
3. Cliente de agencia: `/admin/cobros` → «Cliente de agencia», el monto en pesos de los US$47.
4. El aviso en el grupo: Automations → galería → «Aviso de pago recibido».
