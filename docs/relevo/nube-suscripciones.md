# Relevo: la suscripción mes a mes en la ficha (nube, 5/11/2026)

Lo escribió la sesión de la nube que hizo el encargo `docs/relevo/suscripciones-ficha-encargo.md`. La punta es
`punta/suscripciones-ficha`. Lo que se aprendió: docs/hallazgos-pagos.md, «La suscripción mes a mes». La investigación:
docs/investigacion-suscripciones.md.

## Lo que quedó hecho

- **La tab Pagos de una venta de suscripción es UN bloque, «Mes a mes».** Arriba: cuánto paga hoy, cuándo le toca, cuánto
  pagó en total y si debe. Abajo, cada mes con lo que tocaba, lo que entró, lo que cambió (empezó, subió, bajó, se cortó,
  volvió) y sus pagos con su comprobante. Acciones: registrar un pago (de un mes o un ajuste, con medio y comprobante),
  cambiar el monto desde un mes, cortar y retomar, todas con Deshacer. Con ese bloque en la hoja, el estado de cuenta, las
  cuotas, la venta y los movimientos se callan. El pago único y el plan por tramos no cambian.
- **Un medio de pago nuevo: «Cripto (Binance, USDT)».**
- **El MRR cuenta la mensualidad de ESTE mes** (un cambio para diciembre no cuenta en noviembre) y, sin mensualidad
  cargada, lo pagado el último mes, marcado como estimado (`getMrrActivo` devuelve `estimadas`).
- **La API:** `ver_suscripcion_lead` (el mes a mes) y `cambiar_suscripcion` (monto desde un mes, corte, vuelta);
  `registrar_pago_suelto` acepta `mes` y `ajuste`; `cobranza_lead` trae el resumen mes a mes.
- **La vista de edición de la ficha:** la barra de cada bloque quedó en nombre, mover, Datos u Opciones, «⋯» y quitar.
  Ancho, diseño, «Obligatorio», título e ícono van en «⋯». Nada se sacó.

## Lo que tiene que hacer el Cerebro, en este orden

### 1. Aplicar la migración 0401 ANTES del deploy (o junto)

`supabase/migrations/0401_suscripcion_movimientos.sql`: la tabla `suscripcion_movimientos` y dos columnas de `pagos`
(`suscripcion_mes`, `suscripcion_ajuste`). **El número se confirma al aplicarla.** Nació 0398 y se renumeró a 0401 el 5/11,
cuando la Actividad de Admin entró a main con su 0398. Lo que había en otras ramas ese día: la 0396 en
`punta/codigo-primer-contacto` y, en `punta/automations-pagos`, una 0398 (`comprobantes_leidos`, que también choca con la de
Admin) y una 0399. La 0400 quedó libre a propósito: es el número natural para esa 0398 cuando se renumere. Si alguien tomó
la 0401, se renumera antes de subir.

- Sin ella el código no se rompe: la tab se dibuja, pero «Cambiar el monto», «Cortar» y «Retomar» contestan que falta la
  migración, y el mes de un pago se calcula solo (no se guarda).
- Va antes del deploy porque la tabla ya está en `TABLAS_DE_INQUILINO`: sin ella, el reset del cliente de prueba vacía
  todo igual y avisa «suscripcion_movimientos: esa tabla no existe», que se lee como un error.
- Después, verificar con `has_table_privilege('anon', 'suscripcion_movimientos', 'select')` = false.

### 2. Cargar los datos (con el OK de Martín, desde la app o la API, no a mano en SQL)

Los tres clientes de la plataforma (negocio 9) tienen la mensualidad vacía y la fecha de cierre del día que se cargaron
(26/10), no la de la venta. Con la 0401 aplicada y la punta en producción:

**Juanfran / Código Inmobiliario (lead 2474):**
1. `editar_venta_lead`: fecha de cierre 2026-10-21 (el día del primer pago).
2. `cambiar_suscripcion`: monto US$146 desde 2026-10; monto US$238 desde 2026-11 con día 5; monto US$426 desde
   2026-12. El primero no guarda «el de antes» porque no había ninguno.
3. `registrar_pago_suelto`: US$94 el 2026-11-04 y US$144 el 2026-11-05, los dos con `mes: '2026-11'` y `metodo: 'cripto'`.
4. El pago del 21/10 (US$146) dice «transferencia» y fue por Binance: no hay operación para cambiar el medio de un pago
   cobrado. Es un `update pagos set metodo = 'cripto'` sobre ese id, o desmarcarlo y volver a marcarlo desde la ficha.
5. Los diferenciales (los días hasta el próximo 5), cuando se cobren: `registrar_pago_suelto` con `ajuste: true`.

Esto es lo mismo que pide el paso 1 de `docs/relevo/nube-admin.md` (cargar lo de noviembre de Código): se hace UNA vez, de
esta forma. Un pago de un mes queda como mensualidad (`es_mensualidad`) y un ajuste no, que es lo que Admin › Revenue cuenta
como recurrente (`esRecurrente`, lib/admin-ingresos.ts): Revenue tiene que dar MRR US$432 y «Subió +US$92».

Lo que tiene que verse después en la ficha: Paga hoy US$238 (día 5); Le toca el 5 de diciembre US$426; Pagó en total US$384; octubre
«US$146 de US$146 · Empezó»; noviembre «US$238 de US$238 · Subió de 146 · 2 pagos · Cripto».

**Leila (2473) y Florencia (2659):** `cambiar_suscripcion` con monto US$97 desde 2026-10. Florencia: `editar_venta_lead`
con fecha de cierre 2026-10-18 (pagó ese día). Leila ya tiene el 26/10.

**El negocio 11 (12 suscripciones, del negocio de una clienta):** no se tocó. Dos datos para decidir con ella:
- La suscripción de 12 meses por US$4.235,29 es el 88 % del MRR de ese negocio y, según la bitácora del CRM, es un pago
  único en quincenas guardado como suscripción. Se pasa con «Pasar a pago único» (el botón nuevo, admin) o
  `editar_venta_lead` con `tipo: 'unico'`.
- 4 suscripciones pagaron y no están en Ganado (1852, 1871, 1923, 1940): no suman al MRR. Si alguna sigue activa, se gana.

### 3. Lo que hay que decidir sobre el MRR (no se tocó)

Hay dos MRR y miden cosas distintas: Admin › Revenue (lo que le pagan a MaKo, sale de lo PAGADO como mensualidad) y el
`getMrrActivo` del Dashboard de cada negocio (sale de la mensualidad declarada).

- **Qué cuenta en el del negocio.** Hoy: Ganado, sin cortar, con la mensualidad de este mes. 4 de las 5 Ganadas del negocio 11 no
  pagaron nunca y suman igual (US$4.759 de US$4.799). Contarlas sólo con algún pago, o sólo al día, es una decisión de
  producto. Lo que hay para leerlo: `historiaDeSuscripcion` (lib/suscripcion-meses.ts: `mesesSinPagar`, `deudaUsd`,
  `proximo.vencido`) y `mrrDeSuscripcion`.
- **Cómo lee el resto la suscripción:** `cobradoDelLead(...).suscripcion.historia` trae el mes a mes;
  `leerCambiosDeSuscripcion(leadIds)` (lib/suscripcion-movimientos.ts) lee los cambios de muchos leads en una consulta.
  Nadie tiene que contar meses por su cuenta.

### 4. Lo que hay que mirar en producción después del deploy

- La tab Pagos de los tres leads del negocio 9, en computadora y en el teléfono (el teléfono muestra el estado de cuenta
  con la cuenta nueva; el mes a mes todavía no está ahí).
- Que el MRR del negocio 9 en el Dashboard pase de 0 a la suma de las tres mensualidades de noviembre.
- Una ficha PERSONALIZADA de Pagos (el negocio 1 tiene 9 bloques propios en Pagos): no tiene el bloque nuevo, así que en
  una suscripción sigue viendo los bloques de antes, con los números corregidos. Si se quiere el mes a mes ahí, se agrega
  el bloque «Suscripción» desde «Agregar bloque».

## Lo que NO se vio en un navegador

La sesión de la nube no tiene base de datos: la tab nueva y la barra del bloque se probaron con tests (la cuenta mes a mes
ejecutándose, la barra leyendo el fuente) y con el `tsc`, no abriéndolas. Lo primero que hay que hacer en el ws 3, con la
0401 aplicada: abrir un lead de suscripción, registrar dos pagos en un mes, cambiar el monto desde el mes que viene,
cortar y retomar; y en «Editar» de la ficha, elegir un bloque y abrir cada cosa del «⋯» (ancho, diseño, obligatorio,
título, ícono), en computadora y en el teléfono.

## Lo que quedó sin hacer

- **El mes a mes en el teléfono** (/m): hoy dibuja el estado de cuenta.
- **El prorrateo del diferencial**: lo calcula Martín y se registra como ajuste.
- **Una suscripción cobrada por la pasarela** sigue con su cuenta de siempre (su monto sale del lead, no del cobro); no se
  tocó `lib/cobros.ts`.
- **Cambiar el medio de un pago cobrado** no tiene botón ni operación.

## Lo que se supuso

- La medición (`docs/relevo/suscripciones-medicion.md`) llegó con el modelo ya escrito. No cambió el diseño: confirmó las
  fallas y sumó las del MRR y la fecha de cierre (están arriba). La barra simplificada salió de su §3.
- Un pago con su mes elegido va a ese mes; uno sin mes, al más viejo que falta; una mensualidad sin cambios de monto
  guardados vale un mes (la regla de la quinta revisión de Pagos), así que los 15 leads de hoy se cuentan igual que antes.
