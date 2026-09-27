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
