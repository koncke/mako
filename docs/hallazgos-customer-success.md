# Hallazgos — Customer Success

La entrega después de la venta: los clientes ganados de un workspace y cómo va lo que
se les vendió.
Dónde vive el código: `lib/cs-cartera.ts`, `lib/cs-senal.ts`, `lib/cs-contrato.ts`,
`app/customer-success/`.

⚠️ **TODO LO ANTERIOR AL 26/09/2026 ES HISTORIA, Y SUS ARCHIVOS YA NO EXISTEN.** Esas
entradas describen la tab vieja: el programa de 44 clases de UN cliente (el temario, el
cuestionario que contestaba por un link, su curso en Whop, los casos de otros clientes
suyos y el banco de material). Al rearmar la tab para cualquier workspace se borró la
pantalla **y también el código que la sostenía** — una versión anterior de esta cabecera
decía que «sus libs siguen en el repo y las consume la API de MaKo», y eso dejó de ser
cierto el mismo día que se sacaron catorce de las diecisiete operaciones del área.

**Borrados el 26/09/2026** (si una entrada de abajo dice `Vive en:` uno de estos, es un
puntero muerto y la entrada se lee como autopsia, nunca como el estado del código):
`app/customer-success/programa/` · `lib/programa-catalogo.ts` · `lib/programa-campos.ts` ·
`lib/cs-valores.ts` · `lib/cs-respuestas.ts` · `lib/cs-avance.ts` · `lib/cs-avance-clases.ts` ·
`lib/cs-historico.ts` · `lib/cs-mensajes.ts` · `lib/cs-reescritura.ts` · `lib/cs-sync-whop.ts` ·
`lib/cs-tarea-vista.ts` · `lib/banco-skills.ts` · `app/api/webhooks/whop/` ·
`app/api/compartido/tarea/` · `app/compartido/[token]/TareaCliente.tsx` ·
`scripts/cargar-programa-whop.ts` · `scripts/cs-backfill-vistos.ts` ·
`scripts/ensayo-bucle-cs.ts` · `scripts/link-tarea-cliente.ts` · `scripts/apuntar-webhook-whop.ts`.

**Sigue vivo y sin consumidor:** `lib/whop.ts`, `lib/whop-evento.ts` y la tarjeta de la
integración Whop (`lib/integraciones-catalogo.ts`, `lib/metodo-catalogo.ts`,
`lib/metodo-verificar.ts`). Con el webhook y las cuatro operaciones de Whop fuera, un
cliente puede conectar Whop y no pasa nada — decisión pendiente, ver la última entrada.

**Lo que gobierna el código de hoy** está en la última entrada: `lib/cs-cartera.ts`,
`lib/cs-senal.ts`, `lib/cs-contrato.ts`, `app/customer-success/` y las TRES operaciones
que quedaron en `lib/api-mako/areas/cs.def.ts`.

---

## El Deshacer de la entrega repone lo que creía la PANTALLA, no lo que pisó el server (14/10/2026)

Lo encontró la verificación del tablero de Clientes del teléfono, y el escritorio usa el mismo patrón
(`ClientesApp.moverEntrega`). El Deshacer repone la etapa y el reloj de la fila que la pantalla tenía (`previa`). Si
entre la carga y el movimiento el cliente cambió de etapa (MaKo lo pasa por el avance del curso,
lib/curso-avance.ts, o lo mueve otra persona), deshacer:
- lo vuelve a la etapa vieja con el reloj viejo (trabado, en rojo);
- re-enrola las secuencias de esa etapa;
- borra el avance real.

Si la pantalla creía que no tenía fila, deshacer la BORRA.

- **`moverEntregaAction` ya devuelve la verdad:** `desde` es la etapa en la que estaba según el server (null si no
  tenía fila).
- **El teléfono ofrece el Deshacer sólo si `desde` coincide con la pantalla**, y nunca desde una etapa que ya no
  existe, porque el server la rechaza (app/m/cs/CustomerSuccessM.tsx, `sePuedeDeshacer`).
- **El escritorio quedó arreglado distinto, y de raíz (14/10/2026):** `moverClienteDeEtapa` lee también el `etapa_desde`
  de la fila previa y lo devuelve como `relojPrevio`; las dos actions lo pasan, y los dos Deshacer de `ClientesApp`
  (`moverEntrega` y `moverLote`) reponen `desde` + `relojPrevio` del RESULTADO, no la `previa` de la pantalla. O sea
  que con la pantalla vieja el Deshacer igual se ofrece y vuelve a donde el cliente estaba DE VERDAD (Hito 1, con su
  reloj), y si no tenía fila la borra porque el server lo dijo. A una etapa que ya no existe no se ofrece volver.
  Lo fija `tests/cs-deshacer-reloj.test.ts` (probado rompiendo cada pieza: 1 fallo cada una).
- **Pendiente en el teléfono:** con `r.relojPrevio` disponible, `sePuedeDeshacer` podría dejar de suprimir el Deshacer
  cuando la pantalla estaba vieja y reponer lo del server, igual que el escritorio (app/m/cs/CustomerSuccessM.tsx).

## La API de Whop no deja leer las respuestas de una tarea

**Vive en:** `lib/whop.ts`

**El síntoma que no hubo:** ninguno. Es una decisión de arquitectura que, tomada mal,
se descubre recién cuando el bucle está construido.

**Lo que sí tiene** (verificado contra su API, 2026-08-11): cursos, capítulos,
lecciones, alumnos, `course_lesson_interactions`, y el webhook
`course_lesson_interaction.completed`. Con eso alcanza para saber **quién completó qué
clase**, que es lo que hace falta para recordarle al que se quedó y para armar el
resumen previo a la junta.

**Lo que NO tiene:** endpoint para **leer** las respuestas de un `assessment` — solo
para enviarlas — ni ningún lugar donde guardar datos propios por miembro.

**La regla que queda:** un objeto que se edita a varias manos no vive en un LMS. La
tarea de cada bloque la escribe el cliente, la reescribe la IA con lo hablado en la
junta y la aprueba el cliente: eso es un documento a tres manos, no un examen
corregido. Vive en `cs_respuestas` (mig 0125) y Whop solo aporta la señal de avance.

**Corolario que cuesta ver:** el cuerpo de una lección de Whop es **el mismo para todos
los alumnos** — no se personaliza. Un link ahí no puede llevar el token de nadie, así
que o pide identificarse o abre la tarea de otro. El link personal lo manda MaKo.
Lo aprendí después de haber cargado 42 lecciones con un link inútil adentro.

---

## Whop firma con Standard Webhooks, y el verificador ya estaba escrito dos veces

**Vive en:** `lib/standard-webhooks.ts` (antes duplicado en `lib/fathom.ts` y `lib/resend.ts`)

**El diagnóstico obvio era el equivocado.** Escribí la verificación estilo Stripe
(`t=<unix>,v1=<hex>`, con el secreto crudo como clave del HMAC). Whop usa **Standard
Webhooks (Svix)**, igual que Fathom y Resend. Habría rechazado el 100% de los webhooks
con un error indistinguible de un secreto mal pegado — el peor síntoma posible, porque
manda a revisar lo único que estaba bien.

**Los tres detalles que fallan siempre**, y ninguno da una pista que apunte al lugar
correcto (los tres dicen «firma no coincide»):

1. El secreto **no** es la clave: va base64-**decodificado** y sin el prefijo `whsec_`.
2. La salida es **base64**, no hex.
3. El body tiene que ser el **texto crudo**. Un `JSON.parse` + `JSON.stringify` cambia
   orden y espaciado, y el HMAC deja de dar. Por eso `request.text()` va en la primera
   línea de la ruta: un `request.json()` consume el stream y ya no hay crudo.

**Y una que parece laxitud y no lo es:** el header trae *N* firmas `v1,<sig>` separadas
por espacio, y hay que aceptar **cualquiera**. Durante una rotación de secreto el
proveedor manda la vieja y la nueva juntas; comparar el header entero rechaza todo el
tráfico mientras dura.

**La regla:** el verificador devuelve el **motivo** y no un booleano. «timestamp viejo»
manda a mirar el reloj y «no coincide» manda a mirar el secreto; un `false` pelado manda
a revisar el secreto en los dos casos. `tests/standard-webhooks.test.ts` fija los tres
detalles.

---

## Un identificador de ruteo que se pregunta es un identificador que secuestra

**Vive en:** `lib/whop.ts` → `whopCompanyId` / `registrarRuteo`

Un webhook llega sin sesión: la única forma de saber de qué workspace es el evento es
`webhook_routing`. El molde del repo (Fathom, Meta, Calendly) es pedirle al usuario el
identificador y espejarlo al guardar la credencial.

**El problema de ese molde:** esos identificadores **no son secretos** (el id de una
página de Facebook es público). Un admin que pega el de otro le roba los webhooks —
está documentado en `lib/webhook-routing.ts`, y por eso `upsertRouting` es
primer-reclamante-gana.

**Lo que se hizo distinto acá:** el `company_id` de Whop **se deriva** de la propia API
key (`GET /accounts/me`) y se reclama solo la primera vez que se resuelve. No hay campo
que llenar, y por lo tanto no hay campo que llenar con el id de otro. Verificado:
`whop / biz_1FDimrbhXluff7 → ws 1`.

**Bonus:** es también un campo menos en el formulario, que es la regla de producto de
siempre (defaults antes que configuración manual).

⚠️ **El precio de derivarlo (16/09/2026): cualquier LECTURA de Whop puede escribir el ruteo.**
`whopCompanyId`, con el caché frío (10 minutos por workspace), hace
`void registrarRuteo(ws, id)` (`lib/whop.ts:94-105`), y lo llaman `listarCursos`,
`listarExperiencias` y todo lo que necesita `company_id` (:165-175). Es best-effort y
primer-reclamante-gana, así que no roba nada; pero una consulta que se ofrece como «solo
lectura» —un listado de cursos pedido desde MaKo— puede dejar una fila nueva en
`webhook_routing`. La API de MaKo lo aceptó por escrito (`lib/api-mako/areas/cs.run.ts:10-11`).
**Lo que falta:** una variante de `whopCompanyId` sin registro en `lib/whop.ts`, para los
caminos que prometen no escribir. *2026-09-16 api-mako-areas*

---

## El cron tiraba las reuniones de entrega, y las dos explicaciones eran falsas

**Vive en:** `lib/reunion-auto.ts` (el filtro `TIPOS_AL_PLAN`)

**El síntoma:** una junta con un cliente ya ganado se grababa en Fathom y no dejaba
absolutamente nada. Ni tarea, ni borrador, ni aviso.

**La causa real:** UNA línea. El cron se quedaba solo con `tipo === 'equipo'` y
descartaba el resto antes de cualquier análisis.

**Las dos cosas que yo había escrito y eran falsas:**

1. **«El destino no existe».** Existe, y estaba **66 líneas más abajo del filtro que
   impedía llegar**: `resolverClienteDeReunion` + `nombreDeProyectoPara` ya mandan
   todas las tareas de una llamada con cliente al proyecto «Cliente: X». Redactado como
   «no hay destino», el hallazgo invitaba a construir un módulo nuevo cuando el arreglo
   eran ocho líneas.
2. **«`reunion-gate.ts` las frena».** El cron **ni lo importa**. Su único call-site es
   el modal manual, y ahí ni siquiera bloquea: pinta un banner y la extracción sigue.
   O sea que el camino manual ya procesaba reuniones de entrega.

**La trampa que aparece recién al arreglarlo:** en una junta de equipo todos los
participantes son del workspace, así que `esDeOtro` + `dueñoEmail` siempre apuntaban a
alguien con cuenta. En una de **entrega**, «el otro» puede ser **el cliente**. El
primer efecto visible del arreglo habría sido ofrecer mandarle tareas internas a alguien
de afuera. Por eso el reparto quedó acotado a emails del workspace (o admins), y el
nombre se conserva igual en el detalle.

**Y lo que quedó mintiendo, corregido en el mismo commit:** el campo se llamaba
`deEquipo` y el log del cron imprimía `equipo=N`. Sumando las de entrega, el log habría
dicho «equipo=4» contando juntas con clientes, y el próximo diagnóstico habría salido
mal. Ahora es `alPlan`.

---

## Cargar contenido en una API sin «crear si no existe»

**Vive en:** `scripts/cargar-programa-whop.ts`

La API de Whop no tiene upsert ni borrado en lote. Correr el cargador dos veces sin
comparar antes deja el curso con 84 lecciones duplicadas y ninguna forma cómoda de
limpiarlas. Por eso cada nivel (experiencia → curso → capítulo → lección) se busca **por
título** antes de crear. Verificado: la segunda corrida crea 0.

**La consecuencia que no es obvia:** idempotente por título significa que una lección
creada con el cuerpo equivocado **se queda con él para siempre**. Hizo falta enseguida
(el link inútil), así que el cargador tiene `--actualizar`, que además es lo que va a
enganchar los videos el día que existan sin borrar y recrear —lo cual perdería el avance
de quien ya la completó—.

**Y la que casi se rompe sola:** el título de la lección se armaba en **tres lugares**
(el cargador, `reconstruirMapa` y `rotuloDe`). Un espacio de diferencia entre dos de
ellos deja el mapa lección→clase reconstruido **vacío**, sin un solo error: el webhook
empieza a contestar «lección desconocida» para todo. Ahora lo arma `rotuloDe` y nadie
más.

---

## Mirar la clase no es contestar la tarea

**Vive en:** `supabase/migrations/0127_cs_visto.sql`, `lib/cs-avance.ts`

Son dos hechos distintos y llegan por caminos distintos: el webhook de Whop dice que
completó el video, el formulario dice que contestó. Meterlos en la misma columna borra
justo el estado que hace falta ver antes de cada junta —**«la vio y no la contestó»**—
que es el que dispara el recordatorio, y que sin la columna se confunde con «ni la
abrió».

Por eso `registrarAvanceDeClase` escribe `visto_at` y **nada más**: nunca mueve el
estado del bloque.

---

## `/api/compartido` es solo-lectura a nivel middleware, y el 405 no dice por qué

**Vive en:** `lib/rutas-publicas.ts` → `PUBLICOS_ESCRITURA`, `proxy.ts:192`

**El síntoma:** la ruta nueva `POST /api/compartido/tarea` devolvía **405 Method Not
Allowed** a todo. El archivo existía, compilaba, el typecheck pasaba y el build la
listaba. El cuerpo del 405 es texto plano sin explicación.

**La causa:** `proxy.ts` corta con 405 cualquier método que no sea GET/HEAD/OPTIONS
sobre los prefijos de `PUBLICOS_SOLO_LECTURA`, y `/api/compartido` está ahí. El handler
nunca corre. Es un guard **deliberado**: el early-return de las rutas públicas se saltea
el chequeo CSRF de Origin, así que una pública que acepte POST queda expuesta si además
se autentica por cookie.

**Por qué esta ruta sí puede escribir:** se autentica con el token del link, que viaja en
el **cuerpo** del request. Una página ajena puede mandarle un POST, pero sin el token no
escribe nada — y el token es la credencial entera. No hay autoridad ambiente que abusar,
que es justo lo que el chequeo de Origin protege. Es el mismo razonamiento que ya está
escrito para el bearer de `/api/agente/*`.

**La regla:** la excepción se lista **exacta**, en `PUBLICOS_ESCRITURA`, nunca por
prefijo — y NO se saca `/api/compartido` de la lista de solo-lectura, porque eso abriría
a POST toda la carpeta incluidas las rutas que todavía no existen. Es el mismo criterio
por el que `/api/agente/token` quedó afuera una por una.

**Cómo se diagnostica rápido**, que es lo que costó acá: un 405 sobre una ruta pública
casi siempre es el middleware, no el handler. Se confirma mirando si la respuesta trae
los headers de seguridad que pone `proxy.ts` (`X-Frame-Options`, `Content-Security-Policy`)
con un cuerpo `text/plain`. Es el mismo truco que la tabla de AGENTS.md para el 401.

---

## Un textarea que no dice si guardó es un textarea que pierde trabajo

**Vive en:** `app/compartido/[token]/TareaCliente.tsx`

Quien contesta es un empresario sin cuenta, probablemente desde el teléfono. Tres
decisiones que salen de ahí y que conviene no revertir:

- **Autosave con 2 s de freno**, no un botón «Guardar». Un botón que no se toca pierde
  todo, y un POST por tecla es ruido.
- **`sendBeacon` en `pagehide`**: si cierra la pestaña con algo sin mandar, se manda
  igual. Un `fetch` normal muere con la navegación.
- **El error se muestra.** Dejarlo creer que quedó guardado, después de que escribió a
  mano media pantalla, es la peor forma de fallar acá. Por eso el endpoint devuelve 500
  —y no el 404 genérico del resto de `/compartido`— cuando falla el guardado: es el único
  caso donde el que entró TIENE que enterarse.

---

## El secreto de un webhook no siempre es base64, y el prefijo lo dice

**Vive en:** `lib/standard-webhooks.ts` → `claveDelSecreto`

Standard Webhooks dice «el secreto va base64-decodificado». Es cierto para Fathom y
Resend, que entregan `whsec_<base64>`. **Whop entrega `ws_` + 64 hex, que no es base64.**

Sus propios SDK (Python, Ruby) hacen literalmente `base64encode(WHOP_WEBHOOK_SECRET)`
antes de pasárselo al verificador estándar, que después lo decodifica. La vuelta completa
deja **el string entero, prefijo incluido, como clave del HMAC**.

**Por qué falla en silencio:** `Buffer.from('ws_0200…', 'base64')` **no lanza** — descarta
los caracteres inválidos y devuelve bytes. Bytes equivocados, pero bytes. El resultado es
«firma no coincide», que es el mensaje que manda a revisar el secreto: lo único que estaba
bien.

**La regla:** la tabla prefijo → clave vive en UN lugar y se deriva del propio secreto,
nunca se pasa por parámetro. Así el que conecta una integración nueva no puede
configurarlo mal. Y un secreto que decodifica a **cero bytes** es `sin-secreto`: con clave
vacía el HMAC igual se calcula, así que sin ese corte cualquiera firma.

---

## El webhook apuntaba a la raíz del dominio, y Whop lo daba por entregado

**Vive en:** `scripts/apuntar-webhook-whop.ts`

El webhook creado a mano en el panel quedó en `https://hola-mako.com/` en vez de
`/api/webhooks/whop`. Whop entregaba, la landing devolvía **200**, y el evento se perdía.
Del lado de Whop se ve como una entrega exitosa; de este lado no se ve nada.

**Cómo se detecta:** `GET /webhooks?company_id=…` lista la URL configurada. Vale la pena
mirarla antes de debuggear el receptor — el receptor puede estar perfecto.

---

## Los ids de lección de Whop son `lesn_`, no `less_`

**Vive en:** `lib/whop-evento.ts`

Asumí el prefijo. Con `startsWith('less')` el receptor descartaba **todas** las lecciones:
un payload bien firmado, del workspace correcto, con un id de lección existente,
contestaba «sin id de lección». Y con 200, o sea que Whop lo daba por entregado.

**Lo encontró un evento real contra producción, no un test** — y no podría haberlo
encontrado un test, porque los datos de prueba los habría inventado con el mismo prefijo
equivocado. La aserción ahora usa un id de la cuenta real: `lesn_NxR3LfLTx5zpH`.

**La causa de fondo, que es la lección transferible:** una clave EXPLÍCITA se toma tal
cual. Si el campo se llama `course_lesson_id`, ES el id de la lección y no hay nada que
validar. El filtro por prefijo solo tiene sentido para el `id` pelado, que en un evento de
interacción es el id de LA INTERACCIÓN.

**Y la regla de la casa que apareció al ir a escribir el test:** `lib/whop.ts` tiene
`server-only`, así que ningún test lo puede importar — la parte que decide de qué clase y
de qué cliente es un evento era lo único del camino sin una sola aserción. El parseo se
mudó a `lib/whop-evento.ts`, sin `server-only`. Mismo criterio que `lib/model-catalogo.ts`
y `exigirClienteDePrueba`.

---

## Reescribir un texto «con lo que se habló» necesita la conversación, no las tareas

**Vive en:** `lib/cs-reescritura.ts`, `lib/plan-fathom.ts` → `ExtractOut.cabecera`

`extraerTareasDeReunion` devolvía las tareas y nada más. Enganchar ahí el prompt de
reescritura —que es lo natural, está en la misma función— le habría dado al modelo una
lista de **títulos** en vez de la conversación. Y un modelo al que se le pide «mejorá este
texto con lo que se habló» siempre devuelve algo: el resultado se ve plausible y es
inventado.

La `cabecera` (el resumen de Fathom más sus action items) ya estaba construida ahí mismo,
así que devolverla es gratis. La alternativa —volver a pedirle el transcript a Fathom—
paga el fetch dos veces.

⚠️ **Lo que eso deja afuera (16/09/2026): la cabecera no se guarda en ningún lado.** Vive en
memoria mientras corre el cron (`lib/reunion-auto.ts:222-283`), así que la reescritura corre
UNA vez, en la corrida automática, y no se puede volver a pedir —ni desde una pantalla ni desde
MaKo— sin correr la extracción entera de nuevo. Pedirle la cabecera a un modelo como parámetro
no es una salida: sería que la transcriba. Por eso `reescribir_bloques_junta` y
`reescribir_bloque_cliente` quedaron fuera de la API (`lib/api-mako/areas/cs.def.ts:33-37`).
**Para que existan:** persistir la cabecera junto a la reunión, en `lib/reunion-auto.ts`.
*2026-09-16 api-mako-areas*

**Las tres reglas del prompt están además en el código**, porque una regla que solo vive
en la prosa se cumple «casi siempre»:

- no pisa lo del cliente → lo garantiza `proponerReescritura`, que escribe en otra
  columna;
- si la junta no habló del tema, `SIN_MATERIAL` y el saneo lo descarta (también
  entrecomillado o con punto);
- sin respuesta previa no hace nada: escribirla de cero sería ponerle en la boca al
  cliente algo que nunca dijo, y llegaría a la pantalla de aprobación como si él lo
  hubiera escrito antes.

**Y no elige «el bloque de esta junta»:** reescribe todos los abiertos y deja que el
modelo descarte los que no se tocaron. Una sesión no corresponde a un bloque, y cuál se
debatió lo sabe quien leyó la conversación, no un calendario.

---

## Un campo opcional que alguien gatea con un `if` es una falla silenciosa esperando

**Vive en:** `lib/plan-fathom.ts` → `ExtractOut.cabecera`

Agregué `cabecera?: string` a `ExtractOut`, escribí el comentario explicando que devolverla
era gratis… **y no escribí la línea que la devuelve.** El paso que reescribe la tarea del
cliente después de la junta se gatea con `if (r.tipo === 'entrega' && cliente && cabecera)`,
así que quedó como **código muerto en producción**.

**Y nada lo agarró.** El typecheck pasó (el campo era opcional). Los 613 tests pasaron. El
ensayo end-to-end pasó en verde — porque llamaba a `reescribirBloque` **directamente**,
salteándose justo el eslabón roto. Lo encontró una auditoría leyendo el camino entero,
eslabón por eslabón, preguntando por cada uno «¿esta condición es alcanzable?».

**La regla:** un campo que alguien va a usar como guarda va **obligatorio**. Ahora
`cabecera: string` sin `?`, y olvidarse es un error de compilación — el compilador señaló
al toque el `return` que la venía omitiendo desde el principio.

**Y la lección sobre el ensayo:** un test end-to-end que llama a la función de adentro no
prueba el camino, prueba la función. Si el paso real es *cron → extractor → reescritura*,
saltear el extractor es saltear exactamente donde estaba el bug.

---

## La reescritura colgaba de que la junta hubiera dejado tareas

**Vive en:** `lib/reunion-auto.ts`

El `if (!tareas.length) { … continue; }` estaba 33 líneas ANTES del bloque de Customer
Success. O sea: una sesión de entrega que no deja un solo compromiso accionable —que es el
caso **normal** de una junta donde se afina el Norte— no reescribía nada, y el cliente nunca
veía qué aprobar. Peor: esa reunión quedaba marcada como vista y no se reintentaba nunca.

Son dos cosas distintas que pasan en la misma llamada: sacar tareas para el plan, y mejorar
la respuesta que el cliente ya había escrito. La segunda no depende de la primera. El bloque
de CS ahora corre **antes** del `continue`.

---

## Una reconstrucción a medias no puede pisar una buena

**Vive en:** `lib/cs-avance.ts` → `reconstruirMapa`

El mapa lección→clase se reconstruye preguntándole a Whop: ~14 requests. Un 429 a mitad de
la tanda dejaba un mapa con la mitad de las lecciones, y **se guardaba igual** «con tal de
que haya matcheado alguna».

El efecto se alimenta solo: las clases del tramo que falló pasan a contestar «lección
desconocida», y cada evento suyo dispara OTRA reconstrucción de 14 requests, sincrónica,
dentro del handler del webhook. Un alumno mirando cinco clases seguidas son 70 requests y
cinco webhooks al borde del timeout.

Dos cortes: **si la reconstrucción falló en algún tramo y no mejora lo que ya había, no se
guarda**; y un freno de 10 minutos por workspace. El freno vive en memoria del proceso a
propósito: perderlo cuesta una reconstrucción de más, no un dato mal.

⚠️ **Ampliado el 16/09/2026: el corte protege contra Whop, no contra la base, y no le avisa a
nadie.**

- **Compara contra un mapa previo leído con el lector que no tira.** `previo` sale de
  `getMapaLecciones` (`lib/cs-avance.ts:88`), que ante un 5xx vale `{}`. Con eso la condición
  de la línea 90 da falso para cualquier tanda a medias que haya matcheado algo, y **la tanda a
  medias pisa el mapa bueno**: exactamente lo que el corte venía a impedir.
- **`reconstruirMapa` no dice que falló.** Si falla `listarCursos` devuelve `{}` sin guardar
  (:64); si falló un tramo y no mejora, devuelve el previo (:92). El que llama ve «sin
  cambios» con la key de Whop rota. Comparar tamaños antes y después no es verificar: la
  bandera de fallo la tiene que devolver la lib.
- **El freno no se puede compartir**: `reconstruirConFreno` es privada (:110). La API de MaKo
  tiene el suyo, también de 10 minutos (`lib/api-mako/areas/cs.run.ts:89`), en otra memoria:
  una reconstrucción pedida desde MaKo no frena la del webhook, ni al revés.

**Lo que quedó SIN hacer**, las tres en `lib/cs-avance.ts`: leer el previo con
`getSettingEstricto`, que `reconstruirMapa` devuelva `{ mapa, fallo }`, y exportar el freno. No
se tocaron desde la API porque la lib la comparten la pantalla `/customer-success` y el webhook
de Whop. *2026-09-16 api-mako-areas*

---

## ⚠️ En Customer Success «no pude leer» sale como «no hay nada», y con esos ceros se decide

**Vive en:** `lib/cs-respuestas.ts:56-71` · `lib/cs-cartera.ts:194-208` · `lib/cs-avance.ts:35-42` ·
`lib/cs-mensajes.ts:52-69,77-94` · *2026-09-16 api-mako-areas*

**El síntoma:** con la base caída, la cartera muestra 0 cuotas vencidas y 0 links vivos, un
bloque figura como «el cliente nunca lo tocó», el mapa de lecciones dice «0 mapeadas», y el
aviso «te dejé las respuestas para aprobar» contesta ok sin haber dejado nada. Ningún error a la
vista.

**La causa, en cuatro lugares:**

- `getBloque` y `bloquesDeCliente` desestructuran `{ data }` y nunca miran `error`: un fallo de
  PostgREST sale como `null` o `[]`.
- `cartera()` pasa cada lectura por el helper `leer`, que devuelve `data ?? []` y además atrapa
  lo que tire, y `listarShares(...).catch(() => [])`.
- `getMapaLecciones` lee con `getSetting`, que convierte un 5xx en `null` y de ahí en `{}` (ver
  [hallazgos-infra.md](hallazgos-infra.md) → `getSetting`).
- `borradorHayQueAprobar` y `borradorVioYNoContesto` devuelven `ok: true` después de
  `crearBorrador`, que devuelve `void` y no mira el error del insert
  (`lib/evolution-envio.ts:116-138`).

**Por qué acá pesa doble:** esos ceros no solo se muestran, **deciden**. La cancha
(`cancha()`, `lib/cs-cartera.ts:107-128`) se calcula sobre ellos: sin sesiones leídas, el
cliente pasa a «Cerró hace meses y nunca tuvieron una sesión»; sin shares leídos, a «Todavía no
tiene su link». Un mapa vacío hace que cada evento del webhook dispare una reconstrucción
(`lib/cs-avance.ts:133-136`). Y un bloque que vuelve `null` hace que la reescritura de la junta
lo saltee como si el cliente no hubiera escrito nada (`lib/cs-reescritura.ts:103-107`).

**La regla:** una lectura fallida no es un valor del dato. Si el número gobierna una decisión, el
error sube hasta quien decide, y quien decide no decide.

⚠️ **Y uno de esos ceros no necesitaba que se cayera nada (17/09/2026).** La cartera pedía
`pagos.fecha_vencimiento`, una columna que **nunca existió** (la real es `fecha_esperada`). La
consulta fallaba SIEMPRE, `leer` la volvía `[]`, y la cartera mostró «0 cuotas vencidas» para
todos los clientes desde el primer día. Se arregló con el alias
`fecha_vencimiento:fecha_esperada`, y **cambia la pantalla**: aparecen 2 cuotas vencidas en ws1
y 2 en ws11 que antes no se veían. Un wrapper que traga errores no distingue «la red se cayó»
de «la consulta está mal escrita»: el segundo caso es permanente y se ve exactamente igual.

En la misma pasada, las lecturas en lote de la cartera (`closing_analyses`, `pagos`,
`cs_respuestas`, `cs_clientes` por `.in('lead_id', ids)`) pasaron a `leerTodo`. La que iba a
cortar primero es `cs_respuestas`: unos 44 bloques por cliente en UNA consulta, así que con
unos 23 clientes contestando ya pasaba las 1000. Siguen devolviendo vacío si fallan, como antes
(`lib/cs-cartera.ts:180-228`). Y «última sesión» se ordena en memoria: con
`.order('call_date', desc)` Postgres ponía primero las sesiones SIN fecha.

**Lo que quedó SIN hacer:** que las cuatro propaguen el error. No se tocaron porque las comparten
la pantalla `/customer-success` y el webhook de Whop, y cambiar el contrato es cambiarlo para los
dos. Mientras tanto la API de MaKo tiene sus copias estrictas (`bloqueDe`, `bloquesDe`,
`mapaLeccionesEstricto` en `lib/api-mako/areas/cs.helpers.ts`) y relee la cola después de crear
un borrador: son dos implementaciones de la misma lectura, y la de la pantalla sigue diciendo
cero.

---

## Una variable CSS que no existe no falla: invalida la declaración y sigue

**Vive en:** `app/customer-success/programa/ProgramaApp.tsx` (corregido; BORRADO el 26/09/2026)

Usé `--ink-70`, `--ink-40`, `--ink-15`, `--ink-05` y `--lime-ink` **17 veces**. Ninguna
está definida en `app/globals.css`. Los colores de esa pantalla estuvieron mal en
producción durante días.

**Por qué no lo agarró nada:** una custom property indefinida no cae a un valor por
defecto — invalida la declaración entera y la propiedad hereda. El resultado se parece
bastante a lo correcto, así que pasó el typecheck, los 646 tests y mi propia lectura del
HTML renderizado.

**De dónde salió:** las copié de `app/conocimientos/CursoPortal.tsx`, que **sí** las
define… adentro de su scope `.cono`. Ahí andan. En la app principal no existen.

**La regla:** copiar un `var(--x)` de otra pantalla sin mirar dónde NACE es cómo se
propaga esto. Los nombres reales del sistema son `--ink`, `--dim`, `--faint`, `--border`,
`--border-strong`, `--surface`, `--surface-2`, `--mako`, `--mako-ink`, `--mako-bg`,
`--good`, `--warn`, `--bad`.

---

## Skool no tiene vista de autor, y esa es justo la que hacía falta

**Vive en:** `app/customer-success/programa/ProgramaApp.tsx` (BORRADO el 26/09/2026)

Se midió el classroom de Skool **en vivo** (DOM real, no de memoria): grilla de ancho
fijo 1082px con cards de 350×355 y portada 16:9 a sangre; rail izquierdo de 328px con
filas de 48px; la fila activa en ámbar pálido; la clase es un `?md=` del mismo curso, no
una página nueva.

**Pero su parte de autor no existe.** Para ver el avance de un miembro hay que entrar
miembro por miembro, y no hay vista del temario completo — hay una extensión paga que
sólo hace eso. Circle sí la tiene.

**La regla que queda:** «copiá cómo lo hace X» casi nunca significa copiar X entero.
Acá se copió la ESTRUCTURA (grilla → rail + documento) y se descartó el CONTENIDO: donde
Skool pone una portada van los datos que dejan auditar el temario, porque el que mira no
viene a reconocer un módulo por su arte, viene a ver si está balanceado y dónde faltan
videos.

---

## La primera regla de triaje se traga la pantalla si no se mira con datos reales

**Vive en:** `lib/cs-cartera.ts` → `cancha()`

La cartera agrupa por «de quién es la pelota». La primera regla que escribí era «si no
tiene link, te toca a vos» — verdadera, y **metía a los 13 clientes en el mismo grupo**.
La pantalla dejaba de triar absolutamente nada.

Peor: a un cliente con **187 días sin una sola sesión** le decía «dale su link». Ahí lo
que pasa es otra cosa, y se arregla con una llamada, no con un mail.

**La regla:** en una función de clasificación, el ORDEN de los `if` ES el diseño, y no se
puede validar leyendo el código — hay que mirar la pantalla con los datos de producción.
Ahora la razón se lee distinta según el caso: «Se enfrió: 187 días sin una sola sesión»,
«Cerró hace meses y nunca tuvieron una sesión», «Todavía no tiene su link».

**Y el corolario del denominador:** «Semana 37 de 26» se lee como un error de cálculo.
Pasado el largo del programa el dato útil deja de ser el denominador: dice «37 · se pasó».

---

## Los datos del CRM que la cartera no estaba usando

**Vive en:** `lib/cs-cartera.ts`

`leads` tiene **80 columnas**. La cartera mostraba dos. Lo que estaba disponible y sin
usar, medido sobre los 13 clientes reales:

| Dato | Dónde | Cobertura |
|---|---|---|
| `fecha_cierre`, `monto_cierre_usd` | `leads` | **13 de 13** |
| `telefono` | `leads` | 12 de 13 |
| `empresa` | `leads` | 10 de 13 |
| `fecha_inicio_servicio` | `leads` | **8 de 13, y sucia** |
| `duracion_meses` | `leads` | **2 de 13** |
| Sesiones grabadas | `closing_analyses` | 109 filas |
| Cuotas | `pagos` + `getCuotasPendientes` | 33 filas |

⚠️ **La primera de estas dos decisiones ya no vale y quedó escrita para que nadie la
copie.** El reloj se sacaba de una constante de 26 semanas que era INVENTADA: los
contratos firmados dicen 16 semanas y 3 meses. Hoy sale de `lib/cs-contrato.ts`, que lee
el contrato primero, la ficha después, y devuelve `null` antes que inventar — la card
muestra las semanas transcurridas sin denominador. La regla que queda: **un dato que no
está no se reemplaza por un promedio; se muestra el hueco.**

**Dos decisiones que salen de ahí.** El reloj del programa era una **constante** (26
semanas) y no `duracion_meses`: derivarlo del dato dejaría a once clientes sin reloj. Y
la semana se calcula con la fecha **más reciente** entre inicio de servicio y cierre —
hay una ficha que arranca cuatro meses ANTES de la venta, y eso es un dato mal cargado,
no un cliente que empezó antes de comprar.

**Y lo que NO se hizo, a propósito:** ningún health score. Con 13 clientes un 78/100
esconde el hecho —«cuota vencida hace 9 días»— detrás de un número que nadie sabe cómo se
calculó. Las plataformas de CS lo usan porque miran 3.000 cuentas.

---

## El temario se cortó donde se cortaba el CUESTIONARIO, no donde se corta una clase

**Síntoma:** «44 clases son 44 videos. Es mucho para grabar de una» — escrito en
`docs/programa-mauricio.md` como una limitación del programa, no como un error.

**Causa:** el corte en clases se heredó de cómo estaban tabulados los dos Cuestionarios
Maestros. Las cuatro secciones de la carta de expectativas (9.1 a 9.4) son cuatro campos
consecutivos del cuestionario y **una sola explicación**; los tres umbrales del módulo 8
son verde, amarillo y rojo de un mismo ejercicio. Grabar un video por campo es grabar la
misma introducción cuatro veces.

**La regla, y es la parte que importa: FUSIONAR EL VIDEO NO ES FUSIONAR EL BLOQUE.** Son
dos ejes independientes y confundirlos rompe cosas distintas:

| | Qué cuesta | Qué pasa si se fusiona |
|---|---|---|
| **El video** | tiempo de Mauricio frente a la cámara | nada: el cliente ve una explicación completa en vez de cuatro cortadas |
| **El bloque** | nada | se rompe el bucle: el bloque ES el gate de la sesión, la unidad de la reescritura de la IA y el estado de aprobación |

Por eso `mismoVideoQue` (en `lib/programa-catalogo.ts`) junta **solo la grabación**. Las
44 tareas, sus 118 preguntas y sus 44 estados siguen intactos; lo que baja a 25 es lo que
hay que grabar. Cinco revisiones adversariales del temario, cada una atacando por un lado
distinto, llegaron por su cuenta al mismo salvavidas: *«fusionar el VIDEO, no el BLOQUE»*.

⚠️ **Y agrupar no reordena.** El rótulo («0.3 · Cómo funciona cada bloque») sale de la
POSICIÓN de la clase en su módulo y es lo que ve el cliente en Whop y en sus mensajes de
WhatsApp. Mover una clase de lugar para dejar juntas las que comparten video le renumera
el temario a alguien que ya lo tiene abierto. El agrupador usa un Map para no necesitar
que estén pegadas, y hay un test que lo fija.

**Vive en:** lib/programa-catalogo.ts (`mismoVideoQue`, `GRABACIONES`) ·
tests/programa-catalogo.test.ts · app/customer-success/programa/ProgramaApp.tsx (BORRADOS el 26/09/2026; tab
Clases) · *2026-08-11 ~programa-mauricio-recorte*

---

## El módulo de los umbrales nunca pregunta el amarillo

**Síntoma:** ninguno. El programa corre y nadie lo nota.

**El hecho, verificado contra `lib/programa-campos.ts`:** el módulo 8 —el único que
contesta **el líder del área**, porque los umbrales los pone quien va a responder por
ellos— tiene cuatro preguntas: el piso ya logrado (5.1), el verde (5.2), el rojo (5.3) y
el caso inadmisible (5.4). **El amarillo no se pregunta ni una vez.** El único lugar del
programa donde existe es la ficha de nueve campos de 6.5, que la contesta **el dueño**.

**Por qué importa:** el `atoro` medido de esa misma clase dice que el error más común son
los *«rangos sin traslape entre verde, amarillo y rojo»*. No se puede chequear el traslape
de tres rangos cuando uno de los tres lo fija otra persona en otro módulo. La verificación
es inherentemente cross-módulo y hoy no la hace nadie.

**Lo que queda sin hacer:** es una decisión de contenido de Mauricio —agregar el amarillo
al módulo 8, o aceptar que baja de la ficha—, así que quedó anotada y sin tocar.

**Vive en:** lib/programa-campos.ts (`CAMPOS.m8c1..m8c3` vs `CAMPOS.m6c4`) ·
lib/programa-catalogo.ts (m8, `quien: 'líder de área'`) · *2026-08-11 ~programa-mauricio-recorte*

---

## 4.3 y 6.4 traen el mismo atoro escrito dos veces

«El objetivo de cada área» (4.3) y «El número del área, con su base y su fuente» (6.4)
piden lo mismo: el número, su base de hoy, su fuente, y si el área ya lo calcula. Y sus
`atoro` son la misma frase con las palabras cambiadas de orden — *«si hay que inventar un
reporte, no entra en este ciclo»*.

La diferencia real es de **grano**: 4.3 se contesta una vez para todas las áreas (es una
tabla) y 6.4 una vez POR área (el módulo 6 es `porArea`). Eso justifica dos tareas, pero
no dos explicaciones en video. Lo marcaron 4 de 5 revisiones independientes, con
confianza alta, y es la única fusión propuesta que **cruza módulos** — que hoy
`mismoVideoQue` no admite a propósito, porque un video de un módulo `porArea` compartido
con uno que no lo es no tiene dónde vivir.

**Lo que queda sin hacer:** decidir si se unifican, y si la respuesta es sí, si
`mismoVideoQue` tiene que poder cruzar módulos.

**Vive en:** lib/programa-catalogo.ts (m4c3, m6c5) · *2026-08-11 ~programa-mauricio-recorte*

---

## Implementar mientras corre la corrida envenena la verificación

**Síntoma:** 24 de 24 escépticos refutaron la propuesta que estaban juzgando. Leído por
encima: «el plan entero está mal».

**Causa:** los escépticos leen el código de AHORA. Las fusiones se habían implementado
mientras ellos corrían, así que refutaron con *«esta fusión ya está en el código, no
ahorra ningún video»* — que es cierto y no tiene nada que ver con la pregunta que se les
hizo, que era si la fusión pierde algo.

Es exactamente la trampa que `AGENTS.md` ya documenta («un agente no distingue *nunca
estuvo roto* de *se arregló hace una hora*»), con la vuelta de tuerca de que acá el que
movió el código fue **el mismo que lanzó la corrida**.

**La regla que queda: mientras una corrida esté juzgando un cambio, no se aplica ese
cambio.** Si hay que avanzar igual, se trabaja en lo que la corrida no mira — acá fueron
el guard de workspace y la pantalla— y las fusiones se aplican cuando vuelve el veredicto.

**Y lo que sí se rescató:** la parte del razonamiento que no dependía del estado del árbol
—la distinción entre fusionar el VIDEO y fusionar el BLOQUE— apareció en 5 de los 24
veredictos y es la que gobierna el diseño final. Un resultado contaminado no es un
resultado vacío: hay que separar qué parte dependía de la premisa falsa.

**Vive en:** AGENTS.md → «Un agente no distingue nunca estuvo roto de se arregló hace una
hora» · *2026-08-11 ~programa-mauricio-recorte*

---

## Doce agentes escribiendo en paralelo: qué caza un revisor y qué no caza un esquema

Los 259 puntos de grabación de las 44 clases los escribieron doce agentes, uno por
módulo, y encima un revisor que leyó los doce juntos. El esquema ya forzaba lo
medible —4 a 7 puntos por clase, 160 caracteres mínimo, la cobertura de campos
declarada—. Aun así el revisor encontró tres clases de defecto que **ningún esquema
podía ver**, y las tres se repiten en cualquier corrida que genere contenido:

**1. Un dato inventado, y perfectamente verosímil.** En 1.2 se coló «el dueño aparece
como responsable de cinco de las siete áreas». No está en ningún atoro: el agente lo
armó porque encajaba. Un esquema no lo distingue de un dato real — es un string del
largo correcto en el lugar correcto. La única guarda posible es alguien que conozca la
fuente y lea.

**2. La muletilla, que solo se ve leyendo en el orden en que se CONSUME.** 24 de 44
clases cerraban con un punto que empezaba «Cerrar…». Por clase suelta no es un
defecto; el problema es que en tres módulos esas clases **comparten grabación**, así
que Mauricio diría la misma fórmula tres veces en un mismo video. Ningún agente podía
verlo: cada uno escribió su módulo aislado, y ni siquiera es visible leyendo los
módulos en orden — hay que leerlos agrupados por VIDEO.

> **La regla que queda: cuando N agentes escriben piezas de un mismo entregable, el
> revisor tiene que leerlas en el orden en que las va a consumir el usuario, no en el
> orden en que se generaron.**

**3. Guiones encubiertos con una forma reconocible.** La instrucción decía «nunca un
guion», y ninguno escribió «Decí: …». Lo que sí apareció, cuatro veces, fue *«conviene
decirla tal cual:»* seguido de la frase entre dos puntos — que es un guion con otro
envoltorio. El peor estaba en el cierre del programa entero. Una prohibición se esquiva
sola si se prohíbe la FORMA y no la intención; los tests ahora prohíben las tres
variantes que de hecho aparecieron.

**Lo que sí funcionó sin revisor:** obligar a que los puntos salieran de los CAMPOS
reales del formulario (`lib/programa-campos.ts`) y no del tema de la clase. Es lo que
hace que exista un punto dedicado a la cuarta tabla del 1.3 —la que nadie espera— y que
el 0.3 aclare la diferencia entre sus dos preguntas, que si no se contestan igual.

**Vive en:** lib/programa-catalogo.ts (`puntos`) · tests/programa-catalogo.test.ts ·
*2026-08-11 ~puntos-de-grabacion (12 escritores + 1 revisor)*

---

*Corrida del 2026-08-11: 16 agentes mapeando el código para el bucle de entrega, más la
verificación en vivo contra la cuenta real de Whop. Ampliado el 2026-08-11 con
~programa-mauricio-recorte (5 lentes + 24 escépticos) y ~puntos-de-grabacion (12+1).*

---

## Un banco de material temático no es un temario, y el tema es justo lo que engaña

**Vive en:** `lib/banco-skills.ts`, `app/customer-success/programa/` (tab «Tu material») — los dos BORRADOS el 26/09/2026

**El síntoma:** Mauricio entregó 1,07 GB de material —26 videos, 183 minutos, 35 PDFs—
organizado en doce carpetas por tema: Propósito y Narrativa, Estrategia y Visión,
Prioridades y Ejecución, OKRs y Métricas, Juntas y Ritmos… Leído por los títulos, tapa
casi todo el programa: hay 4DX para el módulo de las MCIs, OKRs para el de objetivos,
Scaling Up para el de juntas, Sinek y Frankl para el de propósito.

**El diagnóstico obvio, y era el equivocado:** «esto baja mucho las grabaciones que
faltan». La primera lectura —mía, por los nombres de archivo— dijo que resolvía tres
huecos enteros. Con las 26 transcripciones y los 35 PDFs leídos, resuelve **dos**.

**La causa real:** los 26 videos tienen todos la misma plantilla —gancho, secciones
numeradas, «pregunta para reflexionar» al cierre— y **ninguno termina en una tarea**.
Explican un marco. Las clases del programa, en cambio, terminan todas en un entregable
que el cliente produce sobre SU negocio: ficha de números con líneas base, organigrama
real con semáforo, matriz área × MCI, cada palanca con su umbral V/A/R y su evidencia.

Un video que explica «Empieza por el porqué» de Sinek y la clase «El origen» hablan del
mismo tema. Pero la clase pide que el cliente escriba **el suyo**, y el video no. Son la
misma materia y distinto objeto.

**La regla que queda:** para decidir si un material reemplaza a una clase **no mires el
tema: mirá si termina en un entregable del cliente**. El tema coincide casi siempre; el
entregable casi nunca. Un banco temático se cuelga de los módulos como anexo y no baja
la lista de grabación — salvo en las dos o tres piezas donde el autor ya escribió el
procedimiento y no el concepto.

**El corolario, que es lo que hace útil al banco:** las piezas que SÍ sirven como clase
no son las que llevan el nombre del libro famoso. Son las dos que el autor escribió como
procedimiento propio: el workbook de accountability (guiones de junta, checklist de
conversación de integridad, plantilla) y el manual de liderazgo, que trae la fórmula del
pedido efectivo —«con el fin de A, te pido B para la fecha C, ¿te podés comprometer?»,
las tres únicas respuestas válidas y el catálogo de falsas promesas—. Eso es exactamente
la clase «prompts a humanos», que estaba marcada como hueco sin material.

---

## El inventario por nombre contaba 26 videos donde había 25, y el nombre no tenía forma de avisar

**Vive en:** `lib/banco-skills.ts`

**El síntoma:** dos archivos, `SKILL_19_Organizar Agenda en Bloques.mp4` y
`Time_Blocking__Logro_Diseñado.mp4`, en carpetas distintas, con títulos distintos, los
dos de 36,0 MB y 7 minutos. Los conté como dos grabaciones y le dije al cliente que el
módulo de la agenda del director quedaba «casi entero» con dos videos.

**La causa:** son **el mismo archivo**. `md5 = 493af3586047f5e8c49642008394d732` en los
dos. Las transcripciones salieron palabra por palabra iguales y ni con las dos delante
lo até: leí la coincidencia como «trata el mismo tema», que es exactamente lo que uno
espera de un banco temático.

**Y no era el único.** Hasheando el inventario entero aparecieron tres grupos:

| md5 | Archivos | Qué esconde |
|---|---|---|
| `fa733a59…` | `SKILL_14_Liderazgo Gerencial.pdf`, `SKILL_15_Conversaciones Difíciles.pdf`, `SKILL_16_Crear Estándares.pdf` | Dos SKILLs **no tienen documento propio**: apuntan al manual del tercero |
| `493af358…` | `SKILL_19_Organizar Agenda.mp4`, `Time_Blocking__Logro_Diseñado.mp4` | Una grabación contada dos veces |
| `a6d305d7…` | `Copia de SKILL_20_Roles.pdf`, `SKILL_20_Roles.pdf` | Copia literal |

**La regla que queda:** un inventario de material ajeno se arma **por hash, no por
nombre**. El nombre lo puso una persona y es justo la capa donde se pierde la
información: renombrar un archivo no lo convierte en otro, pero lo hace contar como
otro. Y el error tiene el signo peligroso —**infla** la cobertura—, así que el reporte
sale optimista y nadie lo audita.

**Corolario para este caso:** el hash caza copias exactas, no el mismo contenido en dos
formatos. `Arquitectura_del_Pensamiento.mp4` (7 min) y
`Reaccionamos_primero_y_justificamos_después.m4a` (13 min) son el mismo material de
Kahneman con md5 distinto. Esa la caza leer, no hashear.

---

## Cuatro PDFs de un banco no tienen texto, y tres de ellos no es porque sean imagen

**Vive en:** `lib/banco-skills.ts`

**El síntoma:** `pdftotext` devolvió menos de 60 palabras en cuatro de los 35 PDFs.
La lectura fácil es «son PDFs escaneados, hay que pasarles OCR».

**Lo que eran de verdad**, después de mirarlos:

- **Dos sí eran imagen** (`SKILL_04_Arquitectura_Narrativa`, 11,2 MB; el infográfico de
  Anti-Complex, 6,4 MB). Con OCR salieron completos y son material bueno.
- **`SKILL_07_Prioridades Covey`** son 7 palabras: un título y **un link de YouTube**.
  No hay documento.
- **`SKILL_22_Elévate con SCRUM`** son 38 palabras: las etiquetas sueltas de un diagrama,
  sin una sola frase.

**La regla que queda:** «el extractor no sacó texto» tiene al menos dos causas con
arreglos opuestos —falta la capa de texto (→ OCR) o **no hay contenido** (→ el archivo
está vacío y hay que decirlo)—. Distinguirlas cuesta abrir el archivo una vez; no
distinguirlas cuesta prometer un OCR que va a devolver un link de YouTube.

**Y el hallazgo incómodo:** un PDF del banco (`SKILL_05_Anti-Complex`) trae pegada la
interfaz de la herramienta con la que se generó — «Chat», «Studio», «Resumen en audio»,
y el pedido textual del autor: *«Haz una infografía igual o similar a la que hiciste pero
en formato vertical»*. El infográfico que lo acompaña lleva el logo de la herramienta en
las doce páginas. Un material que se va a publicar a clientes necesita una pasada que
mire **lo que el archivo muestra**, no solo lo que dice el índice.

---

## Material de OTRO cliente adentro de un banco genérico

**Vive en:** `lib/banco-skills.ts` (el listado de piezas con `contaminado: true`)

**El síntoma que no hubo:** ninguno. El banco se iba a publicar tal cual en Whop.

**Lo que hay adentro**, leído:

- **`SKILL_21_Rol del Director Comercial`** describe un puesto concreto de una empresa
  concreta: B2B industrial de automatización y refacciones, con sus segmentos
  («maquiladoras, OEMs, integradores»), y **nombra a la persona**: *«rol de Jorge a
  instalar con el DOS»*, *«lo que hoy parece ser vendedora senior»*.
- **`SKILL_04_Balanced Scorecard`** y **`SKILL_20_Roles y Responsabilidades`** están
  escritos en registro de **campaña política**: «resultados electorales», «coordinación
  territorial», «legitimidad», y el ejemplo de RAPID decide con «Coordinación política»
  y «Dirección general».
- **`SKILL_09_SCRUM Personal`** está escrito para una persona con «planeación
  dominical», «política de membresías» y «seguimiento de exalumnos».

**La regla que queda:** un banco reutilizable se arma **sacando** el caso, no
renombrándolo. Cuando un entregable de consultoría se recicla como material de curso, lo
que viaja no es solo el marco: viajan el rubro, el organigrama y los nombres propios del
cliente anterior. Y el lector siguiente **es otro cliente**, que lo va a leer como si
fuera para él o —peor— va a reconocer de quién es.

**Cómo se caza:** buscar nombres propios, rubros y unidades de negocio en el cuerpo de
cada pieza antes de publicarla. No alcanza con revisar títulos: los tres casos tienen
títulos perfectamente genéricos.

⚠️ **Y el temario PROPIO también los trae (16/09/2026).** Los campos `atoro`, `puntos` y `graba`
de `lib/programa-catalogo.ts` cuentan casos de clientes reales de Mauricio con detalles de su
negocio: TEXX (:232, :235, :558, :585, :591, :593), HMO (:370, :374, :500, :502), Baja Teriyaki
(:477, :481, :572, :580) y Patricia (:623, :742, :749). O sea que hay **dos** fuentes con
nombres propios, no una: quien decida qué sale por un canal externo mirando solo
`lib/cs-historico.ts` —el que todos saben que nombra clientes— deja pasar la otra, que se lee
como «el temario». Hoy la API de MaKo manda la estructura del programa por HTTP y esos tres
campos no (`ctx.canal === 'http'` en `lib/api-mako/areas/cs.run.ts`). Cualquier canal nuevo que
exponga el temario tiene que hacer el mismo corte.

**Vive en:** `lib/programa-catalogo.ts` (`atoro`, `puntos`, `graba`) · `lib/cs-historico.ts` ·
*2026-09-16 api-mako-areas*

---

## La «prueba» de que el webhook andaba era su valor de retorno, no la escritura

**Vive en:** `lib/cs-avance.ts` (`anotarVisto`) · `app/api/webhooks/whop/route.ts`

**El síntoma, el 17/09:** el brief de la tarea 09-T69 daba por probado el camino
Whop → MaKo «con un evento real: {clase: m7c1, lead: 91}», y pedía verificar la pantalla
nueva con esa clase. `cs_respuestas` tenía **cero filas**. No las de ese lead: cero en
total, contra la base correcta (1.463 leads, el 91 existe).

**Lo que había:** `registrarAvanceDeClase` hacía el `upsert` y no miraba su `error`.
supabase-js **no lanza** ante un error de base: lo devuelve en `{ error }`. Así que la
función contestaba `{ ok: true, clase, lead }` pasara lo que pasara con la escritura — y
ese `{ clase, lead }` es literalmente lo que el webhook devuelve en el cuerpo. **La prueba
probaba el CRUCE de ids (lección → clase, email → lead), no que se hubiera escrito algo.**

**Y el diseño ya estaba preparado para esto, que es lo que más cuesta ver:** el `catch`
del webhook devuelve 500 con un comentario que dice «a propósito: acá SÍ queremos el
reintento de Whop». Pero para llegar al `catch` hay que lanzar, y un `{ error }` ignorado
no lanza. **El camino de reintento existía, estaba pensado y estaba muerto.**

> **La regla: toda escritura de supabase-js mira su `{ error }` y lo convierte en lo que
> el llamador espera.** Y al revés: el valor que devuelve una función que escribe NO es
> evidencia de que escribió. Para verificar una escritura se lee la base después — que
> es exactamente lo que hace `scripts/ensayo-bucle-cs.ts` y por lo que existe.

## Por qué no hay datos: el curso del programa está OCULTO y tiene cero alumnos

**Vive en:** Whop, curso `cors_MChFCUZK1T2e8` · `scripts/cs-backfill-vistos.ts`

Con la escritura arreglada, la tabla vacía podía ser otra cosa: el backfill en simulación
contra Whop real dio **1 curso, 13 capítulos, 0 alumnos, 0 interacciones**.

⚠️ «0 alumnos» podía ser «no tengo permiso para listarlos» — la API de otras plataformas
contesta lo mismo en los dos casos. Se descartó leyendo con la MISMA key la estructura
del curso (13 capítulos, sus lecciones): la key tiene acceso. **El curso está en
`visibility: hidden` y ningún cliente fue dado de alta en él.** Es la dependencia 09-T56
(«clientes dados de alta en Whop con el mismo email del CRM»), y hasta que eso pase la
pantalla clase-por-clase va a mostrar su estado vacío para los 13 clientes.

Cuando se den de alta: `NODE_OPTIONS="--conditions=react-server" npx tsx
scripts/cs-backfill-vistos.ts` simula; con `--escribir` escribe. La lista de «alumnos de
Whop que NO son ningún cliente del CRM» que imprime al final es la parte más útil: casi
siempre es alguien que compró con otro email, y eso no lo puede adivinar el código.

## En los módulos por área, la fila sin área es la marca de «vio», no la tarea

**Vive en:** `lib/cs-avance-clases.ts` · `lib/cs-cartera.ts` (sin arreglar, ver abajo)

`MODULOS_POR_AREA` son **cuatro** (m6, m7, m8, m9), no uno. Ahí el video es el mismo
para todo el cliente pero la tarea se contesta una vez por área, en su propia fila. El
webhook escribe `visto_at` en la fila **sin** área, que queda en `pendiente` para
siempre porque nadie contesta sobre ella.

Leída como si fuera la tarea, una clase contestada y aprobada en todas sus áreas figura
«sin contestar» — y encima como «la vio y no la contestó». `avancePorClase` toma la tarea
de las filas por área y hace valer a la clase lo que su área **menos** avanzada.

⚠️ **Y la trampa espejo cayó en mi propio código antes de commitear:** filtraba las
clases «con señal» mirando la tarea agregada, y como la agregada es la del área menos
avanzada, una clase con un área APROBADA y otra sin empezar valía «sin contestar» y
**desaparecía de la lista**. Lo cazó un test (`tests/cs-avance-clases.test.ts`), que
contra ese código daba `[]`. «Tiene señal» y «su tarea no está en cero» son preguntas
distintas.

## `ilike` es un patrón, y `_` es de lo más común en un email

**Vive en:** `lib/cs-avance.ts` (`leadDeAlumno`)

El cruce alumno de Whop → cliente del CRM hacía `.ilike('email', email)` con el email
crudo. `ilike` no es «igual sin mayúsculas»: `_` es un comodín de un carácter y `%` de
cualquier cosa. `juan_perez@x.com` matcheaba `juanXperez@x.com`, y el comentario de la
propia función dice por qué importa: «adivinar mal acá le escribe avance a OTRO
cliente». Se escapan los tres comodines. Y con varios leads para un email —pasa, un lead
que volvió a entrar por otro formulario— se queda con el único `ganado`; si no hay uno
solo, no elige.

El censo de los seis `.ilike(` del código, y la regla que quedó para código nuevo, están
en `AGENTS.md` → «Un patrón trae CANDIDATOS». El único otro con el email crudo
(`duplicadosDeLead`, `lib/leads.ts`) **no** está roto: compara exacto después.

## Whop paginaba hasta un tope y devolvía lo cortado como completo

**Vive en:** `lib/whop.ts` (`todas`)

Al llegar a 20 páginas con `has_next_page` todavía en `true`, devolvía `{ ok: true }` con
lo acumulado: una lista cortada con la misma cara que una completa. Ahora es un error.

Para las interacciones (clientes × 44 clases) el corte dejaba clientes enteros «sin haber
visto nada». Pero **para el sincronizador del programa lo parcial era PEOR que un error**:
`cs-sync-whop` es idempotente por título, así que una lección que no aparece en la lista
cortada la vuelve a crear — duplicada, en el Whop de Mauricio. Alumnos e interacciones,
que crecen con la cartera, suben su tope a 400 páginas.

## «Mauricio me manda el curso y lo subo» era el diagnóstico obvio, y le falta el primer paso

**Vive en:** `lib/programa-catalogo.ts` · `lib/cs-sync-whop.ts` · la planilla
`Arquitectura_Tutoriales_NqE` del Drive de Mauricio (`1F8E5beBmNt2mpRYrj8AZto2gZBJOomm6dw9jyoqRZ14`)

**El síntoma:** el 24/09 se daba por hecho que lo único pendiente era recibir los videos y
colgarlos en Whop.

**Lo que hay de verdad:** compiten **cuatro** estructuras del programa, y un video grabado
sobre una no tiene a qué clase ni a qué formulario engancharse en otra:

| Estructura | Fecha | Forma |
|---|---|---|
| El catálogo de MaKo (el que tiene Whop) | 11-12/08 | 12 módulos, 44 clases, 31 grabaciones, 114 campos |
| «Proceso de proceso en el servicio» | ~20/08 | 13 módulos, 0-12 (`lib/banco-skills.ts:36-62`): desde el 5 el número significa otra cosa |
| Las «6 fases» | 7/9 | Contexto, Norte, Criterio, Palancas, Tablero, Ritmo |
| `Arquitectura_Tutoriales_NqE` | 15/09 | 62 videos, 351 min, fases 0-11, tipos Concepto / Demostración / Clínica |

La planilla del 15/09 es la más nueva y dice **«Videos grabados: 0»**, con una condición
propia: las plantillas P0-P11 terminadas antes de grabar (las 12 en «Pendiente»). Sólo la
ve su dueño.

**Y lo que Mauricio prometió no era mandar videos.** El 9/9 (rec 181523988
[02:15:48]-[02:16:20]) se comprometió a grabar el sábado 19/09 y a mandar **el documento
de clases y temarios**. El canal de los videos nunca se acordó: el 7/9 la pregunta
«¿dónde los subo?» quedó en «me avisas». Al 24/09 no hay rastro de ninguna de las dos
cosas en Drive, Gmail, Calendar, Fathom ni Whop.

⚠️ **El falso positivo que parece la grabación:** el 19/09 entraron ~40 videos y varios GB
al Drive de Mauricio. Son B-roll de un video de presentación (`04_Marketing/Media`),
capacitación de TEXX y los módulos RM-01 a RM-07 de HMO. «Módulo_RM-06.mp4» es de un
cliente, no del programa.

**La regla:** antes de mover un solo video se fija qué estructura manda. Cambiar clases
después le renumera el temario a un cliente que ya lo tiene abierto (ver «agrupar no
reordena», más arriba).

---

## Whop no está «cargado y esperando videos»

**Vive en:** `lib/cs-sync-whop.ts:50-116` · `lib/whop.ts:207-289` ·
`app/customer-success/programa/page.tsx:43` (BORRADO el 26/09/2026)

Medido con GET el 24/09. El curso `cors_MChFCUZK1T2e8` está `hidden` y tiene 12
capítulos del programa más el «Chapter 1 / Lesson 1» que Whop crea por defecto (vacía y
visible). Son 46 lecciones de texto, **ninguna con video**. Quedó congelado en el
programa del 11/08: **29 de las 44 clases** tienen su lección vigente por título. Las
otras 15 (m1c6, m2c1, m5c1-m5c7, m8c1, m9c3, m10c1-m10c3, m11c2) cambiaron de título en
`fcf1750a`, `5f6501d9` o `294d8915`. Y el mapa guardado apunta a m8c2, m8c3 y m11c1, que
ya no existen.

Tres cosas que parecen resolverlo y no lo resuelven:

- **«Sincronizar a Whop» no limpia.** Busca por título y no borra ni renombra. Correrlo
  hoy crea «Módulo 10 · Diseñando las juntas» al lado de «Módulo 10 · La cadencia», y 12
  lecciones nuevas al lado de las viejas. Con `require_completing_lessons_in_order` el
  alumno tendría que pasar por las viejas. `lib/whop.ts` no tiene PATCH de curso ni DELETE:
  limpiar es a mano en el panel de Whop, o código nuevo.
- **`--visible` sólo actúa al CREAR el curso**, y publicar no alcanza. La experiencia
  `exp_9cQ9noHCiNyuvO` no está en ningún producto: hay 0 products, 0 plans y 0
  memberships. Aunque el curso fuera visible, nadie tiene por dónde entrar. No hay código
  que dé de alta: es manual y necesita antes un producto.
- **La pantalla dice «44 en Whop» y son 29.** `page.tsx:43` cuenta los valores del mapa
  del 11/08, no las lecciones que existen hoy.

**El video:** el código sólo sabe embeber YouTube o Loom (`lib/whop.ts:250`, `:277-284`),
nadie le pasa `embed`, y `Clase` no tiene un campo que diga qué video va en qué clase.
Whop acepta `mux_asset_id` en el PATCH, pero no hay un camino documentado de un `.mp4` a
un `mux_asset_id`. Las salidas reales son subirlo a mano en el editor de Whop, o YouTube
no listado / Loom + embed.

---

## El primer alumno real quedaría anotado en la clase equivocada

**Vive en:** `lib/cs-avance.ts:137-150` · `supabase/migrations/0125_cs_respuestas.sql:31`

`registrarAvanceDeClase` toma el `claseId` del mapa guardado y se lo pasa a `anotarVisto`
sin preguntarle a `claseDe()` si existe, y la base tampoco lo frena (`clase_id text`, sin
check). Con el mapa del 11/08 fallan dos cosas, y ninguna da error:

- Un evento de `lesn_iYmJ92Hijxd5Z` escribe una fila con `clase_id = 'm8c2'`, una clase
  que ya no existe.
- Una lección con título viejo cae en la clase NUEVA que heredó su id. Por ejemplo, «5.1 ·
  Por qué seguirían» se anota como m5c1, que hoy es «El origen».

Hoy no pasa porque hay cero alumnos. **El orden no es opcional:** limpiar Whop y
resincronizar ANTES de dar de alta a nadie.

⚠️ **Y el respaldo que prometen los comentarios no existe.** `lib/whop.ts:116-117` y
`app/api/webhooks/whop/route.ts:6` dicen que «el avance llega igual en la pasada del
cron». Ningún cron lee Whop: lo que se pierda del webhook sólo entra corriendo
`scripts/cs-backfill-vistos.ts` a mano.

---

## La reescritura le devuelve al cliente mexicano su respuesta en voseo

**Vive en:** `lib/cs-reescritura.ts:57`

El prompt por defecto de `cs.bloque.reescritura` cierra con «Voseo, directo, sin lenguaje
motivacional». Lo que reescribe es **la respuesta del cliente**, que tiene que «sonar a
él», y los clientes de Mauricio son mexicanos. Es la regla de AGENTS.md («La voz de MaKo
es rioplatense, y el texto DEL CLIENTE no») aplicada en un writer que se escribió antes.
No hay override en `app_settings` (`mako.prompt-overrides` vacío). Sin arreglar.

---

## Los módulos por área se contestan una sola vez

**Vive en:** `app/compartido/[token]/TareaCliente.tsx:66-70` · `lib/cs-tarea-vista.ts:61-63`

El backend soporta el área (`app/api/compartido/tarea/route.ts:38,47`, `areaDe` en
`lib/cs-respuestas.ts`). La pantalla no la manda, ni en el POST ni en el `sendBeacon`, y
tampoco muestra las filas que la tienen. m6-m9 son `porArea`, y Whop le anuncia al
cliente «una vez por cada área». Y el m8 lo contesta «el líder de área», pero el único
link que existe es el del dueño.

---

## Leer las reuniones de Customer Success: las trampas de las fuentes

**Vive en:** las dos cuentas de Fathom (ver [sprint-servicio-mauricio.md](sprint-servicio-mauricio.md)) · los conectores de la sesión

- **Whop casi nunca sale como «whop» en el transcript**: sale como Google, group, Whoop,
  Woo, Hupo, UU, «esta U» o Wub. «La plataforma de Google» es Whop, no Drive ni
  Classroom. Un grep por `whop` pierde la mayoría de las menciones.
- **La diarización invierte justo los compromisos.** El «yo voy a mandarte ese
  documento» del 9/9 está etiquetado como Martín y lo dijo Mauricio. El índice de
  `tareas-reuniones-mauricio-8-y-9-sep.md` atribuye mal 09-T71.
- **Una llamada, tres ids.** La del 9/9 es call 817420774 (la copia de Mauricio, rec
  181525344) y rec 181523988 (la de Martín, call 817413645). Los timestamps están corridos
  un tramo que no es constante.
- **Fathom fecha en UTC.** La «Mau <> Martin: CUSTOMER SUCCESS» (172397528) figura el 12/08
  y fue el martes 11/08 a la noche. Por eso el commit `fcf1750a` habla del feedback «del
  12/08».
- **«Impromptu» no dice con quién.** Las de septiembre de la cuenta de Mauricio son juntas
  con sus clientes, y la del 9/9 **con** Martín también se llama «Impromptu Google Meet
  Meeting». Filtrar por el invitado `martinkoncke` la pierde.
- **Los conectores de Drive, Gmail, Calendar y Fathom de la sesión son de Mauricio**
  cuando la cuenta activa es claude1. Sirven para ver lo que él subió o mandó. Su silencio
  no dice nada del WhatsApp personal de Martín, y `mako_ws1` está desconectada desde el
  03/09 (403): MaKo tampoco registró nada del WhatsApp de ws1 desde entonces.

*2026-09-24 · `contexto-customer-success` (wf_e4f011c2-23e: 6 relevos + consolidación + 3
refutadores, 20 afirmaciones verificadas contra la fuente)*

---

## Lo que quedó SIN hacer, con el archivo donde vive

- **`cartera()` cuenta «vio y no contestó» mirando solo las filas sin área**
  (`lib/cs-cartera.ts`, `bs = respuestas.filter(b => !b.area)`). En los módulos por área
  eso cuenta como «vista sin contestar» una clase contestada en todas sus áreas, y le
  cambia la cancha al cliente. No se tocó porque el 17/09 otra sesión tenía ese archivo
  a medio editar (un barrido de paginación con `leerTodo`) y reescribía justo esa
  lectura. El arreglo es usar `avancePorClase` de `lib/cs-avance-clases.ts` en vez de
  recalcular: una regla, un lugar.
- **Dos reglas para la misma pregunta.** `leadDeAlumno` (`lib/cs-avance.ts`) y
  `ganadosPorEmail` (`lib/api-mako/areas/cs.run.ts`, la acción `ver_avance_whop`) cruzan
  alumno de Whop con cliente del CRM, y lo hacen distinto: una con `ilike` escapado y
  desempate por `ganado`, la otra por igualdad exacta en minúsculas. Hoy dan lo mismo
  con los datos que hay; el día que un email tenga mayúsculas raras o dos leads, van a
  contestar distinto sobre el mismo alumno.
- **La vista con filas no se verificó en el navegador**, porque no existe una sola fila
  que mostrar. Está cubierta por tests; el día que haya alumnos en Whop, abrir la ficha
  de uno en `/customer-success?ws=1`.

**Agregado el 2026-09-24** (corrida `contexto-customer-success`):

⚠️ **Todo lo de esta lista quedó sin objeto el 26/09/2026.** `07d07139` («Customer Success,
desde cero y para cualquier workspace») borró el programa entero: `lib/programa-*`, las
`lib/cs-*` del bucle, el webhook de Whop, `TareaCliente.tsx`, la ruta del cuestionario y
los scripts del cargador. Ver «Sacar el programa de los SEIS lugares», más abajo. **No se
arreglan: no existen.** Si el servicio de Mauricio (curso en Whop + formulario por bloque)
vuelve, se recupera de `07d07139^` y estos arreglos se aplican ANTES de estrenarlo.

- **Validar el `claseId` antes de anotar el visto** (`lib/cs-avance.ts:137-150`, con
  `claseDe`), y que `app/customer-success/programa/page.tsx:43` (BORRADO el 26/09/2026) cuente «en Whop» por
  título vigente y no por el mapa. Corregir los comentarios del cron que no existe
  (`lib/whop.ts:116-117`, `app/api/webhooks/whop/route.ts:6`).
- **Enganchar el video:** un lugar que diga qué video va en qué clase (campo en `Clase`
  o un mapa `claseId → {tipo, id}`, respetando `mismoVideoQue`), que `lib/cs-sync-whop.ts`
  le pase `embed` a `actualizarLeccion`, y PATCH de curso (visibilidad) + DELETE de
  lección en `lib/whop.ts`. Depende de decidir dónde vive el archivo de video.
- **Sacar el voseo** del prompt de reescritura (`lib/cs-reescritura.ts:57`).
- **Contestar por área** en `TareaCliente.tsx`, y decidir si hay link para el líder de área (m8).
- **El seguimiento automático no existe:** ningún cron llama a `borradorVioYNoContesto`
  (`lib/cs-mensajes.ts:77`); lo único automático es el borrador de «hay que aprobar» que
  deja el cron `fathom-plan` después de una junta. Faltan el recordatorio de clases no
  vistas (A62 del 20/09, tarea #780 del board) y el aviso a Mauricio antes de cada junta
  (11/08, rec 172397528 [02:22:07]). No duplicar el aviso 24 h antes de la junta, que el
  8/9 se decidió para el Kanban del Plan (08-T45).
- **Documentos que mienten sobre el estado:** `docs/programa-mauricio.md:256` dice «nada
  de esto está aplicado al catálogo» (falso desde `fcf1750a`) y `:22-212` describe el
  temario viejo; `app/admin/dev/customer-success/roadmap-cs.ts` dice que emitir y mandar
  el link «no existe» (existe: `app/customer-success/actions.ts:53-97`); «25 videos / 118
  preguntas» en `ProgramaApp.tsx:200` y `programa/page.tsx:8` (son 31 y 114).

---

## La tab era de UN cliente y no se leía como un bug (rearmado del 26/09/2026)

**Vive en:** `lib/cs-cartera.ts`, `lib/cs-senal.ts`, `app/customer-success/page.tsx`,
`app/customer-success/actions.ts`, `app/customer-success/trabajo.ts`,
`tests/cs-senal.test.ts`

**El síntoma:** Martín abrió Customer Success y todo lo que había adentro era de
Mauricio — «incluso me aparece en el ws de admin». Se venía reportando como un
problema de PERMISOS («no puedo entrar», «me sale Coming soon»), y por eso se había
arreglado dos veces del lado del permiso.

**La causa real:** el permiso estaba bien. Lo que estaba mal era de quién eran los
datos. `page.tsx` hacía `esWorkspaceDueno() || getSesionAdmin()` y después
`runWithWorkspace(OWNER_WS, () => contenido())`. O sea que el guard no sólo decidía
QUIÉN entra: **cambiaba de inquilino**. Un admin parado en cualquier workspace veía la
cartera del ws1 y la leía como «la tab».

**La regla que queda: un guard decide quién entra, nunca de quién son los datos.** Si
para que una pantalla tenga contenido hay que mudarla de workspace, esa pantalla es de
un cliente y no es una tab del producto. El olor exacto: `runWithWorkspace(<constante>)`
en el cuerpo de un `page.tsx`.

**Y la mitad que se olvida son las ACTIONS.** `wsActual()` (`actions.ts`) devolvía
`OWNER_WS` cuando quien miraba era admin — con la página arreglada, cada admin habría
seguido ESCRIBIENDO el estado de sus clientes sobre la cartera de Mauricio. Una página
se arregla y las acciones que la alimentan siguen contestando sobre otra cosa.

### Un campo muerto sosteniendo una regla de la pantalla

`compromisosAbiertos` estaba declarado en `ClienteCartera`, leído por la regla de
cancha (`if (c.compromisosAbiertos > 0) → 'suya'`) y **clavado en `0` en los dos
lugares que lo escribían**, con el comentario «se llena abajo» y nada abajo que lo
llenara. Esa razón **no se podía disparar nunca**, y su cliente caía en «Sin nada
pendiente de ninguno de los dos»: falla en silencio y en la dirección tranquilizadora.
El header del módulo lo declaraba como uno de los TRES hechos sobre los que giraba la
pantalla.

**La regla:** antes de confiar en una rama, grepeá quién ESCRIBE el campo que mira. Un
`grep` que sólo devuelve la declaración y el `0` es la firma.

### Lo que sobrevive a los tres workspaces, medido

`cs_respuestas` tiene **0 filas en todo el producto** (ni en ws1): la pantalla giraba
alrededor de una tabla vacía. Y el perfil de señales fuera de ws1 es el OPUESTO al de
Mauricio — ws11 tiene 11 clientes con WhatsApp de ayer y **cero** sesiones, cero
proyectos de cliente y casi cero cuotas; ws13 tiene dos clientes cerrados anteayer y
nada más. Una pantalla diseñada mirando ws1 está vacía en 13 de los 27 clientes del
producto.

Lo único que existe para los 27: quién es · `fecha_cierre` (**27 de 27, el único campo
que nunca falta**) · la promesa (`deal_promesa.resultado`, 15 de 27, y más llena fuera
de ws1 que adentro) · la última conversación (sesión **o** WhatsApp, lo que haya) · lo
que falta pagar. Sobre eso gira ahora `lib/cs-senal.ts`.

### «No lo sé» es un nivel, no la ausencia de nivel

La señal devuelve `atencion | bien | **null**`. Un cliente sin contrato cargado no está
bien: está sin datos, y son dos pantallas distintas. Lo mismo una cuota impaga **sin
`fecha_esperada`** (2 de las 3 impagas de ws11): impaga y vencida no son lo mismo, y
una sin fecha no se puede declarar vencida nunca. Y un tablero que no se pudo leer
entra como `null`, jamás como `0` — «no pude leer el tablero» pintado como «no tiene
nada atrasado» es la mentira tranquilizadora clásica.

En la API eso obliga a un casillero propio: `por_nivel` cuenta `atencion`,
`sin-datos` y `bien` por separado, porque «tengo 9 clientes al día» y «tengo 4 al día y
de 5 no sé nada» mandan a hacer cosas distintas. El mapeo `null → 'sin-datos'` vive en
UNA función (`claveNivel`, `lib/cs-senal.ts`): había empezado a existir tres veces
—la pantalla, la ficha y el runner de MaKo—, y el día que una lo escriba al revés la
pantalla dice que un cliente sin datos está al día.

### ⚠️ Una rotura que no prueba nada: la trampa de «probar rompiendo el test»

Al probar `tests/cs-senal.test.ts` rompiéndolo, una de las cinco roturas dio **13
pases, 0 fallos**: cambiar `c.tareasAtrasadas !== null && c.tareasAtrasadas > 0` por
`(c.tareasAtrasadas ?? 0) > 0`. La lectura tentadora —«al test le falta un caso»— es
falsa: **las dos expresiones son equivalentes para `number | null`**, así que no había
cambio de conducta que cazar.

**La regla: antes de concluir que al test le falta cobertura, comprobá que la rotura
cambie lo que el código HACE.** Una rotura que no cambia nada no mide el test, y
leerla al revés manda a escribir casos que no sirven. Las otras cuatro sí midieron
(2 fallos/11 pases, 1/12, 1/12, 1/12); están enumeradas con su número exacto en el
encabezado del test.

### El orden de lectura de la pantalla, y por qué son dos pasos

`cartera()` no puede leer el tablero: el cruce cliente ↔ proyecto
(`app/customer-success/cruce.ts`) necesita la lista de clientes que `cartera()` acaba
de traer, y correrlo con un cliente solo convierte cualquier palabra suya en única. Así
que van en este orden, y la señal se calcula DOS veces a propósito:

1. `cartera()` → señal con el trabajo en `null` (o sea, «no lo sé»).
2. `tableroDeLaCartera(clientes)` → números por lead, incluidas las **atrasadas**.
3. `conTrabajo(clientes, porLead)` → enchufa, **recalcula la señal y reordena**.

Si el paso 2 falla, el 3 recibe `null` y la pantalla sigue ordenada: un fallo del
tablero nunca deja la cartera sin triar.

### WhatsApp: la fecha es cierta, el conteo no

Los mensajes huérfanos (`lead_id is null` pero el teléfono matchea un ganado) son 489
en ws11 sobre 8 leads. Cruzados lead por lead: **la FECHA del último mensaje es
idéntica por `lead_id` y por teléfono en los 11**, así que los huérfanos no mueven el
«hace cuánto» y sí achican el conteo. Por eso `ClienteCartera` expone
`ultimoMensajeHace` y **no** un número de mensajes: «hace X días» es cierto, «N
mensajes» queda corto y nadie lo notaría.

Y el historial de WhatsApp se lee COMPLETO para los ganados, sin ventana de tiempo: con
una ventana de N días, «nunca hablaron» y «hablaron hace más de N» devuelven la misma
lista vacía, y la primera es una afirmación que la pantalla hace en voz alta.

### Lo que quedó SIN hacer

⚠️ **Los cuatro primeros puntos de esta lista se cerraron el 26/09/2026, en la misma
jornada** (ver la entrada de abajo). Quedan estos:

- **No hay entrada de `customer-success` en `lib/tab-onboarding-catalogo.ts`**, y la
  regla de la casa dice que toda tab tiene onboarding con su estado alimentando a MaKo.
- **La ficha de un cliente sigue sin URL propia:** es un estado adentro de la lista, así
  que no se puede compartir un link a un cliente ni volver con el botón de atrás.
- **La capa `superadmin` no incluye `customer-success`** (`lib/capas.ts`), así que el
  super-admin no ve la tab en SU workspace — la abre entrando al de un cliente, como
  cualquier otra tab de cliente. Es coherente y conviene saberlo antes del próximo «no
  me aparece».

---

## Sacar el programa de los SEIS lugares donde también vivía

**Vive en:** `lib/api-mako/areas/cs.def.ts` · `lib/api-mako/areas/cs.run.ts` ·
`lib/api-mako/areas/cs.helpers.ts` · `app/compartido/[token]/page.tsx` ·
`lib/reunion-auto.ts` · `app/admin/dev/areas.ts` · *2026-09-26*

**El síntoma:** la tab `/customer-success` se había rearmado desde cero y la pantalla ya
era genérica — y el programa de 44 clases seguía entero en otros seis lugares. Un link
viejo todavía abría el cuestionario, MaKo seguía ofreciendo el temario, y el registro de
`/admin/dev` describía el proyecto de un cliente.

**La causa real:** borrar la pantalla no borra lo que la alimentaba. Es la regla de
AGENTS.md «sacar un patrón es ENUMERAR dónde está, no arreglarlo donde se vio», y acá la
enumeración fue una cadena de imports, no un `grep` de una palabra: de
`lib/programa-catalogo.ts` colgaban once libs, dos rutas, cinco scripts y seis tests.

**Lo que se fue** (21 archivos): las once libs del programa, el webhook de Whop, las dos
rutas del cuestionario, cinco scripts y seis tests. Y catorce de las diecisiete
operaciones del área `cs`, con sus runners y seis helpers.

### `soloWs1` no es «el workspace 1»: es «ws 1 Y rol admin»

`gatingOk` (`lib/api-mako/registro.ts:125`) hace
`if (g?.soloWs1 && !(v.ws === WS_PRINCIPAL && v.rol === 'admin')) return false`. O sea
que sacarlo de las tres operaciones que quedaron **también sacó un requisito de rol que
nadie había declarado**. Se comprobó contra la pantalla antes de dejarlo así:
`app/customer-success/page.tsx` hace `requireCapa('customer-success')` a secas y las dos
server actions no miran el rol, así que un closer ve la cartera y puede marcar un estado.
Poner `rolMinimo: 'admin'` habría hecho a MaKo **más** estricto que la pantalla; la regla
de AGENTS.md pide lo contrario (que no sea más permisivo). Quedó `{ tab: 'customer-success' }`
y nada más.

**La regla que queda:** antes de sacar un flag de gating, leé qué hace en el registro. Un
nombre que menciona UNA dimensión (el workspace) puede estar cubriendo DOS.

### El 404 de un share sale de una condición en POSITIVO, o el recurso muerto cae en la galería

`app/compartido/[token]/page.tsx` despachaba `conocimientos` y `curso` con un `if` cada
uno, y **todo lo demás caía en la galería de marca**. `puedeVer` (`lib/shares.ts:141`)
decide por ALCANCE y **no mira `share.recurso`**: con `alcance: 'item'` compara
`asset.id === share.recurso_id` contra los assets de branding del workspace. El
`recurso_id` de un `tarea-cs` es un **id de lead**, así que sacar la rama del cuestionario
sin cerrar el descarte dejaba una colisión esperando a un asset con ese id — o sea, un
link de un cliente sirviendo una pieza de marca de otro. Quedó `if (acceso.share.recurso
!== 'branding') notFound()`: el recurso que no tiene rama propia no se sirve.

Y se verificó que ya no hay forma de EMITIR uno: el whitelist `RECURSOS` de
`app/api/compartir/route.ts:29` es `['curso', 'branding', 'conocimientos']` y nunca
aceptó `tarea-cs` (lo emitía la server action de la tab, que se borró).

### `puedeEditar` quedó sin un solo call site

`tarea-cs` era el **único** recurso de share con `permiso: 'editar'`. Con la ruta del
cuestionario fuera, `puedeEditar` (`lib/shares.ts:184`) —el único punto de autorización
de ESCRITURA por token, con 8 tests— no lo llama nadie. **No se borró a propósito:** es
la guarda que cualquier share editable futuro tiene que usar, y `crearShare` sigue
validando `permiso === 'editar'` ⇒ `alcance 'item'` + `recursoId`. Queda anotado para que
un barrido de código muerto no se la lleve.

### Whop quedó conectable y mudo

⚠️ **PENDIENTE, y es una decisión de producto.** Con el webhook
(`app/api/webhooks/whop/route.ts`) y las cuatro operaciones de Whop fuera, **nada en el
producto lee Whop**: `lib/whop.ts` tiene cero consumidores y `lib/whop-evento.ts` solo su
test. Pero la integración sigue registrada en los tres catálogos
(`lib/integraciones-catalogo.ts:74`, `lib/metodo-catalogo.ts:736`,
`lib/metodo-verificar.ts:383`) más el logo en `ServicioVisual.tsx:66`, así que un cliente
la ve, carga su API key, el tilde verde le dice que anda… y no pasa nada. Peor:
`metodo-catalogo.ts:751` le pide apuntar un webhook a `{{APP_URL}}/api/webhooks/whop`,
que ahora es un 404. No se sacó en esta pasada porque retirar una tarjeta de integración
es un cambio que ven todos los clientes y no estaba en el pedido. **O se saca la
integración entera (son 3 registros + el logo), o se le vuelve a dar un consumidor.**

### El roadmap de `/admin/dev/customer-success` quedó viejo

⚠️ **PENDIENTE.** El registro del área (`app/admin/dev/areas.ts`) sí se actualizó: decía
`estado: 'por-construir'` apuntando a `/cs-analyst` (un ComingSoon) cuando
`/customer-success` existe y está desplegada desde el 11/08 — o sea que el registro
declaraba por construir una tab que se está usando. Ahora dice `parcial`, apunta a
`/customer-success`, enumera las 15 rutas donde cae el trabajo y linkea este documento.

Lo que NO se tocó es su Roadmap PROPIO (`app/admin/dev/customer-success/roadmap-cs.ts`,
26 KB): su grupo «El bucle de entrega» son los siete pasos del programa borrado, varios
marcados `hecha`. Se le puso un aviso en la cabecera y se le arregló el import muerto
(`TOTAL_MODULOS` / `TOTAL_CLASES` quedaron fijos en 12 y 44, que ahora son un HECHO
fechado y no un dato vivo). Falta decidir si se reescribe o se retira.

### Lo que rompí y no arreglé, porque no era mío

`npm test` queda con **un** fallo: «ninguna pantalla del repo le habla al cliente de vos»,
por nueve strings en `app/admin/friccion/page.tsx` (commit `94ca3bc2`, del mismo día).
Verificado que es anterior: los nueve están en HEAD y no toqué ni esa pantalla ni
`tests/puente-panel-copy.test.ts`. El otro fallo —`vive[]` de `tests-qa` apuntando a
`scripts/ensayo-bucle-cs.ts`— sí era mío y se arregló: **borrar un script rompe el
registro de áreas de OTRA área**, que es justo lo que `tests/dev-areas.test.ts` existe
para cazar.


### «Rearmala desde cero» y el diagnóstico obvio que era el equivocado (26/09/2026)

El pedido fue: «todo lo que está ahí es de Mauricio… vuelve a armar esa tab para todo el
mundo, desde 0, **no tomes en cuenta lo de Mauricio**». Se rearmó, y la respuesta fue
*«pusiste una cantidad de cosas que no te pedí, te basaste en lo de Mauricio que
justamente te dije que no lo hagas»*.

Y tenía razón, aunque de las 44 clases, de Whop y del temario no hubiera quedado una
línea. **Lo que se calcó no fueron los datos: fue la FORMA.** La tab de él tenía una
señal de salud, un reloj de programa, números de cabecera y una ficha en tabs; la nueva
tenía una señal de atención, un reloj de contrato, números de cabecera y una ficha en
tabs. Cada pieza se justificó sola —«el contrato es universal», «los cobros tienen
`workspace_id`»— y el conjunto era la misma pantalla con otro relleno.

**La regla que queda: «desde cero» no se cumple reemplazando los datos, se cumple
volviendo al pedido.** El pedido era «clientes que pueden tener proyectos, tareas y
recurrentes». Todo lo que no sea una de esas cuatro cosas no entra, aunque se pueda
calcular y aunque la tabla tenga `workspace_id`. El test es el cliente recién cargado:
si la pantalla le afirma seis cosas («Semana 1», «Ninguno todavía», «Sin vencidas», tres
«Sin cargar») sobre datos que nadie cargó nunca, está contestando preguntas que nadie
hizo.

**Y el costo de la forma de más no es visual, es de lectura:** la ficha leía contrato,
cobros, sesiones y el historial completo de WhatsApp de toda la cartera para dibujar
cuatro números que nadie pidió. Podarla sacó 753 líneas y cuatro consultas por carga.

⚠️ **El detalle que se rompe al podar y no lo caza el typecheck:** la cabecera pegajosa
del detalle tenía `margin:-18px`, que era el padding de la caja que metía la ficha en
tabs (`.dc-cuerpo`). Sacadas las tabs, el contenedor de scroll pasó a ser
`.mk-modal__cuerpo` y sus `4px`. Un margen negativo copiado de otra caja no falla: deja
una franja transparente por la que se ve pasar el texto que scrollea. Se verificó en el
navegador, que es el único lugar donde eso se ve.

### La tab leía la tabla equivocada, y el comentario del archivo afirmaba lo contrario (26/09/2026)

El síntoma: los tres clientes de MaKo decían «sin trabajo suyo en el tablero», y el pedido
que llegó fue *«no tengo forma de asignar proyectos o tareas a clientes»*. El diagnóstico
obvio —falta la asignación— era cierto y no era la causa.

**Lo que pasaba, medido contra producción:**

```
ws   experimento_tareas   tarea_categorias   plan_tareas   plan_proyectos
 1         212                   19                0             0
 9           0                    0              396            71   ← el super-admin
11          68                    9                0             0
13          19                    6                0             0
```

Este producto tiene DOS tableros con la misma pantalla y tablas distintas: el del
super-admin (`plan_*`) y el de cada cliente (`experimento_*`). Customer Success leía
`experimento_*` siempre. En el workspace donde viven los clientes de MaKo esa tabla tiene
CERO filas, así que la tab estaba leyendo la tabla vacía: no fallaba el cruce, ni los
permisos, ni los datos.

⚠️ **Y `app/customer-success/trabajo.ts` tenía escrito, con todas las letras, que leer
`plan_tareas` sería el error** — «que además es del super-admin y para el ws1 está vacío».
Era cierto para el ws1 y falso para el ws9, y el comentario se leía como una advertencia
verificada. Un comentario que enumera UN caso y concluye una regla es la forma más cara de
equivocarse: el próximo que lo lea no vuelve a medir.

**La regla que queda:** cuál de los dos tableros te toca se decide en UN lugar
(`lib/tablero-actual.ts`), que es la misma condición que usa `/plan`. Con dos criterios hay
un workspace donde la tab muestra un tablero y su link «abrir en el tablero» lleva al otro.

### Una columna con 0 escritores no existe

`experimento_tareas.cliente_lead_id` está desde la migración 0159 (agosto) y el 26/09 tenía
**0 filas escritas de las 299 tareas del producto**. El cruce cliente↔proyecto la trataba
como «la única clave honesta» y en la práctica nunca se ejecutaba: todo ataba por parecido
de nombre.

El único escritor era `lib/plan-propuesta.ts`, y sólo para lo que nace de un borrador de
reunión con el cliente ya resuelto. **Antes de apoyar una regla en una columna, contá sus
filas:** `select count(*) where <col> is not null`. Es una consulta y distingue «tenemos el
dato» de «tenemos dónde ponerlo».

### Asignar a mano tiene que ser EXCLUYENTE, o el mismo trabajo sale en dos fichas

Lo encontró el test al escribirlo, no leyendo el código. La primera versión de la pasada
nueva de `atar` agregaba el lead declarado por el proyecto y dejaba correr las otras tres
pasadas igual: «Cliente: Grupo Esquer» asignado a mano a TEXX ataba con TEXX **y también**
con Grupo Esquer por el nombre.

O sea: se elegía el cliente en el picker, se guardaba bien en la base, y el trabajo aparecía
en DOS fichas —una equivocada— sin forma de sacarlo de ahí. El test falló, el código estaba
mal, y la corrección es una línea (`declarados`) más un `continue` en cada pasada.

**Lo general:** cuando se agrega una fuente de verdad más DURA a un resolvedor que ya tiene
varias, no alcanza con ponerla primera. Hay que preguntarse si las otras pueden seguir
opinando sobre lo mismo — y si la nueva es una decisión de una persona, la respuesta es no.

### La cura de «busca cada vez» no era un caché (26/09/2026)

La ficha de un cliente tardaba entre 0,5 y 13 segundos en abrir, porque leía el tablero
ENTERO —396 tareas y 71 proyectos en el ws9— y corría el cruce blando sobre todo, cada vez,
para mostrar dos tarjetas. El pedido fue «debería quedar memoria».

Un caché habría sido la respuesta obvia y la equivocada: guarda una respuesta DERIVADA y
obliga a decidir cuándo se ensucia (¿al crear una tarea? ¿al renombrar un proyecto? ¿al
ganar un lead?), y el día que se ensucia sin que nadie lo note la ficha muestra trabajo que
ya no es de ese cliente.

Lo que lo resolvió fue que el dato EXISTA: `cliente_lead_id` (mig 0172) no es una respuesta
guardada, es la clave, y se consulta con un índice. Medido en dev contra la base de
producción, la misma ficha:

| | |
|---|---|
| `trabajoAsignadoAction` (por clave, 2 consultas filtradas) | **1.284 ms** |
| `trabajoDelClienteAction` (tablero entero + cruce) | **13.604 ms** |

La pantalla lee las dos: la rápida pinta, y la lenta llega después y PROPONE lo que se
parece por el nombre, abajo de todo y rotulado como lo que es.

### Auto-asignar por mención es un grep, y el grep contesta lo contrario

«Si en la descripción lo dice, MaKo debería auto asignar». Medido antes de escribir una
línea, buscando el nombre de cada cliente en el título y el detalle de cada tarea:

```
ws    clientes  tareas   «mencionan» a un cliente
 1       14      212              3
 9        3      396             43
11       11       68              1
13        2       19              0
```

Las 43 del ws9, leídas: «Que Leila y Leandro puedan entrar como clientes antes del
viernes», «Probar el onboarding con un cliente de prueba (ANTES que entre Leila)», «No
funciona al crear un grupo de cliente (probado con Mauricio)». Todas nombran a un cliente y
**ninguna es trabajo para él**: es trabajo de producto que lo usa como ejemplo, como caso
de prueba o como fecha límite. Asignarlas llenaba la ficha de Leila con los bugs de MaKo.

Es la misma forma del error que AGENTS.md ya tiene medido para las recurrentes (buscar
«semanal/diaria/recurrente» daba 11 y ninguna era una recurrencia).

**La regla: cuando la pregunta es «¿lo nombra?» hay un grep; cuando es «¿es PARA él?» no
hay regla.** Lo primero se resuelve con código y lo segundo con IA — y el default de la IA
es NO, porque una tarea sin cliente se ve igual que siempre en el tablero y una tarea en la
ficha equivocada la lee alguien como un hecho. Corrida una vez el 26/09: de las 43 del ws9,
la IA aceptó **cero**. Ése era exactamente el punto.

### Asignar a mano tiene que GANARLE al parecido, no sumarse

Ya está arriba con su test, y conviene el número: al materializar la clave del proyecto, la
primera versión dejaba correr igual las pasadas por nombre, así que un proyecto asignado a
TEXX seguía apareciendo en la ficha de «Grupo Esquer». Lo encontró el test al escribirlo, no
leyendo el código.

### «0 de 43» no era un veredicto: la IA no había contestado (26/09/2026)

Lo reporté como un logro —«MaKo rechazó las 43, que era el punto»— y era un fallo de
lectura disfrazado. `chatCheapCascade` devolvió la cadena VACÍA (Groq contesta «Failed to
validate JSON» con este prompt y el modelo gratis de OpenRouter dejó de existir), y
`leerVeredicto('')` devuelve `[]`. Cero aceptadas.

**Es la falla que este repo tiene documentada seis veces**, cometida por mí y encima
reportada como un acierto: «no pude preguntar» y «pregunté y dijo que no» dan el mismo
número, y el segundo se lee como que el sistema funcionó.

Lo que la delató fue probar el juez contra los casos reales e imprimir la respuesta CRUDA.
Sin eso, «0 de 6» y «0 de 43» se ven iguales para siempre.

**La regla, ahora en el código:** `sinRespuesta` se cuenta aparte y la pantalla dice «no
pude preguntarle por N». Y la cascada va con `provs: CASCADA_DOCS` (Gemini primero), no con
el default, que arranca por Groq y arrastra a toda la fila.

### El candidato no se busca en el DETALLE

`clavesEnTexto` miraba `titulo + detalle`, y los detalles de las tareas mencionan a todos
los clientes. Medido en el ws9: **46 candidatas**, la mitad cosas como «Que la Retro se
ejecute SOLA» o «Arreglar el botón de copiar en el Segundo Cerebro», atribuidas a Leila
porque su nombre aparece UNA vez en un detalle de 6.000 caracteres.

El juez recibía «¿"Que la Retro se ejecute SOLA" es de Leila?» y no tenía con qué
contestar. Con el prompt permisivo dijo que sí a veinticinco.

**El detalle es CONTEXTO —menciona a todo el mundo— y el título es lo que la tarea ES.**
Buscando sólo en el título quedan 6 para Leila y 0 para Juanfran, que son las de verdad. El
detalle se sigue mandando al juez como evidencia, que es su lugar.

### Un prompt con ejemplos de una sola dirección no pide un juicio: pide esa dirección

La primera versión del juez tenía cuatro contraejemplos del NO («probado con X», «antes de
que entre X») y un «ante la duda, NO» de cierre. Rechazó todo — incluidas «Borrarle a Leila
los audios 21 a 24 para que los regrabe» y «Reiniciar el onboarding de Leila sin perder su
CRM», que son literalmente trabajo sobre la cuenta de un cliente.

Agregando los ejemplos del SÍ, sobre las mismas 6 acierta las 2 correctas y rechaza la
fecha, el caso de prueba y el ejemplo de bug.

⚠️ **Y el arreglo se pasó al otro extremo antes de quedar bien.** Con los ejemplos del SÍ
puestos y el candidato todavía sacado del detalle, aceptó 25 de 46. Un prompt se mide sobre
los casos REALES y se mira qué contestó, no si «suena» equilibrado.

### Un cliente tiene DOS nombres, y el cruce usaba uno

`nucleoDe` devolvía `empresa || nombre`. Con eso, «Cliente: Código Inmobiliario» figuraba
en la lista de huérfanos y Juanfran en la de clientes sin proyecto — **los dos a la vista
en la misma pantalla y sin forma de encontrarse**. Ahora el tier del nombre prueba las dos
alternativas por separado (la empresa y la persona), y la unión sólo se usa para el tier
del parecido.

Las claves de cada alternativa van SEPARADAS y no en una sola bolsa: el tier exige un
subconjunto completo, y «Código Inmobiliario Juanfran» no es subconjunto de nada.

### Asignar una TAREA reclamaba su proyecto entero

`leadPorProyecto` decía «una tarea que declara su lead ata el proyecto entero». Era
inofensivo mientras 0 de 299 tareas tuvieran lead escrito; desde que se pueden asignar, es
activamente falso. Al asignarle 2 tareas a Leila, su tarjeta pasó a decir **«1 proyecto ·
20 abiertas»**: el proyecto completo de otro tema, con sus otras 18 tareas adentro.

**Una regla que nunca se ejecutó no está probada, está escrita.** El día que empieza a
ejecutarse es el día que se descubre qué hacía.

### Tres intentos de «que se parezca al plan», y el que funcionó fue no parecerse (26/09/2026)

El pedido fue, en tres tandas seguidas:
1. «Aprovechá el diseño de las cards de proyecto y tareas» → se dibujó una lista con
   filete. Rechazado: «sigue siendo una lista».
2. Se dibujaron TARJETAS con la cara del tablero. Rechazado: «el diseño debe ser
   EXACTAMENTE igual que en el plan. Si abro el detail se debe ver IDÉNTICO».
3. «Replicá EXACTAMENTE igual la tab de plan dentro del detail» → se montó `PlanBoard` /
   `TodoBoard`, los mismos componentes que renderiza `/plan`.

**Lo que me hizo perder las dos primeras:** una razón técnica que era cierta y no era un
impedimento. `CardTile` pide el `board` entero (el `ReturnType` de `useBoard`), así que
montarlo «obligaría a un segundo `useBoard`, dos escritores pisándose». Cierto — y sólo
aplica si los dos están montados A LA VEZ sobre las mismas filas. La página de un cliente y
`/plan` son dos RUTAS: nunca coexisten.

**La regla: antes de copiar el diseño de algo, preguntá qué impide montar la cosa.** Si la
respuesta es una condición («no pueden estar los dos a la vez»), fijate si tu caso la
cumple antes de pagar una segunda implementación. Un diseño copiado hay que mantenerlo
sincronizado para siempre; un componente montado no.

### «Sigue cargando cada vez» era la FORMA, no la velocidad

Se reportó dos veces y las dos veces ataqué la velocidad: primero partiendo la lectura en
dos (1.284 ms contra 13.604), después sacando `detalle`/`historial`/`checklist` del cruce
(2.105 KB contra 54). Las dos mejoras eran reales y **el síntoma seguía**, porque un modal
que pide sus datos al abrirse TIENE un estado de carga por más rápida que sea la consulta.

Lo que lo cerró fue que los datos vinieran CON EL HTML: no hay nada que mostrar mientras
tanto porque no hay «mientras tanto».

⚠️ **Y la primera cura fue la equivocada, aunque funcionó.** Convertí el detalle en una
RUTA (`/customer-success/[id]`), que resuelve el problema por el camino más fácil — el
server component trae las filas. El dueño lo rechazó al día siguiente: «no quiero que sea
otra ruta, quiero que sea un pop-up, un modal» (26/09/2026). Un modal SÍ puede no tener
estado de carga: lo que hace falta es que la página que lo contiene precargue el trabajo de
TODOS los clientes (`filasDeTodos`, `app/customer-success/trabajo.ts`) y se lo pase por
prop. Medido en el ws9: 78 KB y 556 ms para los tres clientes, una sola vez, contra una
consulta por apertura. **La forma de la pantalla es del dueño; la latencia es mía.**

**El olor:** cuando una optimización mide bien y el reporte no cambia, lo que está mal no
es el número.

### Un componente cuyo estilo vive en la hoja de OTRO no es un componente

`Avatar` se veía redondo en la grilla y **cuadrado** en la página nueva: su `border-radius`
estaba en `.cl-av`, dentro del `CSS_CLIENTE` que sólo inyecta `ClientesApp`. Compila, no
avisa, y sólo se ve montándolo en otro lado.

Son seis propiedades sobre un elemento hoja: van inline y viajan con él. La regla general
es que un componente compartido no puede depender de que su consumidor se acuerde de
inyectar una hoja — y si el estilo es grande, lo inyecta el componente, no el que lo monta.

## La portada y la foto: un campo, tres significados y un guard de origen (27/09/2026)

«Quiero que la foto de perfil del cliente se pueda configurar y también el banner… como lo
hace Notion, que te ofrece varias imágenes para la portada. Consume alguna API gratuita o
algo que tenga algo parecido a lo que quiero.» Y: «Quiero que los proyectos también tengan
portada.»

**Vive en:** `lib/portadas.ts` · `app/_components/PortadaPicker.tsx` ·
`app/api/portadas/route.ts` · `supabase/migrations/0173_portadas_y_fotos.sql` ·
`app/customer-success/FichaCliente.tsx` · `app/plan/board/BoardShell.tsx`

### El repositorio de fotos: por qué Picsum y no Unsplash

Unsplash y Pexels tienen catálogos mejores **y piden una API key**. Una feature que
necesita una variable de entorno nace apagada para todo el que no la cargó y no avisa: se
ve como un selector vacío. Picsum (`picsum.photos/v2/list`) no pide nada.

⚠️ **Y no manda `Access-Control-Allow-Origin`** (medido con `curl -D-` el 27/09). Así que
el LISTADO va por nuestro server (`/api/portadas`) y las IMÁGENES van directo desde el
`<img>` — un `<img>` no pasa por CORS. Confundir las dos mitades es lo que hace que la
pestaña se vea vacía sin un solo error en la consola.

Los degradados son un catálogo NUESTRO, sin red: se dibujan siempre, entran en cualquier
ancho y no pueden 404ear. Por eso son la primera pestaña y las fotos la segunda.

### Un guard de origen, otra vez, y los cuatro parecidos

Una portada se dibuja adentro de un `url()` de CSS y una foto de perfil adentro de un
`<img>`, en el navegador de cualquiera que abra la tab. Con `startsWith` sobre el prefijo,
`https://picsum.photos@evil.tld/x` pasa — y su origen REAL es `evil.tld`, o sea el
navegador del cliente yendo a buscar la imagen a un tercero con su referer. Va
`new URL(v).origin` contra un `Set`, exigiendo `https:`, con el test que enumera los cuatro
(`tests/portada-proyecto.test.ts`, probado rompiéndolo: 9 pasan / 1 falla).

Y el origen propio (el bucket de Supabase) sale del env y no de una constante: cada entorno
tiene su proyecto, y hardcodearlo dejaría a producción rechazando sus propias subidas.

### Un campo para tres cosas, y por qué no son dos columnas

`portada` guarda `grad:<id>`, una URL https, o nada. Dos columnas —un color y una URL—
serían dos respuestas a «¿qué se ve arriba?», y el día que estén las dos puestas gana la
que el código mire primero. Nadie sabe cuál es, y el que eligió la foto ve un degradado.

**Vacío NO es un dato faltante:** es el degradado derivado del nombre, que es exactamente
lo que se veía antes de la 0173. Por eso el selector lo ofrece como «Automático» y no como
«Sin portada» a secas.

### La cabecera de `Modal` no se puede sangrar con un margen negativo

Se reportó como «el banner se corta a la derecha y no llega al final». `.mk-modal__cab`
(`app/_ui/ui.css`) es un flex con `padding: 20px 24px 16px`, `gap: 16` y el botón de cerrar
de 32 px como hermano. Un `margin: -20px -24px -16px` adentro del título recupera el
padding **y deja afuera los 48 px de la derecha** (el gap más la X).

Acertarle con un margen negativo mayor es adivinar una suma que cambia el día que alguien
toque `ui.css`. La cura que no tiene casos: anular el padding del cab para ese modal
(`.mk-modal__cab:has(.fc-cab){ padding:0; gap:0 }`) y sacar la X del flujo
(`position:absolute`), que además la deja flotando sobre la portada como en Notion.

### Un `margin-top` negativo en la fila sube el TEXTO también

El avatar monta sobre la banda con `margin-top: -31px` **en la fila**, así que subía el
nombre con él. Con un degradado claro se leía; con una foto de un bosque, no. El avatar va
`position: absolute` con la cuenta exacta (140 de banda − 31 de monte), que además no
depende del alto del texto — y el texto se queda abajo, donde hay fondo plano.

### Lo que quedó SIN hacer

**`app/customer-success/trabajo.ts` tiene tres funciones exportadas sin un solo call
site**: `trabajoDeCliente`, `trabajoAsignado` y `catalogoAsignable`, más sus tipos
(`TrabajoCliente`, `ResultadoTrabajo`, `TareaCS`, `ProyectoCS`, `Asignable`, `Catalogo`).
Quedaron huérfanas al sacar el botón de «Asignarle trabajo» (27/09) junto con sus cuatro
server actions, que sí se borraron. No se borraron ellas en la misma pasada porque
`tableroDeLaCartera` —que la pantalla sí usa— comparte tipos con ellas
(`ProyectoHuerfano`, `ResumenTrabajo`) y desenredarlo a las apuradas arriesgaba la grilla.
`asignarTrabajo` SÍ sigue viva: la llama `autoasignar`.

## Montar el tablero adentro de un modal: lo que el componente asumía por ser la pantalla (27/09/2026)

«Al abrir una tarea o un proyecto, al intentar abrir el detail se bugea y no abre nada,
cambia la ruta y luego ya no me deja abrir el cliente.»

**Vive en:** `app/customer-success/FichaCliente.tsx` · `app/_components/pila-modales.ts` ·
`app/_ui/Modal.tsx` · `app/plan/board/BoardShell.tsx` · `app/plan/PlanBoard.tsx` ·
`app/plan/TodoBoard.tsx` · `app/plan/board/useBoard.ts` ·
`tests/modal-contenedor.test.ts` · `tests/cliente-fijo-al-crear.test.ts`

Eran DOS bugs encadenados y ninguno se ve leyendo el componente que falla. Los dos se
midieron en el navegador antes de tocar una línea, y después un barrido de cinco lentes
en paralelo encontró **siete más** que nadie había reportado.

### 1. La pila apagaba a la ficha, y con ella al modal que se acababa de abrir

`FichaCliente` es un `Modal` de la casa y monta el tablero entero adentro. Al abrir el
detalle de una tarea, ese detalle registra una capa nueva en `pila-modales`, que esconde a
la de abajo con `display:none` — y el detalle **es un descendiente del DOM de la ficha**,
así que se apaga con ella.

Medido en la consola: `.mk-modal__fondo` en `display:none`, y adentro el overlay del
detalle montado, en `display:flex` y con z 132. **Montado y sin caja.** Un subárbol bajo un
`display:none` no se pinta, `position: fixed` incluido.

⚠️ **Marcar los modales del tablero como `anidada` NO servía**, y el barrido lo midió:
`anidada` también apaga la semántica de REEMPLAZO que esos modales tienen entre sí en
`/plan` — el detalle de un proyecto abierto desde una tarea la tapa y tiene un «← Volver a
la tarea». Con `anidada` quedarían los dos overlays dibujados, con dos scrims y dos blurs
superpuestos, que es exactamente lo que la pila existe para evitar.

**La cura va del lado del CONTENEDOR, no del hijo:** `contenedor` en `useCapaModal` — «lo
que se abre encima vive adentro mío, no me apagues». Es opt-in, son cinco líneas y no
cambia nada para las otras ~25 pantallas.

**La regla que queda:** `anidada` la declara el de ARRIBA («yo no tapo»); `contenedor`, el
de ABAJO («no me apagues»). Hacen falta las dos porque el de abajo no sabe quién se va a
abrir encima y el de arriba no sabe dónde está montado.

### 2. El tablero escribía `?tarea=` en la URL de `/customer-success` — y la leía

`BoardShell` guarda su estado en la URL (`?vista=`, `?tarea=`, `?proyecto=`) y lo LEE al
montar, a propósito: en `/plan` el link que copiás es la pantalla que ves. Adentro de la
ficha eso es destructivo en las dos direcciones: ensucia la URL de otra ruta, y al volver a
abrir el cliente el deep-link reabre ese detalle **que la pila apaga**. De ahí el «ya no me
deja abrir el cliente»: cada intento montaba el tablero, que abría el detalle, que tapaba
todo. Sobrevivía al F5.

Lo apaga `embebido`, que además resultó ser el interruptor natural de otras tres cosas que
sólo valen cuando el tablero ES la pantalla (abajo).

### 3. Un solo Escape cerraba la ficha entera

Medido: Escape adentro del detalle de una tarea cerraba la tarea **y** la ficha. Los
listeners de todos los modales abiertos viven en `document`, y `stopPropagation()` no lo
evita: frena la propagación a otros NODOS, nunca a los otros listeners del mismo. O sea que
**dos `Modal` apilados siempre se cerraron los dos** — lo que cambió es que ahora hay dos
capas visibles a la vez y se ve.

La cura es `esElDeArriba` en `CapaModal`, y es una **función**, no un boolean: un listener
de teclado se registra una vez y vive muchos renders. Con un boolean habría que meterlo en
las deps del efecto —y el del `Modal` devuelve el foco en su cleanup, así que re-ejecutarlo
haría saltar el foco cada vez que algo se abre encima— o guardarlo en un ref escrito
durante el render, que es otra cosa que no se hace.

### 4. Lo que se creaba adentro de la ficha perdía el cliente

El más caro, y **completamente silencioso**: no hay excepción, no hay 4xx, la tarjeta se ve
en pantalla y la columna queda en `null`. Eran tres agujeros:

- **El alta de tarea se auto-borraba.** `clienteFijo` envuelve `repo.createTask`, así que la
  fila nace con el lead — pero `useBoard.create` se queda sólo con `id`, `num` y `origen` de
  la respuesta y conserva el borrador LOCAL, que no lo tiene. El `markDirty` de la línea
  siguiente dispara un `saveTask` de la fila ENTERA con `cliente_lead_id: null`.
- **El `editar` interno del alta** (mitad cliente) hacía lo mismo un paso antes.
- **El alta de PROYECTO nunca tuvo cliente:** `clienteFijo` envolvía `createTask` y nada
  más, en las dos mitades. Y con el proyecto se perdían de vista las tareas colgadas
  adentro.

**La regla: un valor que inyecta el REPO tiene que volver al estado, o el próximo guardado
lo borra.** Todo upsert de fila entera armado desde el navegador tiene esta forma, y es la
misma trampa que AGENTS.md documenta para los mappers de lectura — acá aplicada al merge
posterior a un alta.

Verificado creando una tarea en la ficha contra producción: `cliente_lead_id: 2472`,
`cliente_nombre: 'Mauricio Bustos'`, con el `updated_at` POSTERIOR al alta (o sea que el
`saveTask` corrió y no la borró). La fila de prueba se borró después.

### Lo que `embebido` apaga, y por qué cada cosa

| Qué | Por qué sólo vale siendo LA pantalla |
|---|---|
| Leer y escribir la URL | La URL es la de `/customer-success`, no la del tablero |
| La bienvenida «MaKo cargó N tareas» | Va por portal con z 140 y NO se registra en la pila: se pinta encima sin apagar nada. Y `marcarWelcomeVisto` escribe la MISMA clave que `/plan`, así que abrir una ficha CONSUME la bienvenida del tablero grande |
| Los borradores de reunión pendientes | La consulta es del WORKSPACE y no se puede acotar a un cliente: el badge contaría reuniones ajenas |
| `<main>` y `minHeight: 100vh` | Un `<main>` dentro de otro no es HTML válido, y 100vh adentro de una caja topada en `min(85vh,720px)` obliga a scrollear el cuerpo aunque el cliente tenga dos tareas |
| `window.location.reload()` | Qué cliente está abierto es estado de React: recargar cierra la ficha. Va `onRecargar` (la ficha pasa `router.refresh()`) |

### Lo que quedó SIN hacer

- **La ficha no es linkeable.** `abiertoId` vive en `ClientesApp` y no viaja en la URL. Un
  `?cliente=<leadId>` leído en el server la haría sobrevivir a un F5 y compartible — y
  cerraría de paso el caso del `reload()` sin `onRecargar`. Es una feature, no un bug:
  queda anotada, no hecha. Vive en `app/customer-success/ClientesApp.tsx`.
- **El botón ✨ del header del tablero** puede abrir a mano `TareasCreadasModal` encima de
  la ficha; sigue sin registrarse en la pila. Sólo se apagó el AUTO-open.
- Las tres funciones huérfanas de `app/customer-success/trabajo.ts` de la entrada anterior
  siguen sin call site.


## La cara de una persona: un default que dibuja un monigote es peor que unas iniciales

Cosechado el 28/09/2026, del pedido «si agrego el email, sería bueno que ya ponga la foto de
perfil de ese email automáticamente en la card, y en todo caso que yo la pueda modificar».

**Vive en:** `lib/gravatar.ts` · `app/api/admin/usuarios/route.ts` · `app/api/compartir/route.ts` · `app/admin/AdminView.tsx` · `app/customer-success/page.tsx`

### `d=404` no es un detalle de la URL: es la decisión

Gravatar, sin parámetros, **no devuelve 404 cuando alguien no tiene foto**: dibuja un
monigote generado del hash (el «identicon»). Puesto en una tarjeta, eso le pone a esa persona
una cara inventada — y una cara inventada **se lee como si fuera la suya**, que es peor que
unas iniciales. El `d=404` es lo que hace fallar la imagen, y el `onError` de `Marca` cae a
las iniciales. Es el mismo modo de falla que el logo de otra marca en la tarjeta de un
servicio: no se lee como un error nuestro, se lee como un dato.

Medido: sacándolo, `tests/gravatar-cara.test.ts` pasa de 8/8 a **7 pases y 1 fallo**.

### La precedencia vive en UN lugar, y era la que ya estaba duplicada

`foto_url || gravatar || iniciales` parece trivial y estaba escrita en tres lados a la vez
(el hash en `/api/admin/usuarios` y en `/api/compartir`, el orden en `AdminView.caraDe`).
Ahora es `caraDeUsuario` y las pantallas reciben el resultado ya resuelto por el server —
`cara` viaja al lado de `gravatar`, que se queda para poder distinguir «eligió esta foto» de
«es la de su email». Dando vuelta el orden, el test pasa de 8/8 a **6 y 2**.

Y el corolario del respaldo, que es lo que hace que «Quitar la foto» funcione: **el Gravatar
se calcula al LEER y no se copia a la columna**. Si se copiara, quitar la foto elegida no
tendría a dónde volver — la columna tendría la misma URL y «quitar» no haría nada visible.

### Un módulo con `node:crypto` no necesita `server-only`: el import ES el guard

`lib/gravatar.ts` arrancó con `import 'server-only'` y se lo sacó a propósito. La regla de la
casa («la condición va en un módulo SIN server-only para que se pueda testear») pesa más acá,
porque lo que hay que testear es la PRECEDENCIA, que es la regla, no el hash. Y no queda sin
red: **un `'use client'` que importe un valor de ese archivo no compila**, porque `node:crypto`
no existe en el bundle del navegador. Es el mismo corte duro que daría la directiva, con el
test de propina.

⚠️ **Y eso decide a quién se consolida y a quién no.** `app/conocimientos/Compartir.tsx` es
cliente y dibuja Gravatares: no importa el módulo, recibe el HASH ya calculado de
`/api/compartir` y arma la URL con una plantilla de una línea. Consolidar eso habría metido
`node:crypto` en un bundle de navegador para ahorrar una interpolación.

## «Exactamente igual pero con los botones extras» se paga con una variante, no con un componente

El pedido «me gusta los botones de Acciones e Inspeccionar que pusiste en la preview de cada
card, ponlo también en la vista de agencia» tiene dos formas de resolverse y una sola sirve.

**Vive en:** `app/customer-success/CuentaDeMaKo.tsx` · `app/customer-success/ClienteCard.tsx` · `app/_components/TarjetaEntidad.tsx`

`CuentaDeMaKo` tiene CUATRO estados (sin cuenta / pendiente / aprobado / revocado), dos
mecanismos de entrada distintos (el super admin por `?ws=`, la agencia por la cookie firmada)
y su guard. Lo que cambia entre la ficha y la tarjeta es la ROPA: tinta al lado del nombre
contra píldora al pie. Un segundo componente «igual pero con botón» duplica los cuatro
estados, y la copia que se queda con tres es la que nadie mira. Va una prop `variante`.

Y del otro lado, lo que el menú «Acciones» de la tarjeta NO ofrece es tan parte del diseño
como lo que ofrece: no hay «Ver su ficha» —eso es el click en la tarjeta— porque un control
nuevo que contesta una pregunta ya contestada no suma una opción, parte la respuesta en dos;
y no hay ninguna que lleve a una pantalla que no existe. «Ver su equipo» sólo aparece cuando
hay gente que mostrar.

## Lo que cruza de inquilino se filtra en el SERVER, con el mismo corte que la entrada

El plan de cada cliente y su equipo son dos lecturas que salen del workspace de OTRO
inquilino, y las dos viajan con el HTML de `/customer-success`.

**Vive en:** `app/customer-success/page.tsx` (`datosDeMisClientes`)

- **El filtro es `clientesAprobados`, no la pantalla.** Lo que no esté aprobado no entra a
  los mapas: si mañana alguien dibuja el equipo de un cliente que no le corresponde, no va a
  tener de dónde sacarlo. Esconder un botón no protege nada; lo que protege es que el dato no
  esté.
- **Con la cartera vacía no se lee NADA.** Es el caso del 99% de las visitas a esta pantalla
  (todo cliente común), así que las dos consultas globales ni se disparan.
- **Y son dos lecturas globales filtradas en memoria, no N consultas.** `listarUsuarios` y
  `listarWorkspaces` ya son las que usa el panel de la plataforma: con 14 clientes, catorce
  consultas serían catorce viajes para lo mismo.

⚠️ **Una sola tab no son tabs.** La ficha dibuja la fila de tabs sólo cuando hay Equipo que
mostrar (gente, pedidos pendientes, o permiso para pedir). Una barra de navegación con un
solo destino es ruido con cara de mapa.

### Lo que quedó SIN hacer

- **La tab Equipo no edita.** Es de sólo lectura para la agencia, que pide; y el super admin
  sigue sumando y sacando gente desde el panel de la plataforma. Está bien así hoy (una
  segunda puerta a la misma escritura es un segundo guard que mantener), pero si alguna vez
  la agencia tiene que poder SACAR a alguien, esa decisión no está tomada. Vive en
  `app/customer-success/FichaCliente.tsx`.
- **La foto sólo se cambia desde el equipo del panel de la plataforma.** El pedido decía «que
  yo la pueda modificar» y se resolvió donde una PERSONA se edita (el menú ⋯ de cada miembro,
  subiendo por `/api/portadas`). Lo que no existe es una imagen propia del WORKSPACE: la cara
  de la tarjeta de un cliente es la de su admin. Si alguna vez se quiere un logo del negocio,
  eso es una columna en `workspaces`, no otra foto de usuario. Vive en
  `app/admin/AdminView.tsx`.
- **`/api/admin/usuarios` sigue calculando un `resumen`** (integraciones + perfil) que ningún
  cliente lee. Ya estaba anotado y sigue.

## Una cuenta aprobada con CERO usuarios: el alta que no crea a nadie (28/09/2026)

Cosechado de una pregunta del dueño del producto que resultó ser un bug: «**Código acaba de
agregar a un cliente, y ya lo acepté en superadmin. ¿Qué pasa ahora? ¿Le llega el email con
la invitación a MaKo?**». La respuesta medida era **no, y no podía llegar**.

**Vive en:** `app/customer-success/actions.ts` (`crearCuentaMakoAction`) · `app/customer-success/CuentaDeMaKo.tsx` · `app/api/admin/agencia/route.ts`

### El caso real, con números

Código Inmobiliario abrió la cuenta de Brigitte Eberlin el 28/09. El super admin la
aprobó. Estado en la base un rato después:

- workspace **15**, creado, `estado = aprobado`
- **0 usuarios**
- el lead: sin `email`, sólo teléfono

O sea **un inquilino que existe, está autorizado, y al que no puede entrar nadie** — y ni
un solo error en el camino. `crearCuentaMakoAction` creaba el workspace y el pedido de
alta, y **nunca creaba a la persona**. La aprobación marcaba una fila y no escribía a
nadie. Las dos mitades funcionaban perfecto y entre ellas no había nada.

**La regla que queda: si una acción termina en «alguien de afuera se entera», el test no
es que la acción devuelva `ok` — es contar las filas del otro lado.** Acá la consulta que
lo delata es de una línea (`usuarios where workspace_id = N`), y la pantalla no tenía cómo
mostrar ese cero: dibujaba «aprobado» y listo.

### `crearUsuario` NO manda mail, `invitarPorEmail` sí — y confundirlos falla en los dos sentidos

Son dos funciones y hacen cosas distintas, y el nombre de la primera invita a asumir lo
contrario. Cada confusión tiene su falla:

- Si creás con `invitarPorEmail` en el ALTA, le estás contando a un tercero que tiene un
  acceso **que el super admin todavía no autorizó**. Es la regla de la casa rota por el
  lado caro: el canal propone, la persona confirma.
- Si creás con `crearUsuario` y no llamás a nadie después, es el bug de arriba.

El reparto correcto sale del pedido del dueño («que abrir cuenta pida el email desde el
principio y sea obligatorio, y que luego le llegue el email de invitación»): **el ALTA crea
al admin en silencio, y la APROBACIÓN es la que le manda el acceso.**

### El orden de las dos escrituras importa: primero el chequeo, después el inquilino

`usuarios.email` es único. Con el chequeo después de `crearWorkspace`, un email ya usado
hace fallar el alta **con el inquilino ya creado** — y deja un workspace huérfano que
ningún listado marca como roto. El `buscarUsuarioPorEmail` va antes de la primera
escritura, no antes de la que puede chocar.

⚠️ **Y el mail no puede tumbar la aprobación.** Si `invitarPorEmail` falla, la fila ya está
aprobada: deshacerla sería revertir una decisión que una persona tomó porque falló un
servicio de correo. El resultado del envío viaja como un `aviso` en la respuesta y se
dibuja pegado al renglón, nunca como un 500. Tres avisos distintos, porque son tres hechos
distintos: se mandó, ya se le había mandado antes (`invitacion_enviada_at`), o no hay a
quién mandarle.

### El email del CRM no es el email del usuario, y hay que preguntar igual

El campo del modal viene **prellenado** con el del lead y se pregunta de todas formas. El
del CRM puede ser el del contacto comercial —quien negoció— y no el de quien va a usar la
app. Prellenar ahorra el tipeo; no preguntar decide por el otro.

Y el botón dice **«Abrir la cuenta»**, no «Crear»: lo que sigue le escribe a una persona y
no se deshace. La bajada dice cuándo («Ahí le llega su acceso, cuando se apruebe la
cuenta») porque esa consecuencia contada DESPUÉS del click es una sorpresa.

### Lo que quedó SIN hacer

- **La cuenta de Brigitte Eberlin (ws 15) sigue con 0 usuarios.** El flujo nuevo arregla las
  próximas, no las que ya nacieron rotas. Para repararla hace falta su email, que nadie
  cargó: el lead 2486 tiene teléfono y nada más.
- **No hay ninguna consulta ni alerta que encuentre esto solo.** Un workspace aprobado sin
  usuarios es invisible: debería ser una fila roja en el panel de la plataforma, y hoy hay
  que preguntarle a la base.
- **Rechazar un alta no pide motivo** aunque la columna existe (`agencia_altas.motivo`,
  mig 0178), así que la agencia ve «rechazado» sin saber por qué.
- **La tabla `agencias` de la mig 0176 quedó muerta** y no se dropeó.

## El panel de la plataforma: el chip en el workspace equivocado, y tres menús que no ofrecían nada (29/09/2026)

Cosechado de siete reportes seguidos sobre la grilla de Clientes y sus menús.

**Vive en:** `app/admin/AdminView.tsx` · `app/admin/FichaWorkspace.tsx` · `app/customer-success/ClienteCard.tsx` · `app/api/agencia/reinvitar/route.ts` · `lib/aviso-plan.ts`

### El chip «Dueño» estaba en un CLIENTE, y de él colgaban dos protecciones

«Quitale el tag de Dueño a Mauricio. Eso lo debería tener Martin Koncke, que es el dueño y
SuperAdmin.» Era `w.id === 1`, o sea `OWNER_WS`, que a pesar del nombre hace rato que es un
inquilino más. La plataforma es el workspace de capa `superadmin`.

⚠️ **Y el de MENOR id, no «cualquiera con esa capa»**, porque eso es exactamente lo que
hace `wsSuperAdmin()` en el server (`.order('id').limit(1)`). Con `capa === 'superadmin'`
a secas, dos filas dirían «Dueño» dos veces y una sería mentira.

⚠️ **EL BOOLEANO ESTABA ESCRITO DOS VECES y sólo cambié una.** `opcionesDe` tenía su
propio `const esDueno = w.id === 1`, aparte del de la tarjeta. Al mudar el chip, ese quedó
protegiendo a Mauricio y **ofreciéndole a la PLATAFORMA «Pausar» y «Eliminar…»**. El
server los rechaza —medido, 400 en los dos— pero una pantalla que ofrece algo que siempre
falla es una pantalla que miente. **Lo encontró la verificación en el navegador, no el
typecheck**: las dos expresiones compilaban.

### Un menú «Acciones» cuyo único ítem era un link que ya estaba a un click

«No entiendo que en las acciones de Agencia pusiste Abrir el CRM… ¿qué tiene que ver con
abrir CRM? Si eso está dentro del detail.» Verificado: el link vive adentro de la ficha
que abre el click en la tarjeta (`CRM → /crm/2451`). Un menú que se llama «Acciones» y
sólo sabe navegar no ofrece ninguna.

⚠️ **Y `Dropdown` no tiene rama de lista vacía**: con `options={[]}` igual pinta el botón
y abre un popover en blanco. Pasa de verdad — hoy los dos clientes de esa agencia lo dejan
vacío, porque uno no tiene cuenta y el otro no tiene a nadie adentro.

### Ninguna de las dos rutas que ya reenvían le servía a una agencia

Para poner «Reenviar el acceso» hizo falta un endpoint nuevo, y el porqué no es evidente:

- **`/api/equipo` se scopea con `getWorkspaceActual()`**, o sea que reenvía DENTRO del
  workspace del request. Desde la tab de Clientes de la agencia, ese workspace es el de la
  agencia y no el de su cliente.
- **`/api/admin/*` exige `getSesionAdmin()`**, que es el super admin.

O sea que «reenviarle el acceso a un cliente» sólo lo podía hacer Martín a mano.

⚠️ **El guard de la cartera autoriza sobre un CLIENTE, no sobre una persona.** Sin filtrar
el destinatario por `workspace_id`, un `usuarioId` de otro inquilino pasa el permiso
correcto y le llega el mail de acceso a quien no corresponde — y sale bien, sin un error.
Por eso el destinatario lo elige una función pura y testeada (`aQuienReinvitar`) y no el
handler.

### «Cambiar permisos»: el guard del endpoint dejaba pasar `superadmin`

El menú tenía un ítem por plan. Pasó a ser uno y un modal — y elegir dejó de ser de
memoria: la `descripcion` de cada capa existe desde siempre y no se veía en ninguna
pantalla.

⚠️ **Lo caro fue lo que apareció al mirar el endpoint**: `case 'capa'` validaba con
`esCapaValida`, que devuelve TRUE para `superadmin`. Esa capa no es un plan: es cómo se
identifica la PLATAFORMA. Un POST con `capa:'superadmin'` **le mudaba a un cliente las
credenciales y el remitente de MaKo**. El menú dejó de ofrecerlo el 28/09, pero **el menú
no es el guard** — y esta ruta lo aceptó un día más.

### El mail del cliente va en NEUTRO, no en la voz de la casa

`invitarPorEmail` está escrito en español neutro («Entra desde aquí», «escríbenos») y es a
propósito: la voz rioplatense es la de MaKo hablándole a Martín, no la del texto que lee un
cliente. Lo verifica el test con `marcasDeVoseo`, el detector que ya existía.

⚠️ **Y mi primer regex propio para eso marcaba «Entra desde aquí» como voseo** (`entr[áa]`
incluye la «a» sin tilde, que es el imperativo neutro), haciendo fallar el test sobre un
texto correcto. Un detector al lado de uno que ya está es la forma de que los dos digan
cosas distintas sobre la misma frase.

### Dos capas de modal para un solo modal

Los dos diálogos nuevos llamaban a `useCapaModal(true, { anidada: true })` **y** le pasaban
`anidada` al `Modal`, que ya lo llama. Resultado: dos entradas en la pila para un modal, y
**Escape dejaba de cerrar** — el handler de `Modal` sólo actúa si su propia capa es la de
arriba, y la de arriba pasaba a ser la que yo registré de más. No da error, no lo ve
ningún test, y sólo aparece probando la tecla.

### Lo que quedó SIN hacer

- **«Pausar la cuenta» para una agencia no se hizo, y no por falta de endpoint.** Pausar
  es la palanca de COBRO de la plataforma: si paga el cliente, dársela a la agencia es
  dejar que un tercero le corte el acceso a alguien que le paga a MaKo. Es una decisión de
  producto.
- **De los 10 workspaces, sólo 3 están ligados a un cliente del CRM** (`leads.cliente_ws`),
  así que los otros siete dicen «Sin cliente en tu CRM» en vez de los tres números.
- **`FichaCliente` sigue sin montar `CabeceraDetalle`**: son dos de tres pantallas, no las
  tres que decía el comentario de esa pieza.

## La misma ficha se veía distinta según quién mirara, por UNA condición (29/09/2026)

Cosechado del reporte más incómodo de la semana: **«¿me estás mostrando algo diferente al
inspeccionar de lo que realmente ven los usuarios? Eso está muy mal.»** Llegó con dos
capturas de la MISMA ficha —la de un cliente de la agencia— sacadas con dos sesiones: en
la de Joan había una fila de tabs «Tablero | Equipo», y en la del super admin no había
ninguna.

**Vive en:** `app/customer-success/FichaCliente.tsx` · `app/plan/board/BoardShell.tsx`

### No era «Inspeccionar miente»: era una condición de tres términos

```
const puedePedir = Boolean(c.clienteWs && cuentas?.puedePedirAltas && !cuentas.superAdmin && aprobado);
const hayEquipo  = Boolean(equipo?.length || altas?.length || puedePedir);
{tabs.length > 1 && <Tabs … />}
```

La tab «Equipo» sólo existía **si había algo adentro**, que suena razonable. Y para el
super admin el botón «Pedir sumar a alguien» está apagado a propósito —él no pide altas,
crea— por el `!cuentas.superAdmin`. En un cliente con **cero usuarios** ese botón era lo
ÚNICO que habría estado adentro, así que el `hayEquipo` daba false y **la tab entera
desaparecía sólo para él**.

Medido en el navegador con las dos sesiones sobre la misma ficha (ws15, 0 usuarios):

| | fila de tabs |
|---|---|
| agencia (ws13, rol usuario) | `["Tablero", "Equipo"]` |
| super admin en `/customer-success?ws=13` | `[]` |

Para el super admin había **dos** motivos independientes, no uno: además del
`!cuentas.superAdmin`, `puedePedirAltas` es `esAg && adminDeWorkspaceActual() != null`, y
él no es miembro de ese workspace.

**La regla que queda: una condición sobre «si hay contenido» aplicada a un CONTENEDOR lo
vuelve una condición sobre QUIÉN MIRA, en cuanto alguno de sus términos sea un permiso.**
Esconder un botón que alguien no puede usar está bien; esconder la PANTALLA donde vive
ese botón deja a esa persona sin la información que sí le corresponde — y acá lo que no
veía era justo «no hay nadie adentro de esta cuenta», el dato más caro de ese cliente.

⚠️ **Y el modo de falla es el peor que hay: nadie lo puede reportar.** Cada uno ve su
versión y las dos son coherentes. Salió porque un usuario de la agencia mandó una captura,
no porque algo fallara.

### Y de paso, la segunda fila de tabs que ya se había reportado una vez

«Soluciona lo de la tab del tablero y equipo, **ya habíamos hablado de eso**.» El 28/09 se
arregló el panel de la plataforma —«Equipo» pasó a ser una vista del selector que el board
ya trae— y **esta pantalla, que es la hermana, quedó con la fila vieja**. Es el costo de
arreglar el síntoma en la pantalla desde la que se reportó en vez de buscar las otras
copias: el mismo reporte vuelve, y la segunda vez con menos paciencia.

Ahora las dos montan `vistaExtra`, y la vista se pasa **sin condición**: el permiso de
PEDIR un alta sigue siendo del que mira, lo que se unificó es la vista.

⚠️ **`vistaValida` sólo conoce las cuatro literales del board**, así que un deep-link a la
vista extra («Ver su equipo (N)» desde la tarjeta) caía en Prioridades — un control que no
hace lo que dice, sin ningún error.

### Lo que quedó SIN hacer

- **`FichaCliente` sigue sin montar `CabeceraDetalle`**: es la tercera copia de la
  cabecera, y ésta es la segunda vez que un arreglo de la pieza compartida no le llega.

## Una tab que no puede hacer nada, y un vacío que se lee como un bug (29/09/2026)

Cosechado de dos frases del mismo mensaje: «¿de qué sirve que tenga una tab de equipo que
no puede hacer nada? Ahí deberían poder agregarle setter o closer» y «no pongas este
mensaje "Nadie más entra a la cuenta de Brigitte Eberlin todavía", pareciera que se bugeó
y que la propia Brigitte no puede entrar».

**Vive en:** `app/customer-success/FichaCliente.tsx` (`EquipoDelCliente`)

### «Nadie MÁS» afirmaba que había alguien

La lista vacía de esa tab significa **cero personas** —ni siquiera el dueño de la cuenta—
y la frase decía «nadie más entra», que se lee como «ella sí, y nadie la acompaña». No es
un matiz de redacción: es exactamente el estado que dejó el alta sin email del 28/09, y el
que hay que poder ver de un vistazo. Con cero usuarios **no puede entrar nadie**, y eso es
lo que ahora dice.

**La regla que queda: «más» y «otro» afirman que ya hay uno.** En un estado vacío hay que
mirar si el cero incluye al sujeto de la frase — si lo incluye, el comparativo miente y se
lee como una falla del producto.

### Mostrar la vista no es dar el permiso, pero una vista sin ninguna acción tampoco sirve

El día anterior se había unificado la vista para que el super admin viera lo mismo que la
agencia. Bien — pero lo que veía era una lista vacía **y nada que hacer**: el único
control de esa tab era «Pedir sumar a alguien», y él no pide altas, las firma.

La salida no es darle el botón de la agencia: es que **cada rol tenga su acción, sobre el
mismo formulario**. Los campos son los mismos tres (email, nombre, rol) y lo que cambia es
a dónde van y qué pasa después:

| | endpoint | qué pasa | botón |
|---|---|---|---|
| agencia | `/api/agencia/altas` | queda pendiente de una firma | «Pedir» |
| super admin | `/api/admin/usuarios` | la persona entra y le llega el acceso | «Sumar y mandarle el acceso» |

⚠️ **El botón dice lo que pasa, y no pasa lo mismo.** «Sumar» en el caso de la agencia
prometería que la persona ya entra; «Pedir» en el del super admin escondería que se le
escribió a alguien. Un solo rótulo para los dos sería mentira en uno de los dos lados.

### Lo que quedó SIN hacer

- **El formulario es uno y los endpoints son dos**, así que el error de cada uno llega con
  su propio texto. No hay un test que compruebe que los dos caminos terminan en una
  persona adentro de la cuenta: eso necesita tocar la base.

---

## El kanban de la ENTREGA de un servicio (05/10/2026) — la capa de datos

Pedido de Martín, textual: «si un CLIENTE actual llega a X etapa de mi SERVICIO
(onboarding, hito 1, hito 2, o lo que sea que el usuario configure en su entrega de
servicio…), que implemente el kanban y copie lo que ya tenemos en el CRM pero para la tab
de Customer Success». Y la aclaración que decidió la forma de todo: **«Todo por producto,
siempre, justamente pueden tener muchos productos»**.

**Vive en:** `lib/servicio-etapas.ts` (puro) · `lib/entrega-servicio.ts` (lecturas) ·
`lib/cs-mover-etapa.ts` (el choke point) · `supabase/migrations/0188_entrega_servicio.sql`

### EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO: la entrega NO es otro embudo del mismo producto

Era la hipótesis razonable y la barata —reusar `funnels`, que ya es por producto, y no
agregar una tabla—. Está **medida como falsa**, y los tres hechos no se pueden tener a la
vez:

- `leads.funnel_id` es **UNA** columna (mig 0181). Un lead vive en un embudo, no en dos.
- Un cliente **ES** un lead ganado: no hay tabla de clientes (`app/customer-success/BarraClientes.tsx`).
- La etapa del lead también es UNA: `pipeline_stage` + la derivada + `etapa_vista`.

Lo que lo cierra es que **las dos etapas son SIMULTÁNEAS, no sucesivas**: el mismo cliente
es `ganado` en ventas y `hito2` en entrega al mismo tiempo. Meterlo en un embudo de entrega
lo **sacaría del tablero del CRM donde está ganado** — o sea que el CRM perdería un cierre
para que Customer Success ganara una columna, y nadie lo reportaría como un bug de Customer
Success. Por eso la asignación vive aparte (`cliente_entrega`) y lo que se reusa del CRM es
la **forma** del catálogo (`data jsonb`, igual que `funnels.data`), no su almacenamiento.

⚠️ **Y `leads.producto_id` (mig 0117) tampoco sirve, que es la confusión fácil**: ese campo
es el producto con el que se **cerró** la venta, y es uno. El pedido dice N.

### El CRM no tiene un choke point para copiar — y por eso Customer Success SÍ puede tener uno

La instrucción era «copiá lo que ya tenemos en el CRM», y acá no se podía: **en el CRM la
etapa se DERIVA de señales** (`pipelineStageOf`), así que no existe el instante en que «se
mueve». Es la razón por la que allá el historial se audita por DIFF (`logLeadChanges`, con
el comentario textual «La ETAPA se calcula, no se diffea») y por la que `app/crm/mover-etapa.ts`
—el archivo que parecía ser el camino de escritura por su nombre— tiene **24 líneas** y una
sola función que decide si abrir un wizard.

En entrega la etapa es un **hecho declarado**: alguien dice «este cliente llegó a hito 2».
Entonces sí hay un instante, y `moverClienteDeEtapa()` es el único camino de escritura —
que es lo que le permite al enrolamiento de secuencias engancharse en UN lugar en vez de en
cada pantalla. **Un nombre de archivo no dice qué hace: dice cómo lo llamaron.**

### Un movimiento idempotente que igual escribe MIENTE sobre el tiempo

Si `moverClienteDeEtapa` pisara la fila cuando el cliente ya está en esa etapa, el upsert
resetearía `etapa_desde` — y `etapa_desde` es el reloj de «hace cuánto que no se mueve».
Un segundo click, un reintento o dos pestañas convertirían **un cliente trabado hace tres
semanas en uno que acaba de llegar**, más una línea de historial de un movimiento que no
ocurrió. No da error, y el número que se arruina es justo el que la tab existe para mirar.

Por eso `etapa_desde` es un campo propio y **no** `updated_at`: cambiar cualquier otra cosa
de la fila no puede resetear el reloj de la columna.

### `lead_audit` tiene dos columnas de valor y el hecho tiene tres datos

Un movimiento de entrega son producto + etapa anterior + etapa nueva, y `lead_audit` sólo
tiene `valor_anterior` y `valor_nuevo`. El tercero no tiene otro lugar donde ir, así que el
nombre del producto viaja en el `campo`: `campoEntrega(nombre)` da `Entrega: Mentoría 90 días`.
Sin eso, dos líneas que dijeran «Onboarding → Hito 1» sobre un cliente con dos servicios son
**indistinguibles**.

Que una línea vieja conserve el nombre que el producto tenía **entonces** es correcto, no un
defecto: un historial dice lo que pasó. Es exactamente por esto que la **clave** de la etapa
es estable y el rótulo es decoración (la lección de ManyChat, que apunta a todo por nombre).

⚠️ **Y la ficha del CRM archiva esa línea en «Información», no en «Status».**
`STATUS_FIELDS` en `app/crm/lead-view/AuditHistory.tsx` es un `Set` con **igualdad exacta**
(`STATUS_FIELDS.has(r.campo)`), así que un campo con el producto adentro no entra. No se
tocó a propósito: ese archivo es de la sesión del CRM. Lo que sí se verificó es que **no
rompe nada**: el «Deshacer» del CRM filtra por `REVERTIBLES.has(r.campo)`, así que ignora
la línea de entrega en vez de intentar revertirla a medias.

### LA TRAMPA QUE VIENE: la clave de una etapa de entrega puede chocar con una de venta

`secuenciasDeEtapa` (`lib/nutricion-etapa.ts`) matchea la etapa por **igualdad de string**
y el ámbito por `funnel_id`. Medido hoy entre los dos defaults:

| | claves |
|---|---|
| venta (`DEFAULT_PIPELINE`) | `lead, agenda, agendaj2, facturando, ganado` |
| entrega (`ETAPAS_ENTREGA_DEFAULT`) | `onboarding, arranque, hito1, hito2, entregado` |
| choque | **0** |

Cero **hoy**, y las dos listas las edita el cliente: el día que alguien llame `facturando`
a una etapa de entrega, mover un cliente en el kanban dispara una secuencia de **venta**.
Lo que lo cierra por construcción es un evento propio (`entrega`), no un string más adentro
del de etapa.

⚠️ **Y el segundo desajuste es un número correcto sobre la pregunta equivocada**: el choke
point tiene un `productoId` y `CtxEvento.funnelId` quiere un **embudo**. Del producto al
embudo hay dos saltos (`producto` → `oferta_productos` → `oferta` → `funnel_ofertas` →
`funnel`), así que pasar el id del producto como si fuera el del embudo hace match con el
embudo que tenga ese id — el de cualquier otra cosa. Los dos avisos están escritos en la
cabecera de `lib/cs-mover-etapa.ts`, que es lo que va a leer quien enganche el enrolamiento.

### El contador del kanban se inicializa con el UNIVERSO

`conteoPorEtapa` arranca poniendo `0` en cada etapa del catálogo antes de contar. Sin eso,
una columna sin clientes no entra al mapa, el lector recibe `undefined`, y un `if (n === 0)`
—la rama que saca la fricción de borrar una columna vacía— **no corre nunca**. Es el mismo
bug que ya se pagó el 29/09 con el conteo de leads por etapa del CRM, escrito antes de
volver a pagarlo.

### Lo que se midió contra la base, y con qué

Aplicada la 0188 y verificada con `information_schema` + `pg_indexes` + un insert de
muestra (script temporal, borrado al terminar):

- las 7 y 9 columnas con sus defaults, `rls = true` en las dos;
- `grants` sólo `postgres` y `service_role` — el `revoke all … from anon, authenticated`
  entró (sin él, el grant depende de QUIÉN aplica el DDL, y eso no se puede dejar al azar);
- el **ON CONFLICT** del choke point: dos inserts sobre el mismo (ws, lead, producto)
  dejaron **1 fila** con la etapa del segundo. Es el candado que impide que dos pestañas
  dejen al mismo cliente en dos columnas del mismo producto, que en un kanban se lee como
  un cliente duplicado;
- limpiado: 0 filas.

### Lo que quedó SIN hacer

- **La pantalla.** No hay kanban todavía: esto es la capa de datos. El toggle de vista y el
  selector de servicio van en `app/customer-success/BarraClientes.tsx`, y el tablero es un
  componente nuevo de `app/customer-success/`.
- **El editor de etapas por producto.** `guardarEtapasEntrega` existe y no la llama nadie,
  así que hoy todo producto muestra `ETAPAS_ENTREGA_DEFAULT` con `origen: default` — que es
  correcto y la pantalla lo tiene que **decir**, o un cliente lee las etapas genéricas como
  si fueran una decisión suya.
- **El enrolamiento de secuencias**, que es de la sesión del Chatbot (ver la trampa de
  arriba).
- **`producto_entrega` y `cliente_entrega` están en `TENANT_TABLES` y en
  `TABLAS_DE_INQUILINO`** (91 tablas). ⚠️ De paso quedó visto que `avisos_programados`
  (0183), `insistencias` (0180) y `flujo_corridas` (0186) están en `TENANT_TABLES` y **NO**
  en `TABLAS_DE_INQUILINO`: vaciar un workspace les deja las filas. No se tocó —es del área
  de infra y de avisos— pero es el mismo modo de falla que esa lista ya documentó.

---

## El kanban de la entrega (05/10/2026) — la pantalla, y lo que sólo se vio arrastrando

La otra mitad de la entrada de arriba. Acá está lo que el navegador encontró y leer el
código no: las dos cosas que se rompían en silencio eran **de timing de React**, y las
dos daban una pantalla que se ve perfecta.

**Vive en:** `app/customer-success/KanbanEntrega.tsx` · `EtapasEntregaModal.tsx` ·
`entrega.ts` · `ClientesApp.tsx` · `BarraClientes.tsx`

### LA DECISIÓN DE UN ARRASTRE NO PUEDE COLGAR DE UN `useState`

Primer intento: `setAgarrado(leadId)` en `dragstart`, y `onDragOver` arrancaba con
`if (agarrado == null) return`. Medido en el navegador: **la tarjeta no se movía a
ninguna parte**, el destino no se marcaba, y no había un solo error.

React vuelca un `setState` un frame después, y los handlers del gesto corren ANTES. Así
que el primer `dragover` leía `null`, se iba por el early-return, **no llamaba a
`preventDefault()`** — y sin eso el navegador no dispara el `drop`. Nunca.

Es la misma familia que «la foto del arrastre sale opaca aunque atenúes la tarjeta en el
mismo handler», que ya estaba escrita en AGENTS.md, aplicada a la LÓGICA en vez de al
estilo. La cura es la que el CRM ya usa para el arrastre de columnas: **un ref para
decidir y un estado para pintar**.

```tsx
const enMano = useRef<number | null>(null);   // decide: lo leen los handlers del gesto
const [agarrado, setAgarrado] = useState<number | null>(null);  // pinta: mueve un borde
```

⚠️ **Y no se nota en una verificación mal escrita.** El primer arnés despachaba
`dragstart` y `dragover` en el MISMO tick y leía la marca del destino enseguida: con el
ref puesto el drop ya funcionaba y la marca seguía dando `false`, porque pintarla es un
re-render. Hacen falta dos `requestAnimationFrame` en el medio. Sin eso, el arreglo
correcto parece a medias.

### UN «DESHACER» DE UN TOAST CORRE CON EL ESTADO DE SU RENDER, NO CON EL DE AHORA

Segundo hallazgo del navegador, y el más caro de ver leyendo: el cartel aparecía con su
«↶ Deshacer», se apretaba, **el cartel se cerraba y la tarjeta no volvía**.

El callback que se le pasa a `show()` se queda con la versión de la función del render
que lo creó, o sea con el `movs` de ANTES del movimiento. Arriba de esa función había
una guarda que parecía gratis:

```ts
const previa = asignacionDe(prodId)[leadId] ?? null;
if (previa?.etapa === etapa) return;   // ⛔ mata el deshacer
```

Desde el closure viejo, «volver a onboarding» se ve como «ya está en onboarding», así que
**la llamada al server nunca sale**. Se lee exactamente como un deshacer roto.

La regla que queda: **una guarda de idempotencia no va en la función que un callback
diferido va a volver a llamar.** El corte del viaje al server lo hace quien mira el
estado del render EN CURSO (acá, el kanban, que tiene la asignación como prop), y la
autoridad es el choke point, que ya es idempotente y está testeado. Un viaje de más es
barato; un deshacer que no deshace, no.

### Las dos trampas del guard de voseo, medidas de los dos lados

Se escribieron dos textos con voseo en la pantalla nueva. El guard del repo
(`tests/puente-panel-copy.test.ts`) **cazó uno y no pudo cazar el otro**, y la diferencia
no es azar:

| texto | ¿lo caza? | por qué |
|---|---|---|
| «Arrastralos a una columna» | **SÍ** — `KanbanEntrega.tsx:329 — «Arrastralos» → «arrástralos»` | `arrastrar` está en la lista de infinitivos y el generador arma también los clíticos |
| «Definí las tuyas» | **NO** | `definir` es `-ir`, y su imperativo voseante es idéntico al pretérito de yo («yo definí»): marcarlo sería un falso positivo en cada «ya lo definí» |

El agujero de los `-ir` ya estaba documentado como permanente. Lo que agrega este caso es
que **se cae solo en copy de interfaz**, porque «Definí», «Elegí», «Escribí» son
justamente los verbos de un CTA. Para esa familia no hay guard: hay que leerla.

⚠️ **Y CUIDADO CON MEDIR EL DETECTOR EQUIVOCADO.** Hay DOS: `marcasDeVoseo`
(`lib/puestas-data.ts`) es una lista a mano de 21 formas y es para los GUIONES DE VIDEO;
el que barre `app/` y `lib/` vive adentro del test y GENERA las formas desde infinitivos.
Probar las ocho frases contra el primero dio **0 de 8** — y de ahí salía el reporte «el
guard del repo está ciego», que es falso y habría mandado a arreglar algo que funciona.
Es «un grep sobre un archivo contesta sobre ESE archivo», aplicado a un detector.

### `npm test` ANTES del `git add` no vio NADA de esta pantalla

La regla ya está en AGENTS.md y se pagó igual, dos veces en la misma tanda:

- El guard de voseo enumera con `git ls-files`, o sea el ÍNDICE. Con los cuatro archivos
  nuevos sin stagear, **3276 tests en verde sobre una pantalla que nadie revisó**.
- Y el gemelo, que es peor porque frena a las otras sesiones: `npm run typecheck` corrió
  ANTES de que existiera `tests/cs-mover-etapa.test.ts`, así que no vio el flag `/s`
  (dotAll) de una regex. **`tsconfig` apunta a ES2017 y ese flag es ES2018**: el typecheck
  del pre-push habría bloqueado el push de las tres sesiones. Lo encontró la sesión del
  Chatbot y lo arregló con `[\s\S]*`.

El orden, entonces, no es «correr los tests»: es **`git add` y recién después `npm test`
y `npm run typecheck`** — los dos miran cosas distintas y los dos se quedan ciegos igual.

### Lo que se verificó arrastrando, y con qué números

Contra `localhost:3000` con el Cliente de Prueba (ws3) sembrado con dos servicios y
cuatro clientes, y limpiado al terminar (ws3 volvió a 0 leads / 0 productos / 0 filas de
entrega / sin la clave de onboarding que hubo que poner para poder entrar):

| qué | resultado |
|---|---|
| columnas del default + «Etapas de ejemplo» | 5, con las 5 diciendo que están vacías |
| sumar los cuatro | `4/0/0/0/0`, y el botón se deshabilita solo |
| arrastre | copia propia creada (1) y limpiada (0) · alto del origen **58 → 58** · destino marcado · `4/0/0/0/0 → 3/0/1/0/0` |
| toast | «En Hito 1 · ↶ Deshacer» |
| deshacer | `3/0/1/0/0 → 4/0/0/0/0`, **y después de un F5 sigue así** (escribió en el server) |
| sacar de la entrega | `4/0/0/0/0 → 3/0/0/0/0`, y su deshacer lo repone **en la misma columna** |
| borrar una columna con gente | «4 en Onboarding: al guardar quedan sin columna…» |
| guardar una etapa nueva | 6 columnas, y el aviso de «etapas de ejemplo» desaparece |
| errores de consola | 0 |

El rastro en `lead_audit` quedó legible de punta a punta sobre el mismo cliente:
`— → Onboarding`, `Onboarding → Hito 1`, `Hito 1 → Onboarding` (el deshacer),
`Onboarding → null` (lo sacaron) y `— → Onboarding` otra vez.

### Sacar a alguien de una entrega también deja rastro

`sacarClienteDeEntrega` borraba la fila y no escribía nada. Eso hace indistinguibles dos
cosas que no se parecen: **«nunca estuvo en esta entrega»** (un hueco por llenar) y
**«lo sacamos»** (una decisión). Ahora escribe su línea con `valor_nuevo: null`, y el
rastro no puede frenar el borrado: las lecturas del nombre y del rótulo van DESPUÉS, y si
fallan la línea sale con la clave.

### Lo que quedó SIN hacer

- **El gesto de arrastre está escrito por TERCERA vez** en este repo: el Kanban del plan,
  el del CRM (`app/crm/CrmBoard.tsx`, para columnas) y ahora éste. Las tres resuelven las
  mismas cuatro trampas. Un `useArrastreKanban` en `app/_components/` las unifica, y no se
  hizo acá porque extraerlo toca `app/crm/CrmBoard.tsx`, que es de otra sesión y estaba
  trabajando en él.
- **El kanban no filtra la grilla ni la tabla.** El selector de servicio aparece sólo en
  la vista de etapas, a propósito: las otras dos contestan «quiénes son mis clientes y qué
  trabajo tienen», que no depende de ningún servicio. Si alguna vez hace falta ver la
  cartera filtrada por servicio, es otra pregunta y otro control.
- **La ficha de un cliente todavía no muestra sus entregas.** Un cliente puede estar en
  varias a la vez y hoy eso sólo se ve tablero por tablero. `entregasDeCliente(leadId)` ya
  existe en `lib/entrega-servicio.ts` y **no la llama nadie**.
- **La línea de entrega cae en «Información» y no en «Status»** en la ficha del CRM
  (`STATUS_FIELDS` es igualdad exacta). Es una línea en un archivo de la sesión del CRM.

### UNA MIGRACIÓN PUEDE VOLVER MÁS DESTRUCTIVA UNA ACCIÓN QUE NO TOCÓ

`cliente_entrega.producto_id` es `on delete cascade` (mig 0188), y eso está bien: si el
producto no existe, su tablero de entrega tampoco. Lo que no estaba bien es lo que ESO
le hizo a una acción que ya existía y que la migración no toca.

`borrar_producto` (`lib/api-mako/areas/negocio.run.ts`) confirma por pantalla, es
`reversible: false` y pide `rolMinimo: 'admin'` — todo correcto. Su `resumen`, que es la
frase que una persona lee antes de apretar, decía:

> Borrar el producto «Mentoría 90 días» (USD 1500). No se puede deshacer.

Verdadera, y desde la 0188 le falta la mitad más cara: se lleva también la etapa de
entrega de **cada** cliente de ese producto. Nadie la escribió mal; **envejeció sola**.

**La regla que queda: al agregar una FK en cascada, grepeá quién borra la fila PADRE y
leé lo que esa pantalla le promete a quien confirma.** Es «sacar algo de un catálogo no
es borrarlo: hay gente apuntándole» con el disparador al revés — acá lo que se borra no
es la cosa a la que se apunta, es su dueño.

Tres detalles del arreglo que no se deducen:

- **`cuantosEnEntrega` devuelve `number | null` y NO reusa `clientesEnEntrega().length`.**
  Esa otra devuelve `[]` ante un error, que es lo correcto para dibujar un tablero y lo
  peor posible para una frase que decide un borrado irreversible: un «0 clientes» sobre
  una consulta caída es exactamente la afirmación que hace que se apriete el botón.
- **La frase vive en un módulo puro** (`fraseEntregaAlBorrar`, `lib/servicio-etapas.ts`),
  no adentro del `preparar()`. Adentro de la acción ningún test la puede importar.
- **Nombra lo que NO se pierde.** El historial de cada movimiento sobrevive (`lead_audit`
  no tiene FK al producto). Sin decirlo, el aviso suena a que se borra todo rastro del
  cliente y frenaría un borrado perfectamente legítimo — un aviso que exagera se ignora
  igual que uno que miente.

⚠️ **Y EL OTRO CAMINO DE BORRADO NO CONFIRMA NADA.** El `×` de
`app/onboarding/ProductosView.tsx` llama a `deleteProducto` de UN click, sin diálogo. Es
anterior a la 0188 y no se tocó: meterle fricción a un wizard de onboarding es
justamente lo que se pidió sacar más de una vez, así que es una decisión de producto.
Queda anotado acá para que el próximo que mire el borrado de un producto sepa que son
DOS puertas y que sólo una avisa.

### El arnés que rompe código restaura en un `finally`, o no restaura

Un script de rotura murió a mitad por un `UnicodeEncodeError` al imprimir una flecha
—la consola de Windows es cp1252— **después** de haber escrito la primera rotura y
**antes** de restaurar. El archivo quedó con el bug puesto, y el arnés siguiente leyó
ESO como su original: su ancla no matcheó, y al «restaurar» dejó el repo con un test en
rojo que parecía un problema del código.

Dos cosas: el restaurado va en un `finally`, y la salida de un arnés se escribe en ASCII
o con `PYTHONIOENCODING=utf-8`. Es la misma familia que «un arnés que no le pasa todas
las entradas al código bajo prueba reporta una regresión que no existe», con el fallo en
la salida en vez de en la entrada.

### Y la OTRA mitad de la gente que apunta a una columna

El aviso de borrar una etapa colgaba sólo del conteo de CLIENTES. Los clientes son la
mitad: la otra son las SECUENCIAS que se disparan al caer en esa etapa
(`nutricion_secuencias`, `trigger_tipo = 'entrega_actual'` + `producto_id`). Y la
diferencia entre las dos mitades es lo que obliga a avisarlas por separado:

| | qué pasa al borrar la columna | se ve |
|---|---|---|
| un cliente | queda sin columna y se puede volver a mover | **sí**, el tablero lo lista aparte |
| una secuencia | deja de dispararse | **no**, en ningún lado |

⚠️ **Y el caso que antes no decía NADA era el más inofensivo de todos:** una columna con
CERO clientes y dos secuencias. Con el aviso colgado del conteo de clientes, borrar una
columna vacía rompía dos automatismos en silencio — y borrar una columna vacía es
justamente lo que alguien hace por prolijidad, sin pensarlo.

Dos decisiones del contrato con la nutrición, que es de otra sesión:

- **Las etapas sin secuencias vienen AUSENTES del mapa, no en cero.** El universo de
  etapas es de Customer Success; la nutrición sólo sabe de las que alguien apuntó.
- **`null` es «no pude leer» y no `{}`.** Con la consulta caída, el editor dice que no
  pudo revisar y deja pasar el borrado. Decir «ninguna secuencia» sobre una lectura que
  falló es exactamente la afirmación que hace apretar el botón.

⚠️ **Y EL PLURAL SALE DEL TOTAL, NO DE CADA ENTRADA.** Con los verbos cableados en
plural, sacar una columna con una secuencia escribía «1 secuencia en Hito 1: al guardar
**DEJAN** de dispararse. Reapúnta**LAS**». Un aviso que no concuerda se lee como un texto
automático, y a un texto automático se le hace menos caso — justo en el único renglón que
tiene que frenar a alguien. Vive en `fraseSecuenciasHuerfanas` (módulo puro, con test y
con su rotura) por la misma razón que `fraseEntregaAlBorrar`: adentro del componente
ningún test la puede ejecutar.

⚠️ **Y LO ENCONTRÓ LEER EL MODAL ENTERO, NO EL LOCATOR.** La primera verificación
buscaba los avisos por `[class*=banner]` y devolvía UNO de los dos: el de tono `warn` no
matcheaba. O sea que el chequeo decía «el aviso de clientes no sale» sobre un aviso
perfectamente dibujado. Para preguntar «¿esta pantalla dice X?», lo que se lee es el
`innerText` del diálogo, no una clase que uno supone.

### La grilla de tarjetas se fue, y la tarjeta se quedó (05/10/2026)

Pedido de Martín, textual: «No quiero que exista la vista de Tarjetas, es la vista de
kanban por default y la otra es la vista de tabla. Solo que dentro del kanban, las
tarjetas no son como las del CRM, son como las nuevas que hicimos, de clientes».

**Vive en:** `app/customer-success/{ClientesApp,BarraClientes,KanbanEntrega,ClienteCard}.tsx`
· `app/_components/TarjetaEntidad.tsx`

Lo que lo vuelve interesante es que **la pieza no se borró: cambió de lugar**. La tarjeta
de cliente es la misma; lo que desapareció es la grilla que la contenía. Y ahí estaba el
problema.

#### ⚠️ LA HOJA DE ESTILOS VIAJABA CON LA GRILLA, NO CON LA TARJETA

`CSS_TARJETA` se montaba **únicamente** adentro de `<GrillaTarjetas>`. Mientras el único
lugar donde había tarjetas era una grilla, las dos cosas eran indistinguibles. Al dibujar
una `TarjetaEntidad` en una columna de kanban sin la grilla, el `<style>` no viaja — y lo
que sale **no es un error ni una pantalla rota**: son los mismos spans sin banda, sin
bordes y sin pie, que se leen como una tarjeta mal hecha.

La regla: **la hoja es de la pieza, no del contenedor de la pieza**. Se extrajo
`<EstilosTarjeta />` y lo monta quien dibuja tarjetas — la grilla de /admin y el kanban.

El olor que lo delata antes de pagarlo: un `grep` del nombre de la constante de estilos
que devuelve **un solo call site**, y ese call site no es la pieza.

#### El arrastre SÍ arranca sobre el botón invisible; el cursor NO viaja

`TarjetaEntidad` cubre su superficie con un `<button className="cl-abrir">` en
`position:absolute; inset:0` y pone **todo el resto del contenido en
`pointer-events:none`**, salvo `.cl-acc`. Antes de escribir nada se midió en el navegador
con un fixture del DOM, porque esto no se contesta leyendo:

| pregunta | medido |
|---|---|
| ¿el `dragstart` burbujea desde el botón absoluto hasta un envoltorio `draggable`? | **sí** (1 disparo, `target: cl-abrir`) |
| ¿quién recibe el puntero en el centro de la tarjeta? | `.cl-abrir` — siempre |
| ¿y sobre la banda, que tiene `pointer-events:none`? | `.cl-abrir` también |
| ¿y sobre un botón dentro de `.cl-acc`? | **ese botón** |
| ¿qué cursor se ve? | **`pointer`**, no `grab` |
| ¿el clon conserva el `style` de la banda? | sí |

De ahí salen tres decisiones que no son de gusto: el `draggable` va en un **envoltorio**
(no en la tarjeta), el cursor se pone **a mano** (`.ke-card .cl-abrir { cursor: grab }`,
porque el del botón gana sobre el del envoltorio), y **un control extra sólo puede vivir
en `.cl-acc`** — dibujado en cualquier otro lado se ve y no se puede apretar.

#### ⚠️ `.cl-acc` ES `nowrap`, Y LA COLUMNA ES 44 px MÁS ANGOSTA QUE LA GRILLA

En la grilla la tarjeta medía 320 px y la fila de acciones llevaba dos controles. En una
columna mide 276 y, **para una AGENCIA**, lleva cuatro: «Entrar como», el menú de
Acciones y el «Sacar» de esta pantalla. Un flex sin `wrap` no los apila: los desborda — y
`.cl-card` tiene `overflow: hidden`, así que **el último control desaparece sin dejar
rastro**. El propio comentario de `ClienteCard` ya avisaba del `nowrap`; lo que cambió es
que ahora hay un cuarto hijo y 44 px menos.

Se arregla con un `flex-wrap: wrap` **scopeado al kanban**, no en la pieza compartida:
en /admin la fila sigue entrando y envolver ahí sería cambiarle el remate a una pantalla
que no lo pidió.

#### Una columna vacía es un DESTINO, y medía menos que lo que se le suelta adentro

`min-height: 140px` contra una tarjeta de cliente de **311 px**. Soltar en la columna de
al lado exigía apuntar a un recuadro más chico que la tarjeta en la mano. Subió a 248.

#### La vista por default se CALCULA, no se dispara

El kanban es el default **y no siempre se puede dibujar**: hace falta que la lectura de la
entrega haya salido bien y que el negocio tenga al menos un servicio activo. Un
`useEffect` que «corrigiera» la vista al montar dejaría medio segundo de pantalla que no
es, y pisaría la elección de la persona en cuanto `entrega` cambie.

```ts
const hayKanban = Boolean(entrega?.ok && servicios.length);
const vistasDisponibles = hayKanban ? ['kanban', 'tabla'] : ['tabla'];
const vista = vistaElegida && vistasDisponibles.includes(vistaElegida)
  ? vistaElegida : (vistasDisponibles[0] ?? 'tabla');
```

El estado guarda **lo que la persona eligió**, no lo que se dibuja; lo que se dibuja sale
de cruzarlo con lo que hay. Así, el caso que todavía no existe lo hereda gratis — y
`vistaElegida === 'kanban'` sobre un workspace que todavía no cargó productos no deja a
nadie mirando una pantalla vacía.

⚠️ **Y el toggle lo dirige una LISTA, no un flag por vista.** `BarraClientes` la montan
dos pantallas que NO ofrecen lo mismo (Customer Success: kanban + tabla · /admin:
tarjetas + tabla, porque un workspace no tiene etapas de entrega). Con `conKanban` el día
que aparezca una cuarta vista hay un segundo flag; con `vistas` en positivo, cada pantalla
declara lo suyo. **Y con una sola vista el toggle entero no se dibuja**: un botón que no se
puede apagar es un control trabado.

#### Lo que se enumeró antes de sacar la grilla, porque se iba con ella

- **El alta de un cliente.** Era la primera tarjeta punteada (`TarjetaNueva`). La tabla
  tiene su propio botón; el kanban no tenía ninguno, así que crear un cliente habría
  quedado escondido detrás de cambiar de vista. Ahora vive en la cabecera del tablero, y
  **no se confunde con «Sumar un cliente»** de la primera columna: aquél mete a un cliente
  QUE YA EXISTE en esta entrega.
- **«Para ver la entrega en etapas, carga tus servicios»** era el cuerpo de la vista de
  kanban. Ahora el kanban ni se ofrece en ese caso, así que el renglón se mudó ARRIBA de
  la tabla: sin él, alguien sin productos ve una tabla y no se entera de que la vista de
  etapas existe ni de qué le falta para tenerla.
- **«Ningún cliente coincide»** se dibuja sólo fuera del kanban, y cuelga de `enKanban`
  —lo que de verdad se está dibujando— y no de `vista === 'kanban'` escrito dos veces. En
  el tablero lo dice cada columna; un renglón más abajo de cinco «Sin clientes» es repetir
  lo mismo seis veces.

#### Lo que volvió a morder, con la regla ya escrita

- **Backticks adentro del template literal del CSS.** Tres comentarios nuevos citaban
  nombres entre backticks —la convención del repo— y **cerraron la cadena a la mitad**: el
  typecheck escupió «Module declaration names may only use quoted strings» en líneas que
  no tenían nada que ver. Está en AGENTS.md y se pagó igual. Lo que lo cierra en segundos
  es contar los backticks del bloque: tienen que ser **exactamente dos**.
- **`ClientesApp.tsx` estaba MEZCLADO** (558 CRLF + 7 LF) por un parche mío anterior, y el
  síntoma fue una aserción que fallaba con `count == 0` sobre un texto copiado del propio
  archivo. Misma familia que los 38 CR sueltos del documento de hallazgos.

### El tablero que se ve como el del CRM y se arrastra como el del Plan (05/10/2026)

Diez puntos de Martín sobre el kanban de la entrega, en una tanda. Cuatro eran sacar
texto; los otros seis son los que dejaron algo escrito.

**Vive en:** `app/customer-success/{KanbanEntrega,BarraClientes,ClientesApp,SelectorServicio}.tsx`
· `app/plan/board/arrastre-copia.ts` · `lib/servicio-etapas.ts`

#### ⚠️ «NO SE VEN TRANSPARENTES»: NO ERA TRANSPARENCIA, ERA CONTRASTE CERO

«Copia el estilo de las columnas... Que no sean transparentes». Las columnas **tenían**
fondo: estaban en `--surface-2`. Medido en los tokens del tema claro por defecto
(`app/globals.css`):

| token | valor |
|---|---|
| `--bg` (la página) | `#F4F6F9` |
| `--surface-2` (la columna) | `#F5F7FA` |

**Una unidad por canal.** Tenían fondo, y era el mismo fondo de la página. Y sólo pasa en
el claro por defecto: en oscuro (`#22262E` vs `#333944`) y en true-north (`#E5E9F0` vs
`#D8DEE9`) los dos tokens sí se distinguen, así que nadie que probara en otro tema lo
habría visto.

El CRM lo hace al revés y por eso se ve: **columna `--surface` (blanco) y tarjeta
`--surface-2`**. Dar vuelta el par es lo que lo arregla en los tres temas a la vez. Pero
no alcanza con cambiar la columna: `TarjetaEntidad` pinta su tarjeta en `--surface`, así
que con la columna en blanco las tarjetas desaparecerían contra ella. Hace falta además
`.ke-card .cl-card { background: var(--surface-2) }` — **y acá, no en `TarjetaEntidad`**,
que la usan /admin y la ficha de un workspace, donde la columna no existe.

⚠️ **Y la línea de color de arriba NO se copia del CRM.** Allá sale de la BANDA
(`CATEGORY[bandToCategory(c.band)]`), que son **tres** colores —avanza / nutre / sale—; una
etapa de entrega no tiene banda, a propósito, así que copiada tal cual pintaría las cinco
columnas del mismo verde. Sale de `e.dot`, que ya es un color por etapa y es el mismo que
el punto de la cabecera: así la línea y el punto no se pueden desincronizar.

#### LA VISTA DE TABLA MOSTRABA CATORCE CLIENTES Y EL KANBAN NINGUNO

«No puede ser que yo vea muchos leads en la vista de tabla y luego no vea nada en la vista
de kanban... Jamás puede ser eso.» Tenía razón y era un bug de modelo, no de pantalla: el
tablero sólo dibujaba a quien tuviera fila en `cliente_entrega`, y nadie la tenía.

**Un cliente sin fila está en la PRIMERA etapa.** Y es DERIVADO, no sembrado: no se le
escribe una fila a nadie. Un backfill habría arreglado a los catorce de hoy y dejado al
decimoquinto afuera; derivándolo, el cliente que se gane mañana aparece solo.

⚠️ **Y la regla vive en UNA función** (`repartirEnEtapas`, `lib/servicio-etapas.ts`) que
usan el tablero **y** el contador del editor de etapas. Con dos implementaciones, el editor
diría «0 en Onboarding» sobre una columna con catorce tarjetas a la vista — porque una de
las dos sabría la regla y la otra no.

⚠️ **Y eso le dio un sentido exacto a algo que había quedado sin ninguno.** Con todos en
el tablero, «sacar de la entrega» dejó de existir como acción y el botón se fue. Pero
`sacarEntrega` NO quedó muerto: es lo que hace el **deshacer del primer movimiento**. Si
alguien mueve a un cliente que nunca se había movido, lo contrario de eso no es moverlo a
la primera —sería escribirle una fila que antes no tenía, con un reloj de etapa que
arranca hoy— sino **borrar la que acaba de nacer**. Verificado: mover, deshacer, y después
de un F5 sigue en la primera.

#### El arrastre no se replica: se importa

«Replicalo tal cual de como lo hacemos en PLAN.» El núcleo ya estaba extraído adentro de
`BoardShell.tsx` —`fotoVaciaDeArrastre`, `scrollerDe`, `useArrastreCopia`, los tres
genéricos— y **ninguno estaba exportado**. Salieron a `app/plan/board/arrastre-copia.ts` y
ahora las dos pantallas usan la misma pieza: todo lo que ahí está medido (la foto que
pinta el sistema operativo, el `transform` sobre un ref, el listener en captura, el
auto-scroll adentro del `dragover`) viajó con el código en vez de volver a escribirse.

Tres cosas en las que el kanban **contradecía** al Plan sin saberlo, y que la lectura del
molde corrigió:

| | el kanban hacía | el Plan hace, y por qué |
|---|---|---|
| nodo origen | le pintaba un anillo | **nada** — se probaron `opacity:.5`, borde y `scale`, y los tres se reportaron como ruido: con la copia siguiendo al cursor Y el hueco marcando el destino, atenuar el original hace aparecer la misma tarjeta tres veces |
| fondo de la copia | forzado a `--surface` | el **computado** del origen, con fallback a `--surface-2` |
| la copia | sin inclinación | `rotate(1.5deg)` |

⚠️ **Y lo que faltaba de verdad era EL HUECO.** Un recuadro punteado del alto de una
tarjeta, en el índice exacto y sólo en la columna bajo el cursor. Es lo que convierte «la
estoy soltando en esta columna» en «la estoy soltando ACÁ» — y era la mitad del gesto que
el tablero no tenía.

Dos detalles del hueco que no se deducen: los puntos medios se miden **una sola vez** al
agarrar y **en coordenadas de página** (`+ window.scrollY`), porque el auto-scroll invalida
cualquier rectángulo medido contra la ventana; y el `+ '1f'` del fondo es un sufijo de
**alfa hex** que sólo funciona con hex de 6 dígitos — `dot` lo es, pero con un `rgb()` o un
`var()` el color sale inválido y el navegador lo descarta en silencio.

⚠️ **Y `scrollerDe` sólo mira `overflowY`**: un riel `overflow-x: auto` no es un scroller
para él y devuelve la ventana. El empuje horizontal se queda de este lado.

#### «Igual que el desplegable del CRM» era el primitive, no el componente

El de la captura **no es un componente de productos**: es el `Dropdown` del repo, que ya
trae las tres cosas que Martín señaló — el lápiz por renglón (`acciones`), el «＋ Nuevo
producto» (`crear`) y el renglón gris con filete (`sutil`). Se ve igual porque es la misma
pieza.

Lo que **no** se pudo importar es el `SelectorFunnel` del CRM, y la razón importa:
**elige un EMBUDO, no un producto.** Su `value` es `funnels.id` y del producto sólo viaja
el nombre; acá el tablero es por producto (mig 0188). Dos preguntas distintas que se ven
igual — copiar el componente habría traído el id equivocado. (Y el otro además navega:
cambiar de producto allá es `router.push('/crm?funnel=N')`.)

⚠️ **«Y si creo un producto acá, debe aparecer en el CRM» NO SALE CON `upsertProducto`.**
El desplegable del CRM lista EMBUDOS: un producto suelto no aparece ahí por más que esté
en la tabla. Hace falta la cadena entera —`producto → oferta_productos → oferta →
funnel_ofertas → funnel`, con el funnel naciendo CON sus etapas— y eso ya estaba escrito
en `crearProductoConFunnel`. **El sentido inverso no necesitaba nada**: el alta del CRM
escribe en `productos` con `activo: true`, que es justo lo que lee esta pantalla.

Verificado creando uno desde Customer Success y mirando la BASE: producto, funnel y los
dos enlaces, los cuatro creados. En la pantalla del CRM no se pudo ver porque el Cliente
de Prueba tiene el CRM sin activar y `/crm` le muestra su pantalla de arranque.

#### Lo que se movió de lugar, y por qué

- **El alta de un cliente ahora es un botón por COLUMNA**, como «＋ Nuevo lead» en el CRM,
  y nace en esa etapa. El de arriba se fue: desde una columna el botón dice ADEMÁS dónde
  nace, que el de arriba no podía decir. ⚠️ Y el modal **no recarga** cuando quien lo abrió
  le pasa un `onCreado`: recargar mataría la llamada que mueve al cliente a su etapa antes
  de que salga, y el cliente aparecería en la primera columna sin que nada lo diga.
- **«Editar etapas» se mudó al lápiz del desplegable**, donde edita las de CUALQUIER
  servicio y no sólo las del que estás mirando. Con eso la cabecera del tablero quedó sin
  nada adentro y desapareció entera — era, además, lo único que separaba la barra del
  tablero.
- **El orden de la barra es pedido, no estético:** primero CÓMO se mira (el toggle),
  después QUÉ se busca, y recién ahí con qué se recorta (el filtro).
- **El ancho:** el tope de 1180 lo declara `CSS_TARJETA` en `:root` y lo miran la barra, la
  tabla y la grilla. Redefinir `--cartera-max: none` en esta pantalla lo mueve en las TRES
  a la vez, que es lo que hay que cuidar: si una queda en 1180 y las otras no, la pantalla
  se ve torcida y eso no se nota en el diff. /admin sigue con su 1180.

---

### Las FASES, el scroll de la tab y el editor del CRM (05/10/2026)

Segunda tanda del mismo día: seis puntos de Martín. Cuatro eran de pantalla y dos dejaron
reglas que valen fuera de esta tab.

#### El pedido que lo gobierna

> «En todo programa existen "fases", por ejemplo, Fase 1: "Cimientos" y dentro están las
> etapas… que al crear columnas también se puedan crear FASES, y que se le ponga el color a
> esa fase y que sus columnas adopten eso. Eso te permite traer los botones similares del
> CRM para solo ver las columnas de esa fase.»

Es el mismo modelo que el CRM ya tiene con Activo / Nutrición / Descartado, y por eso los
chips se copian de `BandasToggle` (`app/crm/CrmToolbar.tsx`) y no se inventan.

**Vive en:** `lib/servicio-etapas.ts` · `app/customer-success/KanbanEntrega.tsx` ·
`app/customer-success/EtapasEntregaModal.tsx` · `lib/entrega-servicio.ts`

#### Quién gana el color se decide UNA vez, al pintar

`colorDeEtapa(e, fases)` devuelve el `dot` de la fase si la etapa tiene una, y el propio si
no. Tres cosas que esa firma decide:

- **El color propio NO se pisa al asignar la fase.** Sacar una etapa de su fase le devuelve
  el suyo; si se hubiera pisado habría que inventarle uno.
- **Una etapa que apunta a una fase BORRADA no queda sin color**: cae a su propio, por la
  misma línea. No hace falta limpiar nada al sacar una fase.
- **Y se decide en UNA función, no en la pantalla.** El punto de la cabecera y la línea de
  arriba de la columna son el mismo color por construcción. Leyendo `e.dot` en la pantalla
  —que es lo que había— las cinco columnas de una fase salen de cinco colores distintos:
  **agrupar no se ve, que es lo único que las fases vienen a mostrar.** Hay guard
  (`tests/cs-kanban-fases.test.ts`), y la rotura da 9/1.

⚠️ **La clave de una fase lleva prefijo `f_`, y no es cosmético.** Una fase y una etapa
pueden llamarse igual —«Cimientos» las dos— y sin prefijo compartirían clave: una etapa
apuntaría a una fase por accidente. Es la misma familia que «no reusar una clave borrada»,
un nivel más arriba.

⚠️ **Y `normalizarFases` falla distinto que `normalizarEtapas`, a propósito.** Vacío es
LEGÍTIMO (no tener fases es el estado normal de un servicio, así que devuelve `[]` y no
`null`); lo que se descarta ENTERO es una lista rota, porque media lista de fases deja
etapas apuntando a una fase que no se dibuja, o sea columnas con el color equivocado.

#### El filtro por fase es del RENDER, nunca del reparto

Es el error que parece obvio y produce una afirmación falsa: pasarle a `repartirEnEtapas`
las columnas ya filtradas por el chip hace que **todos los clientes de las columnas
escondidas salgan como HUÉRFANOS**, y el pie del tablero anuncia «12 clientes están en una
etapa que ya no existe». No da error, el número es plausible, y lo produce mirar una fase.

El reparto recibe `etapas` enteras y lo que se dibuja es `visibles`. Guard + rotura: 9/1.

⚠️ **Y los chips son UNA fase a la vez, con un «Todas» de verdad**, al revés de los
interruptores independientes del CRM. Allá hacen falta tres guardas para que nadie apague
la última —con cero bandas el tablero queda vacío y no hay nada en pantalla que lo
explique— y con «Todas» ese estado no se puede producir. El pedido además es ése: «solo ver
las columnas de esa fase».

⚠️ **Y el chip elegido es un valor, NO una copia de las fases.** `KanbanEntrega` no se
desmonta al cambiar de servicio, así que un `useState(props.fases)` seguiría mostrando los
tramos del anterior — la trampa que ya se pagó en el editor de mensajes. Lo único que hay
que cubrir es que una fase borrada no vacíe el tablero, y eso se DERIVA: si la clave elegida
no está en `fases`, vale «todas».

#### Las fases viajan en el MISMO upsert que las etapas

`producto_entrega.data` se reemplaza entero, así que guardar `{ etapas }` sin `fases` las
**borra** — y lo que se borraría es el color de cada columna, en el próximo guardado de
cualquier otra cosa, sin un error y sin un log. Es el modo de falla de los mappers de
lectura, del lado de la escritura.

⚠️ **Por eso `fases` NO lleva default en la firma.** Un `= []` deja que un llamador se las
olvide y olvidarlas es borrarlas; exigirlo hace que el compilador enumere los call sites el
día que aparezca el segundo. Es la misma regla que «borralo: no lo cambies de tipo».

#### «La tab NO tiene que tener scroll»

> «La tab NO tiene que tener scroll, las columnas tienen su scroll propio. La tab si debe
> tener scroll de izquierda a derecha.»

El recorte vive en la COLUMNA (`max-height: 68vh`, el mismo número que el tablero del CRM)
y no en la página: un alto en `vh` es un número cerrado, mientras que `height: 100%` contra
un padre de alto indefinido resuelve **cero en Safari** — y con un `overflow: hidden`
encima, cero es una pantalla en blanco. La cabecera y el botón de alta quedan fijos; lo que
corre son las tarjetas.

⚠️ **`min-height: 0` en el cuerpo no es decorativo:** sin él un hijo flex no baja de su alto
de contenido, el `overflow` no recorta NADA, la columna crece y vuelve el scroll de la tab.
Medido en el navegador: documento 950 px contra una ventana de 950.

⚠️ **Y DESDE QUE LA COLUMNA SCROLLEA, EL ARRASTRE NECESITA SU PROPIO EMPUJE VERTICAL.** Dos
cosas que el molde del Plan no podía dar:

- `empujarScroll` del hook resuelve el scroller **una vez, en el `dragstart`, con la tarjeta
  de ORIGEN** (`scrollerDe`). En el Plan eso es la página o el cuerpo del modal y da igual;
  acá cada columna tiene su propio scroll, así que empujaría la columna de la que salió la
  tarjeta en vez de la que está bajo el cursor. Por eso el empuje vertical se escribe acá,
  adentro del `dragover` de cada columna. **Y estaba destructurado sin llamarse**: la
  capacidad escrita y el gesto muerto, con el typecheck en verde.
- **La medida del hueco pasa a coordenadas de CONTENIDO de la columna** (`+ scrollTop`). Es
  la misma trampa que `+ window.scrollY` un nivel más abajo: correr el cuerpo mueve las
  tarjetas sin mover la ventana, así que los puntos medios medidos al agarrar apuntan al
  lugar equivocado y el hueco aparece en otro índice. Sumarlo en los DOS lados lo hace
  invariante: si el cuerpo baja N, el `top` del rectángulo baja N y el `scrollTop` sube N.

#### El editor, con el diseño del CRM y sin botón de guardar

> «Dentro del editable del producto, no pongas el texto "Son las columnas del tablero de
> este servicio…" y tampoco pongas divisores. Copia el diseño del CRM que te adjunto, para
> agregar una etapa hay un botón como el que se ve… Y no existe el botón de "No cambiar
> nada" o el de guardar… Se guarda automáticamente.»

Es el molde de `app/crm/EtapasModal.tsx`: la `caja` por etapa, la `fila` transparente
encima, el nombre como un `<button>` que **no estira** —«solo si clickeo en el texto del
título de esa etapa debería abrirme el input, no en toda la fila»— y el renglón punteado de
`+ Agregar etapa` que pide el nombre ahí mismo.

⚠️ **SIN BOTÓN DE GUARDAR, EL AVISO SE MUEVE AL CLICK.** Mientras había un pie, sacar una
columna con gente adentro se avisaba en un banner arriba y la decisión la tomaba el botón
de guardar. Guardando solo **no hay dónde frenar después**, así que la consecuencia va
pegada a la ✕ y ANTES: un `Confirm` que dice cuántos clientes y cuántas secuencias se lleva
puestos, con las dos consecuencias SEPARADAS (un cliente sin columna se puede volver a
mover y el tablero lo lista aparte; una secuencia sin etapa deja de dispararse y no se ve
en ningún lado). Verificado en el navegador: la ✕ de una columna con 5 clientes abre
«5 clientes quedan sin columna» y cancelar la deja en su lugar; la de una columna vacía se
va sin fricción.

⚠️ **Y NO SE GUARDA AL MONTAR.** El efecto sale temprano en el primer render
(`primera.current`), porque ese upsert marca el servicio como **DECLARADO**: sin la guarda,
abrir el editor y cerrarlo convierte el default en una configuración que nadie escribió — y
con eso se pierde la única forma que tiene la pantalla de decir «todavía no configuraste la
entrega de este producto». El respiro de 600 ms existe porque renombrar es una tecla por
letra.

#### ⚠️ El conteo del editor contaba FILAS, no CLIENTES

Es el hallazgo más caro de la tanda y **lo encontró el navegador, no el código**. El editor
mostraba **0 en la primera columna mientras el tablero dibujaba 5 tarjetas ahí** — las dos
pantallas leyendo el mismo overlay, con la misma función (`conteoDeEtapas`, que delega en
`repartirEnEtapas` justamente para que no puedan contar distinto).

La función estaba bien. Lo que se le pasaba, no: `Object.values(asignacionDe(prod))` son las
FILAS de `cliente_entrega`, y **«un cliente sin fila está en la primera etapa» es una regla
DERIVADA** — a quien no aparece en la lista no hay de dónde derivársela. El tablero pasa un
cliente por tarjeta y resuelve `asignacion[c.leadId]?.etapa`; el editor pasaba tres filas
para ocho clientes.

**No es cosmético:** ese número es lo único que hace que sacar una columna sea una decisión,
así que con el 0 puesto el `Confirm` **no se dispara** y la columna se va con cinco clientes
adentro, en silencio. El comentario que había al lado decía la verdad sobre el overlay y
escondía el bug: «sale del MISMO overlay» es cierto, y la pregunta era otra.

La regla que queda: **una función que aplica una regla derivada necesita el UNIVERSO, no las
filas.** Si el conteo lo alimenta una tabla y el dibujo lo alimenta una lista de entidades,
los dos van a contestar distinto el día que la regla derive algo — y el que cuenta filas
siempre cuenta de menos. Hay test funcional con los números del caso (8 clientes / 3 filas)
y guard del call site; las roturas dan 10/1 y 32/1.

⚠️ **Y se cuenta sobre `clientes` (la cartera entera), nunca sobre `visibles`:** con un
filtro o una búsqueda puesta, el aviso al sacar una columna dejaría de contar a los que el
buscador escondió.

#### Lo chico, que igual deja regla

- **«Sin clientes.» se fue.** El contador de la cabecera ya dice 0 en el mismo renglón que
  el nombre, así que el renglón repetía el único dato que había y le robaba el lugar al
  único que importa en una columna vacía: que ahí se puede soltar una tarjeta.
- **El botón de filtrar DICE «Filtrar».** Un embudo de 15 px al lado de dos íconos de vista
  no se lee como un filtro hasta que alguien lo aprieta, y el `title` aparece recién al
  pasar el mouse — o sea nunca en un celular. Toca también `/admin`, que monta la misma
  barra; ahí la palabra es igual de correcta.
- ⚠️ **Y la primera corrida del guard nuevo falló TRES VECES por la trampa de siempre:** los
  asserts de «esto NO está» encontraban lo que el archivo dice DE SÍ — el ⛔ que explica que
  «Sin clientes.» se fue, el ⚠️ que dice que no se lee `e.dot`, y el encabezado del editor
  que CITA el pedido («no existe el botón de "No cambiar nada"»). Los tres son prosa
  correcta y los tres hacían fallar un guard sano. La cura es `sinComentarios()` antes de
  buscar, **con las líneas de comentario primero y los bloques después**: al revés, un `/*`
  dentro de un comentario de línea abre un bloque que se cierra páginas abajo.

#### Y el mismo archivo pagó DOS VECES el backtick adentro del template

La convención de la casa es nombrar una clase o una propiedad entre backticks, y adentro de
la hoja de estilos eso **cierra la cadena a la mitad**. Pasó escribiendo los comentarios de
`max-height` y de `min-height: 0`: cinco backticks en cuatro renglones de prosa, y el
typecheck señalando líneas que no tenían nada que ver («Module declaration names may only
use quoted strings»). El chequeo es una línea y conviene correrlo antes del typecheck:

```bash
node -e "const s=require('fs').readFileSync(RUTA,'utf8'); const i=s.indexOf('const CSS = '); console.log((s.slice(i).match(/\`/g)||[]).length)"
```

Dos es lo correcto. Cualquier otro número es esto.

## Lote, tabla del Plan, el producto que el CRM borró y el editor del CRM (05/10/2026, tarde)

El pedido fueron ocho puntos sobre `/customer-success` (texto literal en
`app/admin/dev/customer-success/bitacora.ts`). Lo que se hizo está en el commit; acá va lo que
costó entender.

### «Activo» no alcanza: eliminar un producto en el CRM no lo desactiva

«Haz puesto otros que no existen… En el CRM de Mauricio, solo hay esos 2». El selector leía
`productos` con `activo = true` y ofrecía cuatro. Y no estaba mal leído: **eliminar un
producto en el CRM ARCHIVA SU EMBUDO** (`archivarFunnel`, `funnels.activo = false`) y deja el
producto con `activo = true`. «Sistema DOS» vive en «Productos eliminados» del CRM y seguía
vivo para cualquier pantalla que leyera la tabla de productos.

- **La regla, en positivo:** se ofrece todo producto activo que NO esté atado ÚNICAMENTE a
  embudos archivados. Restaurar el embudo en el CRM lo devuelve acá sin hacer nada.
- ⚠️ **La regla obvia («sólo productos con embudo») era la equivocada, y se midió antes de
  escribirla.** El ws13 tiene tres productos sin embudo —nacieron en el catálogo antes de la
  cadena producto → oferta → embudo— y una entrega REAL sobre uno. Exigir el embudo le
  borraba el tablero a un cliente.
- El cuarto («Prueba 3», producto 15 del ws1) no tenía embudo ni nada: era un huérfano de una
  prueba y se desactivó a mano. Respaldo del antes en
  `backups/entrega-nqe-ws1-antes-2026-10-05.json`.
- Si la lectura del cruce falla, se ofrecen todos los activos: mostrar de más es recuperable;
  un selector vacío sobre una lectura caída afirma que no hay servicios.

**Vive en:** `app/customer-success/entrega.ts` (`productosOfrecibles`).

### Renombrar «en los dos lados» no necesitaba sincronizar nada

Las dos pantallas leen `productos.nombre`, así que renombrar en una se ve en la otra si la
escritura llega ahí. `renombrarFunnel` (CRM) ya escribe `productos.nombre` cuando el embudo
tiene producto principal; Customer Success pasa por esa misma función cuando el producto
tiene embudo, y escribe `productos.nombre` directo cuando no. El otro sentido funcionaba solo.
Eliminar es `archivarFunnel` sobre cada embudo vivo (o `activo = false` sin embudo), y el
producto del embudo PRINCIPAL no se puede eliminar: el botón no se dibuja, porque su única
respuesta sería «no».

**Vive en:** `app/customer-success/actions.ts` (`renombrarServicioAction`, `eliminarServicioAction`).

### El editor «igual al del CRM» tenía cuatro bugs que el del CRM probablemente también tiene

Los cuatro están explicados en el encabezado de `EtapasEntregaModal.tsx`. Los que valen fuera
de esta pantalla:

- **Una guarda `if (primera.current)` no impide guardar al abrir.** Next 16 corre el App
  Router en Strict Mode: en desarrollo cada efecto corre DOS veces al montar, la segunda con
  la bandera ya en false. O sea que abrir el editor en local programaba un upsert que marca el
  servicio como DECLARADO — y bootear local escribe en producción. Se compara la FIRMA de lo
  que se mandaría contra la de lo último mandado, que no depende de cuántas veces corra el
  efecto.
- **El Escape de un campo nunca le llega al campo.** `Modal` escucha en `document` y en
  CAPTURA, así que cancelar un nombre cerraba el editor entero, y el `stopPropagation` del
  input no servía porque la tecla nunca bajaba hasta él. Lo único que llega antes es `window`
  en captura.
- **Un nombre escrito y cerrado en el mismo medio segundo se perdía**: el desmonte limpiaba
  el timer del respiro. El desmonte manda lo pendiente, y los guardados van en fila.
- **La primera etapa es la entrada y no se mueve ni se quita**, porque «sin fila = primera
  etapa» es una regla derivada: mover otra columna arriba pasaba en silencio a todos los
  clientes sin fila a esa columna.

⚠️ **SIN MEDIR:** el `EtapasModal` del CRM tiene la misma estructura (Modal + input del
título + `stopPropagation`), así que lo esperable es que tenga el bug del Escape. No se tocó
porque es otra pantalla y otro archivo; se mide abriéndolo y apretando Escape adentro del
título.

### `.ke-card > * { width: 100% }` captura a todo hijo directo, incluido el que llega después

La casilla de selección del kanban salió como una franja blanca del ancho de la tarjeta.
`getComputedStyle` dio `right: -10px` y `width: 274px` sobre un elemento `absolute` con
`left: 10px`: el ancho venía de una regla escrita para que la tarjeta llenara su envoltorio,
y la casilla, que se agregó después como hija directa del mismo envoltorio, la heredó.

**Un selector `> *` es una regla sobre los hijos que todavía no existen.** Al agregar un hijo
directo (una casilla, un badge, un overlay), grepeá las reglas `> *` del padre. La cura fue
`.ke-card > .ke-sel { width: auto }`, que necesita el padre adelante para ganar en
especificidad.

**Vive en:** `app/customer-success/KanbanEntrega.tsx` (CSS de `.ke-sel`).

### Una acción del desplegable que abre un modal deja el menú flotando ENCIMA del modal

El lápiz del selector abría el editor y el menú quedaba arriba, tapándole el título: vive en
un portal sobre el `body` con su propio z-index, y las acciones de un renglón NO cierran el
menú a propósito (para quitar un renglón y seguir mirando la lista). Va un flag por acción,
`cierra: true`, en el primitive. El default sigue siendo no cerrar.

⚠️ **SIN MEDIR:** el lápiz del CRM (`CrmToolbar.tsx`) abre su editor por el mismo camino y
no lleva el flag. Si el menú queda encima allá también, es una línea.

Y el «＋＋ Nuevo producto»: `crear: true` ya dibuja su ＋, y el rótulo traía otro. El del CRM
dice «Nuevo producto» a secas.

**Vive en:** `app/components/Dropdown.tsx` (`DropdownAccion.cierra`), `app/customer-success/SelectorServicio.tsx`.

### El lote: una llamada, un deshacer, y el deshacer de «nunca se movió» es BORRAR la fila

Mover N clientes es UNA server action (`moverEntregaLoteAction`) que valida la propiedad de
todos en una consulta y devuelve el resultado por cliente. El deshacer es uno por lote y
vuelve a llamar a la misma acción con la etapa anterior de cada uno — y para el que no tenía
fila la etapa anterior es `null`, que significa **sacar la fila**, no escribirle la primera
etapa con el reloj arrancando hoy (eso le mentiría a «en la etapa hace…»).

El hueco del arrastre en lote sale de los DATOS y no del cursor: acá no hay orden dentro de
una etapa, así que un hueco que siguiera al cursor prometería un lugar que el tablero no
honra. La copia de la FILA que sigue al cursor no se pudo importar del Plan (vive adentro de
`useArrastreFilas`, sin exportar) y es una copia declarada: unificarla es sacarla a
`arrastre-copia.ts`, y quedó anotado en `TablaClientes.tsx`.

### Verificar esta pantalla sin escribir: el POST del montaje no se puede abortar

El arnés aborta todo POST para no mover clientes reales del ws1, y con eso la pantalla se
rompía: al montar corre `autoasignarAction` (body `[]`), y abortarlo deja el árbol de React
en un estado que el resto del recorrido no puede usar. Se deja pasar SÓLO ese, que es lo que
ya corre cada vez que alguien abre la tab en producción, y se recarga la página antes de cada
arrastre (un POST abortado a mitad de un gesto rompe la siguiente interacción). Los
arrastres se verifican por el CUERPO del POST bloqueado: `[21,1,"contexto"]` en el kanban y
`[491,1,"palancas"]` en la tabla.

Y «Another next dev server running» con un PID que ya no existe es un lock viejo: se borra y
se arranca en otro puerto.

### Lo que quedó SIN hacer

- **Los 14 clientes de Mauricio están todos en «Bienvenida».** Las etapas del programa
  (Bienvenida → Contexto → Propósito (PAS) → Visión y Norte → Criterio → Palancas y umbrales →
  Tablero → Ritmo → Sistema instalado, en cinco fases) se escribieron en producción; la etapa
  REAL de cada cliente no se adivinó. Se ubican arrastrando o con «Mover a».
- **Arrastre táctil**: no se probó con el dedo. Los dos gestos son HTML5 drag-and-drop, que en
  celular depende del navegador; las acciones en lote no dependen de eso.
- Los dos «sin medir» de arriba (Escape del editor del CRM, menú del lápiz del CRM).
- La copia de fila del arrastre duplicada entre `TablaClientes.tsx` y `app/plan/board/Tablas.tsx`.

## Verificar lo que integró el workflow: el deshacer que reseteaba el reloj, y un menú para una pregunta (05/10/2026, noche)

El workflow `cs-tabla-lote-editor` (tres agentes: editor, tabla, kanban+lote) terminó entero, y
los siete pedidos que dejaron «para el orquestador» estaban enchufados en `42d91a41`. Lo que no
había hecho nadie era probar en el navegador lo que ellos no pudieron (no tenían permiso para
levantar el server contra datos reales). Esta pasada lo hizo, con las escrituras bloqueadas, y
encontró dos cosas que ningún agente podía ver desde su archivo.

### Deshacer un movimiento reseteaba «hace cuánto está en la etapa» — y la pantalla lo tapaba

El deshacer de una tarjeta y el del lote vuelven a llamar al choke point con la etapa anterior,
que es lo correcto (revertir sólo la pantalla miente hasta el F5). Pero para `moverClienteDeEtapa`
un deshacer es un movimiento más, y un movimiento escribe `etapa_desde = ahora`: un cliente en
rojo por 21 días sin moverse, arrastrado por error y devuelto con el toast, quedaba en la base
como recién llegado.

⚠️ **Y no se veía**, que es por qué sobrevivió a dos rondas de verificación: la pantalla, al
deshacer, restaura en su estado la fila de ANTES —con la fecha vieja—, así que el chip seguía
rojo. El dato cambiaba en el próximo F5. **Lo encontró leer el código del deshacer buscando qué
estado arrastra el movimiento**, no el navegador. Es la regla de la casa «el deshacer restaura
también el estado que ese cambio trajo de arrastre», aplicada a un campo que el movimiento
escribe sin que nadie lo pida.

La cura: el deshacer manda el reloj previo (`relojPrevio`), el choke point lo escribe si es
válido (`relojDeVuelta`: legible y no del futuro, porque lo manda el navegador) y la pantalla usa
la misma función para su estado local, o la base y la pantalla vuelven a decir dos fechas. Un
movimiento normal no lo manda. Lo que el deshacer NO devuelve es la línea del historial y el
enrolamiento de secuencias: eso ya estaba así a propósito (ver el comentario de
`enrolarPorEvento` en el choke point).

**Vive en:** `lib/servicio-etapas.ts` (`relojDeVuelta`), `lib/cs-mover-etapa.ts`,
`app/customer-success/actions.ts`, `app/customer-success/ClientesApp.tsx`. Guard:
`tests/cs-deshacer-reloj.test.ts`.

### La misma pregunta con dos menús, y un menú que se salía de la ventana

«Mover a» de la barra y el chip de la columna Etapa preguntan lo mismo y tenían dos menús: el de
la barra agrupado por fase en **500 px** (dos tercios vacíos y «Sistema instalado» cortado por el
alto) y el de la tabla plano, con la fase repetida debajo de cada etapa y cinco de nueve a la
vista. Ahora es una función (`opcionesDeEtapas`) y un menú.

- ⚠️ **Los 500 px los pone el primitive para todo `columns`**, también con una sola columna, y
  hay pantallas que la usan así contando con ese ancho. El arreglo es opt-in (`alContenido` en
  `Dropdown`): mide su contenido, tope 360.
- ⚠️ **Y un tope de alto FIJO no sabe dónde abre el menú.** Con `min(560px, 100dvh - 40px)` el
  menú abierto desde la mitad de la tabla salía 32 px por debajo de la ventana (abre hacia abajo
  si quedan 300 px o más). `alContenido` lo topea con el espacio que QUEDA del lado donde abre;
  ahí scrollea, que es lo honesto. Los menús de columnas viejos tienen el mismo riesgo y no se
  tocaron.

**Vive en:** `app/components/Dropdown.tsx` (`alContenido`, `MenuPos.espacio`),
`app/customer-success/LoteClientes.tsx`, `app/customer-success/TablaClientes.tsx`.

### Tres trampas del arnés que se leen como bugs de la pantalla

- **`locator.dragTo()` de Playwright no prueba un arrastre en lote.** Con dos tarjetas marcadas
  no salió ningún POST; el mismo gesto hecho a mano (`mouse.down`, doce `mouse.move`,
  `mouse.up`) mandó `[1,[{21,"contexto"},{28,"contexto"}]]`. Sin selección `dragTo` sí andaba,
  así que la diferencia parecía del código. Instrumentar `dragstart`/`drop` en `document` y
  mover en pasos lo resolvió en una corrida.
- **`getByRole('button', { name })` mira el `aria-label`, no el texto.** Los botones de la barra
  dicen «Mover a» y se anuncian con una frase más larga, así que el selector por nombre no los
  encuentra y el click «se cuelga» 30 s. Va `locator('button', { hasText })`.
- **Una opción con subtítulo no matchea su rótulo exacto**: el texto del botón es
  «RitmoTablero y Ritmo». Lo mismo cualquier `/^…$/` sobre un renglón con `sub`.

### Lo que el workflow dejó SIN hacer, y sigue así

- Arrastre con el dedo: el táctil del Plan (`app/plan/board/arrastre-tactil.ts`) está tipado
  contra sus columnas de prioridad.
- La copia de FILA del arrastre está duplicada entre `TablaClientes.tsx` y
  `app/plan/board/Tablas.tsx`; unificar es sacarla a `arrastre-copia.ts`.
- Una acción en lote sugerida y no hecha: «Copiar emails/teléfonos».
- La línea «Productos eliminados» en la confirmación de eliminar (necesita saber si el producto
  tiene embudo).

## El modal de «Abrir cuenta» quedaba DEBAJO de la tarjeta de al lado (05/10/2026)

Captura de Martín sobre Código Inmobiliario: «Abrir cuenta» en la tarjeta de un cliente abría
el modal, y la tarjeta de la columna siguiente pintaba su banda, su nombre y su
«Inspeccionar» ENCIMA de él, mientras el resto de la página quedaba bien oscurecido.

**La causa son dos cosas correctas por separado.** `Modal` (`app/_ui/Modal.tsx`) no se
portalea: se dibuja donde lo montan. Y `TarjetaEntidad` le da a cada hijo de la tarjeta
`position: relative; z-index: 1` (`.cl-card > *:not(.cl-abrir)`), para que el contenido quede
sobre el botón que cubre la tarjeta. Con eso la fila de acciones es un contexto de
apilamiento, y un modal montado ahí adentro vale z 1 *dentro de esa tarjeta*: la siguiente,
más abajo en el DOM, le gana. Medido después del arreglo: 81 de 81 puntos sobre la caja del
modal son del modal.

⚠️ **Lo que lo dejó pasar es que el control se MUDÓ.** `CuentaDeMaKo` nació en la ficha del
cliente —adentro de otro modal, donde esto no se ve— y el 27/09 ganó una variante para la
tarjeta. El comentario de `anidada` seguía hablando de la ficha. **Al llevar un control que
abre un modal a otro contenedor, la pregunta es dónde queda montado el modal**, y una
tarjeta, una fila o una barra pegada son los tres lugares de esta casa que lo atrapan.

**La cura es local y por portal**, como la barra pegada de AGENTS.md: los modales de las
tarjetas de `/admin` ya se montan arriba de todo, y portalear `Modal` para sus 22 consumidores
cambia de qué `<main>` heredan el hover. Y la segunda mitad, que el portal no resuelve: **los
eventos sintéticos suben por el árbol de React, no por el DOM**, así que arrastrar texto en el
email del modal llegaba al `onDragStart` de la tarjeta y la clonaba como si la agarraran. El
arrastre ignora lo que no nació adentro de la tarjeta en el DOM.

**Vive en:** `app/customer-success/CuentaDeMaKo.tsx`, `app/customer-success/KanbanEntrega.tsx`
(`agarrar`). Guard en `tests/cs-kanban-fases.test.ts`.

## Los seis puntos de la noche del 05/10: casilla del CRM, fases al filtro, editor, ficha por pestañas

El pedido fueron seis puntos (texto literal en `app/admin/dev/customer-success/bitacora.ts`).
Lo construyeron cuatro agentes en paralelo sobre archivos separados, y la integración y la
verificación en el navegador sobre Mauricio (ws1) y Código Inmobiliario (ws13) se hicieron
después. Lo que costó entender:

### «Cliente desde» y el filtro «Cuándo» leían un campo que nadie llenaba

El Resumen de la ficha decía «—» en todos los clientes, y el diagnóstico obvio («ese cliente
no tiene la fecha de cierre cargada») era falso. `lib/clientes-ganados.ts` pide la columna
`fecha_cierre` desde `98bbce3e` (28/09) y **nunca la copiaba a `fechaCierre`**: el campo era
`undefined` para todos. Por eso también el filtro «Cuándo» de la barra dejaba **0 clientes**
en cualquier ventana que no fuera «Siempre», desde hacía una semana. El typecheck no lo ve
porque el campo es opcional en `ClienteRef`. Es «escribir la salida no es ofrecerla» del lado
de la lectura: seleccionar una columna no es leerla.

**Vive en:** `lib/clientes-ganados.ts`.

### «Llamadas» con `fathom_links` mostraba la mitad equivocada

La fuente obvia, `leads.fathom_links`, sólo tiene las llamadas de VENTA (R1 y R2, como
`{label, url}`, sin fecha). Las sesiones de la ENTREGA —lo que le importa a Customer Success—
están en `closing_analyses` (`category = 'entrega_servicio'`, con `call_date` y duración).
Medido con TEXX en el ws1: 18 llamadas ahí. La pestaña une las dos fuentes sin repetir la
misma grabación.

⚠️ **Corrección del 06/10 (la sesión del CRM):** cuando esto se escribió, «sólo ventas» NO era
del todo cierto. El webhook de Fathom etiquetaba como «Reunión 2» cada sesión de ENTREGA de un
cliente que ya había tenido su R2, y había 45 de ésas en `fathom_links` (6 clientes del ws1).
Ahora no las engancha más y se sacaron; siguen en `closing_analyses` con su `lead_id`, así que
«Llamadas» las muestra igual. La regla que separa una de otra es `esGrabacionDeEntrega`
(`lib/insights-llamada-reparto.ts`): lead ganado y grabación ESTRICTAMENTE posterior a
`fecha_cierre` — el primer pago no sirve, porque el apartado se cobra en la R1.

**Vive en:** `app/customer-success/ficha-datos.ts` (`llamadasDe`), `app/customer-success/ficha-lectura.ts`.

### Esconder la pestaña «Equipo» no protegía nada

`page.tsx` leía la cartera de la agencia —y con ella `listarUsuarios`, que es GLOBAL— con sólo
tener filas aprobadas, aunque el workspace ya no fuera agencia. Una agencia a la que se le
quitó el permiso seguía recibiendo en el HTML el equipo de otro inquilino. Ahora la lectura
cuelga de `esAg`, igual que lo que se dibuja (`cuentas.visible = esAg`, pedido de Martín: «todo
lo que tenga que ver con invitar a MaKo, debería solo verse si la cuenta es AGENCIA»). Y el
filtro «Con / Sin cuenta de MaKo» de la barra se va con lo demás fuera de una agencia.

**Vive en:** `app/customer-success/page.tsx`, `app/customer-success/ClientesApp.tsx`.

### La fase en «Filtrar» destapó dos definiciones de «Sin fase» y un lote que actuaba a ciegas

- Los chips **ofrecían** «Sin fase» contando las etapas con una fase BORRADA y la **dibujaban**
  con `(e.fase ?? '') === ''`: con una sola etapa así, elegir «Sin fase» dejaba el riel en
  blanco. Ahora decide una función (`columnasVisibles`) en las dos puntas, y una fase sin
  columnas no se ofrece.
- Con una fase elegida, la pantalla no sabía qué columnas estaban escondidas: «Seleccionar
  todos» + «Mover a» movía clientes de fases que no se veían. Lo cierra `enPantalla` (lo
  visible menos los clientes de las columnas escondidas), que usan el contador, el exportar y
  la barra de lote.

**Vive en:** `app/customer-success/BarraClientes.tsx`, `app/customer-success/ClientesApp.tsx`.

### `.ke-card > * { width: 100% }` volvió a morder

El numerito que lleva la copia del arrastre cuando viajan varios es hijo directo de la
tarjeta y tomó el ancho entero: 275 px en vez de 27. Es la misma regla que estiró la casilla
vieja hace unas horas. Antes de colgar algo de `.ke-card`, se le da `width: auto`.

### El editor guarda el ORDEN QUE SE VE

El rediseño (una lista, las fases como títulos, las acciones sólo al pasar el mouse, y
ordenar y cambiar de fase con el mismo gesto: arrastrar o Alt+↑/↓) obligó a una regla que
antes faltaba: el selector de fase viejo dejaba los grupos PARTIDOS en el tablero (cambiarle
la fase a una etapa la dejaba en su lugar). Ahora cada guardado manda los grupos contiguos y
las fases en el orden de las columnas (`enOrden`), y **la firma inicial pasa por el mismo
`enOrden`**: sin eso, abrir el editor sobre una lista partida la guardaba (medido: 1 guardado
contra 0).

**Vive en:** `app/customer-success/EtapasEntregaModal.tsx`.

### La ficha por pestañas: dos trampas del Modal

- Las reglas del cuerpo del `Modal` (`ui.css`) le ponen padding y filete a cada hijo directo,
  y el selector `+` cuenta igual a un hermano escondido con `display: none`: con las pestañas
  como hijos sueltos aparecía una segunda raya. Va un único envoltorio.
- Una pestaña DESMONTADA devolvería el tablero con datos viejos (`useBoard` siembra su estado
  de las props una vez). Por eso se montan la primera vez que se abren y después sólo se
  esconden.

### Trampas del arnés y de correr cuatro agentes sobre el mismo árbol

- **El scratchpad compartido con el mismo prefijo** hizo que un agente pisara el arnés de
  roturas de otro y lo ejecutara: 17 roturas sobre `BoardShell.tsx` restauradas por un arnés
  ajeno. Terminó bien porque ese arnés restauraba sólo el pedazo roto, no el archivo entero.
  **Cada agente de un workflow necesita su propio sub-prefijo**, y un arnés que rompe código
  restaura reemplazando el pedazo y no reescribiendo una copia vieja del archivo (pisaría el
  trabajo del vecino que siguió editando).
- **Restaurar «de memoria» puede fallar en Windows**: `writeFileSync` contestó
  `UNKNOWN: unknown error, open` con OneDrive o el dev server tomando el archivo, y
  `FichaCliente.tsx` quedó roto hasta restaurarlo a mano. El arnés reintenta, relee para
  confirmar y guarda una copia previa.
- **En Playwright headless cada `dragover` llega un movimiento tarde**: una foto tomada
  durante el arrastre muestra la marca del lugar anterior aunque el drop caiga bien. Un
  `mouse.move` de 1 px antes de leer.
- **Las columnas del kanban también llevan `data-etapa`**: un selector suelto en un script
  agarra el tablero que está detrás del modal.
- **Un `mouse.down` sobre una fila fuera del área visible del cuerpo del modal cae en el
  fondo**, y el `Modal` se cierra. Primero `scrollIntoViewIfNeeded`.
- **Una medición «en reposo» con el cursor encima de la tarjeta mide el hover**: Playwright
  deja el mouse donde terminó el paso anterior.

### Lo que quedó SIN hacer

- La fase NO filtra la vista tabla (sólo se ofrece en kanban): `TablaClientes.tsx`.
- Arrastre con el dedo, en el kanban y en el editor (HTML5 DnD no anda en táctil).
- Lo que se CREA en el Plan con el filtro de cliente puesto no nace asignado a ese cliente,
  y desaparece del tablero filtrado al cerrarlo. Decisión de producto pendiente
  (`crearConGuardian` / `crearProyecto` en `app/plan/board/BoardShell.tsx`).
- `app/admin/FichaWorkspace.tsx` (la ficha de la plataforma) sigue con «Equipo» como vista
  extra del tablero.
- ~~Los números del Resumen no siguen en vivo lo que se edita en Prioridades.~~ Se fue con el
  renglón «Trabajo» el 06/10 (ver la sección de abajo).

## Clientes por producto, la ficha con las tabs del CRM y el editor por cajas (06/10/2026)

El pedido: el editor de etapas con las fases como contenedores y «Nueva fase» arriba, opaca;
«Prioridades» pasa a «Tareas» con «Ver en el Plan» donde estaba el «⋮»; la Entrega del
Resumen se va y quedan dos desplegables (producto y etapa) como en el CRM; el Resumen son los
datos de la «Información principal» del CRM; la foto sale de WhatsApp o del email; y las tabs
Pagos e Historial. Y una respuesta suya que cambió el modelo: «un cliente puede estar en
varios productos, lo mismo que el CRM… pero en el producto de PRUEBA debería estar vacío».

### Cada tablero dibujaba a la cartera ENTERA, y nadie lo había preguntado

«Prueba» mostraba a los 14 clientes de Negocio que Escala en Bienvenida. No era un dato mal
cargado (Prueba no tenía ni una fila en `cliente_entrega`): era la regla «un cliente sin fila
está en la primera etapa» (`repartirEnEtapas`), que nunca preguntó **de qué producto** era el
cliente. Con un solo producto no se nota; con dos, todos están en todos.

La regla que quedó (`app/customer-success/pertenencia.ts`): un cliente es de un producto si es
su **CASA** —el producto de su embudo del CRM, `leads.funnel_id`, con NULL = el embudo
principal como en el CRM— **o** si tiene una fila ahí. Sin casa que se ofrezca y sin filas,
cae al primer producto ofrecido: en Código Inmobiliario el embudo principal no está atado a
ningún producto, y sin ese respaldo sus cuatro clientes no aparecían en ningún tablero.

- **Se aplica UNA vez y salen de ahí los cuatro universos del producto**: el kanban, la tabla,
  «N de M» y el conteo del editor de etapas (`visiblesServ` / `listaServ` en ClientesApp). Con
  uno filtrado y otro no, el editor avisaría que sacar una columna se lleva clientes que el
  tablero no muestra — la misma familia que el «0 contra 5» del 05/10.
- **Y se pregunta sobre la asignación CON LO MOVIDO EN LA SESIÓN** (`asignacionDe`), no sobre
  las filas del server: «＋ Agregar a…» lo mete al tablero en el acto y su deshacer
  (`sacarEntrega`, que borra la fila que acaba de nacer) lo saca.
- Medido en el navegador: Negocio que Escala 14, Prueba 0; Código Inmobiliario Entrada 4, Core
  0, Premium 0.

**Vive en:** `app/customer-success/pertenencia.ts` · `app/customer-success/entrega.ts`
(`casaDeLaCartera`) · `app/customer-success/ClientesApp.tsx` · *2026-10-06*

### La etapa de la ficha no puede ser una foto del server

El renglón «Entrega» del Resumen salía de `entregasDe`, calculado en `page.tsx` con lo que
traía el server. Para un desplegable que MUEVE eso miente: después de moverlo, la foto dice la
etapa de antes hasta el próximo `revalidatePath`. Los desplegables nuevos (`FichaEntrega.tsx`)
leen la misma `asignacionDe` que el kanban y mueven por el mismo `moverEntrega` (deshacer,
reloj e historial incluidos). `entregasDe`, `conteoDeTrabajo` y `fraseConteo` se fueron con sus
renglones, y sus tests con ellos.

El desplegable de producto **elige qué entrega se mira, no mueve al cliente** — al revés que el
del CRM, donde un lead vive en UN embudo y elegir otro lo muda. Acá mover sería sacarlo de un
producto que nadie pidió tocar.

**Vive en:** `app/customer-success/FichaEntrega.tsx` · *2026-10-06*

### Renombrar al cliente desde su ficha no dejaba historial

`guardarDatosClienteAction` escribía `leads` a pelo, así que la tab Historial —que es el
`AuditHistory` del CRM, sobre `lead_audit`— no mostraba que alguien había cambiado el nombre o
la empresa desde Customer Success. Va el mismo `logLeadChanges` que usa la ficha del CRM, con el
antes y el después LEÍDOS. Los movimientos de etapa ya dejaban su «Entrega: <producto>» desde
el choke point.

**Lo que sigue a medias:** el choke point firma esos movimientos como `CRM` (`POR_PERSONA`), no
con el email de quien movió, así que el Historial dice «CRM» y no la persona.

**Vive en:** `app/customer-success/actions.ts` · `lib/cs-mover-etapa.ts` · *2026-10-06*

### La foto automática: el `onError` de `Marca` no deja encadenar

El pedido era WhatsApp primero y, si no tiene, el email. `Marca` cae DIRECTO a las iniciales en
el `onError`, así que con ella no hay forma de pasar de la primera candidata a la segunda.
`foto-cliente.ts` prueba cada una con un `Image()` y a `Marca` le llega sólo la que cargó (el
navegador la sirve de caché: el proxy contesta con `max-age`).

- **Lo que la persona eligió gana siempre**: con `icono` o `avatar_url` no se busca nada.
- **El `<img>` no pasa por el parche de fetch que agrega el `?ws=`**: sin `conWs`, el super
  admin mirando a un cliente le pediría la foto a la línea de WhatsApp de SU workspace.
- El Gravatar sale armado del server (`ficha.fotoEmail`): el hash usa `node:crypto`.

⚠️ **El mismo día la sesión del CRM mudó esta lógica a una pieza común**
(`app/_components/foto-contacto.ts` + `candidatasDeFoto` en `lib/contacto-lead.ts`, con test),
porque Martín pidió lo mismo para la ficha del lead. `foto-cliente.ts` quedó como un envoltorio
que arma el contacto desde `ClienteCruce`: con dos copias, las dos fichas elegirían distinto el
día que una cambie el orden. Dos datos que midió esa sesión: «la foto del email» es Gravatar —la
de una cuenta de Gmail no es pública, y 550 de 1155 leads del ws1 son de Gmail, así que la
mayoría queda en iniciales y no es un bug—; y la de WhatsApp sale de `evolution_contactos.foto_url`,
que vence a los 10 días (1298 de 1807 vencidas en el ws1), con el proxy tardando hasta 68 s si la
línea está colgada — mientras tanto se ven las iniciales.

**Vive en:** `app/_components/foto-contacto.ts` · `lib/contacto-lead.ts` ·
`app/customer-success/foto-cliente.ts` · *2026-10-06*

### El editor por cajas (lo hizo un agente, verificado en el navegador)

- **Saber si algo está «adentro» de un elemento JSX buscando texto da verdes falsos**: el
  primer guard buscaba «Nueva etapa» antes del último `</div>` del recorte, y ese `</div>` era
  el de la propia fila. Contar `<div` contra `</div>` tampoco, porque los atributos traen `=>`.
  Se parsea con el compilador de TypeScript (`cajaJsx` en tests/cs-kanban-fases.test.ts).
- **Al soltar una etapa en OTRA caja, su nodo se desmonta y el `dragend` no llega a
  `document`**: la limpieza va en el `drop`.
- **El destino se elige primero por la caja bajo el cursor** y después por el hueco más cercano
  adentro (`destinoEn`): con sólo el hueco más cercano, el cursor sobre el título de la caja de
  abajo caía al final de la de arriba.

### Trampas de la verificación

- **Abortar `autoasignar` (el POST con cuerpo `[]` que la página dispara sola al montar) manda
  la página a «pantalla rota»**: no es un bug, es el arnés. Las lecturas de un solo número
  (notas, historial, pagos de un cliente) se dejan pasar; lo demás se aborta.
- **`scrollIntoViewIfNeeded` sobre un nodo del modal scrollea la PÁGINA** (~50 px) y la caja
  leída antes queda vieja: el `mouse.down` agarra otra fila. Se scrollea sólo
  `.mk-modal__cuerpo`.
- **Un dev server que se muere a mitad de escribir deja `.next/dev` corrupto**, y desde ahí
  TODO `/api` da 404 — incluido el dev-login, que se lee como «hay una env de Vercel puesta» y
  no lo era. La cura y el detalle, en `docs/hallazgos-infra.md`.

### Lo que quedó SIN hacer

- Pagos e Historial piden sus datos al abrir la tab (con su giro), igual que las Notas: es la
  excepción a «la ficha no tiene estado de carga», porque bajar el lead entero y sus cuotas de
  catorce clientes en cada carga sería pagar la lectura para una tab que se abre de a una.
- ~~No hay «Quitar de este producto» en la ficha~~ Hecho el mismo 06/10 (ver la sección de
  abajo), incluida la casa.
- El autor de los movimientos de entrega en el Historial es «CRM» y no la persona (arriba).

## Quitar de un producto, el orden manual y el hueco que sigue al cursor (06/10/2026, tarde)

Cuatro pedidos: «Quitar de este producto» sólo con más de un producto; el menú de etapas sin
dividir por fases; las Notas del mismo alto que la caja de al lado; y el hueco al arrastrar en
el editor de etapas y dentro de una columna del kanban («si a un cliente lo arrastro abajo de
otro, no se ve esa animación»).

### Sacar a un cliente de su CASA no se puede hacer borrando nada

La casa de un cliente (el producto de su embudo del CRM) se DERIVA (`casaDeCliente`), así que
«Quitar» sobre ella no tiene fila que borrar: hace falta decir «éste no». Va en una tabla
APARTE (`cliente_entrega_fuera`, mig 0196) y no en una columna de `cliente_entrega`, a
propósito: todo lo que lee `cliente_entrega` —el tablero, la nutrición, el choke point— entiende
«hay fila» como «está en esta etapa». Una fila con `fuera = true` sería un cliente en una etapa
en la que no está, en cada lector que no se enteró.

- El server vuelve a contar los productos con la MISMA regla (`productosDelCliente`) antes de
  quitar: con uno solo lo dejaría en ningún tablero. La cruz sólo se dibuja con dos o más, pero
  esconder un botón no protege nada.
- Si era su casa SIN fila, el choke point no deja historial (no hay nada que mover ni borrar):
  la línea «Entrega: X» la escribe la acción (`historialDeProducto`).
- El respaldo «sin casa ni filas → el primer producto» saltea los productos de los que lo
  sacaron: si no, se lo devolvería al que se lo acaban de sacar.
- ⚠️ **No se probó de punta a punta en el navegador**: hace falta un cliente en dos productos, el
  Cliente de Prueba (ws3) no tiene clientes ni productos, y armarlo en un cliente real deja dos
  líneas en su historial. Lo cubren los tests (el guard de «dos o más» de los dos lados) y la
  lectura del código.

**Vive en:** `app/customer-success/actions.ts` (`quitarDeProductoAction`, `volverAProductoAction`)
· `app/customer-success/entrega.ts` · `app/customer-success/pertenencia.ts` · *2026-10-06*

### El hueco no seguía al cursor A PROPÓSITO, y para que lo siga hubo que guardar el orden

Del 05 al 06/10 el hueco del kanban iba donde la tarjeta IBA a aparecer (`dondeCae`), porque
una columna no tenía orden propio: seguir al cursor era prometer «acá» y dejarla «allá». El
pedido no se podía cumplir sólo con el dibujo, así que se preguntó si la posición se guarda
(«Se guarda + "Manual"»). Ahora sí: `cliente_entrega_orden` (mig 0196) guarda la lista de cada
columna, y «Ordenar» suma «Manual».

- ⚠️ **El CRM dibuja el mismo hueco y NO guarda la posición**: soltar en la misma columna no hace
  nada (`handleDrop` en `app/crm/CrmBoard.tsx` corta si la etapa no cambia). O sea que ahí el
  hueco promete un lugar que no se respeta. No se tocó; queda dicho.
- **Una lista por (producto, etapa) y no una posición por cliente**: la mayoría de los clientes
  no tiene fila en `cliente_entrega` (está en la primera etapa por regla), y una posición por
  cliente obligaría a escribirle una fila —con un reloj de etapa que arranca hoy— a cada uno que
  se reordene.
- **La pantalla guarda la columna ENTERA y el kanban manda un VECINO** («antes de Juan»), no un
  número: con un buscador puesto, «el tercero» de lo que se ve no es el tercero de la columna, y
  guardar lo visible mandaba a los escondidos al final.
- **La lista puede nombrar a quien ya no está en la columna** (se movió, se quitó): no se poda,
  se ignora al leer. Por eso la clave de orden es la posición en la lista de SU etapa actual.
- **«Manual» arranca solo si alguien ya ordenó algo**: el criterio vive en el estado, y
  arrancando siempre en «Nombre» el orden guardado desaparecía en cada F5 — que se lee como que
  no se guardó. Y con «Manual», los que la lista no nombra van en el criterio que estaba antes
  (`ordenPrevio`), o las columnas que nadie tocó saltarían de orden al soltar en otra.
- Los puntos medios se miden UNA vez al agarrar, en coordenadas de página + scroll de la
  columna (la cuenta del CRM): con el hueco abierto las tarjetas de abajo se corren y medir en
  cada `dragover` hace oscilar el índice.

**Vive en:** `app/customer-success/orden-manual.ts` · `app/customer-success/KanbanEntrega.tsx`
(`medirColumnas`, `soltarEn`) · `app/customer-success/ClientesApp.tsx` (`soltarEnColumna`) ·
*2026-10-06*

### El menú de etapas es UNO y por eso cambió en los tres lugares

`opcionesDeEtapas` lo usan la cabecera de la ficha, el chip de la tabla y «Mover a…». Sacar los
títulos de fase ahí los saca de los tres, que es lo que se busca: tres menús para la misma
pregunta se terminan armando distinto (ya pasó el 05/10). La fase se sigue viendo en el punto de
color de cada etapa.

### Un hueco que aparece debajo del cursor quieto se come el drop (lo encontró el editor)

El editor de etapas pasó de una línea a un hueco del alto de una fila (lo hizo un agente, con 7
escenarios medidos en el navegador y 14 roturas probadas). Al abrir el hueco JUSTO debajo del
cursor, el elemento bajo el cursor cambia sin que el mouse se mueva, y en esa vuelta Chromium
dispara `dragenter`/`dragleave` y **no** `dragover`: lo que decide si se puede soltar ahí es si el
`dragenter` se canceló. Sin cancelarlo, 0 de 2 drops sobre el hueco recién abierto llegaron (sólo
`dragend`); cancelándolo, 2 de 2.

- ⚠️ **La trampa conocida del arnés «el `dragover` llega un movimiento tarde» tiene ESTA causa** y
  no es sólo del headless: es el elemento que cambió.
- El kanban de clientes abre su hueco de la misma forma desde que sigue al cursor: se le puso el
  mismo `dragenter` aceptado, sólo adentro de `[data-etapa]`.
- **Sin hacer:** el CRM (`app/crm/CrmBoard.tsx`) y el Plan (`app/plan/board/BoardShell.tsx`) abren
  huecos igual y sólo cancelan `dragover`. Probablemente tengan el mismo drop perdido; no se midió.
- El hueco del editor NO se abre donde soltar no cambia nada (arriba o abajo de la propia fila):
  si no, en el primer píxel la fila de origen saltaba debajo de la copia (`cambiaAlSoltar`).
- **`setTimeout(0)` en el `dragstart` no garantiza «un render después»**: el timer salió a los 27 ms
  y React pintó ese estado a los 80, en el mismo render que el primer hueco. Por eso la medida
  apaga el hueco mientras lee (`.ee-midiendo`): medida con el hueco abierto, el destino caía una
  fila arriba.
- Trampas de los tests: saber si algo está «adentro» de un elemento JSX se mira con el compilador
  (`cajaJsx`), y un regex `[^']*` sobre una hoja con `' + FILA + '` adentro devuelve vacío.

**Vive en:** `app/customer-success/EtapasEntregaModal.tsx` · `app/customer-success/KanbanEntrega.tsx`
(`aceptarEntrada`) · *2026-10-06*

### Una acción que no llega tumba la pantalla entera

Abortando el guardado en el arnés, la pantalla pasó a «Esta pantalla se rompió al dibujarse»:
una server action sin red RECHAZA la promesa, y adentro de una transición (`useTransition`) eso
llega al error boundary. Es lo que vería alguien que se queda sin red justo al soltar. Los
handlers nuevos (`soltarEnColumna`, `quitarDeProducto`) lo atajan como un error más.
**Sin hacer:** los handlers viejos de `ClientesApp.tsx` (`moverEntrega`, `moverLote`,
`sacarEntrega`, `guardarImagen`) tienen la misma forma y no lo atajan.

### Notas del mismo alto: el que se estiraba era el envoltorio

Con `align-items:stretch` en la grilla, la celda de las Notas se estiraba pero la caja de adentro
(`NotasCard`, que trae su propio `section`) seguía del alto de su contenido: el envoltorio va en
columna flex y la caja con `flex:1`. Medido: 310 px las dos.

## El curso del servicio, adentro de MaKo (06/10/2026)

**Vive en:** `lib/curso.ts` (reglas puras), `lib/curso-datos.ts`, `lib/curso-acceso.ts`,
`lib/curso-portal.ts`, `lib/curso-avance.ts` + `lib/curso-avance-regla.ts`,
`lib/curso-mensajes.ts` + `lib/curso-mensajes-texto.ts`, `lib/curso-admin.ts`,
`app/customer-success/curso/`, `app/customer-success/FichaCurso.tsx`,
`app/compartido/curso/`, `app/api/compartido/curso/`, `app/api/cron/curso-sesiones/`,
`scripts/curso-cargar-programa.ts` + `lib/curso-programa-nqe.ts`,
`supabase/migrations/0202_curso.sql`.

Pedido de Martín: la tab CURSO con el programa de Mauricio, verla en el detalle de cada cliente,
los formularios con sus tareas, mensajes antes y después de cada llamada, pasar de etapa según las
tareas, sacar Whop, videos por link o subidos midiendo cuánto se vio, y un acceso especial donde el
cliente sólo ve las clases y las tareas. Lo implementó una corrida de 6 agentes con 2 revisores
(commit `eba4f12f`).

**El modelo, en cuatro líneas.** Cada clase cuelga de una ETAPA de la entrega del producto
(`producto_entrega`), así que «la próxima etapa tiene tutorial» es una consulta y pasar de etapa
usa el choke point que ya existía (`moverClienteDeEtapa`, con `por: POR_MAKO`). Una etapa se
completa cuando el cliente ENVIÓ todas sus obligatorias (`etapaCompleta`); una etapa sin
obligatorias no se completa sola, a propósito. El % visto lo calcula el server con el máximo
segundo alcanzado sobre la duración. El programa cargado en el ws1 son 107 clases: 63 videos de la
planilla «Arquitectura_Tutoriales_NqE» de Mauricio, 43 formularios del catálogo borrado el 26/09 y
la logística; cada etapa la cierra su última Demostración (la regla «Secuencia» de la planilla).

### Decisiones tomadas sin preguntar (Martín dijo «no preguntes»), y dónde se cambian

- **El acceso es un LINK FIRMADO, no una cuenta** (`c1.<ws>.<lead>.<version>.<hmac>`). El login de
  MaKo es sólo con Google y 10 de los 14 clientes no tienen Gmail; además, una sesión de MaKo pasa
  el proxy en todas las rutas que no son `/admin`, y el aislamiento dependería de que cada ruta
  mirara el rol. Revocar = subir la versión (`curso_accesos`).
- **La etapa cierra al ENVIAR, no al aprobar.** «Marcar revisada» es una marca del equipo; si
  cerrara al aprobar, el cliente quedaría esperando a que alguien lo mire para seguir.
- **El mensaje de etapa nueva sale sólo en el paso AUTOMÁTICO**, no cuando alguien mueve al cliente
  en el kanban: el deshacer del kanban vuelve a pasar por el choke point y mandaría un mensaje por
  cada arrepentimiento. Para un movimiento a mano está «Mandar por WhatsApp» en la ficha.
- **La próxima llamada se anota a mano en la ficha** (`curso_sesiones`). No se lee de Calendly ni de
  `leads.junta_*`: ésas son las R1/R2 de VENTA y una sesión de entrega ahí pisaría la venta.
- **Todo lo que le escribe al cliente respeta `envio_whatsapp_enabled`**, que en el ws1 está en
  `false` desde el 29/09. Mientras siga así, a ningún cliente de Mauricio le llega nada (el link,
  la etapa nueva, el previo ni el posterior) y la ficha dice «envío de WhatsApp apagado».

### Contradicciones que decide Martín (o Mauricio)

- **El PAS va tercero en el kanban y la planilla lo pone DESPUÉS de Tablero y Ritmo**, a propósito
  («Contexto en dos pasadas»; el video 9.1 se llama «Por qué el propósito va después del tablero»).
  Hoy un cliente llega a esa tarea sin tener tablero. Se arregla moviendo la etapa `pas` entre
  `ritmo` e `instalado` en el editor de etapas: las clases cuelgan de la CLAVE y viajan solas.
- Falta `m0c2` («Estándar no es criterio») del catálogo viejo: el programa nuevo ya lo cubre con el
  2.1 y la tabla D2. Y `m11c2` (Auditoría de vinculación) quedó en la última etapa por el reparto,
  aunque su ayuda dice «se corren antes de programar nada»: encaja al cerrar Palancas.
- Algunos textos de la planilla numeran fases («Qué se deja para la fase 9») y otros están escritos
  para Mauricio en tercera persona («Que escriba su visión…»). Se cargaron textuales.
- Los formularios de palancas, evidencia, umbrales y carta (`m6*`–`m9*`) eran UNO POR ÁREA y el m8
  lo contestaba el líder de área. Hoy son uno por cliente.

### Lo que encontró la revisión (y el diagnóstico que era falso)

- **«Enviado» sobre un recordatorio que no salió.** El cron marca `aviso_previo_at` ANTES de mandar
  (compare-and-set, para no mandar dos veces) y no la deshace si falló, no había teléfono o el
  cliente estaba al día. La marca significa «se procesó», no «le llegó»: lo que distingue es el
  motivo anotado de ESA fase (`motivoDeFase`). La ficha leía sólo la marca y pintaba «enviado» con
  «Antes: sin teléfono» escrito abajo.
- **Cualquier clase al 100% con un POST.** El server dividía `seg/dur`, pero los dos números venían
  del navegador y `dur` pisaba al guardado: `{seg: 1, dur: 1}` era «visto». La duración ahora se
  fija con la primera que llega y no puede ser menos del 80% de los minutos declarados.
- **Una tabla de filas fijas vacía contaba como contestada**: el portal guarda la etiqueta de la fila
  en la columna 0 y el server la contaba como respuesta, así que un pedido armado a mano cerraba la
  etapa. La pantalla ya lo miraba bien: la misma regla estaba escrita dos veces y una sola estaba
  bien. Ahora es `campoLleno`, en `lib/curso.ts`, y la pantalla la re-exporta.
- **«Entró N veces» medía mensajes, no visitas.** La página del portal contaba un ingreso en cada
  render: la vista previa que arma WhatsApp al mandar o pegar el link, y el `router.refresh()` que
  sigue a un paso de etapa. Ahora sólo cuenta una navegación de documento (`sec-fetch-dest`), y sin
  esos headers, ni un pedido RSC ni un agente de vista previa. Medido en el navegador: dos
  navegaciones dieron `ingresos: 2`, el token torcido 0.
- **Un borrador pisaba una tarea ya revisada** (una pestaña vieja con su beacon, o un POST a mano):
  la ruta de la tarea contesta 409 a un borrador sobre una tarea que no está pendiente.
- **Borrar o cambiar el video de una clase lo borraba del bucket aunque otra clase lo usara.**
  `borrarArchivo` pregunta antes si alguna fila lo referencia, y ante la duda no borra.
- **Un Vimeo no listado no reproducía**: el id solo no alcanza, el reproductor pide el hash
  (`vimeo.com/<id>/<hash>` o `?h=`).
- **Dos `videoDeClase` con formas distintas** (la tab y la ficha `{hay, rotulo, medible}`, el portal
  `{video, medible}`) decidían cada una si un video «se mide». Ahora las dos derivan de
  `reproductorDeClase` (`lib/curso.ts`). ⚠️ **Repartir trabajo por archivo DUPLICA las reglas
  puras que necesitan dos pantallas**: dos agentes no pueden ver lo que escribe el otro. Esa regla
  se decide en un módulo compartido ANTES del reparto.
- ⚠️ **Diagnóstico falso, y lo cometió el orquestador:** «el desplegable de Customer Success queda
  de una sola fila en la capa superadmin, porque sus `navKeys` no traen `cs-curso`». Se agregó la
  key y se revirtió: `tabEnCapa` une `navKeys` con `userNavKeys`, y superadmin tiene `userNavKeys:
  null`, o sea que contesta que sí a CUALQUIER key. **Antes de agregar una key a una capa (o de
  creer que una lista la restringe), mirá su `userNavKeys`.** Lo había medido el agente de la tab.
- ⚠️ **Diagnóstico falso: «los avisos a Mauricio necesitan su entrada de catálogo para salir».**
  `emitirAviso` acepta un tipo que no está en el catálogo y lo manda igual, con el rótulo «SISTEMA»
  y sin poder apagarse ni renombrarse. Las dos entradas (`curso-sesion-previa`,
  `curso-sesion-posterior`) se agregaron para eso. Y esos avisos NO pasan por
  `envio_whatsapp_enabled`, que gobierna sólo lo que se le escribe a un lead.

### Trampas del entorno que costaron una vuelta

- **PostgREST no puede hacer upsert contra un índice único PARCIAL** (`where origen is not null`):
  un `ON CONFLICT` sin el predicado no lo infiere. El cargador lee los orígenes que ya están e
  inserta lo que falta; un cruce de dos corridas lo frena el índice (falla el lote, no duplica).
- **Subida a una URL firmada de Storage** (medido contra producción): el gateway NO exige `apikey`
  (el comentario de `app/api/ads-manager/creative-signurl/route.ts` dice lo contrario). El filtro
  de tipos del bucket mira el tipo de la PARTE multipart: con `application/octet-stream` contesta
  400 `invalid_mime_type`, y hay navegadores que dejan `File.type` vacío en `.mov`/`.m4v`. El tipo
  se corrige por la extensión antes de subir (`mimeDeArchivo`). Y `exists()` de algo que no está
  devuelve `{data: false, error: 'Bad Request'}`, no un 404.
- **Postgres reordena las claves de un `jsonb`**: comparar campos con `JSON.stringify` dio 43 de 107
  «cambiados» que eran sólo orden. Se compara con un stringify de claves ordenadas.
- **Un `<video>` emite `timeupdate` en 0 al cargar**: sin filtrarlo, `visto_at` («primer play»)
  quedaba puesto en clases que sólo se abrieron. Nada sale hasta `currentTime > 0`.
- **YouTube:** que cargue `iframe_api` no es que esté lista (avisa por
  `window.onYouTubeIframeAPIReady`, que hay que encadenar con el que ya hubiera, con un tope), y
  `YT.Player` REEMPLAZA el nodo que recibe: va un div creado a mano adentro de la caja de React.
- **La URL firmada de un video subido vive 4 h**, no los 120 s de `/api/compartido/archivo`: un
  `<video>` pide rangos contra la URL a la que lo redirigieron, y si vence a mitad de clase el
  próximo salto falla. Costo aceptado: sobrevive a un «Cortar acceso» durante ese rato.
- **`sendBeacon` con un Blob `text/plain`**, no JSON: un tipo no «simple» lo rechazan algunos
  navegadores. La ruta lee el cuerpo crudo y topa por bytes leídos, no por `content-length`.
- **Un test de hora local pasa VERDE sobre el bug en una máquina en UTC** (CI, Vercel): leer
  `'2026-10-12T10:30'` como UTC da lo mismo que leerlo local. El test fija `process.env.TZ` adentro.
- **TypeScript no estrecha una unión cuando un miembro tiene el discriminante como unión**
  (`{decision: 'bloqueada'|'no-existe'} | {decision: 'ok', clase}`): con dos `===` seguidos
  `r.clase` sigue sin existir. Va un solo `if (r.decision !== 'ok')`.
- **Con seis `tsc --noEmit` a la vez sobre el clon, uno completo pasó los 10 minutos.** Un tsconfig
  en el scratchpad con `extends` del repo y `files` con lo propio contesta lo tuyo en ~80 s.

### Invitar al cliente al curso: la cookie del alumno (06/10/2026, tarde)

> «Al igual que en la vista de Agencia, se debería poder INVITAR al cliente a MaKo para que tenga
> acceso al curso.» (Martín, 06/10/2026)

Cierra el punto 6 del pedido de las 12:38 («un nivel de acceso especial que sólo ellos tienen»),
que la primera pasada había resuelto sólo con el link firmado. El invitado entra a `/mi-curso` con
una cookie PROPIA, `mako_alumno` (`al1.<ws>.<lead>.<version>.<exp>.<firma>`, 30 días), por el link
del mail o entrando con Google con el email al que se lo invitó. `/mi-curso` dibuja exactamente lo
mismo que `/compartido/curso/<token>`: la cookie se traduce al token `c1.` de esa misma (ws, lead,
versión), así que no hay una segunda credencial que revocar.

**Vive en:** `lib/alumno-sesion.ts` · `lib/alumno-acceso.ts` · `app/mi-curso/` ·
`app/api/compartido/curso/entrar/route.ts` · la rama `decidirRutaAlumno` de `proxy.ts` y
`lib/rutas-publicas.ts` · `app/api/auth/callback/google/route.ts` ·
`app/customer-success/curso/InvitarAlCurso.tsx` · `supabase/migrations/0206_curso_invitacion.sql`
(**aplicada a prod**, medido el 06/10 18:05; 0 invitaciones enviadas a esa hora).

⚠️ **EL ALUMNO NUNCA RECIBE `mako_session` NI UNA FILA EN `usuarios`, y no es prudencia: está
medido.** Para el proxy una sesión válida pasa por todas las rutas que no son `/admin`,
`requireRolWs` manda un rol desconocido a `/crm`, `getRolWsEfectivo` cae a `'admin'`, y 98 APIs más
las 53 acciones de `app/crm/actions.ts` no miran el rol. **Con una fila en `usuarios`, el alumno
leía el CRM de Mauricio.** Con una cookie que el proxy no toma por sesión, todo lo interno le da
401 o «a /login» POR CONSTRUCCIÓN, sin tener que auditar ruta por ruta.

**Lo que se verificó leyendo el código, antes de commitear una superficie de seguridad que escribió
otra sesión:**

- La firma lleva prefijo propio y se calcula sobre `alumno:<cuerpo>`, así ninguna otra firma de la
  casa (la sesión, la impersonación, la agencia, el `c1.` del link) sirve como ésta. El `exp` va
  FIRMADO —reescribir la cookie no la estira—, compara en tiempo constante y nunca firma con un
  secreto vacío.
- **La firma no alcanza y no se cree**: `resolverAcceso` (versión vigente, no revocado, lead
  `ganado`) corre en CADA pedido, adentro de `runWithWorkspace(ws de la firma)`. Y aísla porque
  `curso_accesos` ya estaba en las tablas de inquilino: si no, `getTenantDb()` sería passthrough.
- **La rama del proxy devuelve temprano, y eso era lo que había que mirar**: una salida antes del
  resto del middleware podría saltearse el borrado del header interno de workspace. No lo saltea
  porque `seguir()` lo borra primero y sólo lo repone con una sesión de admin, que el alumno no
  tiene. La rama es exacta (`/mi-curso/x` no hereda), en positivo y sólo GET/HEAD, así que nada que
  mute pasa sin el chequeo de Origin.
- El callback de Google sólo llega a la rama del alumno para quien NO está en `usuarios` —un
  suspendido incluido: `buscarUsuarioPorEmail` no filtra por estado—, pone sólo la cookie del alumno
  e ignora el `oauth_next`.

⚠️ **Y una que se reporta y NO se tocó: el callback rechaza con `email_verified === false`, o sea
que deja pasar el campo AUSENTE.** Hoy es seguro porque usa el endpoint OIDC
(`openidconnect.googleapis.com/v1/userinfo` con `openid email`), que siempre lo devuelve. Pero es
fail-open, y es PREVIO a este trabajo: es el mismo chequeo del login de cualquier usuario, así que
endurecerlo a `!== true` es cambiar la puerta de todos y no se hace de paso. Si alguien cambia el
endpoint al de v2 (`oauth2/v2/userinfo`, donde el campo se llama `verified_email`), el chequeo deja
de mirar nada y un email no verificado entra como el usuario —o el alumno— que se llame así.

#### ⚠️ El diagnóstico que hice mal: «estos dos hunks son de otra sesión»

Al separar mi trabajo del de las otras tres sesiones, dejé afuera los dos arreglos de
`app/api/admin/agencia/*` porque no hablaban del curso: son del flujo de aprobación de agencias.
**Los delató el worktree aislado**: sin ellos, fallaba un test de MI propio archivo
(`tests/curso-invitar.test.ts`, «los avisos de aprobación de agencia miran `enviado`»). Eran parte
del mismo refactor de `lib/invitaciones.ts`, escritos y guardados juntos.

El arreglo en sí es real: `invitarPorEmail` devuelve SIEMPRE un objeto —también cuando el mail no
salió—, así que `invitacion ? ok : warn` decía «Ya se le mandó el acceso» sobre un mail que nunca
existió.

**La regla: antes de declarar ajeno un hunk, grepeá qué TEST lo nombra.** El tema del hunk dice de
qué habla; el test que lo cuida dice a qué unidad de trabajo pertenece, que es lo que decide en qué
commit va. Y la forma de que salga sola es verificar el conjunto en un worktree limpio con SÓLO lo
tuyo: lo que falte, falla.

#### ⚠️ Una extracción que se anuncia montada y no la monta nadie

`app/_cursos/` (`CursoUgc.tsx`, `reglas.ts`, `tipos.ts`) es el dibujo de un curso extraído para que
lo compartan tres pantallas, y su cabecera lo dice con nombres: `app/conocimientos/CursoReplica.tsx`,
el portal del alumno y la vista de Mauricio. **Tiene CERO `import` reales.** La única mención fuera
de la carpeta es un COMENTARIO en `app/conocimientos/posicion.ts`, que además le agrega un campo
`extra` que queda inerte.

**No se commiteó.** Nada de lo demás depende de ella (el worktree aislado compila y pasa sin la
carpeta), y commitearla habría dejado en el repo un módulo con una cabecera que miente sobre quién
lo usa. Queda en el árbol, sin trackear, para quien termine el enchufe — que toca `/conocimientos`,
o sea cursos con alumnos de verdad.

Es «escribir la salida no es ofrecerla» (AGENTS.md) con una vuelta más: **una cabecera que ENUMERA
sus consumidores se lee como evidencia de que existen.** Se cuentan los `import`, nunca la prosa.

#### Trampas chicas que quedaron medidas

- **El índice de la 0206 no lo usa la consulta que existe para él.** Es sobre `lower(email)` y el
  callback busca con `.eq('email', e)`, que no lo matchea. No es un bug —la columna se guarda en
  minúsculas (`marcarInvitacion` es el único que la escribe), así que la igualdad acierta— y la
  tabla tiene una fila por cliente. Si crece, va `.eq` contra la expresión o un índice sobre la
  columna pelada.
- **El link de entrada admite un login-CSRF de bajo impacto**: un sitio ajeno puede disparar el GET
  con el token de OTRO alumno y dejarle esa cookie a la víctima. No cruza datos entre negocios —la
  víctima vería el curso del otro, no al revés, y hace falta un token válido— y es el mismo modelo
  de cualquier link mágico. Anotado, no arreglado.
- **`tests/dev-areas.test.ts` falla en cualquier clon nuevo o worktree**: un área declara en su
  `vive[]` el archivo `.claude/settings.local.json`, que es LOCAL y no se versiona. En el clon de
  siempre pasa porque el archivo está; en un worktree, falla. Es una guarda que contesta sobre el
  disco y no sobre lo que se publica (la familia que AGENTS.md ya tiene escrita). No es de esta
  área: vive en `app/admin/dev/areas.ts`.

### Sin hacer

- **Compare-and-set en `moverClienteDeEtapa`** (`lib/cs-mover-etapa.ts`): si el cliente manda las
  dos últimas tareas en el mismo segundo (dos pestañas), los dos envíos ven la etapa completa y los
  dos contestan `cambio: true` — sale dos veces el mensaje de la etapa nueva y dos líneas de
  historial (la fila queda bien). Se dejó porque cuatro tests fijan la FORMA del upsert de ese
  choke point y el caso es raro; el arreglo es `update … where etapa = desde` + `upsert` con
  `ignoreDuplicates`.
- **Con el envío apagado, Mauricio recibe igual el aviso** de cada llamada («No le escribí: envío de
  WhatsApp apagado», con dedup de 72 h por sesión). Si después se prende, el dedup se come el aviso
  corregido.
- **Una sesión marcada que no salió por algo arreglable (sin teléfono, línea caída) no se
  reintenta**: es a propósito, para no mandar dos veces; queda en `aviso_motivo`.
- **Lo que Mauricio pidió el 8/9 después de cada junta («los compromisos de la junta» sacados del
  Fathom) no está**: el posterior manda las tareas que le quedan en su etapa.
- El onboarding de la tab Curso (regla de la casa), la limpieza de videos huérfanos del bucket
  (subidas abandonadas cerrando la pestaña), y la sincronización de las llamadas con Calendly.
- Las actions de `app/customer-success/actions.ts` preguntan el workspace del cliente pero no la
  CAPA (el `requireCapa` vive en la página, y una server action es un POST que no pasa por ella).
  Las del curso sí la preguntan.
- Lo que MaKo puede leer del curso por WhatsApp o la API (el avance de un cliente) no está declarado
  en el registro de `lib/api-mako/areas/`.
- Whop: quedan en la base 4 credenciales (ws1 y ws4) y una fila de `webhook_routing` del ws1, y las
  `WHOP_*` en `.env.local`, inertes. En el tablero del super admin, las #659 y #660 (Whop) siguen
  abiertas: van por propuesta. Y el panel de `/admin/dev/customer-success` (roadmap-cs) todavía
  dibuja Whop como pieza viva.
- **Nadie fue invitado todavía** (0 invitaciones el 06/10 18:05), y el mail sale por Resend y NO
  depende de `envio_whatsapp_enabled`: invitar a un cliente de Mauricio le llega aunque el WhatsApp
  del ws1 siga apagado. No se probó de punta a punta con un email real.
- **`app/_cursos/` está sin enchufar** (ver arriba): termina de enchufarse o se borra. Lo decide
  quien retome `/conocimientos`, porque es la pantalla con alumnos reales que más cambia.
- **`email_verified === false` en el callback de Google** (ver arriba): endurecerlo a `!== true`
  es una línea y toca el login de todos.

---

### «Ya se le mandó el acceso» sobre un mail que no salió (06/10/2026)

**Síntoma:** al aprobar la cuenta de un cliente nuevo (`app/api/admin/agencia/route.ts`) o al
crear a alguien desde una agencia (`app/api/admin/agencia/altas/route.ts`), la pantalla decía
«Se le mandó el acceso» aunque el mail NO hubiera salido — remitente de prueba, Resend que
rechaza, dirección inválida.

**Causa:** `invitarPorEmail` devuelve **SIEMPRE un objeto** (`{ enviado, error }`), también
cuando falla. Las dos rutas decidían el cartel con `inv ? ok : warn`, o sea con la
existencia del resultado, que es verdad siempre. El caso verde y el rojo eran la misma rama.

**Vive en:** `app/api/admin/agencia/route.ts` · `app/api/admin/agencia/altas/route.ts` ·
`lib/invitaciones.ts` (el contrato del retorno). Guard en `tests/curso-invitar.test.ts`
(«los avisos de aprobación de agencia miran `enviado`»), que busca sobre el texto SIN
comentarios y distingue el `?` de un ternario del `?.` del encadenado opcional.

**La regla:** cuando una función devuelve un objeto con el veredicto adentro, el veredicto
es un CAMPO (`.enviado`, `.ok`), nunca la truthiness del objeto. Es «`res.ok` no es salió
bien» (AGENTS.md) del lado de nuestras propias funciones — y es el peor lugar para un verde
falso: le dice al dueño que el cliente ya tiene su acceso, así que nadie lo reenvía y el
cliente se queda sin entrar sin que nada lo diga.

Ahora el aviso dice además POR QUÉ no salió (`inv.error`), y manda a reenviarlo desde el
equipo. Entró en `c0e2570b` junto con el curso, porque el test que lo cuida vive en el
archivo de la invitación al curso: se separó mal al principio y lo delató el worktree
limpio (ver «Invitar al cliente al curso», más arriba).

---

## El cierre del proyecto: 12 tareas auditadas contra HEAD y lo que salió (06/10/2026, noche)

Pedido de Martín: «Revisa todo lo que falta en el proyecto de Customer Success y terminalo
todo, cierra las tareas». Siete lectores, con refutación, contra HEAD (`d8f8ee81`): de las 12
tareas abiertas **ninguna estaba hecha** y la única que un auditor dio por «sin objeto» la
tumbó el refutador. Siete grupos implementaron en paralelo, cada uno con su revisor
(`54e31272`, `ab81f03f`; migs 0208-0210 aplicadas antes del deploy).

### Una lectura que cae al default sirve para DIBUJAR, nunca para DECIDIR

**Síntoma:** una clienta del ws1 (lead 21) quedó en «onboarding», una etapa que su producto,
con nueve etapas declaradas, no tiene. El kanban no la dibuja y no hubo ningún error.

**El diagnóstico obvio era el equivocado:** «alguien borró la etapa en el editor». La causa
probable es otra: `entregaDeProducto` devuelve las etapas de FÁBRICA (onboarding, arranque…)
cuando la lectura de `producto_entrega` falla — correcto para que el tablero se dibuje — y
`moverClienteDeEtapa` validaba la etapa destino contra ese default inventado y la escribía.

**Vive en:** `lib/entrega-servicio.ts` (`entregaDeProductoEstricta`, `entregasDeProductos({ estricto })`) ·
`lib/cs-mover-etapa.ts`.

**La regla:** que no haya fila SÍ es el default legítimo; que la lectura falle NO lo es. Para
validar antes de escribir, y para decidir a quién se le escribe (la cohorte de una secuencia),
va la versión estricta, que devuelve `null` o tira — y entonces no se escribe. Y «etapa
borrada» sólo se afirma con el catálogo LEÍDO: con la lectura caída, cualquier clave
declarada parece ausente frente a las de fábrica. Lo que ve el alumno (la primera etapa) y lo
que ve el equipo («Etapa borrada») son dos CAMPOS de una misma función, no dos reglas.

### Un valor de estado que codificaba una categoría sin decirlo

**Síntoma (evitado):** al dejar una sesión de entrega analizada con `status='analizada'`,
cuatro lectores iban a cambiar de comportamiento sin fallar: la ficha del CRM y el resumen por
WhatsApp habrían mostrado sesiones de entrega como llamadas de venta vacías, el Insight 360
habría pasado su gate «al menos una analizada» sin sustancia, y la cola que PAGA el análisis
de un lead lo habría sacado.

**Causa:** hasta #107 sólo las ventas escribían `analizada`, así que esos lectores filtraban
por status dando por hecho «venta».

**Vive en:** `lib/insights-llamada.ts` · `lib/lead-insights.ts` · `app/crm/actions.ts` (ahora
con `.eq('category','venta')`); el barrido en `tests/closing-entrega.test.ts`.

**La regla:** antes de reusar un valor de un campo para un caso nuevo, grepeá quién lo lee y
qué AFIRMA hoy ese valor.

### Un fallo de un análisis GRATIS no puede ir a `status='error'`

`syncClosingCalls` re-analiza las filas en `error` con Sonnet PAGO (`lib/closing.ts`), así que
un 429 de Gemini en una sesión de entrega se convertía en una factura. El fallo va a la
columna `error` y el status queda `descartada`. Y los fallos tienen dos dueños: los de la
SESIÓN (404 = grabación borrada, transcript vacío, JSON imposible) gastan un intento y la
corrida sigue; los del PROVEEDOR (cuota, key, red) no gastan intento y cortan la corrida — si
no, el día que se cae Gemini la cartera entera queda afuera para siempre.
**Vive en:** `lib/closing-entrega.ts` · `lib/closing-entrega-contrato.ts`.

Y un trabajo gratis no se cuelga de un cron cuyo guard es la key de un proveedor pago:
`closing-sync` saltea el workspace entero sin key de Anthropic. Va en su propio cron
(`/api/cron/cs-sesiones-entrega`). La cita que devuelve el modelo se busca en el transcript
(`verificarCitas`): si no está, `cita: ''` y el riesgo vale pero la cita NO se dibuja — un
modelo parafrasea aunque se le pida la frase textual.

Sin hacer: `closing_analyses.model` queda NULL en el camino barato porque `chatClaude` llama a
`onUsage` sólo en el de Anthropic (`lib/anthropic.ts`); y `closing.ts` escribe la constante
`claude-sonnet-5` aunque la feature esté ruteada a Gemini. No hay tope TOTAL por llamada en
`chatCheapCascade` ni AbortSignal en `fathomGet` (`lib/fathom-api.ts`).

### Una columna que sólo lee una pantalla interna se lee APARTE del select compartido

`COLUMNAS_CLASE` (`lib/curso-datos.ts`) la leen el portal del alumno, la ficha, el cron y el
paso automático. Con `grabar` adentro, una migración aplicada tarde tumbaba el portal de cada
cliente de Mauricio con un 500 (una columna inexistente rechaza el select entero). Se lee
aparte (`grabarDeProductos`) y un test fija que `COLUMNAS_CLASE` no la nombra.

Y si un componente compara una prop por identidad para resincronizar
(`if (base !== prop) setBase(prop)`), su default es una constante del módulo: un `= {}` en la
firma es un objeto nuevo por render y el setState durante el render no termina nunca
(`SIN_MARCAS` en `app/customer-success/curso/CursoApp.tsx`).

### Purgar Storage: «fail-closed» no alcanza con mirar si la lectura falló

Una lectura de referencias que vuelve VACÍA sin error (filtro roto, tabla renombrada) es
indistinguible de «nadie usa nada». Las cinco reglas de `lib/curso-purga.ts`: lectura caída
= no borrar; lectura vacía con archivos en el bucket = no borrar; listar el bucket ANTES de
leer las filas; volver a preguntar por cada lote justo antes del `remove`; y leer las filas de
TODOS los workspaces (el bucket es uno). Arranca en modo prueba y borra sólo con la variable
prendida. Para documentos, el MIME sale primero de la EXTENSIÓN (Windows con Excel le pone
`application/vnd.ms-excel` a un `.csv`), al revés que en los videos.

### Una escritura decidida por una lectura previa va con compare-and-set

Dos movimientos del mismo cliente casi a la vez (dos pestañas, o el alumno mandando las dos
últimas tareas en el mismo segundo) contestaban los dos `cambio:true`: dos líneas de
historial y **dos WhatsApp** de la etapa nueva. Ahora: con fila previa,
`update().eq(id).eq('etapa', leida).select('id')`; sin fila, `upsert` con `ignoreDuplicates`
y `.select('id')`. Cero filas = se perdió la carrera, y se sale ANTES del historial y de
cualquier efecto. Las dos formas pasan por el proxy de `getTenantDb`. Y el choke point firma
con la persona (`autorActual()`), no «CRM»; el curso sigue firmando MaKo.

### `requireCapa` en la página no protege a las server actions

Las 16 actions de `app/customer-success/actions.ts` sólo miraban que el lead fuera del
workspace: un workspace con capa `pm` las usaba con un POST. Ahora la primera línea de cada
export es `puedeUsarCs()` (`app/customer-success/puerta.ts`, server-only y SIN `'use server'`:
con la directiva sería un endpoint más). El guard recorre los exports con el compilador, no
con una lista a mano.

### Las cohortes y MaKo: el UNIVERSO, y el tablero por CAPA

- Una secuencia colgada de la primera etapa de entrega no le llegaba a 13 de los 14 clientes
  del ws1: la cohorte leía FILAS de `cliente_entrega` y el kanban deriva «sin fila = primera
  etapa». Toda pregunta «quién está en la etapa X» pasa por `clientesEnEtapa` con el universo
  de ganados (`app/customer-success/pertenencia.ts`), y deja afuera a los dados de baja o
  graduados (`cs_clientes.estado`): «ganado» habla de la VENTA y el estado del PROGRAMA.
- `conTrabajo` no tenía call site y tres comentarios decían «lo enchufa la página»: la página
  no lee `cartera()` desde el 26/09, el único lector es MaKo (`lib/api-mako/areas/cs.run.ts`).
- Trampa evitada: `tableroDeLaCartera` sin `forzado` elige el tablero por SESIÓN; por WhatsApp
  no hay sesión, cae a `experimento_tareas`, y el super-admin habría leído «0 atrasadas» para
  todos. Desde la API de MaKo el tablero se elige por CAPA.

### Los avisos de la sesión: el resultado en la clave, y lo que se sabe sin mandar, antes

El aviso «no le llegó, envío apagado» se comía por 72 h al corregido (la `dedupKey` no llevaba
el resultado), y una sesión «sin teléfono» quedaba cerrada para siempre: `destinoDe` se
evaluaba DESPUÉS del compare-and-set. Lo que se sabe sin mandar se evalúa antes de marcar; lo
que falla después de mandar no se reintenta. Y la junta se marca APARTE del posterior
(`curso_sesiones.aviso_junta_at`, 0210): la grabación de una sesión llega a `closing_analyses`
sólo por `closing-sync`, horas después, y leída una vez los compromisos no llegaban nunca.
**Vive en:** `lib/curso-mensajes.ts`.

### El ensayo del onboarding no puede escribir datos de un cliente

«Ver el curso como el alumno» desde la ficha CREA la fila de `curso_accesos` y cuenta
ingresos, y el reproductor y la tarea mandan progreso por `sendBeacon`. La vista previa del
equipo (`/customer-success/curso/vista`) arma el portal con las funciones puras y un contexto
que apaga TODA escritura (`app/compartido/curso/[token]/vista-previa.ts`). Un paso del
onboarding derivado de datos se marca en el orden del catálogo y atrapando el error paso por
paso: un dato puede volverse cierto antes que el paso que va antes.

Sin hacer: `resumenOnboardingTabs` (`lib/tab-onboarding-state.ts`) recorre TODO el catálogo
sin filtrar por capa, así que agregar una tab la mete en el system prompt de MaKo de todos los
workspaces.

### Trampas del entorno de esta corrida

- **`next build` NO corre en un worktree con `node_modules` como junction**: Turbopack aborta
  con «Symlink [project]/node_modules is invalid, it points out of the filesystem root»
  (`turbopack.root = __dirname`). Sirve para `tsc` y los tests; el build va en el clon. Y si
  se fuerza, deja OTRO junction en `.next/node_modules/sharp-<hash>`: se saca con
  `cmd /c rmdir` antes de borrar el worktree.
- **Git Bash convierte un argumento que empieza con `/` en una ruta de Windows**:
  `node script.mjs /api/cron/x` llegó como `C:/Program Files/Git/api/cron/x` y el host salió
  «hola-mako.comc». Va `MSYS_NO_PATHCONV=1`.
- El `CRON_SECRET` de `.env.local` no es el de producción: un cron nuevo no se puede disparar
  a mano desde acá; se verifica mirando la base después de su turno.
- Integrando worktrees en un clon con `core.autocrlf`, el checkout es CRLF y un parser de
  marcadores de conflicto que corte en `\n=======` deja un `\n` suelto: se cuenta con node
  antes de commitear.

### Lo que cerró esta tanda de los «Sin hacer» de arriba

La ficha linkeable (`?cliente=`), `catalogoAsignable` muerto, el ✨ encima de la ficha, el CAS,
la firma «CRM», los handlers sin red de `ClientesApp`, la fase en la tabla, el CSV con
contactos, la línea de «Productos eliminados», las secuencias de entrega, el onboarding de la
tab Curso, el avance del curso en la API de MaKo, Whop en el roadmap y los videos huérfanos.

### Lo que quedó SIN hacer

- Otras acciones sin atajar fuera de transición (dejan el botón trabado si no llegan):
  `app/customer-success/NuevoCliente.tsx`, `CuentaDeMaKo.tsx`, `curso/CursoApp.tsx`,
  `curso/EditorClase.tsx`.
- El arrastre de una SELECCIÓN en el kanban con una fase puesta puede mover clientes de
  columnas escondidas (`KanbanEntrega.tsx`, `quienesViajan` recibe la lista entera).
- La tabla Avance de `/customer-success/curso` sigue mostrando la primera etapa para un
  huérfano (`app/customer-success/curso/page.tsx`).
- Notas de una etapa borrada quedan sin pantalla (`curso_clase_notas.etapa` es texto sin FK).
- Una secuencia de entrega en una etapa CON clases le duplica al cliente el mensaje de etapa
  nueva del curso (`lib/curso-avance.ts`): no crear secuencias de entrega en el ws1 sin
  decidirlo.
- Voseo que el guard no caza (homógrafo del pretérito): «Elegí una etapa…» en
  `app/automations/SecuenciaPerfil.tsx` y `lib/setting-secuencias.ts`.

### La segunda tanda: lo que encontró la INTEGRACIÓN, y lo que dejó cada pieza (07/10/2026)

Las cuatro decisiones de Martín (memoria `cs-decisiones-cierre-0610`) en `f6b33ed0`, migs
0211-0213 aplicadas antes del deploy.

#### Dos worktrees correctos por separado, un WhatsApp equivocado juntos

**Síntoma:** ninguno todavía; lo encontró la integración, no un test. El recordatorio de clases
(#780) se escribió sobre un árbol SIN líderes de área, y el link del líder (#665) entró por otro
worktree. Juntos, cinco consultas de `lib/curso-mensajes.ts` a `curso_accesos` filtraban sólo
por `lead_id`: el mapa por cliente quedaba con la fila del LÍDER y «hace 3 días que no entra» se
decidía con sus fechas — para mandarle el WhatsApp al CLIENTE.

**Causa:** desde la 0212 `curso_accesos` tiene una fila del cliente (`area` NULL) y una por cada
líder. La unicidad (ws, lead) era implícita en cada consulta.

**Vive en:** `lib/curso-mensajes.ts` (las cinco, con `.is('area', null)`) · guard
`tests/curso-accesos-area.test.ts`, que barre TODO `app/` y `lib/` y falla con archivo y línea.

**La regla:** al agregar una dimensión al unique de una tabla, se grepean TODOS los
`.from('<tabla>')` del repo, no los del archivo que uno toca. Y si dos worktrees tocan la misma
tabla desde lados distintos, el chequeo que importa es el del conjunto: cada uno, solo, estaba
verde.

#### Cambiar un unique que es target de un `upsert` no deja convivir dos versiones del código

El `onConflict` de la versión desplegada nombra el índice viejo; mantenerlo prohibiría justo las
filas nuevas (una por área). La ventana va escrita en la cabecera de la 0212 y la migración se
aplica pegada al push — acá con `curso_progreso` y `curso_accesos` en cero filas, medido antes.

#### El paso 5 no podía colgar de «la etapa actual» (el diagnóstico obvio era el equivocado)

El link de agenda aparece recién con la etapa COMPLETA, y completarla pasa al cliente a la
siguiente en el acto. Cuando la llamada ocurre, su etapa actual es la NUEVA, vacía; lo que se
habla son las respuestas de la que acaba de cerrar. `etapasDePropuesta` mira la anterior y la
actual (`lib/curso-propuesta.ts`). **Antes de colgar algo de «la etapa actual», preguntá qué
evento la cambia y si ocurre antes del momento que querés mirar.**

Y una regla que cambia el SIGNIFICADO de un estado («la etapa se completa con TODAS las áreas»)
va en la capa que entrega el estado (`progresoEfectivo`, `lib/curso.ts`), no en cada consumidor:
eran seis.

#### Un saliente no es contacto

«Último contacto» y la alerta de baja contaban cualquier WhatsApp, también los AUTOMÁTICOS: con
el envío del ws1 prendido, el recordatorio de clases reiniciaba el reloj del cliente que no
contesta. `wa_mensajes` no distingue autor (y `raw.local` no sobrevive al eco del webhook), así
que contacto = una sesión o un mensaje DEL cliente (`from_me = false`). El costo, declarado: un
WhatsApp que el dueño manda A MANO tampoco cuenta. **Vive en:** `lib/cs-contacto.ts`.

#### Avisos que recorren una lista

- **Una vez por episodio** = la clave es la entidad + el instante que ABRE el episodio
  (`claveRacha`, `lib/cs-contacto.ts`); un TTL corto repite y uno largo con la clave del cliente
  no vuelve a avisar nunca.
- **Con dedup + tope, el tope cuenta envíos**, no entidades miradas: si no, los primeros N ya
  avisados ocupan los N lugares todos los días.
- **Un emisor que itera corta en el primer `apagado`**: `emitirAviso` escribe el feed antes de
  mirar el interruptor y, apagado, no marca el dedup — N filas de feed por corrida, cada día.
- `correrPorWorkspace` es para INGESTA de una integración; un cron sobre datos propios del
  producto recorre `listarWorkspaces` (Customer Success no tiene integración y no corría en
  ningún workspace).

#### Cortar al cliente corta a sus líderes… los que existen al cortar

Lo que nazca o se habilite después necesita que la puerta de lectura vuelva a preguntar por el
padre en cada pedido (`resolverAccesoPortal`, `lib/curso-datos.ts`). Y la separación de
namespaces de un token se prueba contra la credencial con el MISMO número de campos firmados (el
`c2.` comparte la forma con la cookie `al1.`, no con el `c1.`): la rotura contra la más parecida
por nombre daba verde.

#### Trampas chicas que costaron una vuelta

- Un numeral de tarea («#665») adentro de una hoja de estilos en string es un COLOR para el guard
  de `tests/cs-kanban-fases.test.ts`.
- Abrir el link REAL de un cliente para probarlo le cuenta un ingreso y lo mete en el universo
  del recordatorio: el equipo mira con la vista previa (`/customer-success/curso/vista`).
- El encabezado de `lib/curso-mensajes.ts` decía «envío en false desde el 29/09»: un comentario
  que afirma el estado de un interruptor de producción lleva fecha y fuente, y no se usa para
  decidir riesgo — se mide.
- `const ahora = Date.now()` en el cuerpo de un componente: tsc 0 y tests verdes, y error de
  eslint (`react-hooks/purity`), que el pre-push no corre.

#### El análisis de las llamadas de entrega espera a Google

Las dos primeras corridas (02:52 y 03:52 UTC del 07/10) fallaron todas: `gemini-flash-latest`
contesta 503 («high demand») en los tres workspaces y con todas las cuentas, y una sesión del ws1
se cortó por el plazo de 120 s. `plan-fathom` sobrevive porque baja a `flash-lite`; `cs-sesion`
NO baja de modelo a propósito (un modelo peor contesta peor sin que se note), así que espera.
`gemini-2.5-flash` ya no está disponible para cuentas nuevas. El fallo cuenta como del PROVEEDOR
y no gasta el intento de la sesión: entra cuando Google contesta.

#### Lo que quedó SIN hacer

- Marcar en `wa_mensajes` qué envío es automático (migración + los emisores de
  `lib/evolution-envio.ts`): sin eso un WhatsApp manual del dueño no cuenta como contacto, y
  `esperaRespuestaHace` de la cartera de MaKo se confunde con los recordatorios.
- Renombrar un área no migra nada: lo contestado como «Ventas» queda huérfano si el cliente la
  llama «Comercial» (`lib/curso.ts`, `nombreDeArea`). Hace falta un id estable por área.
- `lideresActuales` / `linkDeLiderLeido` firman el link de un líder aunque el cliente esté
  cortado (no abre: lo frena el portal).
- «Copiar link» de la ficha crea el acceso sin dejar rastro: ese cliente queda fuera del
  recordatorio hasta que reciba el link por mail o por MaKo.
- Un cliente pausado SÍ recibe la alerta de baja y NO recibe el recordatorio: dos lecturas de
  «pausado» que decide Martín.

## El portal del alumno y la tab Curso con el diseño de Conocimientos (07/10/2026)

Pedido de Martín, mirando la vista del alumno al lado de un curso de /conocimientos: «No se ve
para nada igual, COPIA lo que ya hicimos en CONOCIMIENTOS», y en el mismo hilo «No solo la vista
de alumnos, la vista del editor también se tiene que ver tal cual». En `70a207df` las dos
pantallas montan `app/_cursos/CursoUgc.tsx`: las ETAPAS son los módulos y las CLASES las
lecciones. Lo que asumía la hoja de Conocimientos y no vale afuera está en
[hallazgos-conocimiento.md](hallazgos-conocimiento.md) → «El dibujo de Conocimientos montado en
OTRAS pantallas».

### Una extracción con cero `import` no estaba hecha: estaba a medias, y su cabecera mentía

`app/_cursos/` llevaba sin commitear desde el 06/10 16:46. Su cabecera decía que la montaban tres
pantallas y no la montaba ninguna; violaba su propia regla (flechas y puntos suspensivos crudos en
el código, cuando la cabecera exigía escaparlos); nombraba un test que no existía; y **11 de las
clases que dibuja no tenían una sola regla en la hoja** (el candado, los controles de edición, el
menú del teléfono, el modo embebido). Se habría visto como un curso «roto» el día que alguien la
montara confiando en la cabecera.

**La regla:** antes de montar una pieza que no escribiste, se cuenta lo que PROMETE contra lo que
EXISTE: cada clase que usa, grepeada en la hoja; cada test que nombra; cada call site que dice
tener. Son tres comandos, y acá dieron 11, 1 y 3 faltantes.

**Vive en:** `app/_cursos/CursoUgc.tsx` · `app/_cursos/estilos.ts` (lo que faltaba) ·
`tests/cursos-ugc.test.ts`.

### Pasar de clase DESMONTA la tarea, y lo escrito volvía como estaba al cargar la página

Encontrado al diseñar, antes de verlo en pantalla. `TareaAlumno` guarda lo escrito en su estado, y
`valoresIniciales` es lo que trajo la PÁGINA. En el acordeón viejo eso ya pasaba al plegar una
clase, pero era raro; en el dibujo nuevo cada clase es una lección y moverse entre ellas es el
camino normal. El borrador SÍ se salvaba (el `sendBeacon` de la limpieza): lo que mentía era la
pantalla al volver.

**Vive en:** `TareaAlumno` → `onValores` (al desmontarse: el borrador si sigue pendiente, lo
ENVIADO si no — lo editado de una tarea enviada sin reenviar no se guardó y no se muestra como su
respuesta) · `PortalAlumno` guarda lo visto, lo mandado, lo escrito y las propuestas resueltas, y
lo vacía cuando llega una vista nueva del server.

**La regla:** cuando un componente pasa de «siempre montado» a «montado por posición», se lista su
estado local y se decide quién lo guarda. El typecheck no ve nada de esto.

### La vista previa va EMBEBIDA; el link del alumno, en modo PÁGINA

El modo página traba el scroll del documento y mide 100vh: debajo de la barra de la vista previa
se cortaba el pie. Embebido, el alto lo da el contenedor —un alto DEFINIDO (`100dvh`) y la cadena
de flex con base 0—. En la tab Curso es igual: la `Pagina` mide la ventana y el curso toma lo que
queda debajo de la cabecera, con un mínimo de 480 px.

⚠️ **El link real del alumno no se abrió en el navegador**: cuenta un ingreso en la ficha de un
cliente de Mauricio. El modo página se verificó forzándolo un momento sobre la vista previa (1440
y 390 de ancho), y se volvió atrás comparando el archivo.

### Dónde quedó cada cosa del portal viejo

| Antes | Ahora |
|---|---|
| «Agenda tu sesión» debajo de cada etapa terminada | arriba del curso la de la ÚLTIMA terminada, y en la cabecera de cada etapa terminada la suya |
| la barra «Etapa 2 de 9» | el pie del buscador (arriba a la derecha) y la cejilla de la portada |
| «Este enlace es personal» al pie | el pie de la barra oscura (en el teléfono no va) |
| la etapa actual abierta | el botón de la portada: la propuesta de la IA, o la tarea pendiente de la etapa actual |
| la pestaña Avance de la tab | una entrada propia de la barra (`#x=avance`); los links con `?vista=avance` la siguen abriendo |
| las notas de etapa en la sección | la cabecera del módulo abierto; las de una clase, una pestaña de la lección |

### Un test de las huérfanas pasó en VERDE con la rotura puesta

Con UNA sola clase huérfana, la primera tampoco sube por posición, así que sacar la regla «las
huérfanas no se ordenan» no cambiaba la respuesta. El fixture lleva dos y se pregunta por la
segunda. Es la regla de la casa (un test se prueba rompiéndolo) cazando su propio caso.

### Lo que quedó SIN hacer

- **Conocimientos sigue con SU copia del DOM** (`app/conocimientos/CursoReplica.tsx`). Mudarla a
  `CursoUgc` cierra «dos componentes para la misma pantalla»; tiene alumnos y links compartidos,
  así que el `key` de cada módulo va por NOMBRE (los `#mod=` que circulan lo llevan).
- **Conocimientos en el teléfono**: la barra de 268 px al lado del contenido. El arreglo de
  `app/_cursos/estilos.ts` sólo vale para `.ahdoc--ugc`.
- ~~«+ Clase» aparece también en «Sin etapa»~~ — resuelto en `5cbaedbb`: ese módulo va con
  `sinEdicion` (sin «+ Clase», sin renombrar y sin portada).
- Las tapas: sólo YouTube y Drive (`tapaDeVideo`, lib/curso.ts). Las 107 clases del ws1 no tienen
  video, así que hoy todas van con el degradé.

## La tab Curso sin barra, el curso personalizable, y links o videos subidos (07/10/2026)

Pedido de Martín, con una captura de la tab Curso ya con el diseño de Conocimientos:
«1. Elimina la barra de arriba, que no aparezca absolutamente nada... Ni el titulo. Y si quiero
cambiar, el desplegable debería ser "Negocio que Escala" de la sidebar, que tiene parte en verde.
2. Permite personalizar cosas, como colores (el verde), las portadas, los titulos solo con darle
click etc... 3. También te consulto si es mejor directamente aceptar links como clases, porque si
debemos aceptar subir clases pesadas, no se que tanto afectaría al almacenamiento».

Lo que gobierna el CSS y el DOM del dibujo (la variable que declara `.ugc`, los tintes con el lima
escrito a mano, el alto con la barra de agencia, el foco de un menú oculto) está en
[hallazgos-conocimiento.md](hallazgos-conocimiento.md) → «El dibujo de Conocimientos montado en
OTRAS pantallas» → «Y al teñirlo y editarlo».

### Lo que se decidió, y por qué no es lo obvio

- **El estilo es clave/valor, una fila por ajuste** (`curso_estilo`, mig 0214). Con una fila por
  producto y N columnas, dos personas cambiando dos portadas a la vez se pisaban: el guardado de
  la segunda devolvía la portada vieja de la primera. Volver al default es BORRAR la fila.
- **El título del curso NO renombra el producto del CRM.** El producto vive en ofertas, embudos y
  el CRM; renombrarlo desde un clic en la portada del curso cambiaba cosas que esta pantalla no
  muestra. Es un ajuste propio (`titulo`), con el nombre del producto como default.
- **El nombre de una etapa SÍ renombra la columna del kanban**: es la misma cosa (el curso cuelga
  de las etapas de la entrega). Va por `guardarEtapasEntrega` con la lectura ESTRICTA y las fases
  que ya tenía: la lista se escribe entera, y con la lectura que cae al default se borrarían las
  etapas reales; sin las fases, su color. Verificado contra el ws1: renombrar y volver dejó
  `producto_entrega` idéntico byte a byte.
- **El color es una regla, no un aviso**: el acento es FONDO de texto oscuro («Empezar», la etapa
  marcada, el número de cada tarjeta). Uno que no llega a contraste 4.5 con la tinta se aclara
  hacia el blanco hasta que llega (`acentoLegible`). Y lo que se LEE también se sanea: un color o
  una portada guardados antes de la regla no llegan al navegador del alumno.
- **Las portadas usan el selector que ya existía** (`PortadaPicker`: degradados, fotos, subir), con
  el mismo formato de valor (`lib/portadas.ts`) y sin la muestra «Automático» (`sinAutomatico`),
  que en el tablero significa «el color derivado del nombre» y acá no significaba nada. Un segundo
  selector para lo mismo es el que se queda viejo.
- **El selector de cursos es el desplegable de la marca**, como pidió: lista los cursos, el color y
  «Vista del alumno». En el portal del alumno aparece sólo si tiene más de un curso.

**Vive en:** `lib/curso-estilo.ts` (puro: saneo, contraste, tintes) · `lib/curso-estilo-datos.ts`
(lectura y escritura) · `app/customer-success/curso/actions.ts` (`guardarEstiloCursoAction`,
`renombrarClaseAction`, `renombrarEtapaCursoAction`) · `app/customer-success/curso/CursoApp.tsx`.

### La revisión adversarial: 22 hallazgos, y los que enseñan

1. **Una etapa que se llame «Constructor» tiraba el portal entero de ese producto.** Los mapas de
   portadas son objetos comunes —tienen que serlo: RSC no serializa objetos sin prototipo— y
   `mapa['constructor']` devuelve la función `Object`; el `startsWith` de la portada tiraba. Y
   `__proto__` como key le cambiaba el prototipo al mapa en vez de guardar una portada. **La
   regla:** un mapa keyeado por texto que escribe una persona se lee con `hasOwnProperty`, nunca
   `mapa[key]`. **Vive en:** `lib/curso-estilo.ts` (`propia`, `KEY_ETAPA`).
2. **Cinco guards de este mismo trabajo daban VERDE sobre su propio bug**: miraban la portada del
   modo lectura (la que no se edita), un fixture sin el caso, el archivo con los comentarios que
   nombran lo que se sacó, y el CSS sin las reglas de adentro de un `@media` (el parser sólo veía
   el primer nivel). Cada uno, re-probado rompiéndolo: 32 / 1 sobre los dos archivos. La lista de
   roturas está en la cabecera de `tests/curso-estilo.test.ts`.
3. **El color volvía al de PANTALLA, no al confirmado.** Probar un color tiene un respiro de 450
   ms; si el guardado fallaba, se volvía a lo que estaba dibujado —que podía ser otro color todavía
   sin confirmar— y un color elegido justo después del respiro podía quedar pisado por el
   pendiente. Ahora hay un registro de lo que el server confirmó y cada guardado cancela el
   pendiente. **Vive en:** `CursoApp.tsx` (`confirmados`, `timerAcento`).
4. **El portal le mandaba al alumno las portadas de TODAS las clases**, incluidas las que no ve
   (`soloDeClases` deja sólo las de las clases que viajan). Y borrar una clase dejaba su portada
   huérfana: `borrarClase` ahora la borra.
5. **Dos topes para el mismo nombre**: el curso dejaba 60 caracteres en una etapa y el editor del
   kanban 40. Ahora es `TOPE_NOMBRE_ETAPA` (`lib/servicio-etapas.ts`), uno.

### Lo verificado, y cómo se dejó el ws1

En el navegador sobre el ws1 (dev-login local): sin barra, el menú de la marca con el teclado, el
color en todo (incluidas las láminas), la portada con degradado, título y descripción con un clic,
la vista del alumno con el estilo, renombrar una etapa y una clase y volver, 390 de ancho, y la
barra de agencia de 114 px. Al terminar, todo revertido POR LA PANTALLA y comparado con una foto
previa: `producto_entrega` igual, las clases iguales y `curso_estilo` vacío. El link real del
alumno sigue sin abrirse (cuenta un ingreso en la ficha de un cliente de Mauricio).

### Links o videos subidos: lo medido (pregunta 3)

Medido el 07/10/2026 en la base: **0 videos subidos** (`curso-videos` vacío), las 107 clases del
ws1 sin video, y **2,28 GB** en todo Storage. O sea que la decisión se puede tomar sin migrar nada.

Lo que encontró la investigación (fuentes oficiales consultadas el 07/10/2026):

- **YouTube prohíbe, en sus políticas para desarrolladores (III.F.3, actualizadas el 14/09/2026),
  cobrar por ver contenido en un reproductor embebido** — y el portal usa su IFrame API para medir
  el % visto. Además puede poner publicidad y el link no listado se reenvía. ⚠️ Es el diagnóstico
  obvio el equivocado: «YouTube no listado es gratis y se mide» es cierto técnicamente y es justo
  lo que sus términos no permiten para un curso pago.
- **Vimeo Starter (US$12/mes por asiento, pago anual)**: privacidad por dominio, sin publicidad,
  2 TB de ancho de banda al mes, y `player.js` da `timeupdate` (se mide igual que hoy). El plan
  gratis no deja embeber.
- **Drive**: no se puede medir lo visto, ya se vio que sirve 1080p en 360p (memoria del 13/08) y
  puede bloquear el archivo por «demasiadas vistas» sin umbral público.
- **Subir a Supabase**: Pro trae 100 GB de Storage y 250 GB de egress sin caché por mes (después
  US$0,0213/GB-mes y US$0,09/GB). No hay streaming adaptativo: se baja el archivo entero a una
  calidad. Una clase real de este proyecto pesa ~26 MB/min (medido con ffprobe): el curso del ws1
  (356 min) serían ~9 GB guardados y ~9 GB de egress POR ALUMNO que lo vea entero; 250 GB alcanzan
  para unas 160 horas vistas por mes. ⚠️ **Dos trampas**: el tope de gasto viene prendido en Pro y,
  pasada la cuota, el servicio se CORTA (los videos dejan de verse); y el CDN cachea por URL, así
  que una URL firmada nueva en cada vista —lo que hace hoy `/api/compartido/curso/video`— nunca
  acierta la caché y todo se cobra como egress sin caché.

**La recomendación que se le hizo a Martín**: links como camino principal, con Vimeo como la
plataforma sugerida para un curso pago; la subida queda como respaldo. Lo decide él.

### Lo que quedó SIN hacer

- La decisión de la pregunta 3 y lo que siga de ella en el editor de la clase
  (app/customer-success/curso/EditorClase.tsx): hoy ofrece link y subida por igual.
- Si la subida se queda: firmar UNA URL por video y por un rato largo (no una por vista), para
  que el CDN la cachee (`app/api/compartido/curso/video/route.ts`).
- `lib/reset-workspace.ts` no vacía el bucket `curso-videos` (sí `curso-notas`): resetear el
  Cliente de Prueba dejaría sus videos. Hoy el bucket está vacío.
- Si el título del curso tendría que renombrar también el producto: hoy NO, a propósito (arriba).
  Si Martín lo quiere, es un cambio de una línea en `guardarTexto` y una pregunta de producto.

## El curso tipo Skool, tanda 1 (07-08/10/2026)

Pedido de Martín del 07/10/2026: 19 puntos, literales en la bitácora de
`/admin/dev/customer-success` (hito «El curso tipo Skool: 19 pedidos»). Las decisiones y los
contratos entre piezas, en [diseno-curso-skool.md](diseno-curso-skool.md). La tanda 1 son las
piezas que no dependían de otras —comunidad, tipos de tarea, invitar y permisos, editor rico,
portadas diseñadas y recorrido—: seis pistas en paralelo, cada una con su revisión adversarial,
integradas en `1080f74c` (migs 0216-0219 APLICADAS). **Las revisiones corrigieron a los informes
originales en las seis pistas**; lo de abajo es lo que quedó en pie. Lo del entorno (el
typecheck sin memoria, el guard que corta en el `;`, el merge con intent-to-add, escribir un
escape) está en [hallazgos-infra.md](hallazgos-infra.md); la sidebar corrida, en
[hallazgos-conocimiento.md](hallazgos-conocimiento.md) → «El dibujo de Conocimientos montado en
OTRAS pantallas», punto 11.

### Lo que el relevo de Skool dejó medido para los bloqueos (tanda 2)

- **El drip de Skool cuenta desde que la persona entró al GRUPO**, no desde que se le abrió el
  curso: quien entra el día 0 y compra el día 30 ve abiertas las páginas de 7 y 14 días. Por eso
  el bloqueo `dias` (D2) cuenta desde que se le abrió el curso a ESE alumno.
- ⚠️ **Skool NO tiene desbloqueo por completado** («terminó la clase», «aprobó el quiz»,
  «entregó la tarea»): sólo nivel, tiempo, compra, plan o a mano. El diagnóstico obvio —«copiemos
  lo que Skool ya resuelve»— es el equivocado para el item 8: lo que pidió Martín va más allá de
  Skool, y el molde está en Kajabi, Teachable y Thinkific. Skool tampoco tiene quizzes, tareas ni
  certificados.

El relevo entero (72 fuentes fechadas) quedó en el scratchpad de la sesión `7a6bc4be`, no en el
repo; lo que sirve para decidir está en D2 y D8 del diseño.

### Invitar, permisos y el link mágico (items 9 y 4)

1. **Los permisos se guardaban y el portal no los aplicaba.** `moduloPermitido` tenía su test y la
   ficha lo usaba para DIBUJAR; `armarVistaAlumno` y `claseDelAlumno` no recibían el alcance, así
   que el alumno seguía abriendo lo que la ficha decía cerrado. Lo cazó la revisión (el informe lo
   dejaba como «integración pendiente» de otra pista): **una función con su test puede tener la
   línea que la enchufa sin ninguno.** Quedó en la ÚNICA puerta del portal, con un orden que no
   es el obvio: `armarVistaAlumno` arma con la lista ENTERA de etapas de la entrega y filtra
   DESPUÉS, porque el estado de cada etapa (hecha, actual, por venir) sale de su POSICIÓN — filtrar
   antes corre las posiciones. `claseDelAlumno` contesta `no-existe` (no «bloqueada»: lo no
   permitido no viaja) y las cinco rutas del alumno lo heredan pasando `alcance`.
   **Vive en:** `lib/curso-portal.ts` · `lib/curso-alcance.ts`.
2. **Validar el alcance ENTERO puede ABRIR permisos.** Guardar los módulos de un producto validaba
   los de TODOS contra los que hoy tienen curso: si otro producto restringido se quedaba un rato
   sin clases, tocar éste le borraba la restricción, y sin restricción el alumno ve todo. Y decidía
   qué módulos existen con la lectura que cae a las etapas de fábrica. Se valida sólo lo que cambia
   (`cambiarModulos`, puro) y con la lectura estricta. La forma del dato: lista vacía = NINGÚN
   módulo; «todos» = sacar la entrada del producto; y se lee con `hasOwnProperty`, nunca con `in`.
   **Vive en:** `lib/curso-alcance.ts` · `app/customer-success/curso-ficha-actions.ts`.
3. **Un cliente creado desde el editor de OTRO producto nacía con el principal como casa** (el
   alta del CRM lo pone en el embudo principal), y la invitación (`productosDelAlumno`) le abría
   entero el curso principal, que no compró. Si la action lo hizo cliente, se lo saca de los otros
   productos; si no se puede, no se lo invita y la pantalla lo dice. ⚠️ El «Nuevo cliente» de la
   cartera hace lo mismo desde antes y no se tocó. **Vive en:**
   `app/customer-success/curso/invitar-actions.ts`.
4. **Un link de un solo uso que se gasta con un GET lo quema el escáner del correo** antes que la
   persona. El link del mail lleva a `/login?entrar=…`, que dibuja un botón; lo gasta el POST.
   Y pedir el link contesta SIEMPRE lo mismo y busca después (`after`): ni el texto ni el tiempo
   dicen si el email existe. El alumno sigue sin fila en `usuarios`. **Vive en:**
   `app/api/alumno/link/route.ts` · `app/api/alumno/entrar/route.ts` · `lib/alumno-sesion.ts`.
5. **Tres caminos pasan un lead a Ganado, y dos disparos mandaban dos mails**: la invitación
   RECLAMA la fila antes de mandar (`invitando_at`, compare-and-set), y `ok:true` con
   `enviado:false` siempre trae su motivo. **Vive en:** `lib/curso-invitar.ts`
   (`invitarAlCursoSinSesion`, la que llama el CRM). ⚠️ **No se cosecha** lo que afirmaba el
   informe original («`getCapaActual` está cacheada por request: en un cron contesta la capa del
   primero para todos»): no se midió, y según React `cache` vive dentro de un render o una acción.
6. **El `dragstart` lo dispara el nodo ARRASTRABLE, no el hijo donde se apretó.** El
   `onDragStart` que frenaba el arrastre desde el menú «Acciones» de la tarjeta no corría nunca,
   y el test fijaba ese código muerto. El envoltorio anota dónde se apretó
   (`onPointerDownCapture`) y `agarrar` corta si nació en algo `data-nodrag`. Sin probar en el
   navegador. **Vive en:** `app/customer-success/KanbanEntrega.tsx`.

Y dos chicas: `.ia-mal` chocaba entre dos hojas (`InvitarAlumnos` pasó a `.ina-`), y pasarle un
`id` a `TextField` (`app/_ui`) desconecta su rótulo.

### Tipos de tarea (item 18)

- **La nota del quiz va en una COLUMNA** (`curso_progreso.calificacion`, mig 0218), no en
  `valores`: cada autoguardado del navegador pisa `valores`, y lo que escribe el navegador no
  puede decidir una nota. Se corrige en el server y las correctas no viajan (`camposParaAlumno`).
- **Las correctas se marcan por TEXTO, no por posición**: el saneo tira los renglones vacíos y un
  índice queda apuntando a otra opción. ⚠️ Las RESPUESTAS del alumno siguen por posición
  (`string[][]`): si el equipo borra una pregunta ya contestada, se corren, y un Sí/No se
  califica en la pregunta equivocada sin que nadie lo note.
- **Una ruta pública que firma subidas sin tope por persona es un ataque a todo el Storage.** El
  token del portal firmaba 30 subidas por minuto de hasta 100 MB, y la URL firmada no hace cumplir
  el tamaño que declara el navegador: ~3 GB por minuto contra el tope de 5 GiB que el código
  declara para TODA la plataforma. Con un link filtrado, en dos minutos se cortaban las subidas de
  todos los clientes. Ahora: 40 subidas y 500 MiB por alumno en 24 h contando el peor caso del
  próximo archivo (un objeto sin fecha cuenta como de hoy), si no puede listar no firma, y 12
  firmas por minuto. ⚠️ **Contar lo que hay en el bucket no ve las firmas pedidas que todavía no
  subieron nada**: queda una ráfaga posible (~1,2 GB por minuto por instancia; el rate limit no es
  compartido). ⚠️ Y «5 GiB» es lo que dicen los comentarios de `lib/curso-admin.ts`; la entrada de
  arriba («Links o videos subidos») mide 100 GB incluidos en Pro. Cuál es el tope real no está
  medido. **Vive en:** `lib/curso.ts` (`topeDeSubidasAlcanzado`) · `lib/curso-entregas.ts` ·
  `app/api/compartido/curso/entrega/route.ts`.
- **`validarPropuesta` era todo-o-nada**: con un campo de un tipo nuevo, `formaDeCampo` devolvía
  null y se rechazaba la propuesta ENTERA — o sea que sumar un tipo de campo apagaba en silencio
  las propuestas de la IA (el paso 5) de toda tarea que lo tuviera. Ahora hay una lista en
  positivo de lo que se puede proponer (`PROPONIBLES`) y lo demás se ignora; tampoco viajan al
  modelo las respuestas del quiz ni los paths. ⚠️ El informe original decía que las correctas
  llegaban al proveedor de IA: era falso (`formularioDe` no manda `preguntas`). **Vive en:**
  `lib/curso-propuesta.ts`.
- `storage.exists` devuelve `false` sólo ante un 400/404 y tira ante cualquier otra falla: «no
  pude preguntar» no es «no está». Un link inválido cuenta como vacío también en la PANTALLA, o el
  envío vuelve con «faltan respuestas». Un `<style>` adentro de un `<dl>` es anidamiento inválido
  y React lo marca al hidratar. Y borrar `conQuizzesAprobadosIntactos` de la ruta daba 22/0: tenía
  test la función, no la línea que la llama.

### Comunidad (item 10)

1. **Doce regresiones de una línea pasaban en verde** (0 fallos, 89 pases cada una). La red
   exigía «el permiso antes de la escritura», y eso no protege QUÉ FILAS toca: sin el
   `.eq('id', …)`, editar o borrar un post tocaba todos los del producto; lo mismo cerrar
   comentarios, sacar a un alumno «con su contenido», quitar un like o dejar de seguir. Más
   `perfilDe` sin chequear que sea miembro (el nombre y la foto de cualquier lead del CRM),
   menciones a cualquiera, `descartarAdjunto` sin chequear la ruta, votar una opción inexistente.
   **La red es barrer cada `update`/`delete` y exigir el producto MÁS la fila**, y en las tablas de
   una persona, sólo lo de `a.clave`. **Vive en:** `tests/comunidad-permisos.test.ts` (barre las
   29 escrituras).
2. **Un popover adentro de un `Modal` es una capa**: Escape en las sugerencias de una @mención
   cerraba el compositor entero, con el borrador y el adjunto. La regla ya estaba en AGENTS.md y
   se volvió a pagar en tres piezas nuevas (el menú ⋯, la campana, las menciones): el molde quedó
   en `CapaPopover` (`app/_comunidad/piezas.tsx`). Razonado sobre `app/_ui/Modal.tsx`, no
   tecleado en un navegador.
3. **El tope de largo va sobre el valor NORMALIZADO**: `videoDePost` y `linkDeLugar` medían lo
   escrito; una «ñ» normalizada en una URL son 6 caracteres, y pasar el CHECK de 600 mostraba el
   error crudo de Postgres.
4. **La subida se firmaba sin preguntar si podía publicar** (un alumno sin el nivel para postear
   recibía URLs de 25 MB, 40 por minuto): la misma familia que las entregas. Va la regla pura que
   apaga «Escribe algo» (`puedePublicarEnLaComunidad`) y 6 firmas por minuto.
5. Lo que manda el navegador se acota: un `desde` en el año 2200 recorría cada serie del
   calendario hasta ahí, y un año fuera del rango de `Date` contestaba 500 (`rangoDeCalendario`).
   El link de un líder de área (`c2.`) no abre la comunidad: escribiría con el nombre del cliente.
6. Chicas: un «hace cuánto» o un `toLocaleString` calculados en el server no hidratan (el reloj
   nace en `null`); `text-transform: capitalize` sube TODAS las palabras («Jueves, 8 De
   Octubre»); `create table if not exists` no agrega columnas a una tabla que ya existe (cada
   columna nueva va además como `add column if not exists`, antes del índice que la usa); y el
   guard de «leído si todas lo están» pasaba sobre su rotura cuando la fila más nueva era la sin
   leer — un guard se prueba también con el caso al revés.
7. ⚠️ **El primer informe recomendaba lo que después tiró el typecheck**: «el wrapper de `select`
   tiene que ser genérico `<Q extends string>`». Con el genérico, `tsc` se quedaba sin memoria:
   quedó con `string` y `'*'` (ver hallazgos-infra → «El typecheck sin memoria»).
8. **Un banco visual sin servidor sirve**: esbuild con un stub de `@/app/_ui/Link`, una API falsa
   y Playwright dejan revisar la UI sin el dev server (que escribe en producción). Quedó en el
   scratchpad de la sesión `7a6bc4be` (`comunidad/visual/`), no en el repo.

### Las portadas diseñadas (item 5)

- **El chip del número tapa 5 de los 7 diseños.** El enchufe propuesto dejaba el chip lima de
  arriba a la izquierda encima de la lámina: el póster y el kraft perdían la «M» de «MÓDULO», la
  pizarra la punta del número, la entrada y el plano el talón. Sólo el cuaderno (cae en el
  espiral) y la nota (cae en el corcho) dejan esa esquina libre. Lo decide `conChipDeNumero`,
  medido con capturas a 280 px.
- **Una respuesta vieja del server borra lo tipeado**: se manda «Uno», después «Uno dos», la
  respuesta de «Uno» llega tarde y el campo queda en «Uno» con «Uno dos» guardado. La causa es
  `guardarAjuste` (`CursoApp.tsx`), que aplica cualquier respuesta aunque ya haya salido una más
  nueva. El arreglo (un turno por clave) está escrito y NO se aplicó (abajo).
- Un emoji cortado a la mitad (un surrogate suelto) hacía tirar «URI malformed» a
  `valorDeLamina` —que prometía no fallar nunca— y desmontaba el selector (va `\p{Cs}` en el
  saneo). Pasar «ß» a mayúsculas da «SS»: treinta letras se volvían sesenta y el texto bajaba del
  piso de lectura (`mayusculas()` no cambia el largo). «Sin portada» perdía contra lo que se
  estaba tipeando, justo en un módulo nuevo. Y el test del contraste daba verde con la tiza
  invisible: buscaba la tinta en cualquier `fill` (el rótulo la tiene), no en el grupo del texto.
- El reparto del cuaderno («la menor cantidad de renglones») no sirve para cajas de texto fijas.
  Y `ClaseUgc.vn` es `number | string` y `clase.id` es el id de la base, no el número de la
  clase: el código de integración del informe original no compilaba.

**Vive en:** `lib/laminas.ts` · `app/_cursos/laminas/` · `app/_components/PortadaPicker.tsx`.

### El recorrido (item 3)

- **`localStorage` es del NAVEGADOR, no de la persona.** El respaldo local del «ya lo vi» tenía
  la clave `mako.recorrido.<id>`: en una computadora compartida, a la segunda persona no se le
  abría nunca, y peor, el gancho le SINCRONIZABA al server «visto» a nombre de ella, para siempre
  y en todos sus dispositivos. La clave lleva a la persona (`quien`: 16 hex de un sha256 del email,
  que devuelve `/api/recorridos`), y con sesión no se lee lo local hasta que el server dice quién
  es. Sin sesión (el portal del alumno, `soloLocal`) sigue siendo del navegador.
  **Vive en:** `lib/recorridos.ts` (`claveLocal`) · `app/_ui/Recorrido.tsx` ·
  `app/api/recorridos/route.ts`.
- **La pila registra la capa en un EFECTO**: el primer render de una capa abierta sale con
  `display:none` y cualquier medida da 0×0. El primer cuadro caía al tamaño de respaldo y saltaba
  (a veces al otro lado del objetivo), con un comentario que decía «casi nunca cae al respaldo».
  La medida espera a `capa.visible`.
- ⚠️ **Tercera vez: un nodo en `visibility: hidden` no recibe `focus()`, y no da error.** Pasó en
  el recorrido (el foco por paso), en el panel de enlace del editor rico (lo tipeado tras Ctrl+K
  caía en el texto) y antes en el menú de la marca (hallazgos-conocimiento, punto 10). Lo que se
  oculta mientras se mide y tiene que recibir el foco, va con `opacity`.
- `ChecklistCurso.tsx` NO se puede borrar al montar el recorrido: lo importan
  `app/customer-success/ChecklistClientes.tsx` y `app/customer-success/curso/page.tsx`. Y
  `color-mix()` en Safari anterior a 16.2 invalida el `box-shadow` ENTERO: sin velo ni aro.

### El editor rico (item 17)

- **Una imagen de nuestro propio dominio es un GET con la sesión de quien mira.** `srcSeguro`
  aceptaba cualquier ruta de hola-mako.com: medido, un `<img>` a
  `https://hola-mako.com/api/compartido/curso/entrar?t=…` salía del saneo intacto, y cada persona
  que abriera la clase —el equipo, el super admin que inspecciona— le pegaba con sus cookies. De
  nuestro dominio pasa sólo un archivo de imagen estático: sin query ni `#`, sin `/api/` ni
  `/_next/` (tampoco en mayúsculas), sin `%` (`/%61pi/` es `/api/` para el router) y sin `//`.
  **Vive en:** `lib/html-seguro.ts` (`RUTA_IMAGEN_PROPIA`).
- **Pegar desde Excel (y a veces Word) trae, además del HTML, una IMAGEN de lo copiado**, y
  `handlePaste` subía los archivos siempre: se subía una foto del texto y el texto se tiraba. Si
  el HTML del mismo pegado trae texto visible, se pega el texto; una captura (sin HTML) o «Copiar
  imagen» (un HTML que es sólo un `<img>`) se siguen subiendo. ⚠️ Plausible y NO medido con
  Office real. **Vive en:** `app/_ui/EditorRico.tsx` (`pegadoEsDeArchivos`).
- Soltar contenido también pasa por `transformPastedHTML` y `handleDrop` no ponía en cero el
  contador de imágenes sacadas: el pegado siguiente decía «Una imagen no se pegó» sin que nadie
  pegara una. `traducirAdjuntos` reemplazaba con una cadena (`$&` es sustitución: la regla de
  AGENTS.md, otra vez). TipTap 3 dibuja la tarea como `<li data-checked>` SIN `data-type` (el CSS
  va por `ul[data-type=taskList] > li`), y `setEditable` emite un cambio por default.
- El adjunto se le sirve al alumno sólo si la descripción PUBLICADA de esa clase lo nombra, no por
  `clase_id`: una imagen copiada a otra clase del mismo curso se sigue viendo, y lo que se sacó de
  la descripción deja de servirse. **Vive en:** `lib/curso-adjuntos-reglas.ts`
  (`decidirAdjuntoAlumno`).

### Lo que quedó SIN hacer (medido contra HEAD el 08/10)

**Sin montar** (lo enchufa la tanda 2, con los módulos, los bloqueos, el arrastre, la lección
editable y el portal):
- El recorrido: la tab Curso sigue con `<ChecklistCurso>` (`app/customer-success/curso/CursoApp.tsx`).
- La vista Avance sigue también en la tab Curso (`VistaCurso`, `CursoApp.tsx`); el item 4 pide
  sacarla de ahí. En Clientes ya existe.
- Invitar desde el editor: `app/customer-success/curso/InvitarAlumnos.tsx`, sin call site.
- El editor rico: sin call site, y el portal no lee `descripcion_html` (`lib/curso-datos.ts`). Al
  montarlo: `guardarClase` (`lib/curso-admin.ts`) escribe `descripcion` y deja `descripcion_html`
  como está, así que el texto plano y el rico pueden decir dos cosas; la vista previa del equipo
  pasa `token=""` (`app/customer-success/curso/vista/page.tsx`) y sale sin imágenes; y el snippet
  del informe original volvía a pedir en cada tecla los ids que no se pudieron firmar.
- Las láminas en las tarjetas: `app/_cursos/tipos.ts`, los dos `modelo-ugc.ts`,
  `app/_cursos/CursoUgc.tsx` (con `conChipDeNumero`) y la prop `disenos` en `CursoApp.tsx`.
- La comunidad del alumno: `ComunidadAlumno` sin montar en `PortalAlumno.tsx` ni en `/mi-curso`;
  va con `!vistaPrevia`.

**Escrito y sin aplicar:**
- La respuesta vieja que borra lo tipeado: `guardarAjuste` en `CursoApp.tsx`.
- `curso-entregas` no se purga (`lib/curso-purga.ts`): lo que se quita o se regraba, y lo de una
  clase o un lead borrados —voces y caras grabadas—, queda para siempre. Las referencias viven en
  `valores` Y en `valores_ia`. Tampoco tienen regla los adjuntos registrados que la descripción
  dejó de nombrar.
- El quiz: dos envíos en paralelo pueden saltearse `intentos` (falta compare-and-set,
  `lib/curso-entregas.ts`); un quiz aprobado al que le agregan una pregunta deja la tarea sin
  poder reenviarse; las respuestas por posición (arriba).
- La puerta copiada: `puedeVer`, `puedeEditar` y `productoPropio` viven en
  `app/customer-success/curso/actions.ts` y en `adjuntos-actions.ts`, con un test que falla si se
  separan. Va a un módulo común.
- `setPerfil` (`lib/perfil.ts`) reescribe el jsonb sin compare-and-set: una marca de recorrido
  puede perderse (vuelve a aparecer una vez).
- El nombre de descarga con acentos: `@supabase/storage-js` 2.106.1 codifica dos veces el
  `download=` de una URL firmada. Medido en lo que arma la librería, no en lo que baja el
  navegador; pega en todos los buckets, así que va en un helper común.
- La comunidad: los mails (el recordatorio de 24 h —`comunidad_evento_avisos` no la escribe
  nadie— y el resumen diario); el «empieza pronto» se anota recién al abrir la campana; no se
  puede seguir a una persona; el directorio y las @menciones topean en 300 miembros; el ranking
  lee todos los likes en cada pedido; el perfil del super admin no abre para un alumno.
- No hay cuota de almacenamiento por workspace: el bucket es uno para toda la plataforma.
- Con los módulos sueltos (tanda 2), `modulosParaPermisos`
  (`app/customer-success/curso-ficha-lectura.ts`) tiene que salir de la lista derivada: hoy un
  suelto cae en «Sin etapa» y con «Elegir módulos» queda escondido.

**Decisiones de Martín:**
- Un alumno parado en una etapa cuyo módulo tiene oculto queda trabado (`etapaCompleta` nunca
  cierra), los mensajes automáticos pueden nombrar clases ocultas, y el mail de invitación nombra
  productos con cero módulos.
- Un alumno con el curso de un producto escondido (`alcance` vacío) sigue siendo miembro de esa
  comunidad; un evento «con un módulo» se decide por el alcance, y como `null` es «todos», casi
  todos entran.
- 100 MB por archivo de entrega, con el Storage que haya.
- El póster pone el número a la izquierda y D6 dice «número arriba»; el círculo de play de la
  tarjeta de clase pisa el final del texto en cuatro diseños.

Nada de la tanda 1 se vio dentro de la app en un navegador: los bancos (esbuild, Playwright,
Chrome headless) no son la app real.

## El curso tipo Skool, tanda 2: módulos, candados, arrastre y la lección editable (08/10/2026)

En `bccbebae` (migs 0220 y 0221 APLICADAS). El diseño y sus contratos, en
[diseno-curso-skool.md](diseno-curso-skool.md). Probado en el navegador sobre la app real (dev-login,
ws1 y ws15 inspeccionado): índice, módulo, lección, vista del alumno, Conocimientos y la sidebar con
la barra de agencia.

### La clave del módulo se quedó en `curso_clases.etapa`, y por qué

El relevo contó ~40 lugares que agrupan clases por `c.etapa` (portal, avance, mensajes, IA, ficha,
resumen). Un `modulo_id` nuevo los rompía a todos; dejar la clave donde está y que un módulo
VINCULADO use la clave de su etapa los deja andando sin tocarlos. Lo que cambia es quién decide la
lista: `modulosDelCurso` (lib/curso-modulos-datos.ts) la DERIVA de las etapas con `enCurso !== false`
más los sueltos de `curso_modulos` anclados con `despues_de`.

- **Todo lo que lista módulos pasa por `modulosDelCurso`**, nunca lee `curso_modulos` directo: la
  fila de un vinculado no tiene nombre (sólo guarda su candado). El ranking de la comunidad se perdió
  así el nivel de los vinculados hasta que la revisión lo cazó.
- **Cambiar la clave de un módulo (desvincular / vincular) re-clavea TODO lo que la nombra**: las
  clases, su portada (`curso_estilo portada:etapa:<clave>`), los desbloqueos, las notas, los eventos
  de la comunidad y los permisos de los alumnos (`reclavear`, lib/curso-modulos-datos.ts). Un dato que
  se olvide queda apuntando a un módulo que ya no existe, sin error.
- **La primera etapa del kanban no se mueve** («un cliente sin fila está en la primera»): un
  arrastre que la cambie se rechaza con `ERROR_PRIMERA`. ⚠️ El chequeo se comparaba contra el kanban
  de ANTES de meter una etapa nueva (`planReorden` + `planConEtapaNueva`): lo cazó el test del núcleo.

### Los candados: lo que el relevo de Skool cambió del diseño

Skool sólo bloquea por nivel, tiempo desde que la persona entró al GRUPO, compra, plan o a mano. Acá
son 8 reglas (lib/curso-bloqueo.ts, puro) y dos se apartan de Skool a propósito: los días cuentan
desde que se le ABRIÓ el curso a ese alumno (contar desde el grupo rompe un curso que se abre
después), y hay «al terminar el anterior» y «al enviar/aprobar la tarea de…», que Skool no tiene.

- **Un motivo de candado es un canal**: «Se abre al terminar «X»» nombra a X, así que sólo puede
  nombrar lo que quien mira tiene permitido ver (`nombrable`).
- **Un mensaje automático que nombra clases es otra puerta**: usa la misma evaluación que el portal
  (`aperturasDelAlumno`), o le anuncia a un alumno una clase que todavía no puede abrir.
- **«Probado rompiéndolo» había cubierto lo que tenía test, no todas las reglas**: la revisión rompió
  las reglas del CONTRATO y seis daban 0 fallas. Se rompe la regla, no el test.

### Dos pasos en paralelo sobre la misma hoja, y lo que se pisaron

El editor y la lección corrieron a la vez sobre `CursoUgc.tsx`, `CursoApp.tsx` y `estilos.ts` para
cerrar antes. Funcionó (Edit falla si el archivo cambió y el agente relee), con dos pisadas que sólo
encontró la revisión final volviendo a correr los arneses de cada paso sobre el árbol integrado:

- **Dos reglas para el mismo selector** (`.mk-iconbtn`) en la hoja compartida: gana la última en
  silencio, y los botones del formulario de una tarea salían de 36 px con borde y sombra. La piel de
  un control va acotada a su zona (`.ugc-topbar-extra`), con un test.
- **El mismo dato con dos nombres en la misma pantalla**: la tarjeta decía «Cierra la etapa» y el
  interruptor «Cierra el módulo», y el chip aparecía en un módulo suelto, donde no cierra nada.

### Trampas del dibujo que aparecieron al editar adentro

- El reset de `.ahdoc` (`* {margin:0; padding:0}`, botones sin fondo ni borde) rompe los controles de
  la app dentro del curso (switches sin fondo, inputs sin relleno), y `Modal`/`Confirm` no se
  portalean: una pregunta se dibuja afuera del curso.
- Un clon del arrastre colgado del `body` pierde los estilos acotados a `.ahdoc .ugc`, y la copia de
  un renglón de la barra necesita su fondo oscuro (el original es transparente con texto claro).
- El hueco se cierra afuera de las zonas donde soltar funciona: si no, promete un destino que no hay.

### Lo que quedó SIN hacer o espera una decisión de Martín

- Desvincular y volver a vincular crea una columna NUEVA en el kanban; la vieja queda con sus
  clientes (lib/curso-modulos-datos.ts, `vincularModulo`). Y no es atómico: un corte a mitad deja un
  estado intermedio.
- La vista Avance cuenta por etapa del kanban: las tareas de los sueltos no salen ahí (sí en la ficha).
- «Completar un módulo» exige también las clases con candado manual (lib/curso-bloqueo.ts).
- Borrar una etapa en el kanban manda al final los sueltos anclados a ella.
- Pantallas táctiles: no hay arrastre (quedan ↑↓ y «Mover antes / después»).
- Código sin uso: `guardarClase` (lib/curso-admin.ts), `conteoDeNotas` (lib/curso-notas.ts), el
  componente `ChecklistCurso` y la prop `onboarding` de `CursoApp`.
- La Comunidad del equipo exige una sesión con id de usuario: la de `dev-login` contesta «Tu sesión
  no tiene una cuenta propia» (app/customer-success/comunidad/actor.ts). Con una sesión real anda.

## El curso tipo Skool, los 20 ajustes: la papelera, el kanban que se quita y el movimiento silencioso (08/10/2026)

En `d188f3a8` (mig **0223** APLICADA antes del deploy). Martín usó el curso publicado y mandó 20
ajustes (el texto literal, en la bitácora de `/admin/dev/customer-success`). Cuatro pistas en
paralelo (lección, editor rico, estructura, apariencia) y dos revisiones sobre el árbol integrado.
Todo se probó en bancos de Chromium con actions de mentira: **nada se vio todavía en la app real**.

### Quitar una etapa con clientes: el bloqueo de secuencias va ANTES de mover

El interruptor «Etapa del kanban» cambió de sentido: apagarlo ya no deja la etapa con
`enCurso: false`, la **quita** (la decisión D1 de `diseno-curso-skool.md` se corrigió). Si tiene
clientes, se pregunta a dónde van y se los mueve **sin mandar nada** (`silencioso` en
`moverClienteDeEtapa`, lib/cs-mover-etapa.ts). El envío de WhatsApp del ws1 está PRENDIDO.

**El diagnóstico obvio era el equivocado.** La primera versión movía al cliente y DESPUÉS bloqueaba
las secuencias de la etapa nueva, con un `catch` que sólo anotaba — «best-effort, como el
enrolamiento». Pero la red del cron (`leadsDeCohorte` → `aInscribir`) enrola a todo cliente que esté
en una etapa con secuencia: si el bloqueo fallaba (o el cron pasaba entre las dos escrituras), el
cliente quedaba movido SIN bloqueo y el cron le mandaba el WhatsApp en la corrida siguiente. Ahora:

- **El bloqueo va antes de mover, y sin bloqueo no se mueve** (lib/cs-mover-etapa.ts:227-241).
  `silenciarEntregaDeEtapa` (lib/nutricion.ts) tira si una secuencia no quedó bloqueada; antes
  anotaba y seguía.
- **Lo que cuesta**: si la columna no se escribe después, quedan bloqueadas secuencias de una etapa a
  la que el cliente no llegó; y si más adelante lo mueven ahí por el camino normal, esa secuencia no
  le sale. Es el lado barato: un mensaje de menos, nunca uno de más.
- La primera etapa (la entrada) no se quita: el interruptor se dibuja apagado con su motivo.
- Con clientes mudados, ni el interruptor ni «Eliminar módulo» ofrecen Deshacer: la etapa no se
  recrea con ellos adentro (`planConEtapaDevuelta` sólo sirve para una etapa vacía).

### La papelera: el borrado suave tiene que ser INVISIBLE, y se renumeró a 0223

Borrar una clase era un `delete` y el avance de cada alumno se iba por la cascada: un Deshacer que
la vuelve a crear devuelve una IGUAL con otro id. Ahora va a la papelera (`curso_clases.borrada_at`,
`curso_modulos.borrado_at`) y una purga la borra de verdad a los 7 días (lib/curso-papelera.ts, desde
el cron `/api/cron/curso-purga`, con compare-and-set).

- **Toda lectura de clases filtra `borrada_at is null`** y lo fija `tests/curso-papelera.test.ts`
  barriendo `app/` y `lib/`, con tres excepciones nombradas (las claves que no se reusan, quién usa
  un video, la purga). Una lectura nueva sin el filtro le muestra al alumno una clase borrada.
- **Va ANTES del deploy**: sin las columnas, PostgREST rechaza la consulta entera y se caen el
  portal de cada alumno y la tab.
- **El número lo tomó otra sesión**: la pista la escribió como 0222 y la API publicó
  `0222_api_llamadas_token.sql` en paralelo. Se renumeró al integrar (archivo y 19 menciones de
  «mig 0222») ANTES de aplicarla.
- **Sin hacer**: un módulo vinculado sin candado que se elimina deja su `portada:etapa:<clave>`
  sin purgar; un módulo nuevo con el mismo nombre la hereda.

### Item 16: «la clase se convierte en un módulo nuevo» era una COPIA, no una lógica

Nadie lo vio como lo vio Martín; la pista lo reconstruyó en Chrome con ventana. Dos causas, y
ninguna era «el soltar crea un módulo»: la copia que sigue al cursor de una CLASE es idéntica a la
tarjeta de un módulo (260×260, con su chip de número), así que sobre la barra se leía como un módulo
nuevo entrando a la lista; y soltar en el aire entre dos renglones no hacía nada aunque uno se viera
marcado. Ahora sobre la barra la copia es una pastilla con el título, y `filaEnBarra`
(app/_cursos/orden.ts) elige el módulo por la altura del cursor, también en el hueco. **A confirmar
con el gesto real de Martín.**

### El desplegable que se cortaba: decidía con un número fijo

`Dropdown.tsx` ya sabía abrir para arriba: lo decidía con «¿hay 300 px abajo?» y el menú medía 354, y
el alto máximo no restaba el relleno de la caja. Ahora decide con lo que mide el menú
(app/components/dropdown-lugar.ts, puro, con test). **Es el primitive de toda la app**: cambia cada
`Select`, y sólo se midió en el banco.

### Trampas del dibujo, para el próximo que edite adentro del curso

- **Esconder por CSS deja la caja**: el interruptor «Texto al costado / abajo» se escondía en el
  teléfono y su contenedor con el `data-recorrido` quedaba de alto cero; `getClientRects()` lo daba
  presente y el recorrido señalaba la nada. Se esconde el elemento que lleva la marca.
- **Un `contentEditable` cuenta como `:focus-visible` hasta con el mouse**, y la regla genérica de
  foco del curso (`.ahdoc .ugc [tabindex]:focus-visible`) carga después: un marco negro en cada clic
  del editor. Hace falta una regla con más peso, no la misma.
- **Los campos de la app (`.mk-input`, `.mk-textarea`) traen Geist escrito**: por eso la descripción
  y la tarea se veían con letras distintas. Adentro del curso se pisan con `:where()` por selector,
  porque el guard de `cursos-ugc` parte los selectores por la coma.
- **La misma clase en dos reglas**: `.mk-er-fila` era la fila del panel del enlace y también cada
  renglón de los menús «Más» y de la tabla; ganaba la última y cada renglón tenía 9 px de hueco.
- **Un formulario con la hoja acotada a la lista (`.ec .ec-…`) pierde los estilos en la copia del
  arrastre** si la copia cuelga afuera: la de los campos cuelga de la lista y la medición la saltea.
- **Un Deshacer propio al lado del Ctrl+Z** tiene que mirar la profundidad del historial, o repone
  dos veces lo que el Ctrl+Z ya devolvió (dos tablas iguales). Y ProseMirror junta en un paso lo que
  pasa en medio segundo: cada ajuste de imagen va con `closeHistory`.
- **Medir la barra contra lo que muestra la hace saltar**: se mide contra una regla escondida con
  todas las piezas (app/_ui/editor-rico-reglas.ts).
- **sanitize-html, ante un valor fuera de `values`, deja el atributo VACÍO** (`colspan=""`), no lo saca.
- **Cambiar el tipo de un campo es destructivo** (un quiz a Texto pierde sus preguntas): Deshacer
  sólo si se pierde algo escrito, o el aviso sale en cada elección de un campo recién creado.
- **`marcasDeVoseo` no veía «hacé», «pegá», «elegí», «volvé»**: el test de voseo de la apariencia dio
  verde la primera vez. Se le sumó la regla de la vocal con tilde final.
- **Un recorte de test anclado en «la función que viene después» se rompe** cuando alguien escribe
  una función en el medio (`nutricion-etapa` se comió `silenciarEntregaDeEtapa`).

### Lo que quedó SIN hacer o espera una decisión de Martín

- **La negrita del curso se dibuja en Arial**: `public/cono-doc/ugc.css` declara Archivo negrita con
  archivos que dan 404 (vienen del sitio de origen). Sacarlas de la hoja y de
  `scripts/avatarhype-css.mjs` cambia también los 132 cursos de Conocimientos: decide Martín.
- **La fuente en Conocimientos** necesita sumar `'fuente'` al CHECK de `conocimiento_ajustes.campo`
  (otra migración) y tocar lib/conocimiento-ajustes.ts y EditorConocimientos.tsx.
- **El recorrido del curso conserva la clave `cs-curso`**: quien ya lo vio no ve los pasos nuevos
  solo (sí con el «?»). Cambiar la clave en recorridos-curso.ts se lo reabre a todos.
- **Sin Deshacer**: crear módulo o clase, la disposición, «Obligatoria» y «Por área» (se revierten
  con el mismo control), y quitar un video SUBIDO (el server borra el archivo).
- **La vista previa** no busca el «último fijado» de un campo «Comentar en la comunidad» y dice que
  no hay post.
- **Código muerto**: `urlSubida` y `descartarVideo` (lib/curso-admin.ts, nombrados en comentarios de
  curso-entregas, curso-notas y curso-purga), `duracionDeArchivo` (subir-video.ts), `{ tipo }` en
  `CambioClase` y `rotuloTipo` (reglas.ts).
- **No medido en la app real**: quitar una etapa con clientes (en el ws3, NUNCA en el ws1: que no
  salga nada y aparezcan las inscripciones `cancelada`), eliminar módulo con su Deshacer y la purga,
  la duración de YouTube/Vimeo en un navegador real, el oEmbed de Loom desde el navegador, la ruta
  `/api/compartido/miniatura` en producción, publicar y comentar desde la tarea con el link `?post=`,
  el auto-scroll al arrastrar campos (Playwright manda un solo `dragover`) y el desplegable en otras
  pantallas.

## El feedback del audio del 08/10: guardar a mano, la tarea en su contenedor, embeds y comentarios de clase (08/10/2026)

En `dbae4da9` (migs **0226** `curso_tarea_html` y **0227** `comentarios_de_clase`, APLICADAS antes del
deploy; eran 0224 y 0225 y las tomaron otras sesiones en paralelo). La fuente es
[feedback-curso-08oct.md](feedback-curso-08oct.md): alguien con su propio curso lo probó en pantalla
compartida con Martín. Siete pistas en paralelo y dos revisiones. Todo en bancos de Chromium con
actions de mentira: **nada se vio todavía en la app real**.

### «Se me borraron los campos» tenía TRES causas, y el saneo era la menos importante

El diagnóstico obvio era `sanearCampos` (`lib/curso.ts`), que tiraba en silencio un campo sin la
pregunta escrita. Era cierto, y no alcanzaba:

1. **La pantalla no mandaba la lista** si un campo estaba incompleto, y el guardado «al desmontar»
   tampoco: se perdía la tanda entera, no sólo el campo incompleto.
2. **El Atrás del navegador reusa la página ya bajada** (Next, «reused during browser back/forward
   navigation»): guardar, ir a la vista del alumno y volver redibujaba lo viejo, y el próximo
   «Guardar» chocaba consigo mismo.
3. El saneo, que descartaba sin rastro.

Ahora la lección es un BORRADOR con «Guardar» (`guardarLeccion`, lib/curso-admin.ts, un solo update
con compare-and-set), lo incompleto se marca en rojo con `erroresDeCampos` y el server rechaza
ANTES de sanear. Salir con cambios pregunta. `guardarLeccionAction` revalida la ruta.

- **Regla: lo pendiente se ataja al salir, no se «guarda al desmontar».** Y **lo que se guarda a mano
  y después se navega, revalida**.
- **Revalidar resiembra la pantalla con lo del server**: lo que se guarde DESPUÉS en el mismo clic
  queda pisado en pantalla. La disposición se guarda antes que la clase por eso.
- **Un compare-and-set sobre `updated_at` a secas choca con las escrituras automáticas propias** (los
  minutos del video, el menú): compara el contenido de las partes que escribe, más `updated_at` en el
  `update`.
- **Cambiar un saneador de «tirar» a «renombrar» rompe en silencio a quien detectaba contando
  largos** (`validarCamposEntrada` dejó de ver los repetidos). Al cambiar qué hace un saneador, se
  busca quién mide su salida.

### La tarea: más de una por clase, sin tabla nueva

Las tareas extra son campos `tipo: 'seccion'` del jsonb `campos` (título y consigna con formato); la
principal tiene su consigna en `curso_clases.tarea_html` y `tarea` queda como su texto plano
DERIVADO (`lib/curso-tarea-html.ts`), porque lo leen la IA, los mensajes y `tieneTarea`.

- **Un tipo de campo que no se contesta obliga a cuidar a TODOS los lectores de `.campos`**:
  `tests/curso-tareas-secciones.test.ts` los barre leyendo el DISCO (un archivo nuevo sin `git add`
  también cuenta), con excepciones nombradas. El área «curso» de la API (otro chat) usa `v.campos`
  para sus parámetros: excepción por línea, y cuando lea `clase.campos` el guard la va a ver.
- **Dos pistas que resuelven el mismo pedido de cada lado de la pantalla terminan con dos nombres**:
  el editor decía «Lo hice» con una casilla y el portal dibujaba «Marcar como hecho» con un botón;
  el test de cada pista fijaba su versión y los dos daban verde. Quedó «Marcar como hecho».
- **Arrastrar sobre un editor rico**: con `text/plain`, soltar un campo encima de la consigna le
  insertaba el texto («c2») y el campo se movía igual. Dentro de una zona con un editor rico, el
  arrastre usa un tipo propio (`MIME_CAMPO`) y el editor no recibe el puntero durante el gesto.
- **Nada se esconde o se muestra según el foco si eso cambia alturas**: un `:focus-within` que
  escondía la ayuda movía otra tarjeta, el navegador corregía el scroll y el desplegable de la casa
  se cierra al scrollear. Parecía un problema de tiempos de Playwright.

### El editor rico redibuja sus imágenes por la IDENTIDAD de `urlDeAdjunto`

Una caché de URLs con `useCallback(…, [])` parecía una optimización y dejaba en blanco, sin error,
toda imagen cuya URL llegaba después de montar (abrir una clase por link o sin pasar el cursor).
`app/customer-success/curso/urls-adjuntos.ts`: la función cambia de identidad al llegar URLs.

### Abrir una clase: un import estático deshace la carga perezosa entera

TipTap pesa ~510 KB. El editor rico va perezoso (`editor-rico-perezoso.tsx`) y se precarga al pasar
el cursor por una tarjeta: JS inicial de la tab **857 → 423 KB**. Un solo `import` estático (el de
`TareaEditor`) lo devolvía a 932 KB: hay un guard. Y **`React.lazy` retiene ~300 ms lo que ya está
precargado**: para algo precargado va un caché del módulo y se dibuja en el mismo render.

### Videos por código embed y «Insertar»: Panda no era sólo el reconocedor

`lib/embeds.ts` (lista blanca de hosts, sin `server-only`) decide un link o un `<iframe>` pegado.

- **El diagnóstico obvio de Panda era incompleto**: además de mandar todo host desconocido a
  «afuera», el campo era `<input type="url">` y el NAVEGADOR frenaba el código antes de que la
  pantalla lo viera.
- **`panda_timeupdate` no trae la duración, pero `panda_allData` sí, sin play.** La trampa real era
  el autoplay mudo: `autoplay=false` y se descartan los avances con `isMutedIndicator`.
- **sanitize-html no mira el PUERTO** en su lista de hosts (`calendly.com:8443` pasa esa capa), y un
  `srcdoc` con `allow-same-origin` correría con nuestro origen: lo frena la primera capa
  (`embedDe`, por `origin`). Las dos capas se cubren entre sí y ninguna tiene test propio.
- **Un clic adentro de un iframe saca el foco del editor**: los controles de lo insertado van atados
  a la selección, no al foco (con el foco, «Quitar» desaparecía en 3 de 7 corridas).
- **TipTap: el `parseHTML` de cada atributo pisa lo que devuelve el `getAttrs` de la regla.**

### Los comentarios de una clase son un post de la comunidad, y cada lector decide

Un hilo por clase (`comunidad_posts.clase_id`, mig 0227), creado con el primer comentario, que no
sale en el feed. **El diagnóstico obvio era «se filtró donde se dibuja»** (feed y búsqueda): se
escaparon la lista de posts para armar una tarea «Comentar» y su verificación, que no dibujan posts.
Una tarea podía apuntar al hilo de una clase cerrada, y el id de un hilo propio completaba
«Publicar». Regla: **cuando una fila de una tabla compartida pasa a significar otra cosa, se barren
todos los lectores de esa tabla y cada uno decide** (guard en `tests/curso-comentarios-clase.test.ts`).

- **El «autor» de un contenedor compartido es quien comentó primero**: sacar a un alumno «con su
  contenido» se llevaba en cascada los comentarios de todos. Se excluye en cada borrado por autor.
- **Una navegación dura desde un diálogo con un borrador abierto**: «+ Nuevo producto» crea y navega
  con `window.location.href`; la pregunta por la lección sin guardar va ANTES de crear.

### Lo que quedó SIN hacer o espera una decisión de Martín

- **«+ Nuevo campo» arriba y el campo nace abajo**: Martín lo pidió arriba a la mañana; la prueba de
  la tarde quiere los campos nuevos abajo. A confirmar.
- **Las invitaciones de un negocio con su dominio salen con SU remitente** (antes, siempre MaKo). Medido:
  el ws11 pasa a firmar con el suyo. Si su dominio deja de verificar, el envío falla a la vista (sin
  «lo manda MaKo»).
- **Imágenes huérfanas**: las de un borrador descartado quedan en `curso_adjuntos` y la purga no las
  barre (`lib/curso-purga.ts:63-65`).
- Borrar la clase abierta con cambios sin guardar los pierde, aunque se use «Deshacer».
- El renombrar, el menú «…» y la obligatoria no revalidan: el Atrás puede mostrarlos viejos.
- La ficha numera «2. …» si la tarea principal está vacía (`curso-ficha-lectura.ts:205`).
- «Comentar en la comunidad» se completa con cualquier comentario, no con el del post pedido (de antes).
- Un Panda insertado en la descripción arranca solo si su cuenta tiene el autoplay prendido.
- **La migración de cursos** está investigada en [migracion-cursos.md](migracion-cursos.md): primero la
  API de MaKo + el Claude del cliente (ya hecha por el chat de la API), después «Traer de Panda», y
  Skool/Hotmart como migración asistida. `catalogoPanda()` (`lib/panda.ts:285`) corta en 20 páginas
  sin decirlo: un importador no la puede reusar tal cual.
- **No medido en la app real**: guardar → vista del alumno → Atrás; el aviso nativo de
  `beforeunload`; una imagen en la consigna vista por el alumno; Calendly, Cal.com y HubSpot
  insertados con cuentas reales; un hilo de clase con la clase cerrada; la invitación de un negocio
  con dominio y una real por WhatsApp.

## El feedback del audio del 08/10 a la noche: acceso por producto y la vista del alumno (09/10/2026)

La fuente es [feedback-curso-08oct-noche.md](feedback-curso-08oct-noche.md): la segunda prueba del curso
con Leandro (ws10, productos «Fiesta Music» y «Service Delivery & Ops»). Tres pistas en paralelo
(acceso e invitación, vista del alumno, editor), una revisión adversarial y un cierre que aplicó sus
arreglos. **Mig 0232 APLICADA** el 09/10 ~14:30 (`curso_accesos.productos bigint[]`, sin backfill; va
ANTES del deploy porque el código nuevo la lee). Sin commitear al cierre (~16:15). Verificado: typecheck
acotado de 1509 archivos con 0 errores; 1025/1025 en `curso*`, `alumno*`, `comunidad*`,
`crm-curso-al-ganar` y `cs-*`, y 64/64 en las guardas generales. Nada de la invitación por producto se
vio en la app real.

### Lo que se arregló, punto por punto

1. **El nombre del producto perdía el foco con cada letra**: `onCerrar` estable (`useCerrarEstable`) y
   el foco cuando el campo se ve (`useFocoInicial`), en `app/customer-success/curso/dialogo-foco.ts`.
   También `QuitarEtapa` y la pregunta de salir de `LeccionEditable`.
2. **La escala y las estrellas, centradas** (`TareaAlumno.tsx`, `.cpt-escala-caja`).
3. **El quiz dice el resultado**: «✓ Correcta / ✗ Incorrecta», y con el quiz cerrado la respuesta
   correcta (`revelarCorrectas`, en las dos puertas del alumno).
4. **Un solo scroll en la lección del alumno** (`unSoloScroll`: sólo el portal y la vista previa).
5. **La vista previa corrige el quiz como el server** (`conCorrectasDelEquipo`). La pista lo escribió
   y el cierre lo enchufó en `app/customer-success/curso/vista/page.tsx`.
6. **El mail nombra sólo el curso desde el que se invita**: el editor, la tarjeta del kanban, la tabla
   Avance, la ficha y la invitación automática al ganar pasan el producto.
7. **El acceso guarda qué cursos abre** (mig 0232). El portal, la comunidad, los mensajes y la IA ven
   sólo eso. En la comunidad también los MIEMBROS, que se le habían escapado a la pista.
8. **El pie**: «Este curso es personal. © {curso}», nunca MaKo.
9. **El formulario de invitar es un borrador** en `sessionStorage`, por workspace y producto.
10. **Si el correo no sale por configuración, dice de quién fue** (`correoQueFallo`) y monta ahí
    mismo el formulario de Integraciones.
11. **El teléfono dice «Opcional. Sin él, sólo por correo.»** En el código ya era opcional.
12. **«Sólo aparecen los clientes ganados.»** bajo la lista de invitar.

### Lo que se decidió por default (a confirmar por Martín)

- **`productos` NULL = «todos sus productos»**, lo de antes, y sin backfill. **La lista la escribe sólo
  una invitación que SALIÓ**, en la misma escritura que `invitacion_enviada_at`. **Invitar SUMA el
  producto y nunca reemplaza.** Un NULL se achica a `[X]` sólo si nunca se le entregó nada (ni mail, ni
  WhatsApp con el link, ni ingresos). Sacar un curso es «Quitar de este producto» o «Cortar acceso».
- **La ficha mira la invitación DESDE EL CURSO ELEGIDO ARRIBA**: la frase y el botón, igual que la
  tabla Avance de ese curso. El link, los ingresos, copiar, mandar y cortar siguen siendo del acceso
  entero (es uno por cliente).
- **La ficha muestra los cursos de los que es CLIENTE**, no los que ve. Agendar una llamada vale sobre
  cualquiera de ellos, y sus mensajes no le nombran clases de un curso que su acceso no abre. **El mail
  del líder de un área nombra lo que su link abre**, que se rige por el acceso del cliente.
- **La respuesta correcta sólo con el quiz cerrado** (aprobado o sin intentos), y nunca en una clase
  POR ÁREA: ahí revelarla abriría el examen de las otras áreas.
- **`unSoloScroll` es una prop y sólo la pasa el portal**: Conocimientos y el editor siguen como
  estaban. El video queda pegado arriba sólo con el texto al costado y en escritorio.
- **El pie no lleva año.** El borrador va en `sessionStorage` y no en `localStorage` (son datos de una
  persona). «También por WhatsApp» no se guarda y vuelve siempre apagada.
- **El correo «ahí mismo» aparece cuando el envío ya falló**: verificarlo antes leería la misma key de
  MaKo que a veces llega y a veces no. «Falló el correo de MaKo» (era «No salió por MaKo», que se leía
  como «no se mandó por MaKo»).
- **El foco se arregló en los archivos de la tab Curso, no en `app/_ui/Modal.tsx`**, que es donde vive
  la causa: Modal lo usan 47 diálogos y no era de esta pista.
- **Riesgo raro aceptado**: dos invitaciones del mismo cliente a DOS productos en el mismo instante. La
  segunda contesta «ya invitado» sin mandar mail. Nunca salen dos.

### Hallazgos

- **«RESEND_API_KEY no configurada» no era la key del negocio.** El diagnóstico obvio, «al negocio le
  falta su key», era el equivocado: Leandro cargó la suya y le salió lo mismo. Sin remitente, la
  invitación sale por MaKo, y la key de la PLATAFORMA no está en Vercel production. Llega hidratando la
  credencial del ws1 al arrancar, y `lib/resend.ts:37` la lee de `process.env` sin esperar esa carga
  (`envCred` existe para eso). «Lo arregló» cargar el remitente, que pasó la invitación a SU key.
  **Regla: un error de envío dice por dónde iba (`via`) antes de pedirle algo a quien invita.**
- **«Ve los dos cursos»: una función contestaba dos preguntas.** `productosDelAlumno` (lib/curso-datos.ts)
  era a la vez «de qué es cliente» (el kanban) y «qué cursos ve» (el portal). Ahora «qué ve» cruza con lo
  que abre el acceso, y «de qué es cliente» es `productosDelCliente`. `tests/curso-invitar-reglas.test.ts`
  obliga a clasificar cada call site nuevo. ⚠️ Cuenta ARCHIVOS: un archivo que hace las dos preguntas
  (la ficha) necesita un assert por función. Medido en el cierre: cambiar una por la otra daba 128/0.
- **Escribir la lista al CREAR la fila reproducía el bug por otro lado.** La fila nace antes del mail, y
  en el audio hubo intentos fallidos desde los dos productos. **Regla: lo que abre un acceso lo escribe
  sólo una invitación que salió.**
- **«Ya invitado» era por cliente**, en el editor y en el reclamo sin sesión (`lib/curso-invitar.ts`,
  `reclamarInvitacion`). Ahora es por producto (`productos.not.cs.{X}`). Con NULL, ese `not.cs` da NULL y
  excluye la fila, que es justo «invitado a todos». En PostgREST, «(A o B) y (C o D)» se escribe como
  UN `.or` con los cuatro `and(…)`: con dos `.or()` encadenados no está claro cómo los junta.
- **La comunidad se escapó del barrido de «qué ve».** `actorDelAlumno` ya estaba acotado. Los
  MIEMBROS (`miembrosDeLaComunidad`, lib/comunidad-datos.ts) salían de `esDelProducto` + «acceso
  vigente» e ignoraban `productos`. Un alumno invitado a un solo curso aparecía en el directorio, el
  ranking, el perfil y las @menciones de la comunidad del otro. El guard no lo vio porque busca
  `productosDelAlumno`. **Regla: una regla de acceso nueva se barre por la PREGUNTA (quién decide si
  alguien entra), no por el nombre de la función vieja.**
- **Salidas huérfanas, otra vez.** La prop `productoId` de ModalInvitar, BotonInvitar y CeldaAcceso, y
  `conCorrectasDelEquipo`, nacieron con CERO call sites: cada pista tenía sus archivos y el call site
  vivía en el de otra. Desde la tarjeta, la tabla y la ficha se seguía invitando a todos: el bug del
  audio por otra puerta. Lo cazó la revisión y lo enchufó el cierre; es la regla de AGENTS.md
  («REPARTIR TRABAJO POR ARCHIVO GARANTIZA SALIDAS HUÉRFANAS»), pagada de nuevo. Y el bloqueante decía
  que `cursoDe` arma la tarjeta en KanbanEntrega.tsx: vive en ClientesApp.tsx, el kanban sólo lo llama.
- **El quiz «no te dice el resultado» no era del dibujo.** Al alumno real el server sí lo corregía
  (medido en `curso_progreso` del ws10). La que no decía nada era la VISTA PREVIA: sin las correctas,
  daba el quiz por enviado y sin nota. **Regla: la vista previa y la real deciden con la MISMA regla
  (`quizCerrado`), nunca con «¿llegaron las correctas?»** (app/compartido/curso/[token]/tarea-valores.ts).
- **«Hay dos scroll» era la mitad.** En la vista previa la columna del papel NO desbordaba y aun así la
  rueda no movía nada: `overscroll-behavior: contain` sobre un contenedor de scroll que no tiene qué
  scrollear frena la rueda en Chromium (app/_cursos/estilos.ts y la cola de scripts/avatarhype-css.mjs).
  **Regla: o el elemento scrollea de verdad, o va con overflow visible.**
- **El foco: el diagnóstico obvio era falso.** Se buscaba un componente definido adentro de otro o una
  `key` que cambia, y el barrido con el AST dio CERO. La causa vive en `app/_ui/Modal.tsx`: su efecto de
  foco depende de `[onCerrar, arriba]` (línea 152), y `NuevoProducto` le pasaba una flecha nueva en
  cada tecla. La limpieza devolvía el foco atrás y el cuerpo enfocaba la caja. La segunda mitad:
  `autoFocus` no anda adentro de un Modal de la casa, porque su primer render es `display:none`.
  `InvitarAlCurso.tsx` ya lo tenía escrito en un comentario el 08/10 y el commit de esa tarde escribió
  `NuevoProducto` con el mismo bug. **Regla: todo Modal recibe un `onCerrar` de identidad fija** hasta
  que se arregle Modal. El guard (`tests/curso-nuevo-producto.test.ts`) cubre sólo la tab Curso.
- **Un NULL que ya se usó no se achica nunca, y la fila de Leandro es ésa.** Es la única fila de
  `curso_accesos` de la base (id 5, ws10, lead 2625): NULL, invitada a las 01:50 y con 6 ingresos.
  Sigue viendo los dos cursos, y ninguna invitación nueva la acota (`yaSeLeDio`).
- **El teléfono «obligatorio» no lo era en el código**: lo decía la pantalla, que no marcaba
  «opcional». **Si un campo no es obligatorio y otros sí, lo dice.**
- **El guard de los lectores de `.campos` caza una transformación que devuelve la lista entera.** Va
  una excepción escrita con su `contiene` (tests/curso-tareas-secciones.test.ts), no un destructuring
  para esquivar el regex. Sin ella, el árbol no se podía commitear en verde.

**Trampas del entorno** (cada una costó minutos y se lee como un bug del código):

- Con Playwright, `route.continue({ headers: { 'sec-fetch-dest': 'empty' } })` **no pisa
  `sec-fetch-dest`** en Chromium. Abrir el portal así le contó ingresos al lead 2625: de los 6 que
  tiene, hasta 5 son de las mediciones. Lo que no cuenta es pedir el documento con `route.fetch`
  desde Node, con «preview» en el user-agent, y servirlo con `route.fulfill`.
- Un documento servido con `route.fulfill` hace que **Local Network Access bloquee el websocket del
  HMR**. La página queda en «Abriendo el curso…» para siempre, sin un solo error. Se lanza con
  `--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests`.
- Con la lectura de la columna en el árbol y la 0232 sin aplicar, **el portal entero contestó «No
  pudimos cargar tus clases»**. Antes de diagnosticar un portal caído: `git status` de
  lib/curso-datos.ts y si su columna existe en `information_schema`.
- En headless, con la página recién cargada, **el primer `requestAnimationFrame` llega 570 ms tarde**.
  Un banco de foco se abre con un clic, nunca montado al cargar.
- **Cinco `tsc` a la vez llevaron el typecheck a 35 min**, y el lock se vence a los 10. Lo que alcanza
  es un tsconfig acotado en el scratchpad: `files` con los archivos tocados, `include: []`,
  `incremental: false` y `plugins: []` (1509 archivos, ~1,5 min). El `TYPECHECK-RAPIDO.md` y el
  `aplicar-por-pooler.mjs` que nombraban las tareas no existían.

### Lo que quedó SIN hacer

- **`app/_ui/Modal.tsx`, el arreglo de raíz** (UI compartida). (1) Importar `useLayoutEffect`;
  debajo de `const tituloId = useId();`, `const cerrarRef = useRef(onCerrar); useLayoutEffect(() => {
  cerrarRef.current = onCerrar; });`; en la línea 129 `onCerrar()` pasa a `cerrarRef.current()`, y las
  deps de la 152 a `[arriba]`. (2) Sacar el `cajaRef.current?.focus()` de la 121, que corre con la caja
  en `display:none`, y enfocar cuando la capa se ve: `const enfocada = useRef(false); useEffect(() => {
  const caja = cajaRef.current; if (!capa.visible || enfocada.current || !caja) return;
  enfocada.current = true; if (caja.contains(document.activeElement)) return;
  (caja.querySelector<HTMLElement>('[data-autofocus]') ?? caja).focus(); }, [capa.visible]);`. El
  `autoFocus` de React no llega al DOM: por eso el marcador es `data-autofocus`. Medido en un banco con
  una copia parcheada: «Abrir cuenta» pasa de «a» a «ana@x», y `NuevoProducto` sigue andando.
  Mientras tanto vive el mismo bug en `CuentaDeMaKo.tsx:217` («Abrir cuenta», MEDIDO: «ana@x» → «a»).
  Con la misma forma y sin medir: `AdminView.tsx:1025` y `EditarObjetivo.tsx:94` y `:172`. Sólo con la
  flecha: Pricing, CampanasBrowser, CrmBoard y VideoGeneratorApp.
- **`InvitarAlCurso.tsx:139-144`**: el foco al abrir no llega al campo (medido). Va `useFocoInicial(id)`.
  Y `alCerrar.current = onCerrar` en el render (`InvitarAlCurso.tsx:136`, `InvitarAlumnos.tsx:148`, que
  eslint marca) pasa a `useCerrarEstable`. También `Dropdown.tsx:704-738`: al elegir, el foco cae al
  body. Y `PortadaPicker.tsx:243-277`, con el mismo patrón y sin medir.
- **`lib/resend.ts:37`** (Integraciones): `await envCred('RESEND_API_KEY')`. Hasta entonces, con
  `'mako'`, el formulario «ahí mismo» le pide al cliente su correo para tapar una falla nuestra.
- **La fila de Leandro** (decide Martín): `update curso_accesos set productos = '{39}' where id = 5 and
  workspace_id = 10 and lead_id = 2625 and area is null;`, o «Quitar de este producto» en Service
  Delivery (10). Y avisarle que pruebe con un alumno NUEVO. El «Entró N veces» de esa fila subió por las
  mediciones: corregirlo es una escritura, también suya.
- **El correo con Google/Gmail** (punto 14) y los puntos 13 y 15 del audio son de Integraciones.
- **Ideas para decidir, no bugs**: el diseño del mail de invitación; el Curso como pestaña de la
  comunidad (a Leandro le gusta separado: no hay pedido); los niveles del ranking, que salen sin
  configurar; el grupo de WhatsApp del curso desde MaKo.
- **Las correctas de una clase por área y de un quiz reabierto** (`darOtroIntento`,
  lib/curso-entregas.ts): las de un reabierto ya se vieron. Decide Martín.
- **El editor de la tab Curso** (`CursoApp.tsx`) sigue con dos scrolls en la lección: es pasarle
  `unSoloScroll` a CursoUgc.
- **La ficha no muestra qué cursos abre el acceso**, ni deja sacar uno salvo con «Quitar de este
  producto» o «Cortar acceso». El dato ya viaja (`accesoParaPantalla.productos`).
- **No medido: la invitación al ganar en un producto AGREGADO** (`moverEtapaEnProducto`). Con el
  producto puesto, si el lead no tiene fila en `cliente_entrega` de ése, el núcleo contesta «No es
  cliente de ese producto» y no invita (lib/crm-curso-al-ganar.ts). Antes invitaba a lo que veía.
- **Nada de la invitación por producto se vio en la app real**: el modal con su borrador, el correo
  embebido, la lista desde el curso y la tarjeta, Avance y ficha por producto. El ws3 tiene 0 productos.

---

## «No se le envió la invitación a Brigitte»: no había a quién, y /perfil mostraba a la agencia (09/10/2026)

Captura de Joan (Código Inmobiliario, ws13) inspeccionando a Brigitte Eberlin: el cartel decía
«Estás viendo el dashboard de Brigitte Eberlin» y /perfil mostraba «Codigo Inmobiliario» y
codigoinmobiliarioia@gmail.com. Martín: «no se le envió la invitación, ella no puede acceder a su
propio workspace».

**Vive en:** `app/customer-success/ClienteCard.tsx` · `app/customer-success/page.tsx`
(`datosDeMisClientes`) · `app/customer-success/FichaCliente.tsx` (`EquipoDelCliente`) ·
`lib/perfil.ts` · `lib/perfil-sujeto.ts` · `app/perfil/PerfilTabs.tsx`. Guard en
`tests/perfil-vista-de-otro.test.ts`.

### ⚠️ El diagnóstico obvio era el falso: no fue el mail, fue que no había a quién

Las dos sospechas razonables estaban descartadas antes de mirar: la key de Resend de la
plataforma leída antes de la hidratación (arreglada hoy con `envCred`, `3677e675`, desplegada) y el
«Se le mandó el acceso» mirando el objeto y no `enviado` (arreglado el 06/10, `c0e2570b`; su guarda
rota hoy da 29 / 1). Lo medido contra prod:

- ws15: `activo`; `agencia_clientes` 13→15 `aprobado` el 28/09 13:24.
- `usuarios where workspace_id = 15`: **0**. El lead 2486 (ws13): `email` null, sólo teléfono.
- `agencia_altas`: **0 filas en toda la tabla** — nadie pidió nunca sumarla.
- Un barrido de «eberlin / brigit / brieb» en TODAS las columnas de texto de `public`: **su email no
  está en ningún lado**. No hay a quién mandarle nada, y por eso no se mandó.

Es la cuenta que nació con el alta vieja del 28/09 (ver «Una cuenta aprobada con CERO usuarios»,
que ya la dejaba anotada como SIN HACER). Lo que la hizo parecer una falla de envío: **la tarjeta de
la cartera no lo decía**. Con cero personas no hay «Reenviar el acceso» ni «Ver su equipo», y lo único
que quedaba era «Inspeccionar», que se lee como «está todo bien» — y la cuenta se usa todos los días
(la agencia la opera por MaKo: hay conversación en `mako_doer_conv` del ws15 de hoy).

**La regla:** un estado que sólo existe en la base («autorizada, sin nadie adentro») va en la
pantalla desde la que alguien ACTÚA, con la acción al lado. Ahora la tarjeta dice «Nadie puede entrar
todavía» y su menú ofrece «Pedir sumar a alguien» (o «Sumar a alguien» al super admin), que abre la
tab Equipo. ⚠️ Y el cero se afirma sólo si se pudo mirar: `datosDeMisClientes` siembra `[]` para cada
cliente aprobado **sólo si `listarUsuarios` contestó**; caída, no hay entrada y la tarjeta no dice nada.

### Sumar desde la ficha era un verde mudo

El camino con el que se repara una cuenta vacía —el super admin, «Sumar y mandarle el acceso»—
recibía `invitacion` de `/api/admin/usuarios` y cerraba el formulario sin mirarla: con el mail caído,
la persona quedaba adentro sin enterarse. Ahora dice el resultado con `avisoInvitacion`, que mira
`enviado`.

### /perfil: la regla preguntaba por el ROL, y la agencia no es admin

`usuarioDelPerfil` cambiaba de sujeto con `if (sesion.rol !== 'admin') return propio`: sólo el super
admin. La agencia entra por su cookie firmada, no por rol, así que caía en su propio perfil — **y
«Guardar» habría escrito sobre su usuario creyendo tocar el del cliente**. Es la misma omisión que ya
había tenido `estaImpersonando` («la agencia también está viendo a otro»). Y el vacío caía a
`?? propio`: en un cliente sin nadie, el super admin veía SU perfil rotulado como el del cliente.

**La regla:** «¿de quién son estos datos?» se contesta con las MISMAS dos puertas que
`getWorkspaceActual` —pestaña/impersonación para el super admin, `contextoDeAgencia` para la
agencia—, nunca con el rol, y en la vista de otro un vacío se dice, nunca se rellena con quien mira.
La decisión es `deQuienEsElPerfil` (pura, con DOS agencias en el test); la persona es
`titularDelCliente`, que es `aQuienReinvitar`: el dueño de la cuenta es uno solo. `setPerfil` resuelve
lo mismo en cada POST, y sin nadie adentro contesta error en vez de un «ok» que no escribió nada.
Medido en el navegador (dev :3022): agencia en ws15 → «Perfil de Brigitte Eberlin / Esta cuenta
todavía no tiene a nadie adentro.»; en ws17 → joan prueba, email de sólo lectura; el POST de prueba
cortado; un POST real sobre ws15 → 500 «Esta cuenta todavía no tiene a nadie adentro.», 0 filas.

### Lo que quedó SIN hacer

- **El acceso de Brigitte.** Hace falta SU email, y no lo tiene nadie en la base. Con él: Joan,
  tarjeta → «Acciones» → «Pedir sumar a alguien»; Martín lo aprueba y sale el mail. O Martín directo
  desde la ficha de Brigitte → Equipo → «Sumar y mandarle el acceso». Después, verificar
  `invitacion_enviada_at` en su fila.
- **La foto subida en la vista de otro** queda en la carpeta del que mira (`/api/perfil/avatar` arma
  la ruta con la sesión): se ve bien, pero el archivo no es «de» la cuenta.
- **Los otros lectores de `getPerfil`** (el usuario del menú en /plan y /customer-success, el guion
  del audio) ahora también muestran al cliente en la vista de agencia, como ya pasaba con el super
  admin. No se miraron uno por uno en el navegador.

---

## Lo que quedó planificado y se cerró el 13/10/2026: el foco de los diálogos, la ficha y el STT de los cursos

Martín, por la sesión «Estrategia 3 CUENTAS»: «dile a esos chats que continúen y cierren lo que ya habíamos
planificado». Lo cerrado sale de las listas «SIN hacer» del 08/10 y del 09/10 y del relevo del 10/10.

**`app/_ui/Modal.tsx`, el arreglo de raíz.** El parche escrito el 09/10 se aplicó tal cual: `onCerrar` por un
ref y el foco cuando la capa se ve (`capa.visible`), con `data-autofocus` como marcador. Con eso dejan de perder
el foco letra por letra los nueve diálogos que lo tenían, sin tocar ninguno (`CuentaDeMaKo`, `AdminView`,
`EditarObjetivo`, Pricing, CampanasBrowser, CrmBoard, VideoGeneratorApp…). Lo fija `tests/modal-foco.test.ts`.
**No medido en el navegador**: el banco del 09/10 lo midió con una copia parcheada, no con el archivo commiteado.

**La ficha numeraba «2. …» una clase que el alumno ve con una sola tarea.** `gruposPorTarea`
(`app/customer-success/curso-ficha-lectura.ts`) armaba las tareas sin la consigna en texto de la clase y sin el
filtro de `tareaVacia`, que el portal sí aplica. La regla: **lo que la ficha numera es lo que ve el alumno**, con
la misma función. Ahora recibe la consigna (`RespuestaTarea` → `tarea`, `FichaCurso.tsx`).

**«Comentar en la comunidad» se completaba con CUALQUIER comentario.** `verificarComunidad`
(`lib/curso-tarea-comunidad.ts`) comprobaba que el comentario fuera del alumno, no DÓNDE: con un post elegido
por el equipo, ahora tiene que ser en ése; sin él (el default es «el último fijado»), en un post fijado del feed
que no sea el hilo de una clase. ⚠️ Acepta CUALQUIER fijado, no sólo el último: si se fija otro post después,
un comentario en el anterior sigue contando. Es a propósito (no se le quita una tarea hecha a nadie por un
cambio del equipo) y queda escrito acá.

**Borrar la clase ABIERTA con cambios sin guardar los perdía** (el «Deshacer» devuelve la clase guardada).
`borrar` (`CursoApp.tsx`) pregunta primero con `leccionAbierta.pedirSalida`, como cualquier otra salida; otra
clase se borra como siempre.

**El editor de la tab Curso tenía dos scrolls en la lección**: `CursoApp` monta `<CursoUgc unSoloScroll>`, el
mismo prop que ya usaba el portal. Conocimientos sigue con su columna.

**«Permisos del curso» dibujaba «Todos los módulos» en un curso que el acceso NO abre** (mig 0232). El dato ya
viajaba (`acceso.productos`) y la caja lo ignoraba: se leía como que el alumno lo ve entero. Ahora dice «No se
le abrió este curso.» y no ofrece módulos. Un acceso sin leer (`undefined`) se dibuja como siempre.

**El STT de los cursos pasa el detector de bucles** (`lib/transcribe.ts`, ver hallazgos-ia): los tres pedidos a
un STT del archivo, con `tests/transcribe-degenerado.test.ts` contando un detector por pedido.

**Y el `vive[]` del área** declara la mig 0232, `lib/curso-invitar-reglas.ts`, `dialogo-foco.ts`, el feedback
de la noche del 08/10 y `tests/modal-foco.test.ts`: `/admin/dev/customer-success` no veía ese trabajo.

**Vive en:** `app/_ui/Modal.tsx` · `app/customer-success/curso-ficha-lectura.ts` · `lib/curso-tarea-comunidad.ts` ·
`app/customer-success/curso/CursoApp.tsx` · `app/customer-success/FichaCurso.tsx` · `lib/transcribe.ts`

### Lo que quedó SIN hacer

- **Imágenes huérfanas** de un borrador descartado (`lib/curso-purga.ts:63-65`): borrar de storage sin la
  prueba en un workspace con datos es el riesgo; no se tocó.
- **La portada de un módulo VINCULADO sin candado** que se elimina queda (`portada:etapa:<clave>`): no hay fila
  de `curso_modulos` que vaya a la papelera, así que la purga (`lib/curso-papelera.ts`) no la ve, y un módulo
  nuevo con la misma clave la hereda. Cosmético.
- **La vista previa** no busca el «último fijado» de un «Comentar» y dice que no hay post.
- **Código muerto** (`urlSubida`, `descartarVideo`, `duracionDeArchivo`, `{ tipo }` en `CambioClase`,
  `rotuloTipo`, `camposEnOrden`, `guardarClase`, `conteoDeNotas`, `ChecklistCurso`, la prop `onboarding`).
- **El renombrar, el menú «…» y la obligatoria no revalidan** (el Atrás puede mostrarlos viejos): se dejó a
  propósito; revalidar cada acción inmediata hace parpadear el editor.
- **Nada de esto se abrió en la app real**: el ws3 sigue con 0 productos. · *2026-10-13 Customer Success*

---

## El goteo atado al kanban, verificado de punta a punta en el ws3; y el curso se llama como su OFERTA (13/10/2026)

Martín, por «Estrategia 3 CUENTAS»: «pasale todos los feedback de las 3 reuniones a los chats y diles que
lo implementen completo... De punta a punta». A esta área le tocó: Mauricio va a probar la liberación de
clases atada al movimiento de tarjetas (Fathom 858473424 @30:53), y antes había que comprobar que anda.

**Funciona, y no hubo nada que arreglar.** Se probó con las MISMAS funciones que usa la app, en el ws3:
`crearProductoConFunnel` → `crearClase` en tres etapas → `createLead` → `moverClienteDeEtapa` (el choke
point que llama el arrastre del kanban, `app/customer-success/actions.ts:497`) → `armarVistaAlumno` y
`claseDelAlumno` (lo que lee el portal, que es `force-dynamic`: no hay caché que tape el cambio). Mover la
tarjeta abre la etapa; `guardarTarea` + `alEnviarTarea` (la ruta del alumno) con la tarea obligatoria
mueve la tarjeta solo y abre la siguiente. **La pantalla no se miró**: con la RAM en zona roja no se
levantó ni el dev server ni Chrome.

**Dos comportamientos que no son bugs y van a sorprender** (los dos por diseño, D2):
- **Un candado propio en un módulo-etapa REEMPLAZA a la etapa.** «Público» lo abre para todos; en
  Privado, «A mano» o «Días después de entrar» hacen que llegar a la etapa no abra nada. Medido: con «A
  mano», el módulo quedó cerrado con la tarjeta en su etapa.
- **Mover la tarjeta hacia atrás vuelve a cerrar lo de adelante**: el estado de una etapa sale de su
  POSICIÓN (`estadosDeEtapas`), no de un registro de lo que ya se abrió.

**El fixture queda en el ws3**, que hasta hoy tenía cero productos y era la razón por la que nada del
curso se había visto en la app real: producto 43 «Prueba goteo kanban» (oferta 16, embudo 30), lead 2664
sin teléfono ni email, clases 165-167. El script vive en el scratchpad de la sesión; el método es la
cadena de funciones de arriba.

**El curso se llama como su OFERTA** (`lib/curso-nombre.ts`, b8b7c735). Martín, por el CRM: «los cursos
deberían tener el nombre de una OFERTA». Orden: el título puesto a mano; si no, la oferta principal si hay
UNA activa; si no, el producto. Con dos principales distintas no se adivina. Medido en prod: 12 productos
con una principal, 9 con ninguna, ninguno con dos; y hoy nadie ve un cambio (el ws1 ya tenía puesto a mano
el mismo nombre que su oferta). ⚠️ El lector (`nombresDeCursos`) devuelve el nombre SIN el título a mano
salvo con `conTitulo`: el editor y el portal lo dibujan encima, y si viniera adentro, borrar el título
dejaría el viejo hasta recargar.

**Vive en:** `lib/cs-mover-etapa.ts` · `lib/curso-portal.ts` · `lib/curso-bloqueo.ts` · `lib/curso-avance.ts` ·
`lib/curso-nombre.ts` · `lib/curso-nombre-datos.ts` · `app/customer-success/curso/bloqueo-editor.ts`

### Lo que quedó SIN hacer

- ~~**El mail de invitación** sigue nombrando el curso por el producto~~ — lo cerró la sesión CURSOS el
  13/10: `depsReales.cursos` (`lib/curso-invitar.ts`) llama a `nombresDeCursos(conClases, { conTitulo: true })`.
- **Mirarlo en la pantalla** con el fixture del ws3.
- **Rojos ajenos medidos el 13/10 ~20:30**, sobre archivos sin commitear de otras sesiones:
  `tests/curso-apariencia.test.ts` (dos, sobre `app/_cursos/fuentes.ts`) y `tests/curso-invitar-reglas.test.ts`
  («la invitación a UN producto…», sobre `lib/curso-invitar.ts`). · *2026-10-13 Customer Success*

---

## El nombre del producto (el CRM) no nombra NUNCA un curso, ni de último recurso (14/10/2026)

Martín: «Elimina el nombre del "producto" que hoy en día se llama "nuevo CRM", no debe aparecer nunca
como nombre del curso». No hay ninguna fila que se llame así (medido): el producto ES el CRM, nace con el
nombre del embudo (`crearProductoConFunnel`), y lo que pidió es que ese nombre no llegue a un curso.

**Lo que el arreglo del 13/10 había dejado abierto: dos puertas, y las dos parecían prudentes.** La regla
caía al producto «si no hay oferta» y cada pantalla caía al producto «si la lectura falla» (`?? s.nombre`,
`?? prod.nombre`, el catálogo en la ficha). Un respaldo que es justo el dato prohibido no es un respaldo:
es la regla vieja por la puerta de atrás. Ahora `nombreBaseDelCurso` **no recibe** el nombre del producto
(la firma es el guard: el test mira su aridad), el lector no lee la tabla `productos`, y sin nombre cada
superficie pone su genérico: «Tu programa» al alumno, «Curso sin nombre» al equipo.

**Y había dos lugares que nombraban el curso sin pasar por la función**, que el 13/10 no se vieron porque
no dicen «curso»: la **comunidad** (`ajustes.nombre ?? producto.nombre`, en inicio y About, que ve el
alumno, y el selector de la tab) y la **API de MaKo** (`listar_cursos` con `p.nombre`). Se encontraron con
un `git grep` de toda lectura de `productos`/`.nombre` en el área, no buscando la palabra «curso».

**Efecto medido en prod:** cambia un solo curso, «Service Delivery & Ops» (ws10, sin oferta).

**Vive en:** `lib/curso-nombre.ts` · `lib/curso-nombre-datos.ts` · `lib/comunidad-datos.ts` ·
`lib/api-mako/areas/curso.run.ts` · `tests/curso-nombre.test.ts`

### Lo que quedó SIN hacer

- **La oferta que nace con el CRM se llama como el CRM**: `crearProductoConFunnel` crea producto, oferta
  y embudo con el mismo nombre, así que un curso nuevo hereda el nombre del CRM por la oferta. Espera a
  Martín: si esa oferta puede nombrar el curso o tiene que esperar a que la renombren en Offer.
- **El kanban de Customer Success sigue nombrando el SERVICIO como el producto** (`SelectorServicio`,
  `FichaEntrega`, /m/cs): no es el nombre del curso y no se tocó.
- ~~El comentario de `depsReales.cursos` todavía dice «si no el producto»~~ — lo corrigió CURSOS en
  a744e127. · *2026-10-14 Customer Success*

---

## Un refactor commiteado sin typecheck dejó un nombre vivo, y el test lo fijaba (14/10/2026)

**Síntoma:** el push integrado del 14/10 (e4c8a6d7) corrió el typecheck completo por primera vez en
horas y encontró `alCerrar.current()` en `InvitarAlCurso.tsx`, un ref que f729063e (el arreglo del foco)
había reemplazado por `useCerrarEstable`. Los tests del área estaban en verde.

**Por qué no lo vio nada:** el typecheck no corría (el vigía de RAM lo mataba toda la noche) y el guard
de `tests/curso-invitar.test.ts` buscaba el texto LITERAL `'alCerrar.current()'` para comprobar que el
modal no se cierra antes de saber si salió el mail. O sea que el test fijaba el resto del refactor: con
la línea vieja viva pasaba, y sin ella habría fallado. Un test que lee fuente por un nombre fija ese
nombre, para bien y para mal. La pestaña «Del embudo» (901e5cf7) trajo un error de la misma familia: se
escribió contra un `ocupar` que el modal no tiene.

**La regla, mientras el typecheck no pueda correr:** antes de commitear un refactor que saca un
identificador (un ref, una prop, un helper), `git grep` de ese nombre en el archivo y en los tests que lo
leen. Si un test lo nombra, el test se actualiza en el mismo commit que el código, y el grep tiene que
dar cero usos en el fuente.

**Vive en:** `app/customer-success/curso/InvitarAlCurso.tsx` · `tests/curso-invitar.test.ts` ·
`app/customer-success/curso/InvitarAlumnos.tsx` · *2026-10-14 Customer Success*

---

## La fuente en un desplegable como el de Google Docs, y los comentarios en cada clase (14/10/2026)

Martín, sobre el menú de la marca del curso: «Mejora el desplegable de las tipografías, que sea uno como cualquier otro,
copialo de como lo tiene google docs... Pero no inventes cosas... Y la opción de comentarios no debería ir allí, debería ir en
la edición de cada clase». Commit 0255c855.

**«Copiar Docs sin inventar» se decidió por lo que Docs TIENE, no por lo que se le parece.** Se copió el botón con la fuente
elegida y la lista alfabética con cada nombre escrito con su letra. No se copió lo que acá no existe («Más fuentes», el submenú
de pesos). Se sacó lo inventado del 13/10: la palabra al lado de cada fuente («Neutra», «Clara»…) y los cuatro cajones. Y
no lleva tilde en la elegida aunque Docs sí, porque el desplegable de la casa no lo lleva por pedido de Martín (29/09): «como
cualquier otro» le gana a «como Docs» en lo que se contradicen. El catálogo conserva `tipo` porque lo muestra el Dashboard
(`TIPOGRAFIAS`, lib/graficos-temas.ts).

**La lista se monta ADENTRO del menú de la marca** (`portalTo`): ese menú se cierra con un `mousedown` fuera de su caja (ver
hallazgos-ui, «Un Dropdown adentro de un popover…»). Y la carga perezosa de las hojas sobrevivió al cambio con un
`MutationObserver`: la lista del desplegable aparece al abrir y cambia al buscar, y un renglón nuevo sin observar quedaría
dibujado con la letra de respaldo — una muestra que miente.

**Los comentarios pasaron a ser de cada clase** (`comentarios:clase:<id>`, el mismo molde que `portada:clase:<id>`), con su
interruptor en el «…» de la clase, en una sección propia donde el módulo lleva la del kanban. **Lo que hizo barato el cambio
fue MEDIR antes**: ninguna fila `comentarios` en prod, así que no hubo migración de datos ni regla de «heredar del curso». Sin
esa medición, la salida prudente era mantener el ajuste del curso como default de las clases, y eso deja un ajuste que nadie
puede ver ni cambiar. Se tocaron los cuatro lectores (el portal, el editor, el server que hace cumplir el ajuste y la
validación al guardar) y la papelera, que ahora borra también esa fila al purgar una clase.

**Vive en:** `app/_cursos/SelectorFuente.tsx` · `app/_cursos/fuentes.ts` · `lib/curso-estilo.ts` (`comentariosClase`,
`comentariosDeClase`) · `lib/comunidad-datos.ts` (`comentariosDeLaClase`) · `app/customer-success/curso/MenuCurso.tsx` ·
`app/customer-success/curso/estructura.ts`

### Lo que quedó SIN hacer

- **Verlo en el navegador**: el desplegable adentro del menú oscuro del curso (que el clic elija y no cierre el menú) y el
  interruptor en el «…» de una clase. Es visual: lo mira Martín.
- **El Escape con la lista abierta** cierra también el menú de la marca (sin medir; ver hallazgos-ui). · *2026-10-14 Customer Success*

## «Invitar al curso» como ⚡ Acción de un flujo (17/10/2026, tarjeta #874)

- **La acción ya existía, en una rama que no llegó.** `invitar_cliente_curso_cs` estaba madura en
  `wip/api-acciones-1410` («A MEDIAS — NO PUSHEAR», quieta desde el 14/10). Se trajo SÓLO ésa (con sus ayudantes
  `revisando`, `sinLanzar`, `esServicioSuyo`, `cursosDe`) sobre el `invitarAlCurso` de main: lo que manda y anota es
  el mismo núcleo de la ficha, la tarjeta del kanban y el CRM al ganar. El resto de esa rama sigue sin traer.
- **En un flujo «ya invitado» y «ya entró» son «ya está así»** (`yaEstaba`): éxito sin alarma al dueño en cada lead
  que vuelve a pasar. El éxito sale de `enviado`, nunca de que haya un resultado.
- **El curso se ELIGE** (control `curso`, lib/editor-acciones.ts): un `productoId` que habla de un curso lista los
  productos con clases vivas (`curso_clases`, en /api/flujos/opciones). El de un cobro («Producto del catálogo», con su
  precio) sigue siendo un número: no es un curso. Sin elegir, «Los que ya ve».
- **El link para los mensajes ya existía:** `{{curso_link}}` (lib/variables-aviso.ts), sólo para el lead y sólo si ya
  se le dio el acceso. Va en un mensaje DESPUÉS de la acción.
- ⚠️ **Una puerta nueva a «qué ve» o «de qué es cliente» se CLASIFICA** en tests/curso-invitar-reglas.test.ts
  (`QUE_VE`, `ES_CLIENTE`): la acción usa las dos, como el núcleo.
- **El link «a mano» que pidió Mauricio para una contingencia ya está:** la pestaña «Curso» de la ficha
  (app/customer-success/FichaCurso.tsx) tiene «Copiar link», mandarlo por WhatsApp y reenviar la invitación.

**Vive en:** `lib/api-mako/areas/cs.def.ts` y `cs.run.ts` (`invitar_cliente_curso_cs`) · `lib/editor-acciones.ts`
(«Invitar al curso», control `curso`) · `app/api/flujos/opciones/route.ts` (`cursos`) · `app/_components/CamposAccion.tsx`
(`SelectorCurso`) · test: `tests/accion-invitar-curso.test.ts`
