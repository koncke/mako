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
`areasDelMensaje` + `toolsDelRegistro` con el `maxChars` real, y cinco frases reales.
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
- El canal `flujo` (`lib/api-mako/tipos.ts` CANALES, `canal.ts`, `ejecutar.ts`), bloqueado por
  la decisión de qué corre solo.
- `lead_funnel` e inscribir un lead en una secuencia, en el registro.
- Declarar `lib/api-mako/` en un área de `app/admin/dev/areas.ts`.

*08/10/2026, cuenta 2. Corrida `wf_88a97c1e-c89`.*

## ⚠️ Un token con nombre vale SOLO para /api/v1: la ruta de la skill entrega el principal (08/10/2026)

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
- **Qué token pidió cada llamada**, por fila: una columna en `api_llamadas` (migración,
  `supabase/migrations/0158_api_llamadas.sql` + `lib/api-mako/bitacora.ts`).

*08/10/2026, cuenta 2, sin subagentes. Commit `f2c0a04b`.*
