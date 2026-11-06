# Cómo se muestra una suscripción en la ficha de un cliente

> 5/11/2026. Lo pidió Martín: «la pestaña de pagos dentro de lo que sería una venta de suscripción es algo que quisiera
> cambiarlo completamente. Sería muy bueno que puedas investigar cómo lo hacen otras personas, cómo lo hacen otras
> aplicaciones… Y quiero que hagas una investigación completa de cómo hacerlo». El encargo:
> docs/relevo/suscripciones-ficha-encargo.md. Lo que se construyó: la tab Pagos de una suscripción, mes a mes
> (`app/crm/lead-view/ficha/pagos/suscripcion.tsx`, `lib/suscripcion-meses.ts`).

## En corto

- **Copiamos Chargebee.** Es la única de las diez que trata como normal lo que hace Martín: registrar a mano un pago por
  transferencia o Binance, con su medio y su referencia, y varios pagos parciales en un mismo período.
- **De ChartMogul tomamos sólo las palabras** de lo que se mueve: empezó, subió, bajó, se cortó y volvió.
- **El problema del CRM no era la pantalla: era el modelo.** Una suscripción era UN monto y cada pago contaba un mes.
  Código Inmobiliario pagó noviembre en dos pagos y el CRM lo daba por adelantado; su monto de octubre y el de
  diciembre no se podían guardar; su monto vacío daba MRR 0.
- **Lo nuevo:** cada mes con lo que tocaba y lo que entró. El monto cambia desde un mes sin reescribir los de antes. Una
  suscripción se corta y se retoma, y un ajuste (el diferencial) suma a lo cobrado sin pagar un mes.

## Cómo se miró

Desde la sesión de la nube no se puede entrar a estas apps (piden cuenta) y la red de la sesión no deja abrir sus
sitios (`chargebee.com`, `docs.stripe.com` y `chartmogul.com` no resuelven). **Lo de abajo sale de la documentación
oficial de cada una**, leída por el buscador, con su enlace. No hay capturas propias. Lo que no se pudo confirmar en una
página se dice.

## Las diez, una por una

| App | Qué muestra primero | Cómo cambia el monto | Cortar y retomar | La historia | Un pago a mano |
|---|---|---|---|---|---|
| **Chargebee** | Estado, plan, próximo cobro y MRR; abajo facturas, transacciones y línea de tiempo (no confirmado en una página) | «Change subscription»: ahora, al renovar o en una fecha | Pausa desde ahora o desde la renovación, hasta una fecha o sin fecha; el ciclo no se mueve. Cancelar y reactivar | Una factura por período, con sus pagos | **«Record payment»: monto, método (transferencia, cheque…) y número de referencia. Varios pagos parciales a una misma factura** |
| **Stripe** | Estado, precio, período y próxima factura; facturas, pagos y eventos (no confirmado) | «Update subscription» y, para una fecha, *subscription schedules* con fases | «Pause payment collection», con fecha de vuelta opcional | Facturas y eventos | «Marcar como pagada fuera de Stripe», sin método ni referencia |
| **Recurly** | No confirmado | Ahora, en la próxima fecha o al terminar el plazo; un cambio pendiente a la vez | Pausa por N ciclos desde la renovación; se reanuda desde el menú | No confirmado | No confirmado |
| **Paddle** | No confirmado | Un «cambio programado» que se puede quitar; prorrateo elegible | Pausar y cancelar al fin del período o ya | No confirmado | No existe: Paddle cobra por el negocio |
| **Whop** | Miembros y membresías | No confirmado | Pausar pagos; cancelar deja el acceso hasta la próxima fecha; reactivar | No confirmado | No confirmado |
| **Kajabi** | No confirmado | No confirmado | Pausa sin fecha o hasta una fecha; cancelar corta el acceso ya | Transacciones: recibos, devoluciones y reintentos | No confirmado |
| **ThriveCart** | No confirmado | No confirmado | Pausa sin fecha o por N cobros; retomar crea otra suscripción y cobra en el acto | No confirmado | No confirmado |
| **HubSpot** | La suscripción desde el contacto, la empresa o el negocio: activa, impaga, programada o pausada | Editar productos, fechas y medio de pago, con prorrateo | Cancelar ya, al fin del plazo o con devolución | No confirmado | No existe (sólo con sus pagos o Stripe) |
| **ChartMogul** | Estado del cliente, MRR, ARR y lo que pagó en total | — (sólo lee) | — | **Los movimientos del MRR: New Business, Expansion, Contraction, Churn, Reactivation** | — |
| **Baremetrics** | No encontrado | — | — | Los mismos cinco movimientos | — |

Enlaces (documentación oficial):

- Chargebee: [pausar](https://www.chargebee.com/docs/billing/2.0/subscriptions/pause-subscription) ·
  [registrar un pago a mano](https://support.chargebee.com/support/solutions/articles/257270-how-to-record-offline-or-manual-payments-for-an-invoice-) ·
  [pagos parciales](https://www.chargebee.com/docs/billing/2.0/kb/billing/how-to-make-partial-payments-in-an-invoice)
- Stripe: [pausar el cobro](https://docs.stripe.com/billing/subscriptions/pause-payment) ·
  [pausas programadas](https://docs.stripe.com/billing/subscriptions/pause/schedules)
- Recurly: [cambiar](https://docs.recurly.com/docs/change-subscription) · [pausar](https://docs.recurly.com/docs/pause-subscription)
- Paddle: [pausar](https://developer.paddle.com/build/subscriptions/pause-subscriptions) ·
  [cambios programados](https://developer.paddle.com/changelog/2025/update-subscriptions-scheduled-change/)
- Whop: [usuarios](https://docs.whop.com/manage-your-business/manage-payments/manage-users)
- Kajabi: [pausar](https://help.kajabi.com/articles/contacts/manage-your-contacts/pause-your-customers-subscription-or-payment-plan) ·
  [suscripciones](https://help.kajabi.com/en/articles/17174608-set-up-view-and-manage-subscriptions)
- ThriveCart: [cancelar](https://support.thrivecart.com/help/cancelling-customer-subscriptions) ·
  [portal del cliente](https://support.thrivecart.com/help/what-is-the-customer-hub)
- HubSpot: [manejar suscripciones](https://knowledge.hubspot.com/subscriptions/manage-subscriptions)
- ChartMogul: [movimientos del MRR](https://help.chartmogul.com/hc/en-us/articles/4416682609426) ·
  [vida de una suscripción](https://help.chartmogul.com/hc/en-us/articles/201244842)

## Lo que ya tenía el repo para suscripciones

- **Los dashboards:** la fuente `suscripciones` (`lib/graficos-fuentes-extra.ts`) da el MRR y cuántas están activas, con
  `getMrrActivo`. Las plantillas Cobranza, CS Analyst y Servicio se sugieren a quien cobra una suscripción
  (`lib/graficos-plantillas-etiquetas.ts`). Ningún mockup de `docs/diseno/mockups-dashboard/` muestra una suscripción por
  cliente: son hojas del negocio entero. **No había nada que copiar para la ficha.**
- **La ficha:** el bloque `suscripcion` (un número, el plazo, cancelar y reactivar) al lado del estado de cuenta, las
  cuotas, los movimientos y la venta. Cinco bloques para una mensualidad: lo «muy complejo» que dijo Martín.

## Las fallas del CRM, caso por caso

Medido en producción el 5/11/2026 por el Cerebro (el encargo), y corrido con la cuenta de antes (`cobradoDelLead`) en los
tests de `tests/suscripcion-meses.test.ts`.

1. **Código Inmobiliario: el monto cambia mes a mes (146, 238, 426).** Había un solo monto para todos los meses.
   Cambiarlo reescribía octubre. **Ahora:** «Cambiar el monto» desde un mes, y los de antes quedan como estaban (la
   primera vez se guarda el de antes).
2. **Código: noviembre en dos pagos (94 y 144).** Cada pago registrado contaba un mes: dos pagos eran «noviembre y
   diciembre», y el CRM decía que estaba adelantado. **Ahora:** al registrar se elige el mes que paga. Sin elegirlo, va
   al más viejo que falta, y un mes con la mitad dice «Parcial · falta 144».
3. **Código: pagó por Binance y quedó como transferencia.** No había cómo decirlo. **Ahora:** el medio «Cripto
   (Binance, USDT)».
4. **Código: lo de noviembre no está cargado.** `total_cobrado_usd` sigue en 146. Es un dato: lo carga el Cerebro
   (docs/relevo/nube-suscripciones.md).
5. **Los tres clientes de la plataforma (Leila, Juanfran, Florencia) tienen la mensualidad vacía.** El MRR sumaba ese
   campo y daba 0 con pagos hechos. **Ahora:** sin monto, el MRR y la ficha usan lo pagado el último mes, y lo dicen
   («Estimado»). La ficha ofrece «Cargarla».
6. **El diferencial de un cliente nuevo (sus días hasta el próximo 5).** Contaba como un mes más. **Ahora:** es un
   «ajuste»: suma a lo cobrado y no paga ningún mes.
7. **El que se corta y vuelve.** Cancelar y reactivar pisaba la fecha: la historia se perdía y los meses del corte no
   se distinguían de los impagos. **Ahora:** «Cortar» desde un mes y «Retomar» desde otro, con otro monto si vuelve
   distinto. Los meses del corte se ven cortados y no se deben.
8. **El que baja el plan.** Igual que 1: bajar reescribía los meses de antes y escondía deuda. **Ahora:** «Bajó de 500»
   en el mes en que bajó.
9. **El que paga tarde.** Un pago del 2/11 por octubre caía en noviembre. **Ahora:** va al mes más viejo que falta (como
   se aplica un pago a la factura más vieja) o al que se elige.
10. **El que paga siempre lo mismo.** Andaba, y sigue igual: sin cambios guardados, una mensualidad registrada vale un
    mes, como decidió la casa en la quinta revisión de Pagos (docs/hallazgos-pagos.md).

## Lo que agregó la medición del Cerebro

`docs/relevo/suscripciones-medicion.md` (5/11/2026, sólo lectura en producción) llegó con el modelo ya escrito. No
cambia el diseño: confirma las fallas de arriba y suma cinco. Lo que hace cada una con lo construido:

- **Hay 15 suscripciones en toda la base, y ninguna con más de un pago.** «Sube, baja, dos pagos en el mes» todavía no
  existe en la base: es el caso de Código, que no está cargado. Por eso los tests arman ese caso a mano, y lo que ya está
  (un pago por suscripción) se cuenta igual que antes.
- **El próximo cobro sale de la fecha de cierre, y la de los tres clientes de la plataforma es la de carga (26/10).** El
  día de cobro sigue saliendo de ahí si nadie lo cambia. «Cambiar el monto» acepta el día (el 5 de Código) y el relevo
  pide corregir las tres fechas de cierre.
- **«Cambiar el plan» de Cuotas convertía la suscripción en pago único.** Con el bloque nuevo en la hoja, Cuotas se calla
  en una suscripción. Pasar a pago único es un botón propio del admin, con su nombre.
- **El MRR exige estar en Ganado, y el 88 % del MRR del negocio 11 es un pago único guardado como suscripción.** No se
  tocó: decidir qué cuenta como MRR es de la tab Admin, y reclasificar esa venta es un dato del negocio. Va en
  `docs/relevo/nube-suscripciones.md`.
- **Una cuota suelta impaga dentro de una suscripción** (negocio 11). El mes de una cuota es el de su vencimiento; un
  pago que no la cubre deja ese mes «Vencido», y la cuota sigue en Cuotas para quien no tenga el bloque nuevo.
- **Ningún pago tiene moneda y casi ninguno tiene método.** Lo nuevo los pide en el mismo paso; no se rellenan los de antes.

## La que copiamos y por qué

**Chargebee**, la página de una suscripción:

- **Su unidad es el período, y un período junta sus pagos.** Es lo único que resuelve «noviembre en dos pagos» sin
  inventar un mes. Stripe y HubSpot suponen que la tarjeta cobra sola. Paddle ni siquiera deja registrar un pago.
- **El pago a mano es un camino normal**, con el medio y la referencia. Es el caso de casi todas las suscripciones del
  CRM (transferencia, Binance, efectivo).
- **El cambio de monto tiene fecha**, y cortar y retomar también. Eso es «suben, bajan, se cortan».

Lo que NO copiamos:

- **Las facturas:** el CRM no emite facturas por mes. El período es el mes, con lo que tocaba y lo que entró.
- **El prorrateo automático:** el diferencial de Código lo calcula Martín y se registra como ajuste. Calcularlo solo es
  otra decisión.
- **«Pausar» aparte de «cancelar»:** para una suscripción que se cobra a mano son lo mismo. «Cortar» y «Retomar» cubren
  las dos.

De **ChartMogul**, las cinco palabras en el mes en que pasan: «Empezó», «Subió de 146», «Bajó de 500», «Se cortó» y
«Volvió». Es como Baremetrics y ChartMogul cuentan el MRR, y se lee sin explicar nada.

## Cómo quedó la pantalla

Arriba, cuatro números: **Paga hoy** (con el día de cobro), **Le toca** (o «Venció», en rojo), **Pagó en total** y,
si debe, **Debe**. Al lado del título, el estado: «Al día», «Debe 1 mes», «Cortada desde diciembre». Abajo, **Mes a
mes**, del más nuevo al más viejo: el mes y su vencimiento, «US$238 de US$238», lo que cambió, una barra, «2 pagos ·
Cripto» y el estado. Un clic abre los pagos del mes, con su comprobante. Los meses cortados seguidos van en un
renglón.

Las acciones: **Registrar un pago** (primero qué paga: el mes o un ajuste; después cuánto, cuándo, cómo y el
comprobante), **Cambiar el monto**, **Cortar** o **Retomar** (estas tres, el admin). Todo con Deshacer.

En una venta de suscripción, este bloque es la tab entera: el estado de cuenta, las cuotas, los movimientos y la venta
se callan (`suscripcionAlLado`, app/crm/lead-view/ficha/reglas-pagos.ts). El pago único y el plan por tramos siguen
como estaban.
