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
