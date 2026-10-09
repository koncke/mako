# Hallazgos — la API de MaKo (registro, confirmación y canales)

Todo lo que vive en `lib/api-mako/` fuera de `areas/` (registro, validación, vista,
ejecución, pendientes y propuestas), `app/api/v1/**`, las dos pantallas que confirman
(`app/mako/pendientes`, `app/mako/revisar/[id]`) y la parte del doer de WhatsApp que
consume el registro (`lib/mako-doer-in.ts`, `lib/mako-doer-acciones.ts`,
`lib/respuesta-doer.ts`).

El diseño y el porqué de cada decisión están en [api-mako-diseno.md](api-mako-diseno.md);
la referencia generada, en [api-mako.md](api-mako.md). Acá va lo que costó. Lo que las
áreas aprendieron sobre SUS libs (Evolution, Zernio, Meta, `getSetting`, closing…) está
en el documento de cada área. Lo de la skill del cliente, en
[hallazgos-agente.md](hallazgos-agente.md).

---

## ⚠️ Pasar una acción a `pantalla` no la saca del chat: la tool vieja del mismo nombre gana

**Síntoma.** `proponer_presupuesto_campana` se declaró `confirmacion: 'pantalla'` (mueve
plata) y por WhatsApp MaKo seguía diciendo «¿confirmás con un sí?». El «sí» se cerraba
en error.

**Causa.** Dos cosas que no se ven desde la def:

1. El doer arma sus tools con `MAKO_TOOLS + MAKO_ACCION_TOOLS`, `toolsDelRegistro` excluye
   esos nombres y `runTool` le da prioridad a `NOMBRES_ACCION`. Una operación del registro
   que comparte nombre con una tool vieja **nunca llega a WhatsApp**: corre la vieja.
2. `porId()` indexa el `tipoPendiente`. La pendiente `meta_presupuesto` que dejaba la tool
   vieja resolvía a la def de pantalla, pasaba `gatingOk` y `confirmarPendiente` corría su
   `ejecutar()` sin mirar la `confirmacion`. Lo que lo frenaba era una marca local del
   runner de ads (`desdePantalla`). Sacar el `tipoPendiente` era peor: caía en
   `TIPOS_HEREDADOS` y se ejecutaba por `ejecutarAccion`.

**Regla.** Una acción de pantalla no tiene gemela de chat. `confirmarPendiente` y el
`confirmar_accion` viejo cierran sin ejecutar toda pendiente cuyo tipo resuelve a una
acción de pantalla, **antes** de reclamarla. `meta_presupuesto` salió de
`TIPOS_HEREDADOS` y la tool vieja salió de `MAKO_ACCION_TOOLS`. El test
«lo que se confirma en PANTALLA no se confirma por chat» cruza los `proponer('…')` del
doer viejo y `TIPOS_HEREDADOS` contra el registro.

**Vive en:** `lib/api-mako/acciones.ts` (`confirmarPendiente`, `TIPOS_HEREDADOS`) ·
`lib/mako-doer-acciones.ts` · `lib/mako-doer-in.ts` (`runTool`) ·
`tests/api-mako-registro.test.ts` · *2026-09-16 api-mako-areas*

---

## ⚠️ Una LECTURA que devolvía un link a un borrador se anunciaba como borrador creado

**Síntoma.** «¿Cómo va el borrador del plan?» y MaKo contestaba «Listo, te armé el
borrador».

**Causa.** El doer parseaba la salida de **todas** las tools: si había un `link` a
`/plan/revisar/` en el primer nivel, lo guardaba como `linkBorrador` y pisaba la respuesta
del modelo con `mensajeBorrador()`. Lo mismo con `url` a `/crm/revisar/` y el mensaje de
lead propuesto. `ver_borrador_plan` y `ver_estado_borrador` tenían esa forma.

**Regla.** Solo una ACCIÓN crea un borrador: las tres capturas de link del doer excluyen
las operaciones que el registro declara `lectura` (`!esLectura`), y el test lo exige en
las tres. Las lecturas del plan igual devuelven `link_revision`, por si otra capa hace la
misma suposición.

**Vive en:** `lib/mako-doer-in.ts` (`runTool`) · `lib/api-mako/areas/plan.run.ts` ·
*2026-09-16 api-mako-areas*

---

## ⚠️ Un link que lee un modelo lo escribe el código, también el de `/mako/revisar`

El doer ya escribía por código el link del borrador del plan y el del lead, porque el id
son 17 caracteres al azar y el modelo los copia mal (pasó en producción, de las dos
formas: un link que no existía y uno que abría otro borrador). Las acciones de pantalla
del registro devolvían su link a `/mako/revisar/<id>` y el modelo lo pasaba a mano.

**Regla.** `conLinksDeAccion` deja la respuesta intacta si trae exactamente los links que
devolvieron las tools; si no, saca todo `/mako/revisar/` del texto y agrega los
verdaderos. Tiene test con el caso del carácter de menos.

**Sin hacer:** los links a `/whatsapp?chat=…` que arman las áreas de WhatsApp y CS siguen
pasando por el modelo, y un `?chat=` que no matchea abre la conversación de otra persona
(ver [hallazgos-comunicacion.md](hallazgos-comunicacion.md)).

**Vive en:** `lib/respuesta-doer.ts` · `lib/mako-doer-in.ts` · *2026-09-16 api-mako-areas*

---

## ⚠️ Confirmar reclama antes de ejecutar, así que un corte deja la fila colgada para siempre

**Síntoma esperado.** Una pendiente en `confirmada` que nunca pasa a `ejecutada` ni a
`error`, o una propuesta `aplicada` sin `ok`, que desaparece de toda bandeja. Con el
costo de la IA ya pagado.

**Causa.** Es a propósito: `reclamarPendiente` y `marcarAplicada({ en_curso: true })`
corren **antes** de `ejecutar()` para que dos «sí» o dos clicks hagan una sola cosa, y lo
que falla no vuelve a `pendiente` para no invitar a un segundo intento sobre algo que pudo
escribir a medias. Pero si la plataforma corta la función en el medio, no corre ningún
`catch`. Y el techo lo pone quien confirma: `/api/v1` corta a 60 s, y las dos páginas de
`/mako` no declaraban `maxDuration`, así que sus server actions heredaban el default. Las
áreas que lo reportaron (closing, email, contenido, negocio, cs) confirman acciones que
analizan llamadas, mandan broadcasts o corren varios modelos.

`after()` no lo evita: comparte el techo de la invocación que lo lanzó.

**Regla.**
- `/mako/revisar/[id]` y `/mako/pendientes` declaran `maxDuration = 300`.
- Lo que encadena modelos o sincroniza un tercero no lleva `'http'`.
- **Todo lo que se pueda saber sin escribir falla en `preparar()`**, no en `ejecutar()`.
  Un candado en `ejecutar()` («solo lo confirma quien lo propuso») consume la pendiente
  aunque rechace: queda en `error` y el dueño legítimo ya no la puede confirmar.

**Sin hacer:** `mako_acciones_pendientes` no tiene `reclamada_at`, así que no hay forma de
saber cuándo se reclamó ni un barrido que pase a `error` las `confirmada` viejas. Las
lecturas del área mako (`ver_pendiente`, `ver_propuesta_accion`) informan
`sin_resultado` pasados 5 minutos, que es una inferencia.

**Vive en:** `lib/api-mako/acciones.ts` · `lib/mako-pendientes.ts` (`reclamarPendiente`) ·
`app/mako/revisar/[id]/page.tsx` · `app/mako/pendientes/page.tsx` ·
*2026-09-16 api-mako-areas*

---

## ⚠️ La pantalla genérica `/mako/revisar` no es neutra: cinco formas en que confirma otra cosa

La pantalla arma un formulario desde `parametros`, guarda el INPUT y al confirmar vuelve a
validar y a correr `preparar()`. Cada paso tiene una trampa:

1. **Listas partidas por comas** *(resuelto)*. Un `string[]` se unía con `, ` y se partía
   por `,` al confirmar, aunque nadie lo tocara: «Llamar a Ana, y después a Luis» volvía
   como dos ítems. Ahora es un valor por renglón.
2. **No se puede vaciar un campo** *(sin hacer)*. La pantalla manda `null` por lo vaciado y
   `validarInput` omite `null`, `''` y la ausencia por igual. Un runner que completa con lo
   guardado (`str(input, k) ?? previa.k`) reinstala el valor: la persona borra la garantía,
   confirma, ve «actualizado» y la garantía sigue. El área equipo usa `-` como «vaciar».
   El arreglo de raíz es que la pantalla distinga ausente de vacío y que
   `lib/api-mako/validar.ts` deje pasar `''`.
3. **Se vuelve a leer la base al confirmar.** Lo que `preparar()` resuelve contra la base,
   y no desde el input, puede cambiar entre la propuesta y el clic. Con un texto que
   reescribe un webhook (el borrador de un DM de Instagram) eso mandaba un DM que nadie
   vio. La cura es un `proponer()` propio que FIJE el valor en el input guardado.
4. **El título no sigue al formulario** *(sin hacer)*. `RevisarAccion` pinta el `resumen`
   de cuando se propuso. Si la persona cambia un booleano de sentido opuesto (prender o
   apagar), la pantalla afirma una acción y ejecuta la otra.
5. **`object[]` es un JSON crudo** *(sin hacer)*. Las cuotas de un plan de pagos se editan
   como JSON en un textarea.

**Regla.** Una acción de edición por la pantalla genérica parte de la fila existente y
declara en `preparar()` lo que compara contra la base. Si el dato que importa vive en la
base, se fija en el input al proponer.

**Vive en:** `app/mako/revisar/[id]/RevisarAccion.tsx` · `app/mako/revisar/[id]/acciones.ts` ·
`lib/api-mako/validar.ts` · `lib/api-mako/acciones.ts` (`aplicarPropuestaGenerica`) ·
*2026-09-16 api-mako-areas*

---

## ⚠️ Las propuestas genéricas no son idempotentes, y la cura obvia bloquea repetir una acción

**Síntoma.** Un reintento del modelo o de n8n deja dos propuestas iguales.

**Causa.** `ejecutar.ts` solo pasa `ref` si el input la trae, y ninguna operación la
declara (declararla pintaría un campo «ref» en el formulario). La cura obvia es una ref
determinística (`<op>:<hash del input>`), y **no sirve tal cual**: `crearPropuesta` devuelve
la existente si está `pendiente` **o `aplicada`**. Con una ref por contenido, «pausá la
campaña» → «activala» → «pausala de nuevo» devolvería el link de la primera pausa ya
aplicada, y no se podría volver a hacer.

**Sin hacer.** La ref tiene que bloquear solo contra una `pendiente` igual, no contra una
aplicada. Mientras tanto, duplicar es el mal menor: una propuesta de más se descarta.
Aparte: la ref por defecto de un lote de leads (`lead:<tel1,tel2,…>`) se corta a 200
caracteres, y dos lotes que comparten los primeros ~15 contactos chocan.

**Vive en:** `lib/api-mako/ejecutar.ts` · `lib/propuestas.ts` (`crearPropuesta`) ·
*2026-09-16 api-mako-areas*

---

## ⚠️ `gating.tab` mira la CAPA del workspace, no a la persona

**Síntoma.** Un closer podía, por MaKo, cerrar experimentos, leer la Retro entera o ver
las métricas de marketing que su pantalla le esconde.

**Causa.** Esas páginas hacen `requireRolWs([])` (solo admin). El registro, con
`gating.tab`, solo pregunta si la capa compró la tab.

**Regla.** Si la página de la tab hace `requireRolWs([])`, cada operación del área lleva
`rolMinimo: 'admin'`.

Dos trampas más de la vista, resueltas:
- **Solo miraba la barra principal.** `integraciones` vive en el menú de la foto
  (`userNavKeys`) y el super-admin, que ve `/integraciones`, recibía 404 en todas sus
  operaciones. Ahora `tabsDeCapa` pregunta con `tabEnCapa`, la misma función del gate de
  las páginas.
- **Fallaba abierto.** Un error leyendo el workspace dejaba `tabs = null`, que significa
  «ve todo»: con la base lenta, un cliente `pm` veía el CRM. Ahora queda sin tabs.

**Vive en:** `lib/api-mako/vista.ts` · `lib/api-mako/registro.ts` (`gatingOk`,
`tabsDeCapa`) · *2026-09-16 api-mako-areas*

---

## ⚠️ Lo que el registro declara sin `'http'` puede salir igual por una puerta vieja

- **`/api/agente/consultar` sirve `historial_whatsapp` y `reuniones_lead` por bearer**
  (`CONSULTAS_AGENTE`), aunque el registro declara las dos sin `'http'`: salen por HTTP la
  conversación de WhatsApp de un lead y el `share_url` público de Fathom, que abre la
  grabación y la transcripción de la llamada de venta. En `/api/v1`, `reuniones_lead` ya es
  `SIN_HTTP`. **Decisión de producto pendiente:** sacarlas de la puerta vieja rompe las
  skills ya instaladas.
- **Las tools viejas devuelven el error adentro de un éxito.** `listar_horarios_reunion` y
  `reuniones_lead` contestan `{ok:false}` o «No pude buscar…» como texto, y el registro lo
  trata como lectura exitosa: HTTP 200 con la falla adentro. *(sin hacer)*
- **El script del Pixel pesa 86 KB** y ni `runTools` ni el runner del registro recortan un
  tool_result. Nada que devuelva el snippet sale por un canal donde lo lee un modelo.
- **Los errores de Postgres salían como 400 con nombres de tablas.** `esNuestro` solo
  reconocía algunos textos de infraestructura; «invalid input syntax…» iba crudo al
  tercero. Ahora reconoce los mensajes de Postgres y el prefijo «Query X falló».

**Regla.** «No sale por HTTP» se verifica contra TODAS las rutas con bearer, no contra el
registro. El snapshot `tests/api-mako-http.snapshot.txt` solo ve el registro.

**Vive en:** `lib/agente-consultas.ts` · `lib/api-mako/ejecutar.ts` ·
`lib/api-mako/areas/crm.def.ts` · `lib/api-mako/areas/landing.run.ts` ·
*2026-09-16 api-mako-areas*

---

## ⚠️ El email de quien confirma viaja en `resultado`

`aplicarPropuestaGenerica` guarda `por: ctx.actor` (el email de la sesión) en el mismo JSON
que el resultado, y `confirmarPendiente` y `cancelarPendiente` lo concatenan en el texto
(«confirmado por <email>»). Toda lectura que devuelva `resultado` crudo por HTTP filtra
datos del equipo. Las lecturas del área mako lo sanean con lista blanca y regex.

**Sin hacer:** guardar el actor en un campo propio. Mientras tanto, una lectura nueva que
exponga `resultado` tiene que sanearlo.

**Vive en:** `lib/api-mako/acciones.ts` · `lib/api-mako/areas/mako.run.ts` ·
*2026-09-16 api-mako-areas*

---

## ⚠️ Lecturas que escriben

`listar_pendientes`, y `confirmar`/`cancelar` al elegir, llaman a `vencerExpiradas`
(UPDATE a `vencida`) antes de leer. Las lecturas nuevas del área mako lo esquivan filtrando
`vence_at > ahora`. Lo mismo pasa en libs de otras áreas (`tzDeWorkspace` persiste la zona,
`listAccounts` de Zernio hace upsert del ruteo): una operación `lectura` no garantiza que
no escriba. *(sin hacer en el núcleo)*

**Vive en:** `lib/mako-pendientes.ts` · `lib/api-mako/acciones.ts` (`vigentesPara`) ·
*2026-09-16 api-mako-areas*

---

## ⚠️ `updateTag` fuera de una server action lanza, y el catch se lo traga

**Síntoma.** Después de confirmar por WhatsApp o por HTTP, el tablero y las listas
muestran lo de antes hasta 60 s. Confirmando desde `/mako/revisar` se ve bien.

**Causa.** `updateTag` solo funciona dentro de una server action. Desde un route handler o
el webhook lanza, y los runners lo tenían en un `try/catch`.

**Regla.** En un runner del registro se invalida con `revalidateTag(tag, { expire: 0 })`.

**Vive en:** `lib/api-mako/areas/crm.helpers.ts` · `lib/api-mako/areas/general.run.ts` ·
*2026-09-16 api-mako-areas*

---

## ⚠️ «Una def no importa valores» era el diagnóstico equivocado

Varias áreas copiaron enums a mano en su `.def.ts` creyendo que una def no puede importar
valores. La regla real es más chica: no puede importar valores de un módulo con
`server-only`, ni transitivamente, porque el generador de la referencia corre en el
pre-push bajo `node --import tsx` sin `--conditions react-server`. Los módulos de datos
puros (`fase-diagnostico`, `cerebro-modelo`, `personalidad`, `guion-estado`) se importan:
copiarlos crea un enum que se desincroniza sin avisar.

**Vive en:** `lib/api-mako/tipos.ts` (cabecera) · `lib/api-mako/areas/negocio.def.ts` ·
*2026-09-16 api-mako-areas*

---

## ⚠️ Tres formas en que un test del registro dio verde sin mirar nada

1. **Un regex sobre el fuente crudo matcheaba la cabecera** que explica la regla, y daba
   verde con el código borrado. Los chequeos de código van sobre `sinComentarios(src)`.
2. **Un caso de gating tapaba otro.** El test de `rolMinimo` usaba una def con
   `soloWs1`, que ya la escondía: borrar la guarda de rol no rompía nada. Un caso por
   guarda.
3. **El guard del pre-push leía el disco, no HEAD**, y frenaba el push de la sesión vecina
   por cambios sin commitear que no eran suyos. Ahora compara contra HEAD y se abstiene si
   `lib/api-mako` está sucio.

**Regla.** Cada test del registro se prueba rompiéndolo, una guarda por vez, y el
resultado queda en su comentario.

**Vive en:** `tests/api-mako-registro.test.ts` · `scripts/generar-api-doc.mjs` ·
*2026-09-15/16 api-mako*

---

## ⚠️ El tope de caracteres de las tools cortaba por orden de declaración

Groq corta en ~7k tokens de entrada y los esquemas de las tools pesan. El doer suma las
tools del registro de las áreas que nombra el mensaje con un tope de 12.000 caracteres, y
el tope cortaba en el orden en que están declaradas: en un área de 50 operaciones,
«pausá la campaña X» se quedaba con las primeras 15 lecturas y sin la acción que pidió.

**Regla.** Antes del tope, `ordenarPorRelevancia` pone primero las operaciones cuyo id,
título o descripción nombran palabras del mensaje. Es un orden, no un filtro.

**Vive en:** `lib/api-mako/registro.ts` · `lib/mako-doer-in.ts` ·
`app/api/mako-doer/route.ts` · *2026-09-15 api-mako*

---

## ⚠️ Un aviso de «la lib corta en 1000» se vuelve mentira —o candado— el día que la lib pagina

**El caso (17/09/2026):** la API de MaKo no podía arreglar los truncados de las libs, así que
los DECÍA: contaba las filas reales con `count` exacto y ponía una salvedad en la respuesta
(`contarFilas` + `avisoRecorte` en `metricas.helpers.ts`, `avisoTope` en chatbot,
`avisoRecorteClosing` en closing). Honesto mientras la lib no paginaba. Cuando la caza de
paginado arregló las libs, esos avisos quedaron así:

- **Candado:** `email.run.ts` se negaba a mandar o programar un segmento de más de 1000
  «porque la lib no pagina». `leadsDeSegmento` ya paginaba, así que el guard **bloqueaba el
  envío a los 1.044 «activos» de ws1** desde MaKo. Ahora compara contra `MAX_DESTINATARIOS`,
  importado de `lib/email-marketing.ts`: el tope vive donde vive la lectura.
- **Mentira permanente:** `crm.run.ts` avisaba «puede haber leads sin evaluar» con
  `totalLeads >= 1000`. Con 1.108 leads y `evaluarAutoWorkspace` paginando, salía siempre en ws1
  y siempre era falso. Lo mismo los «se contó sobre los primeros 1000» de email y closing, y
  los textos de `landing.run.ts` e `integraciones.run.ts`.

**Regla:** un aviso que describe un defecto de OTRA capa se actualiza **en el mismo commit**
que arregla ese defecto. Antes de cerrar un arreglo de paginado, `grep` del nombre de la
función en `lib/api-mako/areas/`. Y un número que copia el tope de otra capa se importa, no se
reescribe.

**Lo que quedó SIN hacer:**

- `comparar_agendas_meta_crm` (`metricas.run.ts`, ~:338) sigue poniendo `avisoRecorte` sobre
  `agendas_segun_meta`, y `getAgendasComparador` pagina desde el 17/09: con un rango de más de
  ~5 meses diría que el número está calculado sobre 1000 filas cuando no.
- Siguen ciertos (las lecturas no se tocaron) y hay que sacarlos cuando se paginen: los de
  `metricas.run.ts` sobre embudo, Tendencias y `pagos`, `general.run.ts:129` (`cashUsd`/`soldUsd`)
  y `:323` (`getTramoJ1J2Reciente`), y `plan.helpers.ts:16` (`listPlanBoard`, `listTareas`).

**Vive en:** lib/api-mako/areas/{email,crm,closing,chatbot,landing,integraciones,metricas,general}.run.ts · metricas.helpers.ts · *2026-09-17 caza de paginado*

## `soloWs1` no es «el workspace 1»: es «ws 1 Y rol admin»

**Vive en:** `lib/api-mako/registro.ts` → `gatingOk` · `lib/api-mako/tipos.ts` → `Gating` · *2026-09-26*

El nombre menciona UNA dimensión y la condición mira DOS:

```ts
if (g?.soloWs1 && !(v.ws === WS_PRINCIPAL && v.rol === 'admin')) return false;
```

Así que una operación `soloWs1` **también exige rol admin**, sin que ninguna def lo
declare. El doc del tipo lo dice («solo para ws 1 con rol admin») y el nombre no, que es
donde se pierde.

**Por qué muerde al SACARLO, no al ponerlo.** El 26/09/2026 el área `cs` dejó de ser de
un solo cliente y había que quitarle `soloWs1` a las tres operaciones que sobrevivieron.
Quitarlo a secas suelta el workspace —que era el objetivo— **y el rol, que nadie había
pedido soltar**. La decisión correcta no se saca del flag: se saca de mirar qué exige la
PANTALLA de esa área. Ahí era `requireCapa('customer-success')` sin guard de rol, así que
quedó sin `rolMinimo`; si hubiera sido `requireRolWs([])`, había que escribirlo a mano en
las tres.

**La regla que queda:** al sacar un flag de gating, enumerá qué condiciones lleva adentro
leyendo `gatingOk`, y reponé a mano las que seguían haciendo falta. Un flag compuesto se
quita de a una dimensión, nunca de un saque.

El detalle del caso, en [hallazgos-customer-success.md](hallazgos-customer-success.md) →
«Sacar el programa de los SEIS lugares donde también vivía».

## Una capacidad del registro que el mensaje no NOMBRA no llega al turno

**Vive en:** `lib/mako-intencion.ts` (`AREA_KEYWORDS`) · `lib/api-mako/registro.ts`
(`toolsDelRegistro`, `ordenarPorRelevancia`) · `lib/api-mako/areas/crm.def.ts` ·
`lib/api-mako/areas/crm.run.ts` · `lib/google-calendar.ts` · `lib/mako-doer-in.ts` ·
`tests/agenda-whatsapp.test.ts`

Agendar y mover reuniones en Google Calendar desde el grupo de WhatsApp, pedido por un
cliente inmobiliario (ws13) el 07/10/2026. Agendar ya existía, pero solo por Calendly, y
escribir la capacidad nueva fue la parte fácil. Tres cosas decidían si le llegaba al
modelo, y ninguna da error:

1. **Las tools del registro entran al turno sólo si el mensaje NOMBRA el área**
   (`areasDelMensaje`). El área es una regex de palabras, y las del vertical no estaban:
   «pasá la visita de Juan al viernes» → cero áreas → cero tools de agenda. Un negocio
   inmobiliario no agenda «reuniones»: agenda visitas y citas. Y `\bagend` no matchea
   «reagendá», porque entre «re» y «agend» no hay borde de palabra.
2. **Dentro del área, entra por relevancia hasta un presupuesto de 12.000 caracteres.**
   La relevancia puntúa las raíces del mensaje contra id + título (doble) y contra la
   descripción. La lectura que mover NECESITA —encontrar la reunión— no tenía «reage» en
   el título, y con «reagendá a Juan» quedaba afuera mientras la acción de mover sí
   entraba: **el modelo tenía la herramienta para mover y no la que le dice QUÉ mover.**
   Lo cazó el test, que arma el turno con los mismos números que el doer.
3. **El doer no le decía al modelo qué día es.** «El jueves» lo tenía que adivinar. La
   confirmación del dueño lo ataja —el resumen dice el día de la semana—, pero esa red no
   está para eso. Ahora va HOY, en la zona del negocio, en los turnos con herramientas.

**La regla: una capacidad nueva del doer se prueba ARMANDO EL TURNO con los mensajes como
los escribe la persona, no llamando al runner.** El molde es `tests/agenda-whatsapp.test.ts`:
desde el 08/10, `clasificarIntencion` + `herramientasDelTurno` (lo MISMO que corre el doer)
—armarlo a mano, sin el clasificador, dio verde sobre el bug; ver abajo—.
Llamar al runner prueba que la operación funciona; armar el turno prueba que alguien la
puede pedir.

⚠️ **Y el gating `integracion` es INFORMATIVO: no filtra** (`lib/api-mako/tipos.ts`). El
modelo ve las de Calendly y las de Google a la vez, así que cada descripción dice cuándo es
la suya y el runner contesta un error legible si la integración falta. Leerlo como un
filtro es asumir que el modelo no puede elegir mal.

⚠️ **Y la referencia generada (`docs/api-mako.md`) documenta sólo lo que sale por HTTP.**
Con tres operaciones nuevas sin HTTP, el generador contesta «ya estaba al día», y eso es
correcto: no es que no las vio. Se distingue en un `grep` (`reuniones_lead`, que tampoco
sale por HTTP, tampoco figura).

### Lo que quedó sin hacer

- **No se probó de punta a punta contra una agenda real.** El único workspace con Google
  Calendar conectado es el ws1, que es un cliente: probar ahí es mandar una invitación real
  desde su cuenta. La primera prueba es el primer uso del ws13, con su agenda conectada.
- **Mover en Google no actualiza `fecha_junta_1/2` del lead.** `setMeetingManual` reabre el
  lead y le borra la etapa manual —es para mover tarjetas, no horarios—, y no hay forma
  determinística de saber si la reunión movida es la R1, la R2 o una visita. Queda anotado
  en el historial del lead.
- **Si la reunión entró por Cal.com (o Calendly) y se mueve en Google, el proveedor de
  reservas no se entera.** El evento de Google se mueve; la reserva sigue con la hora vieja.
- ~~El Uso Limitado de Google sigue abierto~~ **Cerrado el mismo día, y rehecho**: la
  agenda ya no pasa por el modelo. Estas tools le devuelven un estado o un resumen sin nada
  de la agenda, y el detalle va a la persona por `paraLaPersona`. Mover ya no necesita la
  lectura previa: el código busca la reunión con el día y la hora que dijo la persona
  (`lib/agenda-sin-ia.ts`, detalle en `docs/hallazgos-ia.md`). Por eso lo de «la
  herramienta para mover entraba y la que dice QUÉ mover no» quedó como historia: la
  regla de armar el turno con frases reales sigue valiendo.

*07/10/2026 — sin subagentes; medido armando el turno y rompiendo el test cinco veces
(2, 2, 1, 1 y 1 fallos). Commit `c3c2ef17`.*

### 08/10: el test armaba el turno SIN el clasificador, y daba verde sobre el bug

**Vive en:** `lib/mako-intencion.ts` (`esPedidoAgenda`, `corrigeAgenda`, `sinPrefijoDeLote`,
`RELEVANCIA_AGENDA`) · `lib/doer-herramientas.ts` (`herramientasDelTurno`, nuevo) ·
`lib/mako-doer-in.ts` · `lib/agenda-sin-ia.ts` · `lib/google-calendar.ts` (`eventosDelDia`,
`cancelarEventoDeReunion`, `cambiarEventoDeReunion`) · `lib/api-mako/areas/crm.{def,run}.ts` ·
`tests/agenda-whatsapp.test.ts`

Al día siguiente de conectar su Google, el cliente escribió «Mako, agenda me una reunión
mañana 12hs de 1hs que se llame PRUEBA» y MaKo contestó «por aquí no puedo agendarte». La
conexión tenía permiso de escritura; el pedido nunca llegó a una herramienta.

⚠️ **La regla de arriba se cumplió a medias, y esa mitad era la que importaba.** El test
armaba el turno con `areasDelMensaje` + `toolsDelRegistro` y `incluirAcciones: true` FIJO:
se salteaba el clasificador y el filtro de «en una pregunta MaKo ofrece». Con el código de
ese día, 3 de sus 5 frases de escritura llegaban al turno real sin la herramienta
(«agendame…» y «pasá la visita…» caían en `pensar`, que sólo lleva lecturas; «moveme la
cita…» en `capturar`), y la del cliente también: «agenda» sin tilde y el pronombre suelto no
son ninguno de los imperativos, así que cayó al default, material para anotar. **Ahora la
selección es una función pura que llaman el doer y el test** (`herramientasDelTurno`): un
test que arma el turno a mano prueba otra cosa que lo que corre.

Lo que destapó, y ninguna da error:

1. **El clasificador no conocía el pedido de agenda.** Va una regla propia: un verbo de
   agenda + una reunión + un día o una hora, en un mensaje corto (la tilde que exigen los
   imperativos protege de la tercera persona de un volcado; acá protege el combo). Con las
   formas con modal («me puedes agendar…»), que es como pide quien tutea.
2. **Con una pendiente abierta, «cancelá la reunión…» y «no, movela al viernes» eran un
   «sí» o un «no»**: `CONFIRMACION` arranca con «cancela» y «no». El turno llegaba con
   confirmar/cancelar y nada más, y corregir la hora sólo cancelaba la propuesta.
3. **El «sí» a un ofrecimiento llegaba como `actuar` pero sin herramientas de agenda**, y
   no alcanzaba con calcular las áreas sobre el ofrecimiento: **el presupuesto ordena por
   relevancia CONTRA EL TEXTO**, y contra «sí, dale» la acción quedaba afuera. Cambiar las
   áreas sin cambiar la relevancia no trae la herramienta. Por la misma razón, «movela al
   viernes» («movel» no es raíz de nada) quedaba afuera: un pedido de agenda suma
   `RELEVANCIA_AGENDA` al presupuesto.
4. **El encabezado de un lote es nuestro y sumaba áreas**: «[Te mandó 2 mensajes… carga
   TODAS las tareas juntas…]» nombra plan, CRM y ads por sí solo, y gastaba el presupuesto.
5. **Las de Calendly viajaban a un negocio sin Calendly**, y su receta («buscá el lead,
   pedile el email») le ganaba a la de Google con un evento sin lead. `gating.integracion`
   sigue siendo informativo en el registro; el doer las saca leyendo la credencial, y si la
   lectura falla las deja (no pudo leer no es no tiene).
6. **Faltaba capacidad**: crear SIN lead (un evento del negocio, sin invitados), ver el día
   entero (`agenda_del_dia`), y cambiar el nombre o la duración, o cancelar, con o sin lead.
   Sin lead se busca por el día y la hora que dijo la persona (`eventosDelDia`, estricta: un
   fallo de Google no es «no tienes nada»). Para cancelar o cambiar se exige el MISMO
   minuto y el mismo título: si alguien lo movió entre el «propongo» y el «sí», no se toca.
   Todo por la regla del 07/10: la lista del día, los títulos y cuántos invitados hay van a
   la persona; el resumen que vuelve al modelo sólo lleva lo que ella dijo.

Aparte: el system de MaKo de TODO cliente decía «chat general del dashboard del negocio de
Martín», y le contestó «Mira, Martín…» al cliente. Nadie lo tenía editado (medido): era el
default del código (`lib/prompt-defaults.ts`, con su guard `tests/prompt-sin-dueno.test.ts`).

**Lo que quedó sin hacer:**

- **No se probó contra una agenda real.** El ws13 ya tiene Google conectado, pero es un
  cliente: probar ahí es escribir en su agenda. La primera prueba es su próximo pedido.
- **«movela al viernes» SIN pendiente ni agenda abierta** sigue sin llegar: no nombra la
  reunión, y un verbo suelto como «movela» también se usa para una tarea del plan.
  → **Cerrado el 09/10**: pregunta UNA vez «¿La reunión o la tarea?» (ver la entrada de abajo).
- **Un «Agendar reunión con…» al principio de una línea** se lee como una tarea dictada si
  el mensaje es una lista: decidir si es una orden o material es de Martín.
  → **Cerrado el 09/10**: dentro de una lista sigue siendo material; sola en una línea, es orden.

*08/10/2026 — sin subagentes; el diagnóstico y su refutación los midió la sesión del CRM
(solo lectura; `joan-0-diag.json` y `joan-3-refuta.json` en su scratchpad). 15 roturas entre `tests/agenda-whatsapp.test.ts` y
`tests/agenda-sin-ia.test.ts`, todas con su fallo.*

## ⚠️ Una herramienta con una lista cerrada de campos hace que el modelo afirme «no hay» sobre un dato guardado (08/10/2026)

**Vive en:** `lib/mako-tools.ts` (`ficha_lead`, `resumenLead`) · `lib/meta-leads-campos.ts`
(`formularioParaModelo`) · `lib/api-mako/areas/crm.def.ts` (`ficha_lead`)

Joan le preguntó a MaKo por WhatsApp (ws15) qué propiedad quería vender Rosana, y MaKo
contestó «en su ficha no hay detalles». La respuesta estaba en `leads.meta_field_data`, y la
ficha de la app la mostraba desde el 07/10. `ficha_lead` devolvía `resumenLead`, que son 20
campos fijos, más `getLeadRespuestas`, que son R1/R2 de `lead_respuestas`, y un lead de
formulario no tiene nada ahí. **El modelo no dice «no me llegó ese campo»: dice «no hay».**
El otro turno, «¿tenés acceso a lo que dijo en el formulario?», gastó 6 pasos buscando con
otras herramientas algo que ninguna devolvía, hasta el 429. `historial_lead` le mostraba que
las preguntas EXISTÍAN, pero sin las respuestas.

- **El dato va APARTE de `respuestas`.** `getLeadRespuestas` lo leen los datos faltantes, el
  chatbot y los insights, y mezclarlo ahí les cambia lo que leen.
- **`null` ≠ `[]`.** `null` es que no vino de un formulario, o que entró antes del 04/10, cuando
  las respuestas no se guardaban. `[]` es que el formulario no tenía preguntas propias. Lo
  explica la descripción una vez, no cada ficha: la nota en la ficha pesaba ~170 caracteres y
  viajaba en cada lead que no fuera de Meta.
- ⚠️ **Hay DOS descripciones de la misma herramienta.** El modelo de WhatsApp y la ruta vieja
  de la skill leen la de `MAKO_TOOLS`, y HTTP y la doc leen la del registro. Si se corrige una
  sola, el que la lee de la otra no se entera.
- **Sale por todos los canales, decidido.** Es dato del lead, como el teléfono y el email de
  la misma ficha. Los dos caminos de afuera son el runner de HTTP y `/api/agente/consultar`,
  que corre `runMakoTool` sin `ctx.canal`. Recortarlo en uno solo deja abierto el otro, y el
  snapshot de HTTP fija ids, no campos.

**Lo que quedó SIN hacer:** `reuniones_proximas`, `insight_lead`/`generar_insight` y el paso
del chatbot (`lib/paso-ia.ts:96`) tampoco ven `meta_field_data`.

*08/10/2026 — diagnóstico y refutación con subagentes, sólo lectura. Medido con la
herramienta real: `#2594` pasó de 438 a 648 caracteres. Commit `ddfb07e8`.*

## ⚠️ El registro tenía las operaciones del CRM y el clasificador no las dejaba llegar: «anotá» era «al plan» en TRES puertas (08/10/2026)

**Vive en:** `lib/mako-intencion.ts` (`esPedidoSobreLead`, regla 3-quater, `PEDIDO_ANOTAR`) ·
`lib/mako-router.ts` (`PLAN`) · `lib/mako-doer-in.ts` (`esCargaDePlan`, `guardarCrudo`) ·
`tests/crm-pedidos-whatsapp.test.ts`

Martín: «Joan le pidió que cargue una NOTA a ese lead y creó una tarea… Cuando justamente
creamos toda una documentación API para que MaKo en WhatsApp pueda hacer todas las acciones».
En ws15 (#1274), Joan dijo por audio: «Macu, anotá en el lead… Nicolás como una nota que ya
tiene su propiedad con Remax… Solo agregá esa nota al lead Nicolás».

**El diagnóstico obvio, «a MaKo le falta la herramienta», era el equivocado.**
`agregar_nota_lead` existe, y su descripción dice textual «úsala cuando el dueño diga "anota en
X que…"». Lo que pasó:

1. **«Anotá» se leía como «cargalo al plan» en TRES lugares que no se hablan:**
   - `PEDIDO_ANOTAR` del clasificador, la regla 2, que corre antes que todo;
   - el `PLAN` del router (también con `agregá`, `sumá` y `cargá`), que pone `(plan)` en la
     ruta, y con eso el doer exige un borrador del plan;
   - `esCargaDePlan` del doer, que manda el «Claro, anoto eso 👇», obliga a usar una
     herramienta y decide el guardado crudo.

   El turno llegó con las 3 herramientas del plan.
2. **Gemini dio 503 y el respaldo guardó el pedido como borrador del plan:** «MaKo no pudo
   procesarlo — quedó tal cual lo dijiste» (`plan_propuestas`, `propmuzvpq2whd8hr`). Esa es
   la «tarea» que vio Martín. El respaldo hizo lo que tenía que hacer con lo que le llegó: el
   error estaba en la clasificación, no en el respaldo.
3. **Una hora antes, otro pedido se había perdido sin que nadie lo notara.** «okay, movelo a
   "calificado" dentro del CRM» cayó al default (`capturar`), porque «movelo» sin tilde no
   está en ninguna lista. Con solo las herramientas del plan en la mesa, MaKo contestó «Voy a
   moverlo a Calificado. ¿Confirmas?» **sin dejar ninguna pendiente**, y el «sí» chocó con
   otro 503. Nicolas nunca se movió.

⚠️ **No era un caso suelto.** Se midió con el turno real (clasificador + `herramientasDelTurno`).
De 19 pedidos comunes del CRM (nota, mover de etapa, marcar calificado, asignar closer,
etiqueta), 17 llegaban SIN su herramienta. Pasaban sólo «mové a Rosana…», con la tilde exacta
que pide `ACCION_CUENTA_RE`, y el «sí» a un ofrecimiento.

**La regla:**
- **La señal es el OBJETO, no el verbo.** Un verbo de pedido más algo que sólo vive en el CRM
  (lead, ficha, nota, etapa, «calificado», etiqueta, closer) da `actuar`, con el área y la
  relevancia de su tipo. Sin la relevancia, la herramienta queda afuera del presupuesto de
  12.000 caracteres. Por eso la nota sin la palabra «nota» («anotá en el lead de Rosana
  que…») se marca por el verbo de anotar.
- **Las tres puertas preguntan lo MISMO** (`esPedidoSobreLead`). Arreglar sólo el
  clasificador deja el `(plan)` del router y el acuse de «anoto eso».

**Medido sobre los 178 mensajes reales de `mako_doer_conv`:** cambian 4 clasificaciones, y
las 4 eran pedidos perdidos:
- #349 de ws11, «Me agregas a lead…»;
- #1095 de ws13, «agrega el link a notas del lead…», que también había terminado de tarea
  del plan;
- #1267 y #1274 de ws15.

Ningún volcado de ideas cambia.

**Lo que quedó SIN hacer:**
- **La nota se probó hasta el turno, no hasta la ficha.** `agregar_nota_lead` escribe el
  evento `Nota` de `lead_audit`, el mismo que lee la tarjeta «Notas» de la ficha
  (`getLeadNotasAction`, en `app/crm/actions.ts`). Pero no se corrió un «sí» de punta a punta,
  porque ws15 es un cliente.
- **«¿Confirmas?» sin pendiente.** Un turno sin la herramienta puede prometer una confirmación
  que no existe, y nada lo ataja: `validarRespuestaDoer` caza un link inventado, no una
  pregunta de confirmación sin pendiente.
- **Gemini caído entero y una sola key.** La red de plataforma (Groq gratis) no entra en un
  turno de más de ~7 k tokens, y el último recurso pago sigue siendo una decisión de Martín.
- **Las operaciones del registro que no son del CRM tienen el mismo cuello**: ads, chatbot,
  email. No se midió cuántas llegan por WhatsApp.

*08/10/2026 — sin subagentes para el arreglo; diagnóstico leyendo `mako_doer_conv`,
`anthropic_usage` y `plan_propuestas` de ws15.*

## Lo que quedó sin hacer en el núcleo

| Qué | Dónde | Por qué no se hizo |
|---|---|---|
| Idempotencia de las propuestas genéricas (ref que bloquee solo contra una pendiente) | `lib/api-mako/ejecutar.ts`, `lib/propuestas.ts` | La ref por contenido bloquea repetir una acción ya aplicada |
| Distinguir «vacío» de «ausente» en la pantalla genérica | `app/mako/revisar/[id]/acciones.ts`, `lib/api-mako/validar.ts` | Cambia el contrato de todas las acciones con opcionales |
| Título de `/mako/revisar` que siga al formulario; `object[]` como sub-formulario | `app/mako/revisar/[id]/RevisarAccion.tsx` | UI, no bloquea |
| `reclamada_at` y barrido de pendientes `confirmada` colgadas | `lib/mako-pendientes.ts` + migración | Necesita columna nueva |
| Actor fuera de `resultado` | `lib/api-mako/acciones.ts` | Las lecturas lo sanean mientras tanto |
| `historial_whatsapp` y `reuniones_lead` por `/api/agente/consultar` | `lib/agente-consultas.ts` | Decisión de producto: rompe skills instaladas |
| Tools viejas que devuelven el error en un 200 | `lib/mako-tools.ts`, `lib/mako-doer-acciones.ts` | Se resuelve al mudar los cuerpos (F4) |
| Que la bandeja deje confirmar a un no-admin lo que no lleva `rolMinimo` | `app/mako/ctx-bandeja.ts` | Por eso `editar_perfil` y `configurar_notificaciones_inapp` salieron del registro |
| Mover `listar_productos`/`guardar_producto` a negocio y `adjuntar_grabaciones_fathom` a crm | `lib/api-mako/areas/*` | Decisión de registro, sin urgencia |
| `/whatsapp?chat=` escrito por código | `lib/mako-doer-in.ts` | Falta resolver el jid contra el espejo en cada área |

## La API existe, pero los que más la usan todavía no pasan por ella (08/10/2026)

**Vive en:** `lib/api-mako/registro.ts` · `lib/mako-tools.ts` · `lib/mako-doer-acciones.ts` ·
`lib/mako-doer-in.ts` · `app/api/mako-doer/route.ts` · `app/api/agente/*` · `lib/flujos.ts`

Martín pidió «que MaKo tenga una API propia, con todas las acciones bien documentadas... como un
CRUD» para ahorrar tokens y para configurar acciones en el chatbot. **La API es esta**: 498
operaciones en 18 áreas (316 lecturas, 180 acciones, 2 controles), 379 por HTTP. El «~379» que
circulaba es sólo lo que sale por HTTP. Lo que se midió (corrida de 8 agentes, 4 lectores, un
diseñador y 3 refutadores, sobre HEAD):

⚠️ **Las 25 herramientas más usadas están declaradas DOS veces, y ya divergieron.** Las 12 de
`MAKO_TOOLS` y las 13 de `MAKO_ACCION_TOOLS` tienen gemela con el MISMO id en el registro (0
exclusivas). El doer de WhatsApp (las 25, siempre) y el chat de la app (las 12) mandan el ToolDef
VIEJO; HTTP y la skill, la def nueva. Las 25 descripciones difieren, y ya hay tres arreglos que
corrieron en una copia y no en la otra:

- el tope de salida de `metricas_negocio` (`if (ctx.canal !== 'http')` en metricas.run.ts) corre
  sólo por HTTP, donde no hace falta: WhatsApp y la app usan el cuerpo viejo;
- `proponer_tareas_plan` vieja declara `eliminar` («el dueño confirma cada baja») y
  `/plan/revisar` ya no tiene paso de bajas;
- `listar_campanas_meta` rotula el gasto como MXN: el ws13 cobra en USD (ver más abajo).

19 son una envoltura del cuerpo viejo; 6 tienen dos cuerpos (`metricas_negocio`,
`analisis_negocio`, `listar_pendientes`, `confirmar_accion`, `cancelar_accion`, `proponer_lead`).
**Y «proponer alta de lead» tiene TRES cuerpos**: la tool vieja, `crm.run.ts` y
`/api/agente/lead`.

⚠️ **La def del registro de `proponer_tareas_plan` no sostiene capturar** (refutado al plan que
quería mudar las 25 de una): no declara `recurrente` —`validarInput` copia sólo lo declarado, así
que una tarea recurrente saldría única—, pierde `MOLDE_DETALLE` y `MOLDE_PROYECTO`, y manda a usar
`listar_tareas_plan`, que capturar no ve (la guarda de fantasmas corta al segundo rechazo). Antes
de mudar el despacho de las 25 hay que arreglar esa def. Y pasar por el registro mete el gating
de `visible()`: con la capa `pm` (ws5) 17 de las 25 dejarían de existir.

**`/api/agente/*` duplica 6 de 9 rutas** (consultar = 10 lecturas, contexto, metricas, plan GET
—un TERCER cuerpo de «ver el plan»—, plan POST todavía con `eliminar`, lead POST). La skill
instalada nombra `/api/agente/` 20 veces contra 7 `/api/v1`. Uso medido: 0 filas en
`api_llamadas`; 3 tokens (ws1, ws9, ws11), los tres `proponer`.

**Ninguna automatización pasa por el registro.** `ejecutarOperacion` lo llaman sólo el doer, el
chat, `/api/v1` y la bandeja. El CRM automático, la nutrición, los desenlaces, los flujos de
avisos, la página de gracias y el curso al ganar escriben directo. La base para un canal `flujo`
ya está —168 de las 180 acciones separan `preparar` de `ejecutar`—; falta el canal, poner el lead
del evento en los parámetros, una llave contra la ejecución doble y el panel. La tensión «el canal
propone» ya se resolvió de cuatro formas en el código (propone · aplica y deja deshacer · actúa
porque alguien prendió el interruptor · borrador de un clic) y el registro conoce una sola.

**Los huecos que un flujo necesita** (mapeo a mano sobre crm, chatbot, plan, ads y equipo: 175
cambios de pantalla, 81 con gemela, 33 afuera con motivo escrito, 61 huecos): ninguna operación
conoce `lead_funnel` (un lead en varios productos, mig 0207) ni inscribe a UN lead en una
secuencia, y Customer Success tiene ~31-34 escrituras sin operación (el curso y los movimientos de
la entrega; el refutador corrigió el «37 contra 1»: guardar datos del cliente, servicios y alta ya
tienen gemela en crm y negocio). La lista de exclusiones de `crm.def.ts:15-25` quedó vieja: dice
que reagendar e importar no están, y ya existen `proponer_mover_reunion` y `proponer_leads`.

⚠️ **El registro no está declarado en ningún área de `/admin/dev`**: `grep lib/api-mako` en
`app/admin/dev/areas.ts` sólo encuentra los tres archivos de cs. Su historial no lo ve nadie.

**SIN HACER** (el plan, en `docs/api-mako-diseno.md` § 10):
- La def de `proponer_tareas_plan` (`lib/api-mako/areas/plan.def.ts`) con `recurrente` y los
  moldes, y después el despacho de las 25 por el registro (`lib/mako-doer-in.ts`).
- ~~El canal `flujo`~~ y ~~`lead_funnel` e inscribir un lead en una secuencia~~: HECHOS el mismo
  día, sin canal nuevo (ver abajo, «El canal de los flujos»).
- Declarar `lib/api-mako/` en un área de `app/admin/dev/areas.ts`.

*08/10/2026, cuenta 2. Corrida `wf_88a97c1e-c89`.*

## ⚠️ Un token con nombre (hoy: detallado) vale SOLO para /api/v1: la ruta de la skill entrega el principal (08/10/2026)

> A la tarde del mismo día los «tokens con nombre» pasaron a ser los **detallados** de GitHub
> (`mako_pat_`, permisos por área, vencimiento): ver la entrada siguiente. La frontera de abajo
> sigue igual, con `resolverTokenApi` en el lugar de `wsPorTokenApi`.

**Vive en:** `lib/api-mako/tokens.ts` · `lib/api-mako/tokens-lista.ts` · `lib/api-mako/tokens-uso.ts` ·
`lib/api-mako/http.ts` · `lib/agente-token.ts` · `app/api/agente/skill/route.ts` · `app/api-mako/`

Martín decidió (08/10) **varios tokens, con nombre**: hasta acá había UNO por workspace
(`agente_token`) y rotarlo lo reemplazaba, así que darle a un n8n un token de solo lectura le
apagaba las propuestas a la skill de Claude. La tab `/api-mako` los crea y los revoca de a uno.

**El diagnóstico obvio era el equivocado:** «que el resolvedor de siempre (`wsPorAgenteToken`)
acepte también los nuevos, y valen en todas las rutas». Dos cosas lo hacían un agujero:

1. `/api/agente/skill` arma el archivo de la skill con `(await getAgenteToken(ws)) ?? token`:
   **siempre el PRINCIPAL**, no el que pidió. Con cualquier token válido del workspace se bajaba
   la skill con el principal adentro — un token «Solo leer» se llevaba el de la skill, que
   propone (o ejecuta).
2. `/hook` y `/telemetria` son el reporte del plugin, y su consentimiento está atado al
   principal: `/api/agente/token` no acuña sin el trato aceptado. Un token con nombre abría esa
   puerta sin trato.

**La regla:** los tokens con nombre resuelven en `wsPorTokenApi` (el resolvedor de `/api/v1`,
que si no es uno de ellos cae al principal); `/api/agente/*` sigue con `wsPorAgenteToken`, que no
los conoce. `tests/api-mako-tokens.test.ts` lo fija leyendo el FUENTE (probado rompiéndolo:
cambiar el resolvedor de `http.ts` y meter el módulo en `/api/agente/skill` hacen fallar 2 de 10).

Lo demás que no se ve desde la pantalla:

- **El índice token → workspace es append-only** (`webhook_routing`, servicio `api_token`, por
  hash): revocar NO borra la fila. Lo que decide si un token vale es la LISTA del workspace
  (setting `api_tokens`), igual que el setting en el principal — y se lee con
  `getSettingEstricto`, porque con `getSetting` la base caída da «revocado» sobre uno vigente.
- **Del token nuevo se guarda el hash**, nunca el valor: se muestra una vez. El principal sigue
  en claro (setting e índice) porque la skill y el tutorial de Integraciones lo releen.
- **`api_llamadas` no sabe QUÉ token pidió.** El «último uso» de cada token se anota al
  autenticar (`tokens-uso.ts`), con freno de 10 min por token e instancia, y en un setting
  APARTE de la lista (`api_tokens_uso`): una escritura de uso contra la lista, leída antes de
  una revocación, podía revivir el token recién revocado.
- **El catálogo entero son ~360 mil caracteres (~90k tokens)**, y la skill enseñaba a pedirlo
  entero «SIEMPRE» antes de empezar. `GET /api/v1` suma tres filtros aditivos —`?compacto=1`
  (~23 mil), `?area=` y `?operacion=<id>`— y la skill pasó a enseñar «el índice, y después el
  detalle de la que vas a usar».
- **La pantalla no importa el registro**: el índice se arma en el server (`app/api-mako/datos.ts`)
  y el detalle de una operación se pide al abrirla. «Probar» corre sólo lecturas que salen por
  HTTP y no gastan (`gratis` o `externo`), con el mismo canal y gating que un token `lectura`, y
  no deja fila en `api_llamadas` (esa bitácora contesta qué pidió un TOKEN).

### Lo que quedó sin hacer

- **`/api/agente/plan` y `/lead` (POST) no miran el alcance.** Un principal acuñado como
  `lectura` (sólo se puede por `POST /api/agente/token`, la pantalla no lo ofrece) igual deja
  propuestas por ahí. No se tocó por la decisión D de Martín (`/api/agente` se mantiene tal
  cual): son dos líneas en `app/api/agente/plan/route.ts` y `app/api/agente/lead/route.ts`.
- **`plugin/` se regeneró y no se publicó.** El repo público (`mbustos-digital/mako-plugin`) se
  publica a mano (`docs/hallazgos-infra.md`): hasta entonces, quien instaló el plugin sigue
  pidiendo el catálogo entero. La skill que sirve `/api/agente/skill` ya sale con lo nuevo.
- ~~**Qué token pidió cada llamada**~~ — hecho a la tarde: `api_llamadas.token_id`
  (migración 0222, aplicada el 08/10).

*08/10/2026, cuenta 2, sin subagentes. Commit `f2c0a04b`.*

---

## La API copiada de GitHub: tokens detallados que escriben, permisos por área, rutas REST y su pantalla (08/10/2026)

**Vive en:** `lib/api-mako/permisos.ts` · `lib/api-mako/tokens*.ts` · `lib/api-mako/http.ts` ·
`lib/api-mako/rutas-http.ts` · `lib/api-mako/rest.ts` · `lib/api-mako/recursos.ts` ·
`lib/api-mako/ejemplos.ts` · `lib/api-mako/openapi.ts` · `lib/api-mako/version.ts` ·
`lib/api-mako/registro.ts` (`gatingOk`) · `lib/api-mako/flujo.ts` (`aplicarEnElActo`) ·
`app/api/v1/**` · `app/api-mako/` · `tests/api-mako-rest.test.ts`

Pedido de Martín: «Me gusta como hace la API GitHub, con su diseño, permisos, presentación,
etc… Copialo todo, tal cual». Decidió: escribe directo (lo que gasta plata sigue en una
pantalla), permisos por área con vencimiento, URLs REST como alias (las viejas no cambian) y
que se vea igual a GitHub. El relevo de cómo lo hace GitHub (8 agentes, `wf_62c177ea-a1d`) y el
diseño de las 379 rutas (`wf_f551abb8-91f`) quedaron en el transcript; lo que importa está acá.

**Los permisos van en `gatingOk`, y el diagnóstico obvio era el equivocado.** Lo natural era
filtrar en la ruta o en `visible()`. Pero `gatingOk` es TAMBIÉN la guarda que corre al
confirmar una pendiente (`acciones.ts`): con el filtro en otro lado, un token con escritura sólo
en «mako» confirmaba (por `confirmar_accion`) pendientes del CRM o de Ads. `Ctx.permisos` →
`vistaDe` → `Vista.permisos` → `gatingOk`. `{}` es «nada», no «sin filtro»: el test lo fija.

**Escribir directo NO es un segundo camino de escritura.** `correr()` en `rutas-http.ts` es el
único lugar que decide: lectura → `ejecutarOperacion`; acción con el clásico o con
`costo: 'dinero'` → propone (202); acción con un detallado → valida ANTES (para devolver el 400
con `faltan`, que `aplicarEnElActo` resume en una frase) y llama a `aplicarEnElActo`, el mismo
camino con que confirma un flujo. Probado contra la base el 08/10 con
`PUT/DELETE /crm/leads/2472/faltantes/silencio` en el ws 9: 200 `hecho` las dos, y el lead
quedó como estaba (`pendientes_ignorados` null).

**Lo idempotente de GitHub choca con los runners.** El segundo `PUT` de lo mismo devolvió 422
(«ya están ignorados desde…»): el runner rechaza sin `yaEstaba`. En GitHub ese `PUT` es un
éxito. Con `yaEstaba: true` en `preparar()`, `aplicarEnElActo` lo contesta como éxito sin
cambios y la API devuelve 200 `sinCambios`. Hoy lo marcan 6 runners (`grep yaEstaba`).

**403 o 404, como GitHub.** Si lo ÚNICO que falta es el permiso del área de un detallado: 403
«Recurso no accesible con un token de acceso personal detallado» y `X-Accepted-MaKo-Permissions`
con lo que falta (`crm=write`). Si es la capa, el rol, el canal o el alcance del clásico: 404, sin
confirmar que existe. Un verbo equivocado en una ruta REST también es 404 (GitHub tampoco dice
qué existe); en la ruta vieja sigue el 405 con `Allow`.

**Un token nunca administra tokens** (regla de GitHub que trajo el relevo): ninguna operación
del registro acuña, edita ni revoca credenciales; `ver_estado_agente_claude` sólo LEE si existe
el clásico. `tests/api-mako-rest.test.ts` lo frena.

**Las rutas REST son una TABLA al costado del registro**, no una segunda declaración: una fila
por operación HTTP, y el test falla si una op nueva no tiene la suya, si un parámetro de ruta no
es de la op, si una ruta se repite o si una de dos tramos pisa una operación (el router viejo
gana con `/{area}/{operacion}`). Un parámetro de ruta puede ser OPCIONAL en la op
(`cancelar_accion` sin `id` cancela la última): la ruta lo trae siempre. El router prefiere lo
literal a un parámetro (`/plan/proyectos/vacios` antes que `/plan/proyectos/{proyectoId}`).
Probado rompiéndolo: sin la fila de `agregar_nota_lead`, fallan 2; con `{lead}`, falla 1.

**La pantalla: dos trampas de Next que costaron una corrida cada una.**

1. **El estado de un componente cliente NO sobrevive a cambiar `?v=` en la misma página.** El
   token recién creado se perdía: los searchParams son parte de la clave del segmento de la
   página, así que ir de `?tab=tokens&v=nuevo` a `?tab=tokens` MONTA DE NUEVO el componente. Y
   `router.push` + `router.refresh()` juntos lo montaban dos veces. El token vive entre la acción
   y la lista en una variable de MÓDULO (memoria de la pestaña, se pierde al recargar, como en
   GitHub), y se navega con `push` a otra vista o con `refresh` a la misma, nunca las dos.
2. **Una función de un módulo `'use client'` no se puede LLAMAR desde el server**:
   «Attempted to call esArticulo() from the server». Lo que `page.tsx` necesita para leer la
   URL (los artículos, sus slugs) vive en `app/api-mako/articulos-meta.ts`, sin `'use client'`.

**Lo que «tal cual» quiso decir en el aspecto:** los valores de Primer (colores, tipografía,
`Box`, `Label`, `Counter`, `UnderlineNav` con su línea coral, `Flash`, `Subhead`, el `Dialog`),
los Octicons (MIT) y el modo oscuro de Primer bajo `data-tema="oscuro"`, todo limitado a `.gh`.
El badge del verbo es del MISMO azul para todos los verbos (GitHub no pinta un color por verbo).
El reset global de MaKo saca las viñetas: dentro de `.gh` vuelven en las listas sin clase.

**Datos de prueba que quedaron:** ~33 filas de `api_llamadas` en el ws 9 (las del e2e de la
mañana y de la tarde) y dos líneas de historial en el lead 2472 del ws 9 (ignorar y reactivar).
Los tokens de prueba se eliminaron.

### Lo que quedó sin hacer

- **⚠️ Un token no se apaga cuando su creador pierde el acceso.** En GitHub, un token detallado
  queda inactivo si el usuario pierde acceso al recurso. Acá `creadoPor` se guarda y no se
  vuelve a mirar, y `autenticar()` fija `rol: 'admin'` para todo token: a un admin que sacan del
  workspace le siguen andando sus tokens. Va en `resolverTokenApi` (`lib/api-mako/tokens.ts`):
  revisar el rol actual de `creadoPor` (con caché) o revocar sus tokens al sacarlo.
- **Sin «modo sudo»**: GitHub pide reautenticarse para generar o regenerar tokens; acá alcanza
  la sesión del admin (`app/api-mako/actions.ts`).
- **Las descripciones dicen «PROPONE… queda pendiente hasta el sí»**, que con un detallado es
  falso: las comparte el doer, que sí propone. La documentación lo aclara en cada endpoint
  («Con Lectura y escritura, el token detallado lo hace en el acto»), pero el texto de la def
  sigue igual (`lib/api-mako/areas/*.def.ts`).
- **Más runners con `yaEstaba`** para que los `PUT` repetidos sean 200 y no 422
  (`lib/api-mako/areas/*.run.ts`, ver arriba).
- **`documentation_url` apunta a una pantalla con login** (`/api-mako?tab=docs…`): GitHub apunta
  a docs públicas. El integrador de un cliente sin cuenta en MaKo no la abre (`docsUrl` en
  `lib/api-mako/http.ts`).
- **Lo que GitHub tiene y acá no:** webhooks salientes (avisar cuando una pendiente se confirma
  o vence, en vez de consultar en bucle), OAuth para integraciones de terceros, el receptor del
  Secret scanning partner program (el prefijo `mako_pat_` ya es reconocible), paginación con
  el header `Link`, `Location` en los 202, zona horaria declarada (`Time-Zone`), y fechas de
  deprecación por operación en el OpenAPI.
- **La skill (`lib/agente-skill.ts`) y `plugin/` no enseñan las rutas REST** ni los detallados:
  siguen con la ruta por operación, que anda.

*08/10/2026, cuenta 2, con subagentes (relevo de GitHub y diseño de rutas).*

---


## El curso por la API: que un Claude migre un curso entero (08/10/2026)

**Vive en:** `lib/api-mako/areas/curso.def.ts` · `lib/api-mako/areas/curso.run.ts` ·
`lib/api-mako/areas/curso.helpers.ts` · `lib/api-mako/flujo.ts` (`ResultadoFlujo.datos`) ·
`lib/api-mako/rutas-http.ts` · `lib/api-mako/validar.ts` (`vaciaEsValor`) · `app/api-mako/Articulos.tsx`
(la guía) · `tests/api-mako-curso.test.ts`

Pedido de Martín, en el audio de feedback del curso (minuto ~05:30): quien probaba, con su curso en
Panda, preguntó «si esto lo puedo conectar por medio de API para que mi Claude lo pueda subir de forma
automática»; Martín: «No están las acciones dentro de curso, como agregar nueva clase… tengo que agregar
el tema de curso en la API», y «un pequeño tutorial de copia tu token de API, pásalo a Claude y dile que
te haga tal». Lo pasó el chat de Customer Success. Quedó un área nueva, `curso` (11 operaciones, SÓLO
por HTTP), y la guía «Migrar un curso con Claude» en la documentación de la tab API.

**Lo que no se ve desde el pedido:**

- **Una escritura que CREA algo no devolvía su id por la API.** `confirmarPendiente` sí devuelve
  `Ejecutado.datos`, pero `aplicarEnElActo` lo tiraba y la escritura directa contestaba sólo `resumen`.
  Quien crea una clase necesita su id para lo que sigue. Ahora viaja: `ResultadoFlujo.datos` → la
  respuesta 200 lleva `datos` (y el OpenAPI lo describe). Una operación nueva que crea algo devuelve su
  id en `datos`.
- **La tab crea una clase AL PRINCIPIO de su módulo** (`crearClase`, a propósito: la abre para editarla).
  Una migración crea en orden, así que quedaba al revés. `crear_clase_curso` la lleva al final con
  `moverClaseA(id, modulo, null)`, que con el módulo ya numerado escribe UNA fila.
- **Crear una clase son tres escrituras**: crear, llevarla al final y UNA con todo lo demás por
  `guardarLeccion` (lib/curso-admin.ts), el mismo camino del «Guardar» del editor, con compare-and-set
  (la base sale de `borradorDe`, la misma función de la pantalla; si otra persona la cambió en el medio,
  se relee y se reintenta una vez). Todo se valida en `preparar()`; si la escritura falla después de
  crear, la clase va a la papelera, para que un reintento no deje dos «Nueva clase». ⚠️ `guardarLeccion`
  acepta los minutos SÓLO junto con un video nuevo: los minutos solos van por `guardarCampoClase`.
- **`crearModulo` entiende `despuesDe: null` como «al principio»** y crea VINCULADO por default (una
  columna más en el kanban de clientes). Por la API, sin `despuesDe` va al final, y nace SUELTO salvo que
  se pida.
- **Un producto sin entrega guardada ya tiene CINCO módulos**: las etapas de fábrica del kanban
  (onboarding, arranque, hito 1, hito 2, entregado), todas vinculadas. Por eso `ordenar_modulos_curso`
  pide la lista ENTERA de claves, y la guía le dice a Claude que lea el curso antes.
- **No hay una pantalla de papelera**: lo borrado vuelve sólo con el «Deshacer» de 5 segundos de la tab.
  La primera versión de la descripción de `borrar_clase_curso` prometía «se recupera desde la papelera
  del curso en MaKo», que no existe. Por la API vuelve con `restaurar_clase_curso` (7 días, los de la
  purga; el test los compara con `DIAS_PAPELERA`).
- **Lo que NO se expone, a propósito**: vincular o borrar un módulo y mover clientes de etapa. Mueven
  clientes en el kanban, y en el ws1 eso manda WhatsApp. El test lo frena por nombre de función.
- **Lo que se crea se ve enseguida**: un módulo suelto nace `abierto` (`lib/curso-bloqueo.ts`). La guía lo
  avisa.

**La tarea y el video por código (la misma tarde, sobre el modelo nuevo de Customer Success, `dbae4da9`):**

- **`tareas` REEMPLAZA todas las tareas, y los ids de los campos se CONSERVAN.** Las respuestas de los
  alumnos cuelgan del `id` de cada campo: reescribir la tarea con ids nuevos las deja sin pregunta, sin
  un error. `modeloDeTareas` (curso.helpers.ts) mantiene el `id` que llega, y sin `id` reusa el del campo
  que ya tenía la misma pregunta y el mismo tipo. `ver_clase_curso` devuelve las tareas en la MISMA forma
  que se mandan, para editar de ida y vuelta.
- ⚠️ **El validador de la API TIRABA toda lista vacía, obligatoria o no** («una lista que no vino»), así
  que `tareas: []` contestaba «No pasaste nada para cambiar» y no había forma de sacar la tarea. Lo cazó
  la prueba de punta a punta, no los tests: los del helper le pasaban la lista directo. Ahora un
  parámetro declara `vaciaEsValor` y ahí `[]` es «vaciar»; sin la marca se sigue descartando, que es lo
  correcto para un filtro. **Toda lista que REEMPLAZA algo entero la lleva.**
- **La tarea principal es la primera y no lleva título; las demás son `seccion` del modelo.** Una
  `seccion` no se pide como campo (queda afuera de los tipos de la API, con `quiz`, `publicar` y
  `comentar`, que se arman en MaKo). Lo incompleto se rechaza con el motivo de `erroresDeCampos`, el mismo
  que pinta el editor; nunca se descarta.
- **El video acepta el `<iframe>` entero** (`videoDeLink` → lib/embeds.ts). El `src` que se guarda lo
  arma lib/embeds.ts desde el id: el `autoplay=1` del código de Panda no viaja (medido). El link del
  PANEL de Panda (`dashboard.pandavideo.com.br/…`) no es un video: contesta con `porQueNoSeInserta`, la
  misma frase del editor («De Panda Video, pega su código para insertar»).
- ⚠️ **Este archivo no puede leer `.campos` de nada**: `tests/curso-tareas-secciones.test.ts` barre todo
  lector de `.campos` en los archivos que importan lib/curso (una `seccion` no es un campo que se
  conteste). Los campos se toman por desestructuración.

**Probado contra la base el 08/10** en el ws 9, con un producto de prueba creado y borrado por la misma API.
Se probó todo esto: tres clases creadas en orden, video inválido (422 sin crear nada), editar con HTML
saneado (el `<script>` no quedó), mover, reordenar (incompleto 422; completo 200; igual 200 `sinCambios`),
renombrar, borrar dos veces (200 y 200 `sinCambios`), restaurar, y un token sin «Curso» (403). Al borrar
el producto, su curso cayó en cascada.

⚠️ **El Cliente de Prueba (ws 3) no sirve para probar una tab**: con el onboarding pendiente, cualquier
pantalla rebota a `/onboarding`. El e2e corrió en el ws 9.

### Lo que quedó sin hacer

- **La tarea y el video por código embed** (el de Panda): el chat de Customer Success está cambiando ese
  modelo en `lib/curso.ts` y `lib/curso-admin.ts`, y avisa con las firmas nuevas. Hasta entonces, un link
  de una página de Panda se guarda pero no se reproduce, y la guía lo dice.
- **Sin idempotencia por clave externa**: si un pedido se corta, el reintento puede duplicar una clase. La
  guía le pide a Claude que mire el curso antes de reintentar. Una columna `ref` en `curso_clases` lo
  cerraría.
- **Los módulos no se pueden crear cerrados** por la API: el candado (`guardarBloqueo`) no está expuesto.
  Para cargar un curso sin que los alumnos lo vean a medias, hoy hay que crearlo en módulos nuevos.

*08/10/2026, cuenta 2, sin subagentes.*

## El canal de los flujos: un paso corre cualquier acción, por el mismo choke point (08/10/2026)

**Vive en:** `lib/api-mako/flujo.ts` · `lib/api-mako/flujo-params.ts` · `lib/api-mako/canal.ts` ·
`lib/api-mako/ejecutar.ts` · `lib/api-mako/tipos.ts` (`yaEstaba`) · `app/api/flujos/acciones/route.ts` ·
`app/_components/EditorAccionMako.tsx` · `lib/mako-doer-acciones.ts` (el origen de las heredadas)

Martín contestó las cinco decisiones del § 10 de `api-mako-diseno.md` («Que pueda hacer todo, sin
limitaciones» · «La ofrece» · «No, no renombres» · «Mantenla, no cambies nada» · «No, no lo
escondas»). La A es la que cambia el registro: un paso «⚡ Acción» corre CUALQUIER acción sin pedir
un «sí». Lo que costó:

⚠️ **El diagnóstico obvio era el equivocado: «sumar `flujo` a CANALES».** `canales` es una lista
EN POSITIVO en cada una de las 498 operaciones: un canal nuevo obligaba a declararlo en todas, y
la decisión fue que todas valen. Va con el canal `app` y una clave de scope con prefijo
(`app:flujo:<origen>`, `PREFIJO_FLUJO`): de ahí salen el origen de la fila y la etiqueta «vino de
una automatización». CANALES no cambió.

⚠️ **Confirmar corre el `ejecutar()` de la acción SIN contexto de workspace.** `ejecutarOperacion`
fija el workspace para proponer, pero `confirmarPendiente` no: medido en la prueba del ws3, la nota
salía y el historial tiraba «`cookies` was called outside a request scope» (`logLeadEvent` →
`getTenantDb` cae a las cookies). Un cron que itera clientes no tiene cookies. El ejecutor envuelve
todo en `runWithWorkspace(ws)` (`63a0f95a`).

**Cada forma de acción se confirma por SU camino**, no por uno nuevo: la pendiente
(`confirmarPendiente`), la pantalla genérica (`aplicarPropuestaGenerica`) y las 7 de pantalla
propia —el borrador del plan (`aplicarPropuesta`), el alta de leads (`createLead` con su chequeo de
duplicados) y el WhatsApp de empresa (`enviarBorrador`)—. Las 5 heredadas (`proponerLegado`) dejan
la pendiente con origen «hola-mako» fijo: ahora, con la clave `app:flujo:`, llevan el flujo.

⚠️ **«Ya está así» no es un fallo para un flujo.** Muchos `preparar()` del registro rechazan lo que
ya es el estado actual («ya está en ese producto», «ya está marcado como calificado»): correcto para
una persona, y para un flujo una alarma al dueño en cada evento repetido. `Preparado` gana
`yaEstaba`, `ejecutarOperacion` lo propaga y el ejecutor lo cuenta como éxito. Hoy lo marcan las
operaciones de producto, la inscripción en curso, la asistencia y el calificado; el resto de los
«ya está» del registro todavía no.

**Las operaciones que faltaban** (las pedía el relevo de arriba): `inscribir_lead_secuencia`
(chatbot; la decisión y la escritura son UNA función, `inscribirEnSecuencia`, y antes de inscribir
contesta lo que el motor cerraría sin mandar —secuencia pausada, sin reunión futura, fuera del
tope—), y `agregar_lead_a_producto` / `quitar_lead_de_producto` / `mover_lead_en_producto` +
la lectura `productos_del_lead` (crm, sobre `lib/lead-funnel.ts` sin cambios). Ninguna sale por HTTP.

⚠️ **El id de un producto del CRM es el del EMBUDO, no el de la tabla `productos`.** Del producto al
embudo hay dos saltos: un id del otro catálogo movería al lead en el producto equivocado sin error.
El parámetro se llama `embudoId` y su descripción lo dice.

⚠️ **`listarFunnels` devuelve `[]` cuando la lectura falla**, y como todo negocio tiene al menos un
embudo, vacío significa «no pude leer»: `productosCrm` lo trata así.

⚠️ **Lo que cazó la revisión adversarial** (`wf_d229086b-56f`: 20 confirmados, 3 refutados), y que
vale para cualquier operación nueva:

- **Un id sacado de un link con `split('/').pop()` se lleva la query.** `proponer_tareas_plan` y
  `proponer_lead` sacaban el id del link que arma la tool vieja con `linkApp(…, wsEnContexto())`;
  adentro de `ejecutarOperacion` el contexto tiene workspace, así que el link trae `?ws=N` y el id
  quedaba `prop…?ws=3`. Desde un flujo, `aplicarPropuesta` no encontraba nada en CADA corrida. Va
  `split(/[?#]/)[0]` antes de partir por `/`. La versión de fondo es que la tool devuelva el id.
- **Un `leadId` OPCIONAL vacío es «ninguno», no «el del evento».** `paramsDelPaso` le inyectaba el
  lead del evento a toda operación que declarara `leadId`: un «Proponer un WhatsApp» a un teléfono
  fijo recibía además el lead, y la operación contestaba «el teléfono no coincide» siempre. Ahora
  se inyecta sólo si es obligatorio o si el paso lo pidió con `LEAD_DEL_EVENTO`; y «Otro lead» sin
  id se guarda como `LEAD_A_ELEGIR` y no viaja (antes era un `''` que se borraba y caía al evento).
- **Un borrador de pantalla propia se aplica ENTERO**: `proponer_cierre_tareas` necesita sus
  `cerrarIds` (sin ellos, «no hay nada para crear, cerrar ni borrar»), y el alta de leads reclama la
  propuesta ANTES de crear (dos corridas con el mismo id, por el `ref`, creaban dos veces).
- Lo obligatorio que le falta a un paso lo dice UNA función pura (`faltanEnPaso`), que usan el
  motor de avisos (no corre el paso) y el saneo de las secuencias (no lo guarda).

**SIN HACER:**
- La reentrega de Cal.com y Calendly ya no repite los pasos (`dedupKey`, ver
  `hallazgos-comunicacion.md`); Fathom y Meta también reintentan y sus `dispararEvento` todavía no
  llevan clave. Chatwoot no reintenta.
- El editor (`EditorAccionMako.tsx`) pide `secuenciaId`, `embudoId` y la key de una etapa como
  números o texto sueltos: falta un selector alimentado por `listar_secuencias_nutricion` y
  `productos_del_lead`.
- No hay operación para SACAR a un lead de una secuencia, así que inscribir no se deshace por API.
- Mover a un lead en su producto PRINCIPAL desde `mover_lead_en_producto` se niega y deriva a
  `proponer_cambio_etapa`: unificarlo obliga a decidir qué hace el paso con el monto o el motivo.
- Por chat no se puede CREAR un paso de acción (`editar_pasos_secuencia_mensajes` exige canal y
  cuerpo para un paso nuevo); se crea en el lienzo.

*08/10/2026, cuenta 2. Corrida `wf_48a7d912-9a9` (tres agentes en worktrees) y revisión
`wf_d229086b-56f`; commits `fafe007b`, `6d4703ec`, `63a0f95a`, `40d8f052`, `b2a6db9d`, `395c4c11`.*

## Agenda por WhatsApp: los dos casos abiertos, cerrados — y cuatro formas de romperlo sin un error (09/10/2026)

**Vive en:** `lib/mako-intencion.ts` (`esPedidoAgenda`, la sección de mover, `DESTINO_TIEMPO`,
`preguntoReunionOTarea`) · `lib/doer-herramientas.ts` (`INSTRUCCION_MOVER_SIN_OBJETO`,
`SIN_FECHA_DE_TAREA`) · `lib/mako-doer-in.ts` · `tests/agenda-whatsapp.test.ts`

Decisión de Martín del 09/10 («terminalo todo») sobre los dos casos de la entrada de arriba:

1. **«movela al viernes» sin nada abierto** se leía como mover a un lead DE ETAPA (`MOVER_A` tomaba «al
   viernes» por una columna), sin `agenda_del_dia` ni nada del plan; «cambiala para el jueves» o
   «reprogramala para mañana» caían al default con dos herramientas. Ahora un pedido corto de mover a un
   día u hora SIN objeto nombrado lleva CRM y plan, mete en el presupuesto reagendar, leer el día y las
   tareas, y el turno pregunta UNA vez «¿La reunión o la tarea?». Con una propuesta de agenda abierta es
   la reunión y no se pregunta. La agenda sigue sin pasar por la IA.
2. **«Agendar reunión con…» dentro de una lista** sigue siendo material para el plan (cargar tareas no
   pregunta nada). ⚠️ La premisa «sola ya era una orden» era falsa: sola también caía al default. Ahora el
   infinitivo es orden de agenda sólo en UNA línea y con reunión y día u hora.

**Lo que midió la revisión con el turno real** (`clasificarIntencion` + `herramientasDelTurno`), y ninguno
da error — dan la herramienta equivocada:

- **«pasalo a agendado para el lunes» preguntaba «¿La reunión o la tarea?».** Era mover un lead a una
  ETAPA; bastaba un día en cualquier lado del mensaje. Y no hay lista de nombres de etapa que lo resuelva:
  las etapas son de cada negocio. El día tiene que ser el DESTINO del verbo («al», «para el», «del…»).
- **La respuesta («la tarea») se reconocía después de CUALQUIER pregunta de MaKo**, así que «la agenda de
  mañana?» dejaba de ser una consulta y llegaba como acción con herramientas que escriben. El doer le dice
  ahora al clasificador si MaKo hizo ESA pregunta (las dos palabras en la misma pregunta), y «no, la tarea»
  también cuenta.
- **«Buen día, movela al viernes» llegaba sin la pregunta**: `herramientasDelTurno` volvía a leer el texto
  con el preludio del CRM, que no pela «buen día». Ahora lo dice el veredicto (campo `mover`), que
  sobrevive al saludo. ⚠️ Es la misma familia que «un prefijo de saludo no es el mensaje» (AGENTS.md): dos
  lectores del mismo texto con dos peladores distintos.
- **Un audio dictado llega en UNA línea**: «Agendar reunión con Ana mañana a las 15, llamar a la
  inmobiliaria y subir las fotos» se volvía una orden de agenda. Con otro infinitivo después de una coma o
  un punto, vuelve a ser material.
- **Un `if (porId('cambiar_fecha_tarea_plan'))` en el test iba a romperlo al integrar** la rama
  `wip/api-acciones-0910`, donde esa acción existe y es SÓLO HTTP. O sea que por WhatsApp no hay con qué
  cambiarle la fecha a una tarea, y el modelo tenía a mano sólo `proponer_tareas_plan`, que CREA una. El
  turno se lo dice (`SIN_FECHA_DE_TAREA`) cuando esa herramienta no viaja, y el test mira `visible`.

**Lo que decide Martín:** si `cambiar_fecha_tarea_plan` sale también por WhatsApp. Hoy, a «movela al
viernes» → «la tarea», el turno le avisa al modelo que no tiene con qué cambiarle la fecha (para que no cree una tarea nueva); no se midió qué le contesta a la persona.

_09/10/2026 — agente en worktree + revisión adversarial (8 roturas, cada una con su fallo, y dos del
implementador re-hechas); `tests/agenda-whatsapp.test.ts` 16/16. Integrado por quien escribe esto._
