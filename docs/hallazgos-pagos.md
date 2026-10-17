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

### Cliente de agencia (#866 y #867)

No es de esta tab: es la pasarela y la cuenta de la agencia. Está en
[hallazgos-planes-y-cobro.md](hallazgos-planes-y-cobro.md), «El mes de un cliente de agencia».

## 4 · Lo que quedó SIN hacer

| Qué | Dónde vive | Por qué |
|---|---|---|
| El Dashboard dibuja «Pendiente» una cuota de baja (o devuelta) en la tabla de cuotas con «Todo» | lib/graficos-datos.ts, `filasPagos` | Es una tabla de filas, no una suma. Es del Dashboard |
| La «baja del cliente» no se vio en el navegador | app/crm/lead-view/ficha/pagos/bloques-cobro.tsx | Sin RAM para `next dev`. Mirarla en el ws3 con un ganado con cuotas vencidas |
| La tab Pagos de **Customer Success** sigue montando DealDetailsCard. Con ella siguen vivos EditarDeal, `?edit=1`, «✦ Completar con IA», `saveDealSectionsAction` y `saveCuotasAction`. Cuando CS pase a bloques, se borran juntos, con las aserciones que los fijan (crm-cuota-cobrada, ganado-monto, muestra-pagos, pago-comprobante, ficha-se-relee) | app/customer-success/FichaPestanas.tsx:84, app/crm/[id]/LeadDetailBody.tsx:207 | Es la tanda T3 del CRM (Pagos + CS). La ficha de CS no tiene el `CtxFicha` entero |
| Bloques del catálogo sin componente: `confirmacion-de-pago`, `recordatorios-de-cobro`, `excepciones` y `cliente-en-cs`. Están en las plantillas y se saltean | app/crm/lead-view/ficha/reglas-pagos.ts | Cada uno necesita su lectura. Para los recordatorios, por ejemplo, no hay forma barata de leerlos por lead: falta la columna `lead_id` (mig 0186) |
| Diseños que no se dibujan: `cobrado` anillo, `cuotas` lista y calendario, `suscripcion` tarjeta y meses, y los de `oferta` (OfertaDelLead es sólo el desplegable) | registro-pagos.tsx | No se ofrecen: el menú «Diseño» sólo muestra los que están en `disenos` |
| **No se vio en el navegador**, ni en escritorio ni en el teléfono | — | No hubo RAM para `next dev`. Hay que mirarlo en producción con un ganado con cuotas, una suscripción y un lead abierto |
| El teléfono muestra el saldo pero no cobra: no hay «Mandar link» | app/m/crm/[id]/FichaLead.tsx | El teléfono destila. El cobro con link en el teléfono es otra pieza |
| Marcar a mano una cuota cuyo link ya se pagó pero no se asentó: después el cron la asienta como otra cuota y lo cobrado se cuenta dos veces | lib/pagos.ts, `cobrarCuota` | Frenarlo puede trabar una cuota para siempre si el pago entró por otro monto. Se ve el link pagado en «Links de pago» |
| `epico` ya está en PropsBloque; falta sacar el cast | pagos/bloques-cobro.tsx, `esEpico` | Lo hace el CRM (se lo pasó Pagos el 16/10) |
