# Hallazgos — Customer Success

El bucle de entrega: Whop, la tarea de cada bloque y las juntas con clientes.
Dónde vive el código: `lib/whop.ts`, `lib/programa-catalogo.ts`, `lib/cs-avance.ts`,
`lib/cs-respuestas.ts`, `app/api/webhooks/whop/`, `app/admin/dev/customer-success/`.

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

**Lo que quedó SIN hacer:** que las cuatro propaguen el error. No se tocaron porque las comparten
la pantalla `/customer-success` y el webhook de Whop, y cambiar el contrato es cambiarlo para los
dos. Mientras tanto la API de MaKo tiene sus copias estrictas (`bloqueDe`, `bloquesDe`,
`mapaLeccionesEstricto` en `lib/api-mako/areas/cs.helpers.ts`) y relee la cola después de crear
un borrador: son dos implementaciones de la misma lectura, y la de la pantalla sigue diciendo
cero.

---

## Una variable CSS que no existe no falla: invalida la declaración y sigue

**Vive en:** `app/customer-success/programa/ProgramaApp.tsx` (corregido)

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

**Vive en:** `app/customer-success/programa/ProgramaApp.tsx`

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
tests/programa-catalogo.test.ts · app/customer-success/programa/ProgramaApp.tsx (tab
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

**Vive en:** `lib/banco-skills.ts`, `app/customer-success/programa/` (tab «Tu material»)

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

## Whop paginaba hasta un tope y devolvía lo cortado como completo

**Vive en:** `lib/whop.ts` (`todas`)

Al llegar a 20 páginas con `has_next_page` todavía en `true`, devolvía `{ ok: true }` con
lo acumulado: una lista cortada con la misma cara que una completa. Ahora es un error.

Para las interacciones (clientes × 44 clases) el corte dejaba clientes enteros «sin haber
visto nada». Pero **para el sincronizador del programa lo parcial era PEOR que un error**:
`cs-sync-whop` es idempotente por título, así que una lección que no aparece en la lista
cortada la vuelve a crear — duplicada, en el Whop de Mauricio. Alumnos e interacciones,
que crecen con la cartera, suben su tope a 400 páginas.

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
