# Hallazgos — la tab Pagos de la ficha del lead

El área es lo que se dibuja en la tab **Pagos** de la ficha del lead: los bloques en `app/crm/lead-view/ficha/`
(`reglas-pagos.ts`, `registro-pagos.tsx`, `pagos/`) y las tarjetas que montan.

No es la pasarela. Stripe, Mercado Pago, los webhooks y el plan de MaKo están en
[hallazgos-planes-y-cobro.md](hallazgos-planes-y-cobro.md). La escritura campo por campo (lib/pagos-campo.ts) está en
[hallazgos-crm.md](hallazgos-crm.md), en «Las seis bajas de b2».

---

## 1 · El relevamiento antes de rehacerla (16/10/2026)

Martín pidió esto el 16/10 (lo pasó Cerebro): «la tab de PAGOS que está un desastre también en funcionalidad, no se
entiende... NO tengas miedo a ELIMINAR todo». Esto se midió en el código de `crm-armador` (d86dc46a6) antes de tocar
nada.

### Qué hace hoy

- La tab dibuja dos bloques. `oferta` es OfertaDelLead. `venta` es **DealDetailsCard entera**:
  `app/crm/[id]/DealDetailsCard.tsx`, 1028 líneas, con «Editar deal →» abajo.
- La tarjeta mezcla todo en una columna, en este orden:
  1. «Pagos»: lo cobrado, el monto de cierre, la mensualidad, «Sin cobro» y un semáforo.
  2. La franja del contrato.
  3. Las cuotas, con «Marcar pagada», «deshacer» y «+ Registrar otro pago».
  4. Los links de pago, con el asistente «Cobrar con link» y la lista de cobros: anular, devolver y cancelar.
  5. Los datos fiscales, el servicio, la promesa y las obligaciones, como cajas grises de sólo lectura.
- A un ganado sin datos le sale un banner con «✦ Completar con IA». Ese botón lleva a `?edit=1`, el editor del deal
  entero (EditarDeal), que guarda todo con un solo botón.
- La ficha de Customer Success, en su tab Pagos, monta **la misma tarjeta** (`app/customer-success/FichaPestanas.tsx:84`).

### Qué es lo que no se entiende (medido)

1. **No contesta «¿cuánto debe?».** El titular es «$X cobrado de $Y». Lo vencido no es un número en ningún lado, y el
   chip «Pendiente» suma lo vencido y lo que vence en un año.
2. **El semáforo miente.** Lo calcula la tarjeta por su cuenta (:352-363) y no usa `cobradoDelLead`
   (lib/cobrado-lead.ts), que se escribió el 14/10 justamente para corregir esto:
   - una mensualidad activa con todo registrado dice «Pagado por completo», en verde;
   - un pago único sin cuotas dice «Al corriente», en verde;
   - una renovación rechazada sigue en verde.
3. **Una cuota DEVUELTA se dibuja como deuda.** La devolución de la pasarela deja la cuota impaga y sin vencimiento
   (`esCuotaDevuelta`). La tarjeta no la filtra:
   - la dibuja con «vence —» y el botón «Marcar pagada»;
   - la suma al total y al «Pendiente».

   El Outstanding y `cobradoDelLead` sí la excluyen. Así, la tab decía una deuda que el resto de la app no veía.
4. **Hay tres maneras de cobrar y ninguna manda.** «Marcar pagada» va en cada cuota, «+ Registrar otro pago» abajo de
   la lista y «Cobrar con link» en OTRA sección, más abajo. Cobrar UNA cuota con un link no existe en la pantalla,
   aunque el server lo acepta desde el 14/10 (`crearCobroAction` con `pagoId`).
5. **Para editar hay que irse.** El plan, el monto, la mensualidad, el servicio y los datos fiscales se cambian sólo en
   «Editar deal», que es otra pantalla. Sin cuotas, la tarjeta dice «Entra a Editar para armar el plan», y en la
   ficha por bloques ese botón no existe.
6. **Un ganado sin cargar dibuja unas 15 cajas con «—»** (servicio, promesa y fiscales vacíos).
7. **La plata a mano se carga sólo en dólares** («Monto (USD)»). La moneda por negocio ya existe en el server
   (`pagoEnMoneda`, decisión 7) y la pantalla no la ofrece.
8. **Las devoluciones y los contracargos no se ven como tales.** Son el `motivo` en letra chica dentro del renglón del
   link. En la lista de cuotas no aparecen.
9. **La escritura nueva no tiene pantalla.** Todo b2 está en main y la tarjeta no lo llama. Son las acciones de
   `app/crm/[id]/pagos-campo-actions.ts`: editar una cuota por id, armar el plan sin ganar el lead, la venta campo
   por campo, cortar un recordatorio y cancelar una suscripción manual. La tarjeta sigue guardando por
   `saveDealSectionsAction` y `saveCuotasAction`.

### Lo de plata que NO se puede perder

Cada función con la acción que la hace. La tab nueva las llama igual, sin reescribirlas.

| Función | Acción (server) | Dónde la fija un test |
|---|---|---|
| Marcar una cuota pagada, con comprobante (la IA lee monto, fecha y hora) o a mano | `marcarPagoManualAction` + `/api/extract-receipt` | tests/pagos-diferencia.test.ts, tests/crm-cuota-cobrada.test.ts |
| Un pago de menos pregunta qué pasa con la diferencia: queda pendiente o es descuento | `marcarPagoManualAction({ resto })` | tests/pagos-diferencia.test.ts |
| Deshacer el marcado (toast de 5 s); una cuota que cobró la pasarela NO se deshace a mano | `marcarPagoAction(…, false)` | tests/crm-cuota-cobrada.test.ts, tests/general-cobranza.test.ts |
| Registrar un pago que no es una cuota | `registrarPagoSueltoAction` | tests/pagos-escritura.test.ts, tests/pagos-diferencia.test.ts |
| Ver y descargar el comprobante | `/api/doc?kind=comprobante` | — |
| Cobrar con link, copiarlo y anularlo | CobrarConLink + `crearCobroAction` / `anularCobroAction` | tests/cobros-*.test.ts |
| Devolver un cobro y cancelar una suscripción de la pasarela (sólo el admin, con confirmación) | `reembolsarCobroAction` / `cancelarSuscripcionAction` | tests/cobros-servicio.test.ts |
| Quitar «Sin cobro» | `quitarSinCobroAction` | tests/venta-sin-cobro.test.ts |
| Registrar una mensualidad cobrada (suscripción manual) | hoy `saveCuotasAction` (cuota pagada sin id) | tests/pagos-bajas-b2.test.ts |
| El plan, la venta, la mensualidad y el plazo, campo por campo | `ajustarPlanAction`, `editarCuotaAction`, `guardarVentaAction` | tests/pagos-campo.test.ts, tests/api-mako-pagos-campo.test.ts |
| Contrato: subir, reemplazar, ver, descargar y «Leer con IA», que llena sólo lo vacío | `/api/extract-contract`, `/api/contract`, `/api/doc` | — |
| Documento fiscal con lectura por IA, y «Facturado por» | `/api/extract-deal-fiscal`, `getIdentidadesFiscalesAction` | — |
| Servicio, promesa y obligaciones | `guardarCampoDealAction`, `guardarObligacionAction` | tests/pagos-campo.test.ts |
| Las marcas `data-recorrido` que busca «Solucionar» (monto, plan, comprobante, dealFiscal, dealFiscalDoc, dealServicio, dealPromesa, dealObligaciones) | `marcaDato` (lib/datos-aviso.ts) | tests/ficha-*.test.ts |

Y una de lectura: lo cobrado sale **sólo** de `cobradoDelLead`. No sale de `monto_cierre_usd` pelado, que en ws11 infló
el MRR un 85% (hallazgos-crm.md).

---

## 2 · Cómo quedó, en reglas (16/10/2026)

- **Cada bloque contesta UNA pregunta y lleva el botón de lo suyo.** El estado de cuenta (`cobrado`) dice qué debe y
  trae UN botón con lo que toca ahora (`estadoDeCuenta`, lib/pagos-vistazo.ts). Las demás acciones viven en su bloque:
  marcar pagada en la cuota, el link en los links, cancelar en la suscripción. El mismo botón abre lo mismo desde
  cualquier lado (`useCobrar`, app/crm/lead-view/ficha/pagos/cobrar.tsx).
- **Lo cobrado sale de `cobradoDelLead` y lo que se dice, de `lib/pagos-vistazo.ts`.** La pantalla, el teléfono
  (`saldoDelTelefono`) y la API de MaKo (`cobranza_lead`) usan las mismas tres funciones. Una cuarta cuenta es la que
  vuelve a decir «Pagado por completo» de una mensualidad.
- **Un bloque se calla sin deal, SALVO que se esté pidiendo su dato.** Ver la trampa de abajo.

## 3 · Trampas

### Un bloque que «se calla sin deal» deja un dato pedido sin dónde cargarse

- **Síntoma.** Con `venta` callada en un lead sin deal, «Solucionar» del monto no encontraba tab y caía al asistente.
  Lo atrapó tests/ficha-armador.test.ts.
- **La causa, que no era la obvia.** Hay dos reglas que no miran lo mismo:
  - «¿hay deal?» (`tieneDeal`) mira el estado, la etapa `facturando`, las cuotas y el plan;
  - «¿se pide el monto?» (lib/stage-requirements.ts, `esVenta`) mira la etapa de cierre DEL FUNNEL.

  Cuando no coinciden, el dato se pide y el bloque se calla.
- **La regla.** Un bloque se calla sólo si ninguno de sus datos está en `ctx.data.faltantes` (`sinDealSalvo`,
  reglas-pagos.ts).

### `useSyncExternalStore` con la suscripción sin memorizar lee una vez por render

- **Síntoma.** Lo midió el test, no se vio en pantalla: una suscripción nueva en cada render.
- **La causa.** React se desuscribe y se vuelve a suscribir cada vez. La foto de los cobros se tira cuando sale el
  último oyente, así que cada render volvía a pedir los cobros a la base.
- **La regla.** `subscribe` y `getSnapshot` van en `useCallback` por lead (pagos/datos.ts). Lo fija
  tests/pagos-tab-bloques.test.ts.

### El asistente de una cuota con una pasarela en dólares no tenía ningún paso

- **La causa.** El link de UNA cuota no pregunta qué ni cada cuánto, y en dólares tampoco cuánto. Con una sola pasarela
  la lista de pasos quedaba vacía y el paso actual, `undefined`.
- **La regla.** El modo cuota tiene su propio paso, que dice qué se cobra (CobrarConLink.tsx). Una lista de pasos de
  WizardShell nunca puede quedar vacía.

### Un error del server que dice «córtalo» y una pantalla sin dónde cortarlo

- **Síntoma** (revisión del 16/10/2026, antes de subir). Editar una cuota con un recordatorio de cobro en curso
  devolvía «córtalo para editarla». La tab nueva no tenía dónde cortarlo: un callejón sin salida que la tarjeta vieja
  no tenía, porque guardaba todo junto y conservaba esa cuota en silencio.
- **La regla.** Si el server rechaza algo por una protección, la pantalla la LEE antes y la dice:
  - `proteccionesDeCuotasAction`, en pagos/cuotas-actions.ts, trae lo que protege a cada cuota;
  - el renglón muestra «Link enviado» o «Recordatorio en curso»;
  - no deja editar lo que el server va a rechazar;
  - ofrece «Cortar el recordatorio».

### Enter y el blur que le sigue eran dos guardados

- **La causa.** El campo en el lugar (pagos/EnLinea.tsx) se deshabilita mientras guarda, y eso dispara el blur. Ese
  blur guardaba otra vez contra el valor VIEJO del prop.
- **El síntoma.** En una obligación, la segunda llamada llevaba el texto anterior como `esperado` y volvía con «otra
  pestaña lo cambió» sobre algo que sí se había guardado.
- **La regla.** Un candado (`enCurso`): un guardado a la vez.

### `venta` ya no trae las cuotas: tres plantillas se quedaron sin ellas

- **Síntoma.** Lo encontró la revisión del 16/10/2026, antes de que lo viera nadie. Formulario de Meta (ws15 y ws17),
  Te escriben y Carrito tenían `venta` en Pagos y no `cuotas`.
- **Por qué pasó.** Con la tarjeta de antes no hacía falta, porque `venta` ERA DealDetailsCard y las traía adentro.
  Partida en bloques, esos funnels perdían marcar, deshacer, el comprobante y el plan.
- **La regla.** Una tab Pagos con `venta` o `cobrado` lleva `cuotas` (tests/pagos-tab-bloques.test.ts). En esas dos
  plantillas el comprobante se apagó explícito, para no cambiarles los avisos.
- **Fichas guardadas.** Una lista personalizada se usa tal cual (`fichaEfectiva`), pero el 16/10 no había ninguna en
  producción (0 funnels con `data.ficha`), así que no hizo falta migrar.

### Mandar la lista ENTERA reescribe con valores viejos

- **Síntoma.** Quitar o agregar una cuota mandaba todas las impagas con lo que tenía la pantalla, y armar el plan
  mandaba los cuatro campos. Si otra pestaña o MaKo había cambiado una cuota en el medio, volvía a su valor viejo, sin
  aviso.
- **Por qué el server no lo frena.** Compara contra la base y escribe lo que vino: no sabe qué vio la pantalla.
- **La regla.** Una escritura manda SÓLO lo que la persona tocó:
  - `quitarCuotaAction` y `agregarCuotaAction` (pagos/cuotas-actions.ts) mandan una cuota;
  - el plan manda lo que cambió contra el plan como estaba al abrir.

### Un Deshacer que vuelve a insertar no es la misma cuota

- **Qué pasaba.** Volver a insertar una cuota quitada le daba otro id y otro número:
  - el inicial volvía como «Cuota N»;
  - su recordatorio se volvía a mandar, porque el dedup es por id.
- **La regla.**
  - Quitar pide confirmación y no tiene Deshacer.
  - El Deshacer de un ajuste del plan devuelve cada cuota con su número: `reconciliarCuotas` en modo `porId` lo
    respeta si está libre.

### Con un descuento o un pago de más, Deshacer perdía deuda

- **Qué pasaba.** Ya pasaba con la tarjeta de antes. El Deshacer se ofrecía cuando no quedaba pendiente, y un
  descuento o un pago de más tampoco dejan pendiente. Desmarcar no devuelve el monto: una cuota de 1000 cobrada con 600
  y descuento quedaba debiendo 600.
- **La regla.** Deshacer sólo si se cobró EXACTO lo de la cuota.

### Lo devuelto no es lo que falta

- **Qué pasaba.** Una cuota devuelta sale de las cuotas pero la venta sigue con su monto. La diferencia se ofrecía
  como «Agregar la cuota»: volver a cobrar lo que se devolvió.
- **La regla.** Ahora dice «Devuelto en parte», sin botón, y sólo ofrece lo que falta además de lo devuelto.

### «No pude leer los cobros» no es «no hay pasarela»

- **Qué pasaba.** Con `cobros ?? []`, una suscripción que cobra Stripe se leía como manual mientras cargaba o si la
  lectura fallaba. Ofrecía «Registrar el mes cobrado», que duplicaba lo cobrado.
- **La regla.** Sin los cobros leídos no se decide la fuente, ni en la tab ni en la API (`cobranza_lead`).

### Un link pagado que todavía no se asentó

- **Qué pasaba.** Entre el pago y que el aviso o el cron lo asienten, la cuota sigue impaga. Ofrecía otro link para la
  misma plata.
- **La regla.** `cuotaParaLink` (lib/cobros.ts) no crea el link de una cuota que ya tiene un cobro pagado.

### Quitar una fila de `pagos` va por la reconciliación, aunque no sea un plan

- **Qué pasó** (mig 0295, 16/10/2026). Deshacer un pago que nació cobrado lo tiene que QUITAR. El reflejo fue un
  `.from('pagos').delete()` en `marcarPago`, y lo frenó la guarda de tests/pagos-escritura.test.ts: en lib/pagos.ts
  hay UN solo borrado de cuotas, el de la reconciliación.
- **Por qué la guarda tiene razón.** Cada escritor que borraba y volvía a insertar les cambiaba el id a las cuotas y
  rompía el link, el corte de la cobranza y su dedup.
- **La regla.** Se deja impaga y se reconcilia con esa cuota como la única vista
  (`guardarCuotasPorId(lead, [], { vistos: [id] })`): la quita el borrado de siempre, que además respeta lo que la
  protege. `marcarPago` lee la cuota con `*`, así una base sin la migración no rompe todo marcar.
- **Medido al aplicarla.** 0 cuotas con dos links vivos y 0 cobros en producción. El índice
  `cobros_un_link_vivo_por_cuota` se creó sin choques.

### El teléfono muestra el estado de cuenta también desde el Resumen

- **Qué pasa.** Cuatro plantillas ya traían `cobrado` en el Resumen. Con `cobrado → 'saldo'`, el teléfono lo dibuja
  ahí, una sola vez, y no al final con Pagos.
- **Por qué es correcto.** Es la regla «una pieza va donde aparece primero»
  (tests/m-ficha-bloques.test.ts, tabla ESPERADO).

### «Baja del cliente» (#871): la cuota de baja va SIN vencimiento, y por eso no hizo falta tocar doce lecturas

- **El pedido** (llamada «Mau <> Martin», 16/10/2026, 28:34). Francisco Javier Hernández pagó unos US$4.000 de
  US$6.000 y dejó el servicio. La ficha sólo ofrecía «Marcar pagada» o «Quitar»: quitar borra lo que se le vendió, y
  dejarlo marcaba US$1.800 vencidos a 80 días para siempre.
- **El diagnóstico obvio era el equivocado: una marca `baja_at` y un `.is('baja_at', null)` en cada lectura.** Se
  contaron las lecturas de lo impago: el Outstanding, «A quién cobrarle», el Revenue, la cobranza por WhatsApp, Customer
  Success (`cs-cartera.ts`), las condiciones «Pagó / No pagó» de Automations (`nutricion.ts`), el calendario, las
  sugerencias del CRM, las métricas de la API, la ficha y el teléfono. Doce, en áreas de otros chats.
- **La forma que las resuelve casi todas solas.** Al darse de baja, la cuota queda impaga, con `baja_at` y SIN
  vencimiento; el que tenía va a `baja_vencia` y vuelve al deshacer (mig 0307). Toda lectura que decide «vencida» por la
  fecha la deja afuera sin saber que la baja existe. Las que suman lo impago SIN fecha son las mismas que ya tenían que
  sacar las cuotas devueltas (que tienen la misma forma), y usan `noEsDeuda` (lib/cobrado-lead.ts).
- **La regla** (AGENTS.md): una suma de lo que falta cobrar excluye con `noEsDeuda`. tests/pagos-baja.test.ts barre
  `!esCuotaDevuelta(` en app/ y lib/.
- **Lo cobrado no se toca.** La baja anula los links sin pagar de esas cuotas y corta sus recordatorios. Una suscripción
  no se da de baja: se cancela. Vive en lib/pagos-baja.ts, la tab (bloque `cuotas`) y la API (`baja_del_cliente`).

### Una columna nueva en un `select` explícito rompe la lectura entera sin la migración

- **Lo pidió el Cerebro al confirmar la 0307**: que el código tolere la columna ausente.
- **Qué pasaba.** Las lecturas que filtran en memoria pedían `'…, cobro_id, baja_at'`. Sin la migración, PostgREST
  contesta error y se cae TODO el número (el Outstanding entero), no sólo la parte de la baja.
- **La regla.** Una lectura que filtra en memoria por una columna nueva lee con `*`: si la columna no está, el campo
  llega `undefined` y la regla da «no es de baja». Lo fija tests/pagos-baja.test.ts.

### «Quitar» no falló la primera vez: tardó sin decir nada (#891, 17/10/2026)

- **El síntoma** (llamada con Mauricio, 16/10, 27:42): «Se me hace que no la quitaste... Eso es un error», y al rato
  «ahí sí se quitó».
- **El diagnóstico obvio era el equivocado: que el server la rechazó la primera vez** (un link o un recordatorio la
  protegían). En el ws1 (lead 91) no había ni link ni recordatorio, y el historial tiene UNA sola baja (16/10 20:41):
  el primer clic se aplicó, tarde.
- **La causa.** La confirmación se cerraba DESPUÉS de la acción, que revalida cinco pantallas; y la fila se iba recién
  cuando la ficha se releía (otra acción, en la misma cola). Segundos con el diálogo abierto y sin una señal.
- **La regla.** Una acción de la ficha que tarda cierra su diálogo y marca el renglón («Quitando…») ANTES de llamar
  al server, y AFUERA de `startTransition`: un setState adentro de una transición puede no dibujarse hasta que
  termina. Lo que el server confirmó se saca de la vista sin esperar la relectura. tests/pagos-quitar-al-instante.test.ts.

### «General marca vencido algo cobrado» era un dato, no un bug (#890, 17/10/2026)

- **Leído en el ws1** (lead 23, Adrian Medina): venta de US$7.500 y US$5.625 cobrados. La tercera cuota (US$1.875,
  vence 15/10) está sin cobrar, y General la marca vencida con razón.
- **De dónde salió.** El 16/09 «Cuotas actualizadas desde Deal Details» partió la segunda cuota de US$3.750 en dos de
  US$1.875, y el 13/10 se marcó pagada sólo una.
- **La regla.** Antes de tocar General por un «ya está cobrado», se leen los pagos del lead y su historial.

### «Clientes por cobrar» no veía las suscripciones: una suscripción no genera cuotas (20/10/2026)

- **El síntoma** (Martín, llamada con Leila del 19/10): la lista de a quién cobrarle no mostraba a ningún cliente de
  mensualidad. Leía sólo cuotas impagas (`getOutstandingDetalle`), y una suscripción manual se registra mes a mes.
- **La regla, la de toda la app** (`cobradoDelLead`, en lib/suscripciones-por-cobrar.ts): entra un mes manual sin
  registrar, una renovación de la pasarela rechazada, o la próxima mensualidad manual dentro de la ventana. Una de la
  pasarela al día no entra: se cobra sola.
- **Lo que NO cambia: el número de Outstanding.** La app no llama deuda a un mes sin registrar (dice «Falta
  registrar», en ámbar: puede estar cobrado y no anotado). Por eso se suma a la LISTA (`getPorCobrar`, lib/pagos.ts), y
  el Outstanding sigue saliendo de las cuotas.
- **Una fila sin cuota no ofrece «Cobrada»:** abre la ficha, donde se registra el mes. General y el teléfono descartaban
  toda fila sin cuota; ahora las dos usan `cobroDeFila` (app/m/dashboard/modelo.ts). tests/suscripciones-por-cobrar.test.ts.

### «A quién cobrar» y el estado de cuenta, dibujados en el chat con MaKo (20/10/2026, la 2.27 y la 2.28)

**Vive en:** lib/pagos-bloque.ts (arma los dos bloques, puro) · app/_chat/bloques/CobranzaHilo.tsx y cobranza-actions.ts
(«A quién cobrar») · app/_chat/bloques/EstadoCuentaHilo.tsx y app/crm/lead-view/ficha/pagos/comprobante-del-chat.ts (el
estado de cuenta y el comprobante). Tests: tests/chat-bloque-cobranza.test.ts y tests/chat-bloque-estado-cuenta.test.ts.

- **⚠️ Marcar una cuota que YA está cobrada le reescribe la fecha.** `marcarPago(id, true, fecha)` no mira si ya estaba
  pagada: pisa `fecha_pago` y el cobro salta de mes. Una lista guardada en el hilo es una foto. Su «Cobrada», tocado
  días después, haría eso. Por eso la lista se vuelve a leer al dibujarse, y hasta que llega se ve sin acciones. Pasa
  igual con General abierta en dos pestañas, pero ahí la foto dura minutos, no días.
- **El estado de cuenta del chat ES la pieza de la tab**, el bloque `cobrado` montado como en Clients
  (`BloquesDePagos`, `getLeadFullAction`). No tiene una cuenta propia, así que muestra lo mismo que la ficha. Lo que lee
  MaKo para contestar (`cobranza_lead`) usa las mismas dos funciones: `cobradoDelLead` y `estadoDeCuenta`.
- **El comprobante adjunto va al modal de la ficha**, no a la tarjeta de la acción. «Marcar pagada» lo lee solo, con el
  mismo `subir` que «Subir el comprobante» (/api/extract-receipt): lo guarda en la cuota y llena monto, fecha y hora para
  revisar. La tarjeta G3 todavía no tiene campos editables (eso es la 1.10), y por ella el archivo no se guardaba en la
  cuota. ~~Se usa UNA vez: leído, el bloque deja de pasarlo~~ (la marca vivía en memoria y no sobrevivía una recarga:
  ver «La revisión de los bloques» abajo). Con dos archivos en el mensaje no se adivina cuál es.
- **⚠️ La ficha cuenta «hoy» en UTC.** FichaPorBloques y PagosCliente usan `new Date().toISOString().slice(0, 10)`, y
  General y la API usan el día del negocio. En México, de 18 a 24 h, la ficha ya está en mañana: una cuota que vence hoy
  sale vencida en la ficha y no en General. Si eso pasa, el texto de MaKo (`cobranza_lead`, con el día del negocio) y el
  bloque (la ficha) pueden decir distinto. **Sin hacer.**
- **«¿quién me debe plata?» todavía no hace viajar `a_quien_cobrar`**: la batería guardián tiene `llegaHoy: false`. Es la
  1.2, el clasificador. Hoy llega con «mostrame el dashboard de cobranza: a quién le falta pagar».

#### La revisión de los bloques: el comprobante iba a cualquier lado (21/10/2026)

- **⚠️ Una marca de «ya usado» en memoria no protege un bloque que vuelve del historial.** El bloque del estado de cuenta
  se guarda con el mensaje; al recargar (o al abrir el chat desde el teléfono) se monta de nuevo con la marca en cero, y
  «Cobrar la cuota» subía el recibo de la cuota 1 a la cuota 2, con la fecha vieja en el formulario. Y /api/extract-receipt
  escribe `comprobante_path` al LEER, antes de que nadie guarde: aunque se cancele, la cuota queda apuntando al recibo
  viejo. **Regla:** el comprobante del chat va atado a SU cuota (`pagoId`, la que tocaba cobrar al dibujarse) y se
  ofrece sólo mientras esa cuota siga impaga (`comprobanteParaCuota`, app/crm/lead-view/ficha/pagos/comprobante-del-chat.ts).
  Lo que se guarda tiene que decir a qué va; lo que vive en memoria no cuenta como «ya se usó».
- **El único archivo del mensaje se pegaba a TODO estado de cuenta del turno.** «Juan pagó, acá el comprobante. ¿Y cómo
  está Pedro?» dejaba el recibo de Juan listo para la cuota de Pedro; «acá el contrato de Juan» lo trataba como
  comprobante. El diagnóstico obvio («tomar sólo el primer `cobranza_lead`») era el equivocado: el modelo puede pedir
  primero a Pedro. **Regla:** decide `comprobanteDelPedido` (lib/pagos-bloque.ts). Un archivo, que el MODELO dice que
  es de este lead (el parámetro `comprobante` de `cobranza_lead`; si no está claro, pregunta), cuando lo que toca es
  cobrar una cuota, y de un solo lead por mensaje: el primero que lo toma es su dueño (la lista de archivos del turno es
  una sola, y un turno re-arrancado lo vuelve a tomar para el mismo lead). Con cualquier otra cosa, el modelo sigue el
  camino de siempre y no promete leerlo.
- **⚠️ La ruta decía `monto_usd` y la pantalla leía `monto`** (desde el 16/10, 8390f47ad): el monto del comprobante no
  llegaba nunca, y un pago de menos saldaba la cuota entera sin «Faltan US$200». El test miraba el `fetch` en el fuente,
  no lo que devuelve la ruta. **Regla:** cuando dos lados se pasan un JSON, el test pasa por la ruta REAL y por la lectura
  de la pantalla (tests/pagos-recibo-leido.test.ts, con `reciboLeido`), no por un mock con el nombre que espera uno de
  los dos. ~~El monto viene en dólares (la IA convierte y dice el tipo de cambio en `nota`, que ahora se muestra).~~
  Ver el punto siguiente: ese monto en dólares era el problema de fondo.
- **⚠️ Arreglar el nombre destapó una tasa INVENTADA** (segunda revisión, medio de plata). El prompt pedía `monto_usd`
  convertido «con un tipo de cambio aproximado actual»: un pago entero de MX$5.000 (una cuota de US$289,02 a 17,30)
  llenaba «Faltan US$11,24» con ~18 (al guardar, la 0318 creaba esa cuota que el cliente no debe) o un cobro de más con
  ~17. Mientras el monto no llegaba, el campo quedaba en el de la cuota, que era lo correcto para un pago entero: el
  arreglo del nombre lo volvió una regresión. **Regla:** la IA lee el monto y la MONEDA tal como figuran, sin convertir;
  la pantalla (`plataDeRecibo`) llena dólares si son dólares, la moneda del negocio con el valor en dólares vacío (vale
  el de la cuota, como `pagoEnMoneda`) si es ésa, y nada si es otra (y lo dice). ~~Un prompt viejo guardado en
  Configuraciones que todavía convierte: su monto no se usa.~~ Nunca una tasa de la IA (AGENTS.md).
- **⚠️ La etiqueta de moneda de la IA no es una declaración** (tercera revisión). «$5,000.00», lo normal en un recibo de
  México, Argentina o Colombia, etiquetado USD por la IA llenaba US$5.000 en una cuota de US$289, sin aviso (producción
  nunca llenaba el monto: era exposición nueva). Ahora el prompt dice que «$», «MX$» o «pesos» sin código no son
  dólares; lo leído en dólares en un negocio que no es en dólares se llena PIDIENDO confirmación, y se avisa siempre un
  monto de más del doble de la cuota. Y el `monto_usd` de un prompt viejo guardado en Configuraciones NUNCA se usa (la
  única señal de que convirtió era la nota, que la IA puede omitir): la ruta marca `monto_no_usado` y la pantalla dice
  «el monto no salió del comprobante». Un pago DE MENOS en pesos se guarda entero si no se declara el valor en dólares:
  es el diseño de siempre (sin tasa no hay cómo saberlo; vacío = el de la cuota).
- **Una forma no es una zona.** El saneo del bloque pedía una barra (`America/…`): un negocio en 'UTC', 'CET' o
  'EST5EDT', que `zonaCanonica` acepta, perdía la lista, y MaKo igual decía «la lista está abajo» porque la nota se
  agregaba antes de sanear. Ahora la zona la valida `Intl` (la misma vara que `hoyEnTz`) y la nota va sólo si el bloque
  sobrevive.
- **La foto guardada de «A quién cobrar» guarda 30 filas y el total.** La cabecera contaba las filas: «30 por cobrar»
  cuando MaKo, en el mismo mensaje, decía 35. `Cobranza` recibe `total` mientras se ve la foto («Ver 30 de 35»).
- **«Ya se dibuja» sólo si se dibujó.** El tope de bloques del mensaje (4, o 3 con una pregunta) descartaba el estado de
  cuenta en silencio y MaKo decía «revisa y guarda el cobro ahí». Lo que le dicen al modelo `cobranza_lead` y
  `a_quien_cobrar` del bloque va ahora por `siSeDibuja`, que `ejecutarOperacion` agrega sólo si `aDibujar` lo dibujó.
- **«Pregúntale» no tenía salida.** La respuesta a «¿es su comprobante?» llega en un mensaje SIN el archivo, y el archivo
  sólo sirve en el mensaje que lo trae. Ahora, pedido para este lead sin archivo en el mensaje, el modelo lo sabe y pide
  que lo vuelva a adjuntar (y al preguntar ya lo pide).
- **Una cuota ya cobrada no cambia de comprobante desde «Marcar pagada».** Con una vista vieja (otra pestaña, un link que
  se pagó mientras tanto), leer el comprobante le pisaba el del banco o el de Stripe; ahora la ruta contesta que ya está
  cobrada, y la escritura es condicional (`pagado = false`).
- **⚠️ Un valor que llega tarde no puede empezar con un default que parece real** (revisión de 1b6fc9ad8, baja).
  `useMonedaDelNegocio` empezaba en 'USD' hasta que contestaba el server, y el comprobante del chat se lee SOLO al abrir
  «Marcar pagada»: se leía con 'USD', y unos pesos con «$» se tomaban por dólares en un negocio en MXN. **Regla:** lo
  que se está cargando es null, y quien lee algo con ello espera (el efecto depende de la moneda, y «Subir el
  comprobante» queda en «cargando» hasta saberla). Si el server no contesta, la de siempre (USD).
- **Sin hacer:**
  - /api/extract-receipt sigue escribiendo `comprobante_path` al leer una cuota IMPAGA: cancelar no lo deshace. Lo
    limpio es guardarlo al «Guardar el pago». Vive en app/api/extract-receipt/route.ts y piezas.tsx (`subir`).
  - El extractor del CONTRATO (`CONTRACT_EXTRACT_DEFAULT`, lib/prompt-defaults.ts) sigue pidiendo los montos en USD
    convertidos «con un tipo de cambio aproximado actual»: la misma tasa inventada, en el plan de cuotas que arma.

### Cliente de agencia (#866 y #867)

No es de esta tab: es la pasarela y la cuenta de la agencia. Está en
[hallazgos-planes-y-cobro.md](hallazgos-planes-y-cobro.md), «El mes de un cliente de agencia».

## 4 · Lo que quedó SIN hacer

| Qué | Dónde vive | Por qué |
|---|---|---|
| ~~El Dashboard dibuja «Pendiente» una cuota de baja (o devuelta) en la tabla de cuotas con «Todo»~~ **Hecho el 17/10/2026 (B4), ver §5** | lib/graficos-datos.ts, `filasPagos` | Es una tabla de filas, no una suma. Es del Dashboard |
| La «baja del cliente» no se vio en el navegador | app/crm/lead-view/ficha/pagos/bloques-cobro.tsx | Sin RAM para `next dev`. Mirarla en el ws3 con un ganado con cuotas vencidas |
| La tab Pagos de **Customer Success** sigue montando DealDetailsCard. Con ella siguen vivos EditarDeal, `?edit=1`, «✦ Completar con IA», `saveDealSectionsAction` y `saveCuotasAction`. Cuando CS pase a bloques, se borran juntos, con las aserciones que los fijan (crm-cuota-cobrada, ganado-monto, muestra-pagos, pago-comprobante, ficha-se-relee) | app/customer-success/FichaPestanas.tsx:84, app/crm/[id]/LeadDetailBody.tsx:207 | Es la tanda T3 del CRM (Pagos + CS). La ficha de CS no tiene el `CtxFicha` entero |
| Bloques del catálogo sin componente: `confirmacion-de-pago`, `recordatorios-de-cobro`, `excepciones` y `cliente-en-cs`. Están en las plantillas y se saltean | app/crm/lead-view/ficha/reglas-pagos.ts | Cada uno necesita su lectura. Para los recordatorios, por ejemplo, no hay forma barata de leerlos por lead: falta la columna `lead_id` (mig 0186) |
| Diseños que no se dibujan: `cobrado` anillo, `cuotas` lista y calendario, `suscripcion` tarjeta y meses, y los de `oferta` (OfertaDelLead es sólo el desplegable) | registro-pagos.tsx | No se ofrecen: el menú «Diseño» sólo muestra los que están en `disenos` |
| **No se vio en el navegador**, ni en escritorio ni en el teléfono | — | No hubo RAM para `next dev`. Hay que mirarlo en producción con un ganado con cuotas, una suscripción y un lead abierto |
| El teléfono muestra el saldo pero no cobra: no hay «Mandar link» | app/m/crm/[id]/FichaLead.tsx | El teléfono destila. El cobro con link en el teléfono es otra pieza |
| La ficha cuenta «hoy» en UTC: de 18 a 24 h (México) una cuota que vence hoy sale vencida en la ficha y no en General ni en lo que dice MaKo | app/crm/lead-view/ficha/FichaPorBloques.tsx:135, app/customer-success/PagosCliente.tsx (`hoy:`) | `LeadFullData` no trae la zona del negocio: hay que sumarla en `getLeadFullAction` y usar `hoyEnTz` en las dos (20/10/2026) |
| Los bloques de Pagos del chat (la 2.27 y la 2.28) no se vieron en el navegador | app/_chat/bloques/* | Sin Chrome conectado ni RAM para `next dev`. Mirarlo en el ws3 con «mostrame el dashboard de cobranza: a quién le falta pagar» y con un recibo adjunto + «¿cuánto me debe Francisco?» |
| ~~Marcar a mano una cuota cuyo link ya se pagó pero no se asentó: después el cron la asienta como otra cuota y lo cobrado se cuenta dos veces~~ **Hecho el 17/10/2026 (B4), ver §5** | lib/pagos.ts, `cobrarCuota` | Frenarlo puede trabar una cuota para siempre si el pago entró por otro monto. Se ve el link pagado en «Links de pago» |
| ~~`epico` llega en PropsBloque en la próxima tanda del CRM. Hasta entonces se lee con un cast~~ Hecho el 17/10/2026: se lee `props.epico`, y un test barre la ficha por casts así | pagos/bloques-cobro.tsx | `e92688cd2` |
| ~~`PlantillaTab` está declarado localmente~~ Ya se importa de lib/ficha/plantillas-tab.ts (visto el 17/10/2026) | lib/ficha/plantillas-pagos.ts | Hecho |

## Cada pago guarda de qué funnel es (#897, mig 0310, 17/10/2026)

**El síntoma:** un OKR de «Renovación» (mig 0306, varios funnels) daba 0 en el ws1, y lo obvio era «el reparto por funnel
está mal». **No lo estaba.** Medido en la base (sólo lectura): los 5 leads de Renovación se agregaron el 13/10 y TODOS sus
pagos (mayo a septiembre) son de antes: con cualquier regla son del funnel del VSL. El 0 es verdad.

**Lo que sí estaba mal, y se arregló:** el reparto miraba dónde estaba el lead EL DÍA DEL PAGO, así que una cuota de la
venta del VSL cobrada DESPUÉS de agregarlo a Renovación contaba en Renovación. Ahora `pagos.funnel_id` se fija al CREAR
el pago (un trigger `before insert`, con la misma regla de lib/funnels-elegidos.ts) y los tres lectores lo prefieren: el
avance de un OKR (lib/objectives-fuentes.ts), los gráficos de pagos (lib/graficos-datos.ts) y el desglose de /general
(lib/pagos.ts → lib/funnels-elegidos-server.ts). Si la columna no está, reintentan sin ella (`faltaColumnaFunnel`).
- **Medido antes de escribir el backfill:** con la regla vieja y la nueva, los pagos cobrados caen en el mismo funnel en
  todos los workspaces (ws1: 33, US$74.910; ws11: 7). No movió ningún número de hoy.
- **El trigger y no cada escritura:** los pagos nacen en la ficha, la API de MaKo, los webhooks de Stripe y Mercado Pago y
  el plan de cuotas; uno solo, y sólo llena lo que viene vacío.
- **Lo que no resuelve:** un pago suelto de la venta VIEJA registrado a mano después de agregar al lead a otro funnel se
  guarda en el nuevo (el día de su creación ya estaba ahí). Si pasa, se corrige el `funnel_id` de esa fila.
- ⚠️ **Desde la 0324 (22/10/2026) el trigger ya no adivina**: lo que nace sin CRM va a la casa, y lo de un CRM agregado lo
  escribe su tab Pagos diciendo el CRM (abajo, «Los pagos son de un CRM»).
- **«Firmado» de una renovación: DESCARTADO por ahora (la otra mitad de la tarjeta).** La revisión del 17/10 lo marcó
  como a medias, y es cierto: «Firmado» (`sold_usd`) suma `leads.monto_cierre_usd` en `fecha_cierre`, y un lead tiene
  UN solo trato. Ganar en el tablero de un funnel agregado sólo mueve `lead_funnel.etapa` (`moverEtapaEnProducto`,
  lib/lead-funnel.ts): no hay monto ni fecha de esa renovación en ningún lado, y «corregir el cierre en el deal» la
  cuenta pisando la venta del VSL. Contarla bien pide un trato POR FUNNEL (monto y fecha en `lead_funnel`, una pantalla
  que los pida al ganar ahí, y los cuatro lectores de «Firmado»: objectives-fuentes, graficos-datos, pagos y el desglose)
  y mueve el número de Revenue de todo el negocio. Para medir renovaciones, el OKR va con «Cobrado», que con esta
  migración ya cae en el funnel correcto. Si se retoma, empieza en lib/lead-funnel.ts y en `hechosDelPeriodo`
  (lib/objectives-fuentes.ts), con un `Hecho.funnel` explícito como el de los pagos.

**Vive en:** supabase/migrations/0310_pagos_funnel.sql · lib/funnels-elegidos.ts · tests/pagos-funnel.test.ts ·
*17/10/2026, chat «CRM» (claude4).*

## 5 · Los pendientes del 17/10 (B4)

*Corrida «Implemente todos los pendientes al 100%», agente B4, 17/10/2026, rama `pend-b4-1710`.*

### Marcar a mano una cuota cuyo link ya se cobró contaba la plata dos veces

⚠️ **APAGADO desde la revisión adversarial del 17/10** (interruptor en `false`; los defectos que la frenaron y lo que hay que arreglar, en docs/relevo/pagos.md → «APAGADOS»).

- **Síntoma.** El cliente paga el link; antes de que el aviso o el cron lo asienten, el closer marca la cuota a mano.
  `marcarPago` anulaba el link (ya pagado) y, al llegar el aviso, el pago entraba como OTRA cuota cobrada.
- **El diagnóstico obvio era el equivocado: «frenar la marca si la cuota tiene un link».** Eso traba la cuota para siempre
  si el pago entró por otro monto (lo decía §4). Lo que no traba nada es **preguntarle a la pasarela antes**.
- **La regla.** `marcarPago(…, true)` y `cobrarCuota` llaman a `asentarLinkPagadoDeCuota` (lib/cobros.ts): primero repara el
  link `pagado` en MaKo cuya cuota no se asentó (sin red), después le pregunta a Stripe o Mercado Pago por los vivos
  (`pagoDelLinkEnLaPasarela`, la MISMA lectura del cron). Si cobró, la cuota queda con ESE pago (y su fecha) y la marca a
  mano no se hace («Ya pagada por link»). Si no cobró o no contesta, se marca como siempre. La pasarela misma no vuelve a
  preguntar (`mirarLinks: false`).
- **Lo que queda.** Si la pasarela no contesta en ese instante y el aviso llega después, sigue entrando como otra cuota,
  con el aviso «la plata entró dos veces» (a la vista, no escondido).
- **Vive en:** lib/pagos.ts (`marcarPago`, `cobrarCuota`, `linkYaPagado`) · lib/cobros.ts · tests/pagos-link-ya-pagado.test.ts
  (el doble de lib/cobros.ts va en la caché de CommonJS por su ruta entera: `import()` dentro de un módulo pasa por el
  cargador de ESM, que NO usa el `Module._load` interceptado sino `Module._cache`).

### Las lecturas de cobranza cortaban en 1.000 cuotas

El Outstanding, «A quién cobrarle», las cuotas por vencer, el cash del período y los desgloses del Revenue leían `pagos`
de un tirón. Ahora pasan por `leerTodo`; las cuotas por vencer, con orden único (vencimiento + id). El reintento sin
`funnel_id` (mig 0310) pasó a un `.catch` porque `leerTodo` TIRA con el mensaje de PostgREST en vez de devolver `error`.
**Vive en:** lib/pagos.ts · tests/cobranza-paginada.test.ts.

### La próxima renovación de una suscripción de la pasarela sale de su último cobro

`cobradoDelLead` proyectaba mes a mes desde `fecha_cierre`; Stripe y Mercado Pago cobran el día en que se autorizó. Ahora
el ancla es el último cobro asentado de la pasarela (cuota con `proveedor` y `fecha_pago`); sin uno, el cierre.
**Vive en:** lib/cobrado-lead.ts · tests/cobrado-lead.test.ts.

### Medido: el `in` sobre `ctx->>cuotaId` no traba guardar cuotas

El riesgo anotado (docs/relevo/crm-tanda-b1.md, b2) era que PostgREST rechazara el `.in('ctx->>cuotaId', …)` de
`proteccionesDeCuotas` y, como falla cerrado, nadie pudiera guardar cuotas ni cerrar en Ganado. **Medido el 17/10 contra
producción (sólo lectura): 200**, y un `in` sobre un camino jsonb filtra bien (lead 23: con su correo, 1; con otro, 0).
`flujo_corridas` tenía 0 filas ese día. Lo que queda es una falla pasajera: contesta el error y se reintenta.

### Identidades fiscales: sólo el admin

La pantalla ya era del admin, pero `saveIdentidadFiscalAction` y `deleteIdentidadFiscalAction` son server actions: una
puerta propia que un closer podía llamar. Ahora cortan con el rol efectivo `admin`. Leerlas sigue abierto (el deal las
muestra). **Vive en:** app/crm/[id]/deal-actions.ts · tests/identidades-fiscales-admin.test.ts.

### La moneda del negocio tiene pantalla

Configuración del negocio → Identidades fiscales (`MonedaNegocioPanel`), con las acciones de siempre (sólo el admin la
cambia; si guardar falla, vuelve a la anterior). **Vive en:** app/configuraciones/MonedaNegocioPanel.tsx ·
tests/moneda-negocio-pantalla.test.ts.

## Devolver la fecha de una cuota exige devolver su dedup de cobranza (17/10/2026)

- **Síntoma** (revisión del Deshacer del CRM): un movimiento del wizard reprogramó una cuota y después se deshizo. La cuota volvió a quedar vencida y el cron mandó un SEGUNDO «cuota vencida» por la misma deuda, con una cadencia nueva.
- **Causa:** reprogramar una cuota pasa sus marcas `cuota-vencida`/`cuota-por-vencer` a epoch (`olvidarAvisosDeCuotas`, `lib/pagos.ts`), para que la fecha nueva vuelva a avisar. El Deshacer devolvía la fecha con un update directo y la marca quedaba en epoch.
- **Regla:** todo lo que escriba la fecha de una cuota sin pasar por la reconciliación ni por `editarCuota` tiene que dejar el dedup coherente con esa fecha. Para volver atrás: `leerMarcasDeCobranza` ANTES y `reponerMarcasDeCobranza` después. Es compare-and-set contra `DEDUP_OLVIDADO` (`marcaAlDeshacer`, `lib/cobranza.ts`), así que un aviso que salió en el medio gana. El detalle del Deshacer está en `hallazgos-crm.md`.

## Marcar un cobro dos veces lo cambiaba, y la ficha contaba «hoy» en UTC (20/10/2026)

**Vive en:** `marcarPago` y `cobrarCuota` (lib/pagos.ts) · las acciones `marcarPagoAction` (app/crm/actions.ts) y
`marcarPagoManualAction` (app/crm/[id]/deal-actions.ts) · `marcar_pago_cobrado` (lib/api-mako/areas/crm.run.ts) · las
pantallas que marcan: General, el teléfono, las dos del Dashboard y la tab Pagos. Test:
tests/pagos-cobro-idempotente.test.ts, que corre las funciones reales contra una base de mentira con el reloj a las 20 h
de México.

- **Síntoma:** se encontró armando «A quién cobrar» en el chat (la 2.27). Una lista guardada se toca días después.
- **Causa 1:** `marcarPago(id, true, fecha)` no miraba si la cuota ya estaba cobrada. Pisaba `fecha_pago`, el cobro
  saltaba de mes (y el Cash con él) y el historial decía «Pago registrado» otra vez. `cobrarCuota` le reescribía además
  el monto y la moneda al cobro que ya había entrado. Pasaba con cualquier lista vieja: General en dos pestañas, el
  Dashboard, una tarjeta de MaKo confirmada hasta dos horas después de proponerla (`preparar` mira el estado, pero
  `ejecutar` no lo volvía a mirar).
- **Causa 2:** el Deshacer del toast, después de un «ya estaba», habría desmarcado el cobro de OTRO. Y desmarcar dos
  veces un pago que nació cobrado podía QUITARLO (`quitarSiNacioCobrada`).
- **Regla:** los dos no tocan nada si la cuota ya está como se pide, y devuelven `yaEstaba`. Las acciones vuelven antes
  del historial. Las pantallas dicen «Ya estaba cobrada» o «ya estaba sin cobrar», sin Deshacer. MaKo contesta que no
  cambió nada. Ninguna pantalla vuelve a cobrar una cuota cobrada a propósito: para corregir un cobro, se desmarca o se
  edita la cuota.
- **Causa 3, el «hoy» en UTC:** FichaPorBloques y PagosCliente usaban `new Date().toISOString().slice(0, 10)`. Los modales
  «Marcar pagada» y «Registrar pago» proponían ese día, y `marcarPago` y `savePlanPagos` lo usaban de default. De 18 a
  24 h en México ya es mañana: la ficha daba vencida una cuota que vence hoy, y un cobro de la noche caía al día
  siguiente. Ahora es el día del negocio: `hoyEnTz(useTzWorkspace())` en la ficha (la zona de General, `tzActual`) y
  `hoyEnWorkspace()` en el server. `_getOutstandingDetalle` y `_getCuotasPendientes` ya no tienen un `hoy` por default.
- **⚠️ Fuera de Pagos quedan días fijos en Tijuana**, que no son UTC pero tampoco son la zona del negocio:
  app/crm/actions.ts:497 y :1807 (los requisitos para mover de etapa y el export de leads; son del CRM) y
  app/m/dashboard/page.tsx:44 (los períodos del teléfono, que copian los de escritorio; son del Dashboard). **Sin hacer.**

### Lo que encontró la revisión adversarial de ese arreglo (20/10/2026, noche)

- **«Ya estaba» leído en memoria no alcanza: dos cobros A LA VEZ pasaban los dos.** `marcarPago` leía `pagado`,
  comparaba y escribía sin condición. Con General en la computadora y en el teléfono, las dos marcas pasaban, la segunda
  pisaba la fecha, y las dos ofrecían Deshacer. En `cobrarCuota` era peor, y nuevo del arreglo: escribía el monto y la
  moneda ANTES de marcar e ignoraba el `yaEstaba` de su `marcarPago` interno. Con MaKo cobrando 300 mientras la ficha
  guardaba 500 en pesos, la cuota quedaba mezclada, sobraba una cuota pendiente de 200, el historial anotaba una fecha
  que no quedó, y lo cobrado del lead quedaba desfasado. **Regla:** la escritura es condicional (`siSigue`: sigue
  impaga para cobrar, sigue cobrada para desmarcar) y mira cuántas filas tocó (`.select('id')`). `cobrarCuota` escribe
  el cobro ENTERO en esa sola escritura, y lo de después (sincronizar, cortar recordatorios, anular links) va en
  `trasCobrar`, el mismo para los dos. Si la diferencia pendiente no se puede guardar, la cuota vuelve a como estaba,
  impaga.
- **La trampa de la condición al revés:** la primera versión le pasó a `siSigue` el estado al revés. Para cobrar pedía
  «cobrada», y ninguna marca escribía: todas devolvían «ya estaba». La agarró el test de la carrera, que mira que gane
  exactamente uno, no sólo que el segundo pierda.
- **La cartera de Clients contaba vencidas en UTC y con `<=`** (lib/cs-cartera.ts), y la deuda vencida del Dashboard la
  copiaba (`filasCartera`, lib/graficos-datos-extra.ts). Una cuota de HOY salía vencida a cualquier hora («Cuota vencida
  hace 0 días» en MaKo y en CS), mientras la ficha, General y el cron decían «vence hoy». Ahora usan el día del negocio y
  `<`, como `getCuotasPendientes`, y los días se cuentan de calendario contra ese día.
- **El asistente de Ganado armaba el plan con el día UTC** (app/crm/StageMoveDialog.tsx). Un pago único de la noche
  proponía la cuota para mañana. «+ Agregar cuota» sin cuotas arrancaba del instante UTC. Ahora todo sale de
  `hoyEnTz(useTzWorkspace())`. ⚠️ **«Noviembre sin cuota» NO era el UTC** (corregido el 21/10): era el desborde de fin de
  mes, que pasa con el día correcto también. Está en la entrada de abajo.
- **La hora del cobro era la del navegador** y el día, el del negocio: alguien en Buenos Aires anotaba un cobro de México
  con el día de allá y la hora de acá. Ahora la hora también es la del negocio (`horaEnTz`, lib/date-utils.ts).

### La segunda revisión: los bordes del cobro y los meses del asistente (21/10/2026)

- **⚠️ El asistente de Ganado saltaba meses en una suscripción cerrada un 29, 30 o 31, con el día que sea.**
  `sumarMesesISO` hacía `new Date(y, m - 1 + n, d)` sin tope. Cerrada el 31/10, las cuotas nacían el 01/12, 31/12, 31/01,
  03/03, 31/03, 01/05…: noviembre, febrero, abril, junio y septiembre sin cuota, y otros meses con dos. «+ Agregar
  cuota» desbordaba igual (31/01 → 03/03). El diagnóstico del 20/10 («el día UTC») era el obvio y el equivocado: arreglar
  el día no lo arreglaba. **Regla:** los meses se suman con `sumarMeses` (lib/cobrado-lead.ts), la de las suscripciones,
  que topa al último día y cuenta siempre desde el cierre (31/10 → 30/11 → 31/12 → 31/01 → 28/02).
- **La primera cuota del asistente abierto desde el tablero nacía con el día de Tijuana.** El tablero no monta nada que
  pida la zona, `useTzWorkspace` arranca en Tijuana y `useState` se quedaba con ese primer valor: en México, a las 00:30
  la cuota nacía ayer, vencida. Ahora, cuando llega la zona, se corre la fecha que nadie tocó.
- **`cobrarCuota` podía quedar a medias, y el reintento decía «ya estaba».** Tomaba la cuota y DESPUÉS leía las cuotas e
  insertaba la diferencia. Un error en el medio la dejaba cobrada sin su diferencia y sin sincronizar, y el reintento no
  lo curaba. Además, devolverla a impaga cuando fallaba la diferencia volvía mentira el «ya estaba cobrada» que otra
  pantalla acababa de mostrar. **Regla:**
  - ~~lo que acompaña al cobro (la diferencia) va ANTES de tomar la cuota~~ **superado el mismo 21/10:** dejaba una
    cuota FANTASMA (ver «La tercera revisión», abajo). Ahora el cobro y la diferencia van en una transacción;
  - el número de la diferencia se renumera una vez si otro escritor lo tomó (23505);
  - el «ya estaba» CURA lo de después (sincronizar, cortar recordatorios), que se puede repetir.
- **La pasarela marcaba sin condición una cuota recién cobrada a mano.** Si la transferencia a mano llegaba entre su
  lectura y su escritura, la pisaba: dos pagos se veían como uno. Ahora la marca de la pasarela va con la misma escritura
  condicional, y si la cuota ya no estaba impaga, el pago entra como una cuota nueva (las dos se ven).

### La tercera revisión: la diferencia fantasma, el plan que se rehacía y el mes corrido (21/10/2026)

- **⚠️ Dos escrituras desde PostgREST no tienen un orden seguro.** La diferencia DESPUÉS de tomar la cuota: un error en
  el medio la dejaba cobrada sin su diferencia (o había que devolverla a impaga). ANTES: un error en la toma, o una
  respuesta perdida, la dejaba como una cuota pendiente FANTASMA con el vencimiento de la cuota. La cobranza se la
  reclamaba al cliente, era idéntica a la real (nadie podía saber cuál quitar) y el reintento agregaba otra. El
  diagnóstico obvio («cambiar el orden») era el equivocado: los dos órdenes dejan un estado malo. **Regla:** el cobro
  de menos va en UNA transacción, `cobrar_cuota_con_resto` (supabase/migrations/0318, `cobrarConResto` en lib/pagos.ts).
  Si la respuesta se pierde con todo escrito, el reintento ve la cuota cobrada y la diferencia está una vez. Sin la
  función, no se escribe nada y se dice («falta la migración 0318»). El cobro entero sigue siendo una sola escritura
  condicional. La base de mentira de los tests tiene una copia en JS de la función (tests/_postgrest-de-mentira.ts),
  fijada contra el .sql.
- **⚠️ Volver a confirmar el asistente de Ganado sobre una suscripción ya cerrada rehacía TODAS sus cuotas desde hoy**
  (alta, estaba en producción). Pasaba con «Completar datos», al pasar a Facturando o al volver a Ganado. La
  reconciliación por orden actualizaba las impagas e insertaba de más: 15 cuotas para un plazo de 12, la deuda inflada
  y la vencida escondida. Con la mensualidad vacía, se borraban todas. **Regla:** el plan se arma una vez. El server
  (`completeStageMoveAction`) no lo rehace si el lead ya tiene cuotas, y el asistente no lo manda. Para cambiarlo está
  la tab Pagos. ~~(un pago suelto no cuenta)~~: SÍ cuenta, ver la cuarta revisión abajo.
- **El plan del asistente empezaba un mes después del cierre, y lo cobrado cuenta el día del cierre como el primer mes**
  (`cobradoDelLead`, el inicial de `cuotasDelPlan`): un cliente al día quedaba para siempre en «Falta registrar 1 mes».
  Ahora la primera cuota es el día del cierre. Un test cruza el plan con `cobradoDelLead` en cuatro fechas.
  **⚠️ Sin hacer:** las suscripciones que el asistente YA armó tienen sus cuotas corridas un mes y siguen en ámbar.
  Hay que medirlas (sólo lectura: suscripción a plazo, cuota 1 = cierre + 1 mes) y decidir si se corren.
- **La pasarela no curaba su propio «ya estaba».** `curarDespues` sincronizaba antes de cortar: si sincronizar fallaba,
  los recordatorios y el otro link seguían vivos, y el reintento del webhook volvía «ya estaba» sin curar. Al cliente
  que pagó le seguían llegando recordatorios y podía pagar dos veces. Ahora corta primero (`trasCobrar` no tira), y el
  «ya estaba» de la pasarela corre `curarDespues` con la fila que encontró.
- **El casamiento por monto probaba sólo la primera impaga.** Si alguien la cobraba a mano en el medio, el pago entraba
  como cuota nueva aunque quedara otra del mismo monto. Ahora prueba de a una, en orden.
- **«+ Agregar cuota» sumaba desde la anterior.** Después de un 31, el día bajaba y no volvía (31/01 → 28/02 → 28/03).
  ~~Ahora cuenta desde la primera.~~ Contar desde la primera por posición rompió otra cosa: ver la cuarta revisión.
- **La fecha de cierre se escribía con el día UTC** (`updateLead`, lib/leads.ts). Un Ganado de las 19 h en México
  cerraba mañana, y la venta del 31 contaba en el mes siguiente. Ahora es `hoyEnWorkspace()`.

### La cuarta revisión: un pago suelto SÍ es parte del plan, y la 0318 nacía abierta a la clave pública (21/10/2026)

- **⚠️ «Un pago suelto no es un plan» era el diagnóstico equivocado** (alta). Una suscripción registrada mes a mes (tres
  mensualidades sueltas, sin cuotas de plan) que se abría desde el TABLERO para cargar el teléfono recibía 12 cuotas
  MÁS desde hoy: 15 para un plazo de 12, $6.000 pendientes de un cliente al día y «Cuota vencida» al otro día. Y el que
  pagó el primer mes suelto y se arrastraba a Ganado tenía la cuota de hoy impaga encima del mes ya cobrado. Desde la
  ficha el mismo lead no recibía plan (ahí `tienePlan = pagos.length > 0`): el resultado dependía de por dónde se
  abría. **Regla:** decide UNA función, `planDelAsistente` (lib/pagos-campo.ts), en el server. Con un plan (una cuota
  que no nació cobrada, o una impaga) no se toca. En una suscripción, los meses cobrados sueltos SON las primeras
  cuotas ~~(uno por cobrada, como cuenta `cobradoDelLead`)~~ (por PLATA: ver la quinta revisión) y se arman sólo los que faltan. Un pago único con un pago
  previo no se arma: sus cuotas las escribió la persona y no se puede saber si ya descontó lo cobrado. Nunca nace una
  cuota por un mes ya cobrado.
- **Lo que el asistente no hacía, lo callaba.** El server descartaba el plan con un `console.log` y la pantalla decía
  que había guardado; el `sinTocar` de las cuotas con un link sin pagar tampoco lo mostraba nadie. Ahora el asistente
  (StageMoveDialog) muestra `sinTocar` en una pantalla aparte, con un solo botón que cierra y NO vuelve a confirmar.
- **El tablero no sabe si el lead tiene pagos** (`leadToMoveInfo` no trae `tienePlan`), y su cálculo local pedía «Plan de
  pagos» siempre, aunque el server no lo pidiera. Sin el dato, ese paso lo decide sólo el server, que lee los pagos.
- **El plan de la suscripción salía de hoy y no del cierre.** Armado días después del Ganado («Guardar y completar
  después»), el cliente que pagaba a tiempo quedaba en «Falta registrar» del 1 al 20 de cada mes. El server ancla las
  fechas en `fecha_cierre` (hoy sólo si el cierre es este mismo movimiento). Y la suscripción manda su plan sólo al
  cerrar o si el asistente preguntó la mensualidad o el plazo: «Completar datos» por el teléfono lo mandaba entero.
- **«+ Agregar cuota» contando desde la primera por posición** ignoraba el día elegido (anticipo el 21, mensualidades el
  05: proponía el 21/12) y, al quitar una del medio, repetía una fecha. Ahora es `siguienteFechaDeCuota`
  (lib/cobrado-lead.ts): la más tardía + 1 mes, en el día de la primera mensualidad, con el tope de fin de mes.
- **⚠️ Trampa del entorno: la 0280 NO hace que las funciones nuevas nazcan cerradas.** Su `alter default privileges …
  in schema public revoke execute … from public` es por esquema, y un revoke por esquema no saca el EXECUTE que da a
  PUBLIC el default GLOBAL; anon lo hereda por PUBLIC. La 0318 sin revoke nacía con `{=X/postgres,…}`: la clave pública
  entraba a la función (hoy sin daño: es invoker y `pagos` tiene RLS sin políticas). Medido en Postgres 16 con
  `has_function_privilege`. **Regla:** toda función nueva lleva su `revoke … from public, anon, authenticated` y su
  `grant … to service_role`, con el assert en el test (tests/pagos-cobro-idempotente.test.ts, 7). El arreglo de fondo
  (el default de la 0280 y la 0310) es de Infra.
- **El `for update` de la 0318 va `order by id`**, el orden en que toma las filas el delete de la reconciliación: en otro
  orden, los dos podían esperarse y Postgres abortaba a uno (40P01).

### La quinta revisión: lo cobrado suelto se cuenta por plata, y lo que gana lleva su fecha de cierre (21/10/2026)

- **⚠️ Contar FILAS no es contar MESES.** «Un suelto = una mensualidad» se cumplía con el mes a mes y con nada más: un
  adelanto de US$1.500 en una suscripción de US$500 cubría UN mes (se armaban 11 cuotas, dos por meses pagados; la
  ficha sumaba US$7.000 sobre 6.000 y la cobranza le reclamaba a quien pagó), y una seña de US$100 cubría un mes ENTERO
  (los 400 que faltaban no se cobraban nunca, en verde). **Regla:** lo cobrado suelto se cuenta por plata con
  `mesesDePlata` (lib/cobrado-lead.ts): meses enteros de la mensualidad, con ~~un 10% por mes~~ un 10% de UNA
  mensualidad de tolerancia (el tipo de cambio; ver la revisión de abajo). Lo usan los DOS que cuentan: el asistente (`planDelAsistente`: con meses partidos, o pagos de más de un mes
  antes del cierre, no arma y lo dice; cuando descuenta, dice cuántas armó) y la ficha (`cobradoDelLead`, el
  «Falta registrar»). Con uno solo cambiado, el cliente que adelantó tres meses quedaba para siempre en «Falta registrar».
- **Qué es un plan lo decide UNA función, `pagosPrevios`** (lib/pagos-campo.ts). Una cuota devuelta o de baja
  (`noEsDeuda`) no es un plan: antes hacía decir «Ya tenía un plan» de uno que no existía, y nadie lo armaba. El cobro de
  un link que no saldaba ninguna cuota es plata suelta (~~la pasarela inserta esa fila sin `nacio_cobrada`~~: desde la
  revisión de 7524ec1c9 la inserta CON la marca, ver abajo).
- **El plan uniforme (`savePlanPagos`, la API `guardar_plan_pagos`) tapaba una cuota con una seña.** En el modo 'slots'
  «una pagada cubre su número», y la seña de US$100 con el número 1 tapaba la cuota 1 de US$1.000: la API contestaba
  «Listo» con US$900 menos. ~~Ahora un pago que nació cobrado no cubre un número~~ (era el diagnóstico equivocado: ver
  la revisión de abajo), y sin plan no se arma encima de plata suelta (`avisoPlanUniforme`): MaKo no lo propone y
  `savePlanPagos` lo frena.
- **⚠️ Lo que gana sin `updateLead` tiene que escribir su fecha de cierre.** `saveLeadPlanManual` gana el lead (estado y
  `cerro`) pero no ponía `fecha_cierre`; después `setPipelineStage` lo veía ya ganado y no tocaba la venta. Una
  suscripción ganada desde el asistente con su plan quedaba sin cierre: fuera de los cierres del mes (el CAC), activa
  para siempre en el MRR y sin «Terminó». Ahora, sin una que venga ni una que tenga, el día del negocio. Medido en
  producción el 21/10 en sólo lectura: 0 leads así (el camino nació el mismo día).
- **La revisión de f2ec0c948 (21/10/2026): el arreglo de la seña era una regresión, y dos medios.**
  - **⚠️ En 'slots' el «número» es el LUGAR en el plan, no el de la fila.** Sacar la seña de las pagadas que cubren un
    número parecía el arreglo, y era el diagnóstico equivocado: el plan armado DESPUÉS de una seña vive en números
    corridos (la seña es la #1 y las cuotas, #0, #2, #3, #4), así que cada «Cambiar el plan» de la ficha insertaba una
    cuota de más (el número 1 ya no tenía a nadie) y dejaba la última sin tocar: US$1.000 de deuda fantasma por cambio,
    acumulable, con «Plan guardado» en pantalla. Y el total «bien» de main era un error que se compensaba (con la cuota
    a 1.200 daba 4.400 en vez de 4.600). **Regla:** `reconciliarCuotas` en 'slots' casa la cuota N con la N-ésima del
    plan (sin las que no son del plan, `esCuotaDelPlan`, ni las devueltas; el inicial es el lugar 0).
  - **La tolerancia de `mesesDePlata` es fija (10% de UNA mensualidad).** Multiplicada por los meses, las ventanas se
    pisaban desde 4,5 mensualidades y todo monto daba «meses enteros»: un año prepagado a −5% contaba 11 meses.
  - **Qué es plata suelta lo dice UNA función, `esPlataSuelta`** (lib/cobrado-lead.ts), para la ficha y el asistente: el
    cobro de un link de US$1.500 contaba 3 meses en el asistente y 1 en la ficha, que pedía «Registrar el mes cobrado».
    `cobradoDelLead` devuelve `mesesCubiertos`, y «A quién cobrar» vence desde ahí (no desde las filas: con un adelanto
    en un pago, el cliente desaparecía de la lista del mes).
- **La revisión de 7524ec1c9 (21/10/2026): dos altas.**
  - **⚠️ Una mensualidad registrada vale UN mes; la plata cuenta sólo para un pago que cubre VARIOS.** Contar «por plata»
    sumando TODAS las sueltas y pasando el total por `mesesDePlata` acumulaba el desvío de cada mes (el tipo de cambio,
    un descuento, el precio de antes): 6 × 490 eran 5 meses («Falta registrar 1 mes» y US$500 en «A quién cobrar» a un
    cliente al día) y 10 × 550 eran 11 (escondía al que debe el mes 11). Era una regresión contra producción, que cuenta
    filas. **Regla:** de a una cobrada, `mesesDeUnaCobrada` (lib/cobrado-lead.ts): una cuota del plan, 1; la diferencia
    de un cobro por menos, 0 (completa el mes de su cuota); una suelta registrada a mano, `max(1, mesesDePlata(su
    monto))`; una de la PASARELA (el cobro de un link sin cuota), `mesesDePlata(su monto)` sin el mínimo: nadie la
    registró como un mes, y una seña de 100 por link no cubre ninguno (con el mínimo valía un mes: lo preguntó el Cerebro
    y era así). Nunca la suma. El asistente cuenta igual, y no arma si alguna no son meses enteros. Lo aceptado: la ficha
    cuenta como un mes una seña de 100 registrada A MANO, como producción (no se distingue de una mensualidad con
    descuento); el asistente no la descuenta.
  - **⚠️ «Es cuota del plan» es UNA regla, y la fila dice de dónde nació desde que se inserta.** Había tres: el aviso
    tomaba como plata suelta la seña cobrada por LINK y el lugar del plan la tomaba como la cuota 1 (la cuota a 1.200
    daba 4.400 en vez de 4.600, y cambiar el día dejaba noviembre sin cuota y dos en enero); la diferencia de un cobro
    por menos ocupaba el lugar de la cuota siguiente (crecer el plan y cambiar el día la reescribía como la cuota 4:
    US$600 de deuda fantasma que la cobranza reclamaba). Excluir por `nacio_cobrada` tapaba una puerta sola, y excluir
    por `proveedor` era el diagnóstico equivocado: una cuota del plan cobrada por link también lo tiene. **Regla:**
    `esCuotaDelPlan` (lib/cobrado-lead.ts) = sin `nacio_cobrada` y sin `resto_de`; la usan el lugar de 'slots',
    `esPlataSuelta` y `avisoPlanUniforme`. `registrarCobroDeProveedor` inserta el cobro de un link sin cuota con
    `nacio_cobrada` (deshacerlo no lo quita: `quitarSiNacioCobrada` no toca lo de la pasarela), y la diferencia la
    marca `cobrar_cuota_con_resto` (mig 0323, `pagos.resto_de`: la cuota de la que salió). SIN clave foránea: con
    `on delete set null`, el Deshacer de un movimiento del tablero (borra y reinserta cuotas con su id) le sacaba la
    marca para siempre y la deuda fantasma volvía. Medido en producción el 21/10, sólo lectura: 0 filas de la pasarela y
    0 diferencias, nada que rellenar.
  - **La toma exige el monto que se LEYÓ** (mig 0323, `p_original`; el «Sin hacer» de la quinta revisión). Editada de
    500 a 400 entre la lectura y el rpc, un cobro de 300 dejaba 300 cobrados + 200 pendientes de una cuota de 400. Ahora
    no se toma y se dice; el cobro ENTERO, igual (`.eq('monto_usd', original)`): es la misma carrera por la otra puerta.
    `p_original` tiene default null para que el código de antes del deploy siga llamando con 11 argumentos, y la firma
    vieja se borra en la misma transacción (con las dos, PostgREST no sabría a cuál llamar).
  - **⚠️ Lo que se registró COMO la mensualidad vale un mes, siempre** (revisión de e19a5196f, medio: regresión). Contar
    por plata lo de a mano, con el mínimo de un mes, sólo andaba si el precio SUBÍA: con una BAJA (6 mensualidades de
    1.000 y la mensualidad ya en 500) eran 12 meses, «Al día» y fuera de «A quién cobrar», donde producción decía
    «Falta registrar 5 meses». El monto no dice cómo se registró; la fila sí: `pagos.es_mensualidad` (mig 0323), que
    pone «Registrar el mes cobrado» (las de antes, por su concepto «Mensualidad»: 1 fila en producción, ws 11). La plata
    cuenta sólo para «Registrar un pago» y la pasarela, con el mínimo de un mes (sin el mínimo, un link de un mes al tipo
    de cambio del día valía 0 y a mano 1).
  - **Trampa de los tests:** el PostgREST de mentira insertaba sin los defaults de la base (`pagado` quedaba en null) y
    las escrituras condicionales (`.eq('pagado', false)`) no encontraban las cuotas: «Cambiar el plan» no cambiaba nada
    y parecía que el arreglo no andaba. Los defaults del hijo (tests/_cobro-idempotente-hijo.ts) son los de la base.
  - **Sin hacer:** los modos 'lista' (el wizard) y 'porId' (Editar deal) no miran `resto_de`: casar por orden puede
    reusar una diferencia como cuota del plan y la marca le queda. Vive en `reconciliarCuotas` (lib/pagos-campo.ts).
    Y «A quién cobrar» lee los pagos de hasta 500 suscripciones de una vez, sin paginar: pasadas las 1.000 filas,
    PostgREST corta y la lista no da el número de la ficha (viene de producción). Vive en `getSuscripcionesPorCobrar`
    (lib/pagos.ts).
- **No tomar la cuota no siempre es «ya estaba».** Si la reconciliación de un plan la BORRABA entre la lectura y el cobro,
  `cobrarCuota` contestaba «ya estaba cobrada» y el cobro que sí entró no quedaba anotado. Ahora mira cómo quedó:
  cobrada, «ya estaba»; si no, «La cuota cambió mientras la cobrabas» y no se escribe nada.
- **Menos de un centavo no es «sin monto»**: 0,004 caía como el cobro entero (o en 0, y la deuda desaparecía).
- **El tablero pide «Plan de pagos» con el tipo de venta que se ELIGE**, no el guardado: un lead guardado como
  suscripción al que se le eligió «Pago único» se ganaba sin cuotas.
- **Sin hacer:**
  - ~~La 0318 toma la cuota sin ver si su MONTO cambió entre la lectura y el rpc.~~ Hecho en la 0323 (revisión de
    7524ec1c9, arriba), con la marca de la diferencia en la misma migración.
  - Medido en producción el 21/10, sólo lectura: un plan del asistente viejo corrido un mes (la primera cuota un mes
    después del cierre): ws 11, lead 2605, 12 cuotas desde el 08/11 con el cierre el 08/10, nada cobrado. Decide Martín
    con el cliente si octubre se cobró; no se toca sin su OK. Ninguno con cuotas armadas encima de meses cobrados.

## El lector de contratos también convertía con una tasa inventada (21/10/2026)

- **⚠️ El plan de una suscripción salió de una tasa que inventó la IA.** El extractor del contrato
  (`CONTRACT_EXTRACT_DEFAULT`, app/api/extract-contract) pedía «todos los montos en USD», convertidos «con un tipo de
  cambio aproximado actual»: 72.000 MXN / 17 = 4.235,29, la mensualidad que quedó en una suscripción del ws11 (lead 2605).
  Es la misma trampa que el lector de comprobantes (ver «La revisión de los bloques», rama pagos-bloques). **Regla:** la
  IA devuelve el total y las cuotas TAL COMO FIGURAN, con su `moneda` (un «$» solo no es USD), y `montosDelContrato`
  (lib/contrato-montos.ts) decide: en dólares van los montos; en otra moneda, el total ORIGINAL y las fechas, y el
  asistente de Ganado dice «el contrato dice MX$72.000: carga cuánto es en dólares» sin dar el plan por resuelto. Un
  prompt viejo guardado en Configuraciones (devuelve `total_usd`, sin `moneda`) puede haber convertido: sus montos no se
  usan y se dice. Test por la ruta REAL: tests/pagos-contrato-moneda.test.ts.
- **La moneda que dice la IA vale para el total, no para las cuotas** (revisión de bc5fb022d, medio). Un contrato
  mexicano dice «US$4,000 total, 12 mensualidades de $6,000 M.N.», la IA dice USD, y las 12 cuotas de 6.000 entraban
  como dólares (72.000 sobre un cierre de 4.000) con el plan dado por resuelto: el asistente se salteaba el único paso
  que mira la suma (`cuotasCuadran`). **Regla:** con el total en dólares, las cuotas traen monto sólo si SUMAN el total,
  con la misma tolerancia del asistente (`toleranciaCuotas`, una sola función para los dos); si no, van sin monto, el
  paso del plan se muestra y se dice que no suman. El copy de /vsl ya no promete la conversión.
- **Cuadrar con el total del CONTRATO no es cuadrar con el CIERRE** (revisión de b23ce2a9c, baja). El plan se guarda
  contra el monto de cierre: con un cierre de 5.000 ya cargado, un contrato de 4 × 1.000 quedaba «resuelto» y el paso
  del plan no se veía (producción hacía lo mismo). **Regla:** lo decide `planDelContrato` (lib/contrato-montos.ts), con
  el monto que va a QUEDAR (el que hay, o el total recién precargado) y la misma tolerancia. Y cada aviso dice lo que
  pasó: «no suman su total» sólo con un total y todas las cuotas con monto; sin total, «el contrato no dice su total»;
  una cuota de 0 se saca en vez de dejar el plan entero sin monto.
- **Sin hacer:** los planes YA armados con montos convertidos así no se corrigen solos. El que se midió (ws11, lead 2605)
  lo decide Martín con el cliente.

## El pago por un link de Stripe PROPIO no entra a MaKo, aunque Stripe esté conectado (21/10/2026)

La campaña del «Sprint de Diseño» de Mauricio (USD 270) cobra en su propio link (sprint.mauriciobustos.com). Lo obvio
sería «conectamos Stripe y MaKo marca Pagó». No: el webhook de Stripe sólo aplica pagos de cobros CREADOS POR MaKo
—los busca por el token del cobro en la metadata, la referencia, la suscripción o el id de pago— y todo lo demás lo
ignora con «no es un cobro de MaKo» (`cobroDelAviso`, lib/cobros.ts; lib/cobros-webhook.ts). No hay match por email
ni por teléfono. Medido el 21/10: el ws1 no tiene claves de Stripe ni de Mercado Pago, `cobros` vacía, 33 pagos
cargados a mano.
**Consecuencia:** quien paga por el link propio sigue «abierto» para MaKo: ni pasa a «Pagó» en el CRM de la campaña,
ni corta una automatización que le siga escribiendo, ni aparece en Pagos.
**Los caminos que sí entran:** «Cobrar con link» desde la ficha (un link de Stripe de MaKo para ESE lead) o el botón
de pago de una landing del Web Generator (`cobrar_producto_landing`, busca el lead por email). Con los dos, el pago
gana al lead en su CRM de ORIGEN (`ganarLead` en la casa): la tarjeta del CRM de la campaña (agregado) no se mueve.
**Sin hacer:** match de un pago externo por email/teléfono. ~~Mover a «Pagó» del CRM agregado al ganar~~: hecho para un
producto vinculado a la etapa Ganado de ese CRM (22/10/2026, ver «Vincular cobro», abajo).
**Vive en:** lib/cobros-webhook.ts · lib/cobros.ts (`cobroDelAviso`, `ganarLead`) · app/crm/[id]/CobrarConLink.tsx.

## Los pagos son de un CRM: el plan de una renovación arranca de cero (22/10/2026, mig 0324)

Llamada con un cliente del 22/10 (Fathom 195129619, 05:00-12:39). Vio dos cosas: el dashboard de Cobros «sólo lee el
funnel original» y no muestra a los clientes de renovación que ya pagaron; y la tab Pagos de un cliente en el CRM de
renovaciones mostraba «cuota 1, cobrada el 01/04», que era de su primer servicio.

- **El diagnóstico obvio del dashboard era el equivocado.** «Cobros sólo lee el funnel original» NO: la hoja «Cobros»
  del ws1 (`general.informe.2`) no tiene NINGÚN filtro de funnel y lee todos los pagos. Medido (sólo lectura): los 34
  pagos del ws1 son del funnel de la casa, y de «Renovación» (5 leads, 2 ganados: los leads 21 y 28) hay **cero**. Las
  renovaciones no aparecían porque **nunca se registraron**: la tab Pagos en el CRM de renovaciones mostraba el plan del
  primer servicio, así que no había dónde cargar el de la renovación. P1 era la consecuencia de P2.
- **La causa real:** el plan colgaba del LEAD, no del par (lead, CRM). La venta y el plan (`monto_cierre_usd`,
  `total_cuotas`, `monto_cuota_usd`, `dia_de_pago`…) están en `leads`, y la tab leía todas las filas de `pagos` del lead.
- **El modelo que queda** (lib/pagos-crm.ts): cada CRM del lead es un TRATO. El de la casa, como siempre (`leads` +
  los pagos que no son de un CRM agregado). El de un CRM agregado: su fila de `lead_funnel` (columnas nuevas de la 0324)
  + los pagos con ese `funnel_id`. `getPagosByLead(lead)` devuelve la CASA (lo que leen la API de MaKo, el asistente de
  Ganado, Customer Success, lo cobrado del lead); `getPagosByLead(lead, crm)`, un CRM; `'todos'` para buscar por id.
  La ficha sabe qué CRM mira por el desplegable de la cabecera (`crmEnVista`) y los bloques de PLATA de Pagos pasan
  por `ctxDelTrato` (app/crm/lead-view/ficha/pagos/trato.ts): lo que se ve y lo que se escribe es de ese trato. Cada
  acción valida el CRM contra el lead (`crmDelTrato`).
- **Trampa 1 · el índice único de las cuotas era por LEAD** (`idx_pagos_lead_numero (lead_id, numero)`, mig 0014): la
  cuota 1 de la renovación no podía convivir con la cuota 1 de la venta. La 0324 lo cambia a `(lead_id, funnel_id,
  numero)`, y por eso **se aplica ANTES del deploy**: sin ella, el plan de un CRM agregado no se guarda y lo dice
  (`faltaIndicePorCrm` → «falta la migración 0324»), en vez de un «duplicate key».
- **Trampa 2 · el trigger de la 0310 adivinaba el CRM por «el último al que se agregó al lead».** Con un CRM de
  prospección masiva (300 agregados al «Sprint 3 días» del ws1 el 22/10, 1.050 en camino), una cuota de la venta de
  siempre cargada por la API o la pasarela habría ido al Sprint y desaparecido de la tab Pagos de la casa. **Regla:** lo
  que nace sin decir su CRM va a la CASA; lo de un CRM agregado lo escribe su tab Pagos, diciendo el CRM. La diferencia
  de un cobro por menos (`resto_de`) va al CRM de su cuota.
- **Lo que no se perdió:** ningún pago cambió de CRM (la 0324 no tiene un `update pagos`). El único pago que ya estaba
  en un CRM agregado (ws11, lead 2632, US$40 cobrado, creado el día que se lo agregó a «Funnel principal») pasa a verse
  en la tab Pagos de ESE CRM. `total_cobrado_usd` sigue siendo lo cobrado del lead en TODOS sus CRMs (lo leen el
  rendimiento de un anuncio, la columna «cobrado» y el export).
- **P1, el selector:** la hoja ya tenía el control «Funnel» (campo `producto`), pero (a) «A quién cobrarle» es un bloque
  de General y `efectivoDe` no lo alcanza: ahora el control de la hoja le llega por `funnelsDeLaHoja`
  (lib/graficos-controles-texto.ts) si el bloque no eligió los suyos; (b) la lista era por LEAD y filtraba por
  pertenencia: ahora es una fila por trato (`OutstandingLead.crm/funnel_id`) y el bloque filtra por el CRM de la fila;
  (c) el desplegable sólo ofrecía funnels con filas en el período: un CRM sin cobros todavía no se podía elegir. Ofrece
  todos (`valoresDeCampo`). La plantilla «Cobros» nace con el control.
- **P3:** «01/04» no se sabía si era día/mes: `fechaEnPalabras` (lib/date-utils.ts) en la tab Pagos y en sus textos
  (`ddmm`, lib/cobrado-lead.ts): «1 de abril», con el año sólo si no es el de hoy.

**Sin hacer** (con dónde vive):
- ~~La hoja «Cobros» YA GUARDADA del ws1 no tiene el control~~ (CO1, 22/10/2026): toda hoja que salió de una plantilla de
  cobros (`plantilla` «cobros» o «cobranza») lo recibe al LEERSE (`conFunnelDeCobros`, lib/graficos-catalogo.ts), en todos
  los negocios, sin escribir nada en producción. **La regla:** lo que una plantilla gana después se le da a las hojas viejas
  en el saneo, no escribiéndolas a mano una por una (eso sólo alcanza a la que se mira).
- Los bloques del DEAL (contrato, datos fiscales, servicio, promesa, obligaciones) siguen siendo del lead en cualquier
  CRM: app/crm/lead-view/ficha/pagos/bloques-deal.tsx.
- Un CRM agregado no tiene suscripción (`lead_funnel_venta_tipo_check`): una mensualidad es de la casa.
- Lo que entra SIN CRM va a la casa: el link de pago libre de la pasarela (`registrarCobroDeProveedor`, salda primero
  una deuda de cualquier CRM por monto), la API de MaKo (`guardar_plan_pagos`, `registrar_pago`) y el asistente de Ganado
  (que es el de la casa). La API no sabe elegir CRM: lib/api-mako/areas/cobros.run.ts.
- ~~«Firmado» sólo sumaba la venta de la casa~~; ~~el teléfono y Customer Success mostraban la casa~~ (CO2, 22/10/2026):
  ver «Una renovación también es una venta», abajo.
- «Links de pago» lista los links del LEAD (`cobros` no tiene CRM) también mirando una renovación; «Movimientos» sí se
  queda con los de SUS cuotas (`cobrosDelTrato`, lib/pagos-crm.ts).

**Vive en:** supabase/migrations/0324_pagos_por_crm.sql · lib/pagos-crm.ts · lib/pagos.ts (`getPagosByLead`,
`crmDelTrato`, `tratosDelLead`, `escribirVentaDeCrm`) · app/crm/lead-view/ficha/pagos/trato.ts · tests/pagos-crm.test.ts.
*22/10/2026, chat «Cobros» (claude3).*

### La revisión adversarial de los pagos por CRM: lo que el primer arreglo tenía mal (22/10/2026)

Cerebro › Integración revisó la punta 05fc52b09 antes de integrarla (2 altos, 6 medios). El patrón de casi todos: **el
primer arreglo partió los pagos en tratos, pero varias puertas seguían suponiendo «sin CRM = la casa»** sin mirar de qué
trato era la cuota que tocaban. Las reglas que quedan:
- **Lo que toca una cuota que YA existe saca el trato de la cuota, no de la pantalla** (`tratoDelPago`). Deshacer un pago
  suelto de una renovación reconciliaba contra la casa, no lo encontraba y lo dejaba como deuda vencida inventada (A1).
  El pago repetido de un link de la cuota de una renovación entra con el `funnel_id` de esa cuota (M6).
- **La pantalla nunca cae a la casa porque le falte el trato** (A2). Después de «Agregar a Renovación» el pop-up sólo
  refrescaba la ruta: seguía con los tratos de antes, mostraba la casa y «Armar el plan» ESCRIBÍA el de la casa. Ahora
  relee al agregar, quitar o mover en un CRM (`onProductosCambiados`), `crmEnVista` sale del CRM que dice la cabecera aunque
  el trato no se haya leído (la tab lo muestra vacío y avisa), y el server valida el CRM.
- **Buscar una cuota por su id es `'todos'`** (M1): MaKo no podía marcar cobrada la de una renovación. Y el estado de
  cuenta de MaKo (`cobranza_lead`) nombra lo que se debe en los otros CRMs: decía «Pagó todo» de quien debía la renovación.
- **La casa es todo lo que no es un CRM agregado, y la casa nunca es un agregado** (M2, M3). Filtrar «la casa» por
  `funnel_id == leads.funnel_id` perdía los meses cobrados en una casa anterior. Y una fila de `lead_funnel` que repite la
  casa (un borrado que falló) la dejaba vacía: `crmsAgregadosDelLead` saca la casa real (`casaDelLead`).
- **Un CRM con plata no se quita ni se borra para siempre** (M4): su venta vive en su fila de `lead_funnel` y sus pagos
  llevan su `funnel_id`. Quitarlo (o quitar la casa, que borra la fila que se promueve) perdía la venta y mezclaba los pagos
  con la casa; borrar el funnel dejaba los pagos en NULL. `tratoConPlata` lo frena con el porqué.
- **Un pago sin cuota de la pasarela casa por monto sólo en la casa** (M5): la mensualidad de Stripe saldaba la cuota de
  una renovación del mismo monto. La cuota de un CRM agregado se cobra con SU link.
- **Bajos que se arreglaron:** «Movimientos» de la casa sin los cobros de sus renovaciones; el semáforo de la suscripción
  con el año cuando no es el de hoy; el nombre en «A quién cobrarle» abre la ficha en el CRM de esa deuda (`?funnel=`);
  `total_cobrado_usd` volvió a contar todos los CRMs.
- **Bajos que quedan (sin hacer):** el «Funnel» de la hoja no llega a «A quién cobrarle» de General si el CRM elegido no
  está entre los primeros 8 (`TOPE_FUNNELS`, app/general/datos.ts); `baja_at` y `pagado_at` toman el día UTC (de antes);
  las variables de pagos de una automatización (`{{lead_proxima_cuota}}`) leen la casa porque el mensaje no sabe su CRM
  (lib/variables-resolver.ts).

**Vive en:** lib/pagos.ts (`casaDelLead`, `tratoDelPago`, `tratoConPlata`) · lib/lead-funnel.ts (`quitarDeProducto`) ·
lib/funnels.ts (`eliminarFunnelDefinitivo`) · lib/api-mako/areas/crm.run.ts · tests/pagos-crm-revision.test.ts.

### La segunda revisión: lo que el lead debe es la venta de la casa menos lo cobrado de ESA venta (22/10/2026, mig 0325)

- **El síntoma:** la primera revisión pidió que `total_cobrado_usd` volviera a contar todos los CRMs (es la caja de esa
  persona: el rendimiento de un anuncio la lee). Bien para la caja, pero dio vuelta el error en todo lo que calcula «lo
  que falta», que restaba esa suma de la venta de la CASA (`monto_cierre_usd`): `{{lead_saldo}}` en los MENSAJES AL
  CLIENTE, «Falta cobrar USD» del export, el filtro «Solo los que deben» y `listar_leads`. Venta de US$2.000, 1.000
  pagados y 500 cobrados en una renovación: «te falta pagar US$500» en vez de 1.000.
- **La regla:** cada saldo compara una venta con lo cobrado de ESA venta. La fila del lead guarda las dos sumas:
  `total_cobrado_usd` (todos los CRMs, la caja) y `total_cobrado_casa_usd` (mig 0325, la venta de la casa), las dos
  escritas por `sincronizarTotalCobrado`. El saldo sale de `faltaDeLaVenta` (lib/pagos-crm.ts), y sin la columna cae a lo
  de antes. El export dice «Cobrado USD» de esa venta, al lado de su «Vendido» y su «Falta».
- **Lo del diagnóstico obvio:** «total cobrado» parece UN número, y son dos. Arreglar uno (la caja) rompía el otro (el
  saldo), y viceversa. Antes de cambiar qué suma una columna, hay que listar QUIÉN la resta de qué.
- **Los bajos de la segunda revisión, hechos:**
  - Las guardas de M4 tienen un texto por caso: quitar un CRM agregado, o quitar la casa cuando el CRM que la reemplaza
    tiene su propia venta. Ninguno sugiere borrar pagos.
  - El borrado definitivo frena sólo la plata de los AGREGADOS de ese CRM y la del funnel del negocio que borraría el
    rescate. La venta de quienes lo tienen de casa se va con ellos, como siempre.
  - El borrado en lote (`quitarLoteDeProducto`, el Deshacer de «Agregar») saltea a quien tiene plata en ese CRM.
  - Con el trato sin leer, la tab avisa y no escribe (`sinTratoLeido`).

**Vive en:** supabase/migrations/0325_cobrado_de_la_casa.sql · lib/pagos-crm.ts (`cobradoDeLaVenta`, `faltaDeLaVenta`) ·
lib/pagos.ts (`sincronizarTotalCobrado`, `leadsConPlataEn`) · lib/variables-del-lead.ts · app/crm/actions.ts ·
tests/pagos-crm-revision.test.ts (la segunda tanda prueba el número del saldo).

### Una renovación también es una venta: «Firmado», el teléfono y Customer Success (22/10/2026, CO2)

- **Lo que faltaba:** desde la 0324 la renovación tiene su venta (monto, fecha y tipo en su fila de `lead_funnel`), pero
  «Firmado» y los cierres sumaban sólo `leads.monto_cierre_usd`. Una renovación ganada no contaba en ningún número.
- **Los lectores son SEIS, no uno:** el Revenue del período (lib/queries.ts), su serie por mes, el objetivo, el desglose
  del Revenue (lib/pagos.ts), los OKR y KPIs «Firmado» y «Cierres» (lib/objectives-fuentes.ts, por funnel con SU funnel), y
  los conjuntos «Negocio» y «Revenue» del Dashboard. Todos leen `ventasDeCrms` (lib/ventas-crm.ts), y la regla de qué es
  una venta es pura (`ventasDeFilas`): ganada en ese CRM, con monto y fecha, no «sin cobro», y nunca la fila que repite la
  casa (sumaría dos veces). Antes de cambiar qué es «lo vendido», hay que enumerar dónde se suma: no hay un solo lugar.
- **El teléfono y CS:** el teléfono suma una fila «Estado de cuenta · <CRM>» por cada CRM con plata; CS, una sección por
  CRM con los bloques de PLATA en el trato de ese CRM (los del deal son del lead).
- **Sin hacer:** el conjunto «Leads» del Dashboard (`filasLeads`) cuenta la venta por lead desde su casa; la renovación no
  tiene fila propia ahí. La ficha del teléfono no cobra en ningún CRM (de antes).

**Vive en:** lib/ventas-crm.ts · lib/pagos-crm.ts (`ventasDeFilas`) · app/customer-success/PagosCliente.tsx ·
app/m/crm/datos.ts · tests/pagos-crm-co2.test.ts.

### La tercera revisión: lo cobrado al lado de un saldo es de ESA venta, y la columna de la casa es un caché (22/10/2026)

- **«Cerrado en cuatro lugares» no era todo.** El saldo ya miraba la venta de la casa en `{{lead_saldo}}`, el filtro, el
  CSV y `listar_leads`, pero dos lectores le ponían AL LADO lo cobrado en todos los CRMs: el export en MD («cobrado
  US$1.500 (75%) · falta US$500» a quien debía 1.000) y `{{lead_cobrado}}` («Pagaste 1.500 de 2.000, te falta 1.000»).
  **La regla:** donde se muestra junto a un saldo o a la venta, lo cobrado es `cobradoDeLaVentaSiHay` (lib/pagos-crm.ts),
  que da null sin dato en vez de inventar «US$ 0». La caja (el cash, el rendimiento de un anuncio) sigue con el total.
- **`total_cobrado_casa_usd` depende de en qué CRMs está el lead**, no sólo de sus pagos: un pago con el funnel de un CRM
  agregado no es de la casa. Agregar, quitar o deshacer cambia ese conjunto, y no re-sincronizaba: un lead re-agregado
  a su CRM viejo dejaba en la columna plata que ya no era de la casa, y el saldo saltaba con el próximo pago. Ahora
  `resincronizarCobrado` (lib/lead-funnel.ts); un lote sólo sincroniza a los que tienen pagos en ese CRM.
- **Un error tragado ahora queda ESCRITO.** `funnelDelNegocio` devolvía null si la lectura fallaba. Antes era un número
  mal en pantalla; con la columna de la casa, sincronizar escribía 0 y el saldo pasaba a ser la venta entera. Tira.
  Y `listar_leads` leía la columna sin mirar `error` (Supabase no tira): caía callado a la cuenta vieja. Ahora null y nota.

**Sin hacer** (decididos, con el porqué):
- `updateLead` reescribe `total_cobrado_usd` de la foto que leyó (lib/leads.ts:1142), y no la columna de la casa: un pago
  entre la lectura y la escritura deja las dos distintas. Es de antes para el total; el saldo sale bien. Sacar los
  derivados del payload toca todos los caminos de `updateLead` (CRM).
- CO2 suma las renovaciones a los cierres del conjunto «Negocio»: el CAC (gasto ÷ cierres) y la tasa de cierre
  (cierres ÷ asistencias) mezclan ventas que no vienen de la pauta. Es una decisión de producto, para Martín.
- `{{lead_saldo}}` y las cuotas hablan sólo de la venta de la casa: a quien la pagó entera y debe la renovación le dice
  «US$ 0». Hoy las etapas de un CRM agregado no disparan automatizaciones; sólo pasa en un mensaje armado a mano.
- «Firmado» por funnel reparte la venta de la casa por el último CRM agregado (`funnelDelMomento`,
  lib/funnels-elegidos.ts): la misma regla que la 0324 sacó de los pagos. Es de antes de CO2.

**Vive en:** lib/pagos-crm.ts (`cobradoDeLaVentaSiHay`) · app/crm/actions.ts (`filaALeadDoc`) · lib/variables-del-lead.ts ·
lib/lead-funnel.ts (`resincronizarCobrado`) · tests/pagos-crm-tercera.test.ts.

### La cuarta revisión: arreglar la columna no arreglaba su propio caso (22/10/2026)

- **Re-sincronizar al agregar adelantaba el salto del saldo.** Un lead al que se le quitó la casa A con pagos conserva
  esos pagos con el funnel A, y hoy cuentan como de la casa nueva. Volver a agregarlo a A (lo hacen solos un optin, una
  reserva de agenda, un formulario de Meta, «Traer») los pasaba al trato de A: con la re-sincronización, el saldo que le
  llega al cliente pasaba en el acto de «te falta US$1.000» a «US$2.000», y quitar no lo deshacía (lo frena la plata).
  **La regla:** agregar tiene el espejo del guard de quitar: un lead con pagos de ESE funnel sin estar en él no se agrega
  (`pagosHuerfanosDe`, lib/lead-funnel.ts); en lote, se saltea y cuenta como fallado. Re-etiquetar los pagos a la casa no
  sirve: choca con el índice de la 0324 si la casa nueva ya tiene su cuota 1. Medido: hoy no hay ningún lead así.
  **Y quien agrega solo tiene que atraparlo** (revisión del 22/10/2026): la reserva de Calendly o Cal.com vinculada a una
  etapa (lib/agenda-evento-etapa-server.ts) lo dejaba subir, y el lead se quedaba sin el aviso de «agendó», sin sus
  automatizaciones de reunión y sin el evento de Meta, con un 500 a Cal.com en cada reintento. El optin, Meta, las fuentes
  y la página de gracias ya lo atrapaban; un pago de «Vincular cobro» cae a la casa (`TienePagosDeEseCrmError`).
- **Una sincronización que falla no corta a los demás**, y sin pagos no se sincroniza (escribía 0 donde había NULL).
- `{{lead_cobrado}}` sin venta en la casa es lo pagado en total: no hay saldo con el que sumar. «Solo con dinero cobrado»
  mira lo cobrado de la venta, como la columna «Cobrado USD» del mismo export.

## «Vincular cobro»: quien paga el producto pasa a Ganado en ESE CRM (22/10/2026, mig 0326)

Punto 3 del feedback de Martín: en el ⋯ de la columna Ganado de un CRM, vincular un producto, cobrable por Stripe y Mercado
Pago a la vez. El CRM dibuja el modal; Cobros hizo el modelo y las acciones (el contrato: contrato-cobro-en-ganado.md en las
notas del Cerebro).

- **Lo obvio era hacer un camino nuevo de cobro, y no hacía falta.** Todo pago de MaKo ya es un `cobros` con lead (el link
  de la ficha, el Botón de pago de una landing). Lo que faltaba era una sola pregunta al aplicar el pago: ¿a qué trato va?
  `prepararTratoDelPago` (lib/cobro-etapa-server.ts) la contesta ANTES de asentar, y `aplicarPagoAprobado` asienta en ese
  trato y gana ahí. Un pago sin vínculo y sin cuotas sigue el camino de siempre (null).
- **Un producto, un CRM** (índice único de la 0326). Si el mismo producto pudiera cobrar en dos CRMs, el pago no sabría en
  qué trato asentarse. Vincularlo a otro CRM dice dónde cobra hoy.
- **Una suscripción se queda en la casa.** Un CRM agregado no tiene suscripción (la 0324). La mensualidad, el MRR y la casa
  ganada siguen como siempre, y además el lead pasa a Ganado en el CRM del vínculo.
- **Un producto en cuotas cobra el PRIMER pago** (`productos.cuotas`, `planDelProducto`). Las cuotas se redondean para abajo
  al centavo y el inicial se lleva el resto: la suma da exacto el precio (US$1.000 en 3 = 333,34 + 2 × 333,33). Con la
  cuota igual para todos, faltaba un centavo. El lead gana por el PRECIO, no por el primer pago (`montoVenta`).
- **Trampa · `upsertProducto` (lib/productos.ts) pisa con null lo que no viene.** Editar el producto desde el modal con esa
  función borraba la promesa, lo que incluye y la garantía del catálogo. El modal edita con un update angosto
  (`guardarProducto`).
- **Trampa · el reintento.** Si el plan se arma y el asiento se corta, el próximo aviso no puede entrar como un pago nuevo
  al lado de una cuota 0 impaga (eso es Outstanding de más y recordatorios a quien pagó). Por eso la venta se escribe con
  una condición (`.is('monto_cierre_usd', null)`), el plan sólo si la venta se escribió recién, y la cuota que se salda se
  busca por número 0 y monto, sea del intento de ahora o del cortado.
- **Asentar en otro CRM no casa por monto con la casa** (`registrarCobroDeProveedor` con `crm`). Si casara, saldaría una cuota
  de la venta de siempre con plata de la renovación.

**Sin hacer** (con dónde vive):
- **El link para pegar sin lead** (`linkDelVinculoAction`) contesta que se cobre con el Botón de pago de una landing o con el
  link de la ficha. Un link sin lead necesita su propia página que pida nombre y email antes de cobrar, como el paso de pago
  de la landing (lib/editor-landing/pago-pagina.ts, que está atado a una landing publicada).
- **Varias cuentas por proveedor:** hoy cada uno tiene una (la principal, `cuentaPrincipal`). Una cuenta más necesita las
  claves con sufijo, el webhook que encuentre la cuenta por su id (`?acct=` ya lo trae en Stripe) y que el cobro guarde la
  cuenta (`cuentaDelCobro` cae en la principal). Lo de Calendly y Cal.com es de Integraciones.
- **El caso del Sprint de Mauricio sigue sin entrar.** Lo cobra con un link de Stripe PROPIO, y el webhook sólo aplica cobros
  creados por MaKo (ver «El pago por un link de Stripe PROPIO…», arriba). Un vínculo no lo arregla: falta casar un pago
  externo por el producto o precio del proveedor y el email.
- **El paso de pago de la landing muestra el precio entero** de un producto en cuotas y cobra el primer pago. Falta que diga
  «en N pagos» (lib/editor-landing/pago-pagina.ts, `precioDe`).

**Vive en:** supabase/migrations/0326_cobro_en_ganado.sql · lib/cobro-etapa.ts · lib/cobro-etapa-server.ts ·
lib/cobros.ts (`aplicarPagoAprobado`, `crearCobro`) · lib/pagos.ts (`registrarCobroDeProveedor`, `crm`) ·
app/crm/cobro-etapa-actions.ts · tests/cobro-etapa.test.ts.

### La revisión adversarial de «Vincular cobro»: el pago se asienta con lo que cobró, no con lo que el producto dice hoy (22/10/2026)

- **El plan salía del producto de HOY.** Un link de US$1.000 creado antes de ponerle 3 cuotas al producto, pagado
  después, armaba el plan 333,34 + 2 × 333,33 y el pago no encontraba su cuota 0: entraba suelto al lado, y quedaba una
  deuda de US$1.000 que no existía. **La regla:** lo que el pago asienta sale de lo que COBRÓ el link. El cobro congela el
  precio y las cuotas al crearse (`cobros.plan_producto`, `planDelCobro`), y el plan sólo se arma si su primer pago es lo
  que se cobró. El tipo también es el del cobro.
- **Un CRM archivado dejaba el pago sin asentar en ningún lado** (ni cash, ni Ganado, ni aviso, durante los 14 días del
  cron): `listarFunnels` filtra los activos y `agregarAProducto` tiraba. Ahora el pago entra en la casa y lo dice en el
  historial; la etapa de Ganado se busca al pagar, no la que se guardó al vincular.
  Lo mismo si lo frena el guard de agregar de la cuarta revisión (tiene pagos de su casa vieja en ese CRM,
  `TienePagosDeEseCrmError`): un guard que protege una pantalla no puede dejar un pago sin asentar.
- **Dos avisos del mismo pago a la vez** (Mercado Pago reentrega en paralelo, el cron se cruza): el segundo no encontraba
  la cuota 0 que el primero estaba armando y asentaba suelto. El trato se RECLAMA en el cobro (`trato_estado`, compare-and-
  set; a los 2 minutos se puede volver a reclamar) y queda escrito al terminar. El que pierde relee o tira y lo completa el
  próximo intento. Lo que se escribe al armar se puede repetir: un intento cortado entre la venta y el plan se completa.
- **Devuelto el primer pago, las cuotas del plan que armó seguían como deuda.** El reembolso total las da de baja
  (`planArmadoPorElCobro` → `darDeBajaCliente` en ese trato).
- **Editar el producto borraba el plazo** si no se mandaba (es opcional en el contrato): el bug del 15/10 por otro camino.
  Editar escribe sólo lo que vino (`patchDeEdicion`).
- **Lo que se aprobaba no era lo que se cobraba:** la API de MaKo resumía con el precio entero y el link cobraba el primer
  pago; y la landing buscaba su pendiente por el precio y no lo reusaba nunca (cada clic, otro checkout).

**Sin hacer:** cuando el pago gana en un CRM agregado, la casa queda abierta, y sus automatizaciones pueden seguir
escribiéndole a quien ya pagó (no se midió). La regla de la casa es de CRM (lib/lead-funnel.ts, `moverEtapaEnProducto`).

### La revisión de plata de «Vincular cobro»: lo que el trato no tiene que cortar (22/10/2026)

- **El reclamo del trato cortaba pasos que no eran suyos.** Con una suscripción de Stripe vinculada llegan dos avisos casi
  juntos. Si el que ganó el pago (`nuevo`) perdía el reclamo del trato, tiraba ANTES de programar el fin del plazo en
  Stripe, y el otro aviso no lo programa (no es `nuevo`): la tarjeta se seguía cobrando pasado el mes 6. **La regla:**
  lo que no depende del trato va antes que él (el plazo y la reapertura de la suscripción). Y «otro aviso lo está armando»
  no es una falla: no se escribe en el `motivo` del cobro (`TratoEnCursoError`).
- **Devolver el primer pago daba de baja TODO lo impago del trato**, aunque otro pago del mismo producto siguiera
  sosteniendo la compra (quien pagó dos veces). Si en ese trato queda otro pago cobrado, no se da de baja: se dice. Una
  devolución que falla deshace la baja que hizo el reembolso (`trato.bajaPorReembolso`).
- **El plan que no se arma se dice.** Un cliente que ya ganó y compra otro producto en cuotas pagaba el primero y las
  demás cuotas no existían en ningún lado. Ahora va al historial y al `motivo` del cobro: «faltan N cuotas de US$X».
- **`Math.abs(a - b) < 0.01` no es «el mismo monto»:** da por iguales 333,34 y 333,33, justo la diferencia que fabrica el
  plan. Se compara al centavo (`mismoCentavo`), también al asentar (lib/pagos.ts).
- **Un pago ya asentado sin trato no arma uno nuevo** (un cobro viejo que vuelve a pasar por el cron): era una venta doble.
- La API de MaKo guarda lo que se aprobó y no cobra otro monto si el producto cambió mientras esperaba. La venta de un
  intento cortado se reconoce por una marca en el cobro (`trato.ventaEn`), no por la fecha (el cron completa otro día).

### La segunda revisión de plata: un aviso que dice «cárgalas» tiene que contar lo que ya está (22/10/2026)

- **«Faltan 2 cuotas: cárgalas en Pagos» aunque ya estuvieran.** Con un pago repetido del mismo producto, o un plan que el
  closer ya había cargado, quien siguiera el aviso cargaba US$666,66 de deuda inventada. **La regla:** un aviso que pide
  cargar algo cuenta antes lo que ya está (`pendienteDelPlan`: las impagas, no dadas de baja y con vencimiento, del monto
  de la cuota). Si ya están, dice «puede ser un pago repetido».
- **Mover el plazo antes del trato arregló Stripe y agrandó la carrera del lead:** el aviso `nuevo` tarda más (Stripe) y el
  otro gana el reclamo y el lead, con `suscripcion_meses = null`. El plazo se LEE en todo primer pago; sólo programarlo
  en Stripe queda atado a `nuevo`. El aviso del link anulado se dice en el corte, porque el otro aviso no lo dice.
- **El reembolso miraba sólo al devolver el primer pago.** Devolver el primero y después la cuota 1 dejaba la cuota 2 como
  deuda. Ahora cada reembolso total revisa los planes devueltos del lead (`planesDevueltosDelLead`) y mira SÓLO las cuotas
  de ese plan (sus ids, en `cobros.trato.cuotasPlan`): una renovación cobrada ya no frena la baja.
- Quedó un `< 0.01` en el link de una cuota (lib/cobros.ts): al centavo.

**Sin hacer:** la marca `trato.ventaEn` se escribe después de la venta (dos escrituras): un corte de milisegundos entre las
dos deja el plan sin armar, y lo dice el pendiente. Un plan que el asistente de Ganado reparte con otro centavo en el
inicial (333,33 en vez de 333,34) ya no lo salda el link del producto: entra como pago nuevo y el pendiente avisa.

### La tercera revisión de plata: decidir con las cuotas del plan y después dar de baja todo el trato (22/10/2026)

- **Angostar la decisión destapó la acción amplia.** La segunda revisión pasó a decidir mirando sólo las cuotas del plan,
  pero `darDeBajaCliente` seguía dando de baja TODAS las impagas del trato y anulando sus links: devolver el producto A se
  llevaba US$400 de deuda de la compra B, cargada en la misma casa. Antes, el chequeo amplio (cualquier fila cobrada frenaba)
  lo tapaba. **La regla:** si la decisión se angosta, la acción se angosta con ella. La baja y su deshacer aceptan los ids
  (`soloIds`, lib/pagos-baja.ts) y el reembolso pasa SÓLO los del plan.
- **El pago repetido devuelto «al revés»** (devuelven el que armó el plan y queda el repetido, que entró suelto y no es una
  cuota del plan) borraba US$666,66 a quien pagó el producto una vez. Otro cobro pagado del mismo producto en ese lead
  sostiene la compra.
- **Un plan sin nada que dar de baja quedaba abierto para siempre**, y un reembolso de otra cosa meses después volvía a
  pasar por él. Ahora se cierra.
- La decisión es una función pura con test de COMPORTAMIENTO con esos tres casos (`decidirBajaDelPlan`): los tests de antes
  eran regex sobre la fuente y pasaban igual con el bug.
- Una devolución fallida deshace la baja que disparó ESE cobro (`trato.bajaPor`), aunque sea la cuota 1 y no el primer pago.
- El pendiente no afirma de quién son las cuotas del monto que ya están (pueden ser de otra compra), y si el pago saldó la
  cuota 0 de un plan que ya estaba, no dice nada: decía «puede ser repetido» a un pago legítimo.

### La cuarta revisión de plata: deshacer una baja es volver a decidir, no recordar quién la hizo (22/10/2026)

- **Deshacer mirando «quién disparó la baja» es una regresión con otro orden de eventos.** Se devolvió el primer pago, después
  la cuota 1 (que disparó la baja de la cuota 2), y falló la devolución del primer pago: la cuota 0 volvió a estar cobrada,
  pero nadie deshacía, porque la baja era de la cuota 1. **La regla:** una devolución que falla vuelve a decidir cada plan dado
  de baja con lo de HOY y la misma regla que lo dio de baja (`decidirBajaDelPlan`); si ahora algo lo sostiene, se deshace.
- **El deshacer devuelve sólo lo que dio de baja ESE reembolso** (`trato.bajaIds`, de lo que devuelve `darDeBajaCliente`),
  no las cuotas que el closer dio de baja a mano en ese plan (la cobranza volvía a escribirle a quien se fue).

### La quinta revisión de plata: «volver a decidir con lo de hoy» tiene que saber de CUÁNDO es cada cosa (22/10/2026)

- **Lo de hoy incluye lo que pasó después de la baja.** Si el cliente volvía a comprar el producto después de que se le dio
  de baja el plan devuelto (y el closer cargaba las cuotas de la compra nueva, como pide el aviso), cualquier devolución
  fallida del lead encontraba «otro pago del producto» y revivía las cuotas viejas: deuda doble. **La regla:** al deshacer,
  lo que sostiene la compra es lo pagado ANTES de la baja (`trato.bajaAt`, `otroCobroPagadoDelProducto({ antesDe })`).
- **Un id de cuota no identifica una baja.** Si el closer deshacía a mano la baja del reembolso y después daba de baja al
  cliente a mano, las mismas cuotas volvían a estar de baja, y la devolución fallida las reabría (la cobranza le escribía a
  quien se fue). El deshacer reabre sólo lo que tiene el `baja_at` de ESA baja, también en el compare-and-set.

## Varias cuentas de Stripe y de MP: cada cobro con la suya, y el vínculo que nunca encontraba su pago (22/10/2026, mig 0328)

Un negocio puede conectar varias cuentas por pasarela (docs/hallazgos-integraciones.md, el modelo). Cada cobro anota la suya
dos veces: el SUFIJO (`cobros.cuenta`, `c2`; NULL = la principal, todo cobro de antes) y su id EN EL PROVEEDOR
(`cobros.cuenta_ref`: el `acct_…` de Stripe, el `user_id` de MP). Todo lo que se hace después con él —el link, el plazo, la
baja, anular, devolver, cancelar, la conciliación— busca la cuenta de HOY por ese id (`cuentaVivaDelCobro`, lib/cobros.ts).
Lo que mordía:

- **⚠️ El diagnóstico obvio era el equivocado: el sufijo NO es la identidad de una cuenta.** La primera versión ataba el cobro
  a su sufijo. La revisión adversarial lo rompió con un caso de todos los días: rotar la clave de la segunda cuenta es
  desconectarla y volver a conectarla, y vuelve como `c3` (el `c2` lo nombran sus cobros). Sus cobros de `c2` quedaban
  huérfanos: cada renovación se ignoraba con un 200 (Stripe y MP no reintentan un 200) y «devolver» o «cancelar» decían
  «Stripe no está conectado». Lo que identifica una cuenta es su id en el proveedor; el sufijo es sólo dónde viven sus
  claves hoy. Conectar una cuenta que vuelve cae en el sufijo de SUS cobros (`cuentaParaConectar`) y nunca hereda la
  principal de otra cuenta. La 0328 completa `cuenta_ref` de los cobros de ANTES desde `webhook_routing` (que guarda el
  id en claro), sólo donde el negocio tiene UNA cuenta de esa pasarela: medido el 23/10, producción no tenía ningún
  cobro todavía, así que hoy no toca filas.
- **«Conectar otra» sobre una cuenta YA conectada pisaba su clave sin avisar** (lo metió el arreglo de arriba, y lo
  rompió la segunda revisión): la clave de PRUEBA de una cuenta de Stripe trae el MISMO `acct` que la real, así que
  «sumar Stripe pruebas» dejaba a la principal cobrando en modo prueba, con la firma de otro aviso. Ahora contesta
  «ya está conectada aquí» (409); cambiarle la clave es desconectarla y volver a conectarla (vuelve a su sufijo).
- **Anular no corta después de anular**: buscar la cuenta del cobro puede tirar, y cortaba con el cobro YA anulado
  («No pude anular» de algo anulado, y `anularLinksDeCuota` dejaba vivos los otros links de una cuota pagada).
- **El aviso usa el id que la ruta ya validó** (el `acct`, el `user_id`), no lo relee con la lectura tolerante: con la
  base caída, el null hacía tomar el cobro como «de otra cuenta» y se ignoraba con un 200.
- **Un vínculo cuya cuenta ya no cobra no cobra por la principal** (`cuentaSinElegir` devuelve null): con dos razones
  sociales, la plata entraba en la cuenta equivocada. El link dice «no conectada».

- **El vínculo de «Vincular cobro» nunca encontraba el pago de la segunda cuenta.** El vínculo guarda ids (`stripe:c2`) y
  `cuentaDelCobro` devolvía `c.cuenta` tal cual (`c2`): la comparación daba falso y el pago caía en la casa del lead. Lo
  obvio era guardar el id entero en el cobro; la columna guarda el sufijo (el check de la 0328 lo fija) y el id se ARMA
  en `cuentaDelCobro`.
- **Sin cuenta elegida, un producto vinculado sólo a la segunda cuenta cobraba por la principal** (la landing, la API, el
  link de un producto): el pago tampoco llegaba a su CRM. `crearCobro` elige por el vínculo (`cuentaSinElegir`): la de
  siempre si está en él, si no la primera del vínculo que cobre.
- **Una cuenta nueva heredaba el sufijo de la que se fue.** `proximaCuenta` era «la más alta + 1» de las claves guardadas:
  desconectada la `c2`, la próxima volvía a ser `c2`, y un link pendiente de la vieja se pagaba con las claves de la nueva
  (y una devolución iba a otra cuenta de Stripe). `proximaCuentaDe` suma los sufijos que nombran los cobros y los vínculos.
- **Un aviso de una cuenta nunca aplica un cobro de otra** (`deOtraCuenta`, lib/cobros-webhook.ts): compara el id en el
  proveedor del cobro con el de la cuenta del aviso (sin `cuenta_ref`, el sufijo).
- **Un link de una cuenta desconectada no abre** (`urlParaPagar`): Mercado Pago devolvía su URL vieja sin mirar nada, y el
  pago entraba a una cuenta de la que MaKo ya no se entera. Y la landing no reusa un pendiente de OTRA cuenta
  (`cobroReusable` + `refParaCobrar`): el de la principal, cuando el producto ya cobra por la de su vínculo, pagaba fuera
  de su CRM.
- La misma cuenta de Stripe dos veces en un negocio se rechaza (`yaConectadaComoOtra`): dos filas de un `acct` eran dos
  avisos y dos secretos para la misma plata.

**La regla:** lo que toca un cobro YA creado usa `cobros.cuenta`, nunca «la principal»; lo que crea uno nuevo deja elegir la
cuenta (`crearCobro({ cuenta })`, el asistente de la ficha) o la saca del vínculo. **⚠️ La 0328 va ANTES del deploy:**
`COLS_COBRO` lee `cuenta`, y sin la columna se cae toda lectura de cobros.
**Vive en:** lib/cobros.ts · lib/cobros-webhook.ts · lib/cobro-etapa.ts (`cuentaDelCobro`) · lib/cobro-etapa-server.ts
(`cuentasDelVinculoDelProducto`) · app/crm/[id]/CobrarConLink.tsx · app/crm/cobro-etapa-actions.ts · tests/cuentas-pago.test.ts.
**Sin hacer:** (1) los cobros de ANTES de la 0328 no tienen `cuenta_ref`: siguen a su sufijo, y si la principal cambia de
cuenta pasan a la nueva (lo de siempre). (2) Dos «conectar» a la vez reciben el mismo sufijo y el segundo pisa al primero
(`proximaCuentaDe` no reserva): raro, sin arreglar. (3) El link de una cuota con uno vivo de otra cuenta devuelve ése
(`yaEstaba`, la misma regla que con la pasarela). (4) `cuentasDePago` decide «conectada» por los NOMBRES de las claves,
no por si descifran: una principal ilegible puede elegirse como cuenta por defecto. Todo en lib/cobros.ts y
lib/cuentas-pago-server.ts.

## «Vincular cobro» no mostraba los productos de Stripe: MaKo nunca leía su catálogo (23/10/2026)

Llamada con Mauricio (Fathom 195591907, min 20-28): pegó su clave secreta de Stripe, fue a «Vincular cobro» en Ganado
de «Sprint 3 días», y su producto de US$270 no aparecía; «Volver a leer» no hacía nada y el «Sprint 3 días» de MaKo
decía «no tiene precio». **Lo obvio era la clave en otra fila o cuenta, la caché o la moneda. No era nada de eso.**
Medido en el ws1 (sólo leyendo): la clave es `sk_live`, lee la cuenta de México (moneda por defecto MXN) y su precio
está en USD, con producto activo y precio por defecto. Lo que pasaba: el pop-up lista SÓLO `productos` de MaKo, y nada
en el repo leía `/v1/prices`. «Volver a leer» volvía a pedir lo mismo.
- **Ahora:** `preciosDeStripe` lee en vivo, sin caché, los precios activos de todas las cuentas de Stripe conectadas,
  cada una con su clave. Elegir uno vuelve a leer el precio en Stripe con la clave de ESA cuenta (del navegador viene
  sólo el `price_…`) y lo trae al catálogo.
- **El mismo nombre es el mismo producto, pero sólo se le pone precio al que NO tenía.** La revisión adversarial
  encontró el agujero: un mismo producto de Stripe con dos precios (US$600 único y US$100 por mes) pisaba el de MaKo
  con el segundo. Eso cambiaba el vínculo de Ganado y todo link nuevo, y uno en cuotas cobraba la cuota de un precio
  que nadie vio. Uno que cobra otra cosa ahora es un conflicto con los dos precios a la vista, y se cambia a mano.
- **Lo que frena el vínculo frena ANTES de escribir:** que el CRM exista, que la etapa sea su Ganado, las cuentas, y
  que el producto no cobre ya en otro CRM. Antes, el precio quedaba cambiado para todo el negocio y el vínculo fallaba
  después.
- Lo que MaKo no cobra tal cual se muestra con el porqué: otra moneda (el catálogo va en dólares), cada año o cada N
  meses (MaKo cobra por mes), un monto que elige quien paga, por escalones o con fracción de centavo (Stripe manda
  `unit_amount: null`). Los montos se convierten con `deUnidadMinima`, la de los cobros: una lista copiada trataba
  UGX sin el ×100.

**Sin hacer:**
- Dos clics a la vez sin producto en MaKo crean dos con el mismo nombre (`productos` no tiene índice único por
  nombre). El pop-up bloquea mientras guarda.
- El producto de MaKo no guarda su `price_…`: el match es por nombre, y si se renombra en MaKo, traerlo crea otro.
- ⚠️ **Lo de fondo sigue:** su landing cobra con un Payment Link propio de Stripe (`plink_…`). Las 10 sesiones
  medidas llegan sin metadata de MaKo, y el aviso las ignora con «no es un cobro de MaKo» (la entrada del 21/10, más
  arriba). Vincular el producto hace que cobre en Ganado lo que se paga por un link de MaKo, no lo que entra por
  ese link.

**Vive en:** lib/stripe-catalogo.ts · lib/stripe-catalogo-reglas.ts · lib/stripe-api.ts (`listarPreciosStripe`,
`leerPrecioStripe`) · app/crm/cobro-etapa-actions.ts (`preciosDeStripeAction`, `vincularPrecioDeStripeAction`) ·
tests/stripe-catalogo.test.ts. El pop-up es del CRM (app/crm/CobroDeEtapaModal.tsx).

## El USD de una cuota de renovación: cero vale cero, y en pesos con descuento no vale el de lista (23/10/2026)

Lo encontró el chat «Suscripción y Partners» (el cobro del plan de MaKo) leyendo `montoUsdDeLaCuota`
(lib/cobros-reglas.ts). Pasaban dos cosas:
- **Una cuota de 0** (saldo a favor, cupón del 100%) **valía lo del cobro.** Sumaba US$47 de cash que no entraron.
  Stripe no llegaba a ese punto, porque `confirmarFactura` ya ignora la factura en cero; Mercado Pago no tiene ese
  filtro. Y tres lugares de `aplicarPagoAprobado` usaban `p.monto ? p.monto : actual.monto`, así que un 0 se guardaba
  y se avisaba con el monto del cobro.
- **Una cuota en pesos con descuento valía el USD de lista.**

⚠️ **Lo obvio era «convertir con la cotización del día». Cobros no tiene ninguna**, y la regla de la casa es no
inventar una tasa. Lo único declarado es la relación del cobro: sus pesos frente a sus dólares. Con eso:
- una cuota MENOR que el cobro es un descuento y vale su parte de esos dólares;
- una IGUAL o MAYOR vale lo declarado. Escalarla convertiría cada ajuste por inflación en pesos en más dólares
  vendidos, y en Argentina se ajusta seguido.

**Medido en producción (sólo leyendo):** ningún negocio tiene cobros de suscripción ni cuotas de pasarela todavía.
No quedó nada mal anotado.
**La revisión adversarial encontró dos más:**
- El historial del lead decía el USD de lista («ARS 40.000 (US$ 47)») mientras al cash entraban US$37,60. Ahora dice
  lo de esa cuota.
- Una cuota de cero dispararía «Entró un pago» y las automatizaciones de «Pagos». Ya no los dispara. Hoy esa cuota
  no llega por ningún camino: Stripe descarta la factura en cero y Mercado Pago no aprueba pagos de cero. El arreglo
  es por si algún día llega.
- Queda fijo: de Mercado Pago se toma el bruto (`transaction_amount`), no `net_received_amount`. Con el neto, la
  comisión parecería un descuento.

**Sin hacer:** con una cotización diaria de verdad (otra fuente, y decidir cuál: oficial o MEP), una renovación en
pesos valdría lo de ese día. Es una decisión de producto, no de este arreglo.

**Vive en:** lib/cobros-reglas.ts (`montoUsdDeLaCuota`) · lib/cobros.ts (`aplicarPagoAprobado`) ·
tests/cobros-reglas.test.ts.


## Una venta con el Stripe PROPIO del negocio no entra a MaKo (auditoría del 24/10/2026)

Medido por la auditoría del Pixel (docs/hallazgos-landing.md, misma fecha), con GETs de sólo lectura a la cuenta de Stripe
de Mauricio Bustos (quedan en los Logs de su panel) y la base.

**Vive en:** `lib/cobros-webhook.ts` (:88-90 y :121-123, :141-143) · `lib/cobros-eventos.ts` (`avisoStripe`, el motivo
del `checkout.session.expired` :151-153) · `lib/stripe-api.ts` (`leerCheckoutStripe`) · `lib/fuentes-leads.ts`

- **Hoy no se pierde ninguna venta, porque no hubo ninguna:** la cuenta del ws1 tiene 0 cargos, 0 payment intents, 0
  facturas y 0 suscripciones. Tiene UN Payment Link del «Sprint 3 días» (USD, pide teléfono, redirige a
  sprint.mauriciobustos.com/gracias.html SIN `{CHECKOUT_SESSION_ID}`) y 12 checkouts empezados entre el 18 y el 23/10,
  todos vencidos y sin email. Las credenciales están todas: sk_live, el aviso de MaKo en modo real con 13 eventos.
- **Cuando llegue la primera, se pierde entera:** el webhook tira todo pago que no creó MaKo («no es un cobro de MaKo»):
  ni lead, ni venta en Pagos, ni Purchase a Meta (ningún camino lo manda: docs/hallazgos-ads.md).
- ⚠️ **La salida barata es la equivocada:** meter al comprador con `ingresarDeFuente` lo deja en la etapa de ENTRADA del
  funnel del negocio (ningún funnel del ws1 declara «carrito»), donde la secuencia de WhatsApp activa le escribe y el CRM
  automático (T2) lo pasa a «No agenda» a los 2 días: el «no agendaste» a quien pagó que esta casa ya prohíbe. Una venta
  externa entra como un COBRO ya pagado por `aplicarPagoAprobado` (gana al lead, deja la cuota, dispara «Entró un pago» y
  cubre reembolsos), con su Purchase por CAPI con el email del checkout, monto y moneda reales, `event_id`
  `purchase:<pi_|in_>`, sólo con livemode y dentro de `runWithWorkspace`. No hace falta migración por las restricciones
  de cobros (0255), pero no hay columna que marque un cobro como externo.
- **Trampas medidas para quien lo construya:** `after()` sin `runWithWorkspace` no manda el Purchase con otro píxel: lo
  descarta como `sin_pixel` SIN rastro (lib/meta-capi.ts:186-193; Calendly sólo anota rechazado/http/red). Una suscripción
  manda `checkout.session.completed` E `invoice.paid`: el `event_id` sale de la misma llave que la cuota. Un pago
  diferido (OXXO) llega `unpaid`. No hay modo prueba: la clave y el aviso son reales, y probar es una compra de verdad.
- **Para unir la compra con la visita sin tocar el Pixel:** que el Payment Link redirija con `{CHECKOUT_SESSION_ID}`; la
  visita a gracias.html llega con `session_id=cs_…` adentro de `landing_url` y el server puede releer la sesión.
- **Quién:** toca lib/cobros* (dueño, Integraciones) y el webhook que usa la suscripción de MaKo. Se lo pasé al Cerebro el
  24/10 para que decida chat y fecha; no lo hice yo.
- **Decidido (el Cerebro, 24/10): no se toca antes del lanzamiento; el diseño quedó escrito y verificado contra el código**
  en docs/diseno-venta-externa-stripe.md. Lo que el verificador encontró y cualquiera que lo construya tiene que saber:
  ⚠️ cambiar la FORMA de retorno de `cobroStripe` rompe el respaldo por factura con el que se encuentran el reembolso y la
  disputa de una cuota de suscripción, también la de MaKo (se le SUMA `noEsDeMako`, no se reemplaza `ignorar`); ⚠️ escribir
  `cuenta = 'principal'` viola `cobros_cuenta_check` (0328:25) y la venta se pierde con un 200; ⚠️ `montoUsdDelCobro` no usa
  el precio del producto a propósito, así que una venta en otra moneda queda sin cuota ni aviso; el Purchase atado a «ganó el
  INSERT» se pierde ante cualquier error posterior (va con una marca durable en el historial); y la venta se reclama ANTES de
  crear el lead.
- **Medido para el diseño:** la `post_pago` del ws1 está ARCHIVADA (a quien paga no le llega bienvenida); el ws10 también
  tiene Stripe conectado; los 12 checkouts del Sprint no traen ninguna atribución (`client_reference_id`, metadata y
  `marketing_attributions` en null) y son anteriores al Pixel en la página.

## La venta de un Payment Link propio ya entra como cobro externo, APAGADA (MAU-10, 27-28/10/2026)

Chat «Zernio y CAPI» (`claude5` lo escribió, `claude4` lo terminó en la PC). Sigue a la entrada de arriba y al diseño
(docs/diseno-venta-externa-stripe.md, §8 «Lo que cambió al construirlo»).

**Vive en:** `lib/cobros-externos-reglas.ts` (`esVentaExterna`, `filaDeVentaExterna`, `esCobroExterno`) · `lib/cobros.ts`
(`registrarVentaExterna`; el corte en `reembolsarCobro` y `cancelarSuscripcionCobro`) · `lib/cobros-webhook.ts`
(`ventaExternaStripe`, `avisarCompraAMeta`, la puerta en la rama de checkout) · `lib/crm-auto-plan.ts` (T2 no mueve a quien
pagó) · tests/venta-externa.test.ts (de punta a punta) · tests/cobros-externos-reglas.test.ts ·
tests/venta-externa-no-toca-mako.test.ts.

- **La regla:** una sesión pagada de un Payment Link del negocio, sin cobro de MaKo y sin su metadata, fuera de la
  plataforma, en el modo del aviso y con `cobros.ventas_externas = '1'`, entra como cobro `pagado` marcado
  `creado_por = 'externo:stripe:<plink_>'`, con su lead (el del email, si no el del teléfono, si no uno nuevo con origen
  «stripe»), su cuota y UNA compra a Meta. El interruptor está APAGADO en todos: prenderlo en el ws1 es el paso 5.
- ⚠️ **El diagnóstico obvio era el equivocado: «el reintento sigue desde el paso que falte».** El diseño reclamaba la venta
  con el INSERT antes del lead para que un segundo aviso chocara con el `cs_` y siguiera desde ahí. Pero el reintento de
  Stripe nunca llegaba al escritor: `cobroStripe` encontraba la fila por el `cs_` y la mandaba por el camino de los cobros
  de MaKo, que decía «ya estaba pagado». Un aviso cortado entre el INSERT y el lead (la base, o el tope de 8 s del webhook,
  que es donde más tarda: lead, trato, cuota, Meta) dejaba la venta sin lead, sin cuota y sin compra para siempre. Ahora la
  puerta deja pasar también un cobro EXTERNO encontrado. **Para cualquier camino que reclama antes de completar: el
  reintento tiene que llegar al mismo código que reclamó, no al que encuentra la fila.**
- **El `event_id` es `purchase:<cs_>`, no `pi_`/`in_`** (el Cerebro, 27/10): es el único id que conoce la página de
  gracias, y el Pixel v28 manda el del navegador con el mismo: Meta deduplica en vez de tener que prohibir uno.
- **Los dos «rojos» de la última tanda del chat cortado no eran de la rama:** tests/pago-link-anulado.test.ts y
  tests/sin-instagram.test.ts dan verde corridos después de mezclar main (el primero lo arregló main).
- **Sin modo prueba, se probó con el código real:** el hijo corre `procesarEventoStripe` sobre la base, Stripe y Meta de
  mentira; con eso salió el agujero de arriba, que ningún test que lee el fuente veía. La prueba en el ws 3 con `sk_test`
  NO se hizo: no hay claves de prueba de Stripe en el proyecto (las credenciales viven en la base de cada negocio).
- **Sin hacer:** el script de recuperación de ventas ya ignoradas (paso 6; un aviso ignorado no vuelve, `reclamarEvento`
  lo da por duplicado); un fallo de Meta en el primer aviso no se reintenta (queda en el historial); `eventSourceUrl` y
  `visitor_id` no viajan; unir la compra con la visita por el `session_id` del pageview; que el redirect del Payment Link
  de Mauricio lleve `?session_id={CHECKOUT_SESSION_ID}` (se cambia en SU Stripe); con el interruptor apagado a mitad, el
  reintento de una venta ya reclamada no la completa.

### Lo que encontró la verificación de la rama unida con Planes (3ca2d8328, 28/10/2026)

Informe del Cerebro: C:/dev/revisiones/2810-verificacion-3ca2d8328.md, «La venta externa». El ALTO (el cruce del
`client_reference_id`) lo arregló Planes: ver «Un Payment Link con el token de un cobro de MaKo lo marcaba pagado», más abajo.
Lo de acá lo arregló este chat en `lib/cobros.ts` y el módulo nuevo `lib/cobros-externos-meta.ts`; lo prueba
tests/venta-externa.test.ts (el reintento de l, o, p, y el cruce de punta a punta en n).

- **Los dos chats arreglaron el cruce a la vez, con la misma función** (`sesionDelCobro`): el Cerebro se lo pasó a los dos y
  ninguno esperó la respuesta del otro antes de escribir. Se quedó la de Planes. Cuando un hallazgo se reparte entre dos chats,
  el que lo toma lo dice ANTES de escribir, y el otro espera esa respuesta.
- ⚠️ **«Todavía no, reintentá» sin status es un 200.** El error del reclamo («otro aviso está registrando esta venta») no
  llevaba status, `esErrorTransitorio` lo daba por definitivo, la ruta contestaba 200 y Stripe no volvía NUNCA: un «Reenviar»
  desde el panel de Stripe dentro de los 2 minutos dejaba la venta sin lead para siempre. Ahora va con status 503. **Regla:
  todo error que signifique «volvé más tarde» lleva su status transitorio.** Y el test del corte probaba la puerta llamando a
  `procesarEventoStripe` con un error que la ruta NO reintenta (un XX000): un test de «el reintento lo completa» tiene que mirar
  qué contestaría la ruta (`esErrorTransitorio`), no sólo llamar a la función.
- **La compra a Meta de una venta cortada en la cuota** la manda ahora también el cron (`reconciliarCobros` →
  `compraExternaQueFalto`), una sola vez por venta: si el historial ya dice algo de esa compra, no la repite (sin píxel, no
  deja una línea por pasada).
- **Sigue sin hacer:** una venta externa pagada y SIN lead (un error permanente al crear el lead, o el corte pasado el tope de
  8 s, cuando la ruta ya contestó 200) no la completa nadie: el cron sólo repara pagados con lead.

## «No tiene LIBERTAD» (27/10/2026): editar una cuota sin trámites, y la suscripción en el total de la columna

Chat «CRM y Chats» (`claude5`), rama `crm-chats-2710`. Martín: «Los pagos funcionan mal, no tiene LIBERTAD... No se cargan
tampoco el $ en el total de la columna cuando es suscripción».

- **Cada «no se puede» mandaba a hacer otra cosa antes**: una cobrada, «desmárcala primero»; con un recordatorio corriendo,
  «córtalo para editarla»; con un link sin pagar, «anúlalo para cambiar el monto». Y en la pantalla el campo directamente no
  aparecía (`montoEditable` / `fechaEditable` lo escondían por la protección). Ahora `editarCuota` (lib/pagos.ts) edita y
  arregla lo que quedaba viejo DESPUÉS de guardar: corta el recordatorio (llevaba el monto y la fecha de antes; la cobranza la
  vuelve a tomar con `olvidarAvisosDeCuotas`), anula el link si cambió el monto, y una cobrada A MANO se corrige en el lugar
  (monto y día del pago) con lo cobrado del lead recalculado (`sincronizarTotalCobrado`). Lo único que no: lo que cobró la
  PASARELA (es lo que entró), una devuelta y la de un cliente dado de baja.
- **«Armar el plan» se escondía** con cuotas sueltas sin plan: ahora está siempre (salvo suscripción), y si no se puede armar
  encima de lo que hay, el server lo dice en el mismo lugar.
- **El total de Ganado no sumaba las suscripciones** (decisión del 12/10: «un total no puede mezclar una vez con por mes»).
  Martín lo pidió al revés: ahora suma la mensualidad (la misma «/mes» de la tarjeta); sólo suscripciones, «$444/mes»; mezclado,
  la suma y el `title` separa las dos (`app/crm/total-columna.ts`).

- **El plan quincenal (ticket #13, Leila: «$300 cada quincena, los días 1 y 15»).** El plan uniforme es de 1 a 6 cuotas y UN
  día del 1 al 28, y no por una regla de negocio: son los CHECK de la mig 0014 sobre las COLUMNAS del plan del lead. Las
  cuotas son filas de `pagos` y no tienen ese tope. El plan LIBRE (cada mes, quincena o semana; días a elección; hasta 60) arma
  la lista (`fechasDelPlan`, lib/pagos-campo.ts) y la guarda por `guardarCuotasAction` con las columnas del plan en lo que
  entra (lo que no, vacío: `planComoEstaba` recorta igual). Sin migración. El plan uniforme sigue por `ajustarPlanAction`.

**Sin hacer:** el plan libre no tiene Deshacer (el uniforme sí) · el editor del plan sigue escondido para una suscripción (el
caso de Nadia, lead 2605: primero se pasa la venta a «Pago único») · editar una cobrada deja su línea en el historial como
«vencimiento» (`lineasDeCuotas`).

## La revisión de b335f972c (27/10/2026): el plan libre duplicaba deuda y editar una cobrada no preguntaba cuál se vio

Revisión adversarial del Cerebro (C:/dev/revisiones/2710-crm-b335f972c.md), con las funciones reales del sha. Arreglado en la
misma rama (chat «CRM y Chats», `claude4`); tests/pagos-revision-b335.test.ts, probado rompiéndolo.

- **El plan libre se armaba DE CERO sobre un plan con cobros (alta).** Con el inicial de US$1.000 y 3 de 6 cuotas de US$500
  cobradas, pasar la cantidad a 8 dejaba US$5.000 de deuda en vez de US$2.500: el formulario trae el inicial precargado y lo
  mandaba otra vez con vencimiento HOY (la cobranza le recordaba al cliente plata que ya pagó), y las 8 cuotas entraban todas
  nuevas. Y `guardarCuotasAction` va POR ID: sin ids, todo se inserta y una impaga con link o recordatorio queda AL LADO de
  las nuevas, contada dos veces. Ahora `cuotasDelPlanLibre` (lib/pagos-campo.ts) aplica la regla del plan uniforme: el inicial
  cobrado no se pide, la cantidad cuenta las cobradas del plan (la pantalla lo dice: «Ya cobrado: …»), y cada impaga que existe
  toma un lugar de la lista por su id, las protegidas primero. Regla: **una lista que reemplaza cuotas se arma ENCIMA de lo que
  hay, nunca de cero**; el total que se muestra no avisa nada, porque el uniforme muestra el mismo número contando lo cobrado.
- **`editarCuota` elegía la columna por lo que LEYÓ (media).** La misma `fecha` es el vencimiento de una impaga y el día del
  pago de una cobrada. MaKo confirma un `editar_cuota` hasta 120 min después de prepararlo, sin volver a mirar: si en el medio
  la cobraron, el vencimiento nuevo se escribía como `fecha_pago` (el Cash de octubre pasaba a noviembre) y MaKo contestaba
  «Listo». La guarda `.eq('pagado', false)` no servía: la rama ya se había elegido. Ahora quien llama dice qué vio (`espera`,
  «impaga» por defecto) y si no coincide, tira. Regla: **cuando un mismo campo significa dos cosas según el estado, el estado
  lo dice quien llama**, no la lectura.
- **Un recordatorio cortado quedaba afuera de la cobranza (media).** Editar sólo el monto cortaba la corrida, pero el olvido
  del dedup (`cuotasReprogramadas`) sólo mira las cuotas cuya FECHA cambió: `cuota:<id>` seguía «enviada» y el cron la
  descartaba. El comentario prometía lo contrario. Ahora la cuota del recordatorio cortado se olvida siempre, y la ficha dice
  «el recordatorio arranca de nuevo».
- Bajos: el monto de una cobrada en otra moneda ya no se edita como «$» en la ficha (se leía en pesos) y, si llega por otro
  lado, limpia la moneda y el monto original (lo último que se dijo manda, como en `cobrarCuota`); el Deshacer manda sólo lo
  que cambió y dice si no se aplicó.
- **Cómo se probó lo que lee la base:** `editarCuota` corrió REAL contra una base en memoria (el arnés del refutador,
  adaptado: el `await import('./flujo-corridas')` va por ESM, así que el stub de `Module._load` no lo agarra y hace falta un
  hook de `module.register`; y las claves del dedup salen de `keyEspaciado`, que las hashea). Sobre b335f972c aparecen los
  tres defectos; con el arreglo, ninguno.

## La revisión de 0b6d5b754 (27/10/2026): el arreglo del plan libre trajo dos de plata

Segunda revisión adversarial del Cerebro (C:/dev/revisiones/2710-crm-0b6d5b754.md), con las funciones reales del sha. Arreglado
en la misma rama; tests/pagos-revision-b335.test.ts (los casos de la revisión, probados rompiéndolos).

- **El resto de un cobro por menos tomaba un lugar del plan (alta).** `cuotasDelPlanLibre` contaba las cobradas con
  `esCuotaDelPlan` pero repartía los lugares entre TODAS las impagas: el resto (`resto_de`, lo crea `cobrar_cuota_con_resto`)
  protegido se quedaba con el lugar de una cuota de US$500, que se borraba y nunca se cobraba (1.100 de deuda en vez de 1.600);
  sin proteger, el resto se borraba en silencio. Ahora lo que no es del plan va APARTE, con su id, su monto y su fecha: se casa
  sin cambio y no se borra. Regla: **una regla que separa «del plan» para contar tiene que separarlo también para repartir**;
  el plan uniforme ya lo hacía (`lugarDe` sólo con `esCuotaDelPlan`).
- **«Las protegidas primero» con las protecciones de la PANTALLA (media).** La ficha no las relee después de «Mandar link» ni
  cuando la cobranza arranca un recordatorio, y una lectura fallida da «nada protegido». Al acortar el plan, la protegida quedaba
  sin lugar y la deuda se contaba dos veces. Ahora el orden lo corrige el server con las protecciones que acaba de leer
  (`protegidasPrimero` en `reconciliarCuotas`, modo 'porId'): una protegida sin lugar toma el de una sin proteger. Regla: **lo
  que decide plata se decide con el dato del server, no con el de la pantalla**; la pantalla sólo propone.
- Baja: cambiar el monto de una cuota con link anula el link, y el Deshacer devuelve el monto pero no el link. Ahora se dice en
  los dos («el link anterior se anuló: manda uno nuevo»).
- **La revisión de 1f02dd813 (media):** un #0 que tomó un lugar del plan libre sin inicial (una seña con link), una vez cobrado,
  contaba como «inicial cobrado» y no como cuota: guardar el mismo plan después armaba una de más (cinco de 300 para un plan
  de 4). Ahora la ficha le dice a `cuotasDelPlanLibre` si el plan GUARDADO tiene inicial (`planConInicial`); sin él, el #0 es
  una cuota. Y lo de aparte va `quedaComoEsta`: el server lo casa sin cambiarlo y, si ya no existe, no lo inserta (un resto
  quitado o cambiado en el medio revivía). El aviso del link anulado sale sólo si se anuló alguno.

## El plan por TRAMOS (29/10/2026, ticket #13 de Leila, ws11): lo que se aprende al pasar de «un monto» a «varios»

Chat «Pagos» (`claude3`), rama `pagos-tramos-2910`. Martín (28/10): «No tiene libertad o diversidad de tipos de cobros». Leila
tenía que explicarnos sus planes por WhatsApp: Nadia (lead 2605) son US$300 cada quincena, días 1 y 15; otro cliente, «6 meses
de 12.000 y luego 10.000» en pesos. **Copiado de** las fases de un «subscription schedule» de Stripe (la documentación oficial,
docs.stripe.com/billing/subscriptions/subscription-schedules: el editor del Dashboard pide una cuenta) y del plan de pagos de
Kajabi (help.kajabi.com, «Create a payment plan offer»): hasta 10 tramos seguidos, cada uno con su monto, su moneda, cada cuánto
y cuántas cuotas o hasta qué fecha; el siguiente arranca donde termina el anterior; el anticipo es el «setup fee» de Kajabi; y
la lista que sale se toca cuota por cuota antes de guardar.

- **Medido en la base (sólo lectura):** Nadia es una SUSCRIPCIÓN de US$4.235,29 × 12 los días 8 (#91 a #102) más un pago
  suelto de US$423,53 (#113). 4.235,29 = 72.000 / 17 y 423,53 = 7.200 / 17: alguien cargó pesos divididos por una tasa. El
  editor del plan estaba ESCONDIDO para una suscripción, así que Leila no tenía cómo arreglarlo sola. Ahora se abre también ahí
  y, al guardar, la venta pasa a «Pago único» (con su compare-and-set) antes de las cuotas, y lo dice antes.
- **Sin migración, y es a propósito:** un tramo no se guarda; se guardan sus cuotas (filas de `pagos`, con `moneda` y
  `monto_original`, que ya existían para lo cobrado). Las columnas del plan del lead (`total_cuotas` 1-6, `dia_de_pago` 1-28,
  mig 0014) son de UN monto: con varios tramos van vacías. Al reabrir, los tramos se LEEN de las cuotas (`tramosDeCuotas`) y lo
  que no encaja queda como «a mano» (`cambiosContra`). **La prueba de que el editor no rompe nada es «abrir y guardar sin cambiar
  nada no cambia ninguna cuota»**: está en tests/pagos-tramos.test.ts con las cuotas reales de Nadia.
- ⚠️ **El diagnóstico obvio era reusar la regla del plan libre, y era el equivocado.** En el libre, «la cantidad cuenta las
  cobradas» y las que faltan se arman desde «Primera cuota»: la lista es LO QUE FALTA. En los tramos la lista es el plan ENTERO
  (para que reabrir muestre lo que hay), y con esa regla una cobrada que no es la primera (la cuota 3 de 6) cubría la fila 1:
  cada impaga tomaba la fecha de la siguiente. **Regla: una cobrada cubre SU lugar** (`lugaresDelPlan`, el mismo orden que
  `lugarDe` del plan uniforme), y la impaga del lugar i se guarda POR ID en la fila i.
- ⚠️ **«Las protegidas primero» en la PANTALLA corría todas las cuotas.** El libre ordena las impagas con link o recordatorio
  primero para que no se queden sin lugar. Con la lista por posición, eso le cambiaba la fecha a cada cuota (y su recordatorio).
  Acá van por posición, y la protegida que se queda sin fila la acomoda el server con las protecciones que acaba de leer
  (`protegidasPrimero` en `reconciliarCuotas`), que ya existía por la revisión de 0b6d5b754.
- **La moneda de una cuota impaga ahora importa, y tenía cuatro lectores que la ignoraban:** el recordatorio de cobranza decía
  «US$ 600» a quien le pactaron MXN 12.000 (`cuota_monto`, lib/cobranza.ts; `getCuotasPendientes` no leía la moneda), «Marcar
  pagada» proponía dólares, el link pedía el monto en pesos en blanco, y la ficha editaba la cuota como «$». En pesos, los
  dólares los DECLARA la persona por tramo (`plataDeCuota`), como el pago a mano: `monto_usd` es lo que suman el Dashboard, el
  Outstanding y la cobranza, y no hay tasa que inventar. Cambiar sólo los pesos (mismos dólares) es cambiar la plata: anula el
  link y, con un recordatorio corriendo, no se toca.
- **Deshacer:** el plan libre no tenía; `guardarCuotasAction(…, { conDeshacer: true })` devuelve las impagas y las columnas de
  ANTES leídas en el server (con su número y su moneda), y las de después como `vistos`.

**Sin hacer:**
- Deshacer el cobro de una cuota en pesos (`marcarPago(false)`) deja la moneda de lo COBRADO (`cobrarCuota`: «lo último que se
  dijo manda»): si se cobró en dólares, vuelve a impaga en dólares y se pierden los pesos pactados (lib/pagos.ts).
- La API de MaKo arma el plan por tramos desde el 29/10 (`armar_plan_por_tramos`, abajo), pero `editar_cuota` no cambia los
  pesos de una cuota (lib/api-mako/areas/cobros.*).
- `guardar_plan_pagos` (el plan uniforme por la API) sobre un plan de UN tramo con columnas llenas lo reimpondría entero; con
  varios tramos las columnas van vacías y la guarda «se cargaron a mano» lo frena (`ajustarPlanAction`).
- Un tramo «para siempre» (el «Forever» de Stripe) es una suscripción: el plan siempre termina.
- Al pasar una suscripción a «Pago único», el monto de la venta queda vacío: lo pide el bloque «Venta», no lo pone el plan.
- El plan de Nadia NO se cargó (lo arma Leila con la herramienta). El ticket #13 sigue en «esperando_decision» (leído el
  29/10): con el hito desplegado, el cron no lo cierra hasta que alguien lo apruebe (docs/hallazgos-ticketera.md).
- No se recorrió en el navegador (la PC con diez chats abiertos no aguanta un build): el editor se DIBUJA con la ficha real de
  Nadia en tests/_plan-tramos-hijo.ts, sin estilos. Recorrerlo en el ws3 después del deploy.

**Vive en:** lib/pagos-campo.ts (§ «El plan por tramos»: `cuotasDeTramos`, `tramosDeCuotas`, `cuotasDelPlanPorTramos`,
`plataDeCuota`; la moneda en `reconciliarCuotas`) · lib/pagos.ts (`escribirReconciliacion`, `editarCuota`,
`getCuotasPendientes`) · lib/cobranza.ts · app/crm/[id]/pagos-campo-actions.ts (`guardarCuotasAction`) ·
app/crm/lead-view/ficha/pagos/bloques-cobro.tsx (`ArmarPlan`) · tests/pagos-tramos.test.ts.

### La revisión adversarial de 9fc4030dd (29/10/2026): dos de plata, y las dos venían de un valor POR DEFECTO

Integración corrió la cadena real de «Guardar el plan» y de «Marcar pagada» con casos armados a propósito (el informe:
C:/dev/revisiones/2910-verificacion-pagos-tramos-9fc4030dd.md, fuera del repo). Cada caso quedó como test en
tests/pagos-tramos.test.ts, con su entrada.

- ⚠️ **Abrir «Marcar pagada» en la moneda de la cuota cambia lo que significa el campo vacío.** «Dólares vacíos = el valor de la
  cuota» ya estaba y era inocuo mientras el modal abría en dólares. Al abrir en pesos, el cobro a medias normal de Leila (6.000
  de una cuota de MXN 12.000 = US$600) mandaba US$600: no preguntaba por la diferencia y se perdían 6.000 pesos. El server tenía
  el mismo agujero para la API de MaKo, que manda los pesos sin los dólares (`monto ?? original` en `cobrarCuota`). **Regla:**
  un cobro en la moneda de la cuota, sin dólares, va a la tasa que ya se declaró para ESA cuota (`dolaresALaTasaDeLaCuota`,
  lib/pagos-diferencia.ts), en la pantalla y en el server.
- ⚠️ **El anticipo del formulario sale de una fila #0 viva, nunca de la columna `cobro_inicial_usd`.** «Quitar» y una devolución
  dejan la columna escrita, y era el valor por defecto del campo: abrir el editor y guardar sin tocar nada volvía a cobrar HOY
  un anticipo devuelto (la deuda pasaba de US$1.500 a 2.500). «Abrir y guardar no cambia nada» se rompía por un DEFAULT del
  formulario, no por la reconciliación, y los tests lo probaban con leads sin anticipo.
- **Una marca que viaja en una fila no puede seguirla cuando el server le cambia el id.** `soloLoQueCambio` marca «tal cual» la
  fila que no cambió, y `protegidasPrimero` le daba esa fila (con la marca) a la protegida que se quedaba sin lugar. La protegida
  no se casaba: no tomaba la fecha que pide el plan, y no se avisaba que su link o su recordatorio no la dejaba cambiar.
- **Lo que se guarda «a mano» tiene que cubrir TODO lo que una cuota puede tener distinto de su tramo, también la moneda.** Con
  más de 10 rachas, `tramosDeCuotas` junta las que sobran en el último tramo, y `cambiosContra` sin la moneda ponía en pesos
  (MXN 9.000) una cuota de US$600 con sólo abrir y guardar. El recordatorio pasaba a pedir pesos.
- **Mandar el plan ENTERO necesita un compare-and-set.** Con la lista entera, una impaga del plan que la pantalla no vio era
  «nueva» y se conservaba al lado de las propias: dos pestañas que guardaban «5 cuotas» sobre 3 dejaban 7. El plan uniforme de
  main era seguro porque mandaba la diferencia. Ahora, con `sobreLoVisto`, el server no escribe nada si el plan tiene una impaga
  que la pantalla no vio (`planCambiadoAfuera`). El resto de un cobro por menos no cuenta: va aparte.
- El tope de 60 cuotas cuenta lo que se MANDA (el anticipo y lo de aparte también): la pantalla dejaba pasar 61 y el server
  contestaba «Son demasiadas cuotas.». El total en dos monedas se lee «US$ 600 + $ 24.000 MXN (US$ 1.800 en total)»: con
  «$ 24.000 MXN · US$ 1.800» parecía que sumaba dos veces.

**Sin hacer (de esa revisión):**
- El resto de un cobro a medias en pesos queda en DÓLARES (US$300, no MXN 6.000): lo crea `cobrar_con_resto` (mig 0318) sin
  moneda. Cambiarlo es SQL (lib/pagos.ts, `cobrarCuota`).
- El compare-and-set de `sobreLoVisto` lee y después escribe: dos «Guardar» en el mismo instante todavía pasan los dos.
- Fin de mes: un tramo mensual sin día hereda el día ya recortado del anterior (desde el 31/10, el tramo 2 cae los 30; desde un
  31/08, los 28). Se ve en la lista antes de guardar (`cuotasDeTramos`).
- Un plan con una pausa (cobrada en junio, el resto desde diciembre): cambiar el monto del tramo rehace las fechas desde
  «Primera cuota» y manda las impagas al pasado. El uniforme de main hace lo mismo (`rehacer` en `ArmarPlan`).
- Acortar el plan por debajo de una cobrada la deja fuera del plan sin decirlo (`cuotasDelPlanPorTramos`).
- Si el Deshacer falla, la pantalla no se entera: se llama con `void`, igual que el de `ajustarPlan`.

### MaKo arma el plan: `armar_plan_por_tramos` (29/10/2026, ticket #26 de Mauricio, ws1)

En el Ops Center, Mauricio le pidió a MaKo el plan de Fernando Muñoz: «7500 dolares en 3 pagos, primer pago 28 de octubre, segundo
pago 28 de noviembre y tercer pago 28 de diciembre». MaKo contestó que sus herramientas «leen la cobranza, pero no crean el plan».

- ⚠️ **«Falta la herramienta» era la mitad del diagnóstico.** `guardar_plan_pagos` y `guardar_cuotas` ya existían. Pero el plan
  uniforme no puede armar este plan: cuenta las cuotas desde la fecha de cierre, de 1 a 6, con día de pago hasta el 28. Y
  `guardar_cuotas` marca el lead como ganado. Además, la frase NO TRAÍA ninguna herramienta que sirviera. Medido con el turno
  real del chat de la app (`clasificarIntencion` + `herramientasDelChat`): la frase literal no arranca con un verbo ni dice
  «cuotas», y traía sólo `guardar_plan_pagos`. «300 dólares cada quincena» traía las tareas del Plan y las plantillas. **Regla:** a
  una herramienta nueva se la mide con la frase LITERAL del ticket; sin una familia que la reconozca (`plan-dictado`,
  lib/mako-intencion-app.ts), existe para la API y no para quien la pide.
- **Una sola regla para la ficha y la API.** `planPorTramosDelServer` (lib/pagos-campo.ts) es la cadena de «Guardar el plan»
  sin cambios a mano. Sin pantalla, lo que «se vio» son las cuotas que se leen al guardar. `columnasDelPlan` escribe las mismas
  columnas en los dos caminos. La escritura es `guardarPlanPorTramos` (lib/pagos.ts), y el runner no escribe la base por su
  cuenta. Repetir el mismo «sí» no cambia nada (probado).
- **El anticipo por la API sigue la regla de A2:** si no se pasa, queda el #0 sin cobrar que ya tiene (de una fila viva, nunca de
  la columna), y `sinAnticipo` lo quita. Una suscripción no se convierte sola: se pasa antes con `editar_venta_lead`.
- ⚠️ **Lo que la persona confirma y lo que se escribe tienen que salir de la MISMA regla.** Con A1 arreglado en `cobrarCuota`, la
  propuesta de `marcar_pago_cobrado` seguía diciendo «USD 600» de un cobro de MXN 6.000 sobre una cuota de 12.000, y el «sí» dejaba
  300 pendientes que nadie había leído. Ahora la propuesta usa también `dolaresALaTasaDeLaCuota`. Y `cobranza_lead` le decía
  «cobrada_en» a una cuota en pesos SIN cobrar: ahora es «pactada_en».

**Sin hacer:**
- Por la API se arma sólo el plan de la casa, no el de un CRM agregado (la ficha sí lo arma).
- `editar_cuota` todavía no cambia los pesos de una cuota en otra moneda: sólo sus dólares y su fecha (lib/api-mako/areas/cobros.*).
- El plan de Fernando (ws1) NO se cargó: lo arma Mauricio con MaKo después del deploy. El ticket #26 está en «esperando_decision».
- La venta de Fernando sigue sin monto. El plan no la cambia: la propuesta lo dice y nombra `editar_venta_lead`.

### La re-verificación de 805afb460 (29/10/2026): el «sí» llega tarde, y lo confirmado tiene que ser lo que queda

Integración re-verificó con el código real (C:/dev/revisiones/2910-reverificacion-pagos-tramos-805afb460.md, fuera del repo):
entraba, con cuatro medias nuevas, todas sobre lo que la persona CONFIRMA. Cada una quedó como test en
tests/api-mako-plan-tramos.test.ts, con su entrada.

- ⚠️ **Una propuesta por chat vive 2 h: lo que se leyó al proponer tiene que VIAJAR en la propuesta (N1).** `guardarPlanPorTramos`
  leía «lo visto» al ejecutar, así que `sobreLoVisto` sólo cubría milisegundos. Una propuesta armada sobre un lead sin cuotas,
  confirmada después de que alguien armara 6 en la ficha, reescribía 3 y borraba 3, y contestaba «Listo». Ahora las impagas
  leídas (`vistas`) van en el payload. `faltaParaConfirmar` (que corre ANTES de reclamar la pendiente, así que no la quema)
  rechaza si una ya no está por cobrar o si apareció una del plan (`planCambioDesde`), y `guardarPlanPorTramos` lo vuelve a
  mirar antes de escribir.
- ⚠️ **El resumen de una acción de plata se arma con lo que va a QUEDAR, no con lo pedido (N2).** Con la #1 cobrada por US$500 y la
  #3 con un link sin pagar, la propuesta de 3 × US$700 decía «Total: US$ 2.100»: quedaban US$1.700, y el aviso del link salía
  después del «sí». Ahora la propuesta corre `reconciliarCuotas` sobre lo leído, sin escribir (`cuotasQueQuedan`), y dice cada
  cuota como queda: la cobrada, la que «queda como está» y por qué, el total y lo ya cobrado. `cuotaExistenteDe` es la misma forma
  con que el server arma lo que reconcilia, así que la simulación no es una copia.
- **Un anticipo sobre uno cobrado se rechaza en la propuesta (N4).** La regla ya lo ignoraba (`!inicialCobrado`), pero el resumen
  prometía los US$800 y el «sí» no creaba nada. En la ficha el campo dice «Cobrado» y no se edita: sólo pasaba por la API.
- **Una diferencia hereda la moneda de su cuota (N3, mig 0347).** `cobrar_cuota_con_resto` (0318, 0323) insertaba la diferencia
  sólo en dólares: MXN 6.000 de una cuota de 12.000 quedaban «US$ 300», y el recordatorio, el link y «Marcar pagada» le pedían
  dólares a quien paga en pesos. La 0347 (APLICADA el 29/10/2026 por el Cerebro, con el sí de Martín) redefine el cuerpo con la
  misma firma (sin orden de despliegue): lee la moneda pactada
  ANTES de la toma, que la pisa con la del cobro.
- B6: dos «sí» a la vez no duplican (el índice único frena el segundo), pero el segundo contestaba el error crudo de la base;
  ahora lo dice en palabras. B7: «Las cuota del plan…» → «La cuota del plan ya está cobrada».
- ⚠️ **Una herramienta nueva LARGA le saca el lugar a otra en una frase que no es la suya.** El chat junta herramientas hasta
  12.000 caracteres, por puntaje. Con 4.300 caracteres, `armar_plan_por_tramos` entraba antes que `editar_cuota` en «las fechas y
  las cantidades de pago de Ana están mal: son 300 USD cada quincena», y el tren se frenó en tests/mako-no-puedo-falsos.test.ts
  (caso 2). El arreglo fue achicarla a 3.500, no tocar el presupuesto. La relevancia de una familia no dice «plan», que trae las
  tareas del Plan. Antes de entregar una operación del chat, se corren también los tests de presupuesto de las frases de otros.

**Sin hacer:**
- `faltaParaConfirmar` lee y después `ejecutar` escribe: un cambio en ese instante lo frena recién `guardarPlanPorTramos`, que ya
  consumió la pendiente.

### La tercera vuelta (7f79a4e6c, 29/10/2026): lo «visto» es cada cuota, no su id; y lo que ya no vale se cierra

Integración re-verificó otra vez (C:/dev/revisiones/2910-reverificacion-pagos-tramos-7f79a4e6c.md, fuera del repo): entraba, con
seis bajas. Cada una quedó como test con su entrada: tests/api-mako-plan-tramos.test.ts (13 a 16) y tests/pagos-tramos.test.ts (B13).

- ⚠️ **Lo visto es cada cuota COMO ESTABA, no qué ids había (B8).** `vistas` por id cubría altas, bajas y cobros, no una edición:
  la #2 pasada a MXN 18.000 en la ficha, con el mismo id, se pisaba con los US$600 propuestos. Ahora cada vista lleva su firma
  (monto, fecha, moneda y monto en ella: `firmaDeCuota`, la misma de `soloLoQueCambio`), y `planCambioDesde` dice «cambió
  «Cuota 2»».
- ⚠️ **Una regla nueva del «sí» no alcanza a las propuestas que ya estaban (B9).** Una pendiente de 805afb460 no traía `vistas`, y
  `faltaParaConfirmar` la dejaba pasar con la regla vieja durante sus 2 h. Ahora las vistas con firma son OBLIGATORIAS
  (`cuotasVistasDe`); sin ellas, «Esta propuesta es de una versión anterior de MaKo…». Cambiar la forma de un payload es
  rechazar los de antes, nunca «si no viene, como antes».
- ⚠️ **Una propuesta que no se va a poder cumplir NUNCA se cierra (B12).** `faltaParaConfirmar` la dejaba viva a propósito, porque
  lo que falta puede llegar (quien firma). Un plan cambiado no vuelve: al pedirla de nuevo por WhatsApp, el «sí» pelado siguiente
  contestaba «Hay 2 acciones pendientes, aclara cuál.». Ahora puede devolver `{ yaNoVale }`, y `confirmarPendiente` la cierra en
  `error` con ese motivo (lib/api-mako/tipos.ts). La regla quedó en AGENTS.md.
- **El #0 cobrado es el anticipo aunque la columna esté vacía (B10).** N4 miraba `inicialCobrado`, que sale de
  `cobro_inicial_usd`; con la columna en null, el anticipo pedido quedaba como una «Cuota 3» de hoy. Ahora mira también la fila.
- **La diferencia que queda aparte se nombra (B11):** «Aparte del plan queda sin cobrar: Cuota 4 US$ 250 (10/11/2026).», y cuenta
  para comparar con la venta. Sin ella, el total no cerraba y la propuesta decía «La venta dice US$ 1.500».
- ⚠️ **Un texto que dice plata se calcula con la MISMA regla que la escribe (B13).** La 0347 deja la diferencia en pesos, y el
  resumen, el «sí», la nota del historial y el modal «Marcar pagada» seguían diciendo «faltan 300 USD». `restoEnLaMonedaDeLaCuota`
  (lib/pagos-diferencia.ts) es la condición del SQL, y `cobrarCuota` devuelve `pendienteEnSuMoneda`.

### El rescate de la tercera vuelta (3/11/2026): «arreglado» no era verde

Estaba sin commitear desde el 29/10, y el relevo decía que los seis defectos estaban arreglados. El código estaba bien; lo que no
alcanzaba eran los tests.

- ⚠️ **Dos guardas de texto estaban rojas y el relevo no lo sabía.** tests/api-mako-comunidad-firma.test.ts y
  tests/pagos-cobro-idempotente.test.ts fijan las líneas exactas que B12 y B13 cambiaron, y ninguna es «de pagos-tramos»: correr
  los dos archivos de la tanda daba verde, y el tren habría frenado. La lista de lo que un cambio rompe sale de
  `node scripts/tests-afectados.mjs --listar`, no de quien lo escribió. **En una PC justa, primero lo que NOMBRA un archivo
  cambiado:** corre de a uno, sin cargar la app, y es donde estaban los dos rojos.
- ⚠️ **Un test que cambia dos datos a la vez no prueba ninguno de los dos.** El test 13 de B8 edita el monto y la moneda juntos.
  Sacándole a la firma la fecha, o la moneda con su monto, los 16 seguían verdes: correr la fecha de una cuota, la edición más
  común de la ficha, no tenía quien la mirara. Ahora cada dato tiene su caso («B8 · cada dato…», tests/pagos-tramos.test.ts).
- **Sin probar:** el modal «Marcar pagada» no se recorrió en el navegador; lo fija una guarda de texto sobre piezas.tsx.

**Para decidir (de Martín, sin tomar):** una cuota de MXN 12.000 (US$600) cobrada ENTERA en pesos, pero declarada a otra tasa
(US$500), deja una cuota nueva de US$100 en dólares. Medido con las funciones reales: `diferenciaPendiente(600, 500)` da 100 y
`restoEnLaMonedaDeLaCuota` da null (en pesos, pactado − cobrado = 0). La pregunta y sus opciones, en docs/relevo/pagos.md.

- ⚠️ **«La cobranza se lo reclama al cliente» era de más.** La fila entra a lo pendiente y a la cobranza (`getCuotasPendientes`
  no mira `resto_de`), pero la automatización de fábrica («Una Cuota Venció», `mako-cobranza`) le avisa al grupo del negocio. Al
  cliente le llega si el negocio editó ese flujo (sin medir cuántos) o si el dueño le cree al aviso y le escribe.
- **No hace falta migración (acá decía que sí):** sin diferencia, `cobrarCuota` va por la escritura condicional y
  `cobrar_cuota_con_resto` ni se llama. `resto: 'descuento'` ya lo evita hoy, pero el historial dice «USD 100 de descuento», que no
  es lo que pasó. El resumen y el modal lo dicen antes de confirmar.

## Un Payment Link con el token de un cobro de MaKo lo marcaba pagado (28/10/2026, la verificación de 3ca2d8328)

- **El síntoma (el refutador, por la ruta real):** una venta de US$1 por un Payment Link del negocio, con
  `?client_reference_id=<token>`, dejaba PAGADO un cobro de MaKo de US$1.500, con su cuota, el lead ganado y el historial
  «Pago de Programa: US$ 1.500 por Stripe». Igual con el interruptor de ventas externas apagado o prendido. Venía de main, de
  antes de MAU-10.
- **La causa, y por qué «releer» no alcanzaba:** el aviso busca el cobro por la metadata `mako_cobro` o, si no está, por el
  `client_reference_id` (`avisoStripe`), y la rama de MaKo relee la sesión y compara la REFERENCIA (`esDelCobro`), que es justo
  lo que el atacante puso. `confirmarCheckout` no miraba ni el monto ni de dónde salía la sesión. El token viaja en
  /pagar/<token>, los Payment Links aceptan ese parámetro en la URL, y la landing de Mauricio lo copia a cada link de Stripe.
- **El arreglo (`sesionDelCobro`, lib/cobros-eventos.ts, en la rama de MaKo del checkout):** la sesión tiene que llevar la
  metadata de MaKo de ESE cobro, o ser la guardada en el cobro (`proveedor_ref`); nunca salir de un Payment Link; y el monto y
  la moneda tienen que alcanzar los del cobro. Si Stripe convirtió la moneda (`currency_conversion`), vale el de origen
  (`leerCheckoutStripe` lo trae). Si no cuadra, no se asienta y se abre un ticket, uno por sesión (`cobro-ajeno:<cs_>`). Un
  pago diferido que falló en un link ajeno tampoco marca el cobro.
- **Trampa del doble, para quien lo vuelva a probar:** con un `data.object` recortado (sin `client_reference_id`) el cruce
  NO aparece. El evento real trae la sesión entera: un doble con el cuerpo recortado esconde toda búsqueda por referencia.
- **El monto, en UNIDAD MÍNIMA (la verificación de a196d5a93).** Un cobro de 49900.4 CLP se arma en Stripe por 49900 (sin
  decimales), y comparar contra el 49900.4 rechazaba una sesión que cobró justo lo pedido, con un ticket falso; el cron la
  asentaba igual media hora después. Ahora se compara `aUnidadMinima` contra `aUnidadMinima`, como se lo pidió MaKo a Stripe,
  y **el cron pasa por la misma regla** (`pagoDelLinkEnLaPasarela`; lo que el aviso no asienta, el cron tampoco, con el mismo
  ticket). El ticket vive en lib/cobro-sesion-ajena.ts para que lo usen los dos.

**Sin hacer:** una sesión de Payment Link que trae el token de un cobro de MaKo queda ignorada con su ticket, no registrada
como venta externa (con el interruptor prendido, la venta de verdad no entra al CRM sola). La puerta es de Zernio
(`ventaExternaStripe`). Con Mercado Pago no se midió un cruce parecido.
**Vive en:** lib/cobros-eventos.ts (`sesionDelCobro`) · lib/cobros-webhook.ts (rama de checkout) · lib/cobros.ts
(`pagoDelLinkEnLaPasarela`) · lib/cobro-sesion-ajena.ts (`avisarSesionQueNoCuadra`) · lib/stripe-api.ts (`leerCheckoutStripe`:
`montoOrigen`, `monedaOrigen`) · tests/cobro-sesion-ajena.test.ts · C:/dev/revisiones/scratch-3ca2/B-refuta/refuta.ts (H2) ·
C:/dev/revisiones/scratch-a196/cobro-mako-refuta/r3-monto-cero-decimales.ts y s1-sesion-ajena.ts.

## Una guarda nueva que vale para TODO cobro rompió un caso que no era el suyo: el pago diferido fallido (28/10/2026, a196d5a93)

- **El síntoma:** después de un OXXO, Boleto o SEPA que FALLÓ, /pagar contestaba «ya pagado» y /listo ofrecía «Volver a
  intentar», que volvía a /pagar: un bucle. El cobro quedaba `fallido` para siempre (y el link de una cuota también:
  `crearCobro` devuelve el mismo cobro).
- **La causa:** la guarda «sesión anterior `complete` → ya pagado» se escribió para la PRUEBA de Stripe (que queda `complete`
  sin cobrar) y se extendió a todo cobro de Stripe para cerrar el doble pago de la sesión vieja. Un pago diferido también deja
  la sesión `complete` sin pagar (`unpaid`), y ahí no significa «pagado» sino «falló».
- **La regla:** al generalizar una guarda de un caso a todos, listar los ESTADOS que llegan a ella (acá: `complete` con
  `paid`, `no_payment_required` y `unpaid`, con el cobro pendiente o fallido) y decidir cada uno. El arreglo: con el cobro
  `fallido` y la sesión `unpaid`, se arma otra; con el voucher EN CURSO (el cobro pendiente) no, que se pagaría dos veces. Y si
  Stripe no contesta la lectura de la anterior, no se arma otra (antes armaba B con A todavía abierta).
- **Y el arreglo abrió un cobro doble (la verificación de e6fd6d88d, scratch-e6fd/cobros-v/v1-segunda-sesion.ts):** al armar
  B el cobro seguía `fallido`, así que con un SEGUNDO voucher en curso en B la misma excepción («fallido + unpaid») armaba C;
  pagadas B y C, dos cuotas y ningún aviso (con SEPA el segundo cargo entra solo). La sesión nueva ahora vuelve el cobro a
  `pendiente` (y borra el motivo) en el mismo compare-and-set. **La regla:** una excepción que mira el ESTADO del cobro tiene
  que dejar ese estado como corresponde a la sesión nueva; si no, la excepción vale para la sesión siguiente también.

**Vive en:** lib/cobros.ts (`urlParaPagar`) · tests/planes-stripe-afuera.test.ts ·
C:/dev/revisiones/scratch-a196/cobro-mako-refuta/r1-pagar-tras-fallo.ts.

## «Volver a intentar» una SUSCRIPCIÓN: el fallo tardío de la sesión vieja y la suscripción vieja viva (29/10/2026, la verificación de ddfa645d4)

- **El síntoma (dos ALTAs, C:/dev/revisiones/2910-verificacion-zernio-254856316-planes-ddfa645d4.md):** una suscripción con
  SEPA cuya primera factura falla se reintenta, y «Volver a intentar» arma la sesión B, que es OTRA suscripción. Con la sesión
  nueva el cobro vuelve a `pendiente` (be95f7555), pero (1) el SEGUNDO aviso del mismo fallo de A (Stripe manda dos:
  `invoice.payment_failed` y `checkout.session.async_payment_failed`), o un reintento de Stripe sobre la factura de A, lo
  devolvía a `fallido` con el SEPA de B en curso, y se armaba C: dos cuotas y tres suscripciones vivas; y (2) MaKo nunca
  cancelaba sub_A: si su factura se reintentaba y ENTRABA, era otra cuota «renovación» y dos suscripciones cobrando todos los meses.
- ⚠️ **El diagnóstico obvio era el equivocado: «be95 ya vuelve el cobro a pendiente, alcanza».** Volver a `pendiente` cierra el
  caso en que nada llega tarde (S3, el control). Pero Stripe avisa el mismo fallo DOS veces y reintenta facturas solo: todo lo
  que mira «¿es de este cobro?» por el token (`sesionDelCobro` deja pasar por `metadata.mako_cobro`, la factura por la metadata)
  acepta una sesión o una suscripción VIEJA del mismo cobro. «Es de este cobro» no es «es la vigente».
- **La regla:** un fallo sólo toca el cobro si es de la sesión VIGENTE (`proveedor_ref`) o de una factura de la suscripción
  VIGENTE (la anotada o, antes del primer pago, la de la sesión vigente: `suscripcionVigente`, lib/cobros-webhook.ts). Un PAGO
  de una sesión anterior sí entra (es plata; `urlParaPagar` la expiró si seguía abierta); un pago de una factura de una
  suscripción anterior NO se asienta y abre un ticket (`avisarFacturaDeOtraSuscripcion`): la plata entró y hay que devolverla.
  Al armar B, la suscripción de A se cancela antes (si no se puede, no se arma B). `aplicarPagoFallido` escribe con
  compare-and-set también por la sesión que se leyó (la carrera: un aviso que leyó A antes de que se armara B).
- ⚠️ **Y el arreglo traía su propio defecto, encontrado antes de entregar:** cancelar sub_A dispara
  `customer.subscription.deleted` de sub_A, y la rama de suscripción del webhook marcaba el COBRO «cancelada» (y la suscripción
  del lead: el MRR la dejaba de contar) aunque B estuviera cobrando. La cancelación también se filtra por la vigente. **Regla:**
  una acción nueva en la pasarela (cancelar, expirar, reembolsar) vuelve como AVISO: mirá qué rama del webhook lo recibe.
- **Sin medir contra Stripe:** que Stripe reintente la primera factura de una suscripción con SEPA depende de la cuenta (Smart
  Retries); que una factura abierta de una suscripción cancelada todavía pueda cobrarse (un SEPA en vuelo), también. Por eso el
  pago tardío de la vieja abre un ticket en vez de suponer que no llega.

**Vive en:** lib/cobros-webhook.ts (las ramas de checkout, factura y suscripción; `suscripcionVigente`) · lib/cobros.ts
(`urlParaPagar`, `aplicarPagoFallido`, `actualizar` con `ref`) · lib/cobro-sesion-ajena.ts · tests/cobro-reintento.test.ts (el
guion del refutador, versionado, con dos casos nuevos: la cancelación de sub_A y la carrera).

## La compra a Meta de una venta externa salía DOS veces si el cron y el aviso coincidían (28/10/2026, a196d5a93)

- **El síntoma (z-meta.ts R2):** el cron corría mientras el aviso mandaba la compra a Meta; los dos miraban el historial («¿ya
  salió?»), ninguno lo encontraba y salían dos `purchase:cs_…` con el mismo event_id. Meta los debería descartar, pero entre dos
  eventos de SERVIDOR no lo garantiza (docs/hallazgos-ads.md).
- **El arreglo:** el cron no manda la compra que falta de un cobro externo que cambió hace menos de 10 minutos (el aviso puede
  estar trabajando); la manda en la vuelta siguiente. R2: antes 2 envíos, ahora 1.

**Sin hacer:** si la línea del historial no se puede escribir NUNCA (lead_audit rota), cada vuelta del cron pasados los 10
minutos la vuelve a mandar (R5). Lo arregla un reclamo escrito ANTES de mandar, en lib/cobros-externos-meta.ts (de Zernio).
**Vive en:** lib/cobros.ts (`reconciliarCobros`, `avisoTrabajando`) · tests/venta-externa.test.ts (o, p) ·
C:/dev/revisiones/scratch-a196/partners-zernio-refuta/z-meta.ts.

---

## «Figuran al día y no pagan desde agosto»: un cálculo y un dato, que parecían lo mismo (ticket #53 de Leila, 4/11/2026)

**Síntoma:** Leila (ws11): «tanto Carlos dominguez como Wilberth Vera figuran al día cuando no pagan desde agosto». El diagnóstico
obvio era UNO solo, «la regla de "Al día" no ve lo que se debe». Había dos cosas distintas, y ninguna era esa.

**Wilberth Vera (lead 1871): un cálculo, pero sólo en una rama.** Con su fecha de cierre, la regla andaba: `cobradoDelLead` decía
«Falta registrar 2 meses» (medido corriendo la función con sus filas). `lead_audit` lo dice todo: a las 05:00:39 del 4/11 Leila lo sacó
de Ganado a «Nutrición - Manual», eso borra `fecha_cierre` (`lib/lead-desenlace.ts`: la venta sólo vive con `cerro`), y a las 05:02
levantó el ticket. **El «Al día» lo produjo el clic con el que ella lo sacó.** `sinRegistrar` se cuenta sólo con un cierre: sin él quedaba
en 0 porque no se contó, y el semáforo caía al último renglón. «Al día» era el valor por defecto.

**Carlos Dominguez (lead 1713): un dato.** Está cargado como `unico`, US$40, con una cuota cobrada el 06/08. La ficha dice «Pagó todo» (no
«Al día»), y con esos datos es lo correcto: no hay cuenta que descubra que era una mensualidad. Su servicio dice «Lidermente pagó hoy»;
las demás ventas de Lidermente son `suscripcion` de US$40. Como suscripción daría «Falta registrar 3 meses». No se arregla en código.

**Los otros del mismo negocio** (ws11, las únicas 7 suscripciones sin cierre de toda la base; medido): «Al día» falso también en 1923
(Yahumara, último pago 26/08), 1852 (Belizario, perdido) y 1940 (Laura, perdida). Cargados como pago único con pinta de mensualidad:
2634 (Raul, US$40) y 1712 (Leticia, «Lídermente mensual», perdida). Las filas a reparar no se tocaron: las decide Leila.

**La regla:** un estado que AFIRMA algo («Al día», «Pagó todo») tiene que salir de una cuenta que corrió. Si el dato para contar no está, se
dice lo que se sabe («Último pago el…»), nunca el verde del último renglón. Y antes de tocar una regla de plata: correr la función con
las filas del cliente y leer `lead_audit` de esa noche.

**Lo que NO cambió:** «A quién cobrar» sigue leyendo sólo a los ganados (`getSuscripcionesPorCobrar`): quien sale de Ganado no entra, a
propósito. Para que Wilberth entre, vuelve a Ganado. Quien mueve un cliente que dejó de pagar a una etapa de nutrición lo saca de la cobranza:
la app no lo avisa, y Leila ya lo hizo con cinco.

**Vive en:** `cobradoDelLead`, `sinCierre` (lib/cobrado-lead.ts) · `estadoDeCuenta` (lib/pagos-vistazo.ts) ·
tests/pagos-vistazo.test.ts · tests/cobrado-lead.test.ts.

## La suscripción mes a mes: el problema no era la pantalla, era el modelo (5/11/2026, nube, `punta/suscripciones-ficha`)

**El pedido** (Martín, por el Cerebro: docs/relevo/suscripciones-ficha-encargo.md): «la suscripción es suben, bajan… otros
casos hay cortes… la pestaña de pagos dentro de lo que sería una venta de suscripción es algo que quisiera cambiarlo
completamente». La investigación de diez apps y lo que se copió (Chargebee, con las palabras de ChartMogul):
docs/investigacion-suscripciones.md.

**El diagnóstico obvio era el equivocado:** «la pestaña es muy compleja» se leía como un problema de diseño (cinco bloques
para una mensualidad). Lo que de verdad no se podía decir era el DATO. Una suscripción era UN monto
(`suscripcion_monto_usd`) y cada pago registrado contaba un mes (`mesesDeUnaCobrada`). Con Código Inmobiliario las dos
mentían: 146, 238 y 426 no caben en un número, y noviembre pagado en DOS pagos (94 y 144) contaba como dos meses, o sea
«adelantado». Rediseñar la pantalla sobre ese modelo habría dibujado más lindo lo mismo.

**Lo que quedó:**
- **Cada mes es un período** (lib/suscripcion-meses.ts, puro, con tests): lo que tocaba (el último cambio de monto hasta
  ese mes), lo que entró y sus pagos. Un pago va al mes que se eligió, o al más viejo que falta (como se aplica un pago
  a la factura más vieja); una mensualidad registrada va entera a un mes y un pago suelto cubre MESES ENTEROS por su
  plata (la regla de la quinta revisión: 10 × 550 son 10 meses, no 11). Un ajuste (el diferencial) suma al cash y no paga
  un mes.
- **Los cambios se AGREGAN con su fecha** (`suscripcion_movimientos`, mig 0401): monto desde un mes, corte, vuelta. La
  primera vez que cambia el monto se guarda el de antes desde el inicio (`conElMontoDeAntes`); sin eso, los meses de antes
  quedan «sin monto» (`montoDelMes` no inventa con el de hoy).
- **⚠️ COMPATIBILIDAD, y no es opcional:** sin cambios guardados (todos los datos de antes), una mensualidad sin mes vale
  UN mes aunque el monto de hoy sea otro. Contarla por plata, con el monto de hoy escrito encima del de antes, juntaba dos
  meses en uno e inventaba deuda (el caso de la quinta revisión, al revés). Lo fijan tests/pagos-plan-sueltos.test.ts y
  tests/suscripcion-meses.test.ts, y se probó rompiéndolo.
- **Una cuenta para todos:** `cobradoDelLead` usa la historia para «Falta registrar» y la próxima renovación, así que el
  estado de cuenta, «A quién cobrar», el teléfono, la API (`cobranza_lead`, `ver_suscripcion_lead`) y la tab dicen lo
  mismo. `getMrrActivo` cuenta la mensualidad de ESTE mes (un cambio para diciembre no cuenta en noviembre) y, sin monto
  cargado, lo pagado el último mes (`estimadas`): los tres clientes de la plataforma daban MRR 0 con pagos hechos.
- **La tab:** con el bloque `suscripcion` en la hoja, en una venta de suscripción se callan el estado de cuenta, las cuotas,
  la venta y (sin movimientos de la pasarela) los movimientos (`suscripcionAlLado`, app/crm/lead-view/ficha/reglas-pagos.ts).
  Para eso el armador le pasa a `estaVacio` los bloques de la hoja (`hermanos`). El bloque va primero en todas las
  plantillas de Pagos: en cualquier otra venta se calla.

**Trampas que aparecieron:**
- **Un hook después de un `return null`:** el bloque nuevo agrupaba los meses con `useMemo` debajo de `if (!s) return null`.
  El typecheck lo deja pasar y `scripts/hooks-en-orden.sh` lo frena: va como cálculo plano.
- **El tsc acotado muere con 2,5 GB** cuando un archivo importa `app/crm/actions.ts` (arrastra media app). En la nube hay
  RAM: `--heap=7000`.
- **Un guard que citaba la lista de columnas del MRR** (`tests/cuota-fecha-y-cancelacion.test.ts`) dio rojo al sumarle el
  id: se reescribió para afirmar lo que cuida (que la lectura traiga la cancelación).
- **Sumarle un parámetro a una regla rompe a quien la CONVIERTE, no a quien la llama.** `estaVacio` pasó a recibir los
  bloques de la hoja, y dos tests que hacen `REGLAS_PAGOS as Record<string, …>` con una función de un parámetro dieron
  TS2352 en el tsc entero; el acotado de los archivos tocados no los incluía. Los parámetros nuevos van opcionales
  (`(ctx, _p?, h?)`), y al acotado se le suman los tests que importan el módulo.
- **Dos funciones con el mismo nombre:** `movimientosDelLead` ya existía en lib/pagos-vistazo.ts (lo que movió plata) y
  crm.run.ts la importa. La de la base se llama `cambiosDeSuscripcion`.

**Lo que quedó sin hacer:** aplicar la 0401; cargar los datos de los tres clientes de la plataforma (el relevo dice qué);
la vista mes a mes en el teléfono (/m muestra el estado de cuenta, ya con la cuenta nueva, no los meses); el prorrateo
automático del diferencial (hoy lo calcula Martín y se registra como ajuste).

**Vive en:** lib/suscripcion-meses.ts · lib/suscripcion-movimientos.ts · lib/suscripcion-cambios.ts · lib/suscripcion-api.ts ·
lib/cobrado-lead.ts · lib/queries.ts · app/crm/lead-view/ficha/pagos/suscripcion.tsx · app/crm/lead-view/ficha/reglas-pagos.ts ·
app/crm/[id]/suscripcion-actions.ts · app/api/crm/comprobante-pago/route.ts · supabase/migrations/0401_suscripcion_movimientos.sql

## La renovación de Stripe con su aviso perdido no entraba nunca (6/11/2026, nube, barrido de pendientes)

El mes 2 en adelante de una suscripción de Stripe entra SÓLO por su `invoice.paid`. `reconciliarCobros` (lib/cobros.ts) mira la
sesión del checkout, que ya está pagada, así que un aviso perdido (Stripe reintenta 3 días y abandona) era plata cobrada que MaKo no
asentaba: ni la cuota, ni la ganancia del partner (que se acredita con el 2º mes), ni la cuota que mira el corte por falta de pago.
Ahora una vez por día el cron recorre las suscripciones activas de Stripe CON LEAD cuya última cuota tiene más de 25 días, lista
sus facturas pagadas y asienta las que faltan (`renovacionesPerdidasStripe` + `renovacionesQueFaltan`, lib/cobros-eventos.ts), con el
mismo camino y el mismo id que el aviso. Lo fija tests/stripe-renovacion-perdida.test.ts.

Lo que se cuida, y por qué (la mitad lo encontró la revisión adversarial antes de subir):
- **Sólo `subscription_cycle`:** la factura de la creación nunca es una renovación, y un cobro viejo que guardó un `cs_` o `pi_`
  para su primer pago la duplicaría. En una prueba gratis el primer pago (el día 8) sí es un ciclo: lo excluye `primera`.
- **«Ya está» es su cuota en `pagos` (por `cobro_id`):** sin lead no hay cuota, y volver a aplicar una renovación ya aplicada
  repetiría el aviso al equipo (su dedup dura 3 días). Por eso sólo cobros con lead.
- **Sin valor en dólares no hay cuota:** una venta externa en pesos nace con `monto_usd` null; `aplicarPagoAprobado` no le escribe la
  cuota, así que la «renovación perdida» se volvía a aplicar cada día (reescribiendo el `motivo` del cobro, que lee la baja pedida) y
  terminaba en un ticket falso. Se descarta con `montoUsdDeLaCuota`, el mismo cálculo.
- **Cuatro días de margen, no dos horas:** Stripe reintenta su aviso hasta 3 días; asentada antes, el reintento la encontraba con
  cuota y volvía a llamar al CRON «Pagos» del lead (una automatización con reentrada «siempre» diría «gracias» dos veces).
- **Hasta 14 días, sola; más vieja, un ticket** (`avisarRenovacionVieja`, lib/cobro-sesion-ajena.ts): asentarla dispara el aviso y
  el CRON del lead, y un WhatsApp de «gracias por tu pago» por un pago de hace meses es peor que no mandarlo.
- **Todas, y empezando por otra cada día:** con un `.limit` antes del filtro, las de id más alto (las más nuevas, justo las del 2º
  mes) no se miraban nunca; con el mismo orden cada día, las que el tiempo dejaba afuera, tampoco.
**Sin hacer:** el orden de los NEGOCIOS en la vuelta del día (`giro` del cron, app/api/cron/cobros-reconciliar/route.ts) repite si
la cantidad de negocios con pasarela divide a 48: si una corrida se queda sin tiempo, los del final pierden ese día (hoy son pocos
y la corrida termina). Una anual cuesta una llamada a Stripe por día pasados los 25 días (gratis, con el tope de tiempo).
**Vive en:** lib/cobros.ts (`renovacionesPerdidasStripe`) · lib/cobros-eventos.ts (`renovacionesQueFaltan`) ·
lib/cobro-sesion-ajena.ts · app/api/cron/cobros-reconciliar/route.ts · tests/stripe-renovacion-perdida.test.ts
