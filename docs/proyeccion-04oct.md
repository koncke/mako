# La proyección al 04/10/2026 — el audio, bajado a tierra contra el código

Esto sale del audio del 04/10 (dos voces: vos proponiendo, Lean refutando) cruzado contra
`/admin/runway` (la foto del 03/10) y contra el código, con seis lectores y seis refutadores.
Todo lo que dice un número tiene archivo:línea. Lo que no se pudo medir está al final, dicho.

---

## 1 · La pregunta que ordena todo lo demás, y hoy el audio la contesta de dos maneras

**¿Qué se cobra primero en la ventana del 1/11 al 15/12: el programa grupal de US$1.500, o
la app de US$47?**

El audio dice las dos cosas: *«voy a vender solamente eso»* (el 47) y *«de última venderle
el del 1500»*. No es un detalle de orden — **cambia la pasarela, el calendario y qué está en
el camino crítico**, y las tres cosas en direcciones opuestas.

### Lo que el repo ya tiene medido sobre cada una

| | el grupal | la app |
|---|---|---|
| precio | US$1.500 | US$47 (US$23,50 el primer mes) |
| caja por venta | **US$1.290,33** `modelo.ts:871` | ~US$23,50 |
| techo de CAC | — | **US$105,27** `modelo.ts:1435` |
| CAC del carrito medido | — | **US$136,22** `modelo.ts:1042` |
| rail de cobro | **Stripe propio** (4,4% + US$0,30) | Paddle (merchant of record) |

**Y los dos rails no son el mismo, por escrito.** La AUP de Paddle prohíbe textualmente
*«pure consulting or advisory services, including but not limited to legal advice,
coaching…»* (`modelo.ts:845-852`), y el propio archivo cierra: *«Stripe propio. NUNCA
Paddle… su botón no puede ir al mismo checkout que los planes»* (`modelo.ts:1611`). O sea:
**son dos checkouts, no uno.**

### La consecuencia, que es contraintuitiva

Con el CAC del carrito en US$136,22 contra un techo de US$105,27, **vender la app de US$47
con pauta pierde plata por cliente**. Contra los US$1.290,33 de caja del grupal, esa MISMA
pauta entra con 7× de margen.

O sea que la cuenta del runway —`2.000 ÷ 100 = 20 agendas × 50% = 10 clientes = US$15.000`—
**no está rota: está medida contra el grupal**, que es el producto que la financia. Lo que
el audio agrega (el frío entra comprando la app) es un embudo distinto, más caro de llenar,
y cuyo número decisivo —cuántos compradores de app hacen falta para una venta del grupal—
**no existe en ningún lado del repo**. Lo más cercano que hay es 3,5% de contactos tibios
que aceptan una llamada *gratis* (`modelo.ts:1295`), y pedir plata baja esa tasa, no la sube.

> **Corrijo algo que te dije en el chat antes de medir:** te escribí que «la cuenta del
> runway describe el embudo viejo». Es al revés — la cuenta del runway es del grupal y
> sigue siendo la que cierra. La que no cierra sola es la app.

---

## 2 · El reloj que no se acelera trabajando más

Es lo único de toda la lista que no depende de vos, y **ninguna de las dos voces del audio
lo nombra.**

- **`MES_0`, marcado `origen: 'medido'`** (`modelo.ts:1267-1277`): *«Paddle APRUEBA el
  negocio antes de activarte y pide esas páginas: **días o semanas ANTES del primer
  cobro**»*. Doce horas tuyas, más la espera.
- **Stripe propio dispara el reloj mexicano**: *«la primera venta a un mexicano arranca un
  reloj de 30 días naturales para inscribirse en el RFC, sin monto mínimo, y exige
  representante legal y domicilio EN territorio nacional»* (`modelo.ts:635`, `:1272`). Y el
  grupal es justo el que va por Stripe propio.
- **Abrirle monotributo a Lean es otro trámite con su propio reloj**, y no lo puedo medir.
- **`/reembolsos` no existe**, y no es chico: el grupal se vende con garantía de devolución
  del 100% en la sesión 1 (`modelo.ts:1606`), y el merchant of record la pide para aprobar
  la cuenta. *«Es el único lugar donde el cliente lee qué pasa si se siente estafado. Se
  escribe antes del primer cobro»* (`modelo.ts:1608`).

**Esto arranca HOY, en paralelo, y no compite con lo técnico porque no lo hace el mismo
recurso.** Si los anuncios arrancan el 1/11 y no hay forma de cobrar, la pauta se quema.

**Y la cuenta de lo que cuesta llegar tarde:** los anuncios corren del 1/11 al 30/11 — son
**30 días con plata**, no 45 (los 45 son la ventana de venta hasta el 15/12). Una semana de
atraso deja 23 días: las 20 agendas bajan a ~15 y los 10 clientes a ~7.

---

## 3 · Lo que el audio pide y YA está construido

Lean tiene razón en casi todo esto, y es lo que más tiempo ahorra.

| lo que el audio pide | estado real |
|---|---|
| **Niveles de acceso** | **Existen y cortan en el SERVER.** Cuatro capas, catálogo completo, y 64 páginas guardadas con `requireCapa` / `requireRolWs` (`lib/capas.ts`, `lib/tab-access.ts:83`). Tipear la URL **no** entra. |
| **Cambiar el plan de un cliente** | Existe, con su mail, y tiene 12 tests probados rompiéndolos (`tests/cambio-de-plan.test.ts`). |
| **El mail de acceso automático** | Existe entero: `invitarPorEmail` (`lib/invitaciones.ts:74`), en español neutro, con preflight que corta si el remitente es sandbox. |
| **El alta completa** | Existe en UN POST y encadena cinco cosas con el orden ya pagado: email único *antes* de la primera escritura, crear workspace, sembrar onboarding, crear usuario con rollback, y el mail declarado no-fatal (`app/api/admin/workspaces/route.ts:80-143`). |
| **Firma de webhook, anti-replay, rollback** | Existen: `lib/standard-webhooks.ts:72-106` (con ventana de 5 min y tolerancia a rotación). `/api/webhooks` ya es prefijo público. |
| **El embudo sin reunión** | Existe la plantilla «Venta directa · sin reunión» (`lib/pipeline.ts:928`): lead → pago → ganado, sin escribir una línea. |

**El webhook de pago no es «escribir la cadena»: es extraer `route.ts:80-141` a una función
de lib, envolverla con el verificador de firma que ya existe, y agregarle idempotencia.**
Eso sí es una tarde, y Lean tiene razón.

---

## 4 · Lo que falta de verdad, y lo que la discusión del audio no vio

### 4.1 · La capa nueva necesita una MIGRACIÓN, y el orden importa

Nadie lo nombró. `workspaces.capa` tiene un CHECK que enumera los cuatro valores actuales
(`0177_capa_agencia.sql:30-32`), y **`capaDef` es FAIL-OPEN** (`lib/capas.ts:329`): un valor
que el código todavía no conoce cae a `completo`, que es la capa con `navKeys: null` — **ve
todo el producto, sin error y sin log.**

El orden correcto ya está escrito en esa misma migración: **el CHECK y el UPDATE van DESPUÉS
del deploy.** Al revés da un 23514 crudo en la cara del usuario; en el otro orden, le abrís
el producto entero a alguien que pagó el plan chico.

Y la lista de lo que ve cada plan son **44 decisiones**, no ~60: `nav.ts` tiene 39 keys de
cliente más 5 de usuario (las otras 54 son del super admin y no entran en ningún plan).

### 4.2 · El cartel de «no está en tu plan» NO es una tarde: son 56 lugares

Hoy el cliente del plan chico que toca una pantalla del grande **no ve un «mejorá tu plan»:
ve un redirect mudo al CRM** — se lee como que la app está rota, y el upsell no ocurre. El
componente que diría la verdad existe desde agosto y **no lo emite ninguna pantalla real**
(`app/_ui/Estados.tsx:251`).

No se arregla cambiando un redirect por un render: `requireCapa` devuelve `Promise<void>` y
el `redirect()` vive *adentro* del guard, así que una página que sólo lo llame seguiría
pintando su contenido. Son **10 `requireCapa` + 46 `requireRolWs`**. Lo honesto y barato:
hacerlo sólo en las 2-3 tabs que el plan de 47 no compra, y dejar el redirect para el resto.

### 4.3 · El argumento de «el 47 con Video Generator no es rentable» tiene la premisa al revés

- **El video hoy NO lo paga MaKo**: lo pagan los créditos de Google Flow del CLIENTE
  (`lib/costo-clip.ts:32`).
- **Lo que sí hace al 47 insostenible es otra cosa, y está medido**: `IA_POR_PRO`
  (`modelo.ts:1359-1375`) dice literal *«reemplaza al US$2,52»*, con `hoyUsd: 10.90`,
  `origen: 'medido'`. Con ese número el margen a 47 es **76,8%** (no 94,2%) y a 23,50 es
  **53,6%** (no 89%). Y sobre el único workspace real medido —**US$68,39/mes de IA**— un
  Pro de 47 es **caja negativa**.
- El motivo está escrito: el cupo que hacía cerrar el 2,52 (`CUPO_MT`) **no tiene un solo
  call-site fuera de la pantalla de pricing.**

**O sea: tenés razón en que el 47 no cierra, y por una razón que se arregla distinto.** No
es sacar el video: es implementar el cupo, o re-medir el costo por cliente. Y hay una
tercera pata, también medida: la banda de retención. Abajo de US$50/mes el GRR anual es 23%
y la vida del cliente 8,7 meses; entre US$50 y 249 es 45% y 15,5 meses (`modelo.ts:231`,
`:1434`).

### 4.4 · Nada corta el gasto de IA de un cliente

*«No existe ninguna primitiva que corte una llamada por gasto»* (`modelo.ts:148`). Y hay
**seis caminos que gastan solos sin que el cliente abra la app**: el webhook de Fathom sin
techo (≈US$52/mes con 10 llamadas/día), el cron `closing-sync` (≈US$31/mes por workspace),
`fathom-plan`… Con 10 clientes el 1/11, **el plan de 47 puede costar más de 47.**

Peor: el gasto de Claude se escribe TODO en el workspace 1, así que **hoy el costo por
cliente es inmedible** (`modelo.ts:145`).

### 4.5 · Los términos publicados dicen que no cobrás

`app/terminos/page.tsx:160`: *«No hay cobros automáticos dentro del producto ni se te va a
cobrar nada sin que lo hayas acordado antes»*. Y cero cláusulas de suscripción, renovación,
cancelación o reembolso. **El día que la pasarela esté viva, esa URL pública —la que abren
los revisores de Google y del merchant of record— afirma algo falso.**

### 4.6 · El comprador de la app entra al CRM y a los 2 días le escribís «no agendaste»

El que compra la app entra en etapa `lead` sin fecha de agenda. El CRM automático lo manda a
**«Nutrición - No Agenda» a los 2 días** y a **«Reactivación» a los 7**: le escribe «no
agendaste la llamada» a alguien que acaba de pagarte.

Y hay un segundo filo: `nutricion_secuencias.funnel_id` existe desde la mig 0170 y **no lo
lee nadie**, así que con dos embudos vivos el mismo lead se enrola en las dos secuencias y
**recibe los dos WhatsApp.**

### 4.7 · Hoy no podés abrir tu propio CRM

La capa `superadmin` (ws9) no declara `crm`, `whatsapp`, `email` ni `chatbot`
(`lib/capas.ts:281`): el server te rebota. Y **no se arregla desde el panel** — la ruta
rechaza explícitamente el workspace de la plataforma (*«Ese es el espacio de la plataforma:
no tiene plan»*, `route.ts:170-172`). El único camino es la línea de `capas.ts:281`.

⚠️ Y va junto con otra cosa: el funnel de ws9 está `declarado=false`, así que el CRM te
dibuja el `DEFAULT_PIPELINE` de high-ticket. **«Darme CRM» y «declarar mi embudo» son UNA
tarea, no dos.**

---

## 5 · Lo que no mapeaste

### La pregunta que hiciste: ¿y si entran personas que venden PRODUCTOS?

**El funnel lo soporta; la entrada de la venta, no.** La plantilla «Venta directa · sin
reunión» existe y termina en Facturando → Ganado. Pero el disparador `pago` está declarado
`auto: true, autoHoy: FALSE` (`lib/pipeline.ts`), y **no hay una sola integración de
ecommerce en el repo**: el grep de `shopify|woocommerce|tiendanube|mercadolibre|hotmart|
kajabi|gumroad|paypal` sobre `lib` y `app` da **cero**.

O sea: a un ecommerce el CRM le queda **como una planilla que mueve a mano, lead por lead**.
No está roto — está vacío, que es peor de detectar.

### Los otros que entran a US$47 y rompen un supuesto

| quién | qué le pasa el primer día |
|---|---|
| **el que vende productos** | CRM sin entrada automática de ventas; el Closing Analyst y el Script Analyst no tienen llamada que analizar |
| **el freelancer sin equipo** | el asignador de vendedor asume un equipo; ya hay una tarjeta (#39) por esto |
| **el que no usa WhatsApp** | el chatbot, la nutrición y los avisos son el corazón del producto y todos salen por ahí |
| **el que no tiene Meta Ads** | `/marketing` y el semáforo quedan vacíos o mintiendo |
| **el que no tiene landing** | el Pixel, el tracking y el VSL Analyst no tienen dónde vivir |
| **el que paga con un mail sin cuenta de Google** | **no puede entrar nunca**: el login es sólo Google, no hay contraseña y la tabla no tiene columna para una |

Esa última es la más cara y es invisible hasta que pasa: el mail de invitación le va a decir
*«entra con Google desde ese mismo email»* a alguien que pagó con un correo que no es Gmail.

### Y una que no es de ICP: el onboarding

El alta siembra `pending` y `guardOnboarding` redirige a `/onboarding` **antes** que a
cualquier tab. El onboarding de la capa `completo` son seis pasos, y el propio catálogo mide
el costo: *«de cuatro clientes reales, dos no terminaron el wizard»*. El paso `gemini` frena
y no tiene excepción.

**El comprador frío de madrugada a US$20 es exactamente el perfil que abandona un wizard.**
El problema que el audio quiere evitar —«pagó y no pudo entrar»— se reemplaza por «pagó,
entró y no pudo usar nada».

---

## 6 · La proyección, si el grupal es lo que se cobra primero

Es el escenario que el código sostiene. Con el otro (vender la app con pauta) hay que
resolver antes el CAC, y eso no es una fecha: es una decisión de negocio.

**Arranca HOY, en paralelo, sin esperar a lo técnico (reloj externo):**
- Decidir identidad fiscal y abrir la cuenta de Stripe propio.
- Escribir `/reembolsos` y la cláusula de cobro en `/terminos`.

**Hasta el 7/10 — no se toca:** P1 técnico (Chatbot · Ads Manager · CRM · Customer Success).

**8 al 9/10:** Onboarding + el video · el documento de oferta y precios. Adentro de ese
documento entra la decisión de **un precio o dos**, que bloquea todo lo de abajo.

**10 al 14/10:** Video + Image Generator (ya fechado).

**15 al 18/10 — los cuatro días que pedís, y lo que entra de verdad:**
- Darte CRM a vos + declarar tu embudo *(una tarea, media jornada)*.
- El embudo de la app con la plantilla que ya existe *(minutos, sin código)*.
- Filtro de embudo en los broadcasts *(media jornada)*.
- La capa nueva + su migración, **con el deploy antes del UPDATE** *(media jornada + la
  decisión de las 44 keys)*.
- El webhook de pago, extrayendo el alta a lib *(una jornada)*.
- La sección de precios y el botón de compra en la landing *(media jornada — ver abajo)*.

**19/10:** arranca la prospección, **cobrando el grupal a mano con un link**. No necesita
pasarela: es llamada y transferencia, y es el camino que el runway ya tiene financiado.

**1/11:** anuncios. Para esa fecha tiene que estar **la pasarela aprobada**, no escrita.

### Lo que NO entra en esos cuatro días, y hay que decir que no entra

- El cierre de capa en las rutas de API (de 251, hoy sólo 5 miran la capa).
- El cartel de «no está en tu plan» en las 56 páginas.
- El estado de suscripción por workspace (vencimiento, dunning). **Para el primer mes se
  vive sin esto; para el segundo, no.**
- El corte de gasto de IA.
- `funnel_id` en el motor de nutrición y en el CRM automático.

---

## 7 · Dos cosas operativas que cambian cómo se escribe

1. **NADIE EDITA `app/vsl/landing-html.ts` A MANO.** Son 170.816 caracteres
   auto-generados desde Claude Design: editarlo lo desincroniza de su fuente y la próxima
   regeneración se come la sección de precios. **La sección de precios se agrega en
   `Landing.tsx`**, que ya monta nodos nuevos sobre el HTML en cuatro lugares
   (`:66`, `:114`, `:135-142`, `:204`), y el botón de compra *tiene* que vivir ahí porque
   necesita estado y handler. Eso baja el ítem de «1-2 días y riesgoso» a chico.
2. **El registro de `/admin/dev` miente en dos lugares** y quien arranque por ahí reescribe
   lo que existe: `areas.ts:797` dice que no hay `/terminos` ni `/privacidad`, y los dos
   existen desde el 5/09 y están linkeados en el footer.

---

## 8 · Lo que no se pudo medir, y no se inventó

- Las alícuotas de **Mercado Pago** cuenta business vs personal, y si el cobro recurrente
  cambia la carga impositiva. **Mercado Pago no aparece en una sola línea del repo**: el
  estudio que hay compara Paddle, Stripe, Lemon Squeezy y Rebill.
- Si el **monotributo de Lean habilita Stripe**, y cuánto tarda.
- La **tasa de upsell del 47 al 1.500**. Es el número del que depende el embudo nuevo
  entero y no existe en ningún lado.
- El costo real de IA por cliente hoy: el gasto de Claude se escribe todo en el ws1, así que
  **es inmedible hasta que se separe.**

---

*Medido el 04/10/2026 contra el código y contra `/admin/runway`. Doce agentes: seis
lectores y seis refutadores, que dieron vuelta nueve afirmaciones — entre ellas el margen
del plan de 47, el proveedor de pasarela y el tamaño del cartel de upgrade.*
