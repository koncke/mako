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
  cuotas (uno por cobrada, como cuenta `cobradoDelLead`) y se arman sólo los que faltan. Un pago único con un pago
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
- **Sin hacer:** los planes YA armados con montos convertidos así no se corrigen solos. El que se midió (ws11, lead 2605)
  lo decide Martín con el cliente.
