# Hallazgos — planes, capas y cobro

El área es lo que pasa **cuando el producto empieza a cobrar y a cortar por plan**:
`lib/capas.ts`, `lib/tab-access.ts`, el alta de `app/api/admin/workspaces`, `app/terminos`,
y el modelo de negocio de `app/admin/dev/pricing/modelo.ts`.

Sale de la corrida del 04/10/2026 (seis lectores + seis refutadores) sobre el audio del
plan de los próximos días. El entregable con las fechas es
[proyeccion-04oct.md](proyeccion-04oct.md); acá queda lo que vuelve a morder.

---

## El barrido del 31/10: la tercera pasarela dejó NUEVE lugares donde no se cobra, y ninguno da error

**Lo que se midió:** el commit de Creem (`5faf71e0e`) dice en su propio mensaje que cazó 53 ternarios
de dos ramas. Un barrido adversarial posterior (107 agentes, cada hallazgo contra tres refutadores con
lentes distintas) encontró **nueve más**: ninguno rompía un test ni tiraba un error. Los nueve están
cerrados, y al cerrarlos, entre las copias por valor y una revisión adversarial del arreglo, aparecieron
**más peores que no estaban en la lista** (abajo). El peor: ningún aviso de Creem habría entrado nunca.

**Por qué el diagnóstico obvio falla acá:** el commit de Creem escribió, en comentarios, que varios de
estos lugares ya estaban arreglados. Dos tenían, **once y sesenta líneas más arriba**, un comentario del
propio commit diciendo que ese bug se derivó de `Pasarela` — y debajo seguía la lista de dos escrita a
mano. Un comentario que afirma que algo se arregló no es evidencia: se lee el código.

**Ya es un patrón de este repo, no un descuido suelto:** tres veces el mismo día, y las tres del mismo commit: `cobroDeLaCuenta` y
`cobro-etapa`, con su comentario en pasado encima del bug, y el `?w=`, con dos comentarios afirmando que la URL lo llevaba. El
comentario se escribe con la intención, y cuando el cuerpo no acompaña queda declarado muerto un bug vivo: nadie lo vuelve a mirar.

**Y lo mismo vale para un estado:** «Creem no está conectado» estaba escrito acá, en `pendientes.md` y en cada mensaje del día, mientras
Martín lo conectaba a las 19:22 UTC; apareció sólo al ir a medir otra cosa. Y lo contrario: el bug de la prueba del día 8 se iba a
reportar como que le pasaba a clientes de hoy, y la base decía que no (la prueba apagada, y 2 cobros en total). Lo que importa para
decidir se mide en el momento.

**Un arreglo a lo que se hace AL CONECTAR no repara lo ya conectado.** El `?w=` se corregía en `asegurarWebhookCreem`, y una cuenta
conectada ni siquiera ofrece «Volver a conectar»: desplegarlo dejaba rota, sin un error, la única cuenta que existía. Por eso
`repararAvisoCreem` corre en cada vuelta del cron, y por eso NO crea nada: un aviso nuevo tendría otro secreto, que nadie guardaría.

**Y LO MÁS CARO DEL DÍA: no había que esperar el deploy. Lo roto era el DATO, no el código.** La ruta 
`app/api/webhooks/creem/route.ts` ya estaba en producción exigiendo el `?w=` (`req.nextUrl.searchParams.get('w')` →
`wsPorIdentificadorEstricto` → el secreto → la firma): lo único mal era la URL guardada EN CREEM. Se arregló a mano el 31/10
a las 20:30 UTC con un PATCH a `/v1/webhooks/{id}` y el mismo destino que escribe el código
(`${url.split('?')[0]}?w=${encodeURIComponent(id)}`), y los avisos entraron en el acto — con el tren todavía corriendo.
Medido antes y después contra la API de Creem, y el último eslabón también: el `wh_…` resuelve al ws 9, cuenta `principal`.
**La regla:** cuando un bug de producción es una CONFIGURACIÓN GUARDADA que el código ya desplegado espera, el arreglo es
dato y no viaja en el tren. Preguntarse siempre, antes de esperar un deploy: ¿qué parte de esto es código y qué parte es un
valor que puedo corregir ahora? El arreglo del cron sigue valiendo igual, pero para que NO VUELVA a pasar y para las cuentas
que se conecten mañana, no para esta.

**Dónde estaba el error de verdad, cuando no era el que decía la lista:**

- **«La prueba gratis no entrega la cuenta» era el SEGUNDO escalón.** El primero: `crearCobro` rechazaba
  el `inicioAt` que le manda /planes, porque preguntaba `p.pasarela === 'stripe'`. La prueba por Creem ni
  se creaba. Mirando sólo `activarPruebaSiAutorizo` se arreglaba un camino al que nadie llegaba.
- **«La misma tarjeta saca prueba tras prueba» NO SE PUEDE ARREGLAR del todo.** Ningún objeto de Creem
  trae la tarjeta: ni la suscripción, ni el cliente, ni la transacción. Lo más que da es `customer.id`, que
  va por email: `cr:<cliente>|card:-`. Corta al que repite con el mismo email en Creem aunque en MaKo escriba
  otro; con otro email también en Creem, **pasa**. La pantalla ya no dice «esa tarjeta» cuando no lo sabe
  (`huellaDeTarjeta`). Hay un test que lo afirma, para que el día que Creem la exponga alguien la use.
- **«Nunca llama a `plazoDelCobro`» sugería agregar la llamada al checkout, y eso no arregla nada:** Creem
  no sabe «terminá el día X». Lo único que tiene es la baja agendada al fin del período en curso, así que
  el plazo se cierra cuando se paga el ÚLTIMO ciclo (`tocaCerrarElPlazo`, por fechas y no contando
  transacciones: un cobro de diferencia al subir de plan también es una). Y una vez por día lo repasa el
  cron (`asegurarPlazosCreem`), o un aviso perdido agrega un mes.
- **«No hay endpoint para descontar» era verdad y no era el final.** No hay cupón sobre una suscripción
  abierta, pero el precio ES el del producto: se crea uno rebajado y se la pasa a él con `/upgrade`
  (`cambiarPrecioCreem`, `proration-none`). Es el mismo modelo que Mercado Pago: lo rebaja MaKo y lo devuelve
  el cron. Así salen el descuento, bajar de plan y pasar a Pro (éste con `proration-charge-immediately`).

**Lo que el barrido no vio, y era peor (buscando las copias por el VALOR viejo, y leyendo el OpenAPI):**

| Dónde vive | Qué pasaba | Plata |
|---|---|---|
| `lib/creem-api.ts`, `asegurarWebhookCreem` | **La URL del aviso se registraba sin `?w=`, y la ruta rutea por ese `?w=`: 401 a TODOS los avisos.** Dos comentarios afirmaban que la URL guardada lo llevaba, y ningún código lo hacía. Creem abandona a las 24 h: ni un pago, ni un alta, ni una renovación. Ahora se escribe con `PATCH /v1/webhooks/{id}` | **Nada entra** |
| `lib/creem-api.ts`, `transaccionDe` | `created_at` de una transacción es un NÚMERO (el de una suscripción es ISO). Leído como texto, `Date.parse` da NaN y un `sort` con NaN no ordena: «la más nueva» era la primera que viniera, y el listado no tiene orden. Y la cuota llevaba la fecha de hoy. El test pasaba porque el doble mandaba ISO | Renovaciones sin asentar, cash en otro mes |
| `lib/cobros-webhook.ts`, reembolso | Siempre `total` y sobre el PRIMER pago: US$5 devueltos del mes 5 dejaban el cobro «reembolsado», desmarcaban el mes 1 entero, y un plan vivo desaparecía de «Tu plan» mientras Creem seguía cobrando. Sale de releer la transacción: `refunded` o `partialRefund`. ⚠️ `refunded_amount` incluye impuesto: compararlo con `amount` da mal | Cash y plan falsos |
| `lib/cobros-eventos.ts`, `avisoCreem` | Un reembolso o disputa no trae `metadata` ni `request_id` arriba: están en su `checkout`, y sólo `transaction` es obligatorio. El de un pago ÚNICO no encontraba su cobro y se ignoraba con 200, después de prometerle a quien devolvía que MaKo lo registraba solo | Devolución sin asentar |
| `lib/cobros.ts`, `aplicarPagoFallido` | **Todas las pasarelas:** el cobro del día 8 de una prueba que se rechaza la pasaba a `fallido`, y ahí dejaba de ser su plan: sin baja, «sin pasarela» (acceso sin deuda), con la tarjeta reintentándose. Sigue en prueba y da la mora que ya estaba escrita | Acceso gratis, sin baja |
| `lib/cobros.ts`, anular un link | Cancelaba con el id del checkout, que no corta nada, y su checkout no vence. Pagado después, su suscripción cobraba todos los meses. Ahora se corta al entrar el pago (`cierraElCheckout`) | Cobra de más |
| `lib/agente-redaccion.ts` | Una clave `creem_…` pegada en el chat no se tapaba: llegaba entera al modelo y quedaba guardada | Un secreto |
| `lib/creem-api.ts`, los montos | **Todo monto de Creem viene en centavos** («1000 = $10.00») y se leía tal cual: una renovación de US$47 entraba al cash como US$4.700. El test decía `monto === 1000` y lo afirmaba | Cash y MRR inflados ×100 |
| `lib/creem-api.ts`, `buscarTransaccionesCreem` | Mandaba `subscription_id`, **que no existe** en `/transactions/search`: un parámetro desconocido se ignora, vuelven las de TODA la tienda, y «la más nueva» podía ser de otro cliente | Se asienta la plata de otro |
| `lib/plan-deuda.ts`, `confirmarImpago` | Antes de cortar por impago le preguntaba a Mercado Pago, que no conoce el cobro: «sin pagos». Un aviso perdido le cortaba el acceso a quien SÍ pagó | Cliente pagando, afuera |
| `lib/plan-deuda.ts`, `pagarDeuda` | En mora con la suscripción viva abría un cobro aparte mientras Creem reintentaba | Dos cobros |
| `lib/cobros.ts`, `darDeBajaMiPlan` | Por el `else`, la baja cortaba en el acto: la pantalla prometía el período pagado y la tabla decía `bajaAlFinDelPeriodo` | Pierde lo que pagó |
| `app/api/integraciones/cuentas/route.ts` | `idEnElProveedor` mandaba **la clave de Creem del negocio a la API de Mercado Pago**. Y `esProveedor` contestaba «servicio inválido» a la tarjeta de Creem | Un secreto a un tercero |
| `lib/agencia-plan.ts`, `lib/agencia-cobro.ts` | Cambiar el plan de un cliente de agencia pedía a Mercado Pago; la renovación se abría un mes antes, sin `inicio_at` | No cobra, o cobra antes |

**Lo que NO está medido, y es lo primero a mirar el día que se conecte Creem:** todo lo de arriba corre contra
un Creem en memoria armado de su OpenAPI (`tests/_creem-cobra-hijo.ts`), nunca contra una clave de verdad. Su doc
no dice: qué pasa con `next_transaction_date` al reanudar una pausa (por eso se reanuda un día antes del fin del
ciclo cubierto, lo que sirve con cualquiera de las dos respuestas), si `/upgrade` acepta bajar de precio, si el
arranque de una prueba deja una transacción en cero (`transaccionQueCobra` la descarta por las dudas), en qué unidad
viene el `created_at` de una transacción (`fechaDeCreem` acepta segundos o milisegundos), ni si `product` viene siempre
como objeto (si viene como id, el precio es «no sé» y la oferta trabada no se libera).

**La trampa del doble:** el Creem en memoria se escribe con lo que uno cree del contrato, así que un error de lectura
da verde dos veces. Lo de los centavos y lo de la fecha estaban en el test AFIRMADOS. Un doble se arma leyendo el
OpenAPI campo por campo (`docs.creem.io/api-reference/openapi.json`), no el ejemplo de una página.

**El guardia que estaba ciego:** `tests/pasarela-sin-env.test.ts` no miraba las tres claves de Creem. Ya las mira.

**También del 31/10:**

- **Al rótulo del checkout público de /planes le faltaba Creem**, así que su opción salía con el radio
  EN BLANCO: el comprador no sabe qué elige y se va, y el que no se leía era el de LatAm. El
  `Record<Pasarela, string>` es total y TypeScript lo veía (TS2741), pero `next.config.ts` tiene
  `ignoreBuildErrors: true` y el build lo dejó pasar. **Un error de tipos en una pantalla pública no lo
  frena nada**: el guardia de texto quedó en `tests/creem-pasarela.test.ts`, que no depende de que corra
  `tsc`. Se ve cuando se ofrecen dos pasarelas: país desconocido (local, o una IP que Vercel no ubica) o
  la preferida sin conectar.
- **A qué ficha se le ata un pago lo decidía un `else`.** `leadDeLaCompra` preguntaba
  `motivo === 'email' || (motivo !== 'nombre' && sinOtroEmail(...))`: todo motivo nuevo entraba solo en
  «le ata la compra», y lo que se ata es el pago de una persona a la ficha de otra (marca Ganado y pisa
  la cuenta en `asentarAlta`). Pasó de verdad cuando se sumó `'instagram'`. Y el parámetro tipaba
  `motivo: string`, así que el compilador tampoco veía un renombre. Ahora es un
  `Record<MotivoDuplicado, …>` TOTAL en quien toma la decisión. ⚠️ **Esto importa más desde el 31/10:
  con el WhatsApp pedido en el checkout, el número lo escribe cualquiera en un formulario público** — un
  dígito mal, o el dueño comprando para su segundo negocio.
  Y el `'instagram'` de esa tabla **no lo probaba nadie**: una tabla total sin un caso por renglón es
  documentación, no una red. Cada motivo tiene ahora el suyo.

**La regla que queda:** una diferencia entre pasarelas va en un `Record<Pasarela, …>` TOTAL o en un
`switch` con `never`, nunca en un ternario de dos ramas ni en un `else`. Y antes de dar por arreglado un
ternario, **buscar sus copias por el valor viejo** (`'stripe'`, `'mercadopago'`, `!== 'mercadopago'`),
no por el nombre del tipo: un literal `['stripe','mercadopago']` es asignable a `Pasarela[]` y el
compilador no dice nada.

**Mientras estos nueve estén abiertos, conectar Creem en producción los prende todos juntos.** Hoy están
inertes porque la clave no está en Vercel y el webhook es fail-closed sin secreto.

---

## Una pasarela nueva no agrega un valor: convierte 53 ternarios correctos en bugs silenciosos (31/10/2026)

**Vive en:** `lib/cobros-tipos.ts` (`Pasarela`, `CAPACIDADES_PASARELA`, `COMISION_PASARELA`) · `lib/creem-api.ts` ·
`lib/pasarela-firma.ts` (`verificarFirmaCreem`) · `app/api/webhooks/creem/route.ts` · `lib/cobros-webhook.ts`
(`procesarEventoCreem`) · `lib/cobros-eventos.ts` (`eventoCreem`, `avisoCreem`) · `lib/cobros-conexion.ts`
(`descubrirCreem`) · `supabase/migrations/0358_cobros_pasarela_creem.sql` · `tests/creem-pasarela.test.ts`
(12 roturas cazadas).

### El diagnóstico obvio era el equivocado, dos veces

**1. «Agregar Creem es escribir el cliente de Creem.»** Falso, y por mucho. El cliente nuevo son 400 líneas que no
tienen con qué equivocarse: o andan o dan un error visible. El trabajo real —y el riesgo— estaba en los **53 lugares
que ya existían** y que comparaban contra DOS pasarelas. Con dos valores, `p === 'stripe' ? A : B` es *correcto*. Con
tres, la rama `B` se traga al tercero **en silencio**: es código válido, que corre, contra el proveedor equivocado. No
lo ve el compilador (las dos ramas tipan bien), no lo ve un test que no existe, y no lo ve una review que lea el
renglón sin preguntarse cuántos valores tiene el tipo.

Los tres que costaban plata de verdad:

| Dónde | Qué hacía con un cobro de Creem |
|---|---|
| `crearCheckout` (`lib/cobros.ts`) | `if (proveedor === 'stripe') {…}` y después, **sin else**, caía a Mercado Pago: le creaba una suscripción **REAL en Mercado Pago**, en la moneda de esa cuenta, y guardaba su id en el cobro de Creem. Se le cobraba a una persona por el proveedor equivocado, sin un solo error. |
| `cancelarSuscripcionCobro` | Cancelaba contra Mercado Pago. MP contestaba **404** por un id que no es suyo, y el `r.status !== 404` —puesto el 30/10 para que «ya cancelada» no frenara la baja— **se comía el error**: corría `aplicarSuscripcionCancelada`. La base decía «cancelada», el cliente veía su baja hecha, y **Creem le seguía cobrando todos los meses**. Sin error, sin log, sin ticket: aparece en el resumen de la tarjeta del cliente, meses después. |
| `cerrarLinkEnLaPasarela` | `if (stripe) … else if (mercadopago) …`, **sin else**: el link anulado quedaba abierto y pagable. Lo llama `anularLinksDeCuota` (la cuota ya cobrada por otro lado), o sea que el agujero es un **doble cobro**. |

Y el patrón inverso, igual de malo: `urlParaPagar` preguntaba por Mercado Pago y después **asumía Stripe**, así que un
cobro de Creem llegaba a `leerCheckoutStripe` con una ref de otro proveedor.

**2. «El compilador me va a avisar.»** Avisó de 13 de los 66. El motivo es que la unión estaba **copiada a mano en
cinco lugares**, independientes de `Pasarela`:

- `ProveedorConCuentas` (`lib/cuentas-integracion.ts`) — y con ella **todo** el subsistema de cuentas: nombres de
  claves con sufijo, ruteo de avisos, «Vincular cobro»;
- `ProveedorPago` (`lib/cobro-etapa.ts`), `OpcionDeCobro.pasarela` (`lib/agencia-cobro-reglas.ts`),
  `SuscripcionVisible.proveedor` (`PlanPanel.tsx`), y los `proveedor: 'stripe' | 'mercadopago'` de `lib/pagos.ts`.

Ensanchar sólo `Pasarela` dejaba a ese subsistema sin un error y **sin saber que Creem existe**. Las cinco ahora se
derivan de `Pasarela`.

### Lo que no se ve y descarta en silencio

- **`pasarelasConectadas` tenía `['stripe', 'mercadopago']` escrito literal**, y ese literal **es asignable a
  `Pasarela[]`**: cero error, y Creem conectado y cobrando se reportaba como «no hay pasarela» en todos sus llamadores
  (el checkout de /planes, la ficha, la API de MaKo y el cron). Igual en `cuentasDePago` (`PROVEEDORES`) y en
  `workspacesConPasarela` (`.in('servicio', […])`, que decide a qué negocios visita el cron).
- **`PASARELAS_CON_PRUEBA` (`lib/prueba-plan-reglas.ts`) no se ensancha sola**, y es la que decide si una pasarela se
  **ofrece** en /planes. Una pasarela que sepa hacer la prueba y que nadie agregue ahí queda conectada, cobrando e
  **invisible en la vitrina**. Es el mismo bug que el 27/10 dejó a Stripe fuera y le mandó la Mercado Pago argentina a
  una clienta de México: volvió a aparecer con otro nombre.
- **`credenciales.ts`: `servicioDeRuteo === 'stripe' || === 'mercadopago'`** decidía si al borrar una clave se suelta
  SU fila de ruteo o **todas las del servicio**. `servicioDeRuteo` es `string`, así que con Creem daba `false` y borrar
  una clave se llevaba el ruteo de **todas** sus cuentas. Palabra por palabra el bug que el comentario de esa línea
  dice haber arreglado el 22/10 para Mercado Pago.
- **Los tres CHECK de `0255` limitan `proveedor` por SQL.** El crítico no es `cobros`: es **`pasarela_eventos`**, que es
  la deduplicación de avisos. Sin ensancharlo, el webhook no puede ni dejar rastro, `reclamarEvento` tira antes de
  aplicar, y el pago quedó cobrado en Creem y nunca entró a MaKo.

### La regla que queda

> **Una diferencia entre pasarelas no se escribe con un ternario de dos ramas.** Va como campo de
> `CAPACIDADES_PASARELA` (un `Record<Pasarela, …>` **total**: la pasarela #4 no compila hasta que alguien decida qué
> hace), o como `switch` con `default: { const _x: never = p; }`. Y una lista de pasarelas se escribe `PASARELAS`,
> nunca a mano: el literal tipa igual y no avisa.
>
> Corolario: **antes de ensanchar una unión, buscar sus copias** (`grep` por el valor viejo, no por el nombre del
> tipo). Una copia que se queda atrás no falla: descarta al valor nuevo en silencio.

### Creem, lo que dice su documentación y no se deduce del parecido con Stripe

Leída en pantalla el 31/10/2026. Atajo que ahorra horas: **cualquier URL de `docs.creem.io` acepta `.md` al final**, y
las de `/api-reference/endpoint/*` devuelven el **OpenAPI completo** con sus enums.

- **La clave va en `x-api-key`**, no en `Authorization: Bearer`.
- **El checkout NO cobra sin un `product_id`.** No existe el precio en línea de Stripe (`price_data`) ni el
  `unit_price` de una preferencia de MP: cada cobro **crea su producto** primero (de ahí el `Idempotency-Key` en los dos
  POST, o un reintento llena la cuenta del negocio de productos duplicados).
- **`price` en CENTAVOS**, y con piso: «must be 0 or at least 100». No hay precios de 50 centavos.
- **Moneda: enum cerrado `USD` | `EUR`.** La página de precios promete «multi-currency» y el OpenAPI no lo permite.
- **Leer una suscripción es por QUERY STRING:** `GET /v1/subscriptions?subscription_id=…`. `/v1/subscriptions/{id}` no
  existe — y suponerlo por parecido con Stripe da 404 justo en el camino que decide si una baja se asienta.
- **Cancelar no tiene `cancel_at_period_end`:** es `{ mode: 'immediate' | 'scheduled' }`. Y **`mode` se manda siempre**,
  porque sin él el default «can be configured in the store billing settings»: qué hace «dar de baja» dependería de una
  pantalla del panel y no del código. `onExecute` es **camelCase** en una API que por lo demás es snake_case.
- **El descuento de un solo ciclo existe de verdad:** `duration: 'once'` — «applies only to the first payment», y el
  caso de uso que da la doc es literal «50% off your first month». Se aplica en el **checkout** (`discount_code`) y el
  segundo mes vuelve solo al precio lleno. **Creem no necesita el remiendo de `lib/primer-mes.ts`** (que a Mercado Pago
  le sube el monto a mano al entrar el primer pago). Pero **no hay endpoint para descontarle a una suscripción ya
  abierta**: se aplica al nacer o no se aplica.
- **El tipo del evento está en `eventType`** (camelCase) y `created_at` llega en **milisegundos como número**. El id es
  `evt_…`, igual que Stripe, y eso es justo lo que hace creíble suponer que el resto también es igual.
- **La firma es HMAC-SHA256 hex del cuerpo CRUDO y nada más** (header `creem-signature`): sin timestamp, sin esquema
  versionado. ⚠️ **El ejemplo oficial de la doc usa `JSON.stringify(req.body)`, y eso rompe la verificación** en cuanto
  el cuerpo trae un nombre con acento (re-serializar cambia bytes). Va `req.text()`.
- **Sin timestamp no hay protección contra la repetición:** una firma válida capturada vale para siempre. Lo que cubre
  ese hueco es la dedup por `id` **más** la relectura del recurso. Y el detalle fino: los reintentos automáticos
  **conservan** el `id`, pero un **reenvío a mano** desde el panel llega con un `id` NUEVO — así que la dedup no
  protege de un reenvío manual, y de ahí que lo que se aplica salga de releer el estado y no de contar eventos.
- **El acceso lo da `subscription.paid`, no `subscription.active`** (lo dice la propia doc: «use [active] only for
  synchronization»). `paid` «fires for the first payment and every renewal»: el alta y la renovación entran por el
  mismo evento.
- ⚠️ **`subscription.expired` NO corta nada.** Su ejemplo oficial llega con `status: "active"`, la doc dice que «payment
  retries can happen at this stage» y que el estado es terminal **sólo** en `canceled`. Tratarlo como baja le saca el
  acceso a alguien que todavía puede pagar. `past_due` y `unpaid` son el **grace period del dunning** — la propia doc de
  Creem advierte contra gatear por `status === 'active'`, que voltea a los que están en prueba o reintentando.
- **El estado se lee de `object.status`, nunca del nombre del evento**, y el parser tolera un valor fuera del enum: la
  doc lista siete estados en el OpenAPI y menciona un octavo (`incomplete`) sólo en prosa.
- **Los montos vienen por triplicado:** `amount` SIN impuesto, `tax_amount`, `amount_paid` CON impuesto. **MaKo asienta
  `amount`**: el impuesto lo cobra y lo remite Creem (es merchant of record), no es ingreso nuestro — asentar
  `amount_paid` inflaría el MRR con plata que nunca fue de MaKo.
- **La comisión pega sobre el total CON impuesto**, no sobre el precio. La página de precios dice «3.9% + 40¢» y deja
  creer que es sobre la venta; la doc de payouts da el ejemplo: US$20 + US$4 de IVA → **US$1,33**, no US$1,18. Y sobre
  el ticket de US$47 de MaKo el **cargo fijo manda**: 3,9% + 0,40 = US$2,23 = **4,74%** del precio. Decir «3,9%» sería
  mentir en un ticket chico (`comisionDeLaPasarela`, con su test).
- **Lo que la doc NO dice, y lo busqué en todo su corpus: la cadencia de reintentos de cobro.** Dice «according to the
  retry schedule» y nunca define el schedule. ⚠️ **Trampa:** sí documenta en detalle un calendario de reintentos, pero
  es el de **entrega de webhooks** (5 intentos: 30 s, 5 min, 30 min, 6 h; nada después de 24 h; timeout de 15 s). Es
  fácil leer uno y creer que es el otro. Por eso MaKo **no predice** cuándo Creem se da por vencida: espera el
  `subscription.canceled`.

### Dos cosas propias de Creem que cambiaron el diseño

- **Creem no tiene ningún endpoint que diga de quién es una clave.** Stripe tiene `GET /v1/account` → `acct_…`; Mercado
  Pago `GET /users/me` → `user_id`. Creem, nada — y el ruteo de avisos **necesita** un identificador estable por cuenta.
  La salida: el identificador es **el id del endpoint de aviso** (`wh_…`) que MaKo registra en esa cuenta
  (`CREEM_WEBHOOK_ID`), que es estable, es de esa cuenta y sólo lo conoce quien tiene la clave. Viaja como `?w=`.
  Consecuencia: **el orden de conexión es al revés que en las otras dos** — primero se prueba la clave, después se
  registra el aviso, y recién ahí hay identificador para reclamar.
- **El webhook es FAIL-CLOSED, al revés que Mercado Pago.** En MP el aviso es flaco (un id) y la seguridad real es la
  relectura obligatoria: un aviso falso sólo provoca una lectura, así que sin secreto se acepta. El de Creem **trae el
  objeto entero y el `eventType`**: aceptar sin verificar sería dejar que cualquiera POSTee un `subscription.paid` y se
  dé de alta un plan gratis. Sin secreto, rechaza todo — y por eso `conectada` **exige** el secreto (regla de Stripe,
  no de MP) y la conexión falla sin guardar nada si Creem no lo devuelve.

### La pasarela por país, que es una decisión de producto

`pasarelasDelPais` decide: Mercado Pago sólo en el país de **su** cuenta (medido: a un argentino, US$47 con tarjeta
internacional le salen el equivalente a **US$71** por IVA y percepciones); **Creem en LatAm** (es merchant of record: se
hace cargo del impuesto de cada país y da factura que cumple, donde Stripe deja ese lío del lado de MaKo); **Stripe en
el resto del mundo** — cambiarle la pasarela a Estados Unidos y Europa no era parte del pedido. Si la que le toca no
está conectada, se ofrece la internacional que haya: no se deja a nadie sin poder pagar por una preferencia nuestra.

⚠️ La rama internacional **era** `filter((o) => o.pasarela !== 'mercadopago')`. Con dos pasarelas eso quería decir
«Stripe»; con tres devuelve Stripe **y** Creem juntas, a todo el mundo. Y no falla nada: lo que pasa es que a quien
compra se le **pregunta** con qué pagar (`pasarelaDeLaCompra` → `'elegir'`), o sea una pantalla de más y una decisión
que no le toca. **Un `!==` que significa «el otro» es correcto sólo mientras haya dos.**

### Lo que quedó SIN hacer

- **Falta el secreto del webhook para cobrar de verdad** (`CREEM_WEBHOOK_SECRET`, hoy comentado en `.env.local`). Lo
  devuelve Creem cuando MaKo registra el aviso, así que **sale solo al conectar Creem en `/integraciones?ws=9`** con la
  clave de producción que ya está. Hasta entonces el webhook rechaza todo (a propósito) y ningún pago entra.
- **No se probó ningún cobro real** (hace falta el sí de Martín en el chat). Todo lo verificado es con datos armados y
  `fetch` interceptado. Lo único que se tocó de la API real fueron las tres lecturas vacías que ya estaban medidas.
- **Reembolso de Creem: no hay endpoint verificado.** El evento `refund.created` existe (o sea que los reembolsos
  existen y avisan), pero no se encontró el endpoint para pedirlo. `reembolsarCobro` devuelve un mensaje que dice
  hacerlo desde el panel; el webhook lo asienta cuando llegue. Antes caía en la rama de MP y le pedía a Mercado Pago
  devolver un pago que no es suyo.
- **Creem no difiere el primer cobro.** No hay `start_date` documentado (la prueba gratis se hace con
  `trial_period_days`, que es «N días desde hoy», no «empezá el día X»). Un cobro de agencia con primer cobro diferido
  **se rechaza explícito** en vez de caer en la rama de MP y arrancar a cobrar un mes antes, encima del mes ya pagado.
  Lo que queda abierto es `lib/agencia-cobro.ts` (`inicio_at`) y `lib/plan-deuda.ts` (`ciclosPerdidosMp`).
- **Los textos de UI que todavía nombran a Mercado Pago** cuando el cobro es de Creem: `PlanPanel.tsx` («por Mercado
  Pago», y las promesas de prorrateo y de baja), `app/m/configuraciones/plan/PlanM.tsx`, `VenderPlan.tsx` (`MONEDAS_STRIPE`
  deja armar una suscripción de Creem en MXN o EUR), `CobrarConLink.tsx`, `CobroDeEtapaModal.tsx` y
  `CobroBoton.tsx` del Web Generator (que con Creem en USD **sí** podría cobrar desde la landing: el motivo documentado
  para excluir MP —cobra en la moneda de su cuenta— no le aplica). Ninguno mueve plata al proveedor equivocado; mienten
  o no ofrecen.
- **`lib/retencion-plan.ts` y `lib/subir-plan.ts`** siguen con sus ternarios de dos ramas: una retención o un cambio de
  plan de un cobro de Creem cae en el camino de MP y queda en `error` (y en retención la oferta se consume igual, porque
  el setting se limpia antes). **No cuestan plata mal cobrada**, pero no funcionan.
- **Sin logo oficial de Creem:** `ICON` lleva un letter-mark en neutro (regla de la casa: una inicial honesta antes que
  un logo inventado). En `creem.io` no hay `theme-color`, ni manifest, ni un hex de marca legible.

### Dos fallas que ya estaban rojas en `origin/integracion` (no las trajo este trabajo)

Verificadas stasheando el cambio: fallan igual sin él.

- `tests/compra-plan.test.ts` — la lista de claves de `PedidoCompra` no tiene `promo` ni `sinPromo`, que el trabajo de
  promo-entrada agregó al tipo.
- `tests/cobro-lanzamiento.test.ts` — el `assert.match` sobre `app/api/planes/comprar/route.ts` espera `conPrueba:`
  como primera clave del objeto, y promo-entrada metió `promoVigente:` antes. Es una aserción que fija el **orden** de
  un objeto literal: se rompe con cualquier reordenamiento, aunque el código esté bien.

---

## Una suscripción ya cancelada en la pasarela frenaba la baja PARA SIEMPRE (30/10/2026)

- **Síntoma:** `cancelarSuscripcionCobro` (`lib/cobros.ts:1603`) no podía terminar nunca una baja cuya suscripción ya
  estaba cancelada del lado de la pasarela y seguía `activa` en la fila.
- **Causa real:** «ya está cancelada» llega como un **error** (404, o un «already canceled»), y el código salía por
  `ok: false` antes de `aplicarSuscripcionCancelada(c)`. El estado del mundo ya era el que se pedía; lo único que
  faltaba era asentarlo, y el reintento fallaba igual: la fila quedaba `activa` eternamente. Pasa cuando se canceló a
  mano en Stripe, o cuando una corrida anterior murió entre la pasarela y la base.
- **A quién le dolía:** `darDeBajaMiPlan` llama a esta función para la prueba gratis (`:1670`) y devuelve su error tal
  cual, así que el cliente no podía darse de baja; y `cerrarPruebaAlEmpezarYa` (`:1584`) sólo lo loguea y se va.
- **La regla que queda:** en una pasarela, **una cancelación es idempotente**: «ya cancelada» es éxito, no error. El 404
  pasa; cualquier otro error se chequea **releyendo** la suscripción y vale si está cancelada.
- ⚠️ **No se inventó: el molde ya estaba en el mismo archivo**, en `reusarOCrearCheckout` (`lib/cobros.ts:602-606`), con
  esa condición exacta (`!x.ok && x.status !== 404`, y si no, releer y aceptar `canceled`). Antes de escribir un
  criterio nuevo para la pasarela, conviene buscar el que ya está escrito 1.000 líneas más arriba.
- ⚠️ **Los nombres del estado NO coinciden entre pasarelas y no se escriben a mano:** Stripe dice `canceled` y Mercado
  Pago dice `cancelled` al leer y `canceled` al cancelar. Para eso está `suscripcionMpCancelada`
  (`lib/cobros-eventos.ts:450`), que cubre las dos grafías; un `=== 'cancelled'` a mano se rompe según por dónde entró.
- **Lo que queda abierto:** `anularCobro` (`lib/cobros.ts:1318`) sigue cerrando el link viejo con mejor esfuerzo
  (`cerrarLinkEnLaPasarela` nunca tira), así que un link anulado que la pasarela no cerró puede seguir cobrable.
- Salió arreglando P14 de Agency; el resto de esa revisión está en
  [hallazgos-agencias.md](hallazgos-agencias.md) → «P14 no vive en `main`».
## El lead del comprador: el checkout ya lo dejaba, y frenaba al que se llamaba igual que otro (30/10/2026)

**Vive en:** lib/compra-plan.ts (`leadDelComprador`) · lib/compra-plan-reglas.ts (`leadDeLaCompra`) · lib/compra-plan-llamada.ts ·
lib/cobros.ts (`aplicarPagoAprobado`, 5e) · tests/compra-plan-lead.test.ts (10 roturas cazadas).

- **El diagnóstico obvio («la compra no crea lead») era el equivocado.** `iniciarCompraDePlan` lo crea o reusa al ABRIR el pago, con `origen_lead: 'landing'`
  y sus UTM, y `aplicarPagoAprobado` lo pasa a Ganado con su cuota y su suscripción. Los leads con monto de la plataforma dicen «Cargado a mano» porque
  **nunca hubo un cobro: la tabla `cobros` tiene 0 filas** (medido el 30/10). No hay ninguna compra real que confirme este camino: el primero que pague lo estrena.
- ⚠️ **Lo que sí estaba roto: un homónimo frenaba la compra.** `createLead` también frena por NOMBRE, y `leadDelComprador` sólo sabía resolver un duplicado por email: con
  otro email tiraba, y el comprador leía «No pudimos registrar tu compra» sin poder pagar. La plataforma tiene 219 leads traídos de grupos, con nombre. **Regla:** en una puerta pública, un
  duplicado nunca frena. El mismo contacto es el mismo lead. Por nombre sólo si es UNO y no tiene email (lo cargó alguien antes de que comprara). Un homónimo con otro email es otra persona:
  se crea, y la ficha lo marca en «Posibles duplicados». ⚠️ Un lead cargado a mano con sólo teléfono y con OTRO nombre no se encontraba porque el checkout no pedía teléfono: desde el 31/10 lo pide (abajo, «El WhatsApp en el checkout»).
- **Ganado es el final de esa venta, no una lista de llamadas.** Quien paga se AGREGA además al CRM de `planes.crm_llamadas` (agregar no dispara automatizaciones; sólo el primer pago, sólo
  un plan de MaKo, sólo la plataforma). Sin el setting no pasa nada. Una prueba gratis no llega acá: no pasa por `aplicarPagoAprobado` al empezar.
- **El high ticket era configuración, no código:** el catálogo de la plataforma no lo tenía y `crearCrm` arma el CRM, el producto y la oferta juntos. Se creó «MaKo Acelerador» con los datos
  de `PROGRAMA_ACELERADOR`. Falta decidir si se cobra con link: «Vincular cobro» en el ⋯ de su Ganado.
- **El origen sigue siendo «Landing», a propósito:** es de dónde vino. Que compró lo dicen `cobros` (con `plan_mako` y `origen`) y estar en ese CRM.
- **El teléfono no se pedía en el checkout, se pedía al entrar** (el Cerebro, 30/10: cada campo baja la conversión; Martín lo cambió el 31/10: abajo, «El WhatsApp en el checkout»). El número del dueño de la cuenta, al guardarse, llena el teléfono vacío de su lead en la
  plataforma (`anotarTelefonoDelComprador`). **Ya se pregunta, al final del arranque** («¿A qué WhatsApp te escribo…?», `lib/onboarding-arranque.ts`, con código por DM: se guarda recién al verificarlo). **Sin hacer:** adelantar esa pregunta al primer paso; la tomó Ops Center.
- **El aviso «Entró un pago» es una automatización de la plataforma** (#714, de la galería, prendida el 30/10): sale por `avisar_al_equipo`, al grupo de MaKo del ws 9.

### ⚠️ MaKo no tiene con qué cobrar, y lo que nunca corrió con un pago de verdad (medido el 30/10/2026)

**La plataforma no tiene ninguna pasarela conectada:** `pasarelasConectadas(9)` da `[]`, sin `STRIPE_*` ni `MERCADOPAGO_*`, y /planes/esencial dice «Todavía no cobramos en línea». Stripe no abre cuentas en Argentina y Paddle y
Creem no están en el código (`Pasarela` = stripe | mercadopago). **Rastro en toda la base:** 0 cobros; 78 filas en `pagos` y 0 con proveedor; 8 eventos de Stripe en `pasarela_eventos` (ws 1 y 10), 0 de Mercado Pago y 0 del ws 9.

**Nunca se ejercitó con un pago aprobado, en NINGUNA de las dos pasarelas** (lo probado es con la base simulada o la pasarela de mentira; lo marcado *sin aviso real* depende de cómo llega de verdad):

| Tramo | Stripe | Mercado Pago |
|---|---|---|
| Conectar en el ws 9: clave, y el aviso (Stripe lo registra solo; MP se pega a mano con el `?u=`) | nunca | nunca |
| /planes ofrece la pasarela: país (`pasarelasDelPais`), precio en esa moneda | nunca con una real | nunca: sin precio en pesos no se ofrece |
| `crearCobro`, el link /pagar y el checkout real | nunca | nunca |
| El aviso firmado llega y se lee (`pasarela_eventos`) | recibió eventos ajenos, nunca uno de un cobro | nunca. *Sin aviso real:* si el de suscripción trae `user_id` |
| `aplicarPagoAprobado`: el cobro pagado, la cuota, Ganado y la suscripción | nunca | nunca |
| `altaSiCorresponde`: la cuenta, la persona y el mail de acceso, con un correo que nunca entró | nunca | nunca |
| `anotarParaLlamar`: la tarjeta en «MaKo Acelerador» | nunca | nunca |
| #714 «Entró un Pago» llega al grupo | nunca | nunca |
| /pagar/<token>/listo después de pagar | nunca | nunca |
| La segunda cuota: la renovación, ~30 días después (nadie la recupera si el aviso se pierde: `reconciliarCobros`) | nunca | nunca |
| Rechazo, reembolso y corte de la suscripción | nunca | nunca |
| Contracargo | nunca | nunca |
| El Purchase de Meta (ningún camino lo manda, docs/hallazgos-pagos.md) | no existe | no existe |
| El 50% del primer mes con su reloj (lo hace Planes): el cupón en la pasarela y que la renovación vuelva al precio lleno | nunca | nunca |

**La primera compra real es una prueba, no una venta:** docs/prueba-humo-cobro-mako.md tiene el recorrido, con captura de cada tramo. Se hace con Martín, en el chat, antes de pautar.

## Hacer cumplir un tope del plan: la tabla sola le pone tope a quien no paga por la pasarela (23/10/2026)

El primer tope que se hizo cumplir fue el de las líneas de WhatsApp (Esencial 1, Pro 3, en `lib/topes-plan.ts`).
- **La capa no dice si el negocio paga un plan.** El ws1 y los acuerdos a mano también tienen capa `completo`, así que con
  `topeDe` solo quedaban en una línea. **La regla:** un tope se aplica sólo si MaKo le cobra el plan por la pasarela
  (`suscripcionDeMakoDe(ws) != null`, lib/cobros.ts), y el ws1 nunca, además explícito. Está en `topeParaLineaNueva`
  (lib/tope-lineas.ts), que es puro y es el molde para los demás topes.
- **Frenar sólo lo que se va a crear.** Toda línea nueva de un negocio nace en `conectar({ nueva: true })` (lib/evolution.ts),
  y ahí se mira el tope, antes de escribir su fila. Reconectar una que ya existe (el «↻ Nuevo QR») no pasa por ahí, así que
  una línea conectada nunca se corta por el tope. Cuentan todas las filas del negocio, conectadas o no: una caída se
  reconecta con su QR. La línea personal de Martín (lib/mako-canal.ts) también nace por ahí, pero en el workspace de la
  plataforma, que no tiene cobro.
- **Si no se puede leer el plan, deja conectar.** Un tope que se equivoca para el lado de frenar le corta el WhatsApp a un
  negocio que paga.
- **La pantalla no importa la regla.** `lib/tope-lineas.ts` arrastra `aviso-arreglo-reglas` y `doer-salida`. La ruta
  responde 403 con el texto (`textoTope`) y el link, y EvolutionConnect dibuja el cartel con «Pasar a Pro».

- **«Pasar a Pro» va al panel del plan (`/configuraciones/plan`), no a `/planes/pro`:** quien ve el tope ya es cliente, y
  `/planes/pro` es la compra para quien todavía no tiene cuenta. La ruta es `RUTA_CAMBIAR_PLAN` (lib/topes-plan.ts), la única: ningún tope arma la suya.

**Vive en:** `lib/tope-lineas.ts` · `conectar` en `lib/evolution.ts` · `app/api/whatsapp/evolution/route.ts` ·
`app/whatsapp/EvolutionConnect.tsx` · `tests/tope-lineas.test.ts` (11 roturas, las 11 cazadas).

---

## MaKo Esencial: el candado de las tabs de Pro y el tope de automatizaciones (23/10/2026)

Las ofertas del 23/10 (docs/ofertas-mako.md, lib/topes-plan.ts): el Esencial ve las tabs de Pro con candado y «Pasar a Pro», y
tiene hasta 3 automatizaciones activas.

- **El diagnóstico obvio era el equivocado: «Esencial = capa `completo`».** El ws1, los acuerdos a mano y todo negocio de antes
  también tienen capa `completo`, y un Pro recién vendido la sigue teniendo hasta que se despliegue la rama que le pone
  `agencia`: con la capa sola, un cliente que paga Pro perdía el Ads Manager según el orden de los deploys. Lo que decide es el
  PLAN VENDIDO, `alta_capa` del cobro de su suscripción (`suscripcionDeMakoDe`), y además que la capa de hoy siga siendo
  `completo` (un negocio que Martín pasó a mano no pierde nada por una suscripción vieja). El ws1 y la plataforma, nunca. Regla
  en `esEsencialPorPasarela` (lib/plan-esencial-reglas.ts).
- **Ante la duda, sin candado ni tope:** si la lectura falla, se deja pasar (lib/plan-esencial.ts). Sacarle una tab a quien paga
  es peor que mostrarle una de más un rato.
- **El candado va prendido aunque el cartel de la capa esté apagado** (`CORTE_POR_PLAN_PRENDIDO = false`, lib/api-tab.ts): ahí la
  tab no está en la capa; acá SÍ está, lo que falta es el plan. Va a `/no-esta-en-tu-plan?tab=…&pro=1`, que ofrece «Pasar a Pro».
  `lib/cobros.ts` se importa dinámico: `tab-access` lo cargaría en todas las páginas.
- **Closing Analyst no es una tab**: desde el 11/10 es la hoja «Closing» del Dashboard (app/closing/page.tsx redirige). Su
  candado va en el Dashboard, de su chat. AI Avatar hoy es sólo del super admin: el candado ya lo cubre si se abre a los negocios.
- **El tope de automatizaciones lo pregunta `setSecuenciaActiva`** (lib/nutricion.ts), la única puerta que prende una: así lo
  cubre cualquier camino nuevo. Entró primero en las tres puertas (/api/email/secuencias, /api/whatsapp/secuencias y MaKo),
  porque el motor estaba con un P0 de Automations, y Automations lo movió adentro el 23/10 (db4ef6a2f, `TopeDelPlanError`).
  Volver a prender una prendida no cuenta (el lienzo manda «activa» al publicar). MaKo por WhatsApp corre sin sesión: el
  negocio se le pasa.

**Vive en:** lib/plan-esencial-reglas.ts · lib/plan-esencial.ts · lib/tope-automations.ts · lib/tab-access.ts · lib/movil-guard.ts · app/no-esta-en-tu-plan/page.tsx · app/_components/Sidebar.tsx · app/m/mas/page.tsx · tests/plan-esencial.test.ts

**Lo que quedó sin hacer:** el candado de la hoja «Closing» del Dashboard (su chat); el corte de las APIs de las tabs de
Pro (la pantalla se cierra, la API no: como el corte por capa, apagado); y en las apps de las tiendas, «Pasar a Pro» es una
venta que el teléfono no puede hacer (T5 de docs/tiendas-play-appstore.md): ahí tendría que decir sólo «De MaKo Pro».

## El diagnóstico obvio era el equivocado: la cuenta del runway NO está rota

Al leer el audio —el embudo nuevo entra por una app de ~US$20— la conclusión inmediata fue
que la cuenta de `/admin/runway` (US$2.000 ÷ US$100 por agenda × 50% show up = 10 clientes =
US$15.000) describía el embudo viejo y había que rehacerla.

**Es al revés.** Esos US$15.000 son 10 × US$1.500 del programa **grupal**
(`ASCENSO_PROGRAMAS.grupal`, `modelo.ts:871`, `cajaUsd: 1290.33`), y contra esa caja el CAC
medido del carrito (US$136,22, `modelo.ts:1042`) entra con 7× de margen. La cuenta cierra.

Lo que NO cierra con ese mismo CAC es la app de US$47, cuyo techo de CAC está medido en
**US$105,27** (`modelo.ts:1435`). O sea: **el producto que el audio propone poner adelante
es el que no se puede llenar con pauta**, y el que financia el runway es el que ya estaba.

**La regla:** antes de declarar que una cuenta de negocio describe un modelo viejo, buscá
contra QUÉ producto está medida. Los dos números estaban a tres líneas uno del otro.

---

## `capaDef` es FAIL-OPEN, y por eso el orden de despliegue de una capa nueva no es opcional

`lib/capas.ts:329` cae a `CAPA_DEFAULT` = `completo`, que es `navKeys: null` — **ve todo el
producto**. El comentario de arriba ya lo dice con todas las letras (y cuenta que el
comentario ANTERIOR afirmaba lo contrario). La única red es el CHECK
`workspaces_capa_valida` de la base.

De ahí el orden, que ya está escrito en `supabase/migrations/0177_capa_agencia.sql:30-32` y
hay que respetar al agregar los planes nuevos:

1. **Deploy del código** con la capa nueva en `CAPAS`.
2. **Después** el `alter … drop constraint` + `add constraint` con el valor nuevo, y el
   `update` de los workspaces.

Al revés, un workspace con la capa nueva en la base y el código viejo **no da error: abre
el producto entero**. Y en el otro orden el error es un `23514` crudo en la cara.

⚠️ **Y la lista de lo que ve cada plan son 44 decisiones, no ~60**: `nav.ts` tiene 39 keys
de cliente + 5 de usuario; las otras 54 son del super admin y no entran en ninguna capa.

---

## El corte por capa es de PANTALLA, no de API

64 páginas están guardadas (`requireCapa` / `requireRolWs`) y eso funciona: tipear la URL no
entra. Pero **de las 251 rutas de `app/api`, sólo 5 miran la capa**.

O sea que el día que un plan chico no incluya una tab, su `fetch` sigue contestando. La
puerta que importa no es la página: es el endpoint que la página usaba.

---

## `requireCapa` no puede renderizar nada: devuelve `Promise<void>` con el `redirect()` adentro

`lib/tab-access.ts:83`. Una página que lo llame y siga renderizando pinta su contenido igual
—el `redirect()` corta por excepción, no por valor—, así que **«mostrar un cartel de mejorá
tu plan» no es cambiar el guard: es cambiar 56 call-sites** (10 `requireCapa` + 46
`requireRolWs`).

Hoy el cliente del plan chico que toca una pantalla del grande ve un **redirect mudo** al
CRM, que se lee como que la app está rota. Y el componente que diría la verdad existe desde
agosto con **cero emisores reales**: `app/_ui/Estados.tsx:251`.

**Lo barato y honesto:** hacerlo sólo en las 2-3 tabs que el plan chico no compra, y dejar
el redirect en el resto. Lo caro es creer que es una tarde.

---

## El alta completa YA existe: lo que falta es el disparador

Antes de escribir una cadena de alta por webhook, leer `app/api/admin/workspaces/route.ts:80-143`.
Encadena cinco cosas **con el orden ya pagado**: email único ANTES de la primera escritura,
crear workspace, sembrar onboarding, crear usuario con rollback, y el mail declarado
no-fatal (que se caiga Resend no puede tumbar un alta que una persona aprobó).

Y el mail de acceso es `invitarPorEmail` (`lib/invitaciones.ts:74`), con preflight que corta
si el remitente es sandbox.

El webhook de pago es, entonces: **extraer eso a una función de lib, envolverlo con
`verificarFirmaSvix` (`lib/standard-webhooks.ts:72-106`) y agregarle idempotencia.**
`/api/webhooks` ya es prefijo público en `lib/rutas-publicas.ts`.

⚠️ **CORREGIDO el 11/10/2026, al construirlo:** la extracción se hizo (`lib/alta-cliente.ts`), pero
**la mitad de Svix era falsa** para Stripe y Mercado Pago — ver «La pasarela» más abajo, primera
entrada. Ni Stripe ni Mercado Pago firman como Svix.

---

## El rail de cobro no es UNO: la AUP del merchant of record prohíbe «coaching»

`modelo.ts:845-852` cita textual la AUP de Paddle, que excluye *«pure consulting or advisory
services, including but not limited to legal advice, coaching…»*, y `modelo.ts:1611` lo
cierra: *«Stripe propio. NUNCA Paddle… su botón no puede ir al mismo checkout que los
planes»*.

Consecuencia que no se ve desde el código: **el programa de US$1.500 —el que financia el
runway— y los planes de la app no pueden compartir checkout.** Y el rail del programa
(Stripe propio) es justo el que arranca el reloj de 30 días del RFC mexicano
(`modelo.ts:635`, `:1272`), con representante legal y domicilio en territorio nacional.

⚠️ **Y `/reembolsos` NO es un pie de página: es condición de aprobación.** `MES_0`
(`modelo.ts:1267-1277`, `origen: 'medido'`) dice que el MoR aprueba el negocio **días o
semanas ANTES del primer cobro** y pide esas páginas. `/terminos` y `/privacidad` existen
desde el 5/09; `/reembolsos` no.

---

## El margen del plan de US$47 que afirma el pricing no lo sostiene el código

Tres cosas que hay que leer juntas antes de volver a citar un margen:

- El video **no lo paga MaKo**: sale de los créditos de Google Flow del cliente
  (`lib/costo-clip.ts:32`). El argumento «el 47 con Video Generator no es rentable» tiene la
  premisa al revés.
- **`IA_POR_PRO` (`modelo.ts:1359-1375`, `hoyUsd: 10.90`, `origen: 'medido'`) dice literal
  que REEMPLAZA al US$2,52 de `EXPOSICION`.** Con ese número el margen a 47 es 76,8% (no
  94,2%) y a 23,50 es 53,6% (no 89%). Sobre el único workspace real medido —US$68,39/mes—
  un Pro a 47 es **caja negativa**.
- El cupo que hacía cerrar el 2,52 (`CUPO_MT`) **no tiene un solo call-site fuera de la
  pantalla de pricing**: es una constante que nadie aplica.

**La regla: un número de `modelo.ts` que dice «reemplaza a X» gana sobre X, y el que
describe un mecanismo (un cupo, un tope) no vale hasta que se grepea su call-site.**

---

## Nada corta el gasto de IA de un cliente, y hoy ese gasto es INMEDIBLE

`modelo.ts:148`: no existe ninguna primitiva que corte una llamada por gasto. Y hay **seis
caminos que gastan sin que el cliente abra la app** — el webhook de Fathom sin techo
(≈US$52/mes con 10 llamadas/día), el cron `closing-sync` (≈US$31/mes por workspace),
`fathom-plan`. Con un plan de US$47, eso puede costar más de 47.

Peor, y es lo que hay que arreglar primero: **el gasto de Claude se escribe TODO en el
workspace 1** (`modelo.ts:145`). Hasta que se separe, cualquier afirmación sobre «cuánto
cuesta un cliente» sale de un promedio que no existe.

---

## Quien pague con un mail que no sea de Google no puede entrar NUNCA

`app/api/auth/callback/google/route.ts:8-14`: el login es sólo Google, no hay contraseña y
la tabla no tiene dónde guardarla. El mail de invitación le dice *«entrá con Google desde
ese mismo email»* a alguien que acaba de pagar con un correo que no es Gmail.

No falla en el alta: falla en el primer login, cuando ya cobraste.

**Al 23/10 ya no es cierto al pie de la letra, y en la práctica casi sí.** Desde el 15/10 hay contraseña por usuario
(1b177b414, mig 0286) y «¿Olvidaste tu contraseña?» sirve para crear la primera. Pero el mail de bienvenida dice sólo
«Importante: entra con Google usando exactamente esta dirección» (lib/invitaciones.ts:185) y la página de después de pagar
repite «Entra con Google usando ese email» (app/pagar/[token]/listo/AccesoMako.tsx:73): quien no tiene Google tiene que
adivinar «o entra con tu correo» → «¿Olvidaste tu contraseña?» de una contraseña que nunca tuvo. Ese mail lo manda la
automatización «Restablecer Contraseña» del ws 9 (lib/restablecer-aviso.ts); apagada, la pantalla igual dice «te llega un
mail» y no llega nada (medido: el único pedido registrado, el 21/10, dice `corrio`). El pago en línea SÍ pasa por esta alta:
webhook → `aplicarPagoAprobado` → `altaSiCorresponde` → `darDeAltaCliente` (lib/cobros.ts:723 y 914-958).

---

## Lo que le pasa en el CRM al que PAGA sin agendar

Mudado a [hallazgos-crm.md](hallazgos-crm.md) — el código vive ahí
(`lib/crm-auto.ts`, `lib/pipeline.ts`). Queda el puntero y no una copia: dos
documentos con el mismo hallazgo son dos que divergen, y el que se queda viejo no
avisa.

## El workspace de la plataforma (ws9) no tiene CRM, y arreglarlo son DOS cosas que son UNA

La capa `superadmin` no declara `crm`, `whatsapp`, `email` ni `chatbot` (`lib/capas.ts:281`),
así que el server rebota. **Y no se arregla desde el panel**: la ruta rechaza explícitamente
el workspace de la plataforma (*«Ese es el espacio de la plataforma: no tiene plan»*,
`app/api/admin/workspaces/route.ts:170-172`). El único camino es esa línea de `capas.ts`.

⚠️ Y su funnel está `declarado = false`, así que apenas se le abra el CRM va a dibujar el
`DEFAULT_PIPELINE` de high-ticket. **«Darle CRM al ws9» y «declarar su embudo» son una sola
tarea**: hacer la primera sin la segunda entrega una pantalla que miente.

---

## Los términos publicados dicen que no cobrás

`app/terminos/page.tsx:160`: *«No hay cobros automáticos dentro del producto ni se te va a
cobrar nada sin que lo hayas acordado antes»*. Cero cláusulas de suscripción, renovación,
cancelación o reembolso.

Esa URL es pública y la abren los revisores del MoR y de Google. **El día que la pasarela
esté viva, afirma algo falso** — y se arregla en el mismo commit que escribe `/reembolsos`,
no después.

✅ **Hecho el 11/10/2026, como BORRADOR:** la sección 8 de `/terminos` pasó a «Precio, pagos y
cancelación» y existe `/reembolsos` (`app/reembolsos/page.tsx`), las dos en el mismo commit que la
pasarela. Las cláusulas las tiene que revisar Martín (plazo de respuesta de 5 días hábiles, el mes
pagado no se devuelve salvo error o cobro duplicado, el grupal según lo acordado en la llamada).

---

## Dos avisos de medición, para el próximo que mida esto

- **El registro de `/admin/dev` miente en dos lugares**: `areas.ts:797` dice que no existen
  `/terminos` ni `/privacidad`, y los dos existen desde el 5/09 y están linkeados en el
  footer. Quien planifique leyendo el registro reescribe lo que ya está.
- **`app/vsl/landing-html.ts` NO es un template literal**: son 170.816 caracteres de un
  string entre comillas dobles, **auto-generado desde Claude Design**. Editarlo a mano lo
  desincroniza de su fuente y la próxima regeneración se come el cambio. La sección nueva se
  monta desde `Landing.tsx`, que ya inserta nodos sobre ese HTML en cuatro lugares
  (`:66`, `:114`, `:135-142`, `:204`). La regla quedó en `AGENTS.md`.

---

## Referidos (10/10/2026): lo que vuelve a morder al diseñar un premio

Sale de la corrida `wf_28690687-a62` sobre el audio del 10/10. La propuesta entera está en
[referidos.md](referidos.md); acá queda sólo lo que no se deduce de leerla.

**El diagnóstico obvio era el equivocado: «5 × 47 = 235 contra 3 meses de agencia regalados».**
La cuenta del audio compara UN mes de ingreso contra TRES meses de regalo. Los 5 clientes
pagan 235 **por mes** durante ~8,7 meses: US$1.256 de contribución con la IA de hoy. Contra
eso, 3 meses del plan agencia a 97 cuestan US$273 netos si esa persona igual iba a pagar, y
US$115 (3 × 38,18 de servirla) si no. A 97 el miedo no es real; a 200 sí (US$562).
**La regla:** un premio se compara contra el LTV de lo que trae, no contra su primer mes.

**«Meses gratis» no cuesta lo mismo en todos los casos.** Un mes regalado a alguien que
igual iba a pagar es ingreso NETO perdido (43,77 en el Pro); a alguien que no iba a pagar
(un amigo con cuenta de cortesía) cuesta sólo servirlo (14,90 con la IA de hoy). Los tres
diseños de la corrida mezclaron las dos cosas en algún lado; el crítico las separó.

**El escalón «cada N clientes» se cae solo con la retención del Pro.** Con un 11,5% de bajas
por mes (r = 0,23^(1/12) = 0,8847), la probabilidad de seguir teniendo los 5 en el mes
siguiente es 54%, y los 10, 29%. Un premio todo-o-nada por hito se pierde casi siempre en el
mes 2. Ninguno de los 12 programas verificados premia «cada N»: todos por cliente activo.

**Lo que Martín describió como «lo que hace Claude» no es lo que hace Claude.** Claude da 7
días de Pro con tarjeta, sólo a quien nunca pagó, con pases escasos, y premia al que invita
recién cuando el invitado paga (support.claude.com, artículo 13456702). El «un mes para cada
uno» es Superhuman, y la versión segura es la de YNAB: el mes gratis se agrega DESPUÉS de pagar.

**La cuenta del runway supone que cierra el 100% de los que se presentan.**
`app/admin/runway/datos.ts` (`CUENTA`) hace 20 agendas × 50% de show = 10 llamadas = **10
clientes**: no hay tasa de cierre en el medio. La corrida del 04/10 (arriba, «la cuenta del
runway NO está rota») verificó CONTRA QUÉ producto estaba medida, no esto. Con el 20% de
cierre de `modelo.ts:1711` el anuncio cuesta ~US$1.000 por grupal, no 200; con el 40% que
Martín proyectaba en julio, ~US$500. Por eso un referido del grupal a US$300 es el canal más
barato que tiene MaKo en la ventana del 1/11 al 15/12.

**Cuatro trampas del modelo de precios que un diseño de premios pisa:**
- `modelo.ts:1439` dice que el techo de CAC del Pro con la IA de hoy es US$81,50; su propia
  fórmula (28,87 × 8,7 / 3) da 83,72. Se usó el 81,50 por conservador.
- El plan Agencia de US$297 (`modelo.ts:598`) existe sólo en `PRECIOS` y en la `UNIT` vieja,
  no en `UNIT_V2`. Con «hasta 10 clientes» adentro es una venta mayorista a US$29,70 por
  workspace: una agencia con 10 clientes pagaría 297 en vez de 470.
- El plan de 97 «no se vende hasta el mes 13» (`modelo.ts:1445`): todo referido de software
  que se modele hoy es Pro.
- Paddle no acepta el grupal (AUP, `embudo-y-high-ticket.md:547`): la comisión del grupal no
  puede pasar por la pasarela de las suscripciones.

**Herramientas:** Rewardful sólo se integra con Paddle Classic, no con Paddle Billing; Tolt
sí (US$69/mes con pagos manuales). Verificarlo en el trial antes de prometer nada.

---

## La tab /admin/estrategia (10/10/2026): lo que no coincidía entre las fuentes al juntarlas

Martín pidió juntar en UNA tab de super admin la estrategia, el runway, los costos y los
referidos. La tab **importa** de `app/admin/runway/datos.ts` y de `modelo.ts` en vez de copiar
números; al hacerlo aparecieron estas diferencias, que la pantalla resuelve como se dice y
que siguen vivas en las fuentes. Corrida `wf_b425a044-e9e` (4 lectores, 1 constructor, 3
verificadores, 1 corrector).

**El objetivo de US$10.000 no sale de la oferta vigente.** La proyección de la estrategia
(15 agendas → 12 efectivas → 5 ventas) llegaba a 10.000 con una mezcla de «1 a 1 de 4.000 + 4
grupales de 1.500». El 1 a 1 de 4.000 no aparece en ninguna decisión posterior al 20/09. Con
sólo el grupal, 5 ventas son **US$7.500** (neto 6.500 con US$1.000 de anuncios), y el objetivo
pide **7 ventas, ~22 agendas**. La tab dibuja las dos cosas por separado: lo proyectado y la
brecha contra el objetivo. **La regla:** un total rotulado «Facturado» se calcula de ventas ×
precio; si es una meta, se rotula «Objetivo» y se dibuja aparte.

**El runway y la estrategia proyectan dos meses distintos.** Runway: US$2.000 de pauta, US$100
por agenda, 50% de show y — sin decirlo — 100% de cierre (10 clientes, US$15.000). Estrategia:
US$1.000 de campaña, US$125 por agenda, 80% de asistencia, 40% de cierre. La tab usa la de la
estrategia (es la que Martín revisó tasa por tasa) y deja el capital y el calendario del runway.
**Sin resolver: ¿la pauta de noviembre es 1.000 o 2.000?**

**`CAC_CANALES` (modelo.ts:1030) mide la venta autoservicio del Pro CON usuarios Free.** El
«WhatsApp US$176» son 100 de medios + 76 de 19 Free que no pagan; el carrito, 124,22 + 12. En
la oferta vigente no hay Free (`UNIT_V2.free`: «NO EXISTE hasta el mes 10»), y la campaña de
la estrategia vende el GRUPAL por llamada. Dibujado tal cual, la página declaraba «no entra»
al canal pago que ella misma propone. La tab separa dos gráficos, cada uno contra su techo:
el grupal (campaña ~US$390 por venta contra US$1.190 que deja) y el Pro vendido solo, sin el
componente Free. Y el referido de `CAC_CANALES` (43,55) es el premio viejo de tokens: el
decidido el 10/10 cuesta 78,23.

**La torta del 97 dividía por la regla equivocada.** «Captación» era un tercio de la
contribución (17,56/mes = el techo 3:1 de 272,23), pero `UNIT_V2` dice que en el Growth
gobierna el payback (158,07). Ahora cada porción de captación es el techo que se dibuja ÷ la
vida del cliente: 9,37 en el 47 y 10,20 en el 97.

**El techo del 47 son 81,53, no 81,50.** `UNIT_V2` mezcla el ajuste de `ASCENSO_NETO` (−6,57,
del modelo v1); el 81,50 de `docs/referidos.md` y de `modelo.ts:1439` es el redondeo del
comentario. Su propia fórmula sin el ajuste da 83,72. Diferencias de centavos: no cambian
ninguna decisión.

**Los hitos del runway son los del 03/10.** El audio del 04/10 movió el cierre técnico y la
prospección (18/10 y 19/10), y la «ventana de 45 días» son 29-30 días con plata. La tab importa
`HITOS` tal cual: se corrige en `runway/datos.ts` y se corrige en las dos pantallas.

**`/vsl/costos` seguía pública sin login**, con los costos de la empresa. Era el otro documento
interno bajo `/vsl`; su cabecera decía «igual que /vsl/estrategia», que dejó de ser cierto.
Martín la cerró el mismo día (ver «la tercera vuelta», abajo).

### Y la segunda vuelta, el mismo día: «poco texto» no es «esconder en un hover»

**Síntoma.** Martín abrió la tab y la devolvió: «eliminaste cosas de la antigua tab de
estrategia que estaban buenas, como la intro, que decía el avatar» y «son muchas cosas todas
juntas; quiero tener claridad de qué estoy leyendo en todo momento».

**Causa.** Para cumplir «gráfico, simple, no tanto texto», la primera versión tomó dos atajos
que se leen como acortar y no lo son: sacó lo que no era un número (la intro, el cliente
ideal, la propuesta a Jan) y mandó al `title` de cada tarjeta lo que era una lista (los seis
ejes de la llamada, qué se mira para el Loom, qué se le dice sobre su anuncio, los canales a
futuro). Un `title` no se ve en el celular ni sin el mouse encima: el texto seguía en el
código y para quien lee no existía. Y el «muchas cosas juntas» no era el largo: eran nueve
secciones seguidas sin nada que dijera dónde empieza una y termina la otra.

**La regla que queda.** Cuando una página interna tiene que ser corta Y completa, el recorte
es estructural, no de contenido: cada sección es un `<details>` numerado con la pregunta que
contesta (cerradas, se leen como el índice) y su renglón queda pegado arriba mientras está
abierta. El largo ya no tapa nada, porque lo que no se quiere leer se deja cerrado. Lo que
se saca por chocar con una decisión posterior (la propuesta a Jan contra el programa de
referidos) no se borra: vuelve **marcado**, porque decidir qué se le ofrece a alguien no es
trabajo de la pantalla. **Vive en:** `app/admin/estrategia/Estrategia.tsx` (`Seccion`,
`ColJan`), `app/admin/estrategia/datos.ts` (`JAN_GANA`, `JAN_GANO`), y lo fija
`tests/estrategia-tab.test.ts`, que dibuja la página y busca el texto **sin los `title`**.

### Y la tercera vuelta, el mismo día: las cuatro decisiones

Martín contestó lo que la tab tenía marcado: la proyección se cuenta sobre **la ventana de los
anuncios** (1/11 al 15/12) y no por mes, con **US$2.000 de pauta en total** y un **objetivo de
US$15.000**; el **1 a 1 vuelve a US$10.000** con el contenido a definir por él; la propuesta a
Jan **se reescribe** con el programa de referidos; y `/vsl/costos` **se cierra**. Tres cosas
que no se ven en el diff:

**La propuesta a Jan chocaba en CINCO filas, y la tab marcaba tres.** Las tres marcadas
chocaban con la tabla de premios (reventa, prueba extendida, % de ganancias). Las dos que
nadie marcó chocaban con otra fila del programa, la de **reglas comunes**: «acceso personal de
por vida» contra «todo se cobra, también a los amigos», y «cobra una recurrencia sin mover un
dedo» contra un premio que es **una vez por cliente nuevo**. Las dos se leían como favores, no
como reglas rotas. **Al contrastar una propuesta contra un programa decidido, se contrasta
contra TODAS sus filas**, incluida la de reglas comunes, que es la que no habla de premios.
**Vive en:** `app/admin/estrategia/datos.ts` (el comentario de `JAN_GANA` enumera las cinco);
`tests/estrategia-tab.test.ts` frena que vuelva cualquiera de ellas.

**Un costo por venta sale de las TASAS, no de dividir volúmenes redondeados.** Al estirar la
prospección a 45 días, las agendas dan 10,5 y se cuentan 10 (media agenda no existe). Con eso,
«Looms por venta» calculado como `responden ÷ ventas` pasaba de 89 a 94 **sólo por alargar la
ventana**, sin que cambiara nada del canal. Ahora es `1 ÷ (tasa de agenda × asiste × cierra)`,
y la campaña sigue en US$390,62 por venta y US$125 por agenda con el doble de pauta.

**El guard de `/vsl/costos` vive en la página, no en el proxy.** `/vsl` está en `PUBLICOS` por
la landing, así que el proxy la deja pasar sin sesión; `getSesionAdmin` lee la cookie firmada,
que llega igual en una ruta pública. Es el único cerrojo, y por eso lo fija un test. El link
que tenía Mauricio (un cliente) deja de abrir.

**Lo que sigue sin coincidir con el runway:** la pauta y el objetivo ya son los mismos, pero las
tasas no (el runway dice US$100 por agenda y 50% de asistencia con cierre implícito de 100%; la
tab, US$125, 80% y 40%). La tab usa las que Martín aprobó y no dibuja la diferencia.
## Partir Strategy en tabs (10/10/2026): el bloqueo es el CRM vacío de MaKo, no las pantallas

**Síntoma.** Martín pidió sacar de Strategy lo que «podría tener su propia tab, bien diseñada y
funcional»: ¿Qué es MaKo? con precios en columnas, Referidos para todos, Objetivos de dinero y
tiempo, la torta con datos reales en Graphics. La lectura obvia era una tab nueva por sección.

**Lo que se midió.** Las pantallas que volverían reales esas secciones ya existen y andan con los
clientes: `/comercial`, `/analisis` (la proyección con tasas MEDIDAS) y `/general`. Lo que no
existe son los datos de MaKo en su propio workspace (ws9): 3 ganados sin monto ni producto, 0
pagos, 0 filas de Meta (falta `META_AD_ACCOUNT_ID` y el token no trae `ads_read`), 0
`landing_visits`, 0 agendas (el Calendly `koncke/asesoria` no está conectado), la línea de
WhatsApp `mako_ws9` nunca conectó, 0 objetivos. **MaKo vende un método que no usa con su propio
negocio**, y por eso Strategy tuvo que escribir sus números a mano. Y lo medido en los clientes
desmiente los supuestos de la tab: en ws1 asiste el 50,8% (la tab dice 80%), cada R1 cuesta unos
US$98 (la tab, 125), y la IA de octubre es US$0 en casi todos (la torta usa 10,90). La propuesta
entera, con lo que va ahora y lo que no: [propuesta-tabs-strategy.md](propuesta-tabs-strategy.md).

**Tres trampas para quien construya esas tabs:**

- **La capa no es el plan pagado.** `workspaces.capa` dice qué tabs ve una cuenta y la escribe el
  super admin a mano (`app/api/admin/workspaces/route.ts:180`). Cinco clientes reales están en
  `completo` y ninguno paga 47; `completo` y `agencia` tienen `navKeys: null`
  (`lib/capas.ts:183`, `:251`), así que «las tabs del 47» y «las del 97» salen idénticas. Contar
  clientes por plan desde la capa da un número plausible y falso: se cuenta por producto
  (`leads.producto_id` del CRM de ws9) o se enlaza `/customer-success`, que ya lista el plan de
  cada cliente.
- **Hay tres grillas de precio, y no dicen lo mismo:** Strategy (47 · 97 · 1.500 · 10.000), la
  parte 4 de `/admin/dev/pricing` (`GRILLA` del 09/08, con Free y la agencia a 297) y
  `modelo.ts:867` (el 1 a 1 en 4.000). En el tablero, #771, #783 y #840 siguen citando el precio
  del 20/09 (49/400, «el 47 deja de existir»), y la #840 pide un botón de compra sin checkout.
  Una tab de precios que no jubile las otras es la cuarta.
- **El referido de 97 se calcula con r² en la tab (124,98) y con r en el documento decidido**
  (130,46, `docs/referidos.md:55`: «con el 50%, el 1er mes ya es un pago»). El test fija el de
  la tab.

**De la corrida, para la próxima.** El diseñador volvió a preguntarle a Martín cosas que se habían
decidido ese mismo día (los precios, la agencia dentro del 97): el contexto nombraba las
decisiones sin su procedencia, y las tareas viejas del tablero decían otra cosa. Lo cazaron dos
refutadores leyendo la bitácora de `gtm-oferta-y-precios`. **Al lanzar una corrida de diseño, las
decisiones del día van con su fuente (la bitácora, la hora), y «la fuente más nueva gana» se
escribe en el prompt.**

**Vive en:** `app/admin/estrategia/datos.ts` · `lib/capas.ts:183,251,280` ·
`app/admin/dev/pricing/modelo.ts:526-601,867` · `docs/propuesta-tabs-strategy.md`.
*Corrida `wf_01c22b1b-91a`, 10/10/2026.*


---

## La pasarela (Stripe y Mercado Pago, 11/10/2026): lo que no se ve leyendo el código

Pedido de Martín: «implementes end-to-end la integración con Mercado Pago y con Stripe, tipo pasarela
de pagos... Lo voy a utilizar yo como superadmin para vender MaKo, pero también los usuarios pueden
alojarlo». El contrato (vocabulario, datos, firmas, rutas) está en
[diseno-pasarela-pagos.md](diseno-pasarela-pagos.md); lo de abajo es lo que costó.

### El diagnóstico obvio era el equivocado: el webhook de pago NO es Svix

**Síntoma (evitado):** este mismo documento decía «envolverlo con `verificarFirmaSvix`». Hecho así, la
firma de Stripe da «no coincide» en el 100% de los eventos — que se lee igual que un secreto mal pegado.
**Causa:** el secreto de Stripe también empieza con `whsec_`, pero Stripe lo usa TAL CUAL como clave
HMAC (UTF-8) y `claveDelSecreto` (Svix) le saca el prefijo y lo decodifica de base64. Además Stripe
firma en hex `${t}.${raw}` y puede mandar VARIOS `v1` mientras se rota el secreto (el parser de
`lib/calendly.ts` se queda con el último y rechazaría tráfico legítimo justo durante la rotación), y
`v0` es una firma falsa de los eventos de prueba. Mercado Pago firma un MANIFIESTO
(`id:<data.id>;request-id:<x-request-id>;ts:<ts>;`), no el cuerpo.
**Regla:** cada pasarela con su verificador puro y con vectores fijos; nunca por `standard-webhooks`.
**Vive en:** `lib/pasarela-firma.ts` · `tests/pasarela-firma.test.ts`.

### La primera factura de una suscripción de Stripe llega DOS veces

**Síntoma (cazado en la reconciliación):** la primera cuota de una suscripción entraba duplicada al
CRM. **Causa:** el primer cobro llega por `checkout.session.completed` (que trae `invoice`) Y por
`invoice.paid` con `billing_reason = subscription_create`; si un camino usa el id de la SESIÓN y el otro
el de la FACTURA, el segundo se lee como una RENOVACIÓN (otra cuota). **Regla:** el `proveedorPagoId`
de una suscripción es SIEMPRE la factura (`in_…`) y el de un pago único el payment intent (`pi_…`); sin
factura todavía, no se aplica — entra por `invoice.paid`. La cuota del CRM es idempotente por el índice
`pagos_proveedor_uk (workspace_id, proveedor, proveedor_pago_id)`.
**Vive en:** `lib/cobros-eventos.ts` (`confirmarCheckout`) · `lib/cobros.ts` (`reconciliarCobros`) ·
`supabase/migrations/0255_cobros_pasarela.sql`.

### Mercado Pago: la notificación no trae el pago, y la firma no se le puede exigir a todo

**Causa:** el aviso trae un id; el estado se pide SIEMPRE con `GET /v1/payments/{id}` y el token del
negocio (y `payer` viene con los datos personales en null «por seguridad»: para cruzar sirve
`external_reference`, el token del cobro). La firma: el formato IPN viejo NO se puede validar (lo dice
MP) y no está medido si la `notification_url` de una preferencia llega firmada. **Regla:** el aviso es
sólo «andá a mirar»: se relee el recurso con el token del ws y se exige `collector_id ===
MERCADOPAGO_USER_ID` (con el token del negocio también se leen pagos donde esa cuenta fue la que PAGÓ).
Una notificación falsa sólo provoca una relectura. Se verifica la firma sólo en el formato webhook y si
hay secreto. Y **deduplicar «por id de evento» como en Stripe era el diagnóstico equivocado**: MP manda
varias (created, updated) sin un id estable; la clave es `<tipo>:<id>:<estado resultante>`, y sale de la
relectura.
**Vive en:** `app/api/webhooks/mercadopago/route.ts` · `lib/cobros-webhook.ts` · `lib/cobros-eventos.ts`.

### Un camino sin firma ni dueño que escribe una fila por pedido no tiene techo (15/10/2026)

**Síntoma (revisión del 11/10):** un aviso de Mercado Pago con un `user_id` que no es de ningún negocio dejaba
una fila `sin-workspace` en `pasarela_eventos` por cada `data.id`: cualquiera hacía crecer la tabla mandando
ids al azar (ese camino no tiene firma ni dueño).
**Regla:** el rastro de lo que no es de nadie tiene techo: UNA fila por día (`sin-workspace:<fecha>`) y el
resto al log. Lo que sigue abierto es el otro lado: un aviso sin firma con el `user_id` de un negocio
conectado provoca una relectura con SU token (ver la tabla de abajo).
**Vive en:** `app/api/webhooks/mercadopago/route.ts` · `tests/cobros-webhook-rutas.test.ts`.

### La moneda depende de la PASARELA, y el catálogo está en dólares

**Síntoma (evitado):** el orden obvio del formulario —monto, después pasarela— ofrecía «US$ 97» a una
cuenta de Mercado Pago argentina, que lo rechaza al crear el link. **Causa:** Mercado Pago cobra en la
moneda del sitio de SU cuenta (MLA = ARS) y `productos.monto_usd` está en USD. **Reglas:** en todo
formulario que cobra, la pasarela se pregunta ANTES del monto; `cobros.monto` + `cobros.moneda` son la
verdad, y `monto_usd` es el valor en dólares que DECLARÓ alguien (el producto o quien creó el link) —
**nunca una tasa inventada**: sin ese valor el cobro se registra igual pero no escribe cuota en el CRM
(`pagos.monto_usd` es NOT NULL) y lo dice en `motivo`. Por lo mismo, la API de MaKo no crea links de
Mercado Pago (el precio del catálogo es en USD): hace falta precio en moneda local en el catálogo.
**Vive en:** `lib/cobros-reglas.ts` (`decidirCobro`, `montoUsdDelCobro`) · `app/crm/[id]/CobrarConLink.tsx` ·
`app/admin/cobros/VenderPlan.tsx` · `lib/api-mako/areas/cobros.run.ts`.

### Un link de Stripe VENCE: el que se manda es de MaKo

**Causa:** una Checkout Session dura entre 30 min y 24 h; un link mandado por WhatsApp llega vencido.
**Regla:** el link que sale es `/pagar/<token>` (32 base64url, no se adivina), que redirige al checkout
vivo y crea otra sesión si la vieja vence en menos de 5 min (con una clave de idempotencia atada al
vencimiento anterior: dos clics no crean dos sesiones). ⚠️ **Y Next contesta los `HEAD` llamando al
`GET`**: un bot de vista previa que pedía `HEAD /pagar/<token>` creaba una sesión de Stripe. Un route
handler cuyo GET tiene efectos declara su propio `HEAD`.
**Vive en:** `lib/cobros.ts` (`urlParaPagar`) · `app/pagar/[token]/route.ts`.

### El alta automática de MaKo: en positivo, reclamada, y sin tocar a quien ya tenía cuenta

**Reglas:** corre SÓLO si el cobro es del workspace de la plataforma (`ws === await wsSuperAdmin()`,
escrito en positivo: un cliente que vende con su Stripe NO crea inquilinos aunque su fila trajera
`alta_capa`, y `crearCobro` lo rechaza al crear), sólo con capas vendibles, y se RECLAMA con
compare-and-set (`alta_estado` null|error → pendiente) antes de crear: dos avisos simultáneos no dan
dos altas; un `pendiente` de más de 10 min es una corrida muerta y el cron lo retoma. Si el email ya es
usuario → `ya_tenia_cuenta` y NO se le cambia la capa a ciegas. El login es sólo Google: la página de
retorno deja cambiar el email del acceso (sólo si el cobro está pagado, el alta hecha, el usuario NUNCA
entró y quedan cambios; el usuario se busca por su workspace y no por el email del cobro, que después del
primer cambio ya no coincide).
**Vive en:** `lib/cobros.ts` (`altaSiCorresponde`) · `lib/alta-cliente.ts` · `app/api/pagar/email/route.ts` ·
`app/pagar/acceso.ts`.

### Lo que contesta ANTES de gastar el intento es un oráculo (15/10/2026)

**Síntoma (revisión del 11/10):** el cambio de email de la página de retorno respondía «Ese email ya tiene
una cuenta de MaKo» antes de reclamar uno de los 3 cambios: con un link pagado se podía preguntar, sin
límite, qué emails son usuarios de MaKo. Los topes por IP y por token no lo frenan: viven en memoria, por
instancia.
**Regla:** la pregunta va DESPUÉS del reclamo y el «no» gasta el intento (como mucho tres preguntas por
link), con un texto que no dice por qué (`EMAIL_NO_DISPONIBLE`). Sólo se devuelve el intento cuando falla la
base, que no es culpa de quien compró. El `23505` del único de `usuarios.email` es la misma respuesta.
**Y por qué sus topes pueden quedar en memoria (15/10/2026, se pidió llevarlos a la base y se decidió que no):** el límite
que importa ya es PERSISTENTE: tres cambios por link, con compare-and-set sobre `cobros.alta_email_cambios`, y desde este día
el «ya es de otro» también gasta uno. Lo que queda en memoria es una segunda capa contra ráfagas: llevar el tope por IP a la
base, desde una ruta pública sin sesión, es una fila por IP sin techo (el mismo error que se cerró en el aviso de Mercado
Pago sin dueño); y el tope por token se cuenta ANTES de buscar el cobro, así que en la base aceptaría tokens inventados (y
después de buscarlo sólo repetiría el tope de tres, con una escritura por pedido). El token es de 192 bits: adivinarlo no es
un ataque. Si algún día hace falta un tope duro por IP, es el store compartido (Upstash/Redis) que la bitácora de
rate-limiting tiene en cola, no una tabla.
**Vive en:** `app/api/pagar/email/route.ts` · `tests/pagar-publico.test.ts`.

### Ganar al que pagó es lo que evita el «no agendaste»

`aplicarPagoAprobado` asienta la cuota (`registrarCobroDeProveedor`, que reusa `marcarPago` y corta la
cobranza) y RECIÉN después gana el lead por `setPipelineStage` + `etapaDeGanado` (nunca `estado_lead` a
mano), y RECIÉN después dispara Automations: con `fecha_primer_pago` ya escrita, el WhatsApp al lead sale
solo y no como borrador, y la condición «Pagó» da bien. El CRM automático del workspace de la plataforma
está apagado (medido el 11/10/2026: sin `crm_auto_enabled`, que fuera del ws1 es apagado).
**Vive en:** `lib/cobros.ts` · `lib/pagos.ts`.

### «Pagado» primero y el resto después: lo que se corta a la mitad no lo reintentaba NADIE

**Síntoma (cazado por la revisión adversarial):** con la base lenta, el webhook pasa los 8 s, contesta 200
y sigue en `after()`; si asentar la cuota falla ahí, queda el cobro «pagado», sin cuota, con el lead sin
ganar y —en una venta de MaKo— sin alta. Stripe y MP ya tienen su 200 y no reintentan, y el cron sólo
miraba los PENDIENTES. El cliente pagó y no le llegaba nada. **Causa:** cada paso era idempotente, pero el
único que los volvía a correr era un reintento del proveedor. **Regla:** el cron REPARA los pagados sin su
cuota en el CRM o con el alta sin terminar, pasándolos otra vez por `aplicarPagoAprobado`; un «ya estaba»
de la cuota igual sincroniza lo cobrado; y el aviso y el CRON se atan a que la cuota ESTÉ (deduplicados por
el pago del proveedor), no a que ESTE intento la haya escrito. Además: la ventana de los pendientes cuenta
desde `updated_at` (la preferencia de MP no vence), la RENOVACIÓN de una suscripción cuyo primer pago se
devolvió sigue entrando, y a Mercado Pago una firma que no coincide no se le contesta 401 (la seguridad es la
relectura, y un 401 rebotaba para siempre a un negocio con el secreto renovado).
**Vive en:** `lib/cobros.ts` (`reconciliarCobros`, `aplicarPagoAprobado`) · `lib/pagos.ts` · `app/api/webhooks/mercadopago/route.ts`.

### Un guard de credenciales que no veía lo que importa

**Síntoma:** `tests/pasarela-sin-env.test.ts` daba verde con `credWsEstricta('STRIPE_WEBHOOK_SECRET', ws)`
o `credWs(CLAVE, ws)` puestos en `lib/cobros.ts`. **Causa:** busca el nombre de la clave pegado a
`credWs(`, y `credWsEstricta` es legítima en el ruteo de un webhook, así que no se puede prohibir en todo
el repo. **Regla:** además del barrido, un guard POR MÓDULO que prohíbe `credWs\w*(`, `envCred(`,
`process.env` y `OWNER_WS` en `lib/cobros.ts`. ⚠️ Y nunca se carga una clave de pasarela en el entorno de
Vercel: `credWs`/`credWsEstricta` se la entregarían al ws1 (Mauricio) como si fuera suya.
**Vive en:** `tests/cobros-servicio.test.ts` · `tests/pasarela-sin-env.test.ts` · `lib/credenciales.ts` (`NO_MIGRAR_A_WS`).

### Un link vivo de una cuota ya cobrada se podía pagar dos veces (14/10/2026)

**Síntoma (revisión de la rama `crm-bloques-b2`):** se manda el link de la cuota 2 (500), el cliente paga por
transferencia y el closer la marca pagada. Días después el cliente abre el link del WhatsApp y paga: la pasarela le
cobra 500 de nuevo y el CRM suma otra cuota cobrada. **Causa:** marcar una cuota a mano no tocaba sus cobros
pendientes. El comentario de `registrarCobroDeProveedor` decía que el segundo pago «salda otra del mismo monto»,
y no pasaba: el casamiento por monto es sólo para links SIN cuota (`!p.pagoId`).
**Regla:** al marcar PAGADA una cuota se anulan sus links sin pagar (`anularLinksDeCuota`), y vive en
`marcarPago`, por donde pasan la ficha, el doer, la API y la pasarela, igual que el corte de la cobranza. El cobro
que la está saldando queda afuera (`pagos.cobro_id`; a esa altura ya está `pagado`). Desmarcar no los reabre. Un
segundo pago de un link de la cuota 2 NO salda la cuota 3: es plata que entró dos veces, y entra como cuota nueva
cobrada para que una persona la vea.
**Vive en:** `lib/cobros.ts` (`anularLinksDeCuota`) · `lib/pagos.ts` (`marcarPago` → `anularLinksAlCobrar`) · `tests/pagos-medias-b2.test.ts`.

### «Mercado Pago no cierra una preferencia» no era cierto, y «para que una persona la vea» no la mostraba (15/10/2026)

**Síntoma:** un link de Mercado Pago anulado (porque la cuota se cobró por otro lado, o porque el cobro cambió) se
podía pagar igual, y el pago entraba como una cuota cobrada más, sin una palabra en ningún lado.
**El diagnóstico obvio era el equivocado:** el código decía «Mercado Pago no tiene cómo cerrar una preferencia ya
abierta» y se tomó como un dato. La API de MP sí actualiza una preferencia (`PUT /checkout/preferences/{id}`), y el
código YA usaba `expires` + `expiration_date_to` al crear una con vencimiento: cerrarla es mandar esos mismos campos
con el fin en AHORA (`vencerPreferenciaMp`). Una suscripción de MP es otra cosa (un preapproval): sin autorizar, se
cancela. ⚠️ Que MP respete el vencimiento con el checkout ya abierto NO está medido (necesita las claves de prueba).
**Y la otra mitad:** la entrada del 14/10 decía que el pago doble «entra como cuota nueva cobrada para que una
persona la vea». Una cuota más en una lista no es que alguien la vea. **Regla:** cuando el sistema acepta plata que
no tendría que haber entrado, lo DICE donde se mira: en el cobro (`motivo`, que la ficha muestra) y en el historial
del lead, con el caso concreto si se sabe (la cuota del link ya estaba cobrada por OTRO pago → «la plata entró dos
veces»), y sólo una vez (la corrida que ganó la transición). El cron también relee los anulados que llegaron a la
pasarela: un aviso perdido no lo deja escondido.
**Vive en:** `lib/cobros.ts` (`anularCobro`, `aplicarPagoAprobado` paso 4b, `cuotaCobradaPorOtroLado`,
`reconciliarCobros`) · `lib/cobros-reglas.ts` (`avisoPagoPorLinkAnulado`) · `lib/mercadopago-api.ts`
(`vencerPreferenciaMp`) · `tests/pago-link-anulado.test.ts` · `tests/mercadopago-api.test.ts`.

### Una devolución de Stripe puede fallar DESPUÉS, y tres trampas para escucharlo (15/10/2026)

**Síntoma:** MaKo daba una devolución de Stripe por hecha apenas la creaba (`pending` o `succeeded`): cobro
«Reembolsado», cuota desmarcada. Días después Stripe puede pasarla a `failed` (tarjeta denunciada o dada de baja, una
disputa abierta): devuelve la plata al saldo del negocio y el cargo vuelve a estar cobrado. En MaKo seguía devuelta para
siempre.
**El diagnóstico obvio era el equivocado:** el pendiente decía «`pending` se da por hecho». `pending` está bien darlo por
hecho (Stripe ya muestra el cargo devuelto); lo que faltaba es enterarse de que FALLÓ. Se escucha `refund.failed` (existe
desde 2024-10-28.acacia; `charge.refund.updated` es el nombre viejo), se relee la devolución (que de verdad haya fallado)
y su CARGO, que es lo que dice si sigue devuelto por otra devolución: sólo si ya no, el cobro vuelve a `pagado`
(compare-and-set) y la cuota se vuelve a marcar con la fecha del cargo (`remarcarCobroDeProveedor`, con la guarda del
negocio). Siempre queda en el historial, con la razón en palabras si se conoce.
**Trampa 1 — un nombre de evento que Stripe no conoce rompe CONECTAR.** `enabled_events` se valida al crear el aviso: un
evento inexistente hace fallar `asegurarWebhookStripe`, o sea, ningún negocio podría conectar Stripe. Antes de sumar uno a
`EVENTOS_STRIPE`, confirmar en el changelog de Stripe desde qué versión existe.
**Trampa 2 — cambiar `EVENTOS_STRIPE` no les llega a los avisos ya registrados.** Stripe guarda la lista con la que se
creó cada uno. `asegurarEventosStripe` la pone al día sin tocar el secreto (actualizar no cambia el `whsec_`), y hoy la
llama `reembolsarCobro` ANTES de pedir la devolución. Una devolución hecha desde el panel de Stripe, en una cuenta
conectada antes de este cambio, no avisa su falla hasta que el negocio reconecte o MaKo haga una devolución. Si algún día
se suma un evento que importa sin una acción de MaKo (las disputas), hay que llamarla también desde el cron.
**Trampa 3 — la clave de idempotencia fija contra un reintento.** La del reembolso es la del cobro (una confirmación
repetida no devuelve dos veces); pero después de una devolución FALLIDA, la misma clave dentro de las 24 h le devolvería
a MaKo la respuesta vieja SIN crear otra devolución. El reintento lleva el `updated_at` que dejó la falla.
**Vive en:** `lib/stripe-api.ts` (`EVENTOS_STRIPE`, `asegurarEventosStripe`, `leerReembolsoStripe`) ·
`lib/cobros-eventos.ts` (`refund.failed`, `confirmarDevolucionFallida`) · `lib/cobros-webhook.ts` (rama `reembolso`,
`cobroDelPagoStripe`) · `lib/cobros.ts` (`aplicarReembolsoFallido`, `reembolsarCobro`) · `lib/pagos.ts`
(`remarcarCobroDeProveedor`) · `lib/cobros-reglas.ts` (`textoDevolucionFallida`, `idemReembolso`) ·
`tests/devolucion-fallida.test.ts`.

### «Lo devuelto no es deuda» vivía en un filtro que no todas las lecturas tienen (15/10/2026)

**Síntoma:** después de un reembolso, el Outstanding (sin ventana), «A quién cobrarle» y el Revenue del Dashboard con
«Todo» seguían sumando la cuota devuelta como plata por cobrar.
**Causa:** `desmarcarCobroDeProveedor` deja la cuota devuelta impaga y SIN vencimiento, confiando en que las lecturas de
deuda filtran por `fecha_esperada`. Muchas lo hacen (el Outstanding con ventana, la cobranza, el calendario), y por eso
parecía resuelto. Pero las que suman TODA cuota impaga no filtran: `getOutstandingDetalle` sin ventana,
`getOutstandingTotal`, y el Revenue con «Todo», que suma a propósito las cuotas sin fecha porque una cuota del plan sin
fecha SÍ es deuda.
**Regla:** «sin vencimiento» no alcanza para decir «devuelta» (la cuota del plan sin fecha tampoco tiene). Toda lectura
de cuotas impagas que NO filtre por vencimiento saca las devueltas con `esCuotaDevuelta` (lib/cobrado-lead.ts: impaga +
sin vencimiento + con pasarela), y pide las columnas que la regla mira (`proveedor`, `cobro_id`): sin ellas en el select,
la regla da «no devuelta» para todas y no saca nada, sin error.
**Vive en:** `lib/pagos.ts` (`getOutstandingDetalle`, `getOutstandingTotal`) · `lib/graficos-datos-extra.ts`
(`filasRevenue`) · `tests/outstanding-sin-devueltas.test.ts`.

### Contracargos: la documentación de Mercado Pago se contradice, y en Stripe la plata se lee de la disputa (15/10/2026)

**Síntoma:** un contracargo de Mercado Pago quedaba sólo en una fila de `pasarela_eventos`; Stripe ni lo escuchaba. La
plata se iba de la cuenta del negocio y la cuota seguía «cobrada».
**El diagnóstico obvio era el equivocado (el de este mismo documento, más abajo):** la decisión del 15/10 decía «en MP,
`charged_back` con `settled` es plata debitada al vendedor». Al hacerlo: la documentación de MP se CONTRADICE. La página
de contracargos de Checkout Pro dice que `settled` es una decisión en contra del vendedor y `reimbursed` a favor; la de
estados de transacción dice que `settled` es la plata devuelta al comprador y `reimbursed` acreditada al vendedor; la
de estados de orden dice que `reimbursed` es devuelto al pagador. Lo confiable es `coverage_applied` del objeto del
contracargo (otra API, otro tópico de aviso), que no está medido. **Regla:** en MP el contracargo se CUENTA (historial
y motivo, una vez por cada `status_detail`) y NO mueve la cuota hasta medirlo con las claves de prueba.
**Stripe, en cambio, lo dice sin ambigüedad**, pero no en el tipo del evento: la plata sale con
`charge.dispute.funds_withdrawn` y vuelve con `charge.dispute.funds_reinstated` (nombres verificados en
docs.stripe.com/api/events/types; uno inexistente haría fallar CONECTAR). Los avisos pueden llegar desordenados, así
que dónde está la plata se lee de la disputa RELEÍDA: sus `balance_transactions` (un retiro es negativo, un reintegro
positivo). Con la plata afuera, la cuota se desmarca como un reembolso; si vuelve, se vuelve a marcar; las dos son
idempotentes. Una disputa PARCIAL no mueve la cuota (no se parte), y un cargo ya devuelto entero tampoco.
**Y la trampa 2 de la devolución fallida se cumplió:** un contracargo llega sin que MaKo haga nada, así que poner al día
los eventos del aviso sólo al reembolsar no alcanzaba. El cron de cobros lo hace una vez por día (`esLaVueltaDelDia`, la
vuelta de las 06:17 UTC; `mantenerAvisosStripe`).
**Al probarlo rompiéndolo:** «la plata salió» mirando si hay movimientos (y no su SIGNO) pasaba el test, porque los casos
eran sólo retiro, retiro + reintegro, y nada. Hizo falta el caso de un reintegro solo.
**Vive en:** `lib/stripe-api.ts` (`EVENTOS_STRIPE`, `leerDisputaStripe`) · `lib/cobros-eventos.ts` (`faseDeDisputa`,
`planDePagoMp`) · `lib/cobros-webhook.ts` (rama `disputa`, `contracargo` de MP) · `lib/cobros.ts` (`aplicarContracargo`,
`mantenerAvisosStripe`) · `lib/cobros-reglas.ts` (`textoContracargo`, `esLaVueltaDelDia`) ·
`app/api/cron/cobros-reconciliar/route.ts` · `tests/contracargos.test.ts`.

### Una suscripción con plazo se cobraba para siempre, y el plazo del lead no sirve para reabrir (15/10/2026)

**Síntoma:** un producto del catálogo «6 meses» (`productos.suscripcion_meses`) se cobraba por la pasarela como
suscripción sin fin: al séptimo mes la tarjeta del cliente se seguía cobrando.
**Causa:** los dos checkouts nacían sin fin, y el lead se ganaba con `suscripcion_meses: null`.
**Regla:** el plazo sale del producto (aunque esté inactivo) y cada pasarela lo lleva a su manera. **Stripe:** Checkout
no acepta un fin, así que al PRIMER pago se programa `cancel_at` en el fin del período N (el ancla de facturación + N
meses, día capado como factura Stripe), sin prorrateo: se cobran N mensualidades y la N+1 no sale. Nunca tumba el pago;
si falla, el cobro dice «cancélala a mano». **Mercado Pago:** nace con `auto_recurring.end_date` un día ANTES de ese
fin, porque MP cobra desde que la persona autoriza: si autoriza tarde se pierde una mensualidad, no se cobra una de más
(en lo que es plata ajena, cobrar de menos es el error barato). Sin poder leer el plazo, la suscripción de MP no se
crea. El lead que se GANA con ese pago lleva el plazo (su `fecha_cierre` es hoy), así el MRR deja de contarla.
**La trampa:** el plazo del LEAD se cuenta desde su `fecha_cierre`. Un lead que ya era cliente y vuelve con un link de
suscripción con plazo (`reabrirSuscripcionDelLead`) tiene una fecha de cierre de hace meses: ponerle el plazo lo daba
por vencido antes de tiempo. Ahí queda sin plazo, y el fin lo marca la pasarela al cancelar.
**Vive en:** `lib/cobros.ts` (`plazoDelCobro`, `crearCheckout`, `aplicarPagoAprobado` paso 2a, `programarPlazoStripe`,
`ganarLead`) · `lib/stripe-api.ts` (`programarFinSuscripcionStripe`) · `lib/mercadopago-api.ts` (`crearSuscripcionMp`)
· `lib/cobros-reglas.ts` (`finDelPlazo`) · `tests/suscripcion-plazo.test.ts`.

### La fecha de la cuota es la del PAGO, y «cancelada» no es «terminó su plazo» (15/10/2026)

**Síntoma 1:** la cuota de un pago de la pasarela se asentaba con la fecha en que MaKo procesó el aviso. Un aviso
reintentado, o el cron que repara días después, la corría de día: un pago del 31 caía en el mes siguiente del cash.
**Regla:** la fecha es la del pago según la pasarela: el `created` del EVENTO de Stripe (cuándo pasó, no cuándo
llegó), `date_approved` en Mercado Pago, y el `pagado_at` del cobro al reparar. Sin ninguna, hoy. Lo que queda sin
fecha del pago: la conciliación de Stripe (relee la sesión, que no la tiene) usa la de hoy.
**Síntoma 2:** cancelar una suscripción de la pasarela la pasaba a «plazo = meses transcurridos, mínimo 1»; cancelada
en el primer mes, el MRR la seguía contando hasta cumplir el mes. **Regla:** queda CANCELADA CON FECHA
(`suscripcion_cancelada_at`, como la manual de b2) y el MRR no cuenta ninguna cancelada. Los meses que duró son las
mensualidades que cobró ese cobro (cada factura es una cuota), no los transcurridos (que contaban una de menos si se
cancelaba pasado el aniversario).
**La trampa que apareció al hacerlo:** con plazo en Stripe (`cancel_at`), al cumplirse Stripe borra la suscripción y
llega el MISMO aviso que una cancelación. Marcarla «cancelada» habría dicho eso en la ficha de una que simplemente
terminó. Si ya cobró todas las mensualidades del plazo, terminó: no se toca, y el historial dice «terminada».
**Vive en:** `lib/cobros.ts` (`aplicarPagoAprobado`, `aplicarSuscripcionCancelada`, `cuotasPagadasDelCobro`) ·
`lib/cobros-eventos.ts` (`eventoStripe`: `creado`) · `lib/cobros-webhook.ts` · `lib/queries.ts` (`getMrrActivo`) ·
`tests/cuota-fecha-y-cancelacion.test.ts`.

### Cambiar el email de acceso: un aviso al anterior, no un código (15/10/2026)

**El pendiente decía «falta un código al email actual»** para que quien tiene el link de la compra no pueda quedarse con
la cuenta cambiando el email. **Era el remedio equivocado:** el caso legítimo más común del cambio es que el email se
tipeó MAL al pagar, y ahí no le llega ningún código a nadie: lo bloqueaba justo a quien lo necesita. **Regla, copiada
de Google y GitHub:** el email nuevo se prueba solo (hay que entrar con Google con ESA dirección) y al anterior le llega
un aviso —el nuevo enmascarado, por si el anterior era de un desconocido— con a dónde escribir para revertirlo. Sale
después del cambio, como MaKo (la key y el remitente de la plataforma), y no frena la respuesta.
**Vive en:** `lib/invitaciones.ts` (`avisarCambioDeEmailDeAcceso`) · `app/api/pagar/email/route.ts` · `tests/pagar-publico.test.ts`.

### «Darme de baja»: un botón propio, y lo que la baja todavía NO hace (15/10/2026)

**Qué es:** «Configuración del negocio → Tu plan» (app/configuraciones/plan), con un botón «Darme de baja» propio de MaKo.
Se hizo primero con el portal de cliente de Stripe, y **Estrategia lo corrigió el mismo día**: el portal no cubre
Mercado Pago (que no tiene uno) y un botón propio cumple la Resolución 316/2018 de Argentina si aplica (el botón a la
vista, sin trámites previos, y un código de baja). La 316 nació para telefonía, internet y TV paga y se extendió a
seguros, streaming y planes de ahorro: que alcance a un SaaS para empresas no está claro, pero cumplir su mínimo es barato.
**Cómo, copiado:** Stripe (stripe.com/docs/subscriptions/canceling-pausing) y Paddle
(developer.paddle.com/build/subscriptions/cancel-subscriptions) programan la baja al FINAL del período pagado: quien pagó
el mes lo usa. Vive junto al plan, en la configuración del negocio, y son dos pasos (el botón y una confirmación que dice
qué pasa). Al terminar se ve el código de baja, que también llega por email. Mercado Pago no tiene «al final del período»:
se cancela en el acto.
**Dos trampas:** la columna `suscripcion_estado` tiene un CHECK (`activa`/`cancelada`), así que «baja pedida» (Stripe la
sigue cobrando… hasta el fin del período) vive en el `motivo` con un prefijo, como la renovación fallida; y la clave de
idempotencia de la baja NO puede ser la de cancelar en el acto (`idemBaja`): Stripe rechaza una clave repetida con otro
pedido dentro de las 24 h, y el super admin puede cancelarla del todo el mismo día.
**Visto en producción (15/10/2026):** en el workspace de la PLATAFORMA (ws9) la sección decía «SuperAdmin — Acordado con
MaKo — para darte de baja, escríbenos». La plataforma no tiene un plan de MaKo: el índice ya no la ofrece ahí
(`DisponiblesNegocio.plan`) y la página manda al índice. En un cliente (ws1) se veía bien. No había ningún cobro todavía,
así que el botón no se pudo ver con un plan cobrado de verdad.
**Lo que la baja NO hace:** dejar de cobrar no le saca el plan al workspace. No existe el estado de suscripción por
workspace (la fila «Estado de suscripción por workspace» de la tabla de abajo): la capa queda. La baja corta la plata, no
el acceso; eso sigue siendo a mano desde /admin.
**Vive en:** `app/configuraciones/plan/*` · `lib/cobros.ts` (`suscripcionDeMakoDe`, `darDeBajaMiPlan`) ·
`lib/stripe-api.ts` (`programarBajaStripe`) · `lib/cobros-reglas.ts` (`codigoDeBaja`, `textoBajaPedida`) ·
`lib/invitaciones.ts` (`mandarCodigoDeBaja`) · la API (`ver_mi_plan`, `dar_de_baja_mi_plan`) · `tests/mi-plan.test.ts`.

### Cuatro «decisiones de Martín» que no eran suyas (15/10/2026)

La tabla de abajo tenía seis filas marcadas «decisión de Martín». Pasadas por la vara de AGENTS.md (lo que copia lo que
hacen Stripe o Mercado Pago, o se contesta con lo escrito o con el código, se decide), cuatro se decidieron sin
preguntarle. Quedan suyas dos: el RFC / Stripe en Argentina (fiscal y precio) y los borradores legales.

- **El lead GANADO al que se le devuelve el pago se queda donde está.** Stripe hace lo mismo (el cliente sigue siendo
  cliente, con el cargo marcado como devuelto), y moverlo solo sería una regla escondida (memoria `mako-nada-por-detras`). Lo
  que sí pasa ya: el cobro queda «Reembolsado», la cuota se desmarca, el historial lo dice y el CRON «Pagos» dispara
  «Se devuelve un pago», así que quien quiera moverlo lo arma con una automatización visible. El monto del cierre
  queda: es lo que se vendió, no lo que se cobró.
- **Un lead de pago único que paga un link de SUSCRIPCIÓN sigue de pago único, y la mensualidad cuenta en el MRR desde
  el cobro.** Copia de Stripe: el MRR son las suscripciones activas, y una compra única no deja de existir porque
  después haya una suscripción. Pasarlo a «suscripción» sacaría el pago único de lo vendido: una
  suscripción no tiene `monto_cierre_usd` (lib/venta-tipo.ts; cambiar el tipo en la ficha lo vacía). **HECHO el 15/10:**
  `getMrrActivo` (lib/queries.ts) suma las suscripciones PAGADAS y ACTIVAS de la pasarela de los leads que no son de
  suscripción (`mrrDeLaPasarela`); las de un lead de suscripción no, porque ya las cuenta el lead. Una suscripción de la
  pasarela SIN lead (fuera del CRM) no entra.
- **Un flujo puede reembolsar: sin guarda de costo `dinero`.** Ya lo había decidido Martín el 08/10, textual: un flujo
  «que pueda hacer todo, sin limitaciones»; el dueño confirma la acción al CONFIGURAR el paso (cabecera de
  `lib/api-mako/flujo.ts`). No era una pregunta abierta.
- **Los pagos que NO creó MaKo se siguen ignorando con rastro; un CONTRACARGO se muestra, y desmarca la cuota sólo
  cuando el proveedor dice que la plata salió.** Un pago sin el token de un cobro no tiene lead: importarlo crearía
  fichas sin dueño o duplicadas. El contracargo, en cambio, es plata de un cobro nuestro: hoy queda sólo en una fila
  de `pasarela_eventos` que nadie mira. Siempre al historial del lead y al motivo del cobro. **HECHO el mismo día, con una
  corrección:** lo que esta entrada decía de Mercado Pago (`settled` = plata debitada) NO se sostiene, su documentación
  se contradice; ver «Contracargos: la documentación de Mercado Pago se contradice…» arriba. En Stripe la plata se lee
  de la disputa (sus `balance_transactions`), no de `closed`/`lost`.

*Corrida del 11/10/2026: relevamiento de 8 agentes, la base escrita a mano, 7 agentes de
implementación en un worktree propio (`C:/dev/wt-pagos`) y una rama aparte para Automations.*

### El mes de un cliente de agencia (#866 y #867, 17/10/2026)

**El pedido** (llamada «Revisión de MaKo» con Código Inmobiliario, 16/10). #866, Martín (1:51:21): al cargar un cliente
nuevo, la agencia ve en el acto el link de Mercado Pago de su suscripción; con el pago queda habilitado sin que él lo
acepte, y renueva cada mes en la misma fecha. 47 dólares por cliente y 97 la suscripción de agencia. #867 (1:59:00, lo
ofreció Martín y Joan lo aceptó): el cliente se paga al cargarlo, pero su mes empieza a correr al terminar el onboarding.

**El diagnóstico obvio era el equivocado: «una suscripción al cargarlo, y se pausa hasta el fin del onboarding».**
Mercado Pago documenta pausar (`status: paused`) y reactivar, pero NO qué cobra al reactivar, ni que se pueda mover la
fecha de una suscripción ya autorizada (el PUT documenta monto, tarjeta y estado; leído el 17/10 en su referencia). Si
cobra al reactivar, la agencia paga dos veces el primer mes. Sin las claves de prueba no se puede medir.
Lo que SÍ documenta es `auto_recurring.start_date` al CREARLA. De ahí salió esta forma:
1. Al abrir la cuenta, el **primer mes** es un link de PAGO ÚNICO de la Mercado Pago de MaKo (el camino más medido de la
   pasarela). El pago aprueba la cartera, compare-and-set sobre `pendiente` (lib/agencia-habilitar.ts), y le manda el
   acceso con el mismo aviso que la firma del super admin.
2. Cuando el cliente termina el onboarding, el cron crea la **suscripción mensual** con `start_date` un mes después
   (lib/agencia-cobro.ts). La agencia la autoriza una vez (el botón «Activar renovación» de su tarjeta). Desde ahí renueva
   sola, en esa fecha.

**Lo medido que cambió el disparador.** Los clientes de Código Inmobiliario (ws15, 17, 18 y 19) terminaron el onboarding
en 15 minutos a 2 días, y lo completó la propia agencia. Parecía que la pausa no iba a existir. Pero el onboarding es
obligatorio para entrar, también para la agencia que lo mira desde su vista (`onboardingPendiente`). Así que mientras no
lo termina, nadie usa esa cuenta, y «el mes corre desde el fin del onboarding» no se puede usar de regalo. Por eso no
hace falta un tope de días.

**Tres trampas de la pasarela, para el próximo que toque suscripciones diferidas:**
- **Mercado Pago no avisa nada aplicable al AUTORIZAR**: el aviso del preapproval se ignora («el pago llega en su propia
  notificación») y el cobro sigue `pendiente` hasta el primer cobro, un mes después. La pantalla habría seguido pidiendo
  «Activar renovación». El cron lo relee (`anotarAutorizacionMp`, lib/cobros.ts) y anota `suscripcion_estado: 'activa'`
  con el cobro pendiente. El MRR no la cuenta: pide `pagado`.
- **En Stripe, una suscripción con prueba gratis manda una factura de $0** con `billing_reason: subscription_create`, que
  `FACTURAS_DE_PAGO` acepta: se asentaría como un pago de US$47. Por eso el cliente de agencia es SÓLO Mercado Pago
  (`crearCobro` rechaza `inicioAt` en otra pasarela). Antes de usar `trial_end`, ignorar las facturas de monto 0.
- **Las columnas nuevas no van en `COLS_COBRO`.** Sin la mig 0308, TODA lectura de cobros caería. Se escriben sólo en el
  cobro de un cliente de agencia y se leen sólo en lib/agencia-*.

**Lo que NO hace falta preguntarle a Martín.** El precio en pesos de los US$47 es un dato que él carga en /admin/cobros.
Sin él (o sin la Mercado Pago de MaKo conectada) la cuenta queda como siempre: espera su aprobación.

---

---

## Quien deja de pagar deja de entrar, y el plan corta también la API (17/10/2026)

⚠️ **APAGADO desde la revisión adversarial del 17/10** (interruptor en `false`; los defectos que la frenaron y lo que hay que arreglar, en docs/relevo/pagos.md → «APAGADOS»).

*Corrida «Implemente todos los pendientes al 100%», agente B4, rama `pend-b4-1710`.*

### El estado de suscripción por negocio no necesitaba una tabla: se DERIVA de los cobros

- **Qué faltaba.** «Darme de baja» cortaba el cobro y no el acceso; una renovación de agencia sin autorizar no cortaba
  nada. La tabla de abajo decía «no existe la tabla».
- **Lo que se decidió (sin Martín, copiando a Stripe y Paddle):** lo que MaKo cobra por el lugar de un negocio ya vive en
  `cobros` de la plataforma, atado por `alta_ws` (plan vendido) o `cliente_ws` (cliente de agencia, mig 0308). De ahí
  sale la vigencia (`vigenciaDelLugar`, lib/plan-acceso-reglas.ts): quien pagó el mes lo usa hasta el final, más
  **5 días de gracia**; un plan devuelto no cubre nada; la renovación de agencia sin autorizar termina el día que tenía que
  empezar a cobrar (`inicio_at`); con una suscripción activa y pagada, al día. Los planes son mensuales.
- **Sólo se corta lo que se vendió por la pasarela.** El ws1 y los acuerdos a mano no tienen un cobro de la plataforma:
  nunca se cortan. La plataforma, nunca.
- **El corte es `workspaces.estado = 'pausado'`** (el mismo de /admin), con el porqué en `app_settings`
  `plan.corte_por_pago` (`vigente`). Lo hace el cron de la pasarela cada media hora (`revisarAccesosPorPago`,
  lib/plan-acceso.ts): compare-and-set sobre `activo`, tope de 5 por corrida, y si guardar el porqué falla deshace la
  pausa (sin él, el pago no lo reabriría nunca). Reabre lo que cortó el cobro cuando vuelve a estar al día, también en el
  acto al entrar el pago (`soloWs`). **Uno reactivado a mano por el MISMO vencimiento no se vuelve a cortar** (`soltar`), y
  una pausa a mano no la reabre nadie más que /admin.
- **Un negocio pausado no se abre** (vale también para una pausa a mano: ws5, «Prueba real - Ananda», era el único
  pausado el 17/10): `resolverDesdeCookies` (lib/workspace.ts) le da `null` a su equipo y a la agencia que lo mira (sin
  datos que leer ni cuenta que operar), `requireSesion` manda a /cuenta-pausada (dice por qué y a quién escribir), y la
  API de MaKo contesta 403. **Fail-open** si la base no contesta: un error pasajero no deja a todos afuera. El super
  admin no pasa por el corte.
- **Medido el 17/10:** 0 cobros en producción: el corte no toca a nadie hoy.

### `requireCapa` era UN solo lugar: el cartel no eran 56 call-sites

«Mostrar un cartel de mejorá tu plan no es cambiar el guard: es cambiar 56 call-sites» (arriba) era el diagnóstico
equivocado: la decisión «no está en tu plan» se toma en un solo lugar (`requireCapa`), y alcanza con que redirija a una
página que lo DIGA (/no-esta-en-tu-plan, con `PermissionState motivo="plan"`, que existía sin emisores) en vez de a la
casa del plan.

### La API: un header que pone el proxy y un corte en la resolución del negocio

- El proxy pone `x-mako-ruta` (pisa el del cliente) y `resolverDesdeCookies` no le da workspace a una API de una tab que
  la capa no incluye (`tabDeRutaApi`, lib/api-tab.ts). Sin workspace, fail-closed como un negocio pausado.
- **Sólo las APIs que usa UNA tab** (Ads Manager y Meta, el CRM automático, Web Generator, Automations, Chats). Medido con
  un grep: /api/crm, /api/offer (el onboarding, que hacen todos), /api/flujos, /api/email, /api/experimentos,
  /api/ad-insights, /api/landing-analyst y /api/ads-analyst las usan tabs que un plan chico SÍ compra: cortarlas por
  carpeta rompería eso. Quedan en `COMPARTIDAS` y el test barre que nadie empiece a usar una de la tabla desde otra tab.
- **Las server actions no pasan por esto:** su pedido va a la ruta de la PÁGINA que las llama, no a la de su tab.
- La API de MaKo ya cortaba por capa (`vistaDe` → `tabsDeCapa`): lo que no cortaba era app/api.

---

## Lo que quedó SIN hacer, con el archivo donde vive

| Qué | Dónde |
|---|---|
| **Cliente de agencia:** que MaKo tenga su Mercado Pago conectada (ws9 tenía 0 claves de pasarela el 17/10) y el precio en pesos cargado. Sin las dos cosas no sale ningún link | `/integraciones?ws=9`, `/admin/cobros` («Cliente de agencia») |
| **Cliente de agencia:** medir con claves de prueba que MP acepte `start_date` en una suscripción sin plan, que no cobre al autorizarla, y que el preapproval quede `authorized` | `lib/mercadopago-api.ts` (`crearSuscripcionMp`), `lib/cobros.ts` (`anotarAutorizacionMp`) |
| **Cliente de agencia:** nada le avisa a la agencia cuando se crea su renovación: la ve en /partners (MaKo Partners). Y si no la autoriza, el acceso no se corta (no existe el estado de suscripción por workspace) | `lib/agencia-cobro.ts` (`renovacionesDeAgencia`), `app/partners/PartnersApp.tsx` |
| **Cliente de agencia:** la suscripción de agencia (los 97) se vende como cualquier plan desde «Vender un plan»; no está atada a sus clientes | `app/admin/cobros/VenderPlan.tsx` |
| ~~Que el corte por capa llegue a la API~~ **Hecho el 17/10/2026** para las APIs de una sola tab (`lib/api-tab.ts`); las compartidas siguen sin corte por carpeta (ver «La API: un header…») | `lib/api-tab.ts`, `lib/workspace.ts` |
| ~~El cartel de «no está en tu plan»~~ **Hecho el 17/10/2026**: un solo lugar (`requireCapa` → /no-esta-en-tu-plan) | `lib/tab-access.ts`, `app/no-esta-en-tu-plan/page.tsx` |
| ~~Estado de suscripción por workspace~~ **Hecho el 17/10/2026**: se deriva de los cobros, sin tabla (`vigenciaDelLugar`); el dunning lo siguen haciendo Stripe y Mercado Pago | `lib/plan-acceso-reglas.ts`, `lib/plan-acceso.ts` |
| Corte de gasto de IA por cliente | `modelo.ts:148` lo declara ausente |
| Separar el gasto de Claude del ws1 | `modelo.ts:145` |
| `funnel_id` en el motor de nutrición y en el CRM automático | mig 0170, `lib/nutricion*.ts`, `lib/crm-auto.ts` |
| Contraseña o segundo proveedor de login | `app/api/auth/callback/google/route.ts` |
| Atribución de referidos (`workspaces.origen = 'referido:<ws>'`), sólo con Paddle cobrando y 5+ referidos pagando | `embudo-y-high-ticket.md:401`, [referidos.md](referidos.md) § 6 |
| **Pasarela:** probar con claves REALES — si una clave restringida (`rk_`) puede leer `GET /v1/account` y si la `notification_url` de MP llega firmada; y si MP respeta el vencimiento de una preferencia que se anuló con el checkout ya abierto (`vencerPreferenciaMp`); y en qué estado queda una suscripción de MP al llegar su `end_date` (si sigue `authorized`, `mrrDeLaPasarela` la contaría después del plazo) | `lib/cobros-conexion.ts`, `lib/metodo-catalogo.ts` (tutorial), `app/api/webhooks/mercadopago/route.ts` |
| **Pasarela:** precios en moneda local en el catálogo (para que la API y las automatizaciones creen links de Mercado Pago) | `lib/productos.ts`, `lib/api-mako/areas/cobros.run.ts` |
| **Pasarela:** un contracargo de Mercado Pago se cuenta pero NO mueve la cuota: falta medir con las claves de prueba qué dice `coverage_applied` (GET del contracargo, otro tópico de aviso) y qué significan de verdad `settled`/`reimbursed` | `lib/cobros-eventos.ts` (`planDePagoMp`), `lib/cobros-webhook.ts`, `lib/mercadopago-api.ts` |
| **Pasarela:** `crear_link_pago` en la lista corta del «⚡ Acción» (necesita un control propio para el producto del catálogo) | `lib/editor-acciones.ts` |
| **Pasarela:** vender planes de MaKo a México arranca el reloj del RFC: en la Ticketera de Martín (`cobrar-mako-en-mexico`); con la A se integra la rama `pagos-mexico-guarda`, ya probada. Stripe en Argentina es «segunda ola» (modelo.ts:641) | `lib/cobros.ts` (`crearCobro`), `app/admin/dev/pricing/modelo.ts` |
| **Pasarela:** la garantía del programa grupal (`garantia-grupal`, Ticketera de Martín); y cancelar uno mismo con el portal de cliente de Stripe (decidido por Estrategia el 15/10; hasta entonces, «por email») | `app/reembolsos/page.tsx`, `app/terminos/page.tsx` §8 |
| **Pasarela:** un «Botón de baja» PÚBLICO en la home de MaKo, sin sesión. No se hizo (Estrategia, 15/10): la Resolución 316/2018 nació para telefonía, internet y TV paga y se extendió a seguros, streaming y planes de ahorro, y no está claro que alcance a un SaaS para empresas; el botón de «Tu plan» ya cubre su mínimo (a la vista, sin trámites previos, con código de baja). Si alcanzara, la pieza es un formulario público (`/baja`, linkeado desde la home y el pie de las páginas legales) que pide el email de la cuenta y manda un link firmado para confirmar la baja sin entrar, con topes por IP y por email | `app/configuraciones/plan`, `lib/cobros.ts` (`darDeBajaMiPlan`), `lib/rutas-publicas.ts` |
| **Pasarela:** la baja del plan corta la PLATA, no el ACCESO: el workspace sigue con su capa después de darse de baja (no existe el estado de suscripción por workspace, fila de arriba). Hoy el acceso se saca a mano desde /admin | `lib/cobros.ts` (`aplicarSuscripcionCancelada`), `lib/workspace.ts` (la capa) |
| **Pasarela (revisión):** un aviso de MP sin firma con el `user_id` de un negocio conectado provoca una relectura con SU token (las filas `sin-workspace` ya tienen techo: una por día, 15/10) | `app/api/webhooks/mercadopago/route.ts` |

*Corrida del 04/10/2026, 12 agentes. Las refutaciones dieron vuelta nueve afirmaciones; las
tres que más cambiaron el plan están arriba (la cuenta del runway, el margen del 47 y el
tamaño del cartel de upgrade).*

## El socio que no existe: un rótulo de una transcripción viajó a cuatro documentos (15/10/2026)

**Síntoma:** una tarjeta de la Ticketera le preguntó a Martín «¿Tu socio tiene que poder ver Strategy y Runway?». Contestó: «Que socio? No tengo ni tendré nunca un socio, olvida esto.» Si no la hubiera leído, el supuesto entraba al diseño de permisos de Strategy y de la Ticketera.

**Causa:** la transcripción del audio del 10/10 (referidos) se escribió con una línea de cabecera que decía «Dos voces: Martín proponiendo, su socio refutando». Nadie lo dijo en el audio: lo puso quien transcribió, para nombrar a la segunda voz. De ahí se copió, como dato, a `docs/fuentes-fuera-del-repo.md`, a `docs/referidos.md` («Martín y su socio», «como dijo tu socio» y hasta «Leandro es socio, no referidor», que contradice al mismo documento, donde Leandro está entre «los amigos» a los que se les cobra), a la memoria `referidos-propuesta` y a `docs/propuesta-tabs-strategy.md` («¿Quién es nosotros? Si tu socio tiene que leer estas tabs…»), que es de donde salió la tarjeta.

**El diagnóstico obvio era el equivocado:** se leía como un hecho del negocio (hay dos dueños) y era un ROTULADO. Cada documento lo citaba de otro, así que parecía confirmado cuatro veces: era una sola inferencia, copiada.

**La regla:** al transcribir, una voz que no se presenta se rotula «otra persona» (o por su nombre si lo DICE el audio), nunca por un rol inferido (socio, cliente, closer). Y una pregunta que da por hecha una persona («tu socio», «tu equipo», «tu contador») se verifica contra lo que Martín dijo, no contra un documento nuestro.

**Por qué esa tarjeta no pasaba la regla de la Ticketera (AGENTS.md, 9f4585931):** cualquier cosa escrita por Martín la habría frenado, y yo la armé desde un documento nuestro. La vara no es sólo «¿puedo contestarla con lo escrito?», es también **«¿esto sale de algo que él dijo, o de algo que escribimos nosotros?»**.

**Las dos capas, porque una regla en prosa se cumple «casi siempre»:** el prompt que extrae tareas de una reunión lo pide («QUIÉN ES CADA UNO», lib/plan-fathom.ts), y `rotuloDePersona` (lib/tarea-dueno.ts) lo frena en el saneo: un `dueño` o un `dichoPor` queda si es un invitado, quien mira el tablero o un nombre que se dijo en la reunión; un rol no queda nunca, aunque la palabra se diga en la charla. Todo lo demás pasa a «Otra persona». La regla para quien transcribe a mano está en AGENTS.md (punto 2 bis de «Lo que alguien LEE de la pantalla compartida»). Lo que NO está cubierto: una transcripción escrita a mano por un agente, fuera del producto, no pasa por ningún saneo; ahí manda la regla escrita.

**Corregido en:** `docs/referidos.md`, `docs/fuentes-fuera-del-repo.md`, `docs/propuesta-tabs-strategy.md` (la pregunta 6, contestada), la cabecera de `audio-referidos-10oct-transcripcion.md` (fuera del repo) y la memoria `referidos-propuesta`. Nada construido colgaba del supuesto: no hay rol, capa ni pantalla «para el socio»; Strategy y la Ticketera siguen siendo sólo del super admin.

**Vive en:** `docs/referidos.md` · `docs/propuesta-tabs-strategy.md` · `docs/fuentes-fuera-del-repo.md`

## El referido de 97 cuesta US$130,46, no 124,98 (17/10/2026)

- La tab Strategy (`app/admin/estrategia/datos.ts`) usaba r² para «llegó a pagar 2 meses» también en el plan de 97. Con
  el 50% del primer mes, ese mes YA es un pago: «pagó 2 meses» es el mes 2, r y no r² (docs/referidos.md:56, la cuenta
  que manda). Sigue debajo del techo (158,07).
- **Sin hacer:** el 1 a 1 en 10.000 en `app/admin/dev/pricing/modelo.ts`: la corrida de 24 meses (`PROYECCION_24`) está
  escrita a mano con 4.000 en cada fila derivada (caja, ventas, ingresos); cambiar el precio sin rehacer la corrida deja
  filas que no cierran. Y las tareas #771, #783 y #840 del Plan con los precios del 20/09.

*17/10/2026, «Pendientes B3» (`claude4`).*

## El tope de usuarios del plan, al invitar al equipo (23/10/2026)

Esencial permite 1 usuario y Pro 5 (lib/topes-plan.ts → 'equipo.usuarios'). Lo hace cumplir `/api/equipo` en `invitar`,
con la regla pura de lib/tope-equipo-reglas.ts (`topeAlInvitar`).
- **Sólo a quien MaKo le cobra por la pasarela** (`suscripcionDeMakoDe(ws) != null`). El ws1 y los acuerdos a mano también
  tienen capa `completo`, así que la capa sola no alcanza para decidirlo.
- **Lo que no es obvio:** el dueño CUENTA. `equipoDe(ws)` trae a todos los del negocio, suspendidos incluidos, y en Esencial
  el admin solo ya llena el lugar. Invitar a alguien es pasar a Pro.
- **Nadie pierde el acceso:** el tope frena SÓLO invitar. Cambiar el rol, suspender, reactivar y reenviar no lo miran.
- **Si no se puede leer el cobro, no se frena a nadie** (`cobraMako` devuelve false y queda en el log): es mejor una
  invitación de más que frenar a quien paga por un error de la base.
- **En el teléfono, el tope va aparte del error** (`role="status"`, con «Pasar a Pro»): no es un error para reportar, y el
  guardián de «Reportar a Soporte» exige ese botón en todo `role="alert"`.
- **«Pasar a Pro» lleva a `RUTA_CAMBIAR_PLAN`** (lib/topes-plan.ts), nunca a una ruta escrita a mano. Si Planes la mueve,
  todos los carteles de tope la siguen.
tests/equipo-tope-plan.test.ts.

**SIN HACER:** los otros topes de la tabla (leads, funnels, líneas, automatizaciones, landings, dominios, cuentas de cobro)
los hace cumplir el chat de cada área.

## El ORIGEN de la cuenta: de qué landing / funnel vino (23/10/2026)

Contrato: lib/origen-cuenta.ts (`cuenta.origen` en app_settings del ws nuevo; lo lee el onboarding). Lo escribe el
alta por cobro (`altaSiCorresponde` → `guardarOrigenDeAlta`) desde el lead del comprador en ws9.

- **No hay registro propio**: una cuenta nace SÓLO del alta por cobro, del panel o de Partners. El origen sale del
  LEAD (sus UTM y su visitante), no de un formulario de registro.
- **hola-mako.com no cargaba el Pixel de MaKo**: sin visitante (`nqe_visitor_id`) ni `landing_visits` del ws9, la
  cadena visita → agenda → lead → cuenta se cortaba en la primera. Ahora la carga la capa de la landing (Landing.tsx)
  ANTES del Píxel de Meta, que lleva ese visitante como `external_id` (el mismo UID que el Schedule de CAPI).
- **Calendly no recibía nada**: `initInlineWidget` iba sin `utm`. Ahora SCRIPT_DISENO le pasa las UTM de la página y
  el visitante en `utmTerm`, esperando hasta 2,5 s a que el Pixel lo cree en la primera visita.
- **Trampa**: el Ads Manager de MaKo arma los anuncios con `utm_term={{adset.name}}` (lib/meta-ads-create.ts) y el
  webhook de Calendly lee `utm_term` como visitante. La landing NO reenvía el `utm_term` de la URL: manda el visitante.
- **La landing es el PRIMER toque**: la primera visita a una landing de MaKo del visitante (`origenDe` ordena, porque
  las visitas no llegan ordenadas), y si no hay visitas, la página de registro del lead.

Sin hacer: el `Purchase`/`CompleteRegistration` por CAPI al dar de alta (hoy sólo viaja el Schedule con el UID), y
confirmar que el evento de Calendly koncke/asesoria esté atado al ws9 (si no, el lead no nace en la plataforma).

## Quien paga sin Gmail, el «Vincular cobro» de Stripe y el alta que no puede tumbarse por un mail (23/10/2026)

Tres cosas medidas el día del lanzamiento, con dónde vive cada una.

**El diagnóstico obvio era el equivocado, dos veces.**
- *«El comprador sin Gmail no tiene cómo entrar» → sí tiene, nadie lo encuentra.* Correo y contraseña andan desde el 15/10
  y «¿Olvidaste tu contraseña?» deja crear la PRIMERA a quien nunca tuvo una. Lo que faltaba era decirlo: el mail de acceso
  (lib/invitaciones.ts) y la pantalla de después de pagar (app/pagar/[token]/listo/AccesoMako.tsx) decían sólo «entra con
  Google». 10 de los 14 clientes de Mauricio no tienen Gmail. Va en la tanda del primer cobro (`ac21e6b4b`).
- *«Vincular cobro» no mostraba el producto de US$270 de Stripe y «Actualizar» no hacía nada → no era la clave ni un caché:
  MaKo no leía los productos de Stripe, nunca.* «Actualizar» recargaba un catálogo que sólo tenía los productos de MaKo.
  Ya estaba arreglado en main desde la madrugada del 23/10 (`51c89251b`, `5ddbaf1aa`): los precios se leen EN VIVO con la clave
  de cada cuenta (lib/stripe-catalogo.ts), «Volver a leer» los trae de nuevo y una cuenta que no se pudo leer se dice con su
  nombre (nunca «no hay productos»). Se verificó el pedido a Stripe contra el código (GET /v1/prices, `active=true`,
  `expand[]=data.product`, hasta 300) y sus 7 tests. **Sin medir con una clave real**: la primera lectura real es la de Mauricio.

**El alta (lib/alta-cliente.ts) ahora se prueba EJECUTÁNDOLA, no leyendo el fuente** (tests/alta-cliente-conducta.test.ts,
con lib/usuarios.ts de verdad y una base en memoria):
- crea una fila de admin en el negocio nuevo (`rol_ws: 'admin'`, `workspace_id` del negocio, `estado: 'invitado'`) ANTES del mail;
  esa fila ES la invitación (el login lo resuelve por email), y es lo que le faltó a la agencia aprobada con cero usuarios del 28/09;
- si la base no deja crear a la persona, se borra el workspace y no sale ningún mail;
- si el cobro entra y el mail REBOTA, el alta queda firme y `invitacion.enviado` es false (el cobro lo dice: `alta_motivo`);
- **nuevo:** si el mail TIRA (leer el workspace de la plataforma o maquetar pueden fallar antes de mandar, aunque
  `invitarPorEmail` «nunca tire»), antes la excepción subía hasta el aviso del pago con la cuenta ya creada y el cobro
  «pendiente» hasta que el reintento (10 min) la terminaba. Ahora se atrapa en `darDeAltaCliente` y es un mail que no salió.
- probado rompiéndolo: 5 roturas, cada una la cae un test (pie del archivo).

**Sin hacer:**
- El alta de AGENCIA (lib/agencia-habilitar.ts, app/api/admin/agencia/altas/route.ts) llama a `invitarPorEmail` por su
  cuenta: no se midió si un `throw` ahí deja la misma alta a medias. El 25/10 no se vende por ahí.
- Si el mail de acceso no sale, hoy la persona se entera sólo si mira el aviso «Entró un pago» o /admin/cobros: el
  comprador ve «no pudimos mandarte el mail» en /listo, pero nadie le reenvía solo.

### `crearCobro` tiraba con la pasarela a medio camino (23/10, a pedido de la revisión de `vender_plan_mako`)

`crearCobro` escribe la fila y recién después llama a la pasarela. `actualizar` (lib/cobros.ts) **tira** ante un error de la base,
y los dos `actualizar` de después de la pasarela estaban sin red: (a) la pasarela rechaza y la base falla al anular → `crearCobro`
TIRABA en vez de decir el motivo, y la fila quedaba `pendiente` sin link; (b) la pasarela crea el checkout y la base falla al guardar
su link → tiraba, el checkout quedaba creado con su `ref` perdido. «Un link sin su fila» no puede pasar (la fila va primero);
lo real era la fila sin link y el checkout sin rastro.
- *Dónde dolía:* el link de una CUOTA. Un `pendiente` sin url es «el link vivo» de esa cuota (`cuotaParaLink` lo devuelve como
  `yaEstaba`): en Stripe `urlParaPagar` genera la sesión al abrirlo, en **Mercado Pago un pendiente sin url es un link muerto**
  (`no_disponible`) y la cuota no admite otro hasta anularlo. En una venta de plan, cada reintento deja otro pendiente huérfano.
- *Ahora:* `cerrarCheckoutDelCobro` (lib/cobros-reglas.ts) no tira. Rechazo → anula con el motivo (si la base falla, lo loguea) y
  devuelve el error de la pasarela; checkout creado → guarda, reintenta UNA vez; si sigue sin poder, **anula la fila CON el `ref` y
  la url** (la reconciliación lee los anulados con `proveedor_ref`: un pago por ese link entra por «pago por un link anulado», 4b) y
  dice «intenta de nuevo». No se entrega un link que la fila no conoce. Además lo CIERRA en la pasarela (`cerrarLinkEnLaPasarela`, el mismo cierre de `anularCobro`): el refutador marcó que, sin eso, una suscripción de MP autorizada seguiría cobrando. Y el anulado lleva `soloSi: pendiente/fallido`, para no pisar un pago que se asentó en el medio.
- *Sin hacer:* una función que muere ENTRE el insert y la pasarela (o entre ella y el guardado) sigue dejando un `pendiente` sin url;
  para Mercado Pago, `urlParaPagar` no regenera el checkout como hace con Stripe (lib/cobros.ts, rama `mercadopago`). Es raro (un corte de
  la función, no un error de la base) y queda el rastro; regenerarlo con `idemCobro(id, 0)` sería la salida.
- *Vive en:* lib/cobros-reglas.ts (`cerrarCheckoutDelCobro`) · lib/cobros.ts (`crearCobro`) · tests/cobro-checkout-cierre.test.ts.

**Vive en:** lib/alta-cliente.ts · tests/alta-cliente-conducta.test.ts · lib/stripe-catalogo.ts · app/crm/CobroDeEtapaModal.tsx.

## La suscripción de MaKo de punta a punta: pagar, quedar adentro, deber y volver (23/10/2026)

*Pedido de Martín (audios del 22/10, para el domingo 25/10): «si alguien paga se ingresa automáticamente a la app con el email
de bienvenida y si alguien no paga que se le expulse de la app... le tiene que quedar una deuda pendiente... y si te querés dar
de baja... un descuento». Rama `suscripcion-mako-2310` (chat «Suscripción y Partners», `claude3`).*

### El alta automática tenía UN disparador, y era a mano

**Síntoma:** «si alguien paga entra solo» ya estaba hecho desde el 11/10 (`altaSiCorresponde`), y nadie podía pagar solo: el
único camino que crea un cobro con `alta_capa` era «Vender un plan» de /admin/cobros, con el precio tipeado por el super admin. El
«Botón de pago» de las landings lo rechaza a propósito. **Regla:** el checkout público es /planes → `POST /api/planes/comprar`
(lib/compra-plan.ts): el plan, la capa y el precio salen de lib/planes-mako.ts (setting `planes.mako` de la plataforma), nunca
del pedido. **Vive en:** `lib/planes-mako.ts` · `lib/compra-plan.ts` · `app/planes/` · `tests/compra-plan.test.ts`.

### El diagnóstico obvio era el equivocado: «activa y pagada» daba al día PARA SIEMPRE

**Síntoma:** con el corte del 17/10 prendido, un negocio cuya renovación rechaza la tarjeta todos los meses nunca se pausaba.
**Causa:** `vigenciaDelLugar` miraba el ESTADO del cobro (`pagado` + `activa`), y una renovación rechazada no cambia ninguno de
los dos: sólo deja un `motivo`. El corte sólo veía bajas, devoluciones y renovaciones de agencia. **Regla:** la vigencia es la
COBERTURA: cada mes cobrado (una cuota pagada; un cobro único de deuda vale `meses`) extiende un mes; un pago que llega hasta
62 días tarde paga el período que se debía (sin correr la fecha); con la suscripción activa y lo cubierto terminado hay MORA
(2 días sin aviso, después el aviso en la esquina) y a los 7 días VENCIDO por impago con la deuda en ciclos. **Y antes de pausar
por impago se le pregunta a la pasarela** (`confirmarImpago`): una renovación cobrada cuyo aviso se perdió se asienta y no se
corta; si la pasarela no contesta, tampoco. El cliente de agencia sigue con sus reglas del 17/10 (su mes corre desde el fin del
onboarding, no desde el pago). **Vive en:** `lib/plan-acceso-reglas.ts` · `lib/plan-acceso.ts` · `lib/plan-deuda.ts` ·
`tests/plan-acceso.test.ts`.

### Pagar la deuda aparte mientras la pasarela reintenta es cobrar dos veces

**Regla:** Stripe con la suscripción viva → la FACTURA ABIERTA (`hosted_invoice_url`), que al pagarse entra como renovación; si
Stripe no contesta, NO se abre un cobro aparte (Smart Retries puede cobrarla después). Mercado Pago reintenta cada cuota 4 veces en
10 días y da de baja la suscripción con 3 cuotas rechazadas: dentro de esos días, «cambia la tarjeta en Mercado Pago»; después, un
cobro único por los meses debidos, atado al negocio (`alta_ws`) ANTES de devolver el link. **Vive en:** `lib/plan-deuda.ts`
(`pagarDeuda`) · `app/api/plan/pagar` · `app/cuenta-pausada`.

### Los tres defectos de la revisión del 17/10, cerrados

`ya_tenia_cuenta` quedaba fuera del corte (ahora se ata al negocio del que ese email es admin, si es uno solo); un primer pago
devuelto con la suscripción activa pausaba a quien paga (la cobertura no corta por un reembolso mientras la pasarela cobra); las
cuotas se leían sin paginar (PostgREST corta en 1.000 sin error: ahora de a tandas con `range`).

### La retención: Stripe vuelve sola al precio, Mercado Pago no

Un cupón `repeating` de Stripe termina solo. El monto de un preapproval de MP queda cambiado para siempre: el cron lo restaura
cuando se cobraron las cuotas con descuento (contando las de DESPUÉS de aceptar: la del mismo día pudo cobrarse a precio de lista).
La oferta se reclama con compare-and-set desde null: una vez por negocio. **Vive en:** `lib/retencion-plan.ts`.

### Lo que quedó SIN hacer (23/10), con el archivo

| Qué | Dónde |
|---|---|
| **Prender el corte** (`CORTE_DE_ACCESO_PRENDIDO`): con su revisión adversarial y la mig 0330 aplicada | `lib/plan-acceso-reglas.ts` |
| Los planes en ARS/MXN: sin `preciosLocales`, Mercado Pago no se ofrece en /planes (nunca se inventa una tasa) | setting `planes.mako` del ws de la plataforma |
| Medir con claves de PRUEBA: el PUT del monto de un preapproval de MP, `hosted_invoice_url` con la suscripción `past_due`, y la factura de $0 | `lib/pasarela-plan-api.ts` |
| Una factura de $0 (saldo o cupón del 100%) asentaría US$47 de cash: `montoUsdDeLaCuota` cae al monto del cobro con 0 | `lib/cobros-reglas.ts` (del chat Cobros) |
| En Mercado Pago (ARS) una cuota con descuento de retención se asienta con el USD de lista | `lib/cobros-reglas.ts` (`montoUsdDeLaCuota`) |

### La revisión adversarial del 23/10: lo que cambió el diseño (21 defectos, 7 altos)

- **El diagnóstico obvio era el equivocado: «la cobertura encadenada sigue a la pasarela».** No la sigue: un mes devuelto, los
  días 29-31 o una reactivación corrían la fecha, y le daba mora a quien pagaba puntual. **Regla:** la mora la dice la PASARELA
  (el aviso de la renovación fallida, `PREFIJO_RENOVACION_FALLIDA`, que borra la renovación que entra), anclada en el último
  pago de ESA suscripción (`proximoCobro`). La cadena queda sólo para «hasta cuándo cubre» después de una baja.
- **Atar una compra a un negocio por el email es una puerta para pausar negocios ajenos** (se compraba un plan con el email
  del admin de otro, el ws1 incluido, y se dejaba fallar la renovación). Quien vuelve reactiva desde adentro de su cuenta.
- **Devolver el link vivo de un email a un pedido anónimo entrega la credencial del cambio de email del acceso.**
- **Una factura de $0 (saldo, cupón) no es plata**: no se asienta al reparar, pero cubre el mes.
- **Reparar desde un pago no puede volver a reparar**: `confirmarImpago` → `aplicarPagoAprobado` → `revisarAccesosPorPago`
  es un círculo si la cuota no se puede asentar; sólo la vuelta del cron repara.
- **Sin hacer (conocido):** /planes con el email de quien ya es cliente cobra y queda `ya_tenia_cuenta` (lo resuelve el super
  admin; preguntarlo antes sería un oráculo de emails); el cupón de retención de Stripe reemplaza un descuento que ya tuviera;
  la deuda en MP con la retención a mitad de precio se calcula a precio de lista. El informe: la carpeta de notas del Cerebro,
  `revision-suscripcion-2310.md`.

### La segunda revisión (la baja por plan, 23/10): las trampas

- **Un timeout de la pasarela (status 0) puede significar que SÍ se aplicó.** Nunca se da por fallido: la marca queda en
  «error» y el cron relee la pasarela y concilia (`conciliarRetenciones`): «aplicada» con sus escrituras, o se libera. Si no,
  MP quedaba pausado o al 50% para siempre.
- **Comparar `aplicadaAt` (UTC) con `fecha_pago` (fecha local del negocio) corre un día**: el 50% podía durar 3 meses en vez
  de 2. Se cuenta desde una fecha de la PASARELA (el próximo cobro de MP al aceptar), con margen.
- **«Un mes» de pausa es un CICLO de cobro, no 30 días**: hasta pasado el próximo cobro (Stripe el fin del período, MP
  `next_payment_date`). Con 30 días fijos se salteaban cero o dos cobros.
- **Sin retención válida en el plan, no hay oferta** (recibía el 50% por defecto, el Esencial incluido).
- **En mora no hay ofertas**: la pausa borraba el mes adeudado y «bajar» reescribía la deuda. Primero «Pagar y volver».
- **La pausa en Mercado Pago se reanuda un día antes del FIN del ciclo cubierto**, no a los 2 días del cobro salteado (eso sirve
  para Stripe, que anula la factura con `void`): si MP cobra la cuota atrasada al reactivar o recalcula `next_payment_date`
  desde hoy, cobraba justo el ciclo salteado. Al reanudar se relee `next_payment_date` y se avisa si quedó en el pasado.
- **Sin hacer:** la conciliación de un DESCUENTO de Stripe da «tomó» con cualquier descuento de la suscripción (comparar el
  cupón); la baja durante una pausa deja ese mes sin pagar (R7); bajar de Pro a Esencial es un 51% de descuento hasta
  que los topes de Esencial se cumplan (R8). La tabla: C:/dev/cerebro-herramientas/revision-retencion-2310.md.

## «Pasar a Pro»: la diferencia se cobra ahora y, si no pasa, nada cambia (23/10/2026)

lib/subir-plan.ts: Stripe con `always_invoice` y `error_if_incomplete`. Mercado Pago, el monto de Pro desde el
próximo período con Pro en el acto. Hay un reclamo `plan.subida` antes de la pasarela. Lo que encontró la revisión
adversarial y quedó arreglado:
- **Sin `plan_mako`** (un acuerdo armado a mano), «subir» a 97 podía BAJAR lo que pagaba. Ahora lo de hoy es
  `cobros.monto`, y sólo se sube desde la capa `completo`.
- **Suscripción en pausa o en mora:** se rechaza. Pausada era Pro gratis; en `past_due`, pagar el prorrateo la dejaba
  activa con la renovación abierta.
- **Retención viva sin restaurar:** se rechaza, porque el cron la devolvía al precio de antes.
- **Un timeout o un 5xx no es «sigue igual»:** se vuelve a leer la suscripción.
- **La agencia o el super admin mirando otro negocio no cobran a la tarjeta del dueño** (`estaImpersonando`).

**Sin hacer** (de la misma revisión):
- La factura de prorrateo (`subscription_update`) no está en `FACTURAS_DE_PAGO`: la diferencia no entra al cash del
  CRM de la plataforma. Además, un `invoice.payment_failed` no se filtra por `billing_reason`, así que si Stripe lo
  manda al fallar la subida, `aplicarPagoFallido` diría «Renovación fallida». Está en lib/cobros-eventos.ts.
- Subir otra vez en el mismo período después de una retención «bajar» cobra la diferencia dos veces.
- En Mercado Pago no se lee el estado del preapproval antes de subir (pausado o en mora).
- Sin medir con claves de prueba: si `error_if_incomplete` emite `invoice.payment_failed`, y si Mercado Pago acepta
  subir el monto sin que el comprador lo vuelva a autorizar.

**Vive en:** lib/subir-plan.ts · lib/subir-plan-reglas.ts · lib/pasarela-plan-api.ts (`subirPlanStripe`) ·
app/configuraciones/plan · tests/subir-plan.test.ts.

## Sin pasarela, el checkout era un callejón con cara de checkout (23/10/2026)

**Síntoma:** con la pasarela de MaKo sin conectar (ws 9), /planes decía «Pagas por mes y entras en el acto» y «Empezar con…»
en cada plan; /planes/<plan> recién ahí descubría que no había cómo cobrar y decía «Escríbenos», sin a dónde. Y todo cartel
de tope («Pasar a Pro») lleva a «Tu plan», que sólo ofrece la subida a quien paga Esencial POR LA PASARELA: hoy, nadie.
**Causa:** lo cobrable se decidía en el ÚLTIMO paso (`ofertaDelPlan`); el listado y «Tu plan» nunca lo preguntaban.
**La regla:** un botón de compra se decide con la MISMA cuenta que el checkout (`ofertasDeLosPlanes`: algún precio en la
moneda de una pasarela conectada); sin eso, la salida es la agenda (`AGENDA_MAKO`) con las UTM. Si no se pueden leer las
pasarelas, NO es cobrable: una agenda de más es un llamado, un pago que no existe es un callejón. En «Tu plan», a Esencial
sin la subida en el acto se le ofrece Pro por llamada (`proPorLlamada`).

**La trampa:** Calendly sólo guarda `utm_source/medium/campaign/content` (y `utm_term`, que la VSL ya usa para su uuid), así
que por la agenda se PIERDEN el slug de la landing, el avatar, la funcionalidad y el fbclid. El código de MaKo Partners
también se perdía; ahora viaja como UTM cuando no hay campaña (docs/hallazgos-partners.md, «Una venta POR LLAMADA»). Y la
agenda de MaKo hoy no entra al CRM del ws 9 (docs/hallazgos-integraciones.md): las UTM quedan sólo en Calendly.

**Sin hacer:** aplicar el crédito de MaKo Partners (relevo, punto 5): /mako-partners y /partners/referidos dicen «se
descuenta de tus próximos meses» y nada lo descuenta. Sin pasarela no nace ningún crédito (nace del segundo mes pagado
del referido), así que no muerde el 25/10. La VSL repite el link de la agenda (`app/vsl/Landing.tsx`, `CALENDLY_URL`).

**Vive en:** lib/compra-plan-reglas.ts · lib/compra-plan.ts (`ofertasDeLosPlanes`) · app/planes/ · lib/subir-plan-reglas.ts
(`proPorLlamada`) · app/configuraciones/plan · tests/planes-sin-pasarela.test.ts.

## El primer cobro real de un plan de MaKo: la revisión antes del lanzamiento (23/10/2026)

El lanzamiento del 25/10 es la primera vez que este camino corre con claves reales (0 cobros en producción). Revisión
adversarial de 57 agentes (wf_a4441b10-5ea, chat «Cobros»): cinco recorridos (conectar en el ws9, comprar con Stripe,
comprar con Mercado Pago, el alta, el mes siguiente) y escépticos por hallazgo. Ninguno quedó en «bloquea»; lo que pega
el domingo se arregló en la rama `cobros-lanzamiento-2310`. La prueba de humo para Martín: [prueba-humo-cobro-mako.md](prueba-humo-cobro-mako.md).

⚠️ **Dos diagnósticos obvios eran los equivocados:**
- **«La versión de Stripe está inventada».** `STRIPE_VERSION = '2026-09-30.endive'` nunca corrió con claves y parecía un
  bloqueo total. Es la vigente: docs.stripe.com/upgrades la usa en todos sus ejemplos (leído el 23/10).
- **«Quien paga sin Gmail no puede entrar NUNCA»** (la sección de más arriba). Ya no es cierto: desde el 15/10 hay correo y
  contraseña, y «¿Olvidaste tu contraseña?» deja crear la primera (la automatización #251 está prendida en el ws9, medido
  por el Cerebro). El problema real era que NADIE LO DECÍA: el mail de acceso y /listo sólo hablaban de Google, y 10 de
  los 14 clientes de Mauricio no tienen Gmail (lib/curso-acceso.ts). Arreglo: dos frases.

**Lo que no se ve leyendo el código, y la regla que queda:**
- **Reembolsar no corta una suscripción.** Stripe y Mercado Pago devuelven el pago y siguen cobrando; MaKo asienta la
  renovación como plata nueva, a propósito. /admin/cobros sólo tenía «Reembolsar», y la ficha del CRM (donde estaba
  «Cancelar») no existe en el ws9. Ahora la casilla «Cortar también la suscripción» viene marcada y corta ANTES de
  devolver, y hay un «Cortar la suscripción» propio (también con el primer pago ya devuelto). Regla en AGENTS.md.
- **El alta no mira el modo del cobro**: con claves de prueba conectadas en el ws9, cualquiera sacaba una cuenta real con
  la tarjeta 4242. La guarda no va en el alta (Martín necesita la cuenta de prueba para la prueba de humo) sino en lo que
  se OFRECE: `ofertaDelPlan` saca las pasarelas en modo prueba salvo para el super admin. Regla en AGENTS.md.
- **Una firma para dos avisos.** Hay un solo `STRIPE_WEBHOOK_SECRET` por cuenta y dos avisos en Stripe (el real y el de
  prueba), cada uno con su firma: una `sk_test` pegada encima de la `sk_live` guardaba la de prueba, y cada pago real daba
  401 hasta volver a la real. Ahora se rechaza («desconecta primero»). Al revés (de prueba a real) es el camino normal.
- **Los avisos de suscripción de Mercado Pago pueden llegar sin `user_id`**, y sin él la ruta no sabe de qué negocio son:
  los anota «sin-workspace» y contesta 200 (MP no reintenta). El preapproval no acepta `notification_url`, así que el único
  lugar para el `?u=<cuenta>` es la dirección que se pega en el panel: la tarjeta ahora la muestra completa. *Falta
  confirmarlo con un aviso real* (si MP manda el cuerpo de suscripción con `user_id`, el `?u=` sobra y no molesta).
- **El setting `planes.mako` reemplaza la lista ENTERA**, y nada en la app lo escribía: con sólo Mercado Pago conectada,
  /planes no vendía porque no había dónde cargar el precio en pesos. La tarjeta «Planes en Mercado Pago» de /admin/cobros
  lo escribe con todos los planes, leídos con `getSettingEstricto`: con `getSetting` un error de lectura se leía como «no
  hay setting» y se habrían pisado los planes cargados con los de fábrica.
- **«Le llegó el acceso» sólo si el mail salió.** Con Resend caído el alta queda 'hecha' y el fallo vive en `alta_motivo`;
  el aviso y /listo leían sólo el estado. El prefijo es UNA constante (`PREFIJO_MAIL_NO_SALIO`) que escriben dos lugares
  y leen dos.
- **Un alta cortada se reintentaba como «Ya tenía cuenta»** sobre la cuenta que ella misma creó (la función muere entre
  crear al usuario y anotar 'hecha'). El reclamo compare-and-set evita dos altas a la vez, no una repetida. Ahora el
  reintento reconoce su cuenta (`cuentaDeUnAltaCortada`: creada por un pago de esa pasarela, después del cobro, y sin otro
  cobro que la tenga).
- **«Ya tenía cuenta» no tenía salida**: el alta no le cambia la capa a nadie a ciegas (bien), pero tampoco había con qué
  atar el cobro a esa cuenta. «Darle el plan a su cuenta» lo hace, sólo si el correo es el ADMIN de un negocio que ningún
  otro cobro tiene.
- **La guía de la clave restringida de Stripe** pedía menos permisos de los que el código usa (Coupons para la retención,
  Disputes para los contracargos, Prices/Products para «Vincular cobro»). Conectar sólo prueba `GET /v1/account` y crear el
  aviso, así que una `rk_` armada con la guía vieja conectaba bien y fallaba después con un 403.

**Lo que quedó SIN hacer, con el archivo donde vive** (lo de noviembre tiene que estar antes de la primera renovación,
~25/11):
| Qué | Dónde |
|---|---|
| Pagar la deuda de una suscripción que la pasarela dio de baja no la cierra: la mora vuelve, «Reactivar» se traba y «Pagar» abre otro cobro (antes de prender el corte) | `lib/plan-acceso-reglas.ts:221` · `lib/compra-plan.ts` (`reactivarPlan`) |
| Las renovaciones dependen sólo del aviso: ningún cron recupera una perdida | `lib/cobros.ts` (`reconciliarCobros`) |
| Con el corte apagado la deuda deja de verse a los 7 días, nunca en el teléfono, y nadie avisa por mail | `lib/plan-deuda.ts:229` |
| Los «meses gratis» de MaKo Partners no los descuenta ninguna pasarela | `lib/partners-programa.ts:186` |
| «Reembolsar» una suscripción devuelve el PRIMER pago, no el último; y una suscripción con el primer pago devuelto y viva deja de verse en «Tu plan» | `lib/cobros.ts` (`reembolsarCobro`, `suscripcionDeMakoDe`) |
| El cron mira sólo los 50 cobros pendientes más nuevos | `lib/cobros.ts:1406` |
| Un rechazo que llega después del aprobado pinta «Renovación fallida» en un primer pago | `lib/cobros.ts` (`aplicarPagoFallido`) |
| Dos checkouts abiertos del mismo comprador se pueden pagar los dos; /listo no tiene plazo ni dice «no vuelvas a pagar» | `lib/compra-plan.ts:137` · `app/pagar/[token]/listo/page.tsx` |
| El link de un cobro creado con la clave de prueba abre un checkout real después de pasar a la real | `lib/cobros.ts:553` |
| En Stripe no hay dónde cambiar la tarjeta (hoy: los mails de Stripe) | `lib/plan-deuda.ts:152` |
| Los negocios que nacen de una compra quedan fuera del 2FA obligatorio | `lib/alta-cliente.ts:66` |
| El aviso de la venta nombra el plan por la capa (un Pro dice «plan Agencia») | `lib/cobros.ts` (`lineaDelAlta`, `asentarAlta`) |
| (Corte) `cobrosDeLugares` sin paginar | `lib/plan-acceso.ts:59` |
**Vive en:** `lib/cobros.ts` · `lib/compra-plan.ts` · `lib/cobros-conexion.ts` · `app/admin/cobros/` · `app/api/integraciones/credencial/route.ts` · `tests/cobro-lanzamiento.test.ts`.

## El área y la bitácora de Cobros apuntan a donde ya NO vive «vender un plan» (24/10/2026, Cerebro › Integración)

Lo encontró la revisión del tren de 24 puntas, y es la trampa de «una ruta que apunta a
la nada no rompe nada, y por eso es cara». El cuerpo de vender un plan se mudó a
`lib/vender-plan.ts` (`venderPlan`) y `app/admin/cobros/actions.ts:34-40` quedó
delegando, pero:

- la bitácora (`app/admin/dev/payment-gateway/bitacora.ts:57`) sigue diciendo
  «`app/admin/cobros/actions.ts` — vender un plan: el lead del comprador + `crearCobro`
  en `wsSuperAdmin()`»;
- el encabezado de la propia action (`app/admin/cobros/actions.ts:9`) sigue diciendo que
  «busca o crea el lead del comprador y llama a `crearCobro`»;
- y el `vive[]` del área `payment-gateway` (`app/admin/dev/areas.ts:952-960`) **no nombra**
  `lib/vender-plan.ts` ni `lib/vender-plan-reglas.ts`.

O sea que el próximo agente que abra Cobros no ve dónde vive el camino que crea el cobro
con `altaCapa`. La nota de esa misma área lo pide: «quien escribe la ruta actualiza el
área, o el área miente sola» — y la rama de Zernio sí actualizó la suya
(`areas.ts:1084`), así que la disciplina existe y se saltea de a una.

⚠️ **Y no lo caza ningún test, a propósito y sin que esté escrito:**
`tests/dev-areas.test.ts` chequea **declarado → existe** (que cada ruta del `vive[]` esté
en el disco) y NO chequea **existe → declarado**. Es la misma asimetría que AGENTS.md ya
nombra para el barrido de áreas: «una ruta que falta no da error, da un punto ciego». La
pregunta que lo encuentra no es «¿el área miente?» sino **«¿qué archivo caliente no lo
declara ninguna área?»**, cruzando `git log --name-only` contra la unión de los `vive[]`.

**Lo que queda SIN hacer:** sumar los dos módulos al `vive[]` del área, corregir la
bitácora y el encabezado de la action.

**Vive en:** `app/admin/dev/areas.ts:952-960` · `app/admin/dev/payment-gateway/bitacora.ts:57` · `app/admin/cobros/actions.ts:9,34-40` · `lib/vender-plan.ts`

## Los tres bloques de /planes: lo que se ve tiene que poder comprarse así (24/10/2026)

Martín: «quiero ver los 3 bloques de pricing típicos que tiene toda app». /planes muestra MaKo Esencial (US$47), MaKo Pro
(US$97, destacado) y el **MaKo Acelerador** (US$1.500 en 3 cuotas, docs/ofertas-mako.md §3), con «Compara los planes» abajo.
- **El tercer bloque es el Acelerador, no la Continuidad.** La Continuidad (US$297) se ofrece al terminar el programa; al
  lado de Esencial y Pro un desconocido no sabría qué es. El Acelerador no es un `PlanMako`: no tiene capa ni pasa por la
  pasarela, se vende por llamada (`PROGRAMA_ACELERADOR`, lib/planes-mako.ts), como el «hablar con ventas» de cualquier SaaS.
- **El anual NO se muestra**: `precioAnualUsd` existe, pero el checkout cobra por mes; la vitrina no dice un precio que no se
  puede comprar. Cuando el checkout cobre anual, se suma el selector.
- **Los números de la tabla salen de `TOPES` y `TABS_SOLO_PRO`** (lib/topes-plan.ts, vía lib/planes-comparacion.ts), nunca a
  mano; y cada columna se elige por la CAPA del plan, no por su id (un plan del setting `planes.mako` con otro id no queda
  vacío). **La trampa:** el candado de Pro y los topes se hacen cumplir SÓLO a quien paga Esencial POR LA PASARELA
  (`esEsencialPorPasarela`, lib/plan-esencial-reglas.ts). Un Esencial vendido por llamada hoy recibe MÁS de lo que dice la
  tabla, nunca menos; si hay que cerrarlo, es ahí.
- **En el teléfono la comparación muestra las cuatro columnas a la vez** (encabezados sin «MaKo», tabla compacta): con el
  nombre entero sólo entraba Esencial y Pro y el Acelerador quedaban detrás de un deslizar que nadie sabía que existía.
- **Mirar la vitrina sin levantar la app** (que en local escribe en la base de producción): el dibujo vive en
  app/planes/Vitrina.tsx, sin datos ni red. Un `renderToStaticMarkup` con `PLANES_MAKO_DEFAULT` desde un archivo temporal
  DENTRO del worktree (desde el scratchpad no encuentra node_modules; tsx compila el JSX clásico: `globalThis.React = React`
  antes de importar) y una captura con la Playwright de Python sobre el Chrome instalado (`channel='chrome'`: el Chromium de
  ms-playwright no arranca, «spawn UNKNOWN»).

**Vive en:** app/planes/page.tsx · app/planes/Vitrina.tsx · app/planes/estilo.ts · lib/planes-comparacion.ts ·
lib/planes-mako.ts (`PROGRAMA_ACELERADOR`) · tests/planes-tres-bloques.test.ts.

## Sin Calendly: las columnas de precios en la landing, y el pedido sin pago en el CRM (24/10/2026)

Martín: «No voy a usar Calendly, te dije que pongas las columnas de pricing de las ofertas». **El diagnóstico obvio era el
equivocado:** el Cerebro y este chat venían pidiendo «conectá Calendly» (la agenda era la salida sin pasarela); lo que
faltaba era DÓNDE hacer clic: los tres precios en la página de venta, con un botón cada uno
(docs/estrategia-financiera-mako.md, «Qué hacer el lunes», punto 1).
- **La landing de venta** (la raíz y /vsl/<slug>) monta las columnas donde estaba la agenda: `#cal-embed` en la de siempre,
  `[data-calendly]` en la del Web Generator, a la que se le saca el atributo ANTES de que corra su script (si no, igual carga
  Calendly); sin agenda en el diseño, antes del pie (app/vsl/Landing.tsx, `montarPrecios`). Los planes llegan del servidor
  con si se cobran en línea (`planesParaLanding`): el botón es el MISMO que /planes («Empezar» sólo con cobro detrás).
- **Sin pasarela, el botón lleva a /planes/<plan>**, y ahí un formulario de nombre, email y WhatsApp deja el pedido como lead
  en el CRM de MaKo con el plan, la landing, las UTM y el código de partner en su historial, más un aviso a equipo@
  (`pedirPlanSinPasarela`). Es MEJOR atribución que la agenda: el partner viaja en el mismo pedido (la cookie de /r gana).
- **El Acelerador nunca pasa por la pasarela** (un merchant of record no toma un servicio con llamadas: estrategia
  financiera §1.7): /planes/acelerador es siempre el pedido.
- **Quedó obsoleto:** conectar Calendly al CRM de MaKo para vender (docs/relevo/suscripcion.md, punto 3) y las UTM del partner
  en la agenda (cfcf01abd): se sacaron `AGENDA_MAKO` y `agendaConOrigen`.

**Vive en:** app/vsl/PreciosLanding.tsx · app/vsl/Landing.tsx · app/planes/[plan]/QuieroPlan.tsx · lib/compra-plan.ts
(`pedirPlanSinPasarela`, `planesParaLanding`) · lib/compra-plan-reglas.ts · tests/planes-sin-pasarela.test.ts.

## Planes que venden: el lenguaje interno estaba en los DATOS, y dos ofertas que el código no tiene (24/10/2026, noche)

Martín: «La sección de planes no se entiende para nada... Lo hiciste con lenguaje interno, las personas no saben que es "Ops
Center"... Tienes que VENDER... el acompañamiento debe tener mas beneficios y verse diferencial... El personalizado tiene que
tener un factor de PROMESA de resultados, ya no solo software». Chat «Planes», cuenta 5.

- **La jerga no estaba en la pantalla: estaba en los datos** (`incluye` y `resumen` de `PLANES_MAKO_DEFAULT`, y los nombres
  de las filas de lib/planes-comparacion.ts). Se dibujan en /planes, en la landing de venta y en /planes/<plan>; cambiar sólo la
  vitrina dejaba la landing igual. Ahora lo que incluye dice lo que la persona CONSIGUE, con los números de `TOPES`, y la guarda
  (`INTERNO`, tests/planes-tres-bloques.test.ts) lee el render de las dos pantallas y los datos. **Ojo:** el setting
  `planes.mako` de la plataforma pisa los planes enteros; medido el 24/10, en producción NO hay fila. Si alguien lo carga con el
  texto viejo, la jerga vuelve sin que ningún test lo vea (la guarda mira los de hoy).
- **Una guarda de palabras tiene que distinguir la tab de la palabra común:** «Cobros» (la tab) no va; «tus cobros» sí. Las
  tabs que también son palabras van con mayúscula y sin `i` (`TAB_CON_MAYUSCULA`).
- **/planes y la landing eran dos dibujos de los mismos planes** (Vitrina.tsx y PreciosLanding.tsx, cada uno con su CSS):
  ahora son UNA pieza (app/planes/Tarjetas.tsx). Sus clases llevan `mkpl-`: adentro de una landing del Web Generator conviven
  con el CSS del diseño, y un nombre genérico se pisa.
- **«El acompañamiento» es el Acelerador, y se veía como «Pro más caro»** porque la tarjeta mostraba 5 de los 9 renglones de
  docs/ofertas-mako.md §3. Ahora va en un bloque oscuro con «Con acompañamiento» (el «Dominate» de ClickFunnels) y todo lo que
  trae; nada nuevo inventado.
- **«El personalizado» NO existe en el código.** La pista es la escalera de agosto: un 1 a 1 de US$4.000 al lado del grupal de
  1.500 (docs/embudo-y-high-ticket.md, área «GTM: Oferta y precios»), que nunca entró a /planes; docs/ofertas-mako.md (23/10)
  no lo tiene. **Resuelto el 25/10** (el Cerebro, con Martín pidiendo «no hagas preguntas»): el personalizado ES el
  Acelerador, con promesa y garantía. Ver la entrada que sigue.
- **La «garantía de 14 días en los planes» de docs/ofertas-mako.md contradice lo publicado:** /reembolsos dice que el mes
  pagado no se devuelve, y la del programa es «la que acordamos contigo en la llamada». No se puso en la vitrina. Decidida el
  25/10 (14 días el mensual, 30 el anual): cambian /reembolsos y la vitrina juntas.

**Sin hacer:** «Tu plan» (app/configuraciones/plan) es del
chat de Settings y no se tocó. **Vive en:** app/planes/Tarjetas.tsx · app/planes/Vitrina.tsx · app/vsl/PreciosLanding.tsx ·
lib/planes-mako.ts · lib/planes-comparacion.ts · tests/planes-tres-bloques.test.ts · tests/planes-sin-pasarela.test.ts.

## El Acelerador con promesa, garantía de entrega y el diagnóstico como puerta (25/10/2026)

Decidido por el Cerebro sobre docs/como-venden-otros.md §6c (memoria `decisiones-venta-25-10`). Chat «Planes», cuenta 5.

- **Una promesa no es una garantía, y la tarjeta tiene las dos por separado.** `PROGRAMA_ACELERADOR.promesa` es un resultado
  con plazo («En 90 días, tu embudo andando…») y NO devuelve nada; `garantia` es sobre los ENTREGABLES de la semana 1 («si tu
  embudo no está armado, te devolvemos la cuota»). Una garantía de resultado («si no vendes…») recién cuando haya datos para
  medirla. La guarda lo lee en las dos frases: la promesa no puede decir devolver/garantía/plata, la garantía no puede decir
  vender/facturar/llamadas.
- **La garantía se escribe UNA vez.** La tarjeta y /reembolsos §2 leen la misma constante, y el test compara el render de las
  dos. Antes /reembolsos decía «la que acordamos contigo en la llamada»: una frase suelta en cada página es cómo se terminan
  contradiciendo.
- **El tope de horas es un número de producto, no un dato.** `HORAS_SEMANA_1 = 10` sale del molde de Mercately (US$1.499 con
  tope de 10 horas), no de Martín. Si él lo cambia, se cambia ahí y lo dicen la tarjeta y /reembolsos.
- **La puerta reusa el diagnóstico de fase, no escribe otro** (`PREGUNTAS_DE_LA_PUERTA` = facturación, inversión y cuello de
  lib/fase-diagnostico.ts): son los tramos con los que docs/embudo-y-high-ticket.md §6 califica la llamada. El test exige el
  MISMO objeto, no una copia. Se guarda el TEXTO de la opción en el historial del lead y en el mail: un índice en el CRM no dice
  nada, y si alguien reordena las opciones, el historial mentiría.
- **Trampa: esos tramos dicen «$» y son dólares.** En Argentina «$3.000» se lee pesos. La puerta lo aclara arriba («con montos
  en dólares»); el onboarding, que usa las mismas preguntas, sigue sin aclararlo (lib/fase-diagnostico.ts, área Onboarding).
- **Un diagnóstico a medias no pierde el lead:** `diagnosticoLimpio` da null y el pedido entra igual. La puerta es para la
  llamada, no un filtro que rebote a quien quiere comprar.
- **El campo de WhatsApp del pedido no tenía estilo:** el CSS de /planes/<plan> cubría `type=text` y `type=email`, y el WhatsApp
  es `type=tel`. Se veía distinto a los otros dos desde el 24/10.

**Sin hacer:** la fase NO se calcula del pedido (el diagnóstico de fase pide 6 respuestas y la puerta trae 3), así que no hay
compuerta automática «Fase 1 → no se le ofrece el programa»: la lectura es de quien hace la llamada. **Vive en:**
lib/planes-mako.ts (`PROGRAMA_ACELERADOR`, `HORAS_SEMANA_1`) · app/planes/Tarjetas.tsx · app/reembolsos/page.tsx §2 ·
lib/compra-plan-reglas.ts (`PREGUNTAS_DE_LA_PUERTA`, `diagnosticoLimpio`) · lib/compra-plan.ts (`pedirPlanSinPasarela`) ·
app/planes/[plan]/QuieroPlan.tsx · tests/planes-tres-bloques.test.ts · tests/planes-sin-pasarela.test.ts.

## El anual, la garantía de 14/30, los pesos y el media buyer de Esencial (25/10/2026)

Decidido por el Cerebro (memoria `decisiones-venta-25-10`), sobre docs/como-venden-otros.md §6c. Chat «Planes», cuenta 5.

- **El anual se muestra y SIEMPRE se pide.** El checkout cobra por mes: con pasarela, «Empezar» del anual cobraría un mes
  creyendo vender un año. Por eso su botón es otro (`botonAnualDelPlan`, con el origen y el partner del sufijo más
  `periodo=anual`), /planes/<plan>?periodo=anual va al pedido ANTES de mirar la pasarela, y la ruta rechaza un anual que no
  venga como pedido (`TEXTO_ANUAL_SE_PIDE`). El pedido dice «MaKo Pro anual (US$ 970 por año)» en el historial y en el mail.
- **El selector Mensual/Anual va sin JavaScript** (dos radios y `:has()`): las tarjetas se dibujan en /planes, que es del
  servidor, y en el portal de la landing. Sin `:has()` se ven los dos precios, nunca ninguno. Sale sólo si TODOS los planes
  tienen anual: uno sin anual quedaría sin precio al elegirlo.
- **(REEMPLAZADO el mismo 25/10 a las 10:20 por la prueba gratis de 7 días: ver «La prueba gratis de 7 días».)** La garantía
  de 14/30 días (`GARANTIA_DIAS`) se fue entera: no quedó ni la constante.
- **Pesos sin inventar una tasa:** la línea «Desde Argentina pagas en pesos, con Mercado Pago» sale siempre; un PRECIO en pesos
  sólo si el plan lo tiene (`precioEnPesos`, de `preciosLocales.ARS`). Hoy ningún plan lo tiene (los de código traen `{}` y en
  producción no hay setting `planes.mako`), así que no se ve ningún número en pesos. Para mostrarlo: cargar el precio en el
  setting, no tocar código.
- **El media buyer de Esencial es un tope del plan** (`ads.recomendaciones_dia` en lib/topes-plan.ts: 2 en Esencial, sin tope
  en Pro), no un número en la vitrina: la fila de la comparación y lo que incluye Esencial lo leen de ahí, y el chat «Media
  Buyer» lo hace cumplir desde el mismo lugar. Lo de «propone, no aplica solo» va en el texto («y tú decides si las aplicas»).
- **Trampa de test:** `renderToStaticMarkup` no escribe los atributos en el orden del JSX (el `<input>` sale `type, id, name`
  aunque el JSX diga `type, name, id`), y el HTML crudo trae el `<style>` con los nombres de las clases: para ver si algo se
  dibuja, mirar el texto visible, no el HTML.

**Sin hacer:** NADA hace cumplir todavía las 2 recomendaciones por día: la vitrina las promete desde el tope y el que las
cumple es el chat «Media Buyer» (lib/topes-plan.ts). El precio en pesos lo decide Martín (setting `planes.mako`). El anual se da
de alta a mano: el checkout (`iniciarCompraDePlan`, lib/compra-plan.ts) no tiene período anual. **Vive en:** lib/planes-mako.ts (`GARANTIA_DIAS`, `MESES_GRATIS_ANUAL`,
`precioEnPesos`) · lib/topes-plan.ts · lib/planes-comparacion.ts · app/planes/Tarjetas.tsx · app/planes/Vitrina.tsx ·
app/planes/[plan]/page.tsx · lib/compra-plan-reglas.ts (`botonAnualDelPlan`, `TEXTO_ANUAL_SE_PIDE`) · lib/compra-plan.ts ·
app/reembolsos/page.tsx §1 · tests/planes-tres-bloques.test.ts.

## La prueba gratis de 7 días, con tarjeta, en lugar de la garantía (25/10/2026)

Martín (25/10, ~10:20): «quiero implementar la prueba gratuita de 7 días, y eliminar la garantia de devolución... para darte de
alta en la prueba gratuita debes poner la tarjeta, tal cual como una suscripción, y se te cobra automático luego de esos 7
días». Lo trajo el Cerebro con el reparto (topes, antiabuso, aviso). Chat «Planes», cuenta 5.

- **Lo que se lee (tanda D1):** `PRUEBA_DIAS = 7` (lib/planes-mako.ts) reemplaza a `GARANTIA_DIAS`, que no quedó. Junto al precio
  «7 días gratis»; debajo de cada botón `textoDespuesDeLaPrueba` con el monto de ESE plan («Después US$ 97/mes. Cancela cuando
  quieras antes del día 8»); la pregunta «¿Cómo es la prueba gratis?»; /reembolsos §1 y /terminos §8 dicen lo mismo, y que
  después del primer cobro no hay devolución. La garantía de entrega del Acelerador sigue: es otra cosa (sobre lo que se arma).
- **El diagnóstico obvio era el equivocado: «la suscripción ya se cobra, alcanza con agregarle días gratis».** Los topes del
  plan, el alta automática y «Darme de baja» miran sólo la suscripción PAGADA (`suscripcionDeMakoDe`, y su copia en
  lib/plan-esencial.ts). Un negocio en prueba no tiene pago: se daría de alta sin ningún tope, no podría darse de baja, y la
  vigencia lo trataría como «sin pasarela» (acceso para siempre aunque cancele). La prueba toca esas tres lecturas, no el
  botón.
- **Mercado Pago ya cobra con primer cobro diferido** (`start_date`, el `inicio_at` del cobro, en uso desde el 17/10 para los
  clientes de agencia: es el parámetro documentado al crear la suscripción). La prueba va sobre eso y no sobre `free_trial`,
  que en la documentación aparece en los planes asociados y no está dicho para una suscripción sin plan.
- **Cómo es una prueba (tanda D2), sin tabla nueva:** un cobro de suscripción de la plataforma con alta, `creado_por =
  planes:<plan>:prueba` y `inicio_at` a 7 días (lib/prueba-plan-reglas.ts, `esPruebaDePlan`). El alta se hace al AUTORIZAR
  (`activarPruebaSiAutorizo`, lib/cobros.ts), que la llaman la página de vuelta del pago y el cron de conciliación (la persona
  puede cerrar la pestaña). El aviso de autorizada de Mercado Pago se sigue ignorando en el webhook: el pago del día 8 llega en
  su propia notificación, como siempre.
- **`suscripcionDeMakoDe` y su copia en lib/plan-esencial.ts leen la PAGADA o la PRUEBA AUTORIZADA** con el mismo filtro
  (`FILTRO_SUSCRIPCION_DE_MAKO`, en el módulo liviano porque plan-esencial no puede importar lib/cobros). Con eso, el negocio en
  prueba tiene los topes de su plan, «Darme de baja» y su plan en «Tu plan». La baja en prueba cancela la suscripción en el
  acto (el día 8 no cobra) y usa MaKo hasta ese día. La vigencia: al día hasta el cobro; cancelada, vence ese día, SIN la
  gracia de 5 días de un plan pagado (la prueba ya fue gratis); sin el cobro del día 8, mora como una renovación fallida.
- **Antiabuso, en dos momentos:** antes de abrir el pago, por EMAIL (una prueba que llegó a autorizarse) y por CUENTA (un
  email que ya es usuario de MaKo es un negocio que existe: no hay prueba). Al autorizar, por HUELLA. **Trampa: Mercado Pago no
  publica una huella de la tarjeta** como el `card.fingerprint` de Stripe. La suscripción devuelve la cuenta que paga
  (`payer_id`, una por persona) y la tarjeta guardada de esa cuenta (`card_id`): la huella guarda las dos y cualquiera que
  coincida es la misma persona. Una prueba repetida se CANCELA en la pasarela antes de anularse: si MP no la canceló, no se
  anula nada y el cron reintenta (anularla primero dejaría un cobro el día 8 de una prueba que no dio de alta a nadie).
- **El aviso de 2 días antes** es un cron diario (app/api/cron/aviso-fin-de-prueba, «0 13 * * *») con la marca
  `prueba_aviso_at`. Sin la mig 0334 no hay marca: avisa a las que cobran entre 1 y 2 días después, y como corre una vez por
  día, cada prueba cae en una sola vuelta.
- **La prueba se ofrece SÓLO con Mercado Pago** (`PASARELAS_CON_PRUEBA`). Stripe no toma vendedores de Argentina; Paddle y
  Creem, las del resto del mundo (docs/estrategia-financiera-mako.md), no están integradas. Lo averiguado el 25/10 para cuando
  se integren:
  - **Stripe:** Checkout con `subscription_data.trial_period_days` (o `trial_end`); por defecto junta la tarjeta, y
    `customer.subscription.trial_will_end` llega unos días antes. Ojo con la factura de US$0 del inicio: se asentaría como un
    pago. La huella es `payment_method.card.fingerprint` (docs.stripe.com/payments/checkout/free-trials,
    support.stripe.com/questions/how-can-i-detect-duplicate-cards-or-bank-accounts).
  - **Paddle Billing:** la prueba va en el PRECIO (`trial_period`), y con `requires_payment_method` pide la tarjeta en el
    checkout; la prueba sin tarjeta es de acceso anticipado (developer.paddle.com/build/trials/create-trial).
  - **Creem:** la prueba se prende por producto (días), con estado `trialing`; su documentación no dice explícitamente que pida
    la tarjeta, aunque el checkout la junta (docs.creem.io/features/trials).
- **Límite conocido:** el `start_date` se fija al CREAR el link (7 días desde ese momento). Quien abre el link y lo autoriza
  días después tiene menos días de prueba. Mercado Pago no documenta mover la fecha de una suscripción ya autorizada.
- **Rojo previo, no de esto:** tests/pago-link-anulado.test.ts «anular cierra el link también en Mercado Pago» recorta
  `anularCobro` y la rama de MP vive en `cerrarLinkEnLaPasarela` desde antes: falla igual en el commit anterior.

**Sin hacer (de la prueba, al cerrar D2):** los topes en cada pantalla y «empezar el plan ya» quedaron hechos en D3 (abajo). La mig 0334 quedó APLICADA en producción el 25/10 con el OK de Martín (antes de eso, el código andaba sin ella, sin el freno
por tarjeta). **Vive en:** lib/prueba-plan-reglas.ts · lib/prueba-plan.ts · lib/cobros.ts (`activarPruebaSiAutorizo`,
`suscripcionDeMakoDe`, `darDeBajaMiPlan`, `reconciliarCobros`) · lib/compra-plan.ts (`puedeEmpezarPrueba`,
`iniciarCompraDePlan`) · lib/plan-acceso-reglas.ts (`pruebaDelLugar`) · lib/plan-esencial.ts · app/pagar/[token]/listo ·
app/planes/[plan]/CompraPlan.tsx · app/api/cron/aviso-fin-de-prueba · supabase/migrations/0334_prueba_de_plan.sql ·
tests/prueba-plan.test.ts.

### Los topes de la prueba y «Empezar mi plan ya» (tanda D3, 25/10/2026)

- **El diagnóstico obvio era el equivocado: «topear por lo que cuesta».** Los videos y las imágenes se generan con el Google
  Flow del CLIENTE (su cuenta, sus créditos, en su navegador): a MaKo casi no le cuestan. El tope es por lo que alguien se
  LLEVA gratis y después se va. Por eso «3 videos» son 3 ANUNCIOS armados (el primer montaje de cada uno; volver a armarlo es el
  mismo video), y las tomas sueltas van aparte con 30, porque una toma se descarga sin armar el anuncio. Las 30 tomas las
  decidí acá; el resto son los números del Cerebro (`TOPES_PRUEBA`, lib/topes-plan.ts, con `topeDe(CAPA_PRUEBA, …)`).
- **No había un contador de usos por negocio**: `anthropic_usage` cuenta llamadas de texto y su workspace es el dueño de la
  clave, no el cliente; las tomas de Flow no quedan en ninguna tabla por negocio. El uso de la prueba se suma en un setting
  del negocio (`prueba.uso`, lib/prueba-uso.ts), SÓLO mientras está en prueba: con el primer cobro los topes se van solos.
- **Las páginas publicadas se cuentan de la tabla** (las publicadas HOY, no «desde que empezó»): despublicar libera el lugar,
  como en el tope de Esencial.
- **Trampa: un error TIRADO por una acción del servidor llega sin su texto en producción.** La exportación de leads devolvía el
  archivo y tiraba en el error: el «Disponible al terminar tu prueba» se habría visto como un error genérico. El modal pregunta
  antes (`topeDeExportarAction`) y la acción vuelve a frenar. Exportar en masa hoy es sólo el CSV de leads: la «biblioteca de
  creativos» no tiene descarga en masa (cada video se baja de a uno).
- **«Empezar mi plan ya» no adelanta la prueba** (Mercado Pago no documenta mover el `start_date` de una suscripción
  autorizada): abre una suscripción NUEVA atada al negocio, y la prueba se cancela recién cuando esa nueva se COBRA
  (`cerrarPruebaAlEmpezarYa`). Abrir el link y no pagar no le quita la prueba a nadie. Si el día 8 llega antes que ese pago, el
  primer mes entra dos veces: se cancela la nueva y se avisa a equipo@ para devolver uno. A menos de un día del cobro no se
  ofrece.
- **«Tu plan» en prueba** dice hasta cuándo va y cuánto se cobra, ofrece «Empezar mi plan ya» (arriba de todo si llega desde un
  tope, `?empezar=1`) y no ofrece «Pasar a Pro» ni la oferta de retención: no hay un mes pagado sobre el que hacerlas.

**Sin hacer (de los topes):** el Media Buyer vive en otra rama (wt-mediabuyer-2510): su `cupoDe(ws)` tiene que leer
`estadoDePrueba(ws).enPrueba` (lib/prueba-uso.ts) para negar el piloto automático en la prueba; se lo pasé al Cerebro. El
error por toma del AI Avatar y la pantalla del avatar del editor de video dicen el texto del tope sin el botón. «Tu plan» del
teléfono no tiene «Empezar mi plan ya». **Vive en:** lib/topes-plan.ts · lib/prueba-uso.ts · lib/empezar-plan.ts ·
app/_ui/EmpezarPlanYa.tsx · lib/cobros.ts (`cerrarPruebaAlEmpezarYa`) · app/video-generator/video-action.ts ·
app/ai-avatar/actions.ts · app/video-editor/avatar/actions.ts · lib/editor-landing/tope-landings-server.ts · app/crm/actions.ts ·
app/configuraciones/plan · tests/prueba-topes.test.ts.

### El cartel de la versión de prueba (como Madgicx) y la prueba en la API (25/10/2026)

Martín: «Me gusta el cartel de "limited version" de 7 días de madgicx para implementar en la prueba gratuita de MaKo». Las
capturas: docs/media-buyer/referencias/madgicx/prueba-limitada/ (rama mediabuyer-2510, 71e097476).

- **Madgicx no esconde pantallas en la prueba: limita CANTIDADES.** Por eso no hay pantalla de «esto no está en la prueba»: el
  cartel fijo al pie de la barra lateral («Versión de prueba · quedan N días», lo que se cobra después, «Pasar al plan ya»), y una
  franja arriba de cada pantalla con tope («Usaste 1 de 3 videos armados de la prueba»). El texto del tope habla igual: «Se
  habilita con tu plan».
- **Una lectura para todo** (`resumenDePrueba`, lib/prueba-uso.ts): la dibujan el cartel, la franja y «Tu plan» del teléfono, y la
  lee la API (`ver_mi_prueba`). En el navegador el cartel y la franja comparten UNA llamada por página (app/_ui/usePrueba.ts).
- **Trampa: la regla `react-hooks/purity` frena `Date.now()` en el render**, también en un componente del servidor (el layout del
  teléfono). Los días se cuentan al LEER la prueba (`estadoDePrueba` trae `dias`), no al dibujarla.
- **Los colores son los tokens de MaKo** (`--primary` → `--primary-strong`, `--on-primary`): en el oscuro el degradé se aclara y el
  texto pasa a oscuro solo. El violeta de Madgicx no entra (un test lo frena).
- **La API** (Martín, 25/10: «todo MaKo se debe poder utilizar por API»), en el área `negocio`: `ver_mi_prueba` (GET
  /negocio/plan/prueba), `empezar_mi_plan_ya` (POST /negocio/plan/prueba/fin, se confirma en una pantalla: mueve plata);
  `ver_mi_plan` dice «en prueba gratis» y `dar_de_baja_mi_plan` cancela la prueba sin cobro. EMPEZAR una prueba no va a la API:
  es la compra pública de /planes, de un negocio que todavía no existe. Una operación nueva con ruta REST necesita su recurso:
  va bajo `/negocio/plan/…`, que ya tiene título.

**Sin hacer:** el Media Buyer (otra rama) tiene que dibujar la misma franja con su tope y negar el piloto en la prueba
(`estadoDePrueba`). Lo que se cobra después se parte en dos renglones («US$ / 97/mes») en una barra angosta. **Vive en:**
app/_components/CartelPrueba.tsx · app/_ui/FranjaPrueba.tsx · app/_ui/usePrueba.ts · app/api/plan/prueba · app/m/_prueba/PruebaM.tsx ·
lib/prueba-uso.ts (`resumenDePrueba`) · lib/api-mako/areas/negocio.* · tests/prueba-cartel.test.ts.

## Un segundo intento de cobro no se arma si el primero puede seguir vivo, y eso vale también para las SUSCRIPCIONES (29/10/2026)

**Vive en:** el alta de cobros de /planes (`be95f7555`, rama `planes-2710`) y el plan a mano con vencimiento (`55542d446`).
Medido por la verificación de `ddfa645d4` (informe con los scripts: C:/dev/revisiones/2910-verificacion-zernio-254856316-planes-ddfa645d4.md).

- **`be95f7555` cerró el voucher doble** (OXXO o SEPA en curso: queda UNA cuota). **Pero no el de la suscripción:** una
  suscripción con SEPA cuya primera factura falla arma una SEGUNDA (B), y MaKo nunca cancela la primera. Si Stripe
  reintenta la de A, o llega tarde su aviso de fallo, el negocio paga dos veces. La regla: antes de armar otro intento,
  cancelar (o esperar el final de) el anterior en Stripe, sea un pago suelto o una suscripción.
- **El plan a mano y la pasarela se pisan:** si el negocio paga por /planes con el email de su propia cuenta, el cobro
  queda `ya_tenia_cuenta` sin `alta_ws`. Y al vencer el plan a mano, el aviso «Terminó tu prueba» le llega a quien YA paga.
- **Hecho en `4b6acf1c0`** (chat Zernio, 29/10): el fallo tardío de una sesión o suscripción anterior ya no vuelve el cobro
  a `fallido`; `urlParaPagar` cancela la suscripción de la sesión que falló ANTES de armar otra; sólo cuenta la factura de la
  suscripción vigente (un pago de la vieja abre un ticket para devolverlo); el plan a mano se apaga si el negocio pagó con el
  email de un admin, y no hay aviso al vencer para quien ya paga.
- **Sin hacer:** que el aviso se marque aunque el mail a Martín dé 429 (hoy se repite al día siguiente). La carrera del
  cron contra «más días». Y el cartel de un plan vencido sin resolver, que dice «termina hoy» todos los días.

## Fuera de Argentina se cobra con Stripe; Mercado Pago, sólo en su país (27/10/2026)

La llamada con Leila (Fathom 876470842-18): en vivo, una clienta de México recibió el link de la Mercado Pago de MaKo y MP la
rechazó, «No se puede continuar con este pago. La cuenta del vendedor es de otro país»; terminó pagando por Binance. Chat
«Planes, pagos y Partners», cuenta 5.

- **El diagnóstico obvio era el equivocado: «falta conectar Stripe».** Stripe podía estar conectada en el ws9 y /planes igual
  NUNCA la ofrecía: `monedasDeLaPlataforma` (lib/compra-plan.ts) salta toda pasarela que no arma la prueba gratis con tarjeta,
  y `PASARELAS_CON_PRUEBA` era `['mercadopago']` desde el 25/10 (la prueba se armó sobre el `start_date` de MP). Así,
  cualquiera, de cualquier país, salía al checkout de la Mercado Pago argentina. Un cobro de Stripe que ya pasó salió por otra
  puerta (el «Vender un plan» de /admin/cobros no mira esa lista). No se pudo medir el ws9 (la lectura de producción la frenó
  el clasificador): si Stripe NO está conectada ahí, fuera de Argentina el plan se PIDE (nombre, email y WhatsApp), que es
  mejor que un pago que rebota.
- **Stripe arma la prueba con `subscription_data.trial_period_days`** y `payment_method_collection: always`. La prueba sale del
  COBRO (`esPruebaDePlan(c)` en `crearCheckout`), no del pedido: la sesión de Stripe vence a las 23 h y `urlParaPagar` la
  rehace; sin eso, abrir el link al día siguiente cobraba el primer mes en el acto.
- **Trampa: una prueba de Stripe sigue `pendiente` hasta el día 8, y rehacer su sesión abría una SEGUNDA suscripción.**
  `urlParaPagar` manda a /listo a una prueba ya activada o con la sesión `complete`.
- **El checkout de Stripe sin pago (`no_payment_required`) el webhook lo ignora a propósito**, como el aviso de autorizada de MP:
  la prueba se activa en la vuelta del pago y en el cron (`pruebaAutorizadaStripe`: sesión `complete` de ESTE cobro y suscripción
  `trialing`). La factura de US$ 0 del inicio no se asienta (`confirmarFactura`: «factura en cero»); el día 8 entra por
  `invoice.paid` (`subscription_cycle`) como cualquier factura.
- **La huella en Stripe es `card.fingerprint`** (expandiendo `default_payment_method`), con el mismo formato que la de MP
  (`st:-|card:<fp>`): la compara el mismo filtro. **El día del primer cobro lo dice Stripe** (`trial_end`, cuenta desde que
  completó el checkout): se escribe en `inicio_at` al activar, y el aviso de 2 días antes, «Tu plan» y la vigencia lo leen de
  ahí. El «límite conocido» de MP (menos días si autoriza tarde) no existe en Stripe.
- **La pasarela según el país** (`pasarelasDelPais`, lib/compra-plan-reglas.ts): Mercado Pago sólo en el país de SU cuenta (por
  su moneda: ARS → AR) y ahí la única (en pesos, sin el recargo de la tarjeta internacional); afuera, Stripe; sin país, las dos y
  elige la persona («Mercado Pago (desde Argentina, en pesos)»). El país es el encabezado `x-vercel-ip-country` (XX y T1 = no se
  sabe): lo leen /planes, /planes/<plan> y la compra, nunca el formulario. Pedir MP desde México con Stripe disponible contesta
  «¿Con qué quieres pagar?» con Stripe, no «no cobramos en línea». Las landings (app/page.tsx, /vsl) NO leen el país: ahí
  «Empezar» sale si alguna pasarela cobra, y el país se aplica al entrar al plan.
- **La venta por un Payment Link propio (MAU-10, en main desde el 27/10) no ve las pruebas** (medido al mezclar, 28/10): su rama
  de `procesarEventoStripe` (lib/cobros-webhook.ts, `compraDeUnLinkPropio`, el Purchase a Meta) corre sólo cuando el checkout
  NO es un cobro de MaKo, y el de una prueba ni llega ahí: `avisoStripe` ignora antes el `checkout.session.completed` con
  `no_payment_required` (tests/cobros-eventos.test.ts). Esa rama no le manda una compra a Meta por empezar una prueba, ni
  mira el `invoice.paid` del día 8 (si otro camino, como el lead, le avisa a Meta del cobro, no está medido). Al unir la punta
  de Zernio (5a27268bc, la venta externa ya REGISTRA un cobro) la puerta también toma «un cobro externo a medias»
  (`esCobroExterno`: `creado_por` empieza con `externo:stripe:`), y la prueba sigue afuera por tres lados: el aviso la ignora,
  `esVentaExterna` corta la metadata de MaKo, y una prueba (`planes:<plan>:prueba`) nunca es externa ni al revés.
  tests/prueba-stripe-no-es-venta-externa.test.ts lo fija.
- **El cobro del día 8 con el aviso perdido, ahora lo recupera el cron (28/10).** El cron le preguntaba a Stripe por la SESIÓN
  del checkout, y la de una prueba queda `complete` / `no_payment_required` para siempre: lo que cobra el día 8 es una FACTURA
  de la suscripción. Si el `invoice.paid` se perdía, la plata entraba y el cobro seguía pendiente (sin cuota ni lead ganado);
  MP no tenía el hueco porque busca el pago por la referencia. Ahora `pagoDelLinkEnLaPasarela` lista las facturas pagadas de
  la suscripción (`facturasPagadasStripe`) y toma la más VIEJA con plata de ESTE cobro (`primerCobroDeLaPrueba`, con el filtro
  del aviso, `confirmarFactura`), **con el id de la factura**, el mismo que usa el `invoice.paid`: si el aviso llega después, no
  es otra cuota. **La regla:** una pasarela que cobra DESPUÉS del checkout (prueba, cobro diferido) se reconcilia por lo que
  cobra (la factura, el pago), nunca por la sesión, y con el id que usa su aviso.
- **Y el cron no las VEÍA con 50 compras más nuevas (la verificación de 3ca2d8328, 28/10).** Leía los pendientes con
  `.limit(50)` por `updated_at`, y cada compra abierta en /planes es un pendiente que nadie anula (`checkout.session.expired`
  se ignora), y toda compra de Stripe arranca como prueba. Con 50 más nuevas, la prueba quedaba en el puesto 51: no se
  activaba y, con el aviso del día 8 perdido, no se acreditaba nunca (si llegaba bien el del mes 2, se asentaba ése y el
  mes 1 se perdía: Stripe 194, MaKo 97). Ahora las pruebas se leen APARTE: las activadas de los últimos 45 días y las sin
  activar de los últimos 2, con un seguro de 500 que, si se alcanza, lo dice. **La regla:** una lista con tope que alimenta
  una reparación corta en silencio lo que más importa; lo que no puede perderse se lee aparte. Probado de punta a punta con
  el código real (C:/dev/revisiones/scratch-3ca2/A-refuta/r1-cron-tope.ts, i50 / i50_mes2 / j50).
- **Y la lectura aparte tenía tres agujeros (la verificación de a196d5a93).** (1) Sólo leía las pruebas `pendiente`: la que
  quedó `fallido` porque la tarjeta se rechazó el día 8 y el reintento de Stripe la cobró después (con el aviso perdido)
  volvía a la lista general de 50 y no se acreditaba: es el caso común de una tarjeta al terminar la prueba. (2) Las leía de
  la más NUEVA a la más vieja: con más de 500, el seguro dejaba afuera justo las del día 8 (las viejas), y el aviso decía «las
  más viejas esperan» cuando no se iban a leer nunca. (3) La vuelta no tenía reloj: cientos de pruebas son dos lecturas a Stripe
  por cada una, en serie, y se pasaba del `maxDuration` del cron. Ahora: las activadas `pendiente` o `fallido`, de la más vieja
  a la más nueva, y `reconciliarCobros(ws, { hasta })` corta a tiempo (el cron le deja 120 s a lo que sigue). r2-cron-pruebas.ts:
  «fallido» con 50 y 80 más nuevas, antes 0, ahora 1 con una cuota; b600, antes las 100 viejas nunca, ahora en la primera vuelta.
- **Rehacer el link dejaba la sesión vieja ABIERTA (la verificación, 28/10).** `urlParaPagar` rehace la sesión a 5 minutos de
  vencer y no cerraba la anterior: pagada en la pestaña vieja, la prueba no se activaba (se leía la nueva) y se cobraba el día
  8 sin prueba; pagadas las dos, quedaban DOS suscripciones cobrando todos los meses. Ahora, en todo cobro de Stripe (no sólo
  la prueba), la anterior completa va a /listo y la abierta se expira ANTES de armar otra; si no se pudo cerrar, no se arma.
- **La prueba, sólo con tarjeta (`payment_method_types: ['card']`).** Sin eso, Checkout ofrecía los medios prendidos en la
  cuenta: con Link o un débito bancario no hay `card.fingerprint`, la huella quedaba vacía y con otro email se repetía la
  prueba (no cobraba de más: regalaba pruebas).

**Sin hacer:** «Empezar mi plan ya» en Stripe abre otra suscripción como en MP, aunque Stripe podría terminar la prueba
(`trial_end=now`). Una renovación de Stripe (mes 2 en adelante) con el aviso perdido sigue sin cron: el cobro ya está pagado y
el cron sólo mira pendientes (pasa igual con cualquier suscripción de Stripe, no sólo la de una prueba). Medir en el ws9 si
Stripe está conectada y en modo real (lo mide el Cerebro, sólo leyendo).
**Vive en:** lib/prueba-plan-reglas.ts (`PASARELAS_CON_PRUEBA`, `huellaStripe`) · lib/stripe-api.ts (`diasDePrueba`,
`leerPruebaStripe`, `facturasPagadasStripe`) · lib/cobros.ts (`crearCheckout`, `urlParaPagar`, `activarPruebaSiAutorizo`,
`pruebaAutorizadaStripe`, `pagoDelLinkEnLaPasarela`) · lib/cobros-eventos.ts (`primerCobroDeLaPrueba`) ·
lib/compra-plan-reglas.ts (`pasarelasDelPais`, `paisDelVisitante`) · lib/compra-plan.ts · app/planes · app/api/planes/comprar ·
tests/planes-stripe-afuera.test.ts · tests/prueba-stripe-cobro-perdido.test.ts.

## La tabla de /planes para quien no sabe nada, y el scraper y Partners sólo en Pro (27/10/2026)

⚠️ **29/10/2026: MaKo Partners salió de Pro** (las landings dicen «gratis» y «cualquier plan»): docs/hallazgos-partners.md →
«Cualquier plan es partner…». Lo de abajo sobre Partners quedó como historia; el scraper sigue siendo de Pro.

Leila (Fathom 876470842-16), sobre «Piloto automático: tu media buyer aplica los cambios solo, dentro de tus topes»: «Una
persona que no sabe no entiende…». Y Aaron (876825880-01): faltaba el scraper de WhatsApp. Martín, ya decidido
(876470842-15): el scraper y hacerse partner, sólo en Pro.

- **La guarda del 24/10 (`INTERNO`) miraba nombres de tabs, no jerga de marketing:** «media buyer», «embudo», «topes», «CRM» y
  «piloto automático» pasaban. Ahora cada fila dice lo que la persona consigue («Ideas por día para mejorar tus anuncios»,
  «MaKo aplica las mejoras solo, sin pasarse de tu presupuesto») y un test frena esa jerga y las filas de más de 62 caracteres
  (una línea en el teléfono). Faltaban también los videos, el dominio propio y cobrar (con su tope de verdad: `web.dominios`,
  `cobros.cuentas`).
- **El scraper no es una tab: el candado no podía ir en `TABS_SOLO_PRO`.** Va en `FUNCIONES_SOLO_PRO` (lib/topes-plan.ts) con
  `textoSoloPro`, y lo mira CADA acción de app/crm/grupo-wa-actions.ts (no sólo la de abrir) y cada operación de la API de
  grupos; la pantalla muestra el texto con «Pasar a Pro». La vitrina lo dice desde la misma lista.
- **Partners:** `hacermePartner` frena al Esencial ANTES de crear el código; quien ya era partner sigue siéndolo. La página
  (computadora y teléfono) muestra la landing con «Pasar a Pro», y `hacerme_partner` por la API no propone lo que va a frenar.
- **Como todo candado de Pro, sólo a quien paga Esencial por la pasarela** (`esEsencialDe`): un alta a mano recibe más, nunca
  menos.
- **Una tab CERRADA no se vende (28/10, lo prometido a Teo).** La tabla le prometía a Pro «videos con una persona hecha con IA»,
  y AI Avatar la abre sólo el super admin (app/ai-avatar/acceso.ts). Va en `TABS_TODAVIA_CERRADAS` y no sale; el test lee esa
  puerta, así que el día que se abra pide volver a sumarla. **El diagnóstico obvio («no prometer avatares») era de más:** el
  Video Editor tiene su propio «Avatar de IA», que Pro SÍ ve, y el tope «1 video con avatar» de la prueba (`prueba.avatares`)
  lo cuenta él también: esa pregunta frecuente es cierta y queda. Y la fila de Partners dice qué se gana: «el primer mes de
  cada negocio», no «dinero» suelto.
- ⚠️ **Abrir una tab no es venderla (29/10, la revisión de plata de AI Avatar para todos).**
  - Martín dijo «disponible para todos». La rama sumó además la fila `NOMBRE_AI_AVATAR` con ✓ en los tres planes, y «y tu
    avatar con IA» en el renglón de Esencial.
  - Las dos venden el motor del Video Generator, que `90a760e4b` había sacado de esta tabla esa misma tarde por estar a
    medias. Nunca generó un look en producción, y la tienda de Chrome publica la extensión 0.39.1 cuando el avatar pide 0.69
    o más.
  - Tampoco dicen que los videos se pagan con los créditos de Google Flow del cliente (hasta 15 por toma), ni que piden Chrome
    de computadora.
  - **Regla:** la puerta y la promesa en la tabla son dos decisiones. La promesa espera a que el motor ande en producción,
    salvo que Martín diga que se vende igual.
  - **Decidido (el Cerebro, 29/10: «sacar»; subió en tren-ad y salió en tren-ae):** la fila depende de `AI_AVATAR_SE_VENDE`
    (`lib/planes-comparacion.ts`, hoy `false`), y el renglón de Esencial volvió al de antes. Vuelve a `true` cuando Martín
    genere un look real en el ws3 y la tienda tenga la extensión 0.69 o más. Ese día, `tests/planes-tres-bloques.test.ts`
    pide que la fila diga «Google Flow», y mientras tanto frena cualquier fila o renglón que diga «avatar».
- ⚠️ **El setting `planes.mako` corta cada renglón a 80 letras.**
  - El corte está en `planValido` → `texto(x, 80)`, en `lib/planes-mako.ts`. `guardarPrecioLocal` escribe el setting con los
    planes de fábrica la primera vez que se carga un precio en pesos.
  - Desde ahí, un renglón largo sale cortado en /planes: el de Esencial con el avatar (110 letras) queda «…y tu avatar con IA
    (t», y ya les pasaba a los dos del media buyer (95 y 92).
  - Con el setting escrito, ningún cambio de los renglones de fábrica se ve, porque manda el setting. No se verificó si hoy
    existe en el ws9.
  - **Regla:** un renglón de `incluye` no pasa de 80 letras, o se sube el corte.
- **La capa `pm` SÍ se vende** (`IDS_VENDIBLES = ['pm', 'completo', 'agencia']` en `lib/capas.ts`). El motivo para dejarla sin
  AI Avatar («no es un plan que se vende») es falso: quien compró Project Manager queda sin AI Avatar. Lo confirma el Cerebro.

## El plan dado a mano con vencimiento (28/10/2026, lo prometido a Teo: «te doy 7 días de prueba»)

- **Lo que hace:** en Customers, el diálogo del plan suma «Prueba a mano: 7, 14 o 30 días / sin vencimiento». Se guarda como un
  setting del negocio (`plan.a_mano`, sin migración). Mientras lo tiene, vigente o vencido sin resolver, `estadoDePrueba` lo da
  «en prueba» con el plan que le dieron, y valen los topes de la prueba. El cron diario de las pruebas
  (app/api/cron/aviso-fin-de-prueba) avisa al vencer, una sola vez, a la persona y a Martín.
- **La decisión (el Cerebro, de una de Martín): al vencer NO se pausa.** El corte de acceso general está apagado
  (`CORTE_DE_ACCESO_PRENDIDO = false`); el día que se prenda, este plan cae en el corte como cualquier otro, sin una regla aparte.
  El aviso a la persona no le dice que se corta (porque no se corta), y el de Martín dice que no se pausó nada.
- **La trampa que encontró un test viejo (prueba-topes):** mirar el plan a mano siempre que no hubiera una prueba por la
  pasarela le volvía a poner los topes de la prueba a quien YA PAGA y conservaba un vencimiento viejo. Sólo vale SIN ninguna
  suscripción de MaKo; con el primer cobro, los topes se van solos, como antes.
- Si el aviso a Martín no sale, no se marca «avisado»: se intenta en la vuelta siguiente.
- **Un «extendé la duración» que arrastra los límites de otra cosa: los 6 meses gratis NO son una prueba larga (30/10, lo que Martín le ofreció a Gabriela; la regla general, en AGENTS.md).** El pedido obvio era sumar «180 días» a la lista, y le habría dado seis meses con los topes de la prueba (3 videos, 1 avatar, 1 landing, sin exportar). Mientras duran, `estadoDePrueba` no la da «en prueba» y tiene su plan entero; vencidos sin resolver, quedan como una prueba vencida y avisan con su propio texto. Son 183 días, para no quedar nunca cortos.
- **Los 6 meses gratis no paran una tarjeta (30/10).** Darlos a quien ya tiene una suscripción, o una prueba con tarjeta en curso, no frena nada: `estadoDePrueba` sigue mirando el cobro primero (con la prueba en curso, conserva los topes) y la pasarela cobra el día 8 igual. El diálogo decía «gratis» sobre una tarjeta que se iba a cobrar. La ruta lo rechaza y lo dice (`pagaSuPlan`, lib/prueba-uso.ts), y el aviso previo pregunta lo mismo: `estadoDePrueba` no sirve para saber si paga, porque unos 6 meses vigentes tampoco están «en prueba».
- **Un negocio sin cobro de la plataforma nunca se corta (30/10, medido en lib/plan-acceso-reglas.ts).** El comentario de lib/plan-a-mano-reglas.ts dice que el día que se prenda el corte general este plan «cae como cualquier otro», pero la regla de arriba es «sólo se corta a quien MaKo le vendió el acceso por la pasarela». Prender el corte no le saca los 6 meses a nadie.
- **El aviso previo de los 6 meses: 14 días antes (`DIAS_AVISO_REGALO`), una vez, a la persona y a Martín.** Su marca es `avisoPrevioAt`, aparte de `avisadoAt`: si compartieran marca, el previo se comería el aviso del fin. Lo corre el mismo cron (`aviso-fin-de-prueba`). Y los dos avisos llevaban a `/admin`, que redirige a la pestaña Customers; el diálogo vive en Accounts (`RUTA_QUIEREN_ENTRAR`).
- **Las tarjetas de /planes seguían con la jerga que la tabla ya no tenía (30/10).** Leila la sacó de la tabla el 27/10 y la guarda miraba sólo las filas, así que «embudo», «CRM», «media buyer», «setter» y «cohorte» siguieron en lo primero que se lee, y en la promesa del Acelerador. La guarda ahora mira la pantalla entera (`la pantalla entera se entiende`, tests/planes-tres-bloques.test.ts). La regla general, en AGENTS.md: una guarda que mira una parte de la pantalla da falsos verdes cuando el texto se muda. **«Ops Center», «workspace» y «barredora» ya no estaban:** el pedido viejo de barrerlos, medido en producción el 30/10, no encontró ninguno; lo que quedaba era otra jerga.
- **La tabla prometía anuncios armados la primera semana (30/10).** La fila del Acelerador decía «Tus páginas, mensajes y anuncios armados»; la tarjeta y /reembolsos §2, que es lo que se garantiza, no incluyen anuncios. Corregida la fila, no la garantía.
- **Partners, los tres puntos del 24/10 ya estaban (medido en producción el 30/10):** landing por defecto y panel sólo para quien terminó el alta (app/partners/page.tsx, `altaDePartner`), se gana dinero y no meses (Martín lo cerró el 25/10) y la calculadora en el hero. Un pedido viejo se mide antes de rehacerlo: no se tocó.
  **Sin hacer:** la fecha de fin no se ve en Customers (no está «en prueba»): se dice al guardarla y llega el aviso al vencer. Tampoco hay aviso antes de que termine: enterarse el día que se corta es tarde para un cliente (docs/pendientes.md, P16).
- ⚠️ **Quien ya pagó seguía con los topes (29/10, la verificación de ddfa645d4, ALTA):** si el negocio compra por /planes con el
  email de SU cuenta, el cobro queda `ya_tenia_cuenta` y SIN atar (`alta_ws` null) hasta que Martín lo ata en /admin/cobros, y
  `estadoDePrueba` sólo miraba los cobros atados: seguía «en prueba» y al vencer le llegaba «Terminó tu prueba». Ahora un cobro
  pagado de la plataforma, `ya_tenia_cuenta` y sin atar, con el email de un admin del negocio, apaga el plan a mano. **La regla:**
  el email SÓLO quita topes; nunca ata ni pausa (atar por email es lo que lib/plan-acceso.ts NO hace a propósito: cualquiera podría
  comprar con el email de otro y hacerlo pausar). Quitar es seguro: quien paga con tu email te paga a vos.
- **Y el aviso al vencer se saltea a quien ya no está en prueba** (la MEDIA del mismo informe: «le doy 7 días, paga el día 3» es
  el final esperado y le llegaba «Terminó tu prueba», con «sigue con los topes» a Martín). Medido con el guion del refutador
  (C:/dev/revisiones/scratch-ddfa/plan-a-mano/p1-plan-a-mano.ts sobre este árbol): sólo cambian los casos C y B al vencer.

**Sin hacer (del mismo informe):** si el mail a Martín no sale (un 429 de Resend), la persona lo recibe otra vez al día siguiente
(guardar por separado lo que salió); la fecha del aviso va en hora de Argentina y no en la del negocio; si Martín da más días
mientras el cron avisa, el cron pisa el plan nuevo; un plan a mano vencido dice «termina hoy» todos los días.

**Sin hacer:** Customers no muestra en la tarjeta del negocio hasta cuándo va su prueba a mano (se ve en el aviso al guardar).
El envío de los mails y la lectura de la base no se corrieron de punta a punta (el test mira el fuente); el primer vencimiento
real hay que mirarlo en el log del cron.
**Vive en:** lib/plan-a-mano-reglas.ts · lib/plan-a-mano.ts · lib/prueba-uso.ts (`deUnPlanAMano`) ·
app/api/admin/workspaces/route.ts (`plan_a_mano`) · app/admin/AdminView.tsx (`PermisosDialog`) ·
app/api/cron/aviso-fin-de-prueba/route.ts · tests/plan-a-mano.test.ts · tests/prueba-topes.test.ts.

**Sin hacer:** «Datos de empresa» sobre leads tildados (app/crm/AccionesLoteLeads.tsx, `enriquecer-actions.ts`) usa el mismo
núcleo que el grupo y NO tiene candado: no trae contactos nuevos. Si Martín lo cuenta como scraper, va con `candadoDePro`.
**Vive en:** lib/planes-comparacion.ts · lib/topes-plan.ts · app/crm/grupo-wa-actions.ts · app/crm/TraerDeGrupoWA.tsx ·
lib/api-mako/areas/crm.run.ts · lib/partners-programa.ts · app/partners/page.tsx · app/m/partners/page.tsx ·
tests/planes-tres-bloques.test.ts · tests/scraper-partners-solo-pro.test.ts.

## El funnel de lanzamiento en el cobro: prueba apagada, 50% del primer mes y se paga antes de entrar (30/10/2026)

La decisión y sus motivos: [estrategia-lanzamiento-low-to-high.md](estrategia-lanzamiento-low-to-high.md). Lo que vive acá es lo que no se ve leyendo el código.

- **`cobro.monto` sigue siendo la mensualidad, y sólo el PRIMER PAGO sale a mitad.** Lo obvio era guardar 48,50 en el cobro y habría quedado mal para siempre: la deuda de una mora, «Tu plan», la retención, «Pasar a Pro» y el MRR salen de ese número. El descuento se reconoce por `creado_por = planes:<plan>:primer-mes-50` (lib/primer-mes-reglas.ts), sin migración.
- **Los dos caminos no son simétricos.** Stripe vuelve solo (cupón `once`). Mercado Pago no tiene descuento de un cobro: nace rebajada y hay que subirla con `PUT /preapproval` al entrar el primer pago, con el cron de respaldo (`conciliarPrimerMes`) y un mail a Martín si no puede. Si esa llamada se pierde, el segundo mes se cobra a mitad y nadie lo ve. **Y no se puede subir a ciegas: quien aceptó «2 meses al 50%» antes de darse de baja está rebajado a propósito** (el cron saltea a quien tiene `plan.retencion`).
- **El reloj de un cartel es sólo un adorno si el servidor no lo mira.** Es la cookie firmada de Landings (`promoVigente`, lib/promo-entrada.ts), y la ruta de compra la lee. Sin reloj vivo, precio de lista. **Armé primero un token mío en la URL con el mismo nombre de archivo, sin saber que Landings estaba haciendo la cookie: se tiró.** Dos relojes para una promesa era peor que cualquiera de los dos. **Y no se llama «oferta» (el Cerebro, 30/10):** en MaKo «Oferta» es la oferta del negocio, con su tab, su API y su propio campo `activa`. Lo de la landing es la promo de entrada (`lib/promo-entrada.ts`), y su estado dice `hay` y su entorno `prendida`, porque `activa` es además la palabra que vigila una guarda de Automations.
- **Lo que se eligió para lo que Martín dejó abierto («si el reloj se reinicia»):** el reloj no vuelve en ese navegador (Landings). Otro navegador arranca el suyo, y eso lo cierra el cobro con **un descuento por email**: quien lo abandona a mitad del pago lo rearma por 24 h con el mismo email, y después precio normal. 15 min de gracia que no se muestran, sólo para quien vio el descuento en la página y tocó el botón con el reloj en cero. Se cambia en `puedeUsarPromo` (lib/compra-plan.ts) y `MINUTOS_DE_GRACIA` (lib/primer-mes-reglas.ts).
- **Hay dos interruptores y se prenden juntos con la pasarela:** `PRUEBA_GRATIS_PRENDIDA` (apagada ya) y `PROMO_ENTRADA_ACTIVA` (de Landings, apagada: si no, el cartel promete 23,50 y no hay con qué cobrar). Con el del 50% apagado, el cobro da precio de lista: no hay forma de que el cobro y el cartel digan cosas distintas.
- **Si el descuento no vale, se dice y se elige.** La ruta contesta 409 con `sinPromo` y nada creado. Nunca se cobra el precio lleno a quien venía viendo la mitad.
- **«Apagar» no es poner `null`.** `conPreciosEnHtml(html, planes, null)` deja las marcas de la landing como vinieron, o sea «Empieza tus 7 días gratis» en una página publicada. Con la prueba apagada se pasa `'apagada'`, que las reemplaza.
- **Apagar una promesa es buscarla en todo lo que se copia, no sólo en lo que se dibuja.** Tres de los cinco mensajes que los partners copian y pegan (lib/partners-recursos.ts) seguían diciendo «Lo pruebas 7 días gratis»: los salva `PRUEBA_DIAS` en una variable (`gratis`), así que buscar la frase no los encuentra. Lo destapó un test que pedía esa frase y que se dio vuelta: ahora pide que NO esté.
- **Prendido y apagado no conviven:** con `PRUEBA_GRATIS_PRENDIDA` en true no hay descuento (el motivo 1 de Martín). A quien ya está en prueba no lo mira el interruptor: `esPruebaDePlan` mira el cobro.
- **Sin hacer, por falta de datos o de un sí:**
  - Ningún cobro real pasó por esto, y `PUT /preapproval` nunca se midió con claves de verdad. Hace falta el sí de Martín.
  - `/planes` hoy muestra «Quiero…»: sin pasarela real conectada no se cobra en línea, así que el funnel no cobra nada hasta conectarla.
  - Mercado Pago no se ofrece: `preciosLocales` está vacío en los dos planes (nunca se inventa una tasa).
  - Las marcas `data-mako-prueba="dias"` y `="cobro"` de las landings publicadas y scripts/landings-mako-v2.mts siguen diciendo días gratis: es de Landings.
  - MaKo Partners paga el primer mes a precio de lista (`gananciaDelReferido`), aunque ese mes haya entrado a mitad, y su landing dice «todo lo que paga el negocio»: decisión de Martín.
  - Lo ya pagado no se reembolsa, y ahora sin prueba previa: en Argentina, la Ley 24.240 (art. 34) da 10 días para arrepentirse de una compra a distancia. No se tocó la política: lo tiene que mirar Martín.

## El WhatsApp en el checkout: un campo nuevo es una llave nueva para encontrar fichas (31/10/2026)

**El pedido.** Martín: «antes de ir al checkout de mako, donde te pide el nombre y el correo, que le pida también el whatsapp». Se pide con su código de país y no frena el pago: vacío, compra igual. Mal escrito se le dice en el campo, como a un código de referido, y dejarlo vacío sigue. Que sea obligatorio lo decide Martín.

**El diagnóstico obvio era el equivocado.** Parecía un campo más y era un cambio de identidad: hasta hoy el comprador se reconocía sólo por el email, y `createLead` ahora también compara por el número. `leadDeLaCompra` decía «mismo teléfono: se reusa aunque tenga otro email», escrito cuando el checkout no pedía teléfono. Con un formulario público, un dígito mal o el dueño que compra para su segundo negocio ataban el pago a la ficha de OTRA persona: la marca Ganado y `asentarAlta` le pisa `cliente_ws`, sin rastro. Ahora: otro email y el mismo número es otra ficha, con una nota que nombra la otra; una ficha de más se funde, escribir sobre la equivocada no se deshace.

**Un número sin probar le ganaba al probado (lo encontró la revisión).** Con la ficha ya llena desde el formulario, «sólo se completa lo vacío» dejaba afuera el número que WhatsApp sí reconoce, sin una línea en el historial, y por esa ficha se lo llama. Ahora ese número reemplaza SÓLO al escrito en el checkout (`anotarTelefonoDelComprador` lo compara con `cobros.origen.whatsapp`). Lo cargado a mano sigue ganando: también entra por ahí el número principal de los avisos, que puede ser el de un asistente.

**Lo que se perdía sin error:**
- Dos códigos de país sin el `+` («54 9 11…», «0054…», o el `+` tapado por las marcas invisibles de una app de contactos): 15 dígitos pasan `whatsappLimpio`. Con 11 o más y arrancando con la lada, se saca. Con menos no: 5512345678 es un celular de México.
- +1809 y +1787 traen el código de área adentro: por IP arrancan en +1.
- `whatsappLimpio` pide 8 dígitos contando la lada: +54 y «112233» pasaba por completo. En el checkout son 10; el pedido sin pasarela sigue como estaba.
- Una ficha que ya existía por el email se devolvía sin mirar el número. Se completa si está vacía. Si tiene otro, no se pisa (cualquiera puede escribir el email de otro) y queda en su historial.
- `TelefonoConPais` guarda número sin lada y una lada que siempre está elegida: mandar los dos juntos convertía un campo vacío en un «número» de dos dígitos. `telefonoDeFormulario` devuelve vacío y saca el 0 de larga distancia.
- El estilo de `/planes` es `input[type=tel]`, y el campo de `TelefonoConPais` no declara `type`: sin `inputStyle` se ve como un input pelado. Ningún test lo vio; se vio en el banco.

**La otra mitad, acordada con Ops Center.** La pregunta del onboarding se queda, porque el número del checkout no está probado y el código es lo que permite sumarlo al grupo. Al dar el alta se guarda `cuenta.whatsapp_del_pago` (`CLAVE_WHATSAPP_DEL_PAGO`, lib/origen-cuenta.ts): la tarjeta arranca con él y un toque manda el código. Nada le escribe antes. El que vale es el escrito en ESA compra (`cobros.origen.whatsapp`) y, si dejó el campo vacío, el de su ficha.

**Medido: `/planes` ya cobra (31/10, GET anónimo).** La plataforma pasó de no tener pasarela (30/10) a ofrecer Mercado Pago real en pesos: «$ 73.555 ARS por mes». Lo que se escribió el 30/10 sobre «no tiene ninguna pasarela» ya no vale, y ningún POST de prueba se hace sin el sí de Martín.

**Sin hacer:** el número del checkout no se muestra en el aviso de «Entró un pago», sólo el link a la ficha (lib/cobros.ts, `avisarPagoRecibido`). El 15 del celular argentino («11 15 2233 4455») queda adentro: sacarlo pide saber cuánto mide cada código de área, y no se midió contra WhatsApp si llega igual; la verificación del onboarding lo corrige. Una lada elegida mal por el país de la IP con un número local no se detecta. Un número de una ficha sin email ata la compra a esa ficha (`leadDeLaCompra`, decisión del 30/10), y `asentarAlta` le escribe `cliente_ws` sin mirar si ya tenía. La pantalla se vio sólo en el banco (app/planes/[plan]/CompraPlan.tsx); en producción, después del deploy.

## Pausar un negocio no le corta el acceso (5/11/2026)

**Síntoma:** había que dejar afuera a dos clientes de Código Inmobiliario que pasaron las 2 semanas sin pagar. Lo obvio era marcar el negocio como pausado, o usar `plan.corte_por_pago`, y ninguna de las dos corta.

**Causa:** `negocioPausado` (`lib/workspace.ts:350`) sólo corta con el motivo `sin-agencia` vigente o con `CORTE_DE_ACCESO_PRENDIDO`, que está apagado para todos. Y `sin-agencia` no sirve para esto: le dice al cliente «Tu agencia dejó de administrar tu cuenta», que es falso.

**Lo que corta hoy:** `usuarios.estado='suspendido'` (`lib/auth.ts:55`). Pablo y Patricia quedaron así el 5/11 (usuarios 19 y 22, que eran `activo`, y 15, que era `invitado`). Corta a la persona, no al negocio: la agencia igual puede entrar a inspeccionar.

**Sin hacer:** el motivo de corte «Paga para entrar», que tiene que cortar con el corte global apagado y frenar también al inspeccionar. Lo arma el chat en la nube de `punta/agencia-cobro`. Tiene que estar antes del 9/11, cuando Pablo arranca campañas.

## «Creem está conectado» no quería decir que pudiera cobrar (5/11/2026)

**Síntoma:** Martín: «con Mercado Pago ya recibo el dinero sin problemas, pero todavía no sé cómo recibir el dinero de Creem». Lo obvio era que faltaba configurar el retiro. Era cierto, pero faltaban tres cosas antes:

1. **La migración que deja entrar a Creem en la base nunca se aplicó.** Hubo dos `0358`: se aplicó la de Competitors Spy y «falta la 0358» dejó de nombrar a la de cobros (`docs/hallazgos-infra.md`). Sin ella, `crearCobro` choca con el CHECK y quien le tocara Creem veía «No pudimos abrir el pago». `scripts/verificar-migraciones-aplicadas.mjs` no la detecta: mira nombres, y una restricción ensanchada conserva el nombre. Aplicada el 5/11, medida antes y después.
2. **La tienda no está aprobada.** Panel de Creem el 5/11: 0 de 3 pasos, sin detalles del negocio, sin KYC y sin revisión. Sin eso no se cobra en vivo ni se retira. **La API no lo dice:** tener clave real y aviso habilitado no prueba nada. Sólo se ve en el panel.
3. **No hay nada que retirar:** 0 ventas, 0 clientes y 0 productos en Creem.

**Mercado Pago tampoco está probado de punta a punta.** La cuenta está lista, pero por MaKo hay 2 cobros pendientes y 0 pagados. Parecían cobros 22 pagos aprobados de su cuenta, y en todos el cobrador es otra cuenta.

**La regla:** antes de decir que una pasarela cobra, se mira `cobros` con `pagado_at` y un evento real en `pasarela_eventos`. Lo de la plata de Creem (mínimo US$50, retiros a mano el 1 y el 15, comisiones) está en [creem-retiros.md](creem-retiros.md).

**Sin hacer:**
- Mientras Creem no se apruebe, a un comprador de LATAM fuera de Argentina `pasarelasDelPais` igual le ofrece Creem. Sin medir qué ve: no se hizo ningún POST de compra.
- Creem pide Moderation API a quien genera imagen o video desde un prompt y una política de uso visible, y prohíbe la manipulación de rostros. MaKo no tiene ninguna de las dos cosas y tiene AI Avatar. Puede frenar la revisión: lo contesta soporte de Creem.
- La plantilla de recibos: encargo completo en [relevo/recibos-encargo.md](relevo/recibos-encargo.md).
- El comentario de `lib/credenciales.ts:808` dice que `CREEM_API_KEY` está en `.env.local`, y no está.
