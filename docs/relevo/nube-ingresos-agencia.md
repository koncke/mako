# Relevo — Admin › Revenue lee el libro de la mensualidad de las agencias (nube, 10/11/2026)

> Sesión de la nube `cli_64315a72-4021-5d70-a2c0-b9952e7a27a5` (cuenta `nube`), en la punta `punta/ingresos-agencia`. El encargo,
> con lo medido en producción por el Cerebro: [encargos-admin-10-11.md](encargos-admin-10-11.md) → «Encargo 1». Lo aprendido, en
> [hallazgos-planes-y-cobro.md](../hallazgos-planes-y-cobro.md) → «Revenue no veía lo que una agencia paga por su LIBRO». El pedido de
> Martín, textual, en la bitácora del área (app/admin/dev/admin/bitacora.ts).

## El pedido

Martín, 10/11/2026: «Todo eso debería estar en admin, y por ejemplo, recibimos un pago de Código por el cliente de Patricia y no se
cargó automáticamente en admin eso». El encargo: que Admin › Revenue (y Customers, que usa la misma lectura) muestre solos los pagos
que entran por el libro de la mensualidad de las agencias, sin que nadie los cargue a mano.

## Qué quedó (commit `4840e901`)

**El diseño preferido del encargo, no la alternativa.** `lib/admin-ingresos.ts` lee el libro como TERCERA fuente, al leer y sin escribir
en `pagos`. Con el despliegue, la entrada de Patricia aparece sola, y desde diciembre la mensualidad de Código también.

- **De dónde:** todas las filas `agencia.mensualidad.*` de `app_settings` de la plataforma, paginadas (`leerTodo`), y los cobros de
  Binance de los recibos (`recibo_pagos`) para saber qué órdenes ya están en el CRM.
- **Qué es cada orden** (`lib/admin-ingresos-libro.ts`, puro):
  - un pago de la AGENCIA (`ws:<ag>`), por lo RECIBIDO (`montoUsd`: 40, no 40,73), con el día que anota el libro;
  - lo aplicado a `mes:*` es MRR (suscripción `agencia:<ag>`), lo aplicado a `entrada:*` es cash;
  - una orden repartida se parte según `aplicado`, y las partes suman exacto lo recibido;
  - su id es `a:<ag>:<orden>:<clave>` y su concepto, «Entrada de <cliente>» o «Mensualidad de <mes> <año>».
- **Una vez:** una orden con su recibo atado a un pago del CRM (`recibo_pagos.pago_id`, mig 0408) la cuenta ese pago y el libro la
  saltea. La comparación usa la referencia normalizada de los recibos (`claveDelCobro`).
- **La mensualidad del libro reemplaza a la del CRM** (`conElLibro`, lib/admin-ingresos-reglas.ts). Hasta noviembre la de Código se
  cargó en el CRM (`es_mensualidad`); desde que el libro cobra un mes, la suscripción del CRM termina ese día:
  - el MRR no suma las dos;
  - sale UN movimiento (238 → 300), no un «Se cortó» y un «Volvió»;
  - «Por cobrar» no le reclama a la historia del CRM lo que se pagó por el libro;
  - si el libro se apaga y la mensualidad vuelve al CRM, el CRM vuelve a contar.
- **Sin cero escondido:**
  - si el libro no se lee, sale «Puede faltar algo — No pude leer los pagos de las agencias por su mensualidad: …»;
  - si no se pueden leer los recibos, tampoco se cuenta el libro (contaría dos veces), y se dice;
  - un mes marcado pagado a mano sin orden no suma y se avisa.
- **Una cosa, un lugar:** el lector de una orden (`leerOrden`, `OrdenAnotada`) pasó de lib/agencia-mes.ts a lib/agencia-mes-reglas.ts:
  lo usan el libro y Revenue. lib/agencia-mes.ts lo re-exporta igual.

**Por qué no la alternativa** (que `aplicarPagoDeAgencia` escriba el `pagos`): leer cubre lo pasado y lo que viene sin cargar nada, y no
abre un segundo camino de escritura de plata. Además, medido en el hijo del test: un pago que no es la mensualidad (la entrada de 40) en
la casa del lead de Código sube la mensualidad que infiere la historia del CRM, y el MRR pasa de 238 a 278. Escribir cada entrada en
`pagos` habría inflado el MRR de la agencia.

## Pruebas

`tests/admin-ingresos-libro.test.ts`, 14 casos: las reglas puras y el lector REAL (`vistaDeIngresos`) sobre un PostgREST de mentira
(`tests/_admin-ingresos-libro-hijo.ts`), con los montos y la orden medidos:
- Patricia es US$40 de cash de la agencia 13, sin MRR; noviembre cobrado 278 (94 + 144 + 40); el total de la agencia, 424;
- diciembre pagado por el libro (300) es el MRR, sin contar el del CRM, con un solo «sube 62»;
- la orden atada a un pago del CRM entra una vez; el recibo sin atar no la ata;
- con el libro o los recibos caídos, un aviso;
- Customers (Top Customers) da 424 para la agencia;
- el lector no escribe ni en `pagos` ni en el libro.

**Probado rompiéndolo:** 13 roturas, las 13 en rojo, y 0 fallos con todo puesto (el detalle, arriba del test). Siguen en verde
`tests/admin-ingresos.test.ts`, `tests/agencia-mes.test.ts`, `tests/pedidos-ingreso.test.ts` y `tests/admin-polar-ventas.test.ts`
(88 casos), y los tipos de lo tocado dan 0 errores.

## Para el Cerebro (la verificación en producción)

1. Con el despliegue en «Ready», abrir Admin › Overview / Revenue: en noviembre tiene que aparecer un pago de **US$ 40** del 9/11 de
   Código, «Entrada de <la cuenta de Patricia>», como cash (no MRR). El MRR de Código no cambia (238).
2. Customers › Top Customers: el total de Código sube US$ 40.
3. Si arriba sale «Puede faltar algo», leer el motivo: el libro o los recibos no se leyeron.
4. En diciembre, cuando Código pague por el libro, el MRR tiene que ser el de su mes, no el de su mes más 238.

## Lo que quedó afuera, medido (decide quien lleve Sales, o Martín)

- **Sales › Subscriptions sigue leyendo la historia del CRM** (`suscripcionesDeLaPlataforma`, app/admin/_polar/datos/ventas-server.ts). Desde
  diciembre va a decir «Atrasada» sobre la suscripción del CRM de Código aunque el libro la haya cobrado. Revenue, Customers y Por
  cobrar ya no lo dicen.
- **Sales › Orders no lista las órdenes del libro como pedidos** (filtra `^[pc]:\d+$`). Muestra su recibo como «cargado a mano», que es la
  misma plata una sola vez. Que el pedido diga «Binance · orden …» es otro cambio.
- **El «sube» de noviembre se muestra el 1/12 cuando hoy es diciembre**, con o sin el libro: es de la historia mes a mes del CRM
  (`conMensualidad`). No es de esta punta.
- **El `tsc-acotado` de la nube falla con «código undefined»** sobre lib/agencia-mes.ts: con su heap de 2.560 MB no le alcanza. Con
  `--max-old-space-size=4096` y su mismo tsconfig da 0 errores (y rompiéndolo, 3).

## Autocrítica

Lo que cambié revisando:
- **El día de la orden.** Lo primero fue `diaEnLaZona`, como los cobros. El comprobante guarda la hora SIN zona y eso corre un día los
  pagos de la noche. Ahora es el día que anota el libro.
- **Binance no es una pasarela.** Las órdenes salían con `proveedor: 'binance'` y su orden como `proveedorPagoId`, y Sales usa eso para
  «Devolver el pago». Ahora van sin esos campos; la orden queda en el id.
- **Con los recibos sin leer, no se cuenta el libro.** Lo primero contaba todo: sin saber qué está atado, eso puede contar dos veces.
- **La mensualidad del libro y la del CRM.** El encargo pedía «sin contar dos veces» sólo para una orden ya cargada. Corriendo
  diciembre en el hijo apareció el otro doble: la suscripción del CRM viva por la gracia mientras pagaba el libro. De ahí `conElLibro`,
  con el caso del libro apagado para no inventar un corte.

Lo que descarté:
- **Usar la misma clave de suscripción que el CRM** (`lead:<id>:…`) para el libro: la historia mes a mes del CRM no ve el libro, y le
  habría puesto su mensualidad inferida al MRR de diciembre y lo habría dado por atrasado.
- **Leer la ficha de la agencia para cada orden:** el renglón ya la tiene cuando hay pagos del CRM. Sólo se lee para una agencia que
  pagó únicamente por el libro.

No hay capturas: la pantalla no cambió. Revenue y Customers dibujan lo mismo con un pago más, y la nube no ve producción.
