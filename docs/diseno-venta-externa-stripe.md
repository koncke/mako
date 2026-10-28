# Una venta con el Stripe PROPIO del negocio entra como un cobro externo ya pagado, con su Purchase (DISEÑO, 24/10/2026)

> **Estado (28/10/2026): pasos 1 a 4 CONSTRUIDOS, con el interruptor `cobros.ventas_externas` APAGADO en todos los
> negocios** (chat «Zernio y CAPI», MAU-10). Lo que cambió respecto de este diseño, abajo en «Lo que cambió al construirlo».
> Faltan el paso 5 (prenderlo en el ws1: necesita el sí de Martín y conectar su Stripe) y el 6 (el script de recuperación).
>
> **Estado original: DISEÑO, sin construir.** Decisión del Cerebro (24/10/2026): no se toca antes del lanzamiento del 25/10, porque
> es el mismo webhook que cobra la suscripción de MaKo («cambiar plata futura por plata presente»). Se reparte después.
> El hallazgo que lo origina: docs/hallazgos-pagos.md, «Una venta con el Stripe PROPIO del negocio no entra a MaKo».
>
> Escrito por el chat «Landings de MaKo en Web Generator» (claude1) con un agente que diseñó y otro que lo intentó romper
> contra el código y la base (workflow `wf_d253310f-574`). Lo que el segundo refutó ya está corregido abajo. Las líneas son
> de `d674d633f`; las de AGENTS.md se citan por título.

## 0. Lo medido (24/10/2026, sólo lectura: base de producción, GETs a Stripe y `curl` sin JS)

- **Cobros:** 0 filas de `cobros` en TODA la base. Ningún negocio vendió todavía por la pasarela.
- **ws1 (Mauricio):** Stripe conectado en modo real (cuenta `principal`), con `META_PIXEL_ID` y sin `META_CRM_DATASET_ID`.
  Un Payment Link del «Sprint 3 días» (US$270, pago único) y 12 checkouts vencidos sin pagar.
- **ws10 (Leandro Tejado)** también tiene Stripe conectado (2 `checkout.session.expired`, 13 y 16/10). El interruptor
  apagado del §1 lo cubre, pero el diseño lo nombra.
- **ws9, la plataforma:** `cuentasDePago(9)` = []. Hoy la suscripción de MaKo no recibe nada por este webhook; el día que
  se conecte comparte la ruta y `procesarEventoStripe`. O sea: el camino de MaKo por acá todavía no corrió en producción.
- **El producto 54 «Sprint 3 días»** (US$270) tiene un vínculo de cobro → funnel 44, etapa `ganado`, cuenta `stripe:principal`.
  Ningún funnel del ws1 declara la entrada `carrito`.
- **Los 1050 leads sumados al Sprint** (lead_funnel del 44: 1028 en `lead`, 22 en `st0`) tienen email y teléfono; su casa
  es el funnel 1 (`leads.funnel_id` NULL = el de por defecto), `abierto` en `reactivacion`. Sólo 1 tiene `visitor_id`.
- **Secuencias activas y sin archivar del ws1:** 198 (etapa `lead`, f1), 213 (etapa `agenda`, f1) y 289 «Sprint · apertura»
  (etapa `st0`, f44). ⚠️ `post_pago` (id 12) está ARCHIVADA: a quien paga no le llega ninguna bienvenida (nutricion.ts:500).
- **La página de gracias** sólo carga `m.js` de MaKo: ningún `fbq` (curl 16:06 UTC). Hoy MaKo puede mandar el Purchase sin
  duplicar.

## 1. Dónde se bifurca, y por qué no puede tocar el cobro de MaKo

**Hoy:** route.ts:126 llama a `procesarEventoStripe` dentro de `runWithWorkspace`. `avisoStripe` da `aprobado` para un
`checkout.session.completed` pagado y para `async_payment_succeeded` (lib/cobros-eventos.ts:134-150). `cobroStripe`
(lib/cobros-webhook.ts:88-96) llama a `cobroDelAviso` (lib/cobros.ts:206-223) y, sin fila, devuelve
`{ ignorar: ignorado('no es un cobro de MaKo') }` (:90). Lo usan la rama de checkout (:122-123), la de factura (:142-143) y
las de baja, cargo y disputa (:163-223).

**El cambio (corregido):** `cobroStripe` SIGUE devolviendo `{ ignorar }` con `cobroId` null cuando no encontró ninguna fila, y
le SUMA `noEsDeMako: true`. ⚠️ Cambiar la forma de retorno rompe a todos los llamadores (`'ignorar' in b`) y el respaldo por
factura de `cobroDelPagoStripe` (:240-248), que es como se encuentran el reembolso y la disputa de una cuota de suscripción,
**también la de MaKo**. Sólo la rama de checkout con `accion === 'aprobado'` mira `noEsDeMako` y llama a
`ventaExternaStripe(ws, ev, key, csId, quien)`. Factura, baja, cargo, disputa y devolución siguen igual: cuando la fila exista,
la encuentran por `proveedor_ref`, `proveedor_suscripcion_id` o `proveedor_pago_id` (cobros.ts:214-216).

**La condición, pura** (`esVentaExterna`, nuevo lib/cobros-externos-reglas.ts, sin `server-only`). Las cinco a la vez:
1. `ws !== await wsSuperAdmin()`: en la plataforma, nunca (la suscripción de MaKo nace ahí: compra-plan.ts:202/216,
   vender-plan.ts:152, plan-deuda.ts:179, agencia-cobro.ts:74).
2. La sesión releída no trae metadata de MaKo (`mako_cobro`, `mako_ws`, `mako_cobro_id`, `mako`): todo checkout de MaKo la
   escribe (stripe-api.ts:235, :249-253; el único POST /v1/checkout/sessions del repo es stripe-api.ts:260). **No** se veta
   por la forma de `client_reference_id`: otra herramienta puede poner una referencia parecida, y si es un token real de un
   cobro del ws, `cobroDelAviso` ya lo encontró antes.
3. Trae `payment_link` = `plink_…`. En v1 sólo Payment Links (el caso medido).
4. `complete` + `paid`, y el `livemode` del evento existe y coincide con el de la sesión (el corte ya está en
   cobros-webhook.ts:114-117).
5. El interruptor del negocio `cobros.ventas_externas` está encendido. Apagado por defecto; es nuestro, no del usuario.

**Por qué no toca a MaKo:** se llega sólo cuando `cobroDelAviso` no encontró fila; nunca en la plataforma; la fila entra ya
`pagado`, así que `aplicarPagoAprobado` nunca la ve `nuevo` (cobros.ts:596-603) y no corre `programarPlazoStripe` (:639, el
único POST a Stripe de ese camino); `altaSiCorresponde` no hace nada (:933-937). ⚠️ **Y la fila externa no se reembolsa ni
se cancela desde MaKo sin decidirlo:** `reembolsarCobro` (cobros.ts:1342-1376) y `cancelarSuscripcionCobro` (:1394-1426) hacen
POST al Stripe del negocio desde la ficha y desde la API de MaKo. v1: cortados con `esCobroExterno`, con su test.

**Tests:** `tests/cobros-externos-reglas.test.ts` (la matriz: apagar cualquiera de las 5 da false; una sesión con la forma de
un checkout de MaKo da false aunque el ws no sea la plataforma). `tests/venta-externa-no-toca-mako.test.ts`, estructural (molde
de tests/cobros-webhook-rutas.test.ts): `cobroStripe` conserva `ignorar` y `cobroId` null; un `charge.refunded` de una cuota de
suscripción sigue encontrando su cobro por la factura; `ventaExternaStripe` sólo detrás de `noEsDeMako` en la rama de
checkout; `wsSuperAdmin` antes de la primera escritura; el módulo no importa `crearCheckoutStripe`, `programar*`,
`reembolsar*` ni `cancelar*`. Siguen verdes sin tocarlos: cobros-eventos, cobros-webhook-rutas, pagos-cobro-idempotente,
pasarela-sin-env.

## 2. El orden de la alta (corregido: se reclama la venta ANTES de crear el lead)

1. **INSERT del cobro ya `pagado` con `lead_id` null.** Reclama la venta por `cobros_ref_uk (proveedor, proveedor_ref)` con
   el `cs_` (0255:84). Así un segundo creador (el reintento, el script del §6) choca acá y no crea un segundo lead.
2. **Buscar, crear o atar el lead** y `update lead_id`.
3. **`aplicarPagoAprobado`** (idempotente).
4. **El Purchase** (§4).

Un 23505 relee la fila y sigue desde el primer paso que falte (`lead_id` null → paso 2). Ningún paso depende de haber
ganado el INSERT. ⚠️ `createLead` no es atómico (leads no tiene único por email, mig 0276): la carrera se evita reclamando la
venta primero, no con `esLeadDuplicado`.

## 3. El lead

⚠️ **El diagnóstico obvio («crear el lead y ganarlo») cubre el caso raro: el comprador más probable YA EXISTE** (los 1050).
Un pago de un producto vinculado a un CRM que no es la casa gana SÓLO en ese CRM (cobro-etapa-server.ts:416-421; :476
`ganaEnCasa: false`; una suscripción gana también en la casa, :439-441).

- **Búsqueda:** primero el email del checkout, después el teléfono. Hoy `leerCheckoutStripe` lee sólo el email
  (stripe-api.ts:281-302): hay que sumar `customer_details.phone` y `name`. `findLeadByContacto` busca primero por teléfono
  (leads.ts:1641-1644); para un pago, el email del recibo es la llave. Si dan dos leads distintos, gana el del email y queda
  dicho en el historial.
- **Si existe:** `enriquecerLead` (sólo lo vacío, leads.ts:1366) y una línea en el historial; el trato lo deciden
  `prepararTratoDelPago` y `ganarLead` (cobros.ts:650-712). Ya `ganado` → no hace nada (:886) y la cuota entra igual.
- **Si no existe:** `createLead` (no inscribe en secuencias, leads.ts:1015-1084) con `origen_lead: 'stripe'` (origen nuevo en
  app/crm/origen-lead.ts), el nombre del checkout o la parte local del email, y **casa = el CRM del vínculo del producto**
  (el 44 para el Sprint): el trato va por la casa (cobro-etapa-server.ts:416 → :500) y `ganarLead` lo gana en el mismo pedido.
  Sin vínculo: `funnelDeEntrada('carrito')`, y si no hay, el funnel del negocio.
- **CRM sin etapa de Ganado:** el cobro se registra IGUAL (pagado, con el lead) y el motivo lo dice. Nunca se descarta una
  venta cobrada.
- **Sin email ni teléfono:** el cobro pagado con `lead_id` null (0255:44 lo permite) y motivo «sin contacto»; sin Purchase
  (no hay identidad, meta-capi.ts:206-209).
- **No usar `ingresarDeFuente`** (fuentes-leads.ts:74-110): deja al comprador en la entrada sin ganarlo, a propósito (:18-20),
  y de ahí salen el «no agendaste» de T2 y la secuencia de WhatsApp.
- **La guardia «quien pagó no se mueve ni se reactiva solo»** (`yaPago(l)` = `total_cobrado_usd > 0`, lo cobrado en todos sus
  CRMs, lib/pagos.ts:1143-1166): va en T2 (junto a `quedaDondeLoPusieron`, crm-auto-plan.ts:214; T2 en :251-274 no mira pagos)
  y SÓLO en las cohortes de etapas de entrada o de nutrición. ⚠️ No en todo `etapa_actual` (nutricion.ts:1429): callaría
  secuencias legítimas de quien pagó (cobranza de cuotas, entrega). Hoy el riesgo es latente: ninguna secuencia activa del
  ws1 cuelga de `reactivacion` y T2 sólo mira `lead`/`nutri` de la casa (el motor lee `leads`, no `lead_funnel`,
  crm-auto.ts:94); ganar en el 44 saca al comprador de la 289.

## 4. La fila del cobro

**Quién inserta:** `registrarVentaExterna(ws, venta)` en lib/cobros.ts, que es el único que INSERTA cobros (otros módulos
hacen update: cobro-etapa-server, compra-plan, plan-deuda, retencion-plan, subir-plan, /api/pagar/email). Lo que decide va
en una función pura, `filaDeVentaExterna`.

**Entra ya `pagado`** (`pagado_at` = `ev.creado`). ⚠️ Un pendiente sería peor que nada: /pagar abriría un checkout de MaKo
para él (cobros.ts:563-567), lo tomaría `{{link_pago}}` (:226-235) y el cron nunca lo reconciliaría (:1587 exige
`referencia === token`). Ya pagado, /pagar da `ya_pagado` (:554) y el cron repara la cuota que falte (:1531-1535). Ojo: el
barrido de pagados (:1499-1502) toma la fila apenas existe y puede correr `aplicarPagoAprobado` en paralelo con el aviso:
por eso el paso 3 tiene que ser idempotente, y lo es.

**Columnas:**
- `token`: `nuevoTokenCobro()` (NOT NULL con forma, 0255:43). Nunca se manda a nadie.
- `modo` de `livemode`; `tipo` `suscripcion` si la sesión trae `subscription`; `concepto` = la descripción del ítem (1 a 200).
- `monto` y `moneda`: `amount_total` y `currency` de la sesión RELEÍDA (`deUnidadMinima`): lo que de verdad pagó.
- `monto_usd` (corregido): el monto si la moneda es USD. Si no, el USD de origen de la sesión (`currency_conversion`, con
  `source_currency` usd) — a verificar con el JSON real del ensayo del §7, porque con Adaptive Pricing un comprador de México
  en un link en USD llega en MXN. Si no viene: null y dicho (cobros.ts:684-687). ⚠️ **Nunca el precio del producto:**
  `montoUsdDelCobro` lo ignora a propósito (cobros-reglas.ts:21-29). Y sin USD no hay cuota, ni «Entró un pago», ni CRON
  «Pagos», ni `total_cobrado_usd` (o sea, ni la guardia del §3), ni reparación del cron (:1531 exige `monto_usd`).
- `producto_id`: `productoDeMako` (stripe-catalogo-reglas.ts:112-122) con el nombre del ítem y el monto de LISTA del precio
  (no `amount_total`: con descuento no da `mismoPrecio`). Da 54 sólo si el ítem se llama igual: medirlo en el ensayo.
- `proveedor_ref` = `cs_`; `proveedor_pago_id` = `pi_` en pago único, `in_` en suscripción (la regla de
  cobros-eventos.ts:237-242); `proveedor_suscripcion_id` = `sub_`.
- `cuenta` (corregido): **null si la cuenta que avisó es la `principal`**, o su sufijo `cN` (como cobros.ts:454-455).
  ⚠️ Escribir `'principal'` viola `cobros_cuenta_check` (0328:25): un 23514 no es transitorio, va 200 y la venta se pierde.
  `cuenta_ref` = el `acct` que la ruta validó. Sin la cuenta, sus reembolsos se ignoran «de otra cuenta»
  (cobros-webhook.ts:84-85).
- `email` (≤320) y `nombre` (≤200) de `customer_details`: los usan `avisarPagoRecibido` (cobros.ts:777) y la API.
- **La marca de externa, sin migración:** `creado_por = 'externo:stripe:<plink_…>'` (text sin check, 0255:74; ya está en
  COLS_COBRO, cobros-tipos.ts:73). Lo lee una sola función, `esCobroExterno(c)`.
- Restricciones que alcanzan: `monto > 0` (0255:53, una venta en cero se ignora con motivo) y `moneda` `^[A-Z]{3}$` (:54).
  Hay checks posteriores a mirar al implementarlo: 0326:60, 0330:26-29.

**Idempotencia:** por aviso, `pasarela_eventos (proveedor, evento_id)` (route.ts:115-121); por venta, `cobros_ref_uk` con el
`cs_`; por cuota, `pagos_proveedor_uk (workspace_id, proveedor, proveedor_pago_id)` (0255:119-120).

**Suscripción:** `checkout.session.completed` e `invoice.paid` `subscription_create` caen en la MISMA cuota (los dos usan el
`in_`, cobros-eventos.ts:124-129). Sólo el checkout CREA la fila; un `invoice.paid` de una suscripción sin fila sigue ignorado
con el motivo «primera factura de una suscripción externa: entra con su checkout». Cuando la fila existe, el `invoice.paid` la
encuentra por el `sub_` y la aplica como reentrega o renovación (`esRenovacion`, cobros-reglas.ts:228-230). Casos que v1 tiene
que cubrir o dejar en la alarma:
- ⚠️ una sesión de suscripción SIN `invoice`: hoy `confirmarCheckout` la rechaza (cobros-eventos.ts:237-240) y la venta se
  perdería entera → releer la suscripción (`latest_invoice`) en vez de ignorar;
- ⚠️ prueba gratis, cupón del 100% o `no_payment_required`: `avisoStripe` la ignora (:144) y la primera plata llega por un
  `subscription_cycle` sin fila → se registra aparte o queda en la alarma;
- una suscripción externa nunca es `nuevo`, así que no corre `reabrirSuscripcionDelLead` (cobros.ts:643), y `ganarLead`
  escribe `suscripcion_meses` = plazo (:892) mientras MaKo no programa el fin en ese Stripe: el MRR deja de contarla mientras
  Stripe sigue cobrando. Declararlo.

**Pago diferido (OXXO):** `completed` + `unpaid` ya se ignora (cobros-eventos.ts:140-143); la fila nace con
`async_payment_succeeded`; un `async_payment_failed` sin fila se ignora.

**Reembolsos y contracargos:** sin código nuevo; se encuentran por el `pi_` o la factura (cobros-webhook.ts:234-251). Un
reembolso no le avisa nada a Meta: el Purchase queda contado (riesgo residual).

## 5. El Purchase por CAPI

**Cuándo sale (corregido):** la venta es real (`modo 'real'` y `ev.livemode === true`), es el primer pago (no una
renovación: las renovaciones no se mandan hasta que se decida, porque inflarían el valor con el que Meta optimiza) y el
historial del lead NO tiene la línea fija «Meta recibió la compra (purchase:<id>)». Se manda en cada pasada (aviso, reintento,
reparación del cron dentro de los 7 días de CAPI) hasta que la línea esté: ⚠️ atarlo a «ganó el INSERT» lo pierde ante
cualquier error posterior (`TratoEnCursoError`, cobros.ts:653-661; los fallos del CRM, :697-701; el cron armando el trato en
paralelo). Meta deduplica por `event_id` dentro de las 48 h (meta-capi-payload.ts:151-155): repetir es seguro. El molde de la
marca durable es `LINEA_CALIFICADO_EN_META` (meta-capi-payload.ts:165).

**Dónde corre:** DESPUÉS de `aplicarPagoAprobado`, en `after()` con `runWithWorkspace`, best-effort y sin poder tirar. El
webhook de Stripe tiene 8 s (route.ts:51) y ahí corre el alta de la cuenta de MaKo: un fallo de Meta no puede dar 503 (Stripe
reintentaría 3 días). ⚠️ Fuera de `runWithWorkspace`, `credWs` resuelve a `WS_NINGUNO` (credenciales.ts:113-115) y el evento
sale `sin_pixel` sin rastro (meta-capi.ts:184-187).

> ⚠️ **CAMBIÓ (27/10/2026, lo decidió el Cerebro): el `eventId` es `purchase:<cs_>`, el id de la sesión de Checkout, NO
> `purchase:<pi_|in_>`.** La página de gracias sólo conoce el `cs_` (llega en `?session_id={CHECKOUT_SESSION_ID}`), y el Pixel
> de MaKo v28 manda desde el navegador el Purchase con ese mismo id: así Meta deduplica el del navegador con el del servidor
> en vez de prohibir uno de los dos (lo que este párrafo pedía abajo, en «No duplicar con el navegador»). Una suscripción no
> duplica: el Purchase sale sólo de la rama de checkout, nunca del `invoice.paid`. Vive en `eventIdCompra` y
> `compraDeLaSesion` (lib/meta-capi-payload.ts). La marca durable es `lineaCompraEnMeta` (lib/cobros-externos-reglas.ts).

**Payload (original):** `eventName 'Purchase'`; `eventId` = `'purchase:' + proveedorPagoId` (`pi_` o `in_`: uno solo por primer pago,
llegue primero el evento que llegue; sin email, a diferencia del de Schedule); email y teléfono del checkout, hasheados
(meta-capi.ts:111-127); `metaLeadId` si el lead vino de un formulario de Meta; `eventTime = ev.creado`;
`actionSource 'website'`; `eventSourceUrl` = el `success_url` sin query; `externalId` = el `visitor_id` si la visita llegó
(§6); `customData { value: monto, currency: moneda, content_name: concepto, order_id: proveedorPagoId }`.

**Destino: el píxel del SITIO, nunca el conjunto de datos de CRM.** Hoy `destinoYToken` prefiere el dataset
(meta-capi.ts:153, meta-capi-payload.ts:221-225) → parámetro nuevo `destino: 'pixel'`. Hoy ningún ws tiene
`META_CRM_DATASET_ID` en la base, pero el ws1 cae a `process.env` (credenciales.ts:157, :173): uno cargado en Vercel lo
desviaría.

**Que no se descarte en silencio:** `credWsEstricta('META_PIXEL_ID', ws)` antes de mandar (molde de meta-capi.ts:174-178:
«no pude leer» no es «no tiene»). Todo resultado se escribe: si entró, la línea fija; cualquier `!ok` (incluidos
`sin_pixel`, `sin_token` y `sin_identidad`, que Calendly no anota, calendly/route.ts:629) va al historial y al motivo de
`pasarela_eventos`. Nunca tira: la plata ya está asentada. Sumar `AbortSignal.timeout` al `fetch` de meta-capi.ts:241 cambia
a TODOS sus llamadores (Calendly, meta-leads, zernio, calificado): un envío lento que Meta sí recibió pasa a `red`. Va
declarado y con test.

**No duplicar con el navegador** (AGENTS.md, «SI LA PÁGINA YA MANDA UN EVENTO DESDE EL NAVEGADOR…»): con
`purchase:<pi_|in_>` la página de gracias no puede compartir el id (sólo conoce el `cs_`). En v1: si la página manda el
Purchase (lo detecta o lo declara, ver docs/diseno-eventos-meta-por-funnel.md §2), MaKo no lo manda y lo dice en el
historial. Compartirlo exigiría pasar a `purchase:<cs_>` buscando el `cs_` de la factura: lo decide el Cerebro, no quien lo
implemente.

## 6. Unir la compra con la visita

- **Paso de Mauricio (en su panel, no por API: sería un POST a su cuenta):** el redirect del Payment Link a
  `…/gracias.html?session_id={CHECKOUT_SESSION_ID}`. El Pixel guarda la URL entera (landing-token.ts:1551 →
  track/vsl/route.ts:346, hasta 500 caracteres).
- **El camino que sirve es el del pageview:** si `landing_url` trae `session_id=cs_(live|test)_…`, buscar el cobro de ese ws
  por `proveedor_ref` y completar el `visitor_id` del lead (sólo si está vacío; un `cs_` no se adivina). Una línea «Tracking»
  en el historial. La búsqueda inversa (el aviso buscando la visita con un `ilike`) casi siempre vuelve vacía —Stripe redirige
  DESPUÉS del aviso— y es un barrido entero de `landing_visits` por venta: no va.
- **Y el sitio de Mauricio ya está listo para algo mejor:** su `assets/landing-jan.js` copia `client_reference_id` y los
  `utm_*` del query de la página a cada link `[data-stripe]` (medido 24/10). Si el link que se manda lleva el visitante, la
  sesión llega atribuida.
- No viaja: `fbp`/`fbc` (`CAPIEventParams` no los tiene, meta-capi.ts:41-71).

## 7. Plan de salida, en orden (cada paso sube solo; hasta el 5 todo se comporta igual que hoy)

0. **Sin código, ya:** una alarma diaria de sólo lectura: una fila de `pasarela_eventos` `checkout.session.completed` o
   `async_payment_succeeded` con motivo «no es un cobro de MaKo» es una venta perdida. Que mire también los motivos nuevos
   (sin contacto, CRM sin Ganado, monto 0, interruptor apagado, primera factura externa, `no_payment_required`). Y pedirle a
   Mauricio el `{CHECKOUT_SESSION_ID}` (§6).
1. **El lector y las reglas puras:** `leerCheckoutExternoStripe` (GET con `expand[]=line_items`: `customer_details`,
   `payment_link`, `success_url`, el ítem, `livemode`, `currency_conversion`) y lib/cobros-externos-reglas.ts.
   `tests/stripe-api.test.ts`: la forma de una sesión de Payment Link (27000 → 270; una moneda sin centavos; el teléfono; sin
   `line_items` → error, no un concepto inventado). `tests/cobros-externos-reglas.test.ts`: §1 y `filaDeVentaExterna` (cero →
   ignora; `in_`/`pi_`; concepto ≤ 200; `cuenta` null en la principal; `creado_por` externo; `eventIdPurchase`).
2. **La guardia del §3:** `tests/crm-auto-plan.test.ts`: un lead `abierto` en `lead`, sin agenda, con `total_cobrado_usd` 270
   → T2 no propone nada; con 0, sí. Y que la guardia no alcance a las cohortes de cobranza ni de entrega.
3. **El Purchase:** `destino: 'pixel'`, la marca durable, el tope del `fetch` declarado, `purchaseDeVenta` (puro).
   `tests/meta-capi-purchase.test.ts`: con dataset y píxel, va al píxel; `value`/`currency` reales; `event_id` sin `@`; en prueba
   o en renovación no sale; con la línea fija ya escrita, no sale; ajustar tests/calificacion-adonde-va.test.ts:34-35, que hoy
   exige un solo `destinoYToken`.
4. **El escritor y la rama, con el interruptor apagado en todos:** `registrarVentaExterna` + `ventaExternaStripe`.
   `tests/venta-externa-no-toca-mako.test.ts` (§1) y `tests/venta-externa.test.ts` + `tests/_venta-externa-hijo.ts` sobre
   tests/_postgrest-de-mentira.ts, en el ws 3, con `fetch` de mentira para Stripe y Meta: (a) Payment Link pagado → 1 cobro
   externo `pagado`, 1 lead con casa = el CRM del vínculo, 1 cuota, lead `ganado`, 1 POST `purchase:pi_…`; (b) la misma venta
   otra vez (`invoice.paid`, cron, script) → 0 filas y 0 POST; (c) un lead que ya existe por email → 0 leads nuevos, gana en el
   CRM del vínculo; (d) `charge.refunded` → `reembolsado`; (e) `mako_cobro` sin fila → 0 escrituras; (f) ws = plataforma → 0;
   (g) `livemode false` → prueba y 0 POST; (h) sin píxel → 0 POST y la línea en el historial; (i) cuenta principal → `cuenta`
   null y el INSERT pasa; (j) reembolsar o cancelar un cobro externo desde MaKo → rechazado. Probado rompiéndolo: cada guardia
   sacada, de a una, da rojo.
5. **Encenderlo para el ws1.**
6. **La recuperación:** `scripts/recuperar-ventas-externas.mts`: GET `/v1/checkout/sessions?payment_link=plink_…&status=complete`
   y cada sesión por `ventaExternaStripe`, **adentro de `runWithWorkspace(ws)`** (sin eso, `getTenantDb` y `logLeadEvent` caen
   al ws1 —cobros.ts:19-20— y para otro negocio escribiría en el CRM de Mauricio). Idempotente por el `cs_`. Hace falta porque
   un aviso ya ignorado no vuelve: el reintento de Stripe trae el mismo `evt_` y `reclamarEvento` lo da por duplicado
   (pasarela-eventos.ts:65). Con más de 7 días, el Purchase entra recortado y declarado (meta-capi-payload.ts:63-73).

**Cómo se prueba sin modo prueba** (el ws1 sólo tiene `sk_live` y su aviso está en real): la integración del paso 4 no sale a
la red; un **ensayo de sólo lectura** del lector + `esVentaExterna` sobre los 12 checkouts vencidos reales (GETs, quedan en
los Logs de su Stripe; tiene que decir «no pagada» en los 12 y mostrar la forma leída sin datos personales, incluidos
`currency_conversion` y el nombre del ítem); de punta a punta en el ws 3 con una cuenta de Stripe en PRUEBA (sk_test, un
Payment Link de prueba, la tarjeta 4242), donde la fila queda en prueba y no sale Purchase. Para mirar un Purchase con Test
Events hace falta `test_event_code` (hoy `sendMetaCAPIEvent` no lo manda, meta-capi.ts:244-247): o se habilita para el ensayo
con una excepción explícita, o la primera venta real se mira en vivo (la fila de `pasarela_eventos` en `procesado`, el cobro
externo, la cuota, el lead en `ganado` en el 44, la línea «Meta recibió la compra» y el Purchase de servidor en el
Administrador de eventos).

**Riesgo residual:** la primera sesión real pagada de un Payment Link es la primera en producción. Entre `createLead` y
`ganarLead` hay milisegundos en los que el barrido horario de `etapa_actual` puede tomar a un lead nuevo en su entrada
(nutricion.ts:1429): la casa 44 no tiene secuencia en `lead` (medido) y el funnel 1 sí (198). Si `ganarLead` falla, lo dice el
`motivo` (cobros.ts:905-909) y la guardia del §3 evita el «no agendaste». Un evento `website` sin `client_user_agent` puede
perder calidad (no medido). Si alguien pega `fbq('track','Purchase')` en gracias.html sin que MaKo lo detecte, Meta cuenta
doble. Una suscripción creada sin Checkout (factura a mano) no entra en v1. Un reembolso no se le avisa a Meta.

**Sin hacer (dónde vive):** la red del cron para ventas externas (`reconciliarCobros` sólo mira filas que ya existen,
cobros.ts:1492-1551); checkouts sin Payment Link (condición 3, lib/cobros-externos-reglas.ts); el Purchase para los cobros de
MaKo (en `aplicarPagoAprobado`, con `ws !== plataforma`); Mercado Pago, con el mismo agujero (cobros-webhook.ts:334-335); las
secuencias de la casa de un lead que ganó sólo en un CRM agregado (nutricion.ts:1429); y que a quien paga le llegue una
bienvenida: la `post_pago` del ws1 está archivada.

## 8. Lo que cambió al construirlo (27-28/10/2026, chat «Zernio y CAPI», MAU-10)

- **El `event_id` es `purchase:<cs_>`** (ver §5): lo decidió el Cerebro para deduplicar con el Purchase del navegador.
- **La puerta del webhook deja pasar también un cobro EXTERNO que ya existe** (`esCobroExterno`), no sólo «no hay cobro».
  ⚠️ Este diseño suponía que el reintento de un aviso cortado entre el INSERT y el lead llegaba a `registrarVentaExterna`
  y seguía desde el paso que faltaba (§2). No llegaba: `cobroStripe` encuentra la fila por el `cs_` y la mandaba por el
  camino de los cobros de MaKo, que decía «ya estaba pagado» y dejaba la venta sin lead, sin cuota y sin la compra a Meta
  para siempre. Lo mostró tests/venta-externa.test.ts (caso «un aviso cortado…»), en rojo antes del arreglo.
- **El Purchase no se reintenta solo:** sale una vez, después de asentar la plata, y con lead queda la línea fija o la de
  «Meta no recibió la compra (…)». Un fallo de Meta en el primer aviso no vuelve (Stripe recibió 200). Ni `eventSourceUrl`
  (el `success_url`) ni `externalId` (el `visitor_id`) viajan todavía. **Desde el 28/10:** si la venta se cortó antes de la
  compra (en la cuota, por ejemplo) y el cron la repara, el cron manda la compra que faltó (`compraExternaQueFalto`,
  lib/cobros-externos-meta.ts), una vez por venta.
- ⚠️ **§1 suponía mal que «si es un token real, `cobroDelAviso` ya lo encontró» era seguro** (la verificación de 3ca2d8328,
  28/10): el token es público y un Payment Link acepta `?client_reference_id=<token>`, y una venta de US$1 marcaba pagado un
  cobro de MaKo de US$1.500. La rama de MaKo exige ahora que la sesión sea la del cobro (`sesionDelCobro`,
  lib/cobros-eventos.ts: la metadata `mako_cobro`, sin Payment Link, el mismo monto o el de origen); si no lo es, va a la venta
  externa. Y el «otro aviso la está registrando» del §2 va con status 503: sin él la ruta contestaba 200 y Stripe no volvía.
- **Apagado, la compra a Meta sale igual** (sin lead ni cobro): es lo que hacía 749086da2 antes de esto.
- **Cómo se probó sin modo prueba:** tests/venta-externa.test.ts corre `procesarEventoStripe` REAL sobre la base, Stripe y
  Meta de mentira (los casos a–j del paso 4, más el corte a mitad y una suscripción). El ensayo de sólo lectura sobre los
  checkouts reales del ws1 y la prueba en el ws 3 con `sk_test` NO se hicieron: no hay claves de prueba de Stripe en el
  proyecto.
- **Sin hacer, además de lo de arriba:** el paso 6 (`scripts/recuperar-ventas-externas.mts`), unir la compra con la visita
  por el `session_id` del pageview (§6), y que el reintento de una venta ya reclamada se complete aunque el interruptor se
  haya apagado en el medio (hoy se ignora con la compra a Meta, y la fila queda pagada sin lead).
