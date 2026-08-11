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

*Corrida del 2026-08-11: 16 agentes mapeando el código para el bucle de entrega, más la
verificación en vivo contra la cuenta real de Whop.*
