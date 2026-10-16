# Hallazgos del plan

El board `/plan`, el Perro Guardián, el pipeline reunión → tareas y el reparto por
proyecto. Lo que aprendimos trabajando ahí y **no se puede deducir leyendo el código**.

⚠️ **Buena parte de este material es de segunda mano.** Sale de lo que devolvieron los
subagentes de 261 corridas multi-agente entre junio y agosto de 2026 —134 de 260 nunca
habían escrito nada en el repo— y no de una relectura del código de hoy. Cada entrada
dice de qué corrida y de qué fecha viene; el registro completo está en
[corridas-multiagente.md](corridas-multiagente.md). **Antes de actuar sobre una,
verificá contra el código.** Las marcadas ⚠️ estaban vivas la última vez que alguien miró.

La regla que produce este documento está en [AGENTS.md](../AGENTS.md) → «La cosecha».

## Lo que más muerde acá

- **El detalle rico que cargás nunca llega entero al tablero**: hay un sexto escritor aguas abajo que lo reescribe y dos topes de 600 caracteres que nadie tenía en el inventario → [El detalle y el contexto de las tareas](#el-detalle-y-el-contexto-de-las-tareas).
- **El ruteo a proyectos falla abierto**: el catch del catálogo cerrado deja inventar proyectos, un `uid()` que se vuelve `NaN` deja tareas huérfanas y el default manda todo al primer seed → [Ruteo a proyectos](#ruteo-a-proyectos).
- **Medir un fix de extracción de reuniones sin forzar el re-análisis es medir la salida vieja**: hay tres candados encadenados que sirven lo de antes → [De la reunión a la tarea](#de-la-reunión-a-la-tarea-fathom).
- **Lo que ves andar en el board del dueño puede estar muerto en el del cliente**: impacto/esfuerzo, `hacelo_en` y el auto-cierre corren sobre tablas distintas → [El board](#el-board-plan) y [Señales y auto-cierre](#señales-y-auto-cierre).
- **El Perro no puede atajar un duplicado**: no ve las tareas al 100% y no recibe los ids para nombrar la que encontró; y el cruce anti-duplicados falla mudo → [Dedup](#dedup-nunca-duplicar-siempre-ampliar).
- **Un 404 de Fathom no significa que la grabación no exista**: el call-id y el recording-id son dos espacios de ids distintos → [De la reunión a la tarea](#de-la-reunión-a-la-tarea-fathom).
- **Las preguntas rotas del Perro no están en la base**: se generan al confirmar y no se persisten, así que dumpear `notas` muestra sólo las buenas y el bug parece no existir → [Las preguntas del Perro](#las-preguntas-del-perro-contrato-tipo--campo).
- **Un campo nuevo de la extracción muere en TRES `map` escritos a mano, y ninguno da error**: entre «el modelo contestó» y «la tarea nació» hay cuatro saltos y dos altas distintas → [De la reunión a la tarea](#-un-campo-nuevo-de-la-extracción-muere-en-tres-map-escritos-a-mano-y-ninguno-da-error).
- **El juez del criterio de compromisos de Mauricio tiene CERO call sites**: módulo entero, con prompt, saneo y 16 tests, que no corre sobre ninguna reunión → [De la reunión a la tarea](#-el-juez-del-criterio-de-mauricio-tiene-cero-call-sites).
- **El texto del SEED de `PlanBoard.tsx` describe el pasado, no el presente**: un agente que lo grepea lee «el board vive en localStorage con el Repo en no-op» y lo reporta como estado actual, tres meses después de que dejó de ser cierto → [El board](#el-board-plan).
- **Que una reunión «desapareciera» no quiere decir que la descartó el clasificador**: del 08 al 15/10 el ws1 perdió diez y el clasificador no descartó ninguna — falló la LECTURA y salió de la ventana de 26 h. Lo que el cron no lee (por tipo o por falla) queda en `plan_reuniones_descartadas` → [Fathom sin fricción](#fathom-sin-fricción-cargar-sin-ia-el-cruce-en-el-cron-y-lo-que-no-se-leyó-16102026).
- **`experimento_tareas.score_manual` EXISTE desde la 0143**, aunque tres comentarios (y AGENTS.md) decían que no: el candado del cliente no necesitaba una columna sino un escritor. Y lo que un trabajo escribe en segundo plano tiene que llegar a la pestaña abierta, o el próximo guardado lo deshace → [«Re-priorizar todo»](#re-priorizar-todo-un-trabajo-por-tandas-el-candado-del-cliente-y-lo-que-pinta-la-pantalla-16102026).

---

## Las preguntas del Perro (contrato tipo ↔ campo)

### ✅ «¿Cuál es el deadline?» con botones del 1 al 5: el diagnóstico obvio era el equivocado, dos veces

Síntoma: preguntas cuyo campo de respuesta no contesta lo que preguntan. Dos capturas del
dueño el 2026-08-08 — «¿Cuál es el deadline para tener los ángulos listos?» y «¿Para cuándo
se necesita el video de bienvenida?», las dos dibujadas como una escala 1-5.

**Los dos diagnósticos obvios eran falsos, y descartarlos fue la mitad del trabajo:**

1. *«El modelo barato tipea mal»*. Se corrieron los dos generadores vivos
   (`preguntasParaCargar` y `profundizarPropuesta`) con el prompt real contra Groq, Gemini
   y OpenAI: **13 preguntas, 2 escalas, las dos con los extremos bien explicados y ninguna
   pidiendo una fecha**. El modelo acierta casi siempre. El problema no era la tasa de
   error sino que **no había ninguna red abajo**.
2. *«Está mal lo que hay guardado»*. Se dumpeó `plan_propuestas.notas` entero: **132
   preguntas, 86% `opcion`, sólo 2 `escala`, y las 10 que piden fecha son todas `opcion`
   con opciones sanas** («Esta semana» / «Próximos 15 días» / «Sin fecha fija»). El
   borrador de la captura («Leila con Martin Konke») tenía 4 preguntas y las 4 estaban
   bien. Las rotas **no estaban en la base**: se generan al vuelo al confirmar y no se
   persisten en ningún lado, que es también por qué nadie las había podido revisar antes.

Las tres causas reales, todas en el saneo y ninguna en el modelo:

- **`escala` era el único tipo EXENTO del chequeo de coherencia.** El saneo decía
  `if (tipo !== 'escala' && !opciones.length) tipo = 'texto'`. Al no tener ningún requisito
  propio, se volvió el imán de toda pregunta que el modelo no supiera tipear.
- **Ante `{tipo:'escala', opciones:[fechas]}` ganaba el token y se TIRABAN las fechas**
  (`opciones: tipo === 'escala' ? [] : opciones`). Esas respuestas no quedaban en ningún
  lado: ni en la base, ni en la pantalla, ni en el log. Y era la salida *esperada* del
  prompt de reuniones, que exigía opciones para toda pregunta y ofrecía `escala` en el enum
  **sin definirla nunca**.
- **No existía ningún tipo capaz de contestar «¿para cuándo?»**, mientras los prompts
  ordenaban preguntar deadlines y prohibían las preguntas abiertas. El modelo quedaba
  acorralado y elegía el menos malo.

Cómo quedó: `lib/preguntas-contrato.ts` es fuente única (tipos + `sanearPregunta` + el texto
que leen los cinco generadores), hay un tipo **`fecha`** con calendario, y un solo
renderizador `PreguntaCampo`. La regla que gobierna código nuevo está en AGENTS.md («Una
regla en un prompt no es una regla»).

**Vive en:** lib/preguntas-contrato.ts · lib/plan-propuesta.ts (limpiarPregunta, los dos prompts) · lib/plan-fathom.ts (preguntasDeContexto) · app/plan/board/guardian-form.tsx · tests/preguntas-contrato.test.ts · *2026-08-08*

### ⚠️ El chip «Por: …» apuntaba a la tarea equivocada, y eso solo ya hace que una pregunta buena se lea al azar

Reporte del dueño: «¿Cuál es el presupuesto asignado para la capacitación del equipo?» sobre
la tarea «Rediseñar estructura de funnels». Parece una alucinación y **no lo es**: en el
mismo lote (borrador `propmskgpno0rxldp`, ws9) la tercera tarea era «Capacitar al equipo en
la nueva estructura de funnels y productos». La pregunta era pertinente; **el chip la hacía
ilegible**.

`profundizarPropuesta` mostraba el `sobre` tal cual lo mandaba el modelo. `preguntasParaCargar`
sí lo normalizaba contra los títulos reales — otra vez la misma regla escrita en un solo lado
de dos caminos gemelos. Ahora los dos pasan por `apuntarSobre`, que además **re-apunta** el
chip cuando el título citado no comparte ni una palabra con la pregunta y hay otro que
comparte dos o más (el recorte de raíz a 6 letras es lo que hace que «capacitación» y
«Capacitar» sean la misma palabra), y lo **borra** si no puede atribuirlo a ninguna tarea:
sin chip se lee mejor que con uno que miente.

Queda vivo un problema distinto y sin resolver: la pregunta igual era floja (nadie asignó un
presupuesto para capacitar a su propio equipo). Se endureció `PROFUNDIZAR_SYSTEM` con la
regla de «si le serviría igual a cualquier negocio del mundo, está mal» y se acotó el
disparador de «un número de plata», pero **eso es prosa y por lo tanto no es una garantía**.

**Vive en:** lib/preguntas-contrato.ts (apuntarSobre) · lib/plan-propuesta.ts (profundizarPropuesta, PROFUNDIZAR_SYSTEM) · *2026-08-08*

### ⚠️ El cruce «ya está en el plan» marcaba por TEMA, y un falso positivo esconde trabajo

«Contratar el plan de $100 para no agotar los créditos» (pagar una suscripción de IA) se
marcó como duplicada de #105 «Reglas de presupuesto según la plata real» (programar el
motor que mueve el presupuesto de los anuncios). La razón que dio el modelo lo delata:
«ambas apuntan a gestionar el presupuesto y evitar agotar recursos». Eso es un TEMA
compartido, no el mismo trabajo.

**Por qué es grave y no cosmético:** una candidata marcada llegaba con `incluir: false`, o
sea DESTILDADA. Entre veinte tareas, el dueño no la ve, confirma, y el pedido de la reunión
se pierde sin que nada avise. **El error de marcar de MÁS cuesta muchísimo más que el de
marcar de menos**: un duplicado que se escapa se arregla con un clic.

Y otra vez el patrón: el prompt YA decía «solo marcá enriquece cuando de verdad es el MISMO
trabajo, ante la duda es nueva». No alcanzó, porque era énfasis, no criterio. Lo que sí
opera es **una prueba que se pueda aplicar**: *si alguien HACE la tarea del plan, ¿la
candidata queda hecha también?* Contratar el plan sigue pendiente después de escribir ese
motor → no es la misma. Se sumó eso, más el caso real como few-shot negativo, más una
`confianza` que el código USA: solo `alta` destilda sola; con `media` se avisa y la tarea
entra tildada.

Queda SIN hacer: no existe «es otra tarea» para re-apuntar el cruce a una tarjeta distinta
—solo «no es la misma», que la desmarca del todo— y el cruce no se persiste (ver abajo).

**Vive en:** lib/mako-guardian.ts (CRUCE_SYSTEM_TEMPLATE, cruzarCandidatas) · app/plan/board/TareasRecibidasModal.tsx (el efecto `cruzadoRef`) · *2026-08-08*

### El catálogo de proyectos ahora distingue la PANTALLA del AGENTE que vive adentro

«Investigar herramientas de heatmap para landing pages» se fue a «Vender MaKo». No fue un
error de criterio del modelo: **no existía «Feature: Landing Analyst» en el catálogo**, y la
regla le dice —bien— que ante la duda elija de la lista. Un ruteo no puede acertar a un
destino que no está.

Dos cambios que salen de ahí:
1. El catálogo se completó contra `nav.ts`, incluidas las tabs en «coming soon». **El
   proyecto tiene que existir ANTES que la primera tarea**, o la primera tarea de cada
   feature nueva cae en la vecina más parecida.
2. Familia nueva **`Agente: `** (`PREFIJO_AGENTE`). La frontera, dictada por el dueño: **si
   corre solo, es agente; si lo abrís y lo usás, es feature.** Por eso los Analysts y los
   Generators siguen siendo `Feature:` aunque usen IA. «Feature: Plan» era el tablero Y el
   Perro en el mismo proyecto, así que el avance de la pantalla y el del cerebro que la
   puntúa se sumaban en la misma barra.

`nucleo()` ignora los DOS prefijos, y eso hace suave el cambio de familia: las tareas que
ya vivían en «Feature: MaKo Doer» siguen matcheando con «Agente: MaKo Doer» sin migrar nada.

**Vive en:** lib/plan-proyectos-catalogo.ts · *2026-08-08*

### ⚠️ «Este borrador ya no existe»: el link lo transcribe un MODELO, y son 17 caracteres al azar

El id de un borrador es `prop` + base36 aleatorio (`propmskimbc4s4b4h`). El código lo arma
bien (`lib/mako-doer-acciones.ts`, caso del borrador), pero la instrucción que sigue le
dice al modelo «mandá una línea corta + este link» — o sea que **la integridad del id
depende de que un LLM copie 17 caracteres aleatorios sin errarle a uno**.

Verificado en esta misma sesión, y el modo de falla es peor de lo que parece: el dueño
pasó un link diciendo que ahí estaba la pregunta que reportaba, y ese id resolvía a un
borrador REAL pero equivocado (1 tarea sobre un Reel de Instagram, cuando lo que tenía en
pantalla eran 3 tareas de funnels, `propmskgpno0rxldp`). O sea que no siempre cae en «no
existe»: **a veces cae en el borrador de otra cosa**, y ahí nadie se entera.

Se descartó lo obvio antes de llegar acá: no hay borradores vacíos, ninguno en estado
`procesando` o `fallado`, `getPropuesta` no filtra por estado (un borrador aplicado
muestra «ya fue aplicada», no «no existe») y `duenoDePropuesta` usa el cliente de
servicio, así que ve todos los workspaces. Para ver «ya no existe» **la fila tiene que no
estar**: el id que llegó no es ninguno de los que se crearon.

**RESUELTO.** Dos capas, y la segunda es la que cura:

1. *La red*, en la pantalla: si el id no existe y el que mira tiene UN solo borrador
   pendiente, se abre ése; con varios, se listan. Un id equivocado deja de ser un
   callejón sin salida — pero NO ataja el caso peor, el del borrador equivocado.
2. *La cura*, en la salida del doer: **el link ya no lo escribe el modelo.**
   `corregirLinkBorrador` (lib/link-borrador.ts) toma el link que devolvió la tool —el
   id REAL— y corrige la respuesta antes de mandarla: si el modelo cambió un carácter lo
   reemplaza, si usó otro host lo normaliza, si lo repitió lo deduplica y si se lo olvidó
   lo agrega. Con 9 tests, uno por cada forma de fallar que se vio.

Y cuando el modelo se equivoca queda un `console.warn` con los dos ids. Sin ese log no
hay forma de saber si el problema sigue vivo, porque la corrección lo vuelve invisible.

⚠️ **El otro camino que manda este link NO tenía el problema y conviene saber por qué:**
`lib/reunion-destinatarios.ts` arma el texto del WhatsApp por código (`textoWhatsapp(…,
link)`), sin modelo en el medio. La diferencia entre los dos caminos es exactamente la
lección: **un dato exacto que pasa por las manos de un LLM deja de ser exacto.**

⚠️ **Otra causa del mismo síntoma, sin modelo en el medio: el link no dice de qué workspace es**
(16/09/2026). `linkTarea`, `linkProyecto` y `linkBorrador` de la API de MaKo
(lib/api-mako/areas/plan.helpers.ts:87-89) no llevan `?ws=`. Quien pertenece a varios workspaces
abre el link en el que tenga activo, y `getPropuesta` no lo encuentra. Ahí la red de arriba empeora
las cosas: si en ESE workspace hay un solo borrador pendiente, la pantalla abre ése
(app/plan/revisar/[id]/page.tsx:43-44) — el link correcto muestra otro borrador, que es el caso
peor de esta entrada. Si no, cae en «es de otra persona» (:55-58). Y agregar el `?ws=` no alcanza
para todos: `proxy.ts` lo acepta solo de una sesión `admin` (:142-164); para cualquier otro es texto
decorativo.

**Vive en:** lib/link-borrador.ts + tests/link-borrador.test.ts (la cura) · lib/mako-doer-in.ts (donde se aplica) · app/plan/revisar/[id]/page.tsx y NoEsTuyo.tsx (la red) · lib/api-mako/areas/plan.helpers.ts:87-89 (los links sin `?ws=`) · *2026-08-08 · 2026-09-16 api-mako-areas*

### ⚠️ El molde del detalle de un PROYECTO existía y el generador no lo conocía

`MOLDE_PROYECTO` (Qué es / Qué ya está / Qué falta / Por qué importa) vive en
`lib/detalle-contrato.ts` desde hace tiempo, y el repo hasta tiene `evaluarDetalleProyecto`
para validarlo. Pero el prompt que ESCRIBE los proyectos —`GUARDIAN_PROY_NUEVOS_SYSTEM_TEMPLATE`—
pedía «un DETALLE SÓLIDO (3-4 frases)», y `mako-guardian.ts` **no importaba `MOLDE_PROYECTO`
en ninguna línea**.

O sea: **el camino oficial por el que nacen los proyectos nunca usó el molde del repo.** Por
eso salían en prosa corrida y después había que arreglarlos a mano con
`scripts/barrido-proyectos.ts` — un script que existe precisamente porque el generador no
hacía su trabajo. Pedir una forma y validar otra es garantizar el retrabajo.

Se sumó también `scripts/describir-proyectos.ts`: la puerta para los proyectos abiertos a
mano, que no pasan por `priorizarNuevasOwner` y por eso nacen sin detalle y sin score. Llama
a la MISMA función del Perro, con las guardas de barrido-proyectos.

⚠️ **Un proyecto creado con un INSERT directo saltea al Perro.** Nace con `detalle` vacío y
`score` 0, y el board lo pinta como sin puntuar para siempre. La skill `plan-tareas` ya lo
dice para las tareas («NUNCA hagas insert into plan_tareas»); vale igual para los proyectos.

**Vive en:** lib/mako-guardian.ts (GUARDIAN_PROY_NUEVOS_SYSTEM_TEMPLATE) · lib/detalle-contrato.ts (MOLDE_PROYECTO) · scripts/describir-proyectos.ts · *2026-08-08*

### La frontera Agente / Feature: si corre solo es agente, si lo abrís es feature

El catálogo tenía 4 agentes y el código tiene 8. La que faltaba y más dolió fue la **Retro**:
7 archivos, ~2.200 líneas, tablas y prompts propios, y no comparte NADA con `mako-guardian.ts`
salvo una llamada — pero como no tenía proyecto, su trabajo terminaba anotado dentro de
«Agente: Perro Guardián». El catálogo es CERRADO, así que **un proyecto que falta no produce
un error: produce un ruteo silenciosamente equivocado.**

La frontera la dictó el dueño y es nítida: **si corre solo, es agente; si lo abrís y lo usás,
es feature.** Por eso los Analysts y los Generators siguen siendo `Feature:` aunque usen IA.

El caso que NO cierra solo con esa regla y hay que resolver a mano: una pantalla que tiene
adentro un cerebro que corre solo. Son DOS proyectos. Pasó con Plan/Perro y volvió a pasar
con CRM: el motor de auto-transición (cron, 9 corridas por día) estaba adentro de
«Feature: CRM», así que el avance de la pantalla y el del motor se sumaban en la misma barra.

Al relevar el código aparecieron además dos tabs reales SIN proyecto (Modelos IA y el
WhatsApp propio de la agencia): el mismo agujero que tenía Landing Analyst, que fue el que
mandó una tarea de heatmaps a «Vender MaKo».

**Vive en:** lib/plan-proyectos-catalogo.ts (PREFIJO_AGENTE, las 8 entradas de familia 'agente') · docs/preguntas-para-llenar-proyectos.md · *2026-08-08*

### Una «idea» tirada por WhatsApp casi nunca es una tarea: es un proyecto

El wizard de revisión solo sabía crear lo que YA venía escrito en el borrador. Pero el
uso real es otro: el dueño manda una línea por WhatsApp, MaKo pregunta cuatro cosas, y de
esas respuestas aparece trabajo que nadie anotó — «esa idea termina siendo todo un
proyecto con diferentes tareas». Ese trabajo se perdía: quedaba como texto en el contexto
que lee el Perro, y nada más.

Ahora, al terminar de contestar, el Perro decide **con libertad** si de las respuestas
sale más trabajo (`tareasDesdeRespuestas`). Devolver cero es la respuesta más común y está
escrito así en el prompt: esto no tiene que producir tareas para justificar la llamada.

Dos decisiones que valen para cualquier cosa parecida:

1. **Se reusa `FilaCandidata`, la misma fila del modal de una reunión.** Es la misma
   decisión del usuario («¿esta tarea entra o no?») con el mismo gesto (checkbox +
   «corregir contexto»), así que tiene que ser la misma pieza. Se exportó en vez de
   escribir una segunda — que es como nacieron los dos renderizadores de preguntas.
2. **Cada tarea propuesta muestra DE QUÉ RESPUESTA salió** (`porQue`, y en el «Por qué»
   del detalle va la frase textual del dueño). Sin eso, una tarea que aparece sola se lee
   como ruido y se destilda por las dudas: la trazabilidad es lo que la vuelve creíble.

Y el «no repitas lo que ya está» del prompt **se verifica en código** con `mismaTarea`
(lib/tareas-dedup), no se confía. Un duplicado acá es peor que una tarea de menos, porque
el dueño ya revisó esa lista.

**Vive en:** lib/plan-propuesta.ts (`tareasDesdeRespuestas`, TAREAS_EXTRA_SYSTEM) · app/api/plan-propuesta/route.ts (acción `tareas-extra`) · app/plan/revisar/[id]/RevisarPropuesta.tsx (paso `extra`) · app/plan/board/ReunionTareas.tsx (FilaCandidata, ahora exportada) · *2026-08-08*

### Lo que quedó SIN hacer en las preguntas

Confirmado por la auditoría del 2026-08-08 (30 hallazgos verificados) y deliberadamente
fuera del alcance de ese arreglo:

- **Las respuestas del modal del board no se persisten en ningún lado.** Cerrar el modal las
  tira, y «Volver a las tareas» borra todas las respuestas *y* vuelve a pagar la llamada de
  IA que armó las preguntas. El wizard de /plan/revisar sí guarda en localStorage, pero **no
  las respuestas de los cierres**: un F5 descarta los «sí, está hecha». → `app/plan/board/TareasRecibidasModal.tsx` (`irAPreguntas`, el autosave) · `app/plan/revisar/[id]/RevisarPropuesta.tsx` (`LS_KEY`).
- **La respuesta de una `escala` llega al Perro como un número pelado** («la pregunta → 3»),
  sin decirle que es una escala 1-5 ni qué significan los extremos. Y una pregunta salteada
  desaparece, así que no puede distinguir «no contestó» de «no se preguntó». → `lib/mako-guardian.ts`.
- **El board del CLIENTE tira el deadline que calcula el Perro** (`priorizarNuevasCliente`
  aplica score, razón, detalle y checklist, pero no deadline): una respuesta con fecha nunca
  llega a la tarea del cliente. Es el mismo patrón que `hacelo_en`. → `lib/todo-guardian.ts:72`.
- **Los dos generadores vivos se facturan como `feature: 'mako-doer-in'`** (WhatsApp), así
  que su costo y su modelo se atribuyen a otra cosa y el override de /modelos-ia no los
  alcanza. → `lib/plan-propuesta.ts`.

## El board `/plan`

### ⚠️ `plan_tareas` ya trunca en el buscador y va a truncar en el board: 643 de 1000 en ws9

**Síntoma (17/09/2026):** ninguno visible todavía en el board. En el buscador, sí: el
`console.warn` de `app/api/plan-buscar/route.ts` ya estaba avisando que se cortaba.

**Causa:** `plan-buscar` y `lib/cerrar-por-commits.ts` leían con `.range(0, 599)` **sin
`.order()`**. El tope era a propósito (entra en un prompt), pero con 643 tareas en ws9 cuáles
43 quedaban afuera lo decidía Postgres. Un tope deliberado sin orden no es un tope: es un
sorteo. Ahora los dos leen el tablero entero con `leerTodo` por `id`, y `plan-buscar` recorta
en memoria **con criterio** (abiertas por score primero, después las hechas más recientes) y
dice en el log cuántas quedaron afuera.

**Lo que quedó SIN hacer:** el board mismo. `lib/plan-board.ts:101` (`select('*')` de
`plan_tareas`, sin paginar) y `:180, 302, 405, 583, 656, 735, 906`, `lib/plan-proyecto-vacio.ts:53,
107` y `app/admin/dev/roadmap.ts:142`. Al ritmo de +100/mes cruza las 1000 en unos 3,6 meses, y
el día que cruce el tablero del dueño pierde tareas sin error, como le pasó al CRM
([hallazgos-crm.md](hallazgos-crm.md) → `_listLeads`). Ojo al arreglar: `:101` ordena por
`orden` y `num`; se pagina por `id` y ese orden se aplica en memoria. El aviso de
`lib/api-mako/areas/plan.helpers.ts:16` («no pagina») se saca en el mismo commit.
`scripts/limpiar-seed-clientes.ts` y `scripts/probe-historial-largos.ts` ya paginan: el
primero borra proyectos «vacíos» según lo que lee, y un corte le hacía borrar proyectos con
tareas.

**Vive en:** lib/plan-board.ts · lib/plan-proyecto-vacio.ts · app/api/plan-buscar/route.ts · lib/cerrar-por-commits.ts · app/admin/dev/roadmap.ts · *2026-09-17 caza de paginado*

### ⚠️ El SEED de `PlanBoard.tsx` es un archivo histórico, y un agente lo lee como documentación

Una corrida de siete agentes reportó como su hallazgo más caro que «el tablero del dueño vive en localStorage con el Repo en no-op, así que el agente que marque tareas completadas no puede escribirle». Suena grave y estaba verificado: la cita es literal y está en `app/plan/PlanBoard.tsx`. **Es falso desde hace meses.** Lo que el agente leyó es el `detalle` de la tarea **#177** dentro del array del SEED — o sea, el texto que alguien escribió describiendo el problema *cuando existía*. Cincuenta líneas más abajo, el `Repo` real (línea 742) llama a `/api/plan-board` en los seis métodos, con el comentario «Ya NO hay localStorage / bandeja / ops / snapshot». La contra-prueba es de un segundo: leer `plan_tareas` en Supabase devuelve las 438 tareas abiertas.

El SEED es la trampa perfecta para un grep: son ~200 tareas con descripciones largas, en prosa afirmativa y en tiempo presente, dentro de un `.tsx` — indistinguibles de un comentario técnico para cualquiera que busque por palabra clave. Y describen el estado del mundo **en el momento en que se escribió cada tarea**, que es justamente el estado que después se arregló.

**Regla:** una afirmación sobre el estado del sistema no se toma de una cadena de texto, ni siquiera de una que está en el código. Se toma del código que corre (el `Repo`, la ruta, la tabla) o de la base. Si la única evidencia de un hallazgo es prosa, no es evidencia: es historia.

**Vive en:** app/plan/PlanBoard.tsx:294-296 (SEED) vs app/plan/PlanBoard.tsx:739-750 (el Repo real) · *2026-08-08 barrido-superficies-dev*

### ⚠️ Buscar «CAC» traía media lista: `includes` cae en el medio de las palabras

El dueño escribió `CAC ` en la barra y volvió casi todo el tablero. La primera lectura fue que el espacio final rompía algo — y el espacio **sí** era una señal, pero no la causa. La causa es que `coincide` hacía `heno.includes(termino)` a secas, y «cac» vive adentro de notifi·**cac**·iones, autenti·**cac**·ión, publi·**cac**·ión, apli·**cac**·ión, cualifi·**cac**·ión y planifi·**cac**·ión. En español, un término corto adentro de una palabra larga no es un caso raro: es el caso típico. Un término tiene que **empezar** una palabra.

El espacio quedó como lo que el usuario esperaba que fuera: `CAC` a medias sigue trayendo «cacheo», `CAC ` —cerrado— pide la palabra entera (tolerando el plural, que es la misma palabra). Se decide mirando el texto **crudo**, porque el normalizador hace `.trim()` y borra la señal.

Y de paso apareció el motivo por el que el bug era difícil de ver: había **dos buscadores** en la misma pantalla. `BoardShell.tsx` tenía su propia copia de `coincide`/`paraBuscar` para el filtro de proyectos; una sacaba la puntuación y la otra no, una sacaba las etiquetas HTML y la otra no. Probar en la barra de tareas y en el selector de proyectos daba resultados distintos para la misma consulta. Ahora las dos importan `lib/buscar-tareas`.

**Vive en:** lib/buscar-tareas.ts (`coincide`, `terminos`, `paraBuscar`), tests/buscar-tareas.test.ts, app/plan/board/BoardShell.tsx:1889 · *2026-08-08*

### ⚠️ El impacto/esfuerzo que calcula el Perro se pierde en cada reload — solo para los clientes

La migración 0093 le dio columnas `impacto` y `esfuerzo` a `plan_tareas` y `plan_proyectos` (el board del dueño), pero `experimento_tareas` (el board del CLIENTE) no las tiene y `lib/todo.ts` no las menciona ni una vez. `editPatch` de app/plan/TodoBoard.tsx:36-44 manda titulo, detalle, prioridad, progreso, deadline, categorias, checklist, historial, en_prioridad, score, score_razon y fuente — todo menos impacto/esfuerzo. El guardián los calcula (useBoard.ts), se pintan en pantalla y se evaporan al recargar, así que la matriz impacto×esfuerzo de app/plan/board/Graphics.tsx:183-184 muestra «Sin impacto/esfuerzo cargado todavía» para siempre en cualquier workspace de cliente. Es un caso vivo de la regla «cambios impactan a clientes»: el dueño lo ve funcionar y el cliente nunca.

**Vive en:** app/plan/TodoBoard.tsx:36 (editPatch), lib/todo.ts, supabase/migrations/0093_plan_board.sql (columnas solo en plan_*) · *2026-07-16 · perro-guardian-captura*

### ⚠️ El front no mira si el server hizo el trabajo, y falla mudo

Dos casos del mismo patrón en el board. (1) `rePriorizar` chequea solo `j.ok`: la ruta del Perro devuelve `{ok:true, ...}` incluso cuando puntuarPlan cortó y trae `error` + arrays vacíos, así que aplica el no-op, marca la firma como procesada y no avisa nada — el propio código ya documenta el precedente: 13 corridas pagadas (US$2.74) sin una sola prioridad aplicada y nadie se enteró. Para el dueño es peor que invisible: `recordUsage` ya corrió, así que salta el toast "MaKo usó IA · re-priorización · $X" confirmando un cobro por una corrida que no aplicó nada. (2) `deleteTask` no mira el `ok` y ni `apiPlan` ni `api` tiran nunca: un 403/500/corte de red se traga, la tarjeta desaparece localmente y vuelve en la siguiente carga — literalmente "pareciera que no se borró". Regla: un update optimista necesita fail-loud (revertir + avisar), y si el envelope trae un campo `error`, el consumidor lo lee.

**Vive en:** app/plan/board/BoardShell.tsx:290-296, app/plan/PlanBoard.tsx:746, app/plan/TodoBoard.tsx:77, lib/mako-guardian.ts:403-415 · *2026-08-01 auditoria-plan-y-whatsapp*

### ⚠️ El tope por tarjeta no era el problema: el scroll infinito era el historial AGREGADO

Se buscaba el bug en el `slice(0, 40)` del historial por tarjeta. Una sonda read-only a prod lo descartó: el récord real es 14 entradas en un proyecto y 6 en una tarea — ese tope NUNCA se toca. El scroll venía del historial agregado de la tab de Proyectos (191 filas hoy, con flatMap sobre todos los labels). Dos deudas quedaron abiertas del mismo hilo: el cap client-side es `HIST_CAP = 80` y el del server `slice(0, 40)`, así que el navegador puede mostrar entradas que el próximo save borra; y el nuevo `slice(0, 200)` con 191 filas reales está a punto de empezar a esconder historial sin decirlo (el botón cuenta sobre 200, no sobre el total). `NotasLista.tsx:97` sigue sin ningún tope.

**Vive en:** app/plan/board/BoardShell.tsx:1746; app/plan/board/types.ts:139 vs lib/plan-board.ts:414/522 · *2026-08-05 cierre-ronda-mako*

### ⚠️ Ids optimistas que pasan por `Number()`: NaN que se descarta en silencio

Dos variantes del mismo patrón, ambas mudas. (1) Si `createTask` falla, la tarjeta queda con su id temporal `'tmp…'` para siempre: cada edición posterior manda `Number('tmp…')` = NaN, el route responde 400 y `saveTask` no chequea `j.ok` → el usuario ve que guardó y no guardó nada, hasta que recarga y la tarjeta desaparece. (2) Las etiquetas se crean con `uid()` ('xabc123'); `editPatch` hace `d.labels.map(Number).filter(Number.isFinite)` y tira las no reconciliadas sin error visible. Además, cuando el create SÍ resuelve, la reconciliación reemplaza la tarjeta optimista ENTERA por la canónica del server, descartando lo que el usuario editó durante el vuelo. La regla: mientras un id sea temporal, o bloqueá la persistencia o mapeá temp→canónico antes de mandar; y al reconciliar, mergeá dentro del updater en vez de reemplazar.

**Vive en:** app/plan/board/useBoard.ts create/createLabel + TodoBoard.tsx editPatch/saveTask + app/api/todo/route.ts · *2026-07-12 ~auditoria-board-todo*

### Precomputar el `next` fuera del functional updater: dos setState en un handler se pisan

El PriorizarWizard perdía el deadline que el usuario acababa de elegir: guardaba el checklist y la tarea seguía marcada «⚠ falta deadline», con el wizard ya cerrado. La causa no era el wizard sino `patchLog`/`patchLogExplicit`: leían `t = byId(id)` del `tasks` del render, armaban un objeto `next` COMPLETO y hacían `setTasks(ts => ts.map(x => x.id===id ? next : x))` devolviendo ese `next` constante. Como `guardar()` llama a setDeadline y setChecklist en el mismo handler sincrónico, ambos leían el mismo snapshot viejo y el segundo pisaba al primero (también en el `persist` a la base). El contraste lo prueba: `patch()` computa dentro del updater a partir del `t` fresco y no tiene el bug. La regla: en un hook con varios setters encadenables, el estado nuevo se computa DENTRO del updater, nunca antes. tsc no ve nada de esto.

**Vive en:** app/plan/board/useBoard.ts (patchLog/patchLogExplicit vs patch) + PriorizarWizard.tsx · *2026-07-12 ~auditoria-board-todo*

### `setChecklist` pisa en silencio si tocás dos veces la misma tarea, y reabre sola una tarea al 100%

El caller le pasa el array `next` ya calculado, y lo calcula leyendo `tasks` del render actual (`byId` adentro también). Dos mutaciones sobre la MISMA tarea dentro de un mismo loop (típico de aplicar un lote de decisiones de MaKo) hacen que la segunda pise a la primera, sin error y sin rastro: hay que agrupar por id y fusionar en un solo patch antes de llamar. Aparte, deriva el progreso INCONDICIONALMENTE (`done/total`): agregarle 2 ítems sin tildar a una tarea 4/4 la baja a 67% y la reabre sola, y si la tarea no tenía checklist, N ítems nuevos la dejan en 0%. Sirve como mecanismo de «reabrir» deliberado, pero es una trampa si solo querías sumar ítems.

**Vive en:** app/plan/board/useBoard.ts:172-180 (setChecklist) · *2026-07-16 · ~perro-ataja-duplicados-al-crear*

### `hecho_at` se re-sellaba en cada edición porque el patch siempre mandaba el progreso

Una tarea completada el 1/7 pasaba a tener `hecho_at` del 12/7 con sólo renombrarla o arrastrarla de columna. El guard parecía correcto (`if (patch.progreso != null)`), pero `editPatch` incluía SIEMPRE `progreso: d.progress` — un número, nunca null — así que el guard era verdadero en todo touch y volvía a ejecutar `upd.hecho_at = new Date()`. El comentario decía «sella hecho_at» (una vez, al completar) y el código sellaba en cada guardado. Como el ledger de accountability se ordena por `experimento_tareas.hecho_at`, editar una tarea vieja la corría a otro período de retro. La regla: un timestamp de transición se sella comparando contra el estado PREVIO (`COALESCE(hecho_at, now())` o un SELECT antes), no ante la mera presencia del campo en el patch.

**Vive en:** lib/todo.ts editarTarea + app/plan/board/TodoBoard.tsx editPatch · *2026-07-12 ~auditoria-board-todo*

### `key={obj.id}` no re-monta: un objeto nuevo con el mismo id no revalida nada

El modal de tareas recibidas inicializa sus filas con `useState(() => …)` (init perezoso desde props). Si se pinta primero lo que ya está en memoria y después llega la respuesta del server, un swap de objeto con el MISMO id no re-inicializa absolutamente nada: el modal sigue mostrando el snapshot viejo y puede ofrecer «Agregar al plan» sobre tareas ya cargadas en otra pestaña. Para que la revalidación entre, la key tiene que ser una huella de lo que importa (`id:estado:tareas.length:aplicadas.length`), no el id. Del mismo hilo: `resumenPropuestasPorRefs` ya hace `.select('id, ref, estado, tareas, aplicadas')` y reduce la columna pesada a dos `.length` — o sea trae el 85-90 % del peso de la fila y lo tira, obligando a un segundo round-trip; medido, `select('*')` cuesta lo mismo (467 ms vs 491 ms).

**Vive en:** app/plan/board/BoardShell.tsx:751 y :791; app/plan/board/TareasRecibidasModal.tsx:112; lib/plan-propuesta.ts:379-391 · *2026-08-05 cierre-ronda-mako*

### Deshacer un borrado recreaba la tarea como manual y le cortaba el hilo con la retro

`remove` guarda un snapshot y el «Deshacer» del toast llama a `repo.createTask(snap)`, pero ese camino manda sólo `{titulo, prioridad}`: el server aplica `origenOk(undefined)='manual'` y deja `retro_id`/`experimento_id` en null, y el `editar` que le sigue tampoco los acepta. Resultado: una tarea que MaKo había creado desde una Retro reaparecía con ícono de usuario, perdida la atribución, y desligada del join de accountability `experimento_tareas.retro_id`. La regla: restaurar no es crear — o el 'crear' del restore lleva los campos de procedencia (el route ya los acepta), o hace falta una acción 'restaurar' que reinserte la fila completa.

**Vive en:** app/plan/board/useBoard.ts remove/undo + TodoBoard.tsx createTask + lib/todo.ts crearTarea · *2026-07-12 ~auditoria-board-todo*

### Un opt-in guardado en localStorage sin workspace se filtra al impersonar

`AUTOLOAD_KEY = 'mako_reunion_autoload'` es una key por ORIGEN, sin namespace. El super-admin prende «cargalas solas al plan» en su propio board, después entra como un cliente (mismo origen, mismo localStorage) y abre una reunión de equipo de ese cliente: `finalizar()` lee autoload=true, saltea la pantalla de revisión y le inyecta tareas al plan del cliente, donde nunca optó por nada. No es fuga de datos (las tareas son suyas y van a su plan), es fuga de CONSENTIMIENTO. Regla: toda preferencia o consentimiento guardado en localStorage se namespacea por workspace_id.

**Vive en:** app/plan/board/ReunionExtractModal.tsx:19 y :94-147 · *2026-07-18 ~review-autocarga-reunion*

### El `window.location.reload()` al aplicar un borrador es el contrato, no pereza — no lo cambies por estado local

`onListo={() => window.location.reload()}` parece un atajo obvio de arreglar, y romperlo degrada la pantalla. Dos razones concretas: no existe ningún endpoint de listado de tareas (ni `/api/todo` ni `/api/plan-board` tienen acción de listar; tareas y categorías salen ÚNICAMENTE del server component `app/plan/page.tsx` con `force-dynamic`), y el Perro corre server-side DESPUÉS de crear, con sus parches descartados a propósito (hay un comentario textual en la rama cliente de plan-propuesta que lo dice). La respuesta de `aplicar-lote` devuelve `{ ok, ids, borradas }` — ids pelados, sin título, score, checklist ni fuente. Pintar con eso mostraría las tarjetas sin score y sin checklist, justo lo que el usuario espera ver.

**Vive en:** app/plan/board/BoardShell.tsx:630 · lib/plan-propuesta.ts (rama cliente de aplicarPropuestas) · *2026-08-01 · auditoria-plan-tareas-basura*

### Todo lo que se construye para el dueño se construye para el cliente en la misma pasada

La vista de super admin y la del cliente son **la misma pantalla**, y nunca se razona «esto es solo para el dueño». No es una aspiración: es la falla que más veces volvió — el botón para traer tareas de Fathom no aparecía en la vista de clientes (2026-07-13), impacto/esfuerzo se evapora solo en el board del cliente, `hacelo_en` solo se persiste en el del dueño, el auto-cierre solo mira la tabla del cliente. Cada vez que una feature toca un board, hay que abrir los dos.

> «no entiendo porque la vista de superadmin y cliente son diferentes en la tab de Plan, deben ser lo mismo» (2026-07-13) · «los cambios que hacemos tienen que impactar siempre para clientes también. Nunca razones que es solo para el dueño» (2026-07-22) · «todo esto tiene que modificarse también para los clientes, que les aparezca lo mismo» (2026-07-12)

**Vive en:** app/plan/PlanBoard.tsx (dueño) vs app/plan/TodoBoard.tsx (cliente) · lib/plan-board.ts vs lib/todo.ts · lib/plan-senales.ts

### Las decisiones de forma del board que ya están tomadas

- **Prioridades arriba, kanban abajo.** ~~Las 4 columnas de prioridad son fijas~~ — **desde el 16/10/2026 las columnas son el ESTADO** (Por iniciar · En proceso · Atorada · Completada, y «No cumplen tu criterio» al final sólo si tiene tareas) y la prioridad pasa a ser FILTRO y chip: «el espíritu más importante del Kanban es el flujo… No la clasificación» (Mauricio, 12/10). Siguen sin ser editables y ocupando todo el ancho; los proyectos existen para agrupar tareas. «Dentro del gran proyecto 'Hacer MaKo DOER' entran muuchas tareas» (2026-07-12). Ver [El estado pasa a ser la columna](#el-estado-pasa-a-ser-la-columna-16102026).
- **El To-Do es su propia tab con kanban completo** (columnas y proyectos editables, checklists, adjuntos), tomando como base el tablero de `/martinkoncke` y la estética del CRM — que ya es un kanban que funciona, así evitamos inventar dos lenguajes visuales (2026-07-12).
- **Toda preview usa las cards REALES.** El formato de las tarjetas de un modal tiene que ser idéntico al del kanban y al de proyectos: «la preview de esas tienen que ser IGUALES a como ya los tenemos, para no confundir» (2026-07-22).
- **Toda acción irreversible o generada por IA pasa por un modal de confirmación que PREVISUALIZA lo que va a pasar** — «de lo contrario, se van a crear muchas tareas que pueden estar mal» (2026-07-17).
- **Si algo debería pasar solo, pasa solo: no se agrega un botón para prenderlo.** «No debería existir el botón de "Las próximas reuniones cargarlas solas". Eso debería hacerse SIEMPRE, de manera automática» (2026-07-29).
- **Todo cambio queda en el historial, sin excepción y sin demora**, con el actor que lo hizo (MaKo vs Claude Code) y su motivo. Si lo hizo la IA, firma MaKo con ícono de IA, nunca con foto de usuario ni «vos». «No actualizaste el HISTORIAL de cambios en cada tarea o proyecto... Eso es muy grave... Eso tiene que ser regla siempre» (2026-07-17).
- **Toda tarea muestra SU origen real** (Fathom, WhatsApp, Claude Code, archivo subido), con el nombre del chat/reunión, el link, y **fecha y hora exactas** — nunca «hace 6 días», porque un chat largo no se ubica con eso (2026-07-19).
- **Toda entidad tiene ruta propia**, y cuando se crea algo se abre el link directo o se da entero, no se describe: «Siempre que se cree una tarea por cualquier origen tienes que o abrirme directo el link o dármelo entero» (2026-07-23).
- **Dos búsquedas, no una:** una avanzada donde el usuario opta explícitamente por buscar en detalle, checklists, notas y razones de prioridad, y una «Búsqueda con IA» que interpreta el input y elige las tareas. «Es incómodo y contraintuitivo que intente buscar coincidencia en un título y me salgan muchas tareas porque está leyendo el detalle» (2026-08-06).
- **Telegram se saca de toda la app** (2026-07-26).

### Lo que quedó sin hacer en el board

- **Los proyectos nuevos no se crean con ID** — «eso es un gran problema» — y falta mostrar qué proyectos creó vs cuáles reutilizó (2026-07-26).
- **No se puede buscar una tarea por ID:** «de qué sirve el ID si no los puedo buscar» (2026-07-17).
- **Filtrar tareas y proyectos por ORIGEN** de creación (WhatsApp, Fathom, Claude Code, archivos, todos) y ordenarlos por fecha de creación (2026-07-22).
- **La vista de las 3 prioridades no se actualiza sola al completar** una tarea (2026-08-01).
- **La descripción de tareas y proyectos tiene que ser «flotante»** como el título —editable, con negritas y subrayado— no una caja de texto (2026-07-13).
- **Falta un gráfico en la tab de Proyectos**, antes del change history (tamaño/cantidad de proyectos, filtrable por completados); pidió que propusiéramos cuál (2026-07-13).
- **Deep link para cada entidad que hoy vive en sub-tabs**: cada llamada de ventas analizada, cada anuncio ganador, cada retro, cada task/proyecto. Pidió mapear todo lo que se está quedando sin ruta (2026-07-15).
- **Pedidos de subir cosas al plan que nunca se subieron**: comprar un chip nuevo (2026-07-17), las tabs `mako-doer` y `ads-writer` «MUY precarias» (2026-07-17), el proyecto de MaKo mobile —qué tabs van a móvil y cómo se readaptan— (2026-07-15).

---

## El Perro Guardián

## La audiencia: cuando el número lo pide el DUEÑO

El pedido, textual: *«cambiar prioridad por el usuario también debería re-priorizar el resto. Y es por eso que el perro debe ser muy estricto y debe tener la capacidad de rechazar una re-priorización si los argumentos no son fuertes. Y claro que para eso tiene que hacer buenas preguntas.»* Son tres cosas encadenadas y el orden manda: **la cascada hace CARO aceptar, aceptar caro obliga a poder RECHAZAR, y rechazar bien obliga a PREGUNTAR.**

### ⚠️ Un guard que impide MOVER el número no impide ESCRIBIRLO — y el rechazo ponía el candado

El día anterior se arregló que un `veredicto: 'rechaza'` del Perro no moviera el score (`score: veredicto === 'rechaza' ? scoreActual : propuesto`, mako-guardian.ts). El arreglo era correcto y **no alcanzaba**, porque el que escribía era el navegador y no miraba el veredicto: `aceptar()` llamaba `onApply(ver.score, ver.razon)` en los dos modales, y para un proyecto eso era `patchLabelLog(id, { score, scoreManual: true, … }, 'Fijaste la prioridad en N debatiéndola', 'user')`. O sea **perder un debate le clavaba el candado de la mig 0143 al número que el propio Perro acababa de defender**: `priorizarProyectosOwner` no lo podía mover nunca más, y la razón que el dueño leía decía «Lo fijaste vos en 32» cuando él había perdido la discusión. Funcionaba «de casualidad» —el número era el correcto— así que ninguna pantalla lo delataba.

**La regla: cuando un control decide que NO, contá cuántas escrituras cuelgan de esa rama, no cuántas variables.** El guard cuidaba el valor; la fila entera se escribía igual, con dos columnas más que nadie miró. Y el corolario que lo cierra de raíz: **si hay una decisión que el server toma, el server escribe.** El camino nuevo (`lib/plan-reprio.ts`) no le deja al navegador ningún camino a la columna `score` — un camino que no existe no se puede olvidar de cerrar.

**Vive en:** lib/plan-reprio.ts · app/plan/board/AudienciaModal.tsx · *2026-08-22 · corrida de 11 agentes sobre el debate de prioridad*

### `coerceVeredicto` tenía el bug INVERSO: una bajada concedida salía como rechazo

`return subio ? 'acepta' : 'rechaza'` miraba solo el signo del delta contra el score actual, **sin saber qué se había pedido**. El dueño pedía bajar de 32 a 20, el Perro se lo concedía, y la etiqueta salía `'rechaza'` — con lo cual el guard de arriba le descartaba la concesión. El Perro decía que sí y el tablero no se movía. El otro agujero de la misma función: cualquier string fuera del enum colapsaba a uno de los dos, así que un `veredicto: "pregunta"` con el número subido se leía como **aceptación**.

Lo reemplaza `veredictoDe(pedido, actual, final)`: la etiqueta no es un dato del modelo, es una lectura de lo que el modelo HIZO. Es «cuando dos señales se contradicen, gana la más cara de producir» — un `veredicto` es un token que se tira sin pensar, un score es la decisión.

**Y el corolario que sale de acá:** por eso las PREGUNTAS del Perro no son un cuarto veredicto. Si el modelo pudiera devolver `veredicto: 'pregunta'`, cualquier versión del código que todavía no conozca esa constante la lee como aceptación — y una aceptación acá reordena el tablero entero. Las preguntas salen del código (`preguntaPorFaltante`), no de una etiqueta que hay que adivinar.

**Vive en:** app/plan/board/metodologia.ts (`veredictoDe`) · lib/plan-prueba.ts · *2026-08-22*

### El Perro no sabía que ya había dicho que no

Cada «volver a intentar» era una llamada nueva y limpia: el veredicto vivía en un `useState` y moría al cerrar el modal. Insistir con el mismo argumento flojo era gratis, no dejaba rastro, y eventualmente funcionaba — que es exactamente lo contrario de «ser estricto». **Un rechazo que no se persiste dura lo que dura la ventana.**

Con `plan_reprios` (mig 0144) los rechazos anteriores del MISMO ítem entran al prompt. Medido el mismo día: al segundo intento con un argumento parecido, la respuesta empezó con *«Mirá, me trajiste el mismo argumento de agosto»*.

**Vive en:** supabase/migrations/0144_plan_reprios.sql · lib/plan-reprio.ts (los `antecedentes`) · *2026-08-22*

### Un fallo de parseo se le mostraba al dueño como un VEREDICTO del Perro

`catch { return { veredicto: 'rechaza', respuesta: 'No pude procesar el debate, probá de nuevo.' } }`. El sistema le atribuía al Perro una decisión que nunca tomó, con toda la autoridad de un veredicto y en la misma pantalla roja. Es [[«no puedo hacer X con este dato» no es «este dato es falso»]] aplicado a la salida: un error de lectura **nunca** puede disparar la acción que dispara el hecho.

Y no era hipotético: **con `maxTokens: 2000` la respuesta se cortaba de verdad.** La cascada barata cae a `gemini-flash-lite`, que razona en voz alta antes del JSON, y terminaba por `"length"` — un JSON a la mitad. El techo estaba elegido pensando en otro modelo. Es la misma trampa que ya se pagó con las tareas del Perro: **el modelo que decide cuánto escribir no es el que estaba puesto cuando se eligió el número.**

**Vive en:** lib/mako-guardian.ts → `dictarAudiencia` · *2026-08-22*

### El candado de la mig 0143 nunca existió para las TAREAS

La migración agregó `score_manual` a `plan_proyectos`, `plan_tareas` **y** `experimento_tareas`. Del lado del código, solo `Label` tenía el campo: `BoardTask` no lo declaraba y `rowToTask`/`taskToRow` no lo mapeaban. O sea la columna se creaba, quedaba en `false` para siempre, y **una tarea cuyo score el dueño ganó discutiendo se la llevaba puesta la recurva de las 9:10**, exactamente el problema que la migración vino a cerrar. Una regla aplicada en un lugar de dos no está implementada.

**Vive en:** app/plan/board/types.ts (`BoardTask.scoreManual`) · lib/plan-board.ts:58 y :70 · *2026-08-22*

### Renombrar un proyecto desde una pestaña vieja pisaba su score

`guardarPlanProyecto` hacía `upsert(labelToRow(l))` — la fila ENTERA armada con el estado del navegador. Una pestaña abierta hace media hora que cambiaba el emoji escribía además el `score`, el `score_razon` y el `score_manual` que tenía en memoria, pisando la corrida de las 9:10 y un debate recién ganado. **No había ningún síntoma: el rename funcionaba perfecto.**

**La regla: un upsert de fila entera armada en el cliente escribe TODAS las columnas, incluidas las que ese formulario no muestra.** Si una columna la decide el server, no puede viajar en el payload del navegador — no alcanza con que la UI no la edite.

⚠️ **Para las TAREAS sigue vivo (16/09/2026).** `guardarPlanProyecto` ya descarta las columnas del server antes del upsert (lib/plan-board.ts:292), pero `guardarPlanTarea` sigue haciendo `upsert(taskToRow(t))` de la fila entera (:231-237), y es lo que llama el autosave del board (app/api/plan-board/route.ts:92). O sea: lo que MaKo le escriba a una tarea —checklist, avance, historial— lo pisa la próxima autoguardada de cualquier pestaña de `/plan/agencia` abierta con el estado viejo. **Releer la fila justo antes de escribir, como hace la API de MaKo, no protege: la carrera es con el navegador, no con otra escritura del server.** Falta un patch por columna en lib/plan-board.ts.

**Vive en:** lib/plan-board.ts → `guardarPlanProyecto` · `guardarPlanTarea` (:231-237) · app/api/plan-board/route.ts:92 · *2026-08-22 · 2026-09-16 api-mako-areas*

### El tablero está SATURADO, y eso hace que cualquier ajuste manual corra a todos

Medido en ws 9: **71 proyectos ocupando exactamente los valores 100 a 30, consecutivos, cero huecos** — `escalaEsperada(71,'proyecto')` da `{techo 100, piso 30}`, o sea el tablero está lleno por construcción. Eso NO es un bug: es la consecuencia aritmética de las dos reglas que el dueño pidió («el norte va en 95-100» + «prohibido empatar» + «con 100 proyectos la escala llega hasta el 1»). Pero tiene un corolario que hay que tener presente antes de tocar nada acá: **no hay lugar libre donde poner un número a mano.** Fijar el más bajo en 77 mueve 48 filas; fijarlo en 100 mueve 68.

Lo que sostiene que eso siga siendo correcto y no un tablero nuevo cada semana son dos auditorías DURAS, no una explicación: `mismoOrdenRelativo` (dos ítems que el dueño no tocó no se pueden cruzar) y `noPisaManuales` (un score fijado a mano no se mueve «solo un punto» — 79 ya es otra cosa que 80). Sin ellas, «la cascada solo arregla la escala» es una afirmación sobre el código, no una propiedad verificada de la salida.

**Vive en:** app/plan/board/metodologia.ts (`fijarYDesempatar`, `mismoOrdenRelativo`, `noPisaManuales`) · scripts/probar-cascada.mts · *2026-08-22*

### `desempatar` metía al proyecto con candado en el reparto y después lo ignoraba

`priorizarProyectosOwner` pasaba TODOS los proyectos a `desempatar` (incluidos los `score_manual`) y después escribía el manual con `antes.score`, ignorando lo que el desempate había decidido para él. Si el modelo le daba 100 a otro y ese aparecía primero en el array, quedaban **DOS proyectos en 100 en la base** — justo la falla dura que `sinEmpates` existe para cazar, escrita por el mismo código que la corre. `fijarYDesempatar` lo cierra reservando los valores fijados ANTES de repartir, en vez de confiar en que el orden de entrada alcance.

**La regla: si una función tiene una noción de «esto no se mueve», tiene que ser un parámetro, no un truco de orden.** Un truco de orden se pierde en el próximo refactor y no deja test que lo delate.

**Vive en:** app/plan/board/metodologia.ts:`fijarYDesempatar` · lib/plan-board.ts:931/945 · *2026-08-22*

### El «argumento fuerte» tiene que ser un TIPO DE DATO, no un adjetivo en un prompt

El pedido era que el Perro «rechace si los argumentos no son fuertes». Dejar eso en la prosa del prompt es la trampa de siempre: un modelo al que se le pide ser duro cede ante la insistencia, **y encima cobra tokens para ceder**. Lo que lo convierte en una regla de verdad es `exigenciaDe` + `cumpleLaCarga` (lib/plan-prueba.ts): la exigencia se calcula con aritmética (cuánto se sube, desde qué banda, si toca el norte) y se cumple con PRUEBAS tipadas que se resuelven contra la base antes de que el modelo vea nada.

Lo que compra, medido: *«Es re importante, hace mucho que está ahí y me tiene cansado»* → rechazado en 2 segundos y **cero tokens**, con dos preguntas bien formadas. Ese es el rechazo más frecuente y no lo hace el modelo: es instantáneo, gratis, y no se puede negociar porque no hay nadie del otro lado a quien insistirle.

Y la asimetría es deliberada: **BAJAR no se prueba.** El sesgo que el Perro existe para corregir es que todo parece urgente, así que sacar algo de arriba casi siempre es la decisión correcta. Lo que se paga es inflar. La única bajada cara es la del norte, porque bajar el norte sin nombrar el reemplazo deja un plan sin foco, no un plan con uno menos.

**Vive en:** lib/plan-prueba.ts · tests/plan-debate.test.ts · *2026-08-22*

### Lo que quedó SIN hacer

- **La FECHA sigue con el camino viejo.** `debatirFecha` es el único debate sin la metodología `MET_*` interpolada y sin `veredictoDe`: su `veredicto` es un string libre que se pinta en pantalla. Vive en lib/mako-guardian.ts y app/plan/board/FechaDebateModal.tsx.
- **El board del CLIENTE (`/todo`) no tiene audiencia.** `plan_reprios.tablero` ya contempla `'todo'` y la mig 0143 ya puso `score_manual` en `experimento_tareas`, pero `lib/plan-reprio.ts` escribe solo contra `plan_proyectos`/`plan_tareas`. Un cliente que quiera discutir una prioridad hoy no puede.
- **El gasto de la audiencia no se registra.** `dictarAudiencia` pasa `onUsage` pero cuando la feature va ruteada a la cascada barata el callback no vuelve con datos: el modal muestra la corrida como si no hubiera costado nada. Pasa igual en los otros debates, así que es del camino de `chatClaude`, no de acá.
- **Las preguntas del código no se re-mandan al modelo.** `preguntaPorFaltante` devuelve la pregunta y el modal la usa para pedir la prueba que falta, pero las RESPUESTAS todavía no vuelven en un segundo intento automático: el dueño tiene que volver a mandar. El campo `respuestas` del `Pedido` ya está cableado de punta a punta para cuando se haga.


### ⚠️ El Perro del board no puede VER una tarea al 100% ni NOMBRAR la que encontró

Se pedía que el Perro frenara un duplicado al crear y el diagnóstico obvio («le falta un chequeo») era el equivocado: el chequeo era inejecutable. Dos límites, los dos vivos hoy. (1) Los nueve call-sites del guardián en BoardShell filtran `t.progress < 100`, así que una tarea completada es estructuralmente invisible: una tarjeta al 100% que dice «probado» y otra nueva que dice «no funciona» no se pueden contradecir, se llame cuando se llame. (2) `planResumen` se arma como `- [score] título (proyecto)` SIN ids y eso es lo que recibe la acción 'debatir' al crear: el modelo no tiene con qué señalar el duplicado. La única función que sí manda `[id] título — detalle` es `buscarDuplicados`, y tiene UN solo call-site: EliminarModal — el Perro busca duplicados cuando querés BORRAR, no cuando creás. Mismo patrón que [[ruteo-sin-detalle]]: chequeá QUÉ le llega a cada eslabón.

**Vive en:** app/plan/board/BoardShell.tsx:439 (planResumen) y :162/193/218/325/336/401/755/758/764; app/plan/board/EliminarModal.tsx:64; lib/mako-guardian.ts:347 · *2026-07-16 · ~perro-ataja-duplicados-al-crear*

### ⚠️ «Esto se hace en MaKo» está exactamente invertido: se escribe donde molesta y falta donde sirve

El campo `hacelo_en` (botón «Ir a Ads Manager») solo se persiste en el board del DUEÑO (`lib/plan-board.ts`), y el board del CLIENTE —el único destinatario legítimo— lo descarta: `priorizarNuevasCliente` aplica score, razón, detalle y checklist pero nunca `haceloEn` (ni deadline, ni impacto, ni esfuerzo), y el adapter del TodoBoard tampoco lo mapea, aunque la columna existe desde la mig 0115. Medido en prod: de las 15 tareas con el campo puesto, 13 son tareas de CONSTRUIR la pantalla a la que te mandan (#524 «Dashboard: separar salud…» → «Ir a Dashboard») — precisión ~13%. La causa raíz no es el modelo: `puntuarNuevas` inyecta el catálogo de capacidades SIEMPRE, sin distinguir tablero, y en el board del super-admin los proyectos se llaman igual que las tabs POR DISEÑO, así que el match del título es perfecto con el significado invertido. Y la regla del prompt solo prohíbe «esto no pasa por ninguna pantalla»; no contempla «la tarea ES construir esa pantalla» (ni «evaluarla», «definirla»).

Es el mismo pedido que sigue abierto del lado del cliente: que el Perro detecte si una tarea se puede completar DENTRO de MaKo, lo explique en la tarea y dé el botón directo a la tab («Publicar campaña» → Ads Manager, 2026-08-05).

**Vive en:** lib/mako-guardian.ts:605 (regla del prompt) y :734 (inyecta capacidades siempre) · lib/plan-board.ts:464 (único que persiste) · lib/todo-guardian.ts:72 (lo descarta) · app/plan/TodoBoard.tsx · *2026-08-05 ronda-clientes-y-automatizacion*

### ⚠️ Las respuestas del wizard del Perro son write-only: viven en un prompt efímero y se tiran

El contexto que el dueño contesta (hasta 6 preguntas iniciales más las de profundizar) viaja como parámetro de función hasta puntuarNuevas y muere ahí. Al aplicar, el UPDATE escribe `notas: []` en las dos ramas del ternario y no existe ninguna columna donde guardar lo respondido (verificado: lib/plan-propuesta.ts:825-826, sin columna `respuestas`). En el camino feliz sobrevive el derivado (score, razón, detalle); si el Perro falla o si la request se corta por timeout (maxDuration 300 y el Perro corre en tandas de 20 DESPUÉS de marcar el borrador aplicado), el trabajo se pierde entero: el reintento choca con «La propuesta ya fue aplicada», la pantalla dice «✓ Creé N tareas» y el cliente borra su única copia en localStorage justo en ese momento.

**Vive en:** lib/plan-propuesta.ts:825 (notas: []) · app/plan/revisar/[id]/RevisarPropuesta.tsx · app/api/plan-propuesta/route.ts · *2026-08-05 · ~fathom-preguntas-lote-whatsapp-forense*

### ⚠️ Cero preguntas engendra cero preguntas: el generador que sí funciona cuelga de la otra puerta

`preguntasParaCargar` arma preguntas cerradas leyendo las tareas y su detalle, sin depender de lo que haya mandado el modelo del doer — pero su ÚNICO call-site es el modal del board (`TareasRecibidasModal.tsx:412`). El link que MaKo manda por WhatsApp va a /plan/revisar/[id], que arma los pasos con `prop.preguntas` y encima gatea la repregunta dinámica en `prop.preguntas.length > 0`: con 0 preguntas el wizard es una sola pantalla de «Crear». El mismo borrador pregunta si entra por el board y no pregunta si entra por el link. Por eso el reclamo «¿por qué no me lo preguntó?» no se arregla tocando el prompt del doer. Verificado vivo el 2026-08-07: sigue así.

**Vive en:** app/plan/revisar/[id]/RevisarPropuesta.tsx:211 y :222 · lib/plan-propuesta.ts:536 · app/api/plan-propuesta/route.ts:124 · *2026-08-06 · contexto-de-todas-las-tareas*

### ⚠️ El canal `eliminar` se propone y no se puede confirmar nunca; y el agente no puede mandar un lote de puros cierres

Dos cabos sueltos del riel de propuestas, los dos vivos el 7/8/2026. (1) El canal `eliminar` lo producen tres caminos y `aplicarPropuestas` lo sabe ejecutar, pero el wizard de revisión no tiene paso para confirmarlo: su `type Step` es `'cerrar'|'q'|'dyn'|'confirm'` y al aplicar solo manda `cerrarIds` y `aMediasIds`. Se propone y muere ahí. (2) `POST /api/agente/plan` corta con 400 «mandá al menos una tarea en tareas» aunque quince líneas después acepte `cerrar`: Claude Code no puede mandar un lote de puros cierres sin inventarse una tarea de relleno.

**Actualizado el 16/09/2026: lo de (1) no es un paso que falta, es a propósito, y por eso `eliminar` es una promesa falsa.** La regla del dueño es «JAMÁS me debe preguntar si borrar una tarea» (app/plan/revisar/[id]/RevisarPropuesta.tsx:72-75), así que el wizard no va a tener paso de bajas, y `aplicarPropuestas` solo borra con `eliminarIds` explícito y cruzado contra lo propuesto (lib/plan-propuesta.ts:762-767). Toda operación que acepte `eliminar` deja en la base algo que no va a pasar nunca. La API de MaKo lo sacó de `proponer_tareas_plan`; **la tool vieja del doer de WhatsApp todavía lo acepta y su resumen dice «y borrar M»** (lib/mako-doer-acciones.ts, `case 'proponer_tareas_plan'`).

**Vive en:** app/plan/revisar/[id]/RevisarPropuesta.tsx:72-76 · lib/plan-propuesta.ts:668-669,725,762-767 · app/api/agente/plan/route.ts:92 vs :110 · lib/mako-doer-acciones.ts · *2026-08-06 senales-de-avance · 2026-09-16 api-mako-areas*

### La prioridad y el deadline no se ponen a mano en ningún lado

No hay pantalla donde cambiarlos: ni en tareas, ni en proyectos, ni en la vista de prioridades. El usuario SUGIERE, el Perro corre igual y tiene la palabra final; se debate con él, no se lo pisa. Una salida manual vacía de sentido al motor entero.

> «me permite CAMBIAR LA PRIORIDAD, para qué carajos tenemos al perro que cuida la prioridad si en esta tab la puedo cambiar» (2026-07-22) · «En proyectos puedo cambiar la prioridad a mano, del 1 al 10... Nuevamente, eso debería pasar por el perro guardián» (2026-07-13)

Lo mismo aplica a nosotros: **no se insertan tareas a mano en `plan_tareas`, ni se les asigna prioridad o proyecto.** Se le pasa el CONTEXTO y decide el Perro — «tú NO debes crear tareas y meterla al plan forzadamente, debes pasarle el contexto y que el script y el perro hagan el trabajo» (2026-08-05). Y el dueño se incluye a sí mismo en la regla: «que yo haya escrito esta lista a mano, en un chat de WhatsApp habla de que no estoy utilizando el perro guardián. Y si yo no lo utilizo que soy su creador, no me imagino mis clientes...» (2026-07-16).

**Vive en:** lib/mako-guardian.ts · lib/plan-board.ts · la skill `plan-tareas`

### Todos los orígenes pasan por el MISMO proceso: preguntas + Perro

WhatsApp, Fathom, archivo subido y Claude Code cargan tareas por el mismo riel: preguntas de contexto primero, Perro Guardián después. Sin atajos y sin caminos paralelos — cada vez que uno se saltó el riel apareció como «¿por qué no me preguntó?» o «esta tarea no tiene prioridad».

> «Eso ya lo hablamos, tiene que estar en todos los orígenes involucrado el MISMO proceso» (2026-07-23) · «me preocupa si estás siguiendo la metodología del perro guardián... la que siempre debemos seguir» (2026-07-26)

**Vive en:** lib/plan-propuesta.ts (el riel) · lib/plan-fathom.ts · lib/mako-doer-acciones.ts · app/api/agente/plan/route.ts

### Cómo puntúa el Perro, y por qué esa escala

- **Criterio único:** «lo que traerá más dinero, más rápido y más fácil», ponderando esfuerzo vs impacto, comparando cada tarea contra TODAS las demás una a una, y **dejando escrita la razón del puntaje** — la razón escrita es la única forma de que él y los clientes se den cuenta si el Perro está haciendo bien su trabajo (2026-07-13).
- **Escala 1-100 en tareas y en proyectos.** Arrancó en 1-100 para tareas y 1-5 para proyectos (2026-07-12), y con muchos proyectos «la escala del 1 al 10 se quedó corta» y se repetían los puntajes: «Si todos tienen el mismo puntaje no sirve para nada toda la funcionalidad de prioridades» (2026-07-13).
- **Objetivo Principal**: un proyecto, como tercera tab de Prioridades; en Prioridad Alta entran SOLO tareas de ese proyecto. El porqué es el diagnóstico del dueño: «es el principal problema que tenemos los emprendedores, muchas ideas, muchas tareas, y parálisis por análisis» (2026-07-12).
- **El Perro también decide los deadlines** y puede **crear proyectos**, no solo tareas; y los proyectos llevan ORIGEN igual que las tareas, porque hay que poder rastrear de qué chat o reunión salió cada cosa (2026-07-19).

### Lo que quedó sin hacer en el Perro

- **Se re-ejecuta y re-prioriza en cada refresh o al entrar a la tab:** «no debería para nada correr cada que le doy refresh» (2026-07-13). Cada corrida es plata.
- **Tareas sin detalle de prioridad** en la tab de Mauricio (el Perro directamente no actuó sobre ellas) y otras en proyectos equivocados (2026-08-01).
- **El Perro no participa de la Retro** (ver [Retro y experimentos](#retro-y-experimentos)).

---

## El detalle y el contexto de las tareas

### ⚠️ El sexto escritor del `detalle`: checklist-coach reescribe lo que escribieron los otros cinco

Síntoma: de los cinco orígenes de una tarea, solo claude-code conservaba el molde de 4 partes en el tablero, y Fathom saltaba de p50=136 chars en el borrador a p50=228 en la tarjeta sin que nadie tocara su prompt. Causa real: hay un SEXTO escritor aguas abajo — `checklistsParaTareas` corre dentro de `priorizarNuevasOwner` sobre TODAS las tareas de TODOS los orígenes (también las de clientes, vía todo-guardian) y su contrato pedía prosa de 2-4 frases; `fusionarDetalle` le suma ese texto al del origen, así que el markdown sobrevive solo si el origen lo trajo. La regla: cualquier contrato del campo `detalle` que no incluya a checklist-coach se rompe solo aguas abajo, y arreglar el prompt del origen no alcanza. Segunda mitad, igual de importante: cuando el coach infla el detalle sin ver el material original (105→854 chars desde el título y un stub), eso no es contexto recuperado, es maquillaje generado hoy.

**Vive en:** lib/checklist-coach.ts (CHECKLIST_BATCH_JSON_SHAPE) + lib/plan-board.ts:485 y :521 (checklistsParaTareas / fusionarDetalle) + lib/todo-guardian.ts · *2026-08-06 · contexto-de-todas-las-tareas*

### ⚠️ El piso de largo que le pedís al prompt choca contra un techo de 600 en la otra punta

El detalle de las tareas de reunión salía pobre (74-265 caracteres contra las 4-8 frases que pide el prompt) y el inventario de recortes decía «los tres topes del camino son 4000/6000/6000 y nunca se tocan». Falso: hay un CUARTO y un QUINTO recorte, de 600 caracteres, justo en el camino de repartir una tarea a otro participante — `app/api/plan-reunion/route.ts:61` (`String(t.detalle).slice(0, 600)`) y `lib/plan-inbox.ts:66`. Los dos siguen vivos hoy. La regla: antes de subir el piso de largo en un prompt, buscá los topes de la ruta ENTERA por la que viaja ese texto; si no, el detalle rico llega cortado a mitad de frase exactamente en el escenario que motivó el cambio, y encima sin error.

**Vive en:** app/api/plan-reunion/route.ts:61 y lib/plan-inbox.ts:66 (el prompt vive en lib/plan-fathom.ts) · *2026-08-05 · ~borrador-reunion-fathom-frentes*

### El contexto que manda el dueño no se resume: si mandó un audio largo, tiene que verse en el título y en el detalle

No es una preferencia de estilo, es la queja que más volvió: él invierte tiempo en dar contexto (audios largos, transcripciones con ejemplos) y la tarea sale con dos renglones genéricos.

> «yo me tomo el trabajo de enviar audios largos o darle mucho contexto y eso no se ve reflejado luego en el título o la descripción de la tarea» (2026-08-05)

De ahí salen tres reglas que gobiernan cualquier cosa que escriba en `detalle`:

- **Toda tarea y todo proyecto llevan descripción DETALLADA y checklist.** Hay contexto de sobra —WhatsApp, reuniones, chats de Claude, commits—: usalo. «la descripción de los proyectos que creaste está pobre... Tienes mucho contexto por todos lados... Sé detallista con eso» (2026-07-13).
- **No poner topes arbitrarios.** Ni horas de agenda, ni ventana de días, ni cantidad de resultados: el tope lo pone la API, no nosotros (2026-08-07). Aplicado acá, es exactamente el gotcha de los 600 caracteres de arriba y el `limit: 25` de la [búsqueda de reuniones](#el-tope-de-25-de-listmeetingspage-es-un-índice-mudo-si-la-reunión-no-está-entre-las-últimas-25-se-cae-media-extracción).
- **El feedback se guarda para reusarlo.** Los aprendizajes de cada corrección se persisten y se aplican a las piezas siguientes en todos los orígenes; no se pierden en el chat (2026-07-22).

**Vive en:** lib/detalle-contrato.ts (fuente única del molde) · lib/detalle-fusion.ts · lib/checklist-coach.ts · lib/plan-fathom.ts

### La voz: acento argentino solo cuando MaKo asesora, español plano en todo lo que produce

Lo que MaKo escribe PARA el cliente —títulos y detalles de tareas, guiones, copy, textos de la app, onboarding— va en español plano. El voseo queda para cuando asesora en el chat.

> «Está bien que MaKo tenga el acento argentino al asesorar, pero no al crear cosas para el cliente, como guiones o textos que van en los anuncios» · «No pongas '¿Tenés algún otro documento para sumar?'» · «No utilices acento argentino, a veces no se te entiende... ¿A qué te referís con que los tableros "banquen"?» (2026-06-30)

Del mismo hilo: **nada de jerga interna ni tecnicismos** en lo que ve el cliente. Si el nombre no se entiende solo, se cambia — «Que no ponga 'La fábrica de creativos'», «'Vieron tus videos', nuevamente no se entiende. ¿Qué videos? ¿mis reels? ¿mis ads? Sería, vieron tus anuncios», «no quiero tecnicismos como la matriz 3x3».

**Vive en:** los prompts de `lib/plan-fathom.ts`, `lib/checklist-coach.ts`, `lib/mako-doer-acciones.ts` · el registro de prompts editables (`lib/prompt-registry.ts`)

### Lo que quedó sin hacer con el contexto

- **Los detalles de las tareas creadas desde WhatsApp (y el resto de orígenes) salen pobres** comparados con las de Claude Code, y MaKo no repregunta cuando falta contexto (2026-08-06). Está enganchado con «cero preguntas engendra cero preguntas», en [El Perro Guardián](#el-perro-guardián).
- **El lote de WhatsApp** tiene que esperar y cargar todas las tareas juntas en vez de procesarlas de a una, y la cantidad de preguntas tiene que adaptarse al volumen: no es lo mismo cargar 2 tareas que 20 (2026-08-05). El buffer del lote vive del lado de comunicación → [hallazgos-comunicacion.md](hallazgos-comunicacion.md).

---

## El pipeline de reuniones entrega, y nadie lo recoge

Relevamiento del 2026-09-08, 12 agentes, a propósito de un pedido de Mauricio para reemplazar
el extractor de reuniones. **El pedido resultó ser el síntoma equivocado**, y lo que apareció
midiendo el pipeline entero es peor que lo que se venía a discutir. Todo medido contra PROD.

### ⚠️ La tasa de confirmación de los borradores es 1,2%, y nadie la había mirado nunca

`plan_propuestas` del ws 1: **83 borradores, 80 pendientes, 1 aplicado.** El único aplicado es
del 1/8/2026. Su tablero **no recibe una tarea de Fathom desde el 5/8** — 101 de sus 110 tareas
se crearon entre el 1 y el 5 de agosto y no hubo ninguna más. En el mismo período se apilaron
959 tareas extraídas que nadie confirmó. Leila (ws 11): 2 aplicados de 27. Martín (ws 9): 62 de
113 — el único que usa el flujo es el que lo escribió.

El dueño lo reportó como *«de cada sesión salían 20-30 tareas sin orden y terminaba sin
usarlas»*. Las dos mitades de esa frase son falsas y la conclusión es cierta:

- **No son 20-30.** Medido sobre sus 83 borradores: **p50 = 9 tareas**, media 12,7, y solo 12 de
  83 (14%) llegan a 20. El prompt ya dice, doce líneas debajo de la que todos citan, *«NO hay un
  número que tengas que alcanzar… tres compromisos reales valen más que quince inventados»*
  (`lib/plan-fathom.ts:279`), y la producción le da la razón a esa línea.
- **No es «sin orden».** El Perro las puntúa y las agrupa por proyecto «Cliente: X».
- **Pero «termina sin usarlas» es literal**, y no pasa en la extracción: pasa en `/plan/revisar`.

**Vive en:** lib/plan-propuesta.ts:442 · app/plan/board/BoardShell.tsx:360 · *2026-09-08*

### El techo mudo que explica el 1,2%: el board muestra 8 borradores de 80

`listPropuestasPendientes(limite = 8)` — un default de firma, sin comentario que lo justifique.
Con 80 borradores pendientes, el badge le muestra los 8 más nuevos: **881 de 959 tareas (92%) no
aparecen en ninguna pantalla.** No hay «ver todos», no hay contador del resto, no hay error. Es
exactamente la forma de [[una bandeja que no existe]]: *un aviso es un EVENTO, una bandeja es un
ESTADO*, y acá el estado se muestra truncado sin decir que está truncado.

**La regla: un `limite = N` en la firma de una función de LISTADO es una decisión de producto
disfrazada de default.** Si la lista puede crecer, o el número se justifica al lado, o la
pantalla dice cuántos quedaron afuera. Un tope silencioso se lee como «esto es todo lo que hay».

⚠️ **Y ni siquiera devuelve N** (16/09/2026). El `.limit(limite)` corre en la base y el filtro
de borradores vacíos —sin tareas ni cierres— corre en JS DESPUÉS (lib/plan-propuesta.ts:445-447):
con un vacío entre los N más nuevos, vuelven menos de N aunque haya más pendientes detrás. Pedir
N+1 para calcular «hay más» miente en cuanto aparece un vacío; la API de MaKo pide 10 de más y lo
avisa en una nota (lib/api-mako/areas/plan.run.ts:335-339). El arreglo es filtrar en la consulta.

**Vive en:** lib/plan-propuesta.ts:442-449 · *2026-09-08 · 2026-09-16 api-mako-areas*

### La pantalla que el cliente pedía ya existía, y devolvía cero

`cs-cartera.ts` organiza a los clientes por «de quién es la pelota» (tuya / suya / al día), y su
regla de triage dice textual `if (c.compromisosAbiertos > 0) return { cancha: 'suya', razon:
'${n} compromisos abiertos de las sesiones' }` (:168-170). El campo se asigna
**`compromisosAbiertos: 0` en los dos lugares donde se arma la fila** (:247 con el comentario «se
llena abajo, con una sola consulta para todos», y :265) y no se llena en ninguna parte del
archivo. La cabecera del módulo afirma que la cartera gira sobre «los compromisos (82 tareas
abiertas)» — un número que nunca se calculó.

O sea: la rama de triage es código muerto, `/customer-success` contesta «sin nada pendiente»
para todos, y el cliente que la necesitaba pidió por escrito que se construyera.

**La regla: un campo declarado, con su rama de decisión escrita y su valor hardcodeado en 0, es
PEOR que un campo que falta.** El que falta rompe el build; este pinta una pantalla que afirma
algo. Es la misma familia que [[un indicador que afirma la mitad verdadera de un proceso de dos
pasos]]. Cuando dejes un `campo: 0 // se llena abajo`, el `abajo` va en el mismo commit o va un
`throw`.

**Vive en:** lib/cs-cartera.ts:168-170, :247, :265 · app/customer-success/page.tsx:39 · *2026-09-08*

### Comparar dos extractores sin correrlos sobre el mismo material no es comparar

El pedido venía con una medición seria detrás (4 iteraciones, 72 extracciones, juez con modelo,
dos auditorías del propio instrumento). Pero **las 6 llamadas de Fathom que midió y las 7 que
MaKo procesó no tienen una sola en común** — verificado por `call_id`: las suyas son de la serie
8xx, las de MaKo de la 7xx. Mismos clientes, sesiones distintas. Nadie corrió los dos extractores
sobre el mismo transcript contra la misma lista dorada.

Y el titular «pasó de 52 tareas a 13» tampoco compara lo que parece: **52 es la suma exacta de su
propia corrida v1** (12+8+6+6+4+16 en su bitácora), no la salida de MaKo. La comparación honesta
que sale de sus propios números —precisión 45%, recall 75%— es que su criterio emite **~1,67
tarjetas por cada compromiso de su lista**: con 13 esperados, ~22 tarjetas. Contra las 9 que MaKo
le deja hoy, **su criterio le daría MÁS, no menos.**

**La regla: antes de aceptar «lo tuyo saca de más», mirá si alguien corrió las dos cosas sobre el
mismo insumo.** Una precisión de 45% y una de 74% medidas contra listas doradas distintas, con
granularidades distintas, no se restan. Y si la granularidad difiere, hay un techo aritmético:
con 13 esperados sobre 52 extraídas, el mejor caso posible es 25% de precisión aunque acierte
todo.

**Vive en:** docs/hallazgos-plan.md (esta entrada) · *2026-09-08*

### El override de PROMPT es por workspace; el de MODELO es global. Uno aísla, el otro no

Asimetría verificada, y decide qué se le puede dar a un solo cliente sin ramas de código:

| | Cómo se resuelve | ¿Se puede por cliente? |
|---|---|---|
| Prompt | `getSetting` con `getWorkspaceActual() ?? OWNER_WS` (lib/settings.ts:17) | **SÍ** |
| Modelo | `runWithWorkspace(OWNER_WS, () => getSetting('mako.modelos'))` (lib/model-registry.ts:30) | **NO** |
| API key | `credWs('ANTHROPIC_API_KEY')` sin ws → la del workspace EN CURSO | — |

Las tres filas juntas dan el modo de falla: apuntar una feature a un modelo pago «para un
cliente» la apunta **para todos**, y la llamada de cada cliente se cobra a **su propia key** si
la tiene cargada (ws 9 y ws 11 la tienen). O sea: un favor a un cliente se factura a otro.

**Y el veto tampoco tiene dimensión de workspace:** `PermisoDeclarado` es `{feature, modelos,
hasta, porque, pidio}`, sin `ws`. Con `/modelos-ia` ofreciendo los 4 modelos de Claude a toda
feature sin consultar `modelosPermitidos()` (app/modelos-ia/ModelosIA.tsx:21-25), apuntar
`plan-fathom` a Sonnet desde la UI **no cobra: lanza**, cada parte falla, `partesFallidas` sube y
la reunión no se cierra. **Un extractor que tira excepción se ve idéntico a una reunión sin
compromisos.**

**Vive en:** lib/model-registry.ts:30-31 · lib/settings.ts:17 · lib/veto-claude.ts:62-75, :157-161 · app/modelos-ia/ModelosIA.tsx:21-25 · *2026-09-08*

### «Solo lectura» todavía no se puede prometer: el bearer no tiene alcances

`/api/agente/plan` está en `PUBLICOS` (lib/rutas-publicas.ts:96) y **no** en
`PUBLICOS_SOLO_LECTURA` (:107, que solo tiene `/compartido` y `/api/compartido`); `proxy.ts` corta
los métodos no-GET **únicamente** para las de SOLO_LECTURA (:191-196). O sea el mismo token que
lee habilita `POST /api/agente/plan` y `/api/agente/lead`. **No hay scopes por token en ningún
lado del repo.** Agravante de higiene: ese token se guarda **en claro** en `app_settings`
(lib/agente-token.ts:44-49) mientras los otros dos del repo guardan `sha256`.

Y no hay atajo por la base: **`grep 'create policy'` sobre las 167 migraciones devuelve CERO.**
Nunca existió un rol de Postgres acotado a un workspace; todo el runtime entra con `service_role`,
que bypassa RLS por diseño. Dar «acceso de solo lectura a la tabla» no tiene versión intermedia:
o se construye el scope en la API, o se entrega la llave maestra de la plataforma entera.

**Vive en:** lib/rutas-publicas.ts:96, :107, :128 · proxy.ts:191-196 · lib/agente-token.ts:44-49 · supabase/migrations/0118_rls_tablas_abiertas.sql · *2026-09-08*

### La segunda capa del contrato del detalle está escrita y sin enchufar

`loteCumple` (lib/detalle-contrato.ts:170) aparece **una sola vez en todo el repo: su propia
definición.** Cero call-sites, cero tests. `citaVerificada` (lib/chat-agent-voz.ts:166) tiene un
único uso, en otro módulo. `evaluarDetalle` se usa en `plan-board` y `respuesta-doer` — nunca en
`plan-fathom`, que es justamente el que produce el detalle con la cita adentro.

Medido hoy contra prod con la regla de `evaluarDetalle`: en el tablero del cliente (ws 1, n=101
de fathom) el molde de 4 partes se cumple **93%** y la cita entre « » aparece en **38-40%**;
p50 = 1095 caracteres. O sea el contrato FUNCIONÓ — el comentario de `detalle-contrato.ts:6-12`
que dice «0% de 150» describe el estado de **agosto y de otro tablero** (`plan_tareas`, ws 9) y
nadie lo re-midió desde entonces.

**Dos reglas, y la segunda es la cara:**
1. **Un número medido dentro de un comentario tiene fecha de vencimiento y no la lleva escrita.**
   Cuatro agentes construyeron su conclusión sobre ese «0 de 150». Si un comentario trae una
   medición, va con la fecha, el `n` y **la tabla** — sin eso, se cita para siempre como si fuera
   el presente.
2. **La cita llega, pero llega como PROSA.** Por eso no se puede validar, ni filtrar, ni mostrar
   como columna, ni leer por la API. La diferencia entre «lo pide el prompt» y «es un campo» es
   exactamente la diferencia entre las dos capas que [[una regla en un prompt no es una regla]]
   exige — y acá la segunda mitad está escrita y desconectada.

**Vive en:** lib/detalle-contrato.ts:6-12 y :170 · lib/chat-agent-voz.ts:166 · lib/plan-fathom.ts:242 · *2026-09-08*

### Tres listas blancas en serie: editar el prompt no alcanza para agregar un campo

Un campo nuevo que devuelva el modelo muere en el primer filtro y no deja rastro:

1. `coerceCandidatas` copia campo por campo y descarta toda clave fuera de su map (lib/plan-fathom.ts:353-387).
2. `limpiarTarea` es una segunda lista blanca sobre el borrador (lib/plan-propuesta.ts:145-180).
3. Al aplicar, `agregarTareasPlanOwner` recibe `{titulo, prioridad, proyecto, deadline, detalle, fuente}` (:807) y `crearTarea` `{titulo, prioridad, deadline, detalle, categorias, origen, fuente}` (:856).

**Editar el prompt desde `/configuraciones` —el camino barato, el que existe para no tocar
código— atraviesa CERO de las tres.** El precedente está en el propio repo: `dichoPor` se pide en
el prompt desde siempre y el parser lo tiraba; medido en prod, la unión de TODAS las claves
guardadas en las 1055 tareas de `plan_propuestas` del ws 1 es exactamente `{detalle, dueno,
duenoEmail, esDeOtro, incluir, minuto, minutos, prioridad, proyecto, titulo}` — `dichoPor`: 0 de
1055. `deadline`: 0 de 1055.

**La regla: si un prompt es editable por el usuario, el saneo tiene que ser la ÚNICA lista blanca,
o la edición es decorativa.** Y `plan-fathom.extraer.system` declara una sola variable
(`jsonShape`) mientras el call-site pasa dos: quien lo edite puede borrar `{{molde}}` sin que nada
avise (lib/prompt-registry.ts:896 vs lib/plan-fathom.ts:763).

**Vive en:** lib/plan-fathom.ts:353-387, :763 · lib/plan-propuesta.ts:145-180, :807, :856 · lib/prompt-registry.ts:896 · *2026-09-08*

### El patrón «consultor con sesiones recurrentes» es 2 de 5 clientes, no 1

Descontando los workspaces de prueba (3), de diseño (4, copia de los datos de Mauricio), el
pausado (5) y la plataforma (9), quedan **5 clientes reales**. Fathom está conectado en 2 —ws 1 y
ws 11— y **los dos son consultores con sesiones 1 a 1 con terceros**: ws 1 tiene 110 grabaciones
`entrega_servicio`, ws 11 tiene 9 («Ana Gómez sesión 1 a 1 con Leila», repetida 3 veces). El
quinto cliente se llama, literalmente, **P2P Consulting**.

Y el dato que da vuelta la sospecha de que «esto solo le sirve a uno»: en `plan_propuestas`,
**Leila tiene 200 de 298 tareas con `esDeOtro = true` (67%) y 24 de sus 27 borradores pendientes.**
Mauricio: 454 de 1055 (43%). Martín: 255 de 687 (37%). Son **909 tareas de otra persona congeladas
en borradores** repartidas en tres workspaces, y ninguna de las dos tablas de tareas tiene columna
de dueño donde ponerlas.

**La regla, para cualquier «esto es solo de este cliente»: contá los workspaces y mirá los datos
antes de contestar.** Acá la vista «por dueño» parecía el pedido más personal y es el más
genérico; la que de verdad es de él —agrupar por *su* cliente de consultoría— ya existe en el
código y está vacía para todos por una causa medible (exige que la contraparte sea un lead del CRM).

**Vive en:** medido en prod: workspaces, closing_analyses por ws/categoría, plan_propuestas.tareas · *2026-09-08*

### ⚠️ Descartar un borrador es definitivo, salvo que venga de una reunión o de un archivo — y se lleva los compromisos de los demás

`crearPropuesta` revive un borrador `descartada` o `fallado` solo cuando llega la MISMA `ref`
(`fathom:<id>`, `archivo:<sha1>`): volver a extraer esa fuente es el «deshacer»
(lib/plan-propuesta.ts:277-293). Los borradores de WhatsApp, de la API y de los `proponer_*`
nacen sin `ref`, y `descartarPropuesta` (:1087-1093) no tiene contraparte: no hay función ni
pantalla que los devuelva a `pendiente`.

⚠️ **Y en uno de reunión, descartar también borra lo que era de otros.** Los compromisos de otras
personas (`esDeOtro`) viven SOLO adentro del borrador hasta que se reparten: al aplicar, el
borrador sigue `pendiente` con esos adentro justamente para no perderlos (:908-928). Descartarlo
los deja sin ningún lugar donde existir, sin aviso. Con las 909 tareas de otra persona congeladas
en borradores de la entrada de arriba, no es un caso raro.

**Regla:** toda puerta nueva a «descartar borrador» dice en la confirmación las dos cosas —que no
vuelve y que saca a los demás del reparto—. La de la API de MaKo va con `reversible: false`.

**Vive en:** lib/plan-propuesta.ts:277-293 (`crearPropuesta`, el revivir por `ref`), :908-928 y
:1087-1093 (`descartarPropuesta`) · lib/api-mako/areas/plan.def.ts (`descartar_borrador_plan`) ·
*2026-09-16 api-mako-areas*

### ⚠️ El glosario del ws 1 entra en las reuniones de TODOS los clientes, y guardar un término no avisa si falló

**No hay síntoma, y ése es el problema.** Un chequeo de «¿ya existe este término?» sobre
`glosarioTexto()` puede contestar que sí con un término de OTRO workspace.

**Causa, del lado de leer:** `glosarioTexto` (lib/glosario.ts:21-25) lee con
`listActiveKnowledgeByArea`, que usa `getSupabaseServer` y pide `workspace_id in [ws, OWNER_WS]`
(`wsParaRag`, lib/mako-knowledge.ts:50-53 y :205-214). Trata al ws 1 como «método curado de la
agencia», pero el ws 1 es Mauricio, **un cliente**: su jerga entra en los prompts de extracción de
reuniones de cualquier otro (la leen app/api/plan-fathom/route.ts, lib/reunion-auto.ts y
lib/importar-en-segundo-plano.ts). Y si la lectura falla devuelve `[]`, igual que «no hay glosario».

**Del lado de escribir:** `guardarTermino` (lib/glosario.ts:28-33) hace `.catch(() => null)` sobre
`createKnowledge`, que inserta SIEMPRE una fila nueva y paga `embedRow` (lib/mako-knowledge.ts:101-115).
Guardar dos veces el mismo término duplica la fila y paga dos embeddings, y un fallo no deja rastro.

**Regla:** para escribir o verificar el glosario no se usan `glosarioTexto` ni `guardarTermino`.
Se escribe con `createKnowledge`/`updateKnowledge` (tiran y devuelven la fila) y se buscan
duplicados con una consulta por `getTenantDb` — hoy `terminosDelGlosario`
(lib/api-mako/areas/plan.helpers.ts:184).

**Deuda:** esa búsqueda tendría que vivir en lib/glosario.ts, y `guardarTermino` tendría que hacer
upsert por término y no tragarse el error. El `[ws, OWNER_WS]` no es solo del glosario: es de todo
el RAG (lib/mako-knowledge.ts:50-53).

**Vive en:** lib/glosario.ts · lib/mako-knowledge.ts:50-53, :101-115, :205-214 ·
lib/api-mako/areas/plan.helpers.ts (`terminosDelGlosario`) · *2026-09-16 api-mako-areas*

### Lo que quedó SIN hacer

- **Nadie corrió los dos extractores sobre el mismo transcript.** Es el experimento que zanja la
  discusión y no está hecho: 6 transcripts, los dos criterios, el mismo juez, la misma lista dorada.
- **`compromisosAbiertos` sigue en 0** (lib/cs-cartera.ts:247, :265) — falta una consulta.
- **`limite = 8`** sigue escondiendo el 92% de los borradores (lib/plan-propuesta.ts:442).
- **`loteCumple` sigue sin call-sites** (lib/detalle-contrato.ts:170).
- **`deadline` no lo escribe nadie**: 6 de 101 tareas de Fathom del ws 1 lo tienen, y
  `priorizarNuevasCliente` escribe score, razón, prioridad, detalle, checklist e historial —
  nunca deadline (lib/todo-guardian.ts:72-78). Sin eso, «los vencidos arriba» no tiene sobre qué
  ordenar, y `grep deadline` sobre los 18 crons devuelve cero.
- **37 grabaciones del ws 1 en `closing_analyses` con estado ERROR y `sin_clasificar`** — una
  superficie de falla silenciosa sobre las mismas grabaciones de las que se discute el criterio.
  Y «avisar cuando una junta no quedó grabada» está en el roadmap (app/admin/dev/customer-success/
  roadmap-cs.ts:155-161) con dos fallas ya documentadas: el 16/7 y el 31/7.
- **`cs_respuestas` tiene 0 filas en toda la base**: la máquina de estados que parecía el hogar
  natural de «lo pedí y no me contestaron» nunca se usó.
- **El glosario del ws 1 tiene 22 términos, todos del 1 al 5 de agosto.** Es el único lugar donde
  podría vivir el «contexto acumulado de la relación», y está apagado desde entonces.

## De la reunión a la tarea (Fathom)

### ⚠️ El prompt no toleraba las tareas inventadas: las PEDÍA

Medido contra la transcripción real (2h35, **28 compromisos** leídos a mano): MaKo devolvió 37 tarjetas = 17 aciertos + 8 repeticiones + **12 invenciones**, diez concentradas en la primera hora — el tramo donde repasan un CRM en vivo y casi todo lo que «hay que arreglar» se arregla mientras hablan.

**El pedido estaba escrito, en dos lugares:** *«si de una reunión larga te salen menos de 15, es que te quedaste corto»* y *«si te sale la lista vacía, releé: seguro te comiste alguno»*. Con la transcripción troceada en **siete** partes, eso son siete órdenes de llegar a un número — y el modelo las cumple.

Sacar la presión no alcanza: hay que **autorizar el cero**, porque un tramo de demo o de diagnóstico legítimamente no deja ningún próximo paso. Y la lista de «qué NO es una tarea» tenía tres viñetas y **ninguna** cubría lo que inventó: lo ya hecho en la reunión, la demo dictada paso a paso, el estado de algo en marcha, la meta sin paso ejecutable.

⚠️ **Y el molde del detalle estaba escrito DOS veces en el mismo archivo, contradiciéndose:** el JSON shape inyectaba `MOLDE_DETALLE` («Qué hay que hacer») y el bloque del detalle escribía a mano otro («Qué pidió»). Resultado: ws1 salió 100% «Qué pidió» y ws9 30 de 37 «Qué hay que hacer». El formato del detalle era una moneda al aire. Es «Una cosa, un lugar» roto **adentro de un solo archivo** — el lugar donde menos se busca.

**La atribución tenía tres agujeros**, los tres del mismo caso («si no **te** responde, cancelá la llamada con Yolanda», que MaKo le puso al dueño porque él la pronunció):

- **El rol nunca se declaraba.** Todo el bloque asume que el dueño es el ASESORADO —«las recomendaciones son tareas del asesorado» es su regla más fuerte— y en una reunión donde él es el consultor eso empuja para el lado equivocado durante 2h35. Ahora se declara, y **por default va «no lo sé»**: inventar una etiqueta es peor que no darla. Solo se afirma con la única señal dura que hay — que la reunión resuelva a un cliente del workspace.
- **Faltaba el pedido + promesa**, que es el patrón dominante de una reunión producto↔cliente: cuando uno pide y el otro promete, la tarea es **del que prometió**, aunque la cosa sea del que pidió.
- **Faltaba la prueba del pronombre**, que es la más barata y la más confiable: los pronombres están adentro de la frase y los dijo la persona real; la etiqueta del hablante la puso un robot. Ante contradicción, gana el pronombre.

⚠️ **Y `dichoPor` era una regla sin consecuencia.** El prompt lo pedía desde siempre —existe justamente para obligar a separar «quién habló» de «quién ejecuta»— y `coerceCandidatas` lo descartaba: no estaba en el tipo ni en el map. Un campo que nadie lee no obliga a nada. Ahora viaja, y sirve para medir: si `dichoPor === dueño` en toda la reunión, el modelo atribuyó por la etiqueta.

**La fusión tenía PROHIBIDO tocar justo el caso que importaba:** un `continue` mudo cuando dos tramos sacaban la misma acción con dueños distintos. O sea el sistema *garantizaba* que sobrevivieran las dos — la cancelación de Yolanda salió dos veces, una a nombre de cada uno, y el Perro terminó pidiéndole al dueño un deadline sobre la que no era suya. La regla nació para lo contrario y metía dos preguntas en una condición: «¿son la misma acción?» y «¿coinciden en el dueño?». Ahora se fusionan y la contradicción se declara. ⚠️ Ojo con el desempate: la base de la fusión es **la versión que escribió más caracteres de detalle** — no es un criterio, es un accidente, y por eso la fusionada sale marcada en pantalla.

**Y el dedup decidía a ciegas:** se le pedía agrupar repetidas mostrándole 140 caracteres y **ningún dueño**. Con 10 pares reales, cazó 2.

**Vive en:** lib/plan-fathom.ts (prompt, `coerceCandidatas`, `fusionarDuplicadas`, el dedup) · lib/reunion-auto.ts (el rol) · tests/plan-fathom-prompt.test.ts · *2026-08-12*

### ⚠️ Una lectura a medias se cacheaba, se cerraba y se anunciaba como entera

Tres candados incondicionales, con un `console.warn` al lado de cada uno. Con 2 de 7 tramos caídos: el resultado mutilado quedaba en el caché **para siempre** (y el modal lo sirve por la rama `cached:true`), la reunión se marcaba como vista y no se reintentaba nunca, y el WhatsApp decía «saqué N tareas tuyas» con el mismo tono que si la hubiera leído entera.

`partesFallidas` **ya viajaba** hasta el texto del aviso dentro de `ReunionHecha` y no se usaba. Y el comentario de `app/api/plan-fathom/route.ts` decía textual *«mismo criterio que el cron»* mientras la ruta sí exigía `!partesFallidas` y el cron no: un comentario que afirma una simetría que no existe es peor que ninguno.

No pasó en la reunión del 12/8 (`partesFallidas = 0`, verificado). Es la bomba de al lado, y la concurrencia de 7 llamadas simultáneas la estaba cebando.

**Vive en:** lib/reunion-auto.ts (el caché, `KEY_VISTA`, `textoAviso`) · *2026-08-12*

### ⚠️⚠️ La extracción no corrió en Gemini, y por eso «funcionaba tan mal»

**12/8/2026.** El dueño: *«en el otro chat de Customer Success me dice que extrajo 25 tareas de la misma transcripción, mientras que dentro de MaKo solo tengo 3… NO entiendo por qué está funcionando tan mal»*.

**La misma llamada la leyeron DOS workspaces con 65 segundos de diferencia, y salió distinta.** El registro de gasto lo dice sin ambigüedad:

| | modelo | precisión | recall | inventadas |
|---|---|---|---|---|
| ws1 (7 partes) | `gemini-flash-latest` | **74%** | 64% | **2** |
| ws9 (7 partes) | `mistral-small-latest` | **46%** | 61% | **12** |

Mismo prompt, mismo transcript, misma versión del código. **La diferencia es el modelo**, y nadie la eligió: el 429 de la cuota compartida de Gemini mandó al segundo cascada abajo. La tab `/modelos-ia` decía «Gemini» y decía la verdad sobre la *configuración* — lo que corrió fue otra cosa.

Y no fue solo la extracción. En esa misma ventana, `mako-guardian` del ws9 corrió sus 6 llamadas en `mistral-small` también: **es el mismo hecho que explica los 16 de 16 cruces falsos** del hallazgo de abajo. Un solo 429 degradó la lectura de la reunión Y el cruce que decide qué se esconde.

**El disparador es una línea:** `Promise.all(partes.map(...))` mandaba las 7 partes de ~19k tokens simultáneas contra UNA key. Un 429 así es inevitable — y un 429 en la cascada barata **no se reintenta**: se degrada de proveedor. Trocear un input y mandarlo todo junto es elegir el modelo peor sin saberlo. Ahora van de a dos: la reunión tarda ~70 s en vez de ~20 s, en un cron de madrugada.

**Y el criterio que queda, que no es «esta feature es importante»:** lo que decide si se puede degradar es **qué forma tiene el error**. Si el modelo peor *rompe* (JSON inválido, tool que no se llama), degradar es gratis — se ve y se reintenta. Si *contesta mal* (un juicio, una extracción), la respuesta floja se ve igual que la buena, nadie la revisa, y el daño aparece semanas después como «esto funciona mal y no sé por qué». Para esas va `fallback: []`.

⚠️ **La cuenta que hay que tener a mano cuando alguien dice «MaKo sacó menos tareas de las que hay»:** de 28 compromisos reales, MaKo encontró 17 (61%). De los 13-14 que eran del dueño, **se perdieron 6 — la mitad — y no hay ninguna pantalla que lo diga.** Los números que él veía (3, 25, 37) medían tres cosas distintas: 3 era lo tildado después del cruce, 25 los compromisos de los DOS, 37 las tarjetas con sus 8 repeticiones y 12 invenciones adentro.

**Vive en:** lib/model-catalogo.ts (`fallback`) · lib/model-registry.ts (`fallbackDeFeature`) · lib/anthropic.ts (la cascada) · lib/plan-fathom.ts (la concurrencia) · *2026-08-12*

### ⚠️⚠️ La confianza del modelo no es la confianza: «alta» escondía 8 de cada 11 tareas

**12/8/2026.** El botón del modal decía **«Agregar 3 al plan»** sobre una reunión de la que salían once cosas del dueño. Las otras 8 llegaron destildadas porque el cruce anti-duplicados dijo «ya está en tu plan» con confianza «alta», y **las ocho eran falsas.**

No falsas por poco. Midiendo el Jaccard de palabras clave contra la tarjeta con la que las cruzó:

| candidata | «ya está en tu plan como…» | j |
|---|---|---|
| Conectar el Second Brain con el Cloud Code | Tab SuperAdmin: modelo de IA por tarea | **0.00** |
| Agregar infinitos guiones en el Ads Writer | Escritor de VSL + escritor de DMs | **0.00** |
| Desactivar el bot de ManyChat de Instagram | Cerrar el canal no oficial | **0.00** |
| Editar/crear avatares en Ads Writer | Escritor de VSL + escritor de DMs | **0.00** |
| Actualizar el plan del curso de CS | Configurar Fathom e IA | 0.09 |

**Cinco de ocho no comparten una sola palabra.** Y dos tarjetas absorbieron dos candidatas cada una. En la reunión anterior fue peor: 16 de 16, con **una tarjeta llevándose cuatro** candidatas distintas.

**Un falso «alta» no molesta: esconde un pedido real de una reunión, en silencio.** La asimetría es total —un «media» de más cuesta un click— y por eso `confianza` dejó de ser lo que dice el modelo. Tres degradaciones en `lib/cruce-confianza.ts`, y ninguna es un umbral fino a propósito:

1. **Dos candidatas no pueden ser la misma tarjeta.** Lógica, no heurística: a lo sumo una tiene razón y no sabemos cuál, así que bajan todas.
2. **Cero palabras en común no es «la misma dicha de otro modo».** No es un umbral calibrado: es el piso de lo que significa hablar de lo mismo. ⚠️ Y el corte es «al menos UNA palabra» y no un porcentaje justamente para no matar el caso que justifica el cruce con IA — «mensaje de WhatsApp después de agendar» contra «follow-up post-llamada» comparten ~15% y ahí el léxico solo no alcanza.
3. **Si ≥70% de un lote de 4+ es «alta», el modelo no discriminó.** Solo sobre los cruces contra el TABLERO: cuando la misma llamada se graba dos veces, que todo matchee contra el borrador hermano es lo correcto.

**Nunca se descarta un cruce**, solo se le quita el poder de destildar: la tarea sigue con el cartel verde y su razón, y entra tildada. El cruce avisa; no decide.

⚠️ **Y una lección de reparación que costó una vuelta:** poner `cruzado_at = null` para «recalcular» **no es recalcular**. Visto desde el dueño es: volver a entrar a la reunión, verlo comparar de nuevo, pagar la llamada otra vez y que le pisen las decisiones que ya había tomado. Sus palabras: *«avanzamos 1 paso y retrocedemos 3»*. Un script de reparación arregla el dato que está mal y no invalida trabajo humano que estaba bien — por eso `scripts/reparar-cruce-flojo.ts` degrada en su lugar, sin llamar a nadie.

**Vive en:** lib/cruce-confianza.ts · lib/mako-guardian.ts (`cruzarCandidatas`) · scripts/reparar-cruce-flojo.ts · *2026-08-12*

### ⚠️⚠️ «Ni siquiera existe la tab de Mau»: clasificar y poder mandar son dos preguntas

**12/8/2026.** El dueño: *«como la funcionalidad de extraer las tareas falló completamente… me está poniendo tareas a mí que deberían ser de Mau, ni siquiera existe la tab de Mau»*.

**LA EXTRACCIÓN NO FALLÓ, y ese es el hallazgo.** El diagnóstico obvio —«el modelo atribuyó mal»— era el equivocado, y el mío también: yo dije que el modelo había mandado `esMio: true` en las 37. Lo desmintió el propio sistema. Cada corrida guarda su resultado crudo en `app_settings` bajo `mako.fathom.cache.<recordingId>`, **escrito 13 segundos antes del borrador**, y ahí las 26 tareas de Mauricio están con `esDeOtro: true` y con su email real. El modelo acertó y `resolverDueño` acertó.

Lo que las borró fue un gate río abajo, en `reunion-auto.ts`:

```ts
duenoEmail: repartible(t.dueñoEmail) ? t.dueñoEmail : undefined,
esDeOtro:   t.esDeOtro && repartible(t.dueñoEmail) ? true : undefined,   // ⛔
```

**`esDeOtro` no es el reparto: es la clasificación.** Y el comentario que estaba justo arriba de esas dos líneas decía exactamente lo correcto —«el nombre se conserva SIEMPRE (es información de la reunión); lo que se corta es el reparto»— mientras la segunda línea cortaba las dos cosas. Es la misma enfermedad que el orden del modal de reunión: el comentario correcto al lado del código incorrecto.

**La ironía completa: Mauricio SÍ es usuario de la app.** El gate preguntaba «¿este email está en MI workspace?» (él vive en el 1, el borrador se armó en el 9). La pregunta para clasificar es *de quién es esto*; la pregunta para repartir es *sé a dónde escribirle*. Son tres, no una: `esDeOtro`, `duenoEmail`, `repartible`.

Sin `esDeOtro`, `ReunionTareas.tsx:232` mete las 37 en «Mías» y `:273` nunca crea un grupo: **la tab de Mau no está rota, no se crea.** Y el daño sigue río abajo — el cruce anti-duplicados corrió después sobre las 37 creyéndolas propias y destildó 16.

**No era un caso aislado: 6 borradores en 4 workspaces**, incluido el de una clienta donde 5 de 5 tareas eran de *su* clienta.

Tres cosas que dejó esto escritas:

- **`esDeOtro` lo escribe SOLO `resolverDueño`.** Ningún consumidor río abajo lo vuelve a escribir. Un control que necesita decir «no le puedo mandar esto» usa un campo APARTE.
- **`lib/reunion-auto.ts` no tiene un solo test**, y esta lógica vivía inline adentro de una función de 200 líneas marcada `server-only`. Por eso no la cazó nadie. Es la lección de julio —extraer `tarea-dueno.ts` para poder probarlo— sin aplicar al eslabón siguiente. Ahora vive en `lib/reunion-reparto.ts`, puro y con tests.
- **El aviso confirmaba el bug en vez de delatarlo:** decía «sacó 37 compromisos tuyos» porque `mias` se contaba DESPUÉS del borrado. El resumen ahora sale del mismo cálculo que la clasificación.

**Y una bomba que estaba al lado, desarmada de paso:** `resolverDueño` hacía `o.esMio === true ? false` sin ningún «salvo», cortando antes de mirar la evidencia — aunque su propio comentario prometiera lo contrario. No causó esto, pero el día que el modelo mandara el flag entraban 26 tareas ajenas en silencio. Ahora el email de un invitado real le gana, y cuando las dos señales se contradicen queda `atribucionDudosa` en la fila en vez de resolverse callado.

⚠️ **Para reparar datos viejos hay que normalizar la marca en los DOS lados.** El script de reparación matchea por título contra el cache, y el título del borrador ya pasó por `corregirMarca` («Maco» → «MaKo») mientras el del cache no: tres tareas no matcheaban y una era de Mauricio. Y si el cache fue pisado por un «volver a analizar», los títulos son otros: ahí **no se empareja por parecido**, se saltea — ponerle a una tarea el dueño de otra es peor que el bug original.

**Vive en:** lib/reunion-reparto.ts · lib/reunion-auto.ts · lib/tarea-dueno.ts · scripts/reparar-reparto-reunion.ts · *2026-08-12*

### Un comentario que dice el orden no ordena nada

El modal «MaKo leyó tu reunión» tiene cuatro bloques y su orden es la funcionalidad, no maquetado: arriba lo que HAY QUE DECIDIR, abajo lo que ya está resuelto. Estaba acordado con el dueño y **estaba escrito en los comentarios de los bloques** —«sección propia, abajo de las nuevas», «VA ABAJO: arriba tiene que estar lo que falta hacer»— y el JSX pintaba `yaEnPlan` ANTES que `mias`. Resultado: el dueño abría el modal de una reunión de 37 compromisos y lo primero que leía era «Ya están en tu plan (16)», dieciséis tarjetas que no requieren ninguna decisión suya, con las nuevas enterradas debajo.

El comentario correcto al lado del código incorrecto es peor que ningún comentario: se lee como verdad y hace que nadie mire el orden real. Ahora la nota vive **arriba del fragmento entero**, enumerando los cuatro bloques en orden, que es donde se puede contrastar de un vistazo con lo que sigue.

Orden bueno: `faltantes` (el borrador las dio por cargadas y no están) → `mias` (las nuevas) → `yaEnPlan` (ya tienen tarjeta, solo se les suma contexto) → `enElBoard` (ya las cargaste en esta sesión).

**Vive en:** app/plan/board/ReunionTareas.tsx (el fragmento de `tab === 'mias'`) · *2026-08-12*

### ⚠️ Después de cambiar el prompt de extracción NO se re-extrae nada: medir el fix sin forzar es medir la salida vieja

Síntoma: se arregló el prompt de extracción de reuniones y «no movió la aguja», así que se salió a buscar la causa a otro lado (se acusó al preámbulo de marca por pedir brevedad). El verificador refutó esa hipótesis mostrando que la evidencia no significaba nada: hay TRES candados encadenados que sirven la salida pre-fix — el cache `mako.fathom.cache.<recordingId>` salvo `reanalizar:true`, `crearPropuesta` que es idempotente por `ref='fathom:<id>'` y devuelve la fila vieja sin reescribirla, y el cron que saltea la reunión si ya hay propuesta o quedó vista. El 100% de las reuniones ya leídas devuelve texto viejo. Regla: para medir un cambio de prompt de reuniones hay que apretar «Volver a analizar (gasta tokens)» Y borrar el borrador con esa `ref`; y antes de tocar código hay que descartar las dos configuraciones que le ganan al default: el override de `mako.prompt-overrides` (lib/prompt-render.ts) y el de modelo en `mako.modelos` (un pin a Groq/Gemini degrada la extracción muchísimo más que cualquier prompt).

**Vive en:** app/api/plan-fathom/route.ts:215 · lib/plan-propuesta.ts (candado por ref) · lib/reunion-auto.ts · lib/prompt-render.ts · lib/model-registry.ts · *2026-08-05 diagnostico-ronda-reuniones*

### ⚠️ El call-id de Fathom NO es el recording_id: el 404 no significa que la grabación no exista

`fuente.url` de las tareas guarda el id de la URL que uno copia del navegador (fathom.video/calls/<id>, rango 764M-771M), y la API keyea por recording_id (rango 158M-170M). Pedir `/recordings/<call-id>/transcript` devuelve 404 en las dos cuentas, así que parece que la grabación se borró o que la key no alcanza. Para recuperar el transcript hay que listar meetings y matchear por `m.url`. Las 6 reuniones del tablero del dueño resolvieron así: 710.000 chars de transcript vivos que el 404 daba por perdidos.

El puente entre los dos espacios de id ya existe y no hace falta inventar tabla ni «memoria de workspace»: `closing_analyses` guarda `call_url` y `recording_id` en la MISMA fila, más `invitee_email` y `lead_id`. La cadena es `tarea.fuente.url → callId → closing_analyses.call_url → recording_id → cache`. Filtrar SIEMPRE por workspace_id: el callId de «Mau <> Martin» solo existe en ws9, consultarlo sin scope es un leak cross-tenant.

**Vive en:** plan_tareas.fuente.url (lo escribe lib/plan-fathom.ts) contra lib/fathom-api.ts · closing_analyses (call_url + recording_id) · lib/plan-fathom.ts (cacheKeyReunion) · *2026-08-06 contexto-de-todas-las-tareas + 2026-08-01 tareas-por-cliente*

### ⚠️ «Cargar en su plan» devuelve 403 justo para el participante resuelto por nombre

El candado anti-spam de `app/api/plan-reunion/route.ts:115` valida al destinatario con `participantes.find(p => p.email === email)` contra la lista blanca cacheada al extraer. Cuando el email se resolvió POR NOMBRE, el participante cacheado tiene `email: ''` y ese find falla → 403 «Esa persona no estuvo en la reunión». El botón «Enviar» se salva porque el front manda `manual: !dest?.email` (ReunionTareas.tsx:628); «Cargar en su plan» (ReunionTareas.tsx:646) NO manda ese flag. Se agregó un escape `esVos` para el caso propio, pero la asimetría entre los dos botones sigue viva: para cualquier tercero resuelto por nombre, «Cargar» revienta y «Enviar» funciona.

**Vive en:** app/plan/board/ReunionTareas.tsx:646 (falta `manual: !dest?.email`) vs app/api/plan-reunion/route.ts:115-118 · *2026-08-05 · ~borrador-reunion-fathom-frentes*

### La misma reunión se analiza dos veces (y cada lectura se come cosas distintas)

Cuando dos workspaces tienen cada uno su propia key de Fathom, el mismo call queda grabado dos veces con recordingIds distintos y el pipeline lo procesa dos veces, sin saberlo. Caso medido: rec 169308217 (ws9) sacó 28 tareas y rec 169308247 (ws11) sacó 34 de la MISMA reunión de 109 minutos; la unión son ~40 compromisos, o sea que cada corrida por separado quedó 15-30% corta y se pagó el análisis dos veces. Peor: cada lectura se comió compromisos distintos — la de ws9 perdió casi todos los de Leila y la de ws11 casi todos los de Martín. Antes de repartir tareas de una reunión con cliente, cruzar contra lo que ya se creó del otro lado; a futuro, unificar por (título + fecha ±1 min) aunque el recordingId difiera.

**Vive en:** lib/reunion-auto.ts · lib/plan-fathom.ts · app_settings 'mako.fathom.cache.<recordingId>' · *2026-08-01 · ~poda-board-leila-ws11*

### Resolver una persona por nombre NO se filtra por workspace: filtrarlo devuelve cero

El diagnóstico obvio fue «hay dos Mauricio Bustos Eguia en la base, desambiguá filtrando por workspace_id». Está mal y empeora lo que ya funciona: la reunión vive en el ws 9 y las dos cuentas homónimas están en ws1 y ws3 — filtrando por el ws de la reunión quedan CERO candidatos. `buscarUsuarioPorNombre` (lib/usuarios.ts:79-107) es cross-workspace A PROPÓSITO y desambigua por ESTADO: busca primero entre las cuentas `activo` y solo si ahí no hay ninguna mira el resto; con 0 o con >1 candidato devuelve null. La regla: el nombre que aparece en una reunión pertenece a una PERSONA, no al inquilino de la reunión.

**Vive en:** lib/usuarios.ts:79 (buscarUsuarioPorNombre), consumido por lib/reunion-destinatarios.ts · *2026-08-05 · ~borrador-reunion-fathom-frentes*

### `esDeOtro` se calcula contra el HOST de la grabación, no contra quien va a responder

El «yo» de la extracción sale de `r.host?.email` y, si no hay host, del primer admin del workspace. Pero el borrador se crea a nivel WORKSPACE, sin columna de usuario, y BoardShell se lo ofrece a cualquiera que entre a /plan. Si el que abre el modal no es el host, TODAS las preguntas de contexto son sobre tareas ajenas por construcción, sin que haya pasado nada raro en el medio. Peor: el cache por reunión es compartido per-workspace, así que la extracción manual devuelve las tareas con los flags calculados contra el HOST — y a la inversa, una extracción manual fresca pisa el cache con flags calculados para el usuario logueado.

**Vive en:** lib/reunion-auto.ts:105-114 y :172 · lib/plan-fathom.ts:437 (preguntasDeContexto) · app/api/plan-fathom/route.ts:100-115 · *2026-07-30 fathom-preview-cards*

### Arreglar la detección de cliente APAGA el cron de reuniones

`reunion-auto` procesa solo las reuniones con `tipo === 'equipo'`. Hoy las reuniones del dueño con SUS clientes caen en 'equipo' por accidente: `clasificarReunion` busca el lead solo entre los `is_external` calendar invitees, y `listarUsuarios()` usa `getSupabaseServer()` sin scope de workspace, así que el host-usuario gana. El día que el matcheo de leads funcione, esas reuniones pasan a 'entrega' y el cron las descarta: el usuario deja de recibir los borradores de su trabajo real y parece que «el cron dejó de andar». Cualquier mejora del clasificador tiene que aceptar 'entrega' con cliente detectado EN EL MISMO cambio.

**Vive en:** lib/reunion-auto.ts:138 · lib/reunion-clasificar.ts:65 · lib/usuarios.ts:33 · lib/reunion-gate.ts:26-32 · *2026-08-01 tareas-por-cliente*

### El email del cliente no está en 65 de 66 tareas, y «mirar todos los emails» no aporta ninguno

El plan obvio era cruzar los participantes de la reunión contra `leads` por email. Medido: de 66 tareas con fuente Fathom, solo 1 cuelga de una grabación donde aparece el email de alguno de los 9 clientes. `participantesDeReunion` YA incluye calendar_invitees + recorded_by + action_items[].assignee — el mismo universo que `emailsDeLaReunion` — y en las reuniones que el dueño graba desde su lado devuelve únicamente su propio email; `closing_analyses` las guarda con `invitee_email` NULL y `category='interna'`. El fallback por nombre es peor: «Adriana» matchea 3 leads no relacionados. La única señal que funciona en las 3 reuniones de cliente es el TÍTULO de la grabación.

**Vive en:** lib/plan-fathom.ts:72-97 · lib/reunion-clasificar.ts:47-74 · app_settings 'mako.fathom.cache.<recordingId>' · *2026-08-01 tareas-por-cliente*

### La API de Fathom ignora dos de sus propios filtros, no expone sus webhooks y devuelve un número como string

`?recording_id=X` en `/meetings` se IGNORA y devuelve las más recientes: para una grabación puntual hay que usar `GET /recordings/{id}/transcript` y `/summary` (no existe `/meetings/{id}`). `recorded_after` también se ignora; el filtro real lo aplica la lib a mano. No hay API para leer ni actualizar los webhooks de Fathom (404 en las 4 variantes): se re-registran a mano en la consola en cada mudanza de dominio, y hay 3 cuentas. Y `closing_analyses.score` es NUMERIC, que PostgREST serializa como STRING ("7.5"): hay que coercionar con `Number()` antes de cualquier promedio, o el KPI sale roto sin error.

⚠️ **Y como el filtro de `recordedAfter` se aplica sobre la página YA traída** (lib/plan-fathom.ts:197), una página puede volver con **cero reuniones y `nextCursor` presente**. «0 reuniones» con cursor no significa que no haya más: hay que seguir pidiendo. Un listado que corta en la primera página vacía se pierde las reuniones de la ventana (16/09/2026).

**Vive en:** lib/fathom-api.ts (fathomGet) · lib/plan-fathom.ts:131, :161 y :166-201 (`listReunionesRecientes`) · lib/closing.ts · *2026-07-30 fathom-preview-cards · 2026-09-16 api-mako-areas*

### El tope de 25 de listMeetingsPage es un índice mudo: si la reunión no está entre las últimas 25, se cae media extracción

`extraerTareasDeReunion` busca la reunión dentro de `listMeetingsPage({ limit: 25 })` sin cursor para sacar `meta`. Si extraés a mano una reunión que quedó fuera de esa página (llegaste por «Cargar más» o por el filtro de fecha), `meta` es undefined y en cascada se pierden tres cosas sin un solo aviso: los action items de Fathom con su dueño ya atribuido, la lista de participantes (el user prompt pasa a decir literalmente «no tengo la lista de invitados» mientras el system exige nombrar a quién lo pidió) y hasta el rescate por Google Calendar, que necesita `meetingStartIso(meta)` para buscar el evento. El mismo patrón está en /api/plan-reunion, que resuelve destinatarios contra las últimas 40 y responde un 409 que la UI tira. Arreglo barato: paginar por cursor 2-3 páginas o subir el limit (es metadata, sin transcript).

**Vive en:** lib/plan-fathom.ts:753 y :772-795 · app/api/plan-reunion/route.ts (respaldo de 40) · *2026-08-05 diagnostico-ronda-reuniones*

### Cargar tareas a mano desde una reunión no deja rastro, y el cron vuelve a proponer lo mismo con otras palabras

`crearDesdeReunion` escribe al tablero pero solo guarda `fuente: {tipo:'fathom', etiqueta:<título>}`, sin el recordingId, y la ruta manual no escribe el candado que el cron lee (KEY_VISTA). Caso real: las tareas 171/172 del ws1 se cargaron a mano a las 03:04 y 12 horas después el cron dejó el borrador de la MISMA grabación con los mismos dos compromisos reformulados — Jaccard 0.07 y 0.08, o sea que el guard léxico ni los ve. Encima `titulosDelTablero` mira solo las tareas abiertas a propósito, así que una tarea ya completada es estructuralmente invisible al guard. OJO con el arreglo obvio: escribir KEY_VISTA (o una propuesta 'aplicada' con ese ref) al cargar a mano suprime el borrador ENTERO — en ese caso concreto, para matar 2 duplicados se perdían las 16 tareas de otra persona, que solo viajan por ahí. El rastro tiene que ser por TAREA, y el cruce contra lo ya cargado de esa grabación tiene que ser semántico, no léxico.

**Vive en:** app/plan/board/BoardShell.tsx (crearDesdeReunion) · lib/reunion-auto.ts (existePropuestaRef + KEY_VISTA) · lib/plan-propuesta.ts (titulosDelTablero) · *2026-08-01 dedup-y-envio-a-mi-plan*

### Dos caminos de creación de tareas de reunión con semánticas incompatibles

`ReunionExtractModal.confirmar → onCrear → crearDesdeReunion` crea de a una y NO toca `plan_propuestas`. `TareasRecibidasModal.aplicar → aplicar-lote → aplicarPropuestas` marca el borrador y guarda `aplicadas`. Si una pantalla muestra el contenido de un borrador y usa el primer camino, el borrador queda pendiente con las mismas tareas adentro y la próxima entrada al plan las vuelve a ofrecer: se crean dos veces. Segundo efecto silencioso: `crearDesdeReunion` declara su parámetro sin `minuto`/`minutos`, que `aplicarPropuestas` sí usa para armar el `?timestamp=` — mezclar los caminos deja tarjetas de la misma reunión, unas con link al minuto y otras sin. Aparte: hay borradores que JAMÁS aparecen en la lista de Fathom (los que crea `cargarTareasEnPlanDe` en el workspace de otra persona, que no tiene esa grabación en SU Fathom); si el botón de Fathom deja de ser la puerta de vuelta, esos quedan inalcanzables.

**Vive en:** app/plan/board/ReunionExtractModal.tsx:152-159 · app/plan/board/BoardShell.tsx:425 y :517 · lib/plan-propuesta.ts:274-330 · lib/reunion-destinatarios.ts:189 · *2026-07-30 fathom-preview-cards*

### Al cliente le viajan las tareas de la agencia aunque no entren a su tablero

Un borrador de reunión compartida trae las tareas del otro con esDeOtro:true. El server las filtra bien al aplicar, pero el payload que se sirve al wizard del cliente incluye sus títulos y detalles: en el caso real, una clienta veía en su pantalla el precio de suscripción $49/$99, el costo de tokens por usuario, el CAC objetivo y el plan de beta de 30 personas. Encima el contador no filtra esDeOtro (`nT = prop.tareas.length`), así que el botón decía «Crear 34» y el éxito «Creé 34 tareas» cuando el server creaba 13. Falta decidir si el payload se filtra en la lectura para workspaces que no son dueños de esas tareas.

**Vive en:** app/plan/revisar/[id]/RevisarPropuesta.tsx · lib/plan-propuesta.ts (filtro !esDeOtro al aplicar) · *2026-08-01 · ~poda-board-leila-ws11*

### Una reunión no es fuente de verdad para cerrar un desarrollo o un bug

Lo que se dijo en una reunión puede ser impreciso; para dar por terminado un desarrollo manda el repo, los commits y el código. La reunión sirve para EXTRAER compromisos, no para cerrarlos.

> «No puedes tomar como fuente de verdad para cerrar un desarrollo o un bug algo que salió de una reunión, porque la información de las reuniones puede no ser precisa» (2026-08-06)

**Vive en:** lib/cerrar-por-commits.ts · lib/plan-senales.ts · ver [Señales y auto-cierre](#señales-y-auto-cierre)

### ⚠️ Un campo nuevo de la extracción muere en TRES `map` escritos a mano, y ninguno da error

Síntoma a evitar: se agrega un campo al prompt de extracción y al tipo, el modelo lo
contesta bien, el typecheck pasa, los tests pasan — y en el tablero no aparece nunca.

Entre «el modelo contestó» y «la tarea nació» hay **cuatro saltos**, y tres de ellos son un
objeto literal escrito a mano donde un campo que no se copia desaparece sin ruido (el
literal no tiene que ser exhaustivo, así que el compilador calla):

| # | Dónde | Qué hace |
|---|---|---|
| 1 | `coerceCandidatas` (lib/plan-fathom.ts) | JSON del modelo → `TareaCandidata` |
| 2a | `asegurarBorrador` (app/api/plan-fathom/route.ts) | reunión leída **a mano** desde el modal → borrador |
| 2b | el map de `propuestas` (lib/reunion-auto.ts) | **el cron**: por acá entra la mayoría de las tareas de reunión |
| 2c | el map de `tareas` (lib/importar-en-segundo-plano.ts) | un acta subida como **archivo** |
| 3 | `limpiarTarea` (lib/plan-propuesta.ts) | choke point: lo usan `crearPropuesta`, `rowToPropuesta`, `guardarRevision` y `marcarProcesado` |
| 4 | `aplicarPropuestas` (lib/plan-propuesta.ts) | `agregarTareasPlanOwner` (dueño) **y** `crearTarea` (cliente) — son DOS altas |

**No es hipotético: el `minuto` ya murió en 2b** («toda tarea que venía del cron nacía sin
el deep-link, 25 de la reunión de Leila sin reloj»), y el 26/09/2026 `recurrente` iba a
morir en los tres. La única capa que NO hay que repetir es la 3: ahí pasan todos los
productores y también la relectura de la fila, así que **el saneo y toda regla determinista
sobre el campo van ahí**, nunca en cada productor.

Y las DOS altas del paso 4 son la trampa final: tocar sólo `agregarTareasPlanOwner` deja la
feature viva para el super-admin y muerta para todos los clientes, que es exactamente el
modo de falla de «lo que ves andar en el board del dueño puede estar muerto en el del
cliente».

**Vive en:** lib/plan-fathom.ts · app/api/plan-fathom/route.ts · lib/reunion-auto.ts · lib/importar-en-segundo-plano.ts · lib/plan-propuesta.ts · tests/plan-recurrente-nace.test.ts · *2026-09-26 · recurrentes: nacer desde la extracción*

### ⚠️ El JUEZ del criterio de Mauricio tiene CERO call sites

`juzgarConCriterio` (lib/plan-criterio-juez.ts) está escrito entero, con su prompt editable,
su saneo determinista en `lib/plan-criterio-reglas.ts`, sus 16 tests y su entrada propia en
`lib/model-catalogo.ts`. **No lo llama nadie**: un grep de `juzgarConCriterio` sobre todo el
repo devuelve su propia definición y un comentario. O sea que el criterio de compromisos que
Mauricio escribió el 8-9/9 —las cubetas, la verificación de la cita, los faltantes— no corre
sobre ninguna reunión.

Lo que sí está enchufado es el interruptor: `criterioDelWorkspace()` lo lee
`lib/plan-propuesta.ts`, pero sólo para decidir el **tablero único** (que las tareas de
otras personas entren igual al tablero del cliente). El juez que tenía que filtrarlas no
corre, así que hoy el tablero único es la mitad de la feature: entra el ruido y no entra el
filtro que lo saca.

⚠️ **Medirlo cuesta un grep y no lo delata ninguna pantalla**: el pipeline funciona
perfecto sin el juez, simplemente hace menos. Es el caso más puro de «escribir la salida no
es ofrecerla», y sobrevivió a todo un módulo con tests en verde.

**Vive en:** lib/plan-criterio-juez.ts (sin call sites) · lib/plan-criterio.ts · lib/plan-propuesta.ts:`tableroUnico` · *2026-09-26 · recurrentes: nacer desde la extracción*

### La cuarta pregunta del criterio: el desempate es «gana la fecha», y no es una cubeta

Dos decisiones que se tomaron al llevar «¿se repite para siempre?» (criterio de Mauricio,
16/07/2026) al prompt de extracción, y las dos son el tipo de cosa que se re-discute sola
dentro de tres meses si no queda escrita:

1. **`recurrente: true` + `deadline` se contradicen, y gana la FECHA.** Lo resuelve
   `decidirRecurrente` (lib/plan-criterio-reglas.ts), aplicado en `limpiarTarea`. El
   criterio es el de AGENTS.md —entre dos señales que se contradicen gana la más cara de
   producir—: un booleano es un token que el modelo tira sin pensar, una fecha concreta sólo
   se escribe habiendo oído a alguien decirla. Y la asimetría del error lo confirma: dejar
   una recurrente compitiendo se ve y se arregla con el interruptor del detalle; sacar del
   ranking una tarea con fecha real es mudo, y encima `taskToRow` le borra el deadline.
2. **No es una cubeta ni una regla nueva del juez.** Una reunión de los miércoles es un
   compromiso de verdad: lo que cambia no es a qué cubeta va, sino que no compite. Meterla
   como cubeta la sacaría del tablero, que es lo contrario de lo decidido. Y el enum
   `ReglaCriterio` es **de Mauricio**: el `'4'` ya es su regla 4 (sugirió y el otro aceptó
   más adelante), así que no hay id libre y pisarlo sería reescribir su criterio.

⚠️ **El caso que más se confunde, y que hay que dejar escrito en cualquier prompt que
pregunte esto:** «Diseñar la estructura de la junta semanal» e «Implementar la cadencia de
juntas» son tareas **CON FIN** que montan un ritual — terminan el día que el ritual existe.
Lo recurrente es **ASISTIR** a la junta cada semana. Si la charla dejó las dos, son dos
tareas.

⚠️ **Y el agujero que no cierra ningún cambio de plantilla: un workspace con OVERRIDE
guardado no ve la pregunta nueva.** `renderPrompt` devuelve el override entero
(`getPromptText` = `override ?? default`), así que editar
`PLAN_FATHOM_SYSTEM_TEMPLATE` en el código no llega a quien tocó `plan-fathom.extraer.system`
en /configuraciones. Peor: el `{{jsonShape}}` **sí** se inyecta desde el código, así que ese
workspace recibe un JSON que declara `"recurrente"` y le dice «lee abajo el bloque ¿SE REPITE
PARA SIEMPRE?»… sobre un prompt donde ese bloque no existe.

**Vive en:** lib/plan-criterio-reglas.ts (`decidirRecurrente`) · lib/plan-fathom.ts (`PLAN_FATHOM_SYSTEM_TEMPLATE`) · lib/plan-propuesta.ts (`limpiarTarea`) · lib/prompt-render.ts · *2026-09-26 · recurrentes: nacer desde la extracción*

### Las decisiones tomadas sobre el pipeline de reuniones

- **Las reuniones se cargan solas, siempre**, sin botón para prenderlo (2026-07-29).
- **Paso de validación de entidades desconocidas antes de extraer:** «¿Qué es Artemisa?» alimenta una base de conocimiento persistente, más corrección de errores obvios de transcripción («Investigar con CLAU» = Claude). Si no, cada carga vuelve a preguntar lo mismo y la tarea sale con basura adentro (2026-07-18).
- **Las tareas de OTRA persona no entran a tu tablero:** se muestran aparte, se pueden reasignar a una persona (o crear una nueva) y se exportan en md para pasárselas. El plan además acepta que le subas archivos. «en la tarea de Mauricio, que no entra su Fathom a las reuniones, es una tarea de él, no se debería cargar en mi tablero de SuperAdmin» (2026-07-18).

### Lo que quedó sin hacer en reuniones

- **`recurrente` NO entra por WhatsApp ni por la API del agente.** La cadena quedó cerrada para la reunión de Fathom, el cron y el archivo subido; los otros dos productores de borradores siguen sin preguntarlo ni mandarlo: `lib/mako-doer-acciones.ts:844` (el map a `crearPropuesta` del doer, y su prompt) y `app/api/agente/plan/route.ts:105` (Claude Code). También `tareasDesdeRespuestas` (`TareaExtra`, lib/plan-propuesta.ts): una tarea que nace de una respuesta del wizard no puede nacer recurrente. En los tres el campo se cae en el `map`, sin error (2026-09-26).
- **Nadie llama a `juzgarConCriterio`** — ver la entrada de arriba. El juez del criterio de compromisos está completo y es código muerto (2026-09-26).
- **Las tareas extraídas de una reunión de Fathom tienen que quedar guardadas ahí para siempre:** hoy si salís de la pantalla hay que volver a correr la extracción, y al volver atrás no se guardan las tareas creadas si no se cargan al plan (2026-08-05).
- **El contexto extraído sigue pobre y no cita a los invitados**; y no deja cargar al plan de Mauricio una reunión con él (2026-08-05).
- **Timestamp de la reunión dentro del detalle de cada tarea** venida de Fathom, para poder ir a escuchar lo que se dijo. Lo pidió al menos dos veces (2026-07-30).
- **Sub-tab por colaborador** en el modal de tareas de una reunión, con botones de Enviar por WhatsApp/Email y «Cargar en el Plan de NOMBRE» (solo si el email coincide con un usuario registrado) (2026-07-29).
- **El botón para traer tareas de Fathom no aparecía en la vista de clientes**, con sospecha de que faltaban más cosas en esa vista (2026-07-13).

---

## Ruteo a proyectos

### ⚠️⚠️ El «no» del Perro entraba por la puerta de atrás convertido en «sí»

**Cerrado el 12/8/2026.** El hallazgo de abajo («puerta trasera en su propio catch») tenía razón y se quedaba corto: el agujero no necesitaba que el ruteo fallara. Se abría en el camino NORMAL, y cada vez que el Perro decía que no.

Síntoma: el dueño mandó dos links por WhatsApp para investigar competencia. Mensajes gemelos, mismo borrador, mismo lote. Uno cayó en «Feature: Competitor Spy», que es donde iban; el otro abrió «Feature: Funnel de Venta» con una sola tarea adentro.

**El diagnóstico obvio —«el modelo clasificó mal»— es el equivocado, y la prueba es que los dos venían del mismo lote y del mismo modelo.** La cadena real, cinco eslabones:

1. MaKo, en la tool de WhatsApp, propone `proyecto: "Feature: Funnel de Venta"`. Es una PROPUESTA, y está bien que la haga.
2. El Perro rutea el lote: propone ese proyecto en `nuevos` y pone **ese mismo nombre** en `asign` — el contrato viejo (`RUTEAR_JSON_SHAPE`) lo autorizaba con todas las letras.
3. Las cuatro barreras rechazan la propuesta. Casi siempre por la misma: `n.cuantas < Math.min(3, tareas.length)`, o sea «una sola tarea no justifica un proyecto».
4. **Y ahí se cae el `asign` también**, porque el nombre que nombraba ya no está en `canon` y el filtro de destinos válidos lo descarta. La tarea queda sin NINGÚN destino, en silencio.
5. `plan-board` hace `ruteo[i] || it.proyecto?.trim()` y crea… exactamente el proyecto que se acababa de rechazar.

**Cómo reconocerlo en los datos, sin logs:** los proyectos nacidos así tienen el renglón `Creó el proyecto — <origen>` en su `historial`. Esa es la tercera rama de `porQueNacio`, la que corre cuando no hay ni catálogo ni aval del Perro — la firma del agujero. Los cinco del 11 y 12 de agosto la tienen igual: «Feature: Landing» (0 tareas), «Feature: Content Machine» (2), «Feature: Historia del Usuario» (1), «Feature: Focus Tracker» (1), «Feature: Funnel de Venta» (1).

**La lección que se paga cara: había un `console.warn` justo en esa rama, y los cinco nacieron igual.** Un aviso que solo va a los logs de Vercel no es un control — nadie los lee, y a los 60 minutos no existen. Si el que tiene que enterarse es el dueño, el aviso va donde él mira: el historial de la tarjeta.

Se cerró en tres lugares, porque el agujero tenía tres bordes:

- **La compuerta** (`plan-board.ts`): un proyecto se crea desde DOS fuentes y ninguna más — el catálogo, o el Perro habiéndolo avalado. El nombre crudo del modelo puede RESOLVER a un proyecto existente, nunca crear uno. Si no hay ninguna de las dos, la tarea entra sin proyecto y el motivo queda en su historial. Un huérfano visible se arregla en diez segundos; un proyecto de más ensucia el tablero para siempre.
- **La repesca** (`mako-guardian.ts`): rechazar deja una deuda. Las tareas que quedan sin destino van a una segunda pasada, solo ellas, con `nuevos` prohibido — la única respuesta válida es un nombre de la lista. ⚠️ Los índices de esa pasada son LOCALES al sub-lote: remapearlos mal manda la tarea equivocada al proyecto equivocado sin romper nada. Por eso la aritmética vive en `lib/ruteo-repesca.ts`, aparte y sin `server-only`, con test.
- **El contrato** (`RUTEAR_JSON_SHAPE`): `asign` va SIEMPRE con un nombre de la lista, aunque se proponga uno nuevo para esa misma tarea. `nuevos` pisa a `asign` si se aprueba; `asign` es lo que queda si no.

**Vive en:** lib/plan-board.ts (la compuerta, en el `if (!cat && !delPerro)`) · lib/mako-guardian.ts (`asignarTareasAProyectos` + `unaPasadaDeRuteo`) · lib/ruteo-repesca.ts · lib/plan-proyectos-catalogo.ts (`puedeSerProyectoNuevo`) · *2026-08-12*

### ⚠️⚠️ Contar tareas nunca midió si hacía falta un proyecto

**12/8/2026, dictado por el dueño:** *«El filtro NO debe ser porque solo haya 1 tarea… Puede ser que 1 sola tarea justifique un proyecto… El filtro debe ser tener criterio, mejorarlo, y en este caso es evidente que la tarea de analizar a la competencia NO requiere una nueva feature.»*

El umbral `n.cuantas < Math.min(3, tareas.length)` está borrado. Los números de su propio tablero lo refutan solos:

- de 73 proyectos, **9 tienen CERO tareas y 14 tienen una sola**, y casi todos son legítimos («Feature: Carousels» es una tab real del sidebar);
- «Feature: Content Machine», que no debía nacer, traía **dos**;
- «Mejoras del Ads Manager» —el ejemplo del «NO» que el propio prompt tiene escrito— traería **tres**, y hoy pasa las cuatro barreras sin que nada lo mire.

**El que tenía más tareas era el que estaba peor.** Y había un daño extra que no se veía: contar hacía que el veredicto dependiera de **con quién viajó la tarjeta en el mensaje de WhatsApp**. La misma propuesta, sola o en un lote de diez, daba distinto.

**La pregunta que lo reemplaza, y explica el caso del dueño sin argumentos adicionales:**

> Un proyecto nace cuando lo que llegó **construye un lugar que la app todavía no tiene**. No nace cuando **usa**, **amplía** o **renombra** un lugar que ya existe — y da igual si trae una tarea o quince.

Analizar a la competencia es un **uso**: produce un documento, y el lugar donde eso se hace ya existe y se llama «Feature: Competitor Spy». Construir la tab de facturación produce una pantalla que no está en el sidebar: el lugar no existe, y por eso se abre aunque venga con una sola tarjeta.

Las cinco formas verificables de «el lugar ya existe» viven en `lib/plan-proyecto-necesidad.ts`. Lo que hay que saber antes de tocarlas:

- **El umbral de C2 (`esTemaQueAtraviesa`) está MEDIDO, no intuido, y el número razonable era el equivocado.** Con 2 destinos, corrido contra el catálogo real, rechaza cuatro tabs que existen: `Feature: CRM` (por «Agente: CRM automático»), `WhatsApp` (por «WhatsApp de MaKo»), `Email` (por «Sales Email») e `Instagram` (por «Vender MaKo: Orgánico Instagram»). Un proyecto padre conviviendo con uno derivado es el patrón de nombres de la casa. Con 3 el catálogo queda limpio y «landing» sigue cayendo. **El margen se achica solo a medida que crece el catálogo**, y el test «el catálogo real no se auto-rechaza» es el que avisa cuando se acabó.
- **C4 (`mirarNoFunda`) corre SOLO sobre nombres con prefijo `Feature:`/`Agente:`.** Esa línea es lo que salva a «Legal y fiscal»: un área del negocio se releva, se evalúa y se audita, y sigue faltando. No es una casualidad del vocabulario, es una condición explícita — y su ausencia ya costó los Términos de Servicio en «Landing y VSL» y la LLC en «Cobros y planes».
- **C4 pide UNANIMIDAD, no mayoría.** Un lote mixto sí funda: «Feature: YouTube Analyst» —uno de los dos únicos que el Perro abrió con aval en todo el tablero— trae 3 tareas de investigar y 2 de construir.
- **`tokensDeNombre` compone DOS normalizadores y los dos hacen falta.** `nucleo()` saca el prefijo pero deja la puntuación; `normTitulo()` saca la puntuación pero no sabe de prefijos. Con uno solo, «Feature: Ads-Manager» tokeniza distinto que «Feature: Ads Manager» y esquiva el control.
- **`presuponeElLugar` excluye «de» y «del» a propósito.** «Construir la tab **de** Facturación» es la forma normal de pedir algo que NO existe; meterlas mata el único ejemplo del «SÍ» que tiene el prompt.

**Y NO se agregó ningún campo nuevo al contrato del modelo, que es el resultado más fuerte de las refutaciones.** Se evaluaron cinco (`despues`, `hoyCaeriaEn`, `entregable`, `sobreQueExiste`, `descartados[3]`) y todos fallan por la misma razón de fondo: **validan la FORMA del argumento y nunca su VERDAD.** El peor es el de los tres destinos refutados: le sube la credibilidad a la mentira que sobreviva — hoy un proyecto malo nace con un `porQue` flojo de una línea, y con tres refutaciones nominales nacería con pinta de fundamentado, dándole al dueño más texto que leer y menos motivos para dudar.

**Lo que queda sin cubrir, y es lo más probable que falle próximo:** el **duplicado por SINÓNIMO**. Los cinco chequeos miran caracteres, ninguno mira significado. «Feature: Notificaciones Push» con tres tareas de construir pasa los cinco y duplica el transversal «Avisos y reportes», cuya descripción dice «notificaciones». ⚠️ Y lo que **ya se probó y NO sirve** para taparlo: la cobertura léxica con un piso numérico. Medida contra el catálogo real, `feature`, `mako` y `agente` son tokens de decenas de destinos, un destino con descripción vacía gana el ranking por tener el denominador más corto, y una tarea de atribución puntúa 0,27 contra «Vender MaKo: Landing y VSL» porque su descripción dice «atribución» — o sea reproduce el reparto por palabra suelta con un número que lo bendice.

**Otras tres puertas conocidas:** sacar el prefijo apaga C4 (un «Funnel de Venta» sin `Feature:` escapa); «Feature: Deepseek» no cae por nada, aunque «Migrar a Deepseek» sí; y **la permanencia no tiene segunda capa** — «esto va a seguir recibiendo trabajo» no se puede validar contra ninguna base, así que vive solo en el prompt, que además es editable con override.

**Vive en:** lib/plan-proyecto-necesidad.ts · lib/mako-guardian.ts (el filtro de `nuevos` y `RUTEAR_SYSTEM_TEMPLATE`) · tests/plan-proyecto-necesidad.test.ts · *2026-08-12*

### Una FAMILIA del sidebar nunca puede ser un proyecto

Salió del mismo barrido. «Feature: Content Machine» nació el 11/8 y es un proyecto que se solapa con Ideas, Reels, Carousels, Stories, Thumbnails y YouTube Writer **a la vez**: es la caja que los agrupa, no un lugar donde alguien vaya a buscar una tarea. Lo mismo valdría para «Operate», «Analyze» y «Sales Machine».

La regla ya estaba escrita en `REGLA_NOMBRE_PROYECTO` («el nombre de una tab») y no alcanzó, porque una familia del sidebar **también** se lee como el nombre de una tab. Ahora es ejecutable: `puedeSerProyectoNuevo()` en el catálogo, con la lista de familias copiada de `nav.ts` (`lib/` no importa de `app/`) y un test que verifica que las dos listas sigan siendo la misma.

Dos detalles del control que importan:

- **Se mide sobre el NÚCLEO, no sobre el nombre crudo.** Si se midiera sobre el crudo, «Feature: Investigar competencia» pasaría el filtro del verbo —arranca con «Feature»— y el prefijo se volvería la forma de esquivar el control.
- **Dice si el nombre TIENE FORMA de proyecto, no si HACE FALTA uno.** Son dos preguntas distintas: «Funnel de Venta» tiene forma perfecta y aun así no debía nacer. Las dos tienen que dar que sí.

**Vive en:** lib/plan-proyectos-catalogo.ts (`puedeSerProyectoNuevo`, `FAMILIAS_SIDEBAR`) · tests/plan-proyectos-catalogo.test.ts · *2026-08-12*

### ⚠️ El catálogo cerrado de proyectos tiene una puerta trasera en su propio catch

*(Cerrado el 12/8/2026 — ver el hallazgo de arriba, que resultó ser más ancho que esto.)* La regla escrita dice que el ruteo ya no puede inventar proyectos porque asignarTareasAProyectos elige contra una lista cerrada. Pero el `.catch()` de esa llamada devuelve `{ asign: [] }` y la línea siguiente hace `ruteo[i] || it.proyecto?.trim()` — o sea, si el ruteo falla se vuelve al nombre que inventó el modelo y nace un proyecto nuevo igual (verificado en lib/plan-board.ts:287 y :306). Es la misma forma del incidente medido: la ráfaga del 05/08 dejó 19 proyectos, entre ellos tres de Instagram y dos de «Ads Content Machine». Matiza la regla ya escrita: el catálogo cierra el camino feliz, no el degradado.

**Vive en:** lib/plan-board.ts:287 y :306 (asignarTareasAProyectos + fallback) · *2026-08-05 · ~fathom-preguntas-lote-whatsapp-forense*

### ⚠️ El proyecto huérfano no era criterio de la IA: era un `uid()` que se volvía NaN

Síntoma: 7 tareas de ws1 sin proyecto y 4 proyectos autocreados con 0 tareas; todo apuntaba a que el modelo clasificaba mal. Causa real: BoardShell crea el proyecto nuevo con `const nuevoId = uid()` ('x…') y le asigna ESE string a la tarea; `useBoard.createLabel` recibe el id canónico del server pero devuelve void (types.ts:99 lo tipa `Promise<Label>`, la implementación no lo cumple), y TodoBoard hace `categorias: d.labels.map(Number).filter(Number.isFinite)` → NaN → se descarta → `categorias: []`. Verificado en prod: las huérfanas son EXACTAMENTE las tareas cuyo proyecto era nuevo, ni una más; un proyecto autocreado con 0 tareas es la huella dactilar del bug, porque si el modelo no lo hubiera nombrado el proyecto no existiría. Regla: cuando el id lo genera el cliente y lo canoniza el server, el creador tiene que devolver el canónico y el caller usar ESE, no el temporal.

**Vive en:** app/plan/board/BoardShell.tsx:513-530 · app/plan/board/useBoard.ts:222-227 · app/plan/TodoBoard.tsx:37 · *2026-08-01 tareas-por-cliente*

### ⚠️ `nuevos` del ruteador no manda ni una tarea: el proyecto nuevo solo nace si el modelo repite el nombre en `asign`

Síntoma: «el Perro nunca abre un proyecto nuevo aunque le dictes una feature entera». El diagnóstico obvio (el prompt de las 4 condiciones es demasiado restrictivo) era solo la mitad. `asignarTareasAProyectos` devuelve `{ asign, nuevos }`, pero el `.map` de mako-guardian.ts:526 TIRA el array `tareas` (los índices) que el modelo puso en cada `nuevo`, y el tipo `RuteoNuevo` (l.468) ni siquiera lo declara. Río abajo, plan-board.ts arma el ruteo solo con `asign` (l.283) y el mapa `propuestosPorElPerro` (l.287) se consulta después únicamente para DECORAR el proyecto con emoji/porqué (l.308): si el modelo propone un proyecto y no repite ese nombre en `asign`, no se crea nunca y el hecho no se loguea. En el camino del CLIENTE (todo-rutear.ts:90-101) `r.nuevos` se descarta entero, así que un proyecto que igual llega por `asign` nace sin `que`, sin `porQue` y sin renglón de historial. Y el filtro `if (n.cuantas < 3) return false` (l.521) es matemáticamente imposible en los lotes de WhatsApp de 1 o 2 tareas — medido en prod — y descarta el 100% en silencio.

**Vive en:** lib/mako-guardian.ts (RuteoNuevo 468, filtro 521, .map 526) + lib/plan-board.ts:279-308 + lib/todo-rutear.ts:90-101 · *2026-08-05 whatsapp-contexto-perdido*

### El nombre del proyecto se trunca a 40 en la clave de búsqueda pero no en el índice

`aplicarPropuestas` arma el índice con los nombres COMPLETOS (`cats.map(c => [c.nombre.trim().toLowerCase(), c.id])`) y después busca con `t.proyecto.slice(0,40)`: todo proyecto de más de 40 caracteres nunca matchea y se crea un duplicado truncado. Ya pasó en prod: tres categorías de ws1 quedaron guardadas con exactamente 40 caracteres ("Validar el funnel completo (VSL → agenda", "Construir el banco de creativos y conten") mientras el seed las define completas y otros workspaces las tienen enteras — la diferencia es el camino de escritura, porque el seeder inserta directo y `crearCategoria`/`editarCategoria` cortan. Peor: como `editarCategoria` trunca en CADA guardado, un proyecto hoy bien nombrado se corta solo la primera vez que alguien lo toca. Regla: normalizar con un helper único usado en los dos lados de la comparación, y no truncar donde la columna es TEXT sin tope.

**Vive en:** lib/plan-propuesta.ts:393-402, lib/todo.ts:315 y :323, lib/mako-doer-acciones.ts:121-131 · *2026-08-01 auditoria-plan-y-whatsapp*

### Cuanto más honesto es el modelo, más tareas se apilan en el primer proyecto

El prompt de extracción le pide al modelo dejar `proyectoId` en null si duda. Ese null viaja como `undefined` a `board.create`, y en el board del CLIENTE (`labelMode:'single'`) el default lo convierte en `labels[0]` — que por el orden `created_at` es SIEMPRE el primer seed, "Setup inicial de MaKo". En prod: las 19 tareas que ws11 sacó de una reunión quedaron todas ahí (el proyecto pasó de 6 a 25) mientras "Encontrar el primer anuncio ganador" y "Montar el seguimiento por WhatsApp" recibieron 0, y el historial nunca dice "no eligió proyecto, la puse en el primero". Encima los dos caminos de confirmación de la misma reunión terminan distinto: por el modal de extracción caen en labels[0], por el modal de borrador quedan sin proyecto. Regla: distinguir "no me pasaron proyecto" de "esta alta no eligió proyecto" (array vacío explícito), y que el fallback viva solo en el alta manual, donde además se pregunta el porqué.

**Vive en:** app/plan/board/useBoard.ts:59, app/plan/board/BoardShell.tsx:464, app/plan/TodoBoard.tsx:45, lib/plan-fathom.ts:190,245 · *2026-08-01 auditoria-plan-y-whatsapp*

### Los proyectos se reusan por NOMBRE entre reuniones, y el historial del proyecto apunta al cliente equivocado

BoardShell reusa un proyecto existente comparando `norm(l.name) === norm(nom)`. La extracción de «Junta Patricia Muñoz baja teriyaki» (00:25) creó «Sistemas y Formulario Operativo», «Capacitación Operativa» y «Programa de Mantenimiento Preventivo» y los dejó vacíos; 13 minutos después la extracción de «Junta con Sergio y Adriana» (Grupo Esquer) los vio en la lista con id numérico y les metió 14 tareas de OTRO cliente. El `historial` de esos proyectos dice «Creó el proyecto — de la reunión «Junta Patricia Muñoz baja teriyaki»» aunque el 100% de su contenido sea de Esquer: quien reparta guiándose por la procedencia del PROYECTO manda 14 compromisos al cliente equivocado. Para atribuir hay que mirar la `fuente.etiqueta` de cada TAREA.

**Vive en:** app/plan/board/BoardShell.tsx:513-522 · tarea_categorias.historial · *2026-08-01 tareas-por-cliente*

### Ninguna tarea existe sin proyecto, y la de un cliente va SIEMPRE al proyecto de ese cliente

Dos reglas que se dictaron el mismo día, tras ver el tablero de Mau lleno de tareas sueltas:

> «hay muchas tareas creadas en el kanban de Mau que NO tienen proyectos, eso no debería ser posible de ninguna manera» (2026-08-02)
> «que SIEMPRE lo ponga dentro del proyecto de ese cliente, que no invente nuevos proyectos» (2026-08-02)

Si la tarea es de un cliente, va al proyecto de ESE cliente (se crea si no existe, con el prefijo `Cliente: `); nunca se inventa un proyecto nuevo. Si no hay certeza, se pregunta con el form de a una pregunta. Y **antes de crear un proyecto o una tarea se busca si ya existe uno equivalente y se amplía ese** — «Volvió a crear nuevos proyectos cuando ya existían otros... Esto sí o sí tiene que funcionar bien» (2026-07-26).

**Vive en:** lib/plan-proyectos-catalogo.ts (dueño) · lib/todo-proyectos-catalogo.ts (clientes) · lib/mako-guardian.ts (prompt de ruteo)

### Cómo se llama y qué es un proyecto

- **Un proyecto tiene inicio y fin.** «Adquisición & Ads» no es un proyecto; «Encontrar el primer anuncio ganador» o «Escalar X campaña» sí. Un proyecto eterno no puede tener deadline ni prioridad real, y rompe la lógica del Perro (2026-07-13).
- **El nombre se entiende solo, y es algo grande y obvio:** el nombre de una tab, `Feature: NOMBRE`, o «Vender MaKo: Ads» / «Vender MaKo: Prospección». «Lo que me gustaría es que SE ENTIENDA fácil los proyectos» (2026-08-05) · «así se entiende bien» (2026-08-06). Los prefijos son fuente única en `PREFIJO_FEATURE` / `REGLA_NOMBRE_PROYECTO` / `PREFIJO_CLIENTE`.
- Al nombrarlos hay que **revisar que cada tarea esté en el proyecto correcto** (2026-08-06).

**Vive en:** lib/plan-proyectos-catalogo.ts · lib/todo-proyectos-catalogo.ts

### `categorias: []` es un contrato deliberado — no poner un gate que lo prohíba

La reacción obvia al ver 7 tareas sin proyecto es prohibir categorías vacías en el alta. Es una regresión: useBoard.ts:60-65 documenta que `[]` significa «esta tarea NO va a ningún proyecto» y que con `undefined` TODO terminaba dentro de «Setup inicial de MaKo», incluidas tareas de otras personas — que es justo la queja que se estaba investigando. Además el gate no frenaría nada: esas tareas no pasan por `crearTarea` ni por `agregarTareasPlanOwner`, entran por /api/todo desde TodoBoard. Si hace falta un destino, va una categoría «Sin clasificar» explícita, nunca un fallback que hereda el primer proyecto del tablero. Nota del mismo barrido: `tarea_categorias` no tiene parent_id ni estado archivado, y el único borrado de la UI (`deleteLabelYTareas`) borra el proyecto Y TODAS SUS TAREAS — «degradar a sub-etiqueta» o «archivar» no existen.

**Vive en:** app/plan/board/useBoard.ts:60-65 y :268-274 · lib/todo.ts (crearTarea) · lib/plan-board.ts (agregarTareasPlanOwner) · *2026-08-01 tareas-por-cliente*

---

## Dedup: nunca duplicar, siempre ampliar

### El Perro nunca crea un duplicado ni pregunta si borrar: elige entre ignorar y ampliar

La decisión del server es de a tres: crear, ampliar o ignorar. Nunca «¿querés borrar esta?», nunca dos tarjetas de lo mismo. Cuando la tarea ya existe, lo que se hace es **alimentarla**: más checklist, más contexto, más detalle.

> «Jamás me debe preguntar si borrar una tarea... Lo que JAMÁS debe hacer es crear una duplicada, eso jamás debe permitirlo el perro, por ningún motivo» (2026-08-05)
> «cuando detecta una tarea que YA existe, NO me debería dejar cargarla, sí debería permitirme alimentar el contexto» (2026-08-05)

Corolario del mismo hilo: si la misma tarea se mencionó varias veces (en distintos chats o reuniones), es UNA sola tarea con varios timestamps, no varias (2026-07-26).

**Vive en:** lib/tareas-dedup.ts · lib/mako-guardian.ts (cruzarCandidatas) · lib/plan-propuesta.ts (canal `ampliar`)

### ⚠️ El cruce anti-duplicados falla ABIERTO y mudo: «no pude leer» y «no hay duplicados» son la misma respuesta

`cruzarCandidatas` hace `try { parseJsonObject(raw) } catch { return { cruces: [] } }`. Una respuesta cortada por maxTokens devuelve exactamente lo mismo que «ningún duplicado», y `CruceOut` no tiene campo `error` donde decirlo. Ya pasó una vez con maxTokens 1500 —por eso hoy está en 4000 y el comentario del código lo cuenta—, y con 40 candidatas contra un plan grande 4000 vuelve a quedar al límite. El gemelo `puntuarPlan` resolvió lo mismo agregando `error?: string` recién después de 13 corridas pagadas sin una sola prioridad aplicada. La regla: un chequeo que puede quedarse ciego tiene que poder DECIR que se quedó ciego. Fail-open está bien; fail-open mudo, no.

**Vive en:** lib/mako-guardian.ts, cruzarCandidatas (el catch de parseJsonObject) · *2026-08-01 dedup-y-envio-a-mi-plan*

### El dedup descarta los tokens de 2 letras, que son justo los que distinguen una tarea de otra

`palabrasClave` filtra `w.length > 2`, así que R1, R2, IA, WA, A/B, CPA, ROI o Q4 se caen antes de comparar. Caso real y único en toda la base: «Medir el show-rate de la R1» vs «Medir el impacto en el show-rate» quedan como {medir,show,rate} ⊂ {medir,impacto,show,rate} y disparan las DOS ramas del criterio (Jaccard 0.75 y contención con ≥3 palabras). Son tareas distintas: una instrumenta la métrica base, la otra mide el efecto de las secuencias — distinto detalle, distinto checklist, distinto proyecto. Fue el ÚNICO par que el criterio marcó en los cuatro tableros de producción, y era un falso positivo. En este dominio el token corto es señal, no ruido: antes de tocar el umbral, mirá la tokenización.

**Vive en:** lib/tareas-dedup.ts:31 (palabrasClave) · *2026-08-01 dedup-y-envio-a-mi-plan*

---

## Señales y auto-cierre

### ⚠️ Los dos motores de auto-cierre trabajan sobre tablas distintas y no se cruzan nunca

Síntoma: aparecieron 62 tareas que ya estaban hechas y ninguna se había cerrado sola, aunque hay dos mecanismos de cierre automático corriendo. El diagnóstico obvio —«faltan señales»— era el equivocado. Causa real: `autocompletarPorSenales` escribe con `editarTarea` de lib/todo, que toca EXCLUSIVAMENTE `experimento_tareas` (el board del CLIENTE), y el cron `tareas-verificar` llama `listTareas()`, que es la misma tabla; el bot de commits lee SOLO `plan_tareas` del super-admin. Medido contra prod el 6/8: ws9 tiene 408 abiertas en plan_tareas y CERO en experimento_tareas — el cron entra al workspace del dueño, encuentra la lista vacía, cierra 0 y se va. La regla que queda: agregar una señal en lib/plan-senales.ts no puede tocar ni una tarea del tablero del dueño; antes de sumar la señal número 14 hay que enchufar plan_tareas al motor (y filtrar por origen, para que una señal de negocio no cierre una tarea de código).

**Vive en:** lib/todo-seeds.ts:117 (autocompletarPorSenales) · app/api/cron/tareas-verificar/route.ts:33 y :62 · lib/cerrar-por-commits.ts:79-86 · app/plan/page.tsx:35,57 · *2026-08-06 senales-de-avance*

### ⚠️ Dos señales cierran tareas con el dato equivocado, y ninguna mira la fecha

`nutricion-activa` es `hayFilas('nutricion_secuencias')` y NO mira la columna `activa`: una secuencia guardada y apagada cierra igual la tarjeta cuya checklist termina en «Activar» (en prod ws1 tenía 25 secuencias y solo 13 activas). `oferta-definida` es `haySetting('mako.entregable')`, que es el LEAD MAGNET, no la oferta — y con eso cierra «Definir la oferta y el precio»; la fuente correcta es la tabla `productos` (mig 0117), que hoy no lee nadie. Encima `hayFilas` devuelve `count > 0` sin mirar CUÁNDO: una señal sin timestamp no distingue «esto ya estaba antes de que la tarea existiera» de «esto pasó porque alguien la hizo», que es exactamente la diferencia entre cerrar bien y cerrar mal. El único lugar del repo que ya lo hace bien es `landingRecibioEventos`, que exige eventos dentro de una ventana de días: ese es el molde. Todo verificado vivo el 7/8/2026.

**Vive en:** lib/plan-senales.ts:53-59 (hayFilas), :104 y :106 · lib/todo-seeds-data.ts (EVIDENCIA_SENAL) · lib/landing-token.ts:116-124 · *2026-08-06 senales-de-avance*

### ⚠️ `leerSenales` destructura 13 lecturas POR POSICIÓN de un `Promise.all`

`leerSenales()` hace un `Promise.all` de 13 lecturas y las recibe en un array destructurado por orden, para después armar el objeto de señales a mano. Insertar una señal en el medio corre todas las demás un lugar y cada señal pasa a leer la tabla de otra — en silencio, y sin que TypeScript diga nada, porque las 13 son `boolean`. Es la misma familia del bug de `funnel_config` que ya está documentado tres líneas más arriba en ese archivo. Verificado vivo el 7/8/2026. La regla: al tocar ese bloque, agregar la señal al FINAL del array y del objeto, o pasar a un registro `{ id, evidencia, leer() }` como ya hacen lib/integraciones-catalogo.ts y lib/tab-activacion.ts.

**Vive en:** lib/plan-senales.ts:87-115 (leerSenales) · *2026-08-06 senales-de-avance*

### No se declara hecho lo que no se ve en la app

Antes de reportar algo como terminado hay que verificarlo en la UI y contra datos reales. Y si el dueño dice que falla, el fallo es nuestro hasta que se pruebe lo contrario.

> «no veo que se haya marcado el progreso en la app. Eso no lo hiciste... revisa porque el fallo está de tu lado» (2026-07-14) · «Nada funciona... Tienes que realmente validar y hacerlo bien» (2026-08-02)

Es la misma regla que gobierna el auto-cierre: una señal que no prueba que la cosa pasó no cierra nada. Y lo que salió de una reunión no alcanza para cerrar un desarrollo — [ver arriba](#una-reunión-no-es-fuente-de-verdad-para-cerrar-un-desarrollo-o-un-bug).

### Lo que quedó sin hacer en auto-cierre

- **El bot que revisa código y commits para detectar solo si una tarea se terminó** (y para clientes, la data de MaKo y el Ads Manager). Preguntó explícitamente si había quedado sin implementar (2026-08-06).
- **Auto-completar tareas ya hechas:** que MaKo marque como hechas las que puede verificar, y para Super Admin que lo haga leyendo los commits/el código. Pidió además explicación de cómo se ejecutaría el debug automático (¿PC prendida con Claude abierto?) (2026-08-05).
- **Automatizar la rendición de cuentas:** que MaKo vea el cambio real (ads subidos, VSL cambiado, copy de la landing) y marque la tarea solo, en vez de preguntar. Él mismo lo pospuso: «vamos por partes» (2026-07-11).

---

## El seed: con qué arranca un board nuevo

### El seed del board se recorta UNA vez y nunca más: no hay re-seed

faseMin/faseMax/canales solo se leen dentro de seedRelevante, al sembrar, y seedTodoBoardSiVacio devuelve [] apenas el board tiene un proyecto o una tarea. Resultado: un board sembrado antes de un cambio del seed arrastra la forma vieja para siempre, y nada lo reconcilia. Caso medido: ws11 se sembró 8 horas antes del commit que introdujo el filtro y quedó con el proyecto «Escalar la campaña ganadora» (faseMin 3) estando en fase 1. Dos lecciones que salieron de los verificadores: faseMin significa «todavía no», no «no le aplica» (el que decide aplicabilidad es `canales`), y borrar a mano es irreversible porque nada lo vuelve a crear — la salida correcta es llevar faseMin/faseMax al RENDER (colapsar/atenuar con «todavía no te toca»), no un DELETE en prod.

**Vive en:** lib/todo-seeds.ts (seedTodoBoardSiVacio) · lib/todo-seeds-data.ts (seedRelevante) · *2026-08-01 · ~poda-board-leila-ws11*

### El seed no es un preset: es personalizado por negocio, y las tareas se auto-completan solas

La idea original era que todo cliente nuevo entrara al plan con muchas tareas ya creadas que se cierran solas con señales reales —si nunca entró al onboarding de Landing Analyst, esa tarea está en 0—, porque «como sabemos todo lo que va a hacer el usuario, que venga predefinido» (2026-07-12).

Eso se corrigió al ver el resultado: **el mismo preset para todos genera basura.**

> «Hay un montón de tareas y proyectos basura, que no sirven... se crearon como preset a todos los clientes, pero eso NO debe ser así» (2026-08-01) · «habíamos dicho que eso es personalizado» (2026-08-05)

El template se arma con el onboarding, el funnel, el diagnóstico y lo que vende el cliente — como un onboarding al entrar al plan, no como una lista fija.

**Vive en:** lib/todo-seeds-data.ts · lib/todo-seeds.ts

---

## Retro y experimentos

### ⚠️ Los gates de la tab no protegen su API: el de borrar vive en el modal, el de la Retro está inline en la ruta, y ninguna ruta mira el rol

El chequeo de «no te dejo eliminar esto» es 100 % client-side: la API solo devuelve el veredicto y nada lo enforcea. Peor, `/api/retro` no llama a `getUsuarioActual()` (a diferencia de `/api/mako-guardian`, que devuelve 401), así que un `POST {action:'generar'}` saltea cualquier gate que viva en el wizard — y esa ruta son hasta 9 llamadas a Opus con effort xhigh y maxTokens 24000 por corrida. Si se implementa el gate de «terminá lo anterior antes de correr una Retro nueva», tiene que vivir en `generarRetroV3`/el route, no en el modal.

**Actualizado el 16/09/2026.** El gate de «terminá lo anterior» ya se implementó y corre en la ruta, antes de arrancar el stream (app/api/retro/route.ts:83-107). Lo que sigue vivo:

- **Está escrito adentro de la ruta, no en una lib.** Ningún otro canal lo puede reusar, y un «deja» del Perro no se guarda: cada `generar` vuelve a debatir con el motivo que traiga ESE request. Por eso la API de MaKo no expone `generar_retro` ni `debatir_gate_retro`: un debate ganado por otro canal no destraba nada. Para exponerlas, primero hay que sacar el gate a lib/retro-gate.ts y persistir el veredicto.
- **Ni `/api/retro` ni `/api/experimentos` miran sesión ni rol.** El único control de rol del área es `requireRolWs([])` en app/experimentos/page.tsx:33, que solo deja pasar a `admin`. Un closer o un setter no ve la tab, pero las rutas le dejan cerrar experimentos o aceptar ítems de la Retro. **La página no protege la API**: si la tab es solo para admin, la ruta que escribe también tiene que exigirlo.

**Vive en:** app/api/retro/route.ts:83-107; app/api/experimentos/route.ts; app/experimentos/page.tsx:33; app/experimentos/EliminarModal.tsx:101-133; lib/retro-gate.ts · *2026-07-17 retro-mapa · 2026-09-16 api-mako-areas*

### `experimento_tareas.retro_id` ya se lee, pero sin FK ni índice y con el error tragado

El join key que haría honesta la rendición de cuentas de la Retro ya se persiste en los dos caminos (tarea plana y chain de experimento), pero un grep repo-wide devuelve solo escrituras, tipos y seeds: cero lecturas. La query que falta es una sola y no necesita migración: `select id,titulo,estado,progreso,hecho_at from experimento_tareas where retro_id = <id>` vía getTenantDb.

**Corrección del 16/09/2026:** la lectura ya existe. `listTareasDeRetro` (lib/todo.ts:135) la hacen `seguimientoUltimaRetro` y la fase Memoria (lib/retro-pipeline.ts:210 y :227), las dos con `.catch(() => [])` (ver «“No pude leer” sale con cara de dato», más abajo). Tres huecos que sí quedan: la columna no tiene FK ni índice (seq-scan), el link retro→experimento vive enterrado en `experimentos.config->>'retro_id'` (jsonb, no indexable), y `borrarTarea` es hard delete, así que una tarea borrada es indistinguible de una nunca creada.

**Vive en:** lib/retro-pipeline.ts:601-607 y :593-598; lib/todo.ts:267; supabase/migrations/0051 · *2026-07-17 retro-mapa · 2026-09-16 api-mako-areas*

### ⚠️ Aceptar dos ítems de la misma Retro a la vez pierde uno, y re-aceptarlo DUPLICA el experimento

**Síntoma:** dos ítems aceptados casi juntos; uno queda «Sin tocar», y al aceptarlo de nuevo nacen otra vez el experimento y sus tareas.

**Causa:** `aplicarPlan` lee `retros.reporte`, lo muta en memoria y hace `update({ reporte })` del jsonb ENTERO, sin control de versión (lib/retro-pipeline.ts:621-693). La segunda escritura pisa a la primera, y con ella se va `expCreado`, la marca que evita duplicar al re-aceptar (:646). La pantalla lo esquiva sin saberlo: `busyPlanId` apaga los botones mientras hay un ítem en vuelo (app/experimentos/RetroReport.tsx:359). Dos pestañas, o cualquier canal que no sea esa pantalla, no tienen ese candado.

**Regla:** un jsonb con ítems que se editan por separado no se escribe con leer-mutar-escribir sin comparar versión.

⚠️ **Deuda, y la cura obvia no entra:** el compare-and-set «sobre `updated_at`» que se anotó al implementar la API **no se puede escribir tal cual: `retros` no tiene `updated_at`** (mig 0051 crea la tabla con `created_at` y nada más; la 0059 solo agrega `reporte`). Hace falta una columna de versión o comparar el jsonb previo en el `update` de lib/retro-pipeline.ts:691. Mientras tanto, la API de MaKo solo lo DETECTA: relee antes y después y contesta `ok: false` (lib/api-mako/areas/experimentos.run.ts).

**Vive en:** lib/retro-pipeline.ts:621-693 (`aplicarPlan`) · app/experimentos/RetroReport.tsx (`busyPlanId`) · supabase/migrations/0051_experimentos_retro_todo.sql · *2026-09-16 api-mako-areas*

### ⚠️ La deuda de la Retro se borra por tres puertas, y un experimento descartado la traba para siempre

El gate («terminá lo anterior») cuenta como deuda solo lo ACEPTADO: `deudaDeLaRetro` saca «Pospuesta», «Descartada» y «Sin tocar» (lib/retro-seguimiento.ts:71-76). Con eso cuenta mal en las dos direcciones:

- **Tres formas de que algo aceptado deje de ser deuda sin hacerse.** Deshacer borra el `status` (lib/retro-pipeline.ts:631-634). Posponer o descartar un ítem YA aceptado reemplaza el `status` entero y pierde el `experimento_id` (:635-638). Y borrar la última Retro hace que el gate mire la anterior. En las tres, el experimento sigue corriendo.
- **Y al revés, sin salida.** `seguimientoDeItem` solo da por hecho un experimento `cerrado` (lib/retro-seguimiento.ts:41-50). Uno `descartado` cae al final como «En curso» (:62) y cuenta como pendiente para siempre. Re-aceptar no lo arregla: `aplicarPlan` reusa `expCreado` sin mirar en qué estado quedó el experimento (lib/retro-pipeline.ts:646-648), y `expCreado` sobrevive a deshacer.

La única salida del segundo caso es una de las puertas del primero.

**Deuda:** que `seguimientoDeItem` resuelva un experimento `descartado` en vez de dejarlo «En curso», y que posponer o descartar un ítem aceptado conserve `experimento_id` en vez de pisar el `status`.

**Vive en:** lib/retro-seguimiento.ts:30-76 · lib/retro-pipeline.ts:621-693 · lib/retro-gate.ts:63-80 · *2026-09-16 api-mako-areas*

### ⚠️ En la Retro y los experimentos, «no pude leer» sale con cara de dato: el gate se abre y el experimento cierra «no concluyente»

- **El gate falla abierto, y el rastro que tenía que dejar no se escribe nunca.** `seguimientoUltimaRetro` atrapa cualquier error y devuelve `items: []` (lib/retro-pipeline.ts:199-214), y con `[]` `evaluarGate` da `bloquea: false` (lib/retro-gate.ts:74). La ruta es fail-open a propósito —si el gate tira, deja pasar y loguea «gate no evaluable» (app/api/retro/route.ts:101-106)—, pero ese `catch` no se dispara por una base caída: el error ya se tragó un piso abajo. «No hay deuda» y «no pude leer la deuda» salen idénticos, y sin log.
- **Una fuente caída CIERRA un experimento.** `medirVentana` devuelve `null` ante cualquier excepción (lib/experimentos.ts:202-212) y `snapshotFunnelTexto` devuelve «sin datos disponibles» (:481-491). `cerrarExperimento` no distingue: con la integración desconectada el resultado llega vacío al prompt, el veredicto que sale (típicamente `no_concluyente`) se guarda con la fila en `cerrado`, y no hay función para reabrirlo (:638-700). Y un experimento `cerrado` cuenta como HECHO en el gate de arriba.

**Regla:** donde un `null` decide algo irreversible —cerrar un experimento, abrir un gate—, el lector devuelve el error aparte, como `LecturaFuente` en lib/objectives-fuentes.ts.

**Vive en:** lib/retro-pipeline.ts:199-214 · lib/retro-gate.ts:63-80 · app/api/retro/route.ts:101-106 · lib/experimentos.ts:202-212, :481-491, :638 (`cerrarExperimento`) · *2026-09-16 api-mako-areas*

### Los reportes de la Retro guardan nombres de personas, aunque se lean como agregados

`retro-fuentes` arma el material de los prompts con nombres propios: el formulario más rezagado con su empresa y la lista «sin nutrir» (lib/retro-fuentes.ts:189-192), las últimas llamadas de venta con el nombre del lead y su resultado (:293-295, solo en profundidad `profunda`) y las cuotas vencidas con nombre y monto (:391). La Retro corre SIEMPRE en `profunda` (lib/retro-pipeline.ts:487), así que entran siempre. Los hallazgos que redacta el modelo pueden citarlos, y quedan persistidos en `retros.reporte`.

**Regla:** antes de sacar un reporte de la Retro por otro canal —WhatsApp, la API, un link compartido—, tratarlo como dato personal y no como métricas.

**Vive en:** lib/retro-fuentes.ts:189-192, :293-295, :391 · lib/retro-pipeline.ts:487 · *2026-09-16 api-mako-areas*

### Las decisiones de la Retro

- **No se elige la profundidad:** «Nueva Retro» corre siempre la más profunda posible. Es configuración que el usuario no debería tener que decidir; lo que sí se amplía es QUÉ analizar y qué cruces comparar (2026-07-01).
- **Si las tareas y experimentos de la Retro anterior no se completaron, no se ejecuta una Retro nueva:** se incentiva a terminar lo anterior y solo se fuerza debatiendo por qué se ignoró. Hasta que no se complete lo anterior no tiene sentido proponer más cosas, salvo que sea muy evidente que hay que cambiar de prioridad (2026-07-11). El gate tiene que vivir server-side (ver arriba).
- **Experimentos y tareas son entidades distintas**, pero un experimento puede requerir varias tareas para ejecutarse: hay que modelarlas como cosas diferentes sin perder la relación (2026-07-11).
- **La estructura es Retro → Experiments → Conclusions / Planning**, con MaKo leyendo todas las demás tabs para generar la Retro, replicando el método SIMPLE de «Nueva campaña» — el diagnóstico que lo motivó fue «hoy parece una app barata y mal desarrollada» (2026-07-01).

### Lo que quedó sin hacer en la Retro

- **Falta el Perro en la Retro**, que se ejecute sola, que tenga fecha de creación/ejecución y que se conecte con Plan y con WhatsApp (2026-07-16).
- **`medir()` no está exportada, así que medir UN experimento cuesta medir todos** (lib/experimentos.ts:278). La única medición en vivo que se puede llamar es `getExperimentosView`, que mide cada activo con dos ventanas más una serie de hasta 21 tramos: hasta 23 `getMarketingWindow` por experimento, en paralelo. La API de MaKo copió la función con el mismo criterio en lib/api-mako/areas/experimentos.helpers.ts: si cambia la lib, hay que cambiar la copia, y el día que se exporte `medir()` la copia se borra (2026-09-16 api-mako-areas).

---

## Exportar e importar

### ⚠️ Exportar «Solo los proyectos» en Markdown baja igual todas las tareas

En `bajar()` (app/plan/board/ExportarModal.tsx:101-103) la rama del formato se evalúa ANTES que el qué: `if (formato === 'md') → tableroAMarkdown(tareasOut, proyectosOut, ...)`, sin mirar `que`. Con «Solo los proyectos» + «Documento (Markdown)» el archivo sale con todas las tareas adentro, mientras el resumen del pie informa solo la cantidad de proyectos — que es exactamente el «descargar a ciegas» que el encabezado del componente dice existir para evitar. Además ese combo saltea el paso `cuales`, así que el markdown se genera con el default sin forma de cambiarlo. Sigue vivo. Corolario para cualquier cambio ahí: cualquier regla del tipo «con que==='proyectos' ocultá tal campo» tiene que condicionarse también al formato, porque `tableroAMarkdown` SÍ renderiza campos que `proyectosACSV` ignora.

**Vive en:** app/plan/board/ExportarModal.tsx:101-103 (bajar) + app/plan/board/exportar.ts (tableroAMarkdown) · *2026-08-05 · ~borrador-reunion-fathom-frentes*

### Lo que quedó sin hacer en exportar/importar

- **El botón de exportar no funciona**, y falta el modal para elegir qué proyectos/tareas y qué campos exportar; hoy faltan el ID del proyecto, las descripciones y la justificación de prioridad (2026-08-05).
- **El flujo de exportar tiene que arrancar por «¿Qué quieres descargar?»** (Tareas / Proyectos / Ambos), con opción de elegir tareas manualmente, «Solo las prioritarias» en vez de «Solo las de arriba», campos ordenados por lo que más se usa con un bloque «Avanzado», y botón de seleccionar/deseleccionar todo (2026-08-05).
- **El nombre del archivo es siempre el mismo** («plan-completo-2026-08-06») para cualquier exportación (2026-08-06).
- **Subir un .md a la importación del plan deja el modal pensando para siempre**, muestra textos sin sentido («Leyendo la reunión») y al reabrirlo se pierde la importación pendiente (2026-08-06).

---

## El header del tablero

### Los botones se pisaban porque el header es de una sola línea y NADA se achica

El `<header>` del board es `flexWrap: nowrap` a propósito —para que ningún control salte
de renglón al cambiar de tab— y todos sus botones son `flex: 'none'` de 38px. Eso, junto,
significa que cuando la ventana se angosta **no hay nada que ceda**: el grupo de la derecha
se sale del contenedor y se dibuja ENCIMA de «Filtrar». Medido en Chrome a 700px de ancho:
el header medía 617px y su último hijo llegaba hasta 904px, o sea **290px de desborde**; el
grupo del medio (progreso + buscador + filtro) quedaba con `width: 0` mientras sus hijos
seguían pintando afuera. Se reporta como «los botones se ponen uno sobre otro».

La regla que queda: **cuántos controles hay es DINÁMICO, así que el corte se mide, no se
clava en un `@media`.** El tablero del cliente no tiene los botones de Fathom, y ⚠ y ✦
aparecen y desaparecen solos según el estado del plan: cualquier breakpoint fijo se
equivoca en algún caso. Se mide el header (`scrollWidth > clientWidth`) con un
`ResizeObserver`, y se pliegan las acciones detrás de un «+».

**Y la vuelta atrás necesita histéresis o parpadea.** Al plegarse, el grupo pasa de ~250px
a 38px y de golpe «entra» — así que la misma condición que lo plegó dice ahora que puede
expandirse, se expande, no entra, y se vuelve a plegar. La condición de volver mide el
hueco elástico del header (el `<span style={{flex:1}}>`, que es lo que sobra) y exige el
ancho completo de lo que va a devolver **más margen**.

Qué cede primero, cuando algo tiene que ceder: **el dato antes que el control.** El chip
«27% · 4/15 del plan» se esconde; los botones se pliegan pero siguen a un click. Un botón
hace algo; el chip solo informa.

#### Y preguntarle al contenedor si desborda NO alcanza

El primer arreglo midió el `<header>` (`scrollWidth > clientWidth`) y **no funcionó**: el
dueño volvió con la misma captura. Medido en vivo, el header entraba perfecto —946 contra
946— mientras el grupo de la vista (progreso + buscador + filtro) **necesitaba 237 y tenía
150**. Los 87px que le faltaban se le salían por la derecha y se dibujaban encima de los
botones.

Pasa porque ese grupo es lo ÚNICO que puede achicarse (`minWidth: 0`): absorbe toda la
falta de lugar, se comprime hasta donde haga falta, y el header **nunca se entera**. La
regla general: **en un flex donde algo puede encogerse sin límite, el desborde no aparece
en el contenedor — aparece adentro del hijo que cedió.** Hay que preguntarle a los dos.

Dos corolarios más, del mismo día:

- **El `ResizeObserver` sobre el header no ve un cambio de CONTENIDO.** Observa la caja, y
  la caja no cambia cuando el grupo se llena (el chip de Prioridades es más ancho que el
  de Kanban, y buscador+filtro solo existen en dos de las cuatro vistas). Por eso `view`
  va en las dependencias y se vuelve a medir con `document.fonts.ready`: las tipografías
  llegan después del primer layout y ensanchan todo.
- **Cuando hay que ceder, el orden es dato → rótulo → control.** Cede primero el chip de
  progreso (informa), después la palabra «Plan» del título (~110px, y el ícono queda) y la
  palabra «Filtrar» (~55px, y el embudo queda). Los botones no desaparecen: se pliegan.
  Con eso, medido: cero desborde y cero solapamientos de 589px a 1202px de header en
  Prioridades, y de 855 a 1202 en Kanban (antes: 87px de contenido saliéndose a 946).

**Vive en:** app/plan/board/BoardShell.tsx (`BarraAcciones`, el `useEffect` que mide y el
`data-grupo-vista`) · *2026-08-18*

### El `<main>` del board no compensaba la barra de agencia

`[data-barra-agencia] body { padding-top: 50px }` (app/globals.css:907) empuja todo el
documento cuando estás mirando el tablero de un cliente. La sidebar lo compensa
explícitamente (`height: calc(100vh - var(--barra-agencia))`, :910); el `<main>` del board
estaba clavado en `100vh` y era **el único que no**. Resultado: mirando a un cliente, el
board mide 50px más que el hueco que le queda y se come la franja de abajo del kanban.
Arreglado con la misma `var(--barra-agencia)`, que vale `0px` cuando no hay barra.

**Vive en:** app/plan/board/BoardShell.tsx (el `<main>` del return) · *2026-08-18*

### «El plan del cliente está vacío» — el orden de descarte, con los números

Reporte: el tablero de un cliente nuevo (ws13, Codigo Inmobiliario) se veía en blanco
debajo del toolbar. Lo que se midió, en el orden de AGENTS.md (datos → server → navegador):

1. **Datos:** 15 tareas y 6 proyectos en `experimento_tareas` desde el 16/08, 4 en `hecho`.
   El «27% · 4/15» del propio header sale de ahí: **si el header muestra el conteo, los
   datos ya están en memoria del navegador** y todo el server queda descartado de una.
2. **Server:** `curl` con la cookie devuelve el HTML con los títulos de las tareas adentro.
3. **Navegador:** no se pudo reproducir. Chrome headless por CDP, con la sesión del admin
   impersonando **y** con una sesión de rol `usuario` (para ver exactamente lo que ve el
   cliente), a 1600 / 1280 / 1100 / 950 / 820 / 700 / 560: el kanban pintó sus 4 columnas
   con las tarjetas en los siete anchos.

Dos cosas que ahorran la próxima vez:

- **El kanban dibuja sus 4 columnas SIEMPRE** (`PRIOS.map` sobre una constante, con su
  «＋ Nueva tarea» y un «—» por columna vacía). O sea: un filtro que deja 0 tareas produce
  4 columnas vacías, **jamás** un cuerpo en blanco. Si no hay ni columnas, el problema no
  está en los datos ni en los filtros: o el subárbol no se montó, o su contenedor mide 0,
  o algo lo está tapando/pintando del color del fondo.
- **Ese síntoma ya tiene dueño y está en AGENTS.md** («Una herramienta de laboratorio
  montada en el layout raíz…»): el taller de paletas aplicaba un tema claro sobre el
  lienzo y dejaba todo dibujado y borrado a la vez. La captura de ese incidente trae los
  MISMOS números («27% · 4/15»). Ya está cerrado por las dos puntas (`{esAdmin && …}` en
  el layout, y el `BOOT` solo aplica el tema con `?ws=` del Cliente de Diseño y en
  cualquier otra ruta **remueve** los atributos).
- **Y lo que no se pudo cerrar desde acá:** un bug que vive en el estado del navegador del
  dueño no se reproduce en otra máquina. Eso se pide, no se persigue — está escrito en
  AGENTS.md y se volvió a pagar acá.

**Vive en:** app/plan/board/BoardShell.tsx:1293 (las 4 columnas) + app/_components/TemaCandidato.tsx ·
*2026-08-18 · kanban-vacio-y-toolbar*

---

## Cómo se trabaja y se prueba en esta área

Reglas de proceso que el dueño dictó mirando el resultado de corridas sobre `/plan`. No son estilo: cada una salió de algo que salió mal acá.

- **Probá vos.** Mandá los mensajes, mové el lead y devolvelo, cambiá el nombre de la campaña pausada, abrí la preview. No devuelvas la prueba al usuario: «No funciona... Por favor, prueba tú» (2026-07-20). Hay permiso permanente de preview, y él lo pide explícito: «te invito a que hagas Claude in Chrome para verificarlo» (2026-07-19).
- **Las pruebas que salen hacia afuera van siempre a martinkoncke@gmail.com y +5493764673479** (2026-07-14).
- **Resolver en una pasada.** La queja que más se repite: «Realmente no entiendo en qué te estás gastando tantos tokens y aún no solucionas las cosas que te pedí... cuántos prompts más para que lo arregles» (2026-08-07). Cuando algo ya se corrigió dos veces y sigue mal, **no va otro parche**: se lanzan multiagentes y se cierra de una — «ya dimos muchas vueltas, no sé qué tengas que hacer, si tenés que lanzar multi agente o lo que sea, pero solucionalo» (2026-07-30) · «si tienes que correr 10000mil multi agentes para hacer esto bien... pero hazlo bien» (2026-07-22).
- **Elegí tandas grandes que no necesiten su feedback y ejecutalas solo.** Preguntar de a poco lo bloquea: «selecciona las tareas que no requieran tanto de mi pensamiento o de mi feedback para que tú puedas continuar avanzando... ahora me voy a desconectar por un buen rato» (2026-07-13).
- **Terminá la feature en curso antes de saltar a otra** (2026-07-24). Y antes de construir algo grande, contale cómo lo vas a presentar para que lo apruebe (2026-07-10).
- **En cada iteración grande, reflejá lo hecho en el board `/plan`** —creando las tareas que faltaban y marcándolas— por el riel del Perro, nunca a mano: «sino, el dashboard y gestor de tareas que hicimos queda en el olvido» (2026-07-15).
- **La documentación se escribe para que la lea ÉL**, no solo otro agente: depurada, con títulos, ordenada y visible en super admin. El porqué es concreto: «si yo lo puedo entender fácil eso me habilita a darle mejores prompts al otro Claude» (2026-08-07). Este documento se lee con los ojos en `/admin/docs`.


---

## «El plan está vacío» era Safari devolviendo cero de alto

**Síntoma:** un cliente ve el tablero VACÍO —header dibujado, debajo blanco— desde su Mac
con Safari, y perfecto desde una PC con Windows. Misma cuenta, mismos datos, mismo
servidor, y el chip del header mostrando bien «0% · 3/3 en prioridad», o sea que los datos
estaban cargados en esa misma pantalla.

**Causa:** el contenedor del cuerpo del board es `flex: 1; min-height: 0; overflow:
hidden`, y las cuatro vistas (Prioridades, Kanban, Proyectos, Graphics) colgaban de él con
`height: 100%`. Un porcentaje se resuelve contra el alto del padre, y el alto que sale de
`flex: 1` es **indefinido**: Chrome lo resuelve igual, Safari devuelve **cero**. Con el
`overflow: hidden` del padre, cero de alto no deja ni un pixel a la vista.

**Lo que más tiempo costó, y la lección:** el diagnóstico obvio era el equivocado, tres
veces. Se buscó en los filtros (todos arrancan permisivos), en el adaptador del board del
cliente (el Kanban no deriva sus columnas de los datos), en el tema candidato, en una API
que Safari no tuviera, en `localStorage` (todo ya estaba en `try/catch`) y hasta en una
segunda cuenta. **Un agente descartó explícitamente «alto/overlay (CSS)» como hipótesis
válida y nadie la persiguió, porque la única forma de verla era abrir Safari** — y toda la
verificación se hacía en Chrome headless, donde el bug NO EXISTE.

Las dos señales que lo identifican sin herramientas: (1) el header se dibuja y el cuerpo
no, y (2) **no aparece ningún error** — no es JavaScript, es layout. Cuando esas dos se
dan juntas y cambia según el navegador, es un alto que colapsó.

**El patrón correcto:** el contenedor es columna flex y el hijo estira con `flex: 1;
min-height: 0`. Ya está escrito como regla en AGENTS.md.

**Vive en:** app/plan/board/BoardShell.tsx (el contenedor + Kanban, Prioridades,
ProyectosView) · app/plan/board/Graphics.tsx · *2026-08-18*


### Corrección: `height: 100%` NO era la causa, y así se supo

La entrada de arriba dio por cerrado el caso con la teoría del porcentaje contra un padre
`flex: 1`. **Era falsa**, y el error de método es el que importa: se dedujo de una regla
conocida y se dio por verificada porque la regla existe, sin correr el caso en el motor
que fallaba.

Se corrió después. Playwright trae **WebKit** —el motor de Safari— y se instala en dos
minutos: con el código VIEJO (`height: 100%`), WebKit pinta el tablero **perfecto**. O sea
que ese arreglo fue higiene, no la cura.

Dos cosas quedan de acá:

1. **WebKit de Playwright ≠ el Safari del cliente.** El que corre local es varias versiones
   más nuevo (Safari 26 contra el que tenga su Mac), así que **no reproducir no prueba
   nada**: solo prueba que en la versión nueva no pasa. Sirve para descartar una teoría
   (si el código viejo funciona ahí, la teoría estaba mal), nunca para dar por curado.
2. **Cuando no se puede reproducir, se cambia el objetivo: que el defecto no pueda ser
   invisible.** El tablero ahora usa grid con filas `auto 1fr`, `min-height` en vez de
   `height`, y **sin `overflow: hidden`** en el camino del contenido. Si algo mide mal, la
   página crece y scrollea — feo, contable por teléfono, y visible. Era el `overflow:
   hidden` el que convertía «midió mal» en «no se ve nada».

Y para lo que no se puede reproducir, se agregó `?diag=1` en el tablero: un panel que
muestra el UA, el tamaño de ventana y el alto/display/overflow de cada eslabón
(`html → body → main → header → cuerpo → vista`), con un botón para copiarlo. **El primer
alto que dé 0 es el que se comió la pantalla.** Pedirle a alguien la consola de su Mac no
es una opción real; pedirle que abra un link y saque una foto, sí.

**Vive en:** app/plan/board/BoardShell.tsx (`Diagnostico`, el `<main>` en grid) · *2026-08-18*


### El recorte que quedaba: cada vista se recortaba a sí misma

Después de sacarle el `overflow: hidden` al `<main>` y al cuerpo, el tablero SEGUÍA
pudiendo quedar invisible: cada vista tenía **su propio `overflowY: 'auto'`** con
`flex: 1; min-height: 0`. `flex: 1` es `flex-basis: 0%`, y un porcentaje contra un padre
sin alto definido es justo lo que cada motor resuelve distinto — si da 0, el `overflow`
recorta el contenido a cero. Sacar el recorte de arriba no sirve si el de abajo sigue ahí.

**La regla, más fuerte que la anterior:** en el camino del contenido principal no puede
haber NINGÚN recorte, en ningún nivel. Las vistas van con `flex: '1 0 auto'` —crecen,
nunca se achican por debajo de su contenido— y sin `overflow`. Si un alto colapsa, la
página se hace larga y scrollea. Un tablero feo se arregla; uno invisible se reporta como
«no me funciona» y nadie sabe por dónde empezar.

Lo mismo con las columnas del Kanban: tenían `maxHeight: '100%'` (un porcentaje contra un
alto indefinido) más su propio scroll. Fuera los dos.

**Verificado** en WebKit y en Chrome, en las cuatro vistas, con el BUILD DE PRODUCCIÓN
servido local y a la medida exacta de la ventana del cliente (1227x660): 68 elementos
visibles en todos los casos, y en 12 combinaciones de motor × ajuste de accesibilidad
(reduced-motion, oscuro, forced-colors, contraste alto, zoom 150%).

**Vive en:** app/plan/board/BoardShell.tsx (Kanban, Prioridades, ProyectosView y la
columna) · app/plan/board/Graphics.tsx · *2026-08-18*


### La causa raíz estaba en el layout de TODA la app, no en el tablero

`app/layout.tsx` abría el contenedor raíz con `align-items: flex-start` —heredado de
«réplica del rootStyle del prototipo», o sea copiado de un HTML suelto donde ninguna
pantalla tenía que llenar el alto—. Con eso, la columna que envuelve al `<main>` se queda
del alto de SU CONTENIDO, y **ahí nace la cadena indefinida**: ningún descendiente tiene
un alto definido contra el cual resolver un `1fr`, un `100%` o un `flex-basis: 0%`.

Chrome igual les da un alto usable; **WebKit viejo devuelve 0**, y ahí cualquier
`overflow` recorta la pantalla entera. Las dos reglas del spec en juego —un `flex-basis`
porcentual contra un contenedor indefinido debe tratarse como `content`, y un grid con
`min-height` debe re-resolver las filas `fr` contra ese mínimo— Blink las implementa y
WebKit las arregló recién en versiones recientes. **Por eso el WebKit 26 de Playwright no
reproduce nada: el bug vive en las versiones que no puedo correr.**

Con `align-items: stretch` la cadena queda definida desde arriba y el tablero deja de
depender de que el motor haga esa re-resolución.

**Barrido de no-regresión** (el cambio toca todas las pantallas), WebKit y Chrome:
/plan 229 y 189 elementos visibles, /general 149, /crm 45, /marketing 194, /perfil 51.
Ninguna quedó vacía ni con scroll horizontal.

**Vive en:** app/layout.tsx (`rootStyle`) · *2026-08-18*


### El «+» prometía crear y entregaba un menú

Tres reclamos del dueño sobre el toolbar plegado, y los tres tenían la misma raíz: la
barra se resolvió de cero en vez de copiar lo que la casa ya tenía resuelto.

1. **«El botón de filtro quedó aplastado».** Medido: es el ÚNICO control del header sin
   alto propio (`ghostBtn` = padding, sin `height`). Con la palabra lo fijaba la caja de
   texto → 35px; al quedar solo el ícono lo fija el svg de 13px → **41×31**, al lado de
   botones de **38×38**. Tres alturas en la misma fila, y la más chica es justo la que se
   quedó sin rótulo. Ahora la caja es 38×38 fija y el embudo mide 17 como el resto de la
   app (el del CRM ya medía 17; el del plan era el ícono más chico del header).
2. **«No se entiende que es un desplegable».** Un «+» significa CREAR en toda la industria
   y en esta misma app: prometía una tarea nueva y entregaba un menú. Los tres puntos son
   el símbolo de overflow y **el CRM ya lo usaba** (`app/crm/CrmToolbar.tsx` →
   `KebabIcon`, con `aria-label="Más acciones del CRM"`). El precedente estaba en casa.
   Peor: el panel desplegaba los MISMOS íconos mudos en una tira horizontal — cambiaba un
   ícono ambiguo por cinco. Ahora es un menú vertical con nombre y una línea de qué hace
   cada acción, igual que el del CRM.
3. **«Cuando aparece el + desaparece la barra de progreso».** Era cierto y no tenía red:
   `!compacto && <AvgChip/>`, sin versión reducida ni tooltip. Y ese número **no existe en
   ningún otro lado** — el «Avance global» de Graphics es otra fórmula (promedio por
   proyecto, no por tarea). Ahora el progreso de la vista viaja al menú, arriba de todo,
   como dato y no como acción.

**Dos cosas que aparecieron midiendo, y que nadie había reportado:**

- El `aria-label` decía «Ver las 4 acciones» cuando detrás había **5 botones**: la entrada
  `fathom` empaquetaba dos (Fathom + importar) en un solo `nodo`. Al plegarse también se
  perdían **todos los avisos** que vivían en esos botones: el badge de reuniones
  pendientes, el contador de MaKo, el latido y el parpadeo del ⚠.
- El badge del disparador no puede ser la SUMA de los badges: daba «507» (429 tareas sin
  datos + 19 de MaKo + 59 de reuniones), un total de cosas que no son la misma cosa. Va un
  punto; el número de cada una vive en su fila.

**Vive en:** app/plan/board/BoardShell.tsx (`BarraAcciones`, `FilaAccion`, `KebabIcon`,
`FunnelIcon`, `progresoDeLaVista`) · *2026-08-21*


### «Cargar 16» sobre una reunión que no crea ninguna, y el click que no hacía nada

Síntoma, textual: *«me dice "Cargar 16 tareas" cuando solo hay para ampliar, no para
cargar nuevas. Le di a cargar al plan y no hizo nada… me preguntó varias veces lo mismo y
le daba y no hacía nada»*. **Sí hizo**: amplió 7 tarjetas (quedó en su historial, «MaKo le
sumó contexto (no la duplicó)») y después dijo que había fallado.

Son DOS bugs encadenados, y el segundo es el que lo volvía un loop:

1. **La cuenta.** `nIncluidas` contaba las filas con `incluir` sin descontar las que
   AMPLÍAN, mientras `nAmpliar` las contaba aparte: la misma fila se contaba dos veces, y
   el botón prometía 16 altas sobre una reunión que no creaba ninguna. El modal hermano
   (la extracción manual) ya las descontaba — este se había quedado con la mitad del
   arreglo, y el comentario que había al lado documentaba justamente el caso INVERSO.
2. **El veredicto.** `aplicarPropuestas` cerraba con
   `if (!idsCreadas.length && !borradas && !cerradas) → 'No pude crear ninguna tarea'`.
   **`ampliadas` no estaba en la condición.** Un lote que solo amplía devolvía error: el
   modal mostraba el error, no se cerraba, el borrador NO se marcaba aplicado, y cada
   click volvía a ampliar. Ampliar es un RESULTADO, no un fallo.

**La regla que queda: cuando una operación tiene más de un resultado posible, la condición
de éxito los enumera a TODOS.** Un `if` de éxito que se escribió cuando solo existía
«crear» se queda viejo el día que se agrega «ampliar», y falla en la dirección peor —
diciendo que no pasó nada cuando sí pasó, e invitando a repetirlo.

Y la de siempre, en su versión de cuentas: **dos definiciones para el mismo concepto
divergen**. `esAmpliarFila` vive ahora fuera del componente, exportada, y
`tests/ampliar-vs-crear.test.ts` fija la invariante: una fila no puede contarse como alta y
como ampliación a la vez.

**Vive en:** app/plan/board/TareasRecibidasModal.tsx (`esAmpliarFila`, `etiquetaAccion`) ·
lib/plan-propuesta.ts (la condición de éxito) · *2026-08-21*


### El proyecto y sus tareas se puntuaban en corridas distintas, y nadie las reconciliaba

Síntoma, textual: *«en Prioridades me sale que el proyecto más importante es de
ciberseguridad. Pero en el kanban hay muchas tareas más importantes que eso»*. Y antes:
*«aún aparece el caso de un proyecto con prioridad baja y sus tareas muy altas»*.

**El diagnóstico obvio era el equivocado.** El primer arreglo fue `recurvarPlanOwner()`,
que re-reparte la pirámide de las TAREAS sobre el tablero entero — correcto para lo que
resolvía (el 96% conservaba el número del día que nació), pero **preserva el orden por
diseño**, así que no podía mover ni un proyecto. Se shippeó como si cerrara el reclamo y no
cerraba nada. Lo dijo él: *«no creo que se hayan aplicado los cambios»*.

La causa real: hay **dos productores de score que nunca se hablan**.
`describirProyectosNuevos` puntúa proyectos, `puntuarNuevas` puntúa tareas, corren en
llamadas distintas con prompts distintos, y **ninguna de las dos mira el resultado de la
otra**. Los dos números terminan en la misma pantalla, uno al lado del otro, comparándose.

Medido sobre el tablero real antes de tocar nada (550 tareas abiertas, 71 proyectos):

| | Antes | Después |
|---|---|---|
| Tareas que puntúan por encima de su propio proyecto | **154** (peor: una en 81 adentro de un proyecto en 7) | **0** |
| Proyectos empatados en score | 23 | 19 (sobre 63 con trabajo abierto) |
| Proyectos SIN una sola tarea abierta | 8, de **50 a 80** — uno por encima del único encargo con cliente vivo y entregables fechados | 8, todos en 1 |
| Objetivo Principal | «Seguridad y multi-inquilino» (97, mejor tarea 90) | «Vender MaKo: Oferta y precios» (98, mejor tarea 93, 15 pendientes) |

No era cosmético: `objetivoPrincipal` es el proyecto de mayor score con pendientes, la
vista Prioridades arranca por SUS tareas y el resto del plan se ordena por `scoreProy`. Un
score de proyecto que no mira sus tareas gobierna la pantalla entera.

**La regla que queda: un CONTENEDOR vale lo que vale el mejor contenido que tiene adentro,
y su número se DERIVA — no se pide dos veces.** El piso es el `max` de sus tareas abiertas,
así que la inversión es imposible por construcción, no por suerte. No es el promedio a
propósito: con el promedio, un proyecto de veinte tareas chicas le gana a uno con una
crítica, que es el error opuesto. Encima del max va un bonus de densidad 0-6 sacado de las
tres mejores (las que faltan valen 0, así que una sola tarea no cobra bonus de tres).

Tres cosas que se decidieron en contra de lo que parecía obvio:

- **Acá NO va `spreadProjScores`.** Repartir 1..100 sin empates es *incompatible* con la
  invariante: los proyectos del medio caerían debajo de sus propias tareas y volvería
  exactamente el síntoma. El empate entre dos proyectos cuya mejor tarea vale lo mismo no
  es mushiness, **es el dato**.
- **Pero el desempate no puede quedar en `orden`**, que es el orden en que se crearon: el
  norte del tablero cambiaría de proyecto por un motivo que no significa nada. A igual
  score gana el que tiene MÁS trabajo abierto, y el log del server usa el mismo criterio
  que la pantalla — un log que desempata distinto es una pista falsa el día de la auditoría.
- **Un proyecto vacío va a 1, no al medio.** No es una prioridad: es una intención.

La función vive en `app/plan/board/types.ts` y no adentro del módulo `server-only` que la
usa, por la regla de siempre: una invariante que ningún test puede importar es una
expresión de deseo. `tests/board-scores.test.ts` la corre sobre los 100 valores de `max`.

**Lo que NO cierra esto** (sigue abierto, y es la otra mitad del reclamo original): el
Perro ubica lo nuevo contra el tablero pero **no re-rankea lo viejo entre sí**. El ejemplo
que dio él —«Feature de Videos de IA 90» empatada con «Cerrar cliente Código Inmobiliario
90»— es eso, y ninguna aritmética lo arregla: hace falta un criterio determinista que mueva
tareas viejas sin llamar al modelo (envejecer lo que nadie tocó en N días, subir lo que
tiene deadline cerca). Falta definir la ventana de días con el dueño.

**Vive en:** app/plan/board/types.ts (`scoreProyectoDerivado`) · lib/plan-board.ts
(`recurvarProyectosOwner`, llamada al final de `priorizarNuevasOwner`) ·
app/plan/board/BoardShell.tsx (`porScore` y su desempate) · scripts/recurvar-plan.mts ·
scripts/medir-proyectos-derivados.mts (el dry-run que produjo la tabla) · *2026-08-21*


### Dependencias: la urgencia sube por la cadena, la ejecutabilidad baja, y NO se escribe nada

Pedido textual: *«Hay proyectos y tareas que DEPENDEN de otros. Puede que haya algunos que
estén correlacionados, pero iniciar no depende del anterior. Pero otros sí, dependen
absolutamente de que el anterior se termine. Como por ejemplo el de Cobros y Planes depende
totalmente de que se termine la oferta y precios.»*

Tres decisiones, y las tres salieron de medir el código, no de preferencia.

**1. NO SE PERSISTE NINGÚN NÚMERO. Las dependencias se resuelven en el render.**
Dos razones independientes, cualquiera de las dos alcanza:

- `curveTaskScores` reasigna TODOS los scores por ranking a bandas fijas. Un orden horneado
  en la base es **irreversible**: borrar la arista no devuelve los scores viejos porque ya
  no existen. Como lente, una arista equivocada se arregla borrándola y el tablero vuelve
  exacto al instante.
- **`recurvarPlanOwner` tiene UN solo llamador en todo el repo** — adentro de
  `priorizarNuevasOwner`. No hay endpoint, ni cron, ni botón. O sea: **el tablero solo se
  re-reparte cuando entran tareas nuevas.** Una propagación enchufada ahí sería invisible
  hasta la próxima reunión: el dueño declara la dependencia, no pasa nada, y parece que la
  feature está rota. Es el gotcha que más caro salía y no lo vio ninguno de los tres
  diseños que se generaron en paralelo.

**2. Tabla propia, no una columna en `plan_tareas`.** `guardarPlanTarea` hace
`upsert(taskToRow(t))` de la **fila entera** desde el estado del navegador en cada autosave.
Un campo nuevo que una pestaña con estado viejo no conozca se pisa solo — sin error, sin
build roto, con el síntoma «se me borran las dependencias a veces». Con la relación afuera
ese modo de falla es imposible por construcción y no una cosa que haya que recordar.

**3. La herencia sube por DELTA, no por máximo.** Ésta se descubrió corriéndola contra el
tablero real, y la primera versión estaba mal: le daba a CADA tarea del proyecto la urgencia
heredada entera. Resultado medido: las **14 tareas abiertas de «Oferta y precios» saltaron
todas a 93 y coparon el top 12**, incluidas «Investigar competencia: Crush.ai» (score 15) y
«Analizar embudo de GoMarz» (7), empujando abajo trabajo urgente de otros proyectos.
Aplanar el orden INTERNO de un proyecto es cambiar una mentira por otra. La regla correcta:
*el proyecto que va primero sube hasta el nivel del que lo espera, y sus tareas suben todas
lo mismo*.

**Las dos cosas que una dependencia cambia son DISTINTAS, y confundirlas es el error:**

| | qué le pasa |
|---|---|
| **Importancia** | sube del bloqueado al bloqueante: `u(A) = max(score(A), u de lo que A destraba)`. Misma forma que `scoreProyectoDerivado`. |
| **Ejecutabilidad** | baja, pero el **score NO se toca**. Un trabajo bloqueado sigue valiendo lo que vale; lo que no puede es entrar a la lista de «qué hago AHORA». Prioridades lo excluye y avisa cuántas quedaron afuera. |

`clase: 'ordena'` (correlacionado) **no toca ningún número**: es la traducción literal de
«iniciar no depende del anterior». Si moviera el ranking, las dos clases serían la misma con
distinto nombre.

**Lo que sigue abierto:** las aristas hoy las carga el dueño a mano. El Perro **todavía no
puede** detectarlas: `puntuarNuevas` le manda `existentes` como `[score] titulo` **sin ids**,
y filtra `progress < 100` — o sea el estado que DEFINE una dependencia («A ya terminó») es
estructuralmente invisible, y un par de ids exactos transportado por un LLM es el
antipatrón que este repo ya pagó. Cuando se cablee, va por `plan_propuestas.depende` (la
columna ya existe, mig 0140) con los títulos adentro y confirmación humana.
Y hay un regalo sin usar: **`DebateModal` ya le pregunta al dueño «Desbloquea (o frena)
otras cosas» y le hace elegir una tarea REAL de una lista con ids — y después tira la
respuesta.** Ese es el mejor punto de entrada que existe.

⚠️ **Un consumidor nuevo del motor pasa TODOS los labels, no `labels[0]`** (16/09/2026).
`resolverDeps` resuelve las dependencias de proyecto contra cualquier label de la tarea
(app/plan/board/dependencias.ts:165-169). Normalizar la tarea a un solo `proyectoId` —lo natural
al armar una vista compacta— hace que una tarea que tiene el proyecto como label SECUNDARIO
aparezca libre cuando está bloqueada, y sin ningún error.

**Vive en:** app/plan/board/dependencias.ts (el motor puro, sin `server-only`) ·
app/plan/board/DependenciasBloque.tsx (el bloque del detalle, uno para los dos niveles) ·
lib/plan-board.ts (`listDependencias`, `agregarDependencia`, `limpiarDependenciasColgadas`) ·
app/api/plan-board/route.ts (`dep-add` / `dep-del`, con el guard de ciclo server-side) ·
supabase/migrations/0140_plan_dependencias.sql · tests/dependencias.test.ts (30 tests) ·
*2026-08-21 · 2026-09-16 api-mako-areas*


### «30 días sin tocar baja, deadline a menos de 7 sube» — la señal era el problema, no la regla

Pedido textual del dueño. Las dos reglas cuestan cero tokens: son dos restas. **Lo que casi
las rompe es la señal de «sin tocar»**, que parecía trivial. Medido sobre las 550 tareas
abiertas del tablero real, con tres definiciones:

| Definición | Resultado |
|---|---|
| `historial` con `actor === 'user'` (el dueño editó la tarjeta) | **7 de 550**. El tablero lo alimentan MaKo y las reuniones, no la edición manual: el 99% queda como «nunca tocado» y la regla mide ANTIGÜEDAD, no abandono |
| `updated_at` | **inservible**. Sin trigger de base, lo escribe el código, y tres de sus escritores son procesos (el Perro, MaKo ampliando, y el borrado de un proyecto que reescribe `labels` de decenas de tareas) |
| `Math.max` sobre TODO el historial — lo que hace hoy la card «Estancadas» | también: una corrida del Perro deja la tarjeta como «tocada hoy» sin que nadie la haya mirado |

La señal que SÍ discrimina es otra pregunta: **¿se volvió a hablar de esto?** Una tarea que
MaKo amplió porque el dueño la mencionó de nuevo en una reunión está viva aunque él no haya
tocado un botón. Con esa definición el tablero se reparte de 0 a 39 días y **101 de 550
(18%) cruzan los 30** — un corte que separa de verdad. La lista de qué cuenta va en
POSITIVO y cerrada (`TOQUES` en `envejecer.ts`): «todo menos lo del sistema» deja entrar
como toque cualquier evento nuevo que alguien agregue después, sin que nada avise.

**Y una mina que habría hecho mal la cuenta en silencio:** 418 entradas de historial en
producción tenían `ts` guardado como **string ISO** (el tipo dice `number`) y `actor: 'MaKo'`
(un cuarto valor que no existe en el union). `Math.max` con un string adentro da NaN, y NaN
en una comparación es **siempre false** — o sea la regla se habría evaluado sobre 362 de 550
tareas sin decirlo. Ver la entrada de `sanearHist` más arriba.

**`score_base` (mig 0141) es lo que hace la regla reversible.** `curveTaskScores` reasigna
por ranking a bandas fijas: restarle 15 puntos a algo y después querer devolvérselos era
imposible, no quedaba de dónde. Ahora:

    score = curva( score_base + empuje por deadline − castigo por quietud , dependencias )

`score_base` lo escribe quien JUZGA (el Perro, o el dueño al debatir **o al arrastrar la
tarjeta** — `setScore` lo escribe, y sin eso el reparto la devolvía a su lugar: arrastro,
rebota, arrastro, rebota). El reparto nunca lo toca. **Verificado en producción: la segunda
y la tercera corrida mueven 0 tareas.**

⚠️ Esto NO es «dos productores del mismo número». Es lo contrario: un productor por número,
con una derivación explícita entre los dos.

**El cron que faltaba.** `recurvarPlanOwner` tenía UN llamador —dentro de
`priorizarNuevasOwner`—, o sea que el tablero solo se re-repartía cuando entraban tareas
nuevas. Dos reglas que dependen del calendario no se hubieran movido nunca solas: una fecha
se vencía y el tablero no se enteraba hasta la próxima reunión. `/api/cron/plan-recurvar`
corre a diario (9:10 UTC) y hace las tres cosas deterministas: reparte, deriva los proyectos
de sus tareas, y barre las aristas colgadas.

**Efecto medido de la primera corrida:** 511 de 550 tareas cambiaron de número, 76 de
columna (38 arriba, 38 abajo). El top del tablero pasó a estar dominado por lo vencido
—25 tareas, la más vieja hacía 13 días, y 7 de ellas ni siquiera estaban en Alta—, y lo que
bajó fue todo «39 días sin que nadie la mencione».

⚠️ **Lo que hay que mirar con el dueño:** entre lo que bajó está «Salvar los datos de Meta
antes de que los borre (URGENTE)» (91→76) y «Que MaKo hable con tus números reales» (93→79).
La regla no puede distinguir *«dejó de importar»* de *«importa y está abandonada»* — son el
mismo dato. Por eso el castigo tiene **tope 20** (a los 50 días toca fondo y no sigue), la
razón se **muestra** en la tarjeta y en el detalle, y se puede **debatir**: el Perro la vuelve
a fijar y eso reescribe `score_base`.

⚠️ **`diasAlDeadline` cuenta días UTC, no días del negocio, y el cron corre justo del lado malo**
(16/09/2026). Compara contra el deadline a las 12:00 UTC con `Math.ceil`
(app/plan/board/envejecer.ts:80-84): el «0» dura de las 12:00 UTC del día del deadline a las
12:00 UTC del siguiente. El comentario de la función justifica el mediodía con que «este tablero
se reparte desde un cron que corre a las 13-14 UTC». **Ese supuesto quedó viejo:**
`plan-recurvar` corre a las 9:10 UTC (vercel.json), **antes** del mediodía, así que ve cada
deadline un día más lejos — la tarea vencida
ayer da 0 y cobra el empuje de «≤3 días» (20) en vez del de vencida (25), y la que vence hoy
figura para mañana. Cualquier «vencidas» armado encima subcuenta un día. La API de MaKo cuenta
días de calendario contra `hoyEnWorkspace()` (lib/api-mako/areas/plan.run.ts:242-250); el board
(BoardShell.tsx:1771 y :1791) y el cron (lib/plan-board.ts:665) siguen con la función vieja.

**Vive en:** app/plan/board/envejecer.ts (las funciones puras, sin `server-only`) ·
lib/plan-board.ts (`recurvarPlanOwner`) · app/api/cron/plan-recurvar/route.ts · vercel.json ·
supabase/migrations/0141_plan_score_base.sql · scripts/medir-envejecimiento.mts y
scripts/simular-reparto.mts (los dry-run que produjeron los números) · *2026-08-21*


### Un proyecto vacío no vale poco: está VACÍO. Y lo que le falta es trabajo, no puntaje

Corrección del dueño, textual: *«Un proyecto vacío NO debe tener una puntuación de 1. Todo
lo contrario. Si se creó un proyecto es por algo… Lo que se debe hacer es cargarle tareas.
Y para ello, MaKo debería primero intuir posibles tareas y hacer el mismo form que ya
usamos de preguntas cuando un proyecto esté vacío.»*

**El error era de categoría, no de número.** La primera versión de `scoreProyectoDerivado`
los mandaba a 1, o sea trataba **«no sé» como «no importa»**. Son cosas distintas: un
proyecto sin tareas no es de baja prioridad, es DESCONOCIDO — no hay evidencia de la cual
derivar nada, y fabricar un número donde no hay dato es exactamente el modo de falla que
esa función vino a cerrar. Hoy devuelve `null` y el caller deja el score que puso el Perro.
(Los 8 que quedaron aplanados no se pudieron recuperar: el score original ya estaba pisado,
así que se lo volvió a pedir al Perro — `scripts/repuntuar-proyectos-vacios.mts`.)

La acción que los saca del limbo es `proponerTareasParaProyecto`: MaKo intuye 3-8 tareas a
partir del nombre y la descripción del proyecto, más el norte del negocio y una muestra
salteada del plan para no repetirse. **No escribe ninguna tarea**: deja un borrador en
`plan_propuestas` y devuelve el link a `/plan/revisar/<id>`, con el MISMO
`preguntasParaCargar` del resto del tablero — no hay una segunda pantalla ni un segundo
contrato de preguntas. `ref: proyecto-vacio:<id>` hace de candado: tocar el botón cinco
veces devuelve el mismo borrador.

**Dos cosas que salieron de probarlo contra el tablero real:**

- **El modelo se inventaba una cita del dueño.** El molde del detalle pide «la frase TEXTUAL
  entre « » con quién», y acá NADIE pidió nada: las tareas las intuye MaKo a partir de un
  nombre. Salieron seis detalles diciendo *«El dueño necesita…»* entre comillas, que después
  quedan en el tablero indistinguibles de un dato real. El prompt ahora lo prohíbe explícito.
  **Corolario general: un molde que asume una FUENTE no se puede reusar en un generador que
  no tiene fuente** — la ranura se llena igual, con algo inventado.
- **Un test del repo lo cazó antes de que llegara a producción**
  (`tests/ia-mensajes.test.ts`): si el vacío de la cascada se convierte en un MENSAJE para el
  usuario, hay que pedir `erroresOut`. «MaKo no pudo contestar» y «no tenés ninguna IA
  conectada» son dos problemas con dos soluciones distintas, y el mensaje genérico manda a
  buscar al lugar equivocado. Es la mejor prueba de que la guarda vale: la escribió otra
  corrida, para otra feature, y funcionó sola.

⚠️ **Lo que quedó pendiente:** el bloque solo aparece cuando el dueño ABRE el proyecto vacío.
Falta que el cron (`/api/cron/plan-recurvar`) los detecte y avise — hoy hay que acordarse de
entrar. `proyectosSinTareas()` ya devuelve la lista y está sin usar desde ahí.

**Vive en:** lib/plan-proyecto-vacio.ts · app/plan/board/BoardShell.tsx
(`ProyectoVacioBloque`) · app/api/plan-board/route.ts (`proponer-tareas-proyecto`) ·
app/plan/board/types.ts (`scoreProyectoDerivado` devuelve `null`) ·
scripts/repuntuar-proyectos-vacios.mts · *2026-08-21*


### El Perro dejó de juzgar los proyectos, y nadie lo notó hasta que el ranking fue absurdo

Rechazo textual del dueño, mirando la pantalla: *«¿Cómo que "vale lo mismo que su tarea más
alta"? Si quisiera hacer eso, ¿para qué me tomé el trabajo de meter IA? Para eso simplemente
lo pongo con código. Pero justamente está el perro guardián, para asignar prioridades según
lo que MUEVE LA AGUJA. Y hay una metodología para eso. […] "Feature: Closing Analyst" o
"Feature: Customer Success"… ¿Qué carajos tiene que ver con lo que mueve la aguja?»*

**La causa raíz no era la fórmula que se revirtió — era anterior, y medida:**

| Lo que se creía | Lo que estaba pasando |
|---|---|
| El Perro puntúa los proyectos | Los puntúa **una sola vez, el día que nacen**, y nadie los vuelve a mirar nunca. `priorizarNuevasOwner` filtra los nuevos y le manda el resto con la instrucción textual «REFERENCIA, NO los re-puntúes» |
| …con su metodología | Con una versión **recortada**: al prompt de proyectos le faltaba la ESCALERA DEL DINERO entera, la definición de impacto/esfuerzo en días, la regla de lo roto frente a un cliente, «el tamaño no es la prioridad», la disciplina de distribución y el FORMATO OBLIGATORIO de la razón |
| …viendo de qué se trata | Viendo **`{ id, nombre }`**. Dos palabras. Medido: el detalle de 1.111 caracteres de ese proyecto no viajaba, ni sus tareas, ni su score actual. El modelo decidía si «Feature: Closing Analyst» mueve la aguja a partir de su título |

**Y había una bomba de cuota encima.** `rePriorizar` (BoardShell) mandaba el plan entero con
el `detalle` COMPLETO de cada tarea, sin recortar. Medido sobre el tablero real: **990.903
caracteres ≈ 275.000 tokens en un solo prompt** (el detalle era el 87%), contra un límite
diario de **250.000** por cuenta de Gemini — y como `mako-guardian` tiene `fallback: []`, la
llamada no degradaba: **fallaba**. Colgada de un `setTimeout` de 2.500 ms que dispara con solo
tener el board abierto y tocar una tarea. Ahora el detalle va a `.slice(0, 1500)`, igual que
`puntuarNuevas`, y los proyectos ya no viajan por ahí.

**Lo que reemplaza a la fórmula:** `puntuarProyectos` (lib/mako-guardian.ts) +
`priorizarProyectosOwner` (lib/plan-board.ts). El Perro juzga TODOS los proyectos entre sí,
con la metodología completa interpolada de un solo lugar (`MET_ESCALERA`,
`MET_IMPACTO_ESFUERZO`, `MET_ROTO_CLIENTE`, `MET_TAMANO`, `MET_DISTRIBUCION`, `MET_RAZON` —
la escalera estaba **copiada a mano dos veces** y ausente del único prompt que puntuaba
proyectos), y recibiendo el resumen de qué es, cuánto trabajo abierto tiene, una muestra
**pareja** de sus tareas y su score actual.

⚠️ **La muestra es PAREJA, no el top.** Mandar las 5 mejores tareas le enseña al modelo a
mirar el máximo — que es exactamente el sesgo de la fórmula que se revirtió.

**El escalón pasó a ser un DATO** (mig 0142). Era la regla más pesada del prompt y la única
verdaderamente imposible de verificar mientras viviera adentro de una frase: no se podía
ordenar por ella, ni mostrarla, ni contar cuántas cosas caen en cada escalón. `escalon` no
existía en ninguna parte del repo — ni columna, ni tipo, ni campo de JSON, ni chip.

**Y la salida se AUDITA antes de escribirse** (`app/plan/board/metodologia.ts`). Lo que cazó
en las corridas reales, que es la prueba de que hacía falta:

- **54 de 66 razones no comparaban contra nada**: el modelo escribía «Le gana a «Feature:
  Mindset»» adentro de la razón de «Feature: Mindset» — el formato copiado sin el contenido.
  Con el reintento diciéndole exactamente eso, quedó en ~1.
- **5 proyectos que el modelo no devolvió** se estaban quedando con el score y la razón
  VIEJOS, mezclados entre los nuevos. Ahora se vuelven a pedir por nombre.
- **5 empates** que el desempate no veía, porque solo miraba los que el Perro había devuelto
  y no los que conservaban su score anterior.
- Un título citado como «Feature: Configuración y equipo» cuando el proyecto real se llama
  «Configuraciones» — plural. Una comparación contra un nombre parecido se lee igual de
  convincente que una buena.

⚠️ **`desempatar` reemplaza a `spreadProjScores`, y la diferencia importa.** Aquel reparte
1..100 estrictamente decreciente: con 71 proyectos escribe 100, 99, 97, 96… 1, o sea **el
número guardado deja de ser el juicio y pasa a ser la posición en el ranking**. El modelo
decía «95» en la razón y la pantalla mostraba otra cosa — la razón y el número saliendo otra
vez de dos mecanismos distintos. `desempatar` baja al empatado de a 1 hasta encontrar hueco:
el que no empata no se mueve, y la DISTANCIA entre dos proyectos sigue significando algo.

**Resultado sobre el tablero real (71 proyectos):**

| | Antes | Después |
|---|---|---|
| Rango usado | 20-98, **12 proyectos entre 94 y 98** | 30-100 |
| Empates | 5 | **0** |
| Norte | «Feature: WhatsApp de MaKo» *(porque tenía dos tareas vencidas)* | **«Feature: Cobros y planes»**, escalón 1 — cobrar |
| Razón del #1 | «Vale lo que su mejor tarea: "…" (93), con 7 pendientes adentro» | «Le gana a «Feature: Onboarding» porque cobra plata directamente con pasarela activa» |
| «Feature: Closing Analyst» | 95, top 10 | fuera del top 15 |

⚠️ **Lo que sigue sin cerrar:** el rango llega a 30 y la metodología pide que lo que puede
esperar del todo vaya en 1-10. El modelo comprime el fondo y no lo corrige ni diciéndoselo.
Queda como falla BLANDA visible en cada corrida — a propósito: forzarlo con una fórmula sería
repetir exactamente el error que esta entrada documenta.

**Vive en:** lib/mako-guardian.ts (`MET_*`, `puntuarProyectos`) · lib/plan-board.ts
(`priorizarProyectosOwner`) · app/plan/board/metodologia.ts (la auditoría, `desempatar`) ·
app/plan/board/types.ts (`ESCALERA`) · app/plan/board/BoardShell.tsx (`EscalonChip`, el
recorte de `rePriorizar`) · supabase/migrations/0142_escalon_dinero.sql ·
scripts/priorizar-proyectos.mts · *2026-08-21*


### La escala se abre tanto como cosas haya — y el número que vos fijás no se pisa

Dos cosas que quedaron abiertas de la corrida anterior, y el dueño las cerró con un ejemplo
que vale más que cualquier fórmula:

> *«Está bien que ahora haya llegado hasta el 30 en el menor de los proyectos, porque yo
> tengo 71 proyectos. Pero si tuviera 100, debería llegar hasta el 1. Lo mismo debería pasar
> con las tareas. Si tengo pocas tareas no es lo mismo si tengo muchas.»*

**No era una preferencia: era aritmética que ya estaba escrita y nadie había juntado.** «El
norte va en 95-100» + «PROHIBIDO empatar» ⟹ con `n` valores distintos y el techo en 100, el
más bajo **no puede** estar por encima de `101 - n`. Con 71 da exactamente 30 — el número
que él señaló — y con 100 da 1. `escalaEsperada` (app/plan/board/metodologia.ts).

La validación que había era una **constante** (`min <= 15`) y estaba mal en las dos
direcciones: marcaba como falla un tablero de 71 proyectos que estaba perfecto, y no habría
marcado uno de 100 que se quedara en 20. Un umbral fijo sobre algo que depende de la
cantidad es un umbral que miente de los dos lados.

**Y a los proyectos no se les pone cupo de «Alta», a propósito.** Con 71 sin empatar y un
rango de 70, los valores 81-100 se ocupan sí o sí: exigir «solo el 15% arriba de 80» sería
pedir algo aritméticamente imposible. Una alarma que no se puede apagar nunca es una alarma
apagada. El 15% es disciplina de TAREAS, que sí empatan y son cientos.

**El lado de las tareas era otro problema, y peor.** `curveTaskScores` reparte por RANKING y
descarta los valores que puso el Perro. Medido: **con 5 tareas ya mandaba 2 a «A futuro» con
score 2** — le decía a alguien que acaba de escribir cinco cosas que dos no importan, sin
mirar qué había decidido el Perro. Y con 550 hacía exactamente lo mismo: la forma del
reparto era **independiente de cuántas cosas había que repartir**.

Con cientos de tareas esa disciplina es correcta (el modelo infla, y la ley de los grandes
números hace que la pirámide sea razonable). Con pocas es destruir el único juicio que hay.
El umbral de «no curvar» pasó de 5 a **20**: debajo de eso gana el juicio del Perro, y si
igual infla lo dice `piramideSana` en vez de taparlo redistribuyendo.

⚠️ Se probaron dos alternativas antes y las dos eran peores, con la medición al lado:
comprimir el rango hacia el techo mete **todo en Alta** (con 10 tareas quedaban las 10
arriba de 84), y bajar el piso con una curva exponencial es inventar un exponente sin nada
que lo justifique. Quedó anotado en el comentario de la función para que no se reintente.

**Los cupos ahora se le dicen al modelo EN NÚMEROS.** «De estos 71, el más bajo tiene que
quedar en 30 o menos» se respeta muchísimo mejor que «usá toda la escala»: el porcentaje lo
tiene que traducir él mientras hace otras diez cosas, el número ya está traducido, y además
se puede **contar** después — que es la otra mitad de la regla.

**El candado del score que decidís vos** (mig 0143). `ProyectoDebateModal` es el único lugar
donde el dueño le gana una discusión al Perro, y ese número se guardaba en la misma columna
que todo lo demás: **indistinguible de uno que puso una corrida automática**. Con la
re-priorización corriendo a diario, mañana a las 9:10 se lo llevaba puesto. `score_manual`
lo marca, el Perro lo VE marcado, y el candado es de una sola dirección: puede **proponer**
moverlo —queda escrito en la razón, «Lo fijaste vos en 34. MaKo lo pondría en 61: …»— pero
no lo escribe. Verificado de punta a punta: la marca viaja de la base al board.

**Resultado sobre el tablero real:** rango **30-100** (el máximo que 71 proyectos permiten),
**0 empates**, **0 fallas** en la auditoría, y los escalones repartidos 1:1 · 2:8 · 3:16 ·
4:20 · 5:26 — que es la forma de un producto en construcción con un solo camino de cobro
abierto. La corrida es estable: casi todos los scores coinciden con los de la anterior, que
es la regla de ESTABILIDAD funcionando.

**Vive en:** app/plan/board/metodologia.ts (`escalaEsperada`, `cuposDeDistribucion`,
`usaTodoElRango`, `piramideSana`) · app/plan/board/types.ts (`curveTaskScores`, el umbral de
20) · lib/mako-guardian.ts (`{{cupos}}` en el user template) · lib/plan-board.ts (el candado
de `score_manual`) · supabase/migrations/0143_score_manual.sql · *2026-08-21*


### La URL del board era un link de una sola vez, no el estado de la pantalla

Dos reportes de la misma captura, y los dos tenían la misma forma: algo que se veía como
un detalle de UI y era una decisión de arquitectura mal tomada.

**1. «El botón de filtrar se ve feo.»** Estaba CORTADO por su propio borde, con la palabra
«Filtrar» saliéndose. El `flex: none` estaba puesto en el `<button>`… y el flex item que ve
el header es el `<span>` que lo envuelve. El grupo que los contiene tiene `minWidth: 0` para
poder achicarse, así que el span absorbía toda la falta de lugar y recortaba al botón.

⚠️ **`flex: none` en el hijo no protege al hijo: protege al hijo de que lo comprima SU
padre.** Si el que se achica es el padre, el hijo se recorta igual. Cuando algo se ve
cortado adentro de un flex, la pregunta no es qué tiene ese elemento — es cuál de sus
ancestros puede encogerse. Con el `flex: none` en el span, el header vuelve a desbordar y
el modo compacto (que ya existía) se activa: se pliega a solo-ícono en vez de recortarse.

**2. «Cada vez que refresco me lleva a Prioridades.»** El board guardaba la vista en un
`useState` y nunca la escribía a ningún lado. Y peor: el deep-link `?tarea=`/`?proyecto=`
—que sí existía— **se borraba a sí mismo** apenas abría el modal (`sp.delete('tarea')`),
porque estaba pensado como un link de una sola vez que manda MaKo por WhatsApp.

**La regla que queda: si la pantalla tiene estado que sobrevive a un F5, ese estado es la
URL.** Un `useState` es el estado de ESTA carga; la URL es el estado de la PANTALLA. La
diferencia se nota exactamente en dos momentos —refrescar y copiar el link— y los dos son
justo cuando más molesta.

⚠️ Y hay una distinción que hay que hacer explícita, porque el mismo query string tenía las
dos cosas mezcladas: **`?vista=`, `?tarea=` y `?proyecto=` son ESTADO** (se escriben, se
leen y se conservan); **`?reunion=` es un EVENTO** (abrir un borrador) y se limpia después
de usarlo. Un evento que se queda en la URL se vuelve a disparar en cada refresh.

**Dos decisiones de implementación con su porqué:**

- **La vista se lee EN EL SERVER** (`app/plan/agencia/page.tsx` y `app/plan/page.tsx`), que
  es lo que ya pedía AGENTS.md. Acá se ve por qué: si el board arrancara en «prioridades» y
  corrigiera después de hidratar, cada refresh sería un parpadeo *más* un aviso de
  hidratación desalineada.
- **Se escribe con `history.replaceState`, NO con `router.replace`**, apartándose de la
  convención de tabs — y el motivo es medible: `router.replace` sobre la misma ruta con otro
  query **es** una navegación, y esta página es `force-dynamic`, así que Next vuelve a pedir
  el RSC. Serían **550 tareas y 71 proyectos por cada click en una tab**. Cuando la URL es un
  destino, `router.replace`; cuando es un marcador para el próximo F5, `replaceState`.

⚠️ La query se construye a partir de `window.location.search`, **nunca de cero**: armarla de
cero es como se pierde el `?ws=` y terminás mirando otra cuenta (AGENTS.md → las cuatro
formas de navegar).

**Verificado en el navegador real contra producción**, que es lo único que cuenta para un
bug visual: el filtro se dibuja entero, un click en una tab escribe `?vista=proyectos`,
abrir un proyecto agrega `?proyecto=17`, y después de F5 la pantalla vuelve idéntica —
misma tab, mismo modal abierto.

⚠️ **Gotcha de verificación:** el primer screenshot después del F5 mostró la tab correcta
pero SIN el modal, y parecía un bug. El board todavía estaba hidratando. Con un board de
550 tareas hay varios segundos entre «el HTML llegó» y «React ya montó los efectos»: una
captura sacada en el medio muestra media pantalla y se lee como una falla. Esperar y volver
a mirar antes de diagnosticar.

**Vive en:** app/plan/board/BoardShell.tsx (el efecto de la URL, `FilterMenu`) ·
app/plan/agencia/page.tsx · app/plan/page.tsx · app/plan/PlanBoard.tsx ·
app/plan/TodoBoard.tsx · *2026-08-21*


## «El Plan de Mauricio» es la tabla de clientes: ni la del dueño ni un JSON

Salió el 2026-09-16, repasando las llamadas con Mauricio del 8 y el 9/9 para repartir sus tareas
entre los chats.

**Síntoma.** En la llamada del 9/9 a Mauricio se le dijo que MaKo guarda las tareas de cada
workspace «a través de un JSON». Él quería leer esa base en modo lectura para un curso y se quedó con
que no había base. En la misma corrida, dos de los agentes que ubicaron las tareas en el código
mandaron los cambios del tablero de Mauricio a `plan_tareas` y a `NuevaTareaPlan`
(lib/plan-board.ts).

**Causa real.** El tablero lo decide la **capa** del workspace, no el número. `capa === 'superadmin'`
(hoy el ws 9) usa `plan_tareas`; cualquier otro, incluido el ws 1, usa `experimento_tareas` vía
`lib/todo.ts` (app/api/agente/plan/route.ts:33, lib/plan-propuesta.ts:689). El ws 1 fue OWNER_WS
cuando el dueño no tenía workspace propio, y lo escrito sobre el board del dueño todavía se lee como
si fuera el de Mauricio. Tampoco hay JSON: el localStorage de `PlanBoard` era del tablero del
super-admin y migró a la base en julio.

**La regla: antes de tocar «el Plan de X», resolvé la capa de su workspace. Para Mauricio es
`experimento_tareas`.** Desde la mig 0159 (17/9) tiene 5 estados con CHECK —ver abajo— y columnas de
responsable, cliente de origen, tema y veredicto del criterio.

**Trampa para quien lo vacíe.** El 8/9 Mauricio pidió sacar todas las tareas y empezar de cero. Si el
tablero queda sin tareas **y** sin categorías, `app/plan/page.tsx:63` llama a `seedTodoBoardSiVacio()`
y le vuelve a sembrar el plan de arranque. Hay que conservar las categorías o poner un candado.

**Cómo sigue el 1,2% de más arriba.** Del 8 al 16/9 entraron 17 borradores de reuniones al ws 1 y no
se aplicó ninguno; el tablero tiene 182 tareas por hacer. En la llamada del 8/9 se decidió cargar
directo al tablero con el criterio de Mauricio, sin confirmación ni preguntas, y mandar a una columna
aparte lo que no lo cumple. Al 16/9 no está implementado: espera el documento de criterio actualizado
de Mauricio.

**El mismo error vivía en MaKo, y se leía como «el plan está vacío».** La tool `ver_plan`
(lib/mako-tools.ts, la que usan el doer de WhatsApp y la API) elegía el tablero con
`ws === OWNER_WS` hasta el 16/09: al ws 1 le leía `plan_tareas` y contestaba «El plan del dueño
está vacío todavía», y al ws 9 le leía `experimento_tareas` con links a `/plan`. El diagnóstico
obvio —no hay tareas— era el equivocado: estaban en la otra tabla. Ya decide por capa. Si
aparece otro `ws === OWNER_WS` eligiendo tablero, es este bug.

⚠️ **Y `experimento_tareas` no es solo el plan.** Mezcla las tareas del tablero con las que
crearon la Retro y los experimentos (`retro_id`, `experimento_id`), y `listTareas` no filtra
(lib/todo.ts:142-151). El `/plan` del cliente las pinta igual, así que la pantalla y cualquier
lectura por `listTareas` coinciden; pero un conteo de «tareas del plan» sobre esa función incluye
las de la Retro.

**Vive en:** app/api/agente/plan/route.ts:33 · lib/plan-propuesta.ts:689 · lib/todo.ts ·
app/plan/page.tsx:63 · lib/reunion-auto.ts · lib/mako-tools.ts (`ver_plan`) · *2026-09-16 ·
2026-09-16 api-mako-areas*

## Sumar un estado a `experimento_tareas` no es sumarlo al tipo

Salió el 2026-09-17, al agregar `no_cumple` («No cumplen criterio») y `en_seguimiento` para el
tablero por estados que pidió Mauricio (mig 0159).

**Parecía** un cambio de una línea: el estado era texto libre y el único guardián era el tipo de
TypeScript. **No lo era**, por dos lectores que nadie iba a mirar:

- **La derivación por avance se come los estados nuevos.** `editarTarea` recalculaba el estado desde
  el % a ciegas (100→hecho, >0→en_curso, 0→por_hacer). Tocarle el avance a una tarea descartada la
  sacaba a «En proceso»: promoverla sin que nadie lo decida. Ahora pasa por `estadoTrasProgreso`
  (lib/todo-estados.ts), que deja quietas a `no_cumple` y `en_seguimiento` salvo al 100%.
- **«Pendiente» se preguntaba como `estado !== 'hecho'`** en el agente, /general, el conteo del
  onboarding, `ver_plan` y el Perro del cliente. Con `no_cumple`, eso cuenta lo descartado como
  trabajo y el Perro lo puntúa pagando tokens.

**La regla:** pendiente se pregunta con `estaPendiente()` (o `NO_PENDIENTES_SQL` en la base), nunca
con `!== 'hecho'`. Un estado nuevo va en `ESTADOS` **y** en el CHECK de la base, en el mismo commit:
el test `tests/todo-estados.test.ts` compara los dos. El veredicto del juez (`criterio_*`) no es el
estado: mover la tarjeta no lo toca, y la API del cliente no lo escribe.

**Quedó sin hacer:** promover una tarea desde `no_cumple` todavía no exige motivo en el server
(`moverTarea`, lib/todo.ts) — hoy no hay filas en ese estado, así que no hay por dónde entrar. Va con
la columna de 08-T27. Los campos del CRITERIO (`criterio_*`, `cita`, `tema`) todavía no los escribe
nadie: llegan con la extracción con criterio. Los de QUIÉN sí, desde el tablero único (abajo).

**Vive en:** lib/todo-estados.ts · lib/todo.ts (`estadoOk`, `editarTarea`, `crearTarea`) ·
supabase/migrations/0159 · app/api/todo/route.ts · *2026-09-17*

## El estado pasa a ser la columna (16/10/2026)

«Hacer el kanban un kanban» (Martín, sobre la reunión con Mauricio del 12/10): las columnas pasan de
prioridad a ESTADO en las dos mitades, `en_seguimiento` se dibuja «Atorada» (con un motivo de una
línea) y las tareas nacen LIBRES (score 0 = «Sin priorizar»). La mitad del dueño no tenía estado:
mig 0294, con backfill desde el avance. Lo que costó, que no se ve leyendo el código:

- **El retroceso estaba escrito desde la 0159 y no se veía.** `editPatch` (TodoBoard.tsx) manda el
  objeto ENTERO de la tarjeta en cada guardado, avance incluido, y `editarTarea` recalculaba el estado
  desde el avance cada vez que venía. Con columnas de prioridad el estado no se dibujaba; con columnas
  de estado, arrastrar una tarjeta a «En proceso» al 0% y corregirle una tilde la devolvía a «Por
  iniciar». **Un campo derivado que se recalcula en CADA guardado de un patch entero pisa cualquier
  valor explícito**: se deriva sólo si la fuente CAMBIÓ, comparando contra la FILA, no contra el
  navegador (`estadoAlGuardar`, lib/todo-estados.ts).
- **`taskToRow` escribía `orden: t.num` en cada guardado del dueño.** Medido: 424 de 424 filas de
  `plan_tareas` con `orden = num`. Nadie lo veía porque ninguna pantalla ordenaba por `orden`; con un
  kanban de orden manual, deshace cada arrastre dentro de la columna.
- **Lo que escribe una ACCIÓN no viaja en el upsert de la fila entera.** El guardado del dueño es la
  memoria de la pestaña: con `estado` y `orden` adentro, una pestaña abierta hace una hora devolvería
  de columna lo que se movió desde otra (o lo que movió MaKo por la API). `guardarPlanTarea` los saca
  del payload y los relee —la misma cura que `guardarPlanProyecto` le aplica al score—, y los escribe
  `moverPlanTarea` por columna. Es una excepción a «un campo son seis lugares»: `estado` NO va en
  `editPatch` ni en el guardado, a propósito.
- **`moverTarea` existía desde la 0051 con cero llamadores, y estaba mal en tres cosas** que nadie
  podía ver: un estado inventado se convertía en «Por iniciar» (`estadoOk`) y contestaba 200, reordenar
  dentro de «Completada» re-sellaba `hecho_at`, y sacar una tarjeta de ahí la dejaba abierta al 100%
  (medio sistema pregunta `progress < 100`). Ahora `trasMover` es UNA regla para las dos mitades y el
  navegador: Completada = 100%, reabrir = 0%, el motivo sólo vive en Atorada.
- **`toBoard` convertía el score 0 en 62** (`t.score || scoreFromPrio[t.prioridad]`), así que «sin
  priorizar» no se podía ni ver, y el siguiente `editPatch` mandaba `score: 62` de vuelta: una tarea
  quedaba «Media» sin que nadie lo decidiera. Medido el 16/10: 0 filas con score 0 en las dos tablas,
  así que sacar el `||` no le cambió la columna a nadie. **El 0 NO es «A futuro»**: `prioFromScore(0)`
  sigue siendo la banda 'futuro' (la usan el reparto y las cuentas), y el chip y el filtro preguntan
  por `prioFiltroDe`.
- **El reparto de las 9:10 hubiera sacado de «Sin priorizar» cada tarea libre** (piso 1 + la curva le
  da un puesto), y metía en el reparto lo que el criterio no dejó pasar: `recurvarPlanOwner` ahora
  excluye y CUENTA las dos (`sinPriorizar` en el log).
- **El orden inicial de cada columna se reescribió en la migración** (mayor score arriba; en
  Completada la más reciente), porque el `orden` de hoy no lo eligió nadie: es reescribir un número
  invisible para que el primer día del kanban se vea en el orden que ya se veía. Va guardado por la
  columna nueva: volver a correr la 0294 no pisa lo que la gente ya arrastró.

**La regla:** el estado se escribe por `mover` (capacidad del Repo, `moverTarea` / `moverPlanTarea`,
y la op `mover_tarea_plan` de la API); el avance lo mueve sólo cuando cambia. Los tests que lo miden
en la FILA: `tests/plan-kanban-server.test.ts` (funciones reales contra un PostgREST de mentira).

**Quedó sin hacer:** ~~la pantalla, la sección «BANDAS» de AGENTS.md y la re-puntuación oculta del
navegador~~ — hechas en la tanda 2 (ver [La pantalla del kanban por estado](#la-pantalla-del-kanban-por-estado-16102026));
el doer legado (`tareas_plan`, lib/mako-doer-acciones.ts) sigue llamando al Perro al crear
(~~y `aplicarPropuestas`~~: ya no, desde la tanda 3 — ver [Fathom sin fricción](#fathom-sin-fricción-cargar-sin-ia-el-cruce-en-el-cron-y-lo-que-no-se-leyó-16102026)); y, después del deploy, las dos
sentencias de reconciliación que están en la cabecera de la 0294 (tareas del dueño completadas o
reabiertas entre la migración y el deploy).

**Vive en:** lib/todo-estados.ts · lib/todo.ts (`moverTarea`, `editarTarea`, `crearTarea`,
`scoreAlCrear`) · lib/plan-board.ts (`taskToRow`, `guardarPlanTarea`, `moverPlanTarea`,
`recurvarPlanOwner`) · app/plan/TodoBoard.tsx (`editPatch`) · app/plan/board/desde-todo.ts ·
supabase/migrations/0294 · *2026-10-16*

## La pantalla del kanban por estado (16/10/2026)

La tanda 2 de «hacer el kanban un kanban»: columnas = estado en los dos tableros y en el teléfono,
soltar mueve sin pop-up de prioridad, orden manual por defecto, «＋» con estado, Prioridad y
Responsable como filtros, y fuera la re-puntuación oculta del navegador. Lo que costó y no se ve
leyendo el código:

- **El server mueve la columna cuando cambia el avance; la pantalla no.** Con la tanda 1, completar
  una tarjeta desde «En proceso» la pasaba a «Completada» en la base y la dejaba tachada en «En
  proceso» hasta el F5: el estado optimista sólo cambiaba `progress`. **Un campo que el server
  DERIVA de otro se deriva igual en el estado optimista**, con la misma función (`avanceLocal` →
  `estadoTrasProgreso`, app/plan/board/kanban.ts) y en el choke point de los cambios (`conAvance`
  en `patch`, `patchLog*`, `setChecklist` y `undoHist` de useBoard), no en cada botón.
- **La clave de preferencia compartida habría escondido el orden manual.** «Ordenar» de Tareas y de
  Proyectos era UNA preferencia (`orden.modo`, guardada en «Por prioridad» en cada navegador); con
  ella el kanban abría ordenado por score y un arrastre dentro de la columna no se veía nunca. El
  kanban tiene su clave (`orden.kanban`, default «Manual»). **Cambiar el default de una preferencia
  no le cambia nada a quien ya la tiene guardada: la clave nueva es la que hace valer el default.**
- **«Completada» crece sin techo** (248 de 424 en el tablero del dueño): se corta en 20 con «Ver
  más», y el lugar al soltar se calcula contra la columna ENTERA (lo visible es un prefijo), o
  soltar al fondo de lo visible caía detrás de las escondidas.
- **En el teléfono, la marca de «se fue» suponía que lo completado sale de la lista.** Con columnas
  por estado lo completado sigue viniendo (en otra columna): la marca no se soltaba nunca y la tarea
  quedaba escondida en Prioridades aunque alguien la reabriera. La marca ahora no cuenta lo que el
  kanban ya trae en «Completada» (ListaPlan.tsx). **Cuando una lista cambia de semántica —lo que
  antes salía ahora se queda—, la lógica optimista de «salida» se revisa entera.**
- **«No cumplen tu criterio» pasó a ser alcanzable a mano** (arrastre, el detalle, la API), y
  Prioridades preguntaba `progress < 100`: ofrecía como «lo de AHORA» algo que el criterio no dejó
  pasar. `prioridadesDelTablero` ahora mira `estado` (y la API se lo pasa). Ojo que hay más
  `progress < 100` que nunca vieron un `no_cumple` (ver «quedó sin hacer»).
- **El responsable sólo existe en la mitad del cliente.** `plan_tareas` no tiene
  `responsable_tipo` ni nada que lo escriba: el filtro «Responsable» es una capacidad del tablero
  (`repo.responsables`) y no se dibuja en el del dueño — ahí metería el 100% en «Sin asignar». Y la
  base tiene un cuarto valor que la decisión no nombraba (`tercero`, alguien del equipo con email):
  tiene su opción, o esas tareas no se podrían aislar nunca.
- **`rePriorizar` no era sólo un disparo al cambiar la firma**: había un segundo, al entrar, si «lo
  que cargó MaKo» traía una tarea sin razón. Se fueron los dos (y el `skipRePrio` que los
  sorteaba). ~~`crearDesdeReunion` todavía llama al Perro~~: ya no, desde la tanda 3 ([Fathom sin
  fricción](#fathom-sin-fricción-cargar-sin-ia-el-cruce-en-el-cron-y-lo-que-no-se-leyó-16102026)).

**La regla:** la columna la escribe `board.mover` (estado + `orden`, nunca el guardado de la fila);
el orden dentro de una columna es el manual (`enOrdenManual`) y el lugar al soltar sale de las
vecinas (`ordenAlSoltar`); la prioridad se filtra con `prioFiltroDe` («Sin priorizar» no es «A
futuro»). Los tests: `tests/plan-kanban-pantalla.test.ts` (reglas + cableado), el teléfono en
`tests/m-plan-tableros.test.ts` y `tests/plan-kanban-server.test.ts` (`moverEnTablero`).

**Quedó sin hacer:** la vista Tabla no muestra la columna (estado); `hoyDelTablero`
(app/plan/board/hoy.ts, «Hoy»/«Semana» del teléfono y Today) y otras cuentas siguen preguntando
`progress < 100` y contarían una tarea del DUEÑO movida a «No cumplen tu criterio» (lib/plan-hoy.ts
sólo saca `no_cumple` en la mitad del cliente); una carrera menor: soltar en «Atorada» y escribir el
motivo en seguida son dos `mover` y, si llegaran al revés, el historial (que se escribe entero) pierde
una entrada; el comentario de app/customer-success/KanbanEntrega.tsx todavía dice que el arrastre con
el dedo está «tipado contra las bandas de prioridad»; la bitácora de /admin/dev/plan; y no se miró en
el navegador (sin `next dev` en esta máquina): escritorio y teléfono están probados por tests y tipos.

**Vive en:** app/plan/board/kanban.ts · app/plan/board/BoardShell.tsx (`Kanban`, `ColumnaKanban`,
`CampoMotivo`, `BloqueColumna`, `PrioChip`, `FilterMenu`) · app/plan/board/useBoard.ts (`mover`,
`conAvance`) · app/plan/board/arrastre-tactil.ts · app/m/plan/tableros.ts · app/m/plan/ListaPlan.tsx
· lib/plan-mover.ts · app/plan/board/prioridades.ts · *2026-10-16*

## Fathom sin fricción: cargar sin IA, el cruce en el cron y lo que no se leyó (16/10/2026)

La tanda 3 de «hacer el kanban un kanban». Martín, textual: «optimiza la velocidad de importación de
tareas de Fathom… Que hoy en día tardan un montón porque "cruzan" con las otras tareas... Quiero que
elimines eso y toda la fricción. Quiero hacerlo "libre", que se creen sin prioridad». Y Mauricio
(12/10): que se lea solo, que no se cargue solo, y «que extraiga más rápido».

**Lo medido antes:** «Cargar» un borrador de cuatro tareas (tres nuevas, una repetida) hacía, EN EL
PEDIDO y con la pantalla esperando, 3 llamadas de IA en el tablero del cliente y 4 en el del dueño
(3 y 5 intentos de red): el ruteo del Perro, el Perro por tandas de 10 (que escala con el lote y
re-curvaba el tablero entero: el 15/10 un alta «re-curvó 22 de 175 tareas y re-priorizó 62 de 70
proyectos») y las checklists. El modal, además, cruzaba en el navegador al abrirse (20-40 s con
«Agregar» apagado), y «Extraer» una reunión a mano era sincrónico (1 a 5 minutos). **Ahora: 0
llamadas al cargar**, medido con el mismo borrador (`tests/fathom-sin-friccion.test.ts`).

**El diagnóstico obvio era el equivocado.** La decisión decía «9 de 10 reuniones del ws1 entre el 08 y
el 15/10 desaparecieron sin rastro» y apuntaba al clasificador. Medido en producción: 11 reuniones (5
de entrega, 6 de equipo), **CERO descartadas por tipo**, y 10 sin borrador porque la LECTURA falló (la
IA del negocio no contesta desde el 08/10, ver la entrada del 15/10 más abajo) y salieron de la ventana
de 26 h. Por eso la tabla nueva (mig 0296) guarda también `tipo = 'fallo'`, y la lista del modal se
llama «Sin leer» y no «Descartadas»: «descartada» le diría al dueño que MaKo decidió no leerla, cuando
no pudo. Las diez del ws1 se anotaron a mano el 16/10 (10 filas `fallo` en la 0296) para que aparezcan
con «Reintentar».

**Las reglas que quedan:**

- **Cargar un borrador no llama a ningún modelo.** El anti-duplicado es `mismaTarea` (y el id del
  cruce, si el borrador ya lo trae); el proyecto sale de `destinoSinIA` (lib/plan-bandeja.ts): lo que
  nombra la tarea → un proyecto que existe → uno del catálogo → el del cliente de la reunión → la
  bandeja «Sin proyecto». **Un nombre que inventó la extracción NO abre un proyecto**, ni siquiera sin
  el Perro: queda escrito en el historial de la tarjeta para quien la reparta.
- **La bandeja es un proyecto, pero nunca un DESTINO.** Los dos ruteos del Perro la sacan de la lista
  (`esProyectoBandeja`): una tarea no «va» a «Sin proyecto», cae ahí cuando nada la reclama. La vacía
  «Re-priorizar todo».
- **El cruce corre donde nadie mira**: en el cron después de `crearPropuesta`, al final de la lectura
  en segundo plano (archivo o reunión) y en un barrido de los pendientes sin sello. **Se sella aunque
  no encuentre nada, y NO se sella si el modelo falló o no entró en el reloj**: «todavía no se cruzó»
  y «se cruzó y no había nada» son distintos, y el segundo no se vuelve a pagar nunca. El modal no lo
  espera: carga igual.
- **Una reunión ahora la leen TRES caminos** (el cron, el webhook de Fathom y el botón del modal), así
  que hay un candado por reunión (`mako.reunion.leyendo.<id>`, compare-and-set, vence a los 330 s). Y
  **una fila «procesando» la llena el primero que trae tareas**: sin eso, si el cron ganaba la carrera
  a la lectura del modal, `crearPropuesta` devolvía el id de la fila vacía y la lectura del cron se
  tiraba — un borrador vacío para siempre.
- **Ninguna reunión desaparece sin rastro.** Lo que el cron no lee queda en
  `plan_reuniones_descartadas` con el motivo en palabras: el correo que decidió el tipo
  (`motivoDelTipo`, recorre lo mismo que `clasificarReunion`) o el error de la lectura.

**Trampas del entorno:**

- **PostgREST con `resolution=ignore-duplicates` NO devuelve la fila ignorada** (es un ON CONFLICT DO
  NOTHING). `cambiarSettingSi(…, null, …)` cuenta con eso para saber quién ganó un candado; un mock que
  la devuelve le dice «ganaste» a los dos.
- **Medir «cero IA» con un `fetch` de mentira sólo vale en el ws 1.** `credWs` cae al env sólo para
  `OWNER_WS`: en otro workspace la cascada no encuentra clave y se rinde ANTES del `fetch`, y el código
  viejo también da 0 (medido: con los ws 3 y 9, `ia: []` con cinco llamadas en el log). Y el primer
  paso de la red de la plataforma es `GET openrouter.ai/api/v1/credits`: contarlo es contar el intento.
- **Una ruta de Next se corre entera en un test** cambiando `next/server` (`after`) y `@/lib/auth` en
  `Module._load` ANTES de cargarla (tests/_fathom-carga-hijo.ts): `after()` guarda la función en vez de
  correrla, y se ve qué contestó la ruta antes de que la lectura empiece.
- **`/api/v1` tiene `maxDuration = 60`**: una lectura de reunión (1-5 min) no entra en un `after()` de
  la API de MaKo. Por eso «Leer igual» no es una operación de la API; ver la lista sí lo es
  (`listar_reuniones_fathom` → `sin_leer`).
- **El webhook de Fathom SÍ está registrado** (`webhook_routing` de los ws 1, 9 y 11), así que no se
  tocó la frecuencia del cron: el webhook dispara la misma lectura del cron para esa grabación
  (`soloRecording`). El ws 4 tiene la clave y el secreto pero no su fila de ruteo: su webhook se
  ignora («sin workspace»).

**Quedó sin hacer:** «Re-priorizar todo» (decisión 9, la tanda 4), que es lo que vacía la bandeja y
le pone prioridad a lo que entró libre; hasta entonces, lo de una reunión queda «Sin priorizar» en
«Sin proyecto» si nada lo reclamó. Siguen llamando al Perro al crear: el doer de WhatsApp
(`tareas_plan`, lib/mako-doer-acciones.ts), las acciones `priorizar-nuevas` de app/api/todo/route.ts y
app/api/plan-board/route.ts, y crear un proyecto a mano (BoardShell, `createLabel`). El cron gasta su
reloj en el cruce de cada reunión antes de mirar la siguiente (hasta ~60 s por reunión). Nadie avisa
cuando una reunión pasa a «Sin leer»: se ve sólo abriendo el modal de Fathom. Y no se miró en el
navegador (sin `next dev` en esta máquina).

**Vive en:** lib/plan-propuesta.ts (`aplicarPropuestas`, `crearPropuesta`) · lib/plan-bandeja.ts ·
lib/todo-rutear.ts (`rutearSinIA`) · lib/plan-board.ts (`agregarTareasPlanOwner`, `opts.sinIA`) ·
lib/reunion-cruce.ts + lib/cruce-borrador.ts · lib/reunion-auto.ts · lib/leer-reunion-en-segundo-plano.ts
· lib/reunion-leyendo.ts · lib/reunion-descartadas.ts + supabase/migrations/0296 ·
app/api/plan-fathom/route.ts · app/api/webhooks/fathom/route.ts · app/api/cron/fathom-plan/route.ts ·
app/plan/board/TareasRecibidasModal.tsx · app/plan/board/ReunionExtractModal.tsx ·
tests/fathom-sin-friccion.test.ts · *2026-10-16*

## «Re-priorizar todo»: un trabajo por tandas, el candado del cliente y lo que pinta la pantalla (16/10/2026)

La tanda 4 de «hacer el kanban un kanban» (decisión 9). Martín, textual: «Quiero hacerlo "libre", que
se creen sin prioridad, y luego de última un botón en los 3 puntos de arriba del plan para
"re-priorizar" todo, y eso puede correr en segundo plano y no impedir que el usuario siga utilizando
todo».

**Cómo corre.** La entrada vive en el menú de los tres puntos (las dos mitades: `repo.repriorizar`) y
en la API de MaKo (`repriorizar_plan`, `ver_repriorizacion_plan`). Arrancar saca la FOTO de las tareas
abiertas del Plan y deja una fila en `plan_repriorizaciones` (mig 0297); la procesan, de a 20, el
SONDEO del tablero abierto (cada 4 s pregunta el avance y empuja la tanda siguiente en `after()`) y el
cron `/api/cron/plan-repriorizar` (cada minuto, para cuando se cierra la pestaña o lo arrancó MaKo por
WhatsApp). Cada tarea: el número del Perro de siempre (`puntuarNuevas`, la red gratis), el proyecto si
está en «Sin proyecto», una entrada de historial de MaKo; en el dueño, al final, el reparto
(`recurvarPlanOwner`) y el juicio de los proyectos. No toca fechas ni detalle.

**Lo que estaba escrito era falso: `experimento_tareas.score_manual` EXISTE desde la 0143.** Tres
lugares lo negaban —el comentario de `Repo.prioridadManual` (app/plan/board/types.ts), el de
`repoPlan` y AGENTS.md («una columna que la tabla del cliente no tiene»)— y la 0297 se escribió
creyéndoles; aplicarla en producción contestó «already exists, skipping». La 0143 la agregó a las
TRES tablas; lo que faltaba era quién la usara: en el tablero del cliente nadie la escribía ni la
leía. No hacía falta mientras el Perro del cliente sólo puntuaba lo que NACÍA; «Re-priorizar todo»
re-puntúa lo que existe, así que desde hoy el slider del cliente la pone, `prioridadAlPerro` (nueva en
ese tablero) la saca, `toBoard` la lee y `editPatch` NO la manda. **Y la razón escrita no sirve de
marca**: el slider del cliente escribe «La fijaste a mano» en la base y la pantalla se queda con
«Prioridad fijada a mano», que el próximo guardado sube — dos textos para el mismo candado.

**Las reglas que quedan:**

- **Un trabajo largo es una FILA, no un `await`.** La foto de ids, el cursor (`hechas`), el estado y el
  último error viven en la base; tomar una tanda es un compare-and-set sobre `vuelta` con un candado
  que vence (`tomada_hasta`, 240 s), y soltarla exige la vuelta que se tomó. Así el sondeo y el cron
  —o dos pestañas— nunca procesan la misma tanda (medido en el test: el segundo drenaje pierde el CAS).
- **«Uno a la vez» lo garantiza la BASE**: un índice único parcial (`workspace_id, tablero` donde
  `estado = 'corriendo'`). Leer «no hay ninguno» y después insertar no alcanza con dos clics juntos;
  el que choca (23505) recibe el que ya corre.
- **Una tanda que falla se reintenta ENTERA, esperando** (20 s, después 60 s: la cuota de Gemini es por
  minuto), y a la tercera el trabajo se CORTA: si la red gratis no contesta, la tanda siguiente
  tampoco. Saltearla dejaría veinte tareas sin número y un trabajo «hecho». **El error queda en la fila
  aunque el reintento salga**: «falló y se recuperó» no es «nunca falló».
- **Lo que un trabajo escribe en segundo plano VIAJA A LA PESTAÑA ABIERTA**, o el próximo guardado lo
  deshace: los dos tableros guardan la fila entera (el upsert del dueño con `score`, `score_base` e
  `historial`; el `editPatch` del cliente con `score`, `score_razon` e `historial`). La fila guarda los
  cambios (`cambios`, un `GuardPatch` por tarea) y el sondeo los pide desde donde se quedó y los pinta
  con `aplicarPerroServer`, sin volver a guardarlos. Eso destapó que **`aplicarPerroServer` no
  actualizaba `scoreBase`**: `priorizarNuevasOwner` escribe `score_base` y la pestaña se quedaba con la
  vieja, así que el siguiente guardado le devolvía al reparto el juicio de antes (ahora `GuardPatch`
  lleva `scoreBase`). Y ya no duplica entradas de historial con el mismo id.
- **La entrada de historial de una corrida repetible lleva id DETERMINISTA** (`rp<trabajo>-<tarea>`):
  una tanda cortada a mitad se repite entera y la segunda pasada reemplaza la entrada en vez de apilar
  otra. Lleva el número de ANTES («62 → 48»): no hay deshacer, y el historial es lo único que deja
  volver a mano.
- **La vara contra la que se puntúa no lleva las «Sin priorizar»** (no tienen un juicio sino la
  ausencia de uno: con 60 en 0, el modelo vería medio tablero en el fondo), **ni lo que se repite, ni la
  Retro ni los experimentos**.
- **SÓLO tareas del Plan.** `experimento_tareas` mezcla el plan con lo que propuso una Retro y los pasos
  de un experimento (`esDelPlanCliente`: origen `retro`/`experimento` o `retro_id`/`experimento_id`):
  ésos no entran ni como tarea ni como vara — tienen su propia rendición de cuentas.
- **La bandeja sale por una lista CERRADA** (los proyectos que existen; en el cliente también las áreas
  del catálogo y un «Cliente: X» que sale del CRM). Lo que el modelo propone abrir (`nuevos`) NO se
  crea en un trabajo que corre sin nadie mirando: la tarea se queda en «Sin proyecto». Para eso
  `rutearTareasCliente` devuelve ahora de dónde salió cada destino (`via`).
- **Desde la API no se empuja trabajo con un reloj que no se conoce.** `repriorizar_plan` deja la fila
  y contesta; una tanda necesita 75 s y `/api/v1` corta a 60 (y el «sí» de WhatsApp o de la bandeja
  corre con otro techo). Lo levanta el cron dentro del minuto. Y arrancar no sale por HTTP: llama al
  Perro, y un token en la máquina de un tercero no debería poder quemar cuota en bucle.

**Medido en producción (16/10, sólo lectura):** abiertas del Plan, 185 en el ws1 (`experimento_tareas`)
y 176 en el ws9 (`plan_tareas`); CERO fijadas a mano abiertas en los dos (una cerrada en el ws9),
CERO en «Sin proyecto», CERO «Sin priorizar» (nada cargó libre todavía en producción), y 2 tareas de
origen `retro` en `experimento_tareas` (una abierta, en el ws11).

**Trampas del entorno:**

- **`after()` comparte el `maxDuration` de la ruta** (120 s en `/api/todo` y `/api/plan-board`): el
  drenaje no arranca una tanda con menos de 75 s por delante ni el cierre del dueño (70 proyectos en
  una llamada) con menos de 100. Cortada a mitad, la tanda se repite entera.
- **El `tsc-acotado` sólo ve lo que se le nombra**: `app/experimentos/_demo.ts` tenía un rojo de tipos
  desde la tanda 1 (`motivo_atorada` obligatorio en `Tarea`) que nadie había chequeado; sale en el tsc
  completo de CI.
- **Un PostgREST de mentira que compara `lt.`/`gt.` como texto miente con ids** («1009» < «999»). El
  nuevo `tests/_postgrest-de-mentira.ts` compara número con número, simula los índices únicos
  parciales (409 / 23505) y es el que tienen que usar los hijos que vengan (hay otras tres copias).

**Quedó sin hacer:** no se miró en el navegador (sin `next dev` en esta máquina): el menú, la línea
chica y el toast están probados por tests y tipos. El TELÉFONO (`/m/plan`) no tiene la entrada: no monta
`BoardShell`. **El kanban del cliente sigue mostrando las tareas de la Retro y de los experimentos**
(`listTareas` no filtra; la SPEC lo pedía también para el kanban y ninguna tanda lo hizo). El tablero
del cliente no re-juzga sus proyectos (no tiene un Perro de proyectos). Arrancar desde el tablero
agenda dos `after()` (el del arranque y el del primer sondeo); el compare-and-set hace que sólo uno
trabaje. Y siguen llamando al Perro al crear: el doer de WhatsApp, `priorizar-nuevas` y crear un
proyecto a mano (ver «Fathom sin fricción»).

**Vive en:** lib/plan-repriorizar-nucleo.ts (lo puro: la foto, la tanda, la vara, `trasFalla`) ·
lib/plan-repriorizar.ts (los dos tableros, `avanzarRepriorizacion`, `accionDelTablero`, el cron) ·
app/api/cron/plan-repriorizar/route.ts · app/plan/board/Repriorizar.tsx (el sondeo, la línea, el
toast) · app/plan/board/BoardShell.tsx (la entrada del menú) · app/plan/TodoBoard.tsx y
app/plan/board/repo-plan.ts (la capacidad; el candado del cliente) · lib/api-mako/areas/plan.def.ts y
plan.run.ts · supabase/migrations/0297 · tests/plan-repriorizar.test.ts + tests/_plan-repriorizar-hijo.ts
· *2026-10-16*

## La revisión adversarial del kanban: lo que se pisaba mientras alguien esperaba (16/10/2026)

Dos revisores (motor/datos y segundo plano/IA) revisaron la rama `plan-kanban` entera y reprodujeron
los defectos con las funciones reales contra el PostgREST de mentira. Casi todos eran el MISMO error
con distintas caras: **algo que corre en segundo plano decide con una foto vieja, o escribe su
resultado en un momento distinto del que lo hace visible, y en ese hueco alguien más escribe.**

**Lo que se vio y la causa real:**

- **«Re-priorizar todo» pisaba lo que la persona hacía mientras el modelo pensaba** (30 a 90 s por
  tanda): una prioridad fijada a mano quedaba con el número de la IA *y con el candado puesto*, se
  borraba la entrada «Movió a En proceso» y se le cambiaba el proyecto a una que ya habían sacado de la
  bandeja. Causa: `procesarTanda` decidía y escribía con lo leído ANTES de llamar al modelo. Ahora relee
  cada tarea justo antes de escribirla (lib/plan-repriorizar.ts).
- **Una reunión podía quedar «Leyendo…» para siempre.** El modal deja su fila «procesando» antes de
  leer; si el cron o el webhook ganaban el candado y no encontraban compromisos, nadie cerraba esa fila
  (`crearPropuesta` sólo la llena cuando trae tareas). Y si la lectura del modal se moría (Vercel la
  corta: no corre ni el `catch` ni el `finally`), el cron la salteaba porque `existePropuestaRef` decía
  «ya hay borrador», y la fila sólo volvía a mirar. Ahora la vacía legítima cierra esa fila
  (`resolverProcesandoSinCompromisos`), el cron no cuenta las «procesando» (el candado de lectura es el
  que decide si alguien la está leyendo) y tocar la fila llama a `extraer`, que relanza si nadie lee.
- **El cruce no llegaba al modal y el autosave lo borraba → tarjeta duplicada.** Las tres lecturas (el
  cron, la manual y la de archivos) marcaban el borrador «pendiente» y RECIÉN DESPUÉS lo cruzaban (hasta
  ~60 s); el modal tomaba las filas sin la marca, su autosave las guardaba así (con el sello ya puesto,
  así que el barrido no volvía) y «Cargar» creaba la duplicada. Ahora se cruza en memoria ANTES de
  mostrar (`cruzarTareas`) y tareas y sello van en la MISMA escritura; y una copia vieja que llega sin
  `enriquece` recupera la del servidor (`conCruceGuardado`, en el autosave y en «Agregar»).
- **«Volver a analizar» un borrador sellado no cruzaba nunca la lectura nueva**: el sello viejo seguía
  puesto. El sello ahora se escribe con las tareas que lo ganaron y se borra cuando se reemplazan.
- **Los «Deshacer» dejaban la base distinta de la pantalla.** El del teléfono reabría al 0% una tarea
  que estaba al 40% (y una «Atorada» volvía sin motivo); el del escritorio devolvía el avance con un
  SEGUNDO guardado que el server leía como «cambió el avance» (una «Por iniciar» al 40% quedaba «En
  proceso» en la base). Ahora el avance de antes viaja en el mismo mover (`trasMover(…, avance)`).
- **Una pestaña vieja del dueño reabría lo completado en otro lado** al corregirle el título (el 40% de
  la pestaña «cambió» contra el 100% de la fila). Faltaba la primera capa que el cliente ya tenía: el
  último avance que la base le confirmó a ESA pestaña (`progresoGuardado`, lo lleva `useBoard`).
- **Una pestaña que no vio arrancar el trabajo deshacía lo que escribió** (arrancado por WhatsApp, el
  teléfono u otra pestaña): sólo miraba al abrir. Ahora mira cada 45 s y al volver a la pestaña; y al
  abrir con uno corriendo ya no repinta TODOS los cambios (pisaba lo cambiado a mano después): cada
  cambio lleva su hora y se pintan los de los últimos segundos antes de montar.
- **Una tanda cortada por Vercel se repetía para siempre** con la pestaña abierta: `intentos` subía en el
  `catch`, que una función muerta no corre. Ahora el intento se cuenta al TOMAR la tanda.
- **Un 503 pasajero de Fathom cerraba la reunión como «sin compromisos».** `extraerTareasDeReunion`
  tragaba el error y devolvía vacío sin `partesFallidas`; con el webhook (lee en el minuto en que
  termina la reunión) es más probable. Ahora «Fathom no contestó» (`FathomSinRespuestaError`, después de
  sus reintentos) cuenta como un tramo fallido; un 4xx sigue siendo vacío.
- Y tres chicos: `ver_tarea_plan` decía la prioridad cruda («media» para una «Sin priorizar» del
  cliente) y no la columna; el webhook leía también para un workspace pausado (ahora `wsEnLaRonda`, la
  vara del cron); y una vuelta del cron que salía bien y vacía dejaba la reunión 14 días en «Sin leer».

**⚠️ El diagnóstico obvio que era el equivocado:** un revisor midió la ventana en que la pestaña que
arrancó el trabajo podía deshacerlo como «hasta 90 s», la duración de la llamada al Perro. En una
TANDA no: el modelo contesta ANTES de la primera escritura, y las veinte escrituras más la publicación
de los cambios son una ráfaga de segundos. Los 90 s eran reales sólo en el CIERRE del dueño, que escribía
el reparto y RECIÉN DESPUÉS juzgaba los proyectos (una llamada larga) antes de publicarlo: ahora el
reparto se publica antes del juicio.

**Las reglas que quedan** (las que gobiernan código nuevo están en AGENTS.md):

- **Lo que espera a un modelo decide contra la fila releída justo antes de escribir**, no contra la
  foto de antes de la llamada.
- **Un resultado de segundo plano se escribe en la MISMA escritura que hace visible la cosa** (cruzar
  antes de mostrar), y **un sello va con los datos que lo ganaron**: puesto con ellos, borrado cuando se
  reemplazan.
- **Toda salida de un lector cierra la fila que otro dejó esperándolo**, y el reintento no puede contar
  como «hecha» una fila huérfana: una función cortada no corre su `finally`.
- **Los intentos se cuentan al TOMAR el trabajo**, no al fallar.
- **Un Deshacer vuelve TODO lo que el cambio movió, en UNA escritura**: un segundo guardado el server lo
  lee como un cambio nuevo.
- **«No contestó» no es «vacío»**: un fallo pasajero se marca como fallo o el lector lo cierra como
  leído.

**Trampas del entorno que costaron en esta pasada:**

- **Un test que pausa un workspace SIN credenciales no prueba la vara del estado**: `wsEnLaRonda` decía
  «no» por falta de claves y la rotura «sin mirar el estado» pasaba en verde (0 de 28). Se arregló
  pausando el MISMO workspace que tiene Fathom (el ws 1, que cae a las claves del env).
- **`lib/plan-propuesta.ts` quedó guardado como BINARIO desde la tanda 3**: un `\r\r\n` en la línea 26
  (un script que escribió CRLF sobre CRLF) y git lo marca `i/-text` (`git ls-files --eol`). Editarlo
  con cualquier herramienta lo normaliza, y con `core.autocrlf=true` el `git add` lo pasaba entero a LF:
  un diff de archivo completo contra main, que lo tiene en CRLF. Se commitea con
  `git -c core.autocrlf=false add` para que quede CRLF como en main (y sin el `\r` suelto).
- **Un script de Python que lee con saltos universales y escribe con `newline=''` pasa el archivo a LF
  sin decir nada** (AGENTS.md → «El fin de línea es POR ARCHIVO»): el script de roturas de esta pasada
  lo hacía, y se corrigió para leer sin traducir y pasar las anclas al salto del archivo.

**Quedó sin hacer (con dónde vive):**

- **Soltar una tarjeta entre dos con el MISMO `orden`** la deja donde diga el desempate (`num`), no donde
  se soltó: `ordenEntre(a, a)` devuelve `a` (lib/todo-estados.ts). Los empates los crean las altas que
  no ponen `orden` (default 0 de la columna): las instancias recurrentes (lib/plan-recurrentes-generar.ts).
  Arreglarlo es renumerar la columna; es cosmético y no se hizo.
- **Las ventanas que quedan**, chicas y conocidas: el instante entre releer una tarea y escribirla (el
  mismo de `editarTarea`); la ráfaga de escrituras de una tanda más el sondeo de 4 s en la pestaña que lo
  arrancó; y hasta 45 s (o hasta volver a la pestaña) en una pestaña que no lo arrancó. La cura de fondo
  sería que el guardado de una tarjeta no mande la fila entera, que es otro trabajo.
- **El modal de una reunión ya leída (la rama de caché, `asegurarBorrador`) no cruza**: si su borrador
  no estaba sellado, el modal muestra las filas sin la marca y SU «Agregar» (`crearDesdeReunion`, que
  crea desde las filas del modal) puede duplicar. Lo cruza el barrido del cron; el «Cargar» de la lista
  ya recupera la marca (`conCruceGuardado`). Es la decisión 7 («el modal no cruza ni espera»).
- **El cruce mira también lo que está en «No cumplen tu criterio»** (`abiertasConDetalle` usa
  `progress < 100`, lib/reunion-cruce.ts): una reunión que repite un compromiso descartado amplía esa
  tarjeta en vez de crear otra. Es el mismo criterio que la carga (`mismaTarea`) y se dejó así.

**Vive en:** lib/plan-repriorizar.ts (`procesarTanda`, `avanzarRepriorizacion`, el cierre) ·
lib/plan-repriorizar-nucleo.ts (`conHora`, `cambiosDesde`, `VIGILANCIA_MS`) · app/plan/board/Repriorizar.tsx
· lib/reunion-cruce.ts (`cruzarTareas`) · lib/cruce-borrador.ts (`conCruceGuardado`) ·
lib/plan-propuesta.ts (`existePropuestaRef`, `resolverProcesandoSinCompromisos`, el sello en
`crearPropuesta` / `marcarProcesado` / `ponerProcesando`, la mezcla en `guardarRevision` y
`aplicarPropuestas`) · lib/leer-reunion-en-segundo-plano.ts · lib/importar-en-segundo-plano.ts ·
lib/reunion-auto.ts · lib/plan-fathom.ts + lib/fathom-api.ts (`FathomSinRespuestaError`) ·
lib/cron-workspaces.ts (`wsEnLaRonda`) + app/api/webhooks/fathom/route.ts · lib/todo-estados.ts
(`trasMover(…, avance)`) · lib/plan-mover.ts · app/plan/board/useBoard.ts (`deshacerMover`,
`avanceGuardado`) · lib/plan-board.ts (`guardarPlanTarea`) · lib/api-mako/areas/plan.run.ts
(`ver_tarea_plan`) · tests/plan-repriorizar.test.ts, tests/plan-kanban-server.test.ts,
tests/fathom-sin-friccion.test.ts y sus hijos · *2026-10-16*

## Tablero único: el cliente va en el BORRADOR, y el tipo de responsable se calcula al aplicar

Salió el 2026-09-17, con 08-T45 («las tareas de clientes y terceros van al Plan de Mauricio»).

**El diagnóstico obvio era el equivocado.** Parecía que alcanzaba con sumar `clienteNombre` y
`responsableTipo` a cada tarea del borrador y copiarlos en `limpiarTarea`. No alcanza: el modal de
confirmación **autoguarda las tareas del borrador cada 900 ms** con los campos que él conoce
(`aPayload`, app/plan/board/TareasRecibidasModal.tsx). Un campo por tarea que el modal no conoce se
borra la primera vez que alguien abre la pantalla, sin error. Es la quinta lista que se come campos, y
la única que además **escribe** lo que recortó.

**Actualización, mismo día:** el modal ya no se come campos. Cada fila guarda la tarea
original del borrador (`orig`) y `filaAlServer` parte de ella y pisa solo lo que la pantalla
edita (tests/modal-no-borra-campos.test.ts). El único filtro de campos que queda es el del
server, `limpiarTarea`: **un campo nuevo por tarea se agrega AHÍ y listo**. `deadline` ya
estaba afuera de la lista vieja, pero no se perdió nada: medido, 0 de 2.281 tareas de
borradores traen fecha, porque `reunion-auto` nunca la copia.

**La salida:** el cliente es de la REUNIÓN, así que va en columnas del borrador
(`plan_propuestas.cliente_nombre`, mig 0160), que ese autoguardado no toca. El tipo
mío/cliente/tercero no se guarda: se calcula al aplicar con `tipoDeResponsable`
(lib/reunion-reparto.ts), desde `esDeOtro`, el email con cuenta y si hubo cliente. Así respeta las
reasignaciones que alguien haga en el modal.

**El interruptor** es que el workspace tenga criterio (`plan.criterio` en app_settings,
lib/plan-criterio.ts). Sin él, `aplicarPropuestas` hace lo de siempre. ⚠️ No se lee con `getSetting`:
sin workspace en contexto ese cae al ws 1, que es Mauricio.

⚠️ **No prender el interruptor en el ws 1 hasta que exista la carga directa (08-T28) o el modal sepa
de este modo.** Con el interruptor prendido, el modal sigue mostrando las tabs «de otra persona» y el
botón «Agregar N» cuenta solo las mías; el server carga todas. La pantalla diría una cosa y pasaría
otra.

**Trampa para probar:** el anti-duplicado de `aplicarPropuestas` compara títulos por parecido
(`mismaTarea`, 0.7). Tres escenarios con títulos como «(prueba A) mía» / «(prueba B) mía» se ven como la
misma tarea y se AMPLÍAN en vez de crearse: «creó 0» no era el bug, era la prueba. Títulos de temas
distintos en cada escenario.

**Vive en:** lib/plan-propuesta.ts (`aplicarPropuestas`, `clienteDelBorrador`) · lib/plan-criterio.ts ·
lib/reunion-reparto.ts (`tipoDeResponsable`) · lib/reunion-auto.ts · supabase/migrations/0160 ·
*2026-09-17*

## El juez del criterio, en seco: el techo lo pone el extractor, y el juez va y viene en la regla 4

Salió el 2026-09-17, corriendo el criterio de Mauricio en seco sobre 6 sesiones suyas
(`scripts/probar-criterio.mts`: lee de ws1, juzga cobrando en ws9, no escribe nada).

**La vara:** la sesión del anexo de su documento («3 de septiembre, 1h34», 8 compromisos + 6
acuerdos internos) es la **«Junta Macario Romero» del 3/9 (recording 179438975)**. Las citas
coinciden palabra por palabra. Es la única sesión con la respuesta correcta escrita por él.

**Lo que se aprendió, y el diagnóstico obvio estaba mal en las tres cosas:**
1. **Parecía que el juez perdía compromisos. El que los pierde es el extractor.** 4 de sus 8
   compromisos nunca llegaron a ser tareas de MaKo, justo los de «Mauricio manda» (dos videos, un
   correo, la ayuda con el Excel). Un juez que solo clasifica no recupera lo que no se extrajo.
   Por eso el juez devuelve además `faltantes`, con cita obligatoria. Encontró el video del
   cuadrante 3x3 con la MISMA cita que Mauricio, pero en una corrida sí y en otra no.
2. **Parecía que el modelo inventaba citas. Eran errores de transcripción.** Su compromiso nº 3
   se caía a descartado por 2 palabras en 34: «¿sabes qué? A ver» contra «sabes que ver» y
   «chambear» contra «chandear». Ahora la cita pasa si calza en UN tramo seguido de la
   transcripción con a lo sumo 1 palabra distinta cada 10, o si cada pedazo entre «...»
   calza así. Coser dos momentos de la reunión sigue sin pasar. Con eso, 0 citas caídas en 6
   sesiones.
3. **Parecía inestabilidad del prompt. Era, en buena parte, otro modelo** (ver
   hallazgos-ia.md, «Ese respaldo también degrada…»): 18 de 19 juicios corrieron en
   flash-lite. Entre dos corridas idénticas, la respuesta a «¿es compromiso?» coincide en
   **84%** (63 de 75), pero en la sesión del anexo solo en **50%**. Esa sesión es la de más
   acuerdos internos, o sea la frontera de la regla 4. Afilar la regla del acuerdo interno
   acertó sus 4 acuerdos presentes y a cambio mandó ahí 2 de sus compromisos.

**La regla que queda:** el juez NO se conecta al pipeline con este modelo y una corrida. La
inestabilidad cae justo donde Mauricio mide, y él mismo lo anticipó: «la estabilidad se mide,
no se fuerza», por eso pide un modelo mejor y 3 corridas. Antes de conectarlo hay que
decidir el modelo y las corridas, y volver a correr esta prueba.

**Lo que abarata esa decisión:** `plan-criterio` es una feature APARTE en el catálogo y solo
corre en workspaces con criterio cargado. Ponerle Sonnet a esa feature no le cambia el modelo a
nadie más, aunque el override de modelo sea global. Faltaría habilitarla en lib/veto-claude.ts,
que hoy solo deja `closing`.

**Quedó sin hacer:** conectar el juez a `reunion-auto`, a los borradores y a `aplicarPropuestas`,
y guardar la cubeta 2 junto a la reunión. Todo espera la decisión de arriba.

**Vive en:** lib/plan-criterio-reglas.ts (la cita, el saneo, las plantillas) ·
lib/plan-criterio-juez.ts · scripts/probar-criterio.mts · tests/plan-criterio-reglas.test.ts ·
*2026-09-17*

## Los pop-ups del tablero están encadenados: sacar uno puede apagar otro de costado

Salió el 2026-09-17, con 08-T46 (que «Datos sin marcar» no se abra solo).

**La trampa:** en `BoardShell` los pop-ups que se abren solos al entrar hacen cola. La
bienvenida «MaKo cargó tareas» esperaba a que «Datos» se hubiera abierto SOLO primero
(`datosPendiente = hayImportante && !datosOff && !datosAutoRef.current`). Sacando únicamente el
auto-open de Datos, esa condición no se cumplía nunca más y la bienvenida **tampoco se abría,
sin error**: un cambio en un modal apagaba otro que nadie tocó. Antes de sacar un auto-open,
buscá quién espera por él.

**La regla que se aplicó** es la de la memoria de UI: nada de auto-abrir modales al entrar a
una pantalla; para avisar está el badge del botón. El ⚠ ahora lleva el número y no titila, y
cerrar el modal es «más tarde», sin el segundo pop-up («¿seguir recordándote?») que Mauricio no
entendía («me da miedo picarle a Maco», 8/9).

**Quedó sin hacer:** la bienvenida «MaKo cargó tareas» (`TareasCreadasModal`) todavía se abre
sola una vez por device cuando entran tareas de una fuente. Es la misma regla, pero no la pidió
nadie y Martín no la decidió. Con la carga directa de reuniones (08-T28) se le abriría a
Mauricio después de cada junta.

**Vive en:** app/plan/board/BoardShell.tsx (el efecto de la bienvenida, el ⚠ del header) ·
app/plan/board/DatosModal.tsx · *2026-09-17*

## El `pid` de un proyecto (P42) NO es su id: las tareas apuntan al SLUG (20/09/2026)

`plan_proyectos` tiene dos identificadores y son cosas distintas: **`id` es el slug**
(`crm-automtico-leads`, `arranque-del-cliente`) y **`pid` es el número VISIBLE** (P1, P42),
el que se le muestra al dueño y que `maxPid()` incrementa al crear uno nuevo. El array
`labels` de `plan_tareas` guarda el **`id`**, que es lo que `labelById()` y
`pendientesPorProy` cruzan en `BoardShell`.

Cruzar `labels` contra `pid` da **cero coincidencias sobre 643 tareas**, y eso se lee como
«ninguna tarea del board tiene proyecto» — un bug enorme, y falso. Cruzado contra `id` da
**63 de 63 labels y las 553 tareas abiertas bien asociadas**. Se estuvo a un paso de
reportarlo como hallazgo.

**La regla:** cuando una tabla tiene dos columnas que parecen identificar lo mismo, antes de
concluir nada con un cruce hay que ir a ver **cuál de las dos escribe el que consume** — acá,
`rowToLabel` en `lib/plan-board.ts` y el `t.labels.includes(id)` del render. Es la misma
familia que «contar filas no es contar cosas: cruzá por clave», pero con la trampa corrida un
lugar: la clave existía, y era la otra.

**Y el dato que sí es real, medido el 20/09 sobre el ws9:** 643 tareas, 553 abiertas, la
última cargada el **01/09**, 71 proyectos y **cero tareas con `en_prioridad`**. De esas 553,
sólo 205 caen en los once proyectos que Martín dejó vivos ese día: el 63% del trabajo cargado
pertenece a proyectos que él mismo acaba de descartar. El detalle, en
`dashboard-marketing-main/accionables-mako-20-sep.html`.

**Vive en:** lib/plan-board.ts (`rowToLabel`, `maxPid`) · app/plan/board/BoardShell.tsx (`labelById`, `pendientesPorProy`) · *2026-09-20 ~accionables-mako-20sep*

## Depurar el board: lo que se propone NO se revisa, y «ya se hizo» no es «ya no hace falta» (21/09/2026)

**Síntoma:** el board del super admin llevaba 19 días sin una tarea nueva, con 553 abiertas,
0 en prioridad y el 63% del trabajo cargado en proyectos que Martín acababa de descartar.

**El diagnóstico obvio era el equivocado.** Parecía que no se estaba cargando nada. Se estaba
cargando todo: había **51 borradores pendientes desde el 03/08**, con unas 297 tareas
propuestas y 223 cierres que nadie confirmó. El pipeline propone bien (Fathom, WhatsApp,
`cerrar-por-commits`); lo que se trabó es la REVISIÓN. Sumar productores a un tablero así no
lo actualiza: engorda la bandeja. Lo que hay que mirar primero es
`select count(*) from plan_propuestas where estado = 'pendiente'`.

**Cómo se depuró** (56 agentes): cada tarea abierta contra la sesión del 20/09 y contra el
código, y **toda baja y todo cierre** refutado por un segundo agente — 283 refutaciones, 41
no se sostuvieron y esas tareas se conservaron. Resultado: 553 → 439 abiertas (15
duplicadas fundidas, 44 obsoletas, 55 de proyectos tachados), 50 reubicadas, 118
enriquecidas, 71 proyectos repriorizados con `score_manual`. Respaldo previo en
`dashboard-marketing-main/backups/plan-ws9-antes-de-depurar-2026-09-20.json`, y el registro
de cada cambio con su motivo al lado.

Cuatro trampas que aparecieron haciéndolo:

1. **El clasificador confunde «obsoleta» con «ya se hizo».** 5 de 49 obsoletas decían en su
   propio motivo que la cosa ya estaba hecha («la línea ya se consiguió», «el reencuadre ya
   ocurrió»). Son dos veredictos distintos: lo innecesario se borra, lo hecho se CIERRA y
   deja el registro de que se hizo (`cerrar no es borrar`). Si el motivo trae un verbo en
   pasado, no es obsoleta.
2. **`enPlan` cae a `OWNER_WS` — que es el ws 1, Mauricio.** Resuelve el workspace con
   `getWorkspaceActual() ?? OWNER_WS`, y `getWorkspaceActual()` sin contexto lee la cookie.
   Desde un script tira «`cookies` was called outside a request scope» (por suerte tira, y
   no escribió nada); la salida es `runWithWorkspace(<ws del super admin>, …)`. El mismo
   supuesto viejo vive en `lib/mako-doer-acciones.ts:180`: `if (ws === OWNER_WS)` decide
   que escribe en `plan_tareas`, o sea que una tarea de Mauricio iría al board del super
   admin en SU workspace y una de Martín al board de clientes. Hoy no hizo daño (plan_tareas
   sólo tiene filas del ws 9 y no hay tareas de Martín en `experimento_tareas`), pero la
   acción `tareas_plan` sigue listada en `lib/api-mako/acciones.ts:71`.
3. **`crearPropuesta` recorta en silencio**: `cerrar` a 40 y `eliminar` a 30
   (`.slice(0, 40)`). Un lote grande de cierres hay que partirlo en varios borradores, o se
   pierde el resto sin aviso.
4. **`eliminar` en un borrador ya no hace nada.** Desde la regla «jamás preguntar bajas» se
   sacó el paso que las aplicaba, así que proponer una baja por borrador es escribirla en un
   campo que nadie lee. Una baja decidida va directa, con respaldo y registro.

**Lo que quedó SIN hacer:** los 51 borradores viejos (tienen compromisos de reuniones que
Martín quizás no vio, así que no se descartaron sin su OK); el `ws === OWNER_WS` del doer;
y tres borradores nuevos esperando confirmación (61 tareas de la sesión, 60 cierres).

**Vive en:** lib/plan-board.ts (`enPlan`) · lib/plan-propuesta.ts (`crearPropuesta`) · lib/mako-doer-acciones.ts:180 · lib/api-mako/acciones.ts:71 · *2026-09-21 ~depurar-plan-superadmin*

## Podar sin criterio de CORTE deja el tablero igual: hace falta una fecha (23/09/2026)

La poda del 21/09 sacó 114 tareas de 553 con la regla «ante la duda, conservar». Dos días
después el dueño seguía diciendo *«aún siguen habiendo muchas tareas innecesarias que pueden
ser eliminadas»* — y tenía razón: la segunda pasada, con un criterio distinto, sacó **195
más** sobre 436, o sea el 45%.

Lo que cambió no fue el modelo ni el prompt: fue que existía un **corte verificable**. El
22/09 quedaron escritas tres fases con fecha (todo lo de Mauricio al 27/09; Ads Manager,
CRM, onboarding y generadores al 07/10; landing, VSL y prospección después), y con eso
«innecesaria» dejó de ser una opinión: **una tarea sirve si mueve una de las tres fases**.
Sin esa vara, cualquier tarea se defiende sola y la poda se queda en los duplicados obvios.

- **Antes de podar, pedí el corte.** Si no hay fase ni fecha contra la cual medir, lo que se
  puede hacer es dedup y cierres; el resto es discusión.
- **El olor que delata el relleno:** once tareas llamadas «Investigar competencia: <nombre>»,
  todas con el mismo detalle calcado y cero avance en dos meses. Una plantilla repetida N
  veces es un proyecto que nadie decidió hacer.
- Y la contracara, medida: de 286 refutaciones **64 salvaron una tarea** que la poda mandaba
  a borrar — entre ellas un tablero de seguimiento que había pedido Mauricio en una llamada.
  El refutador no es prolijidad: es lo que permite cortar fuerte sin llevarse trabajo vivo.

**Lo que el dueño no puede hacer, lo hace igual con fricción, y eso lo cuenta el audio:** no
podía cambiar una prioridad (ver la regla de `score_manual` en AGENTS.md), no podía agregar
un proyecto, y el Perro le asignaba fechas y puntajes que no podía discutir. La conclusión
suya, textual: *«todo lo que hice del Perro Guardián no sirve de nada… mirá la fricción que
causa»*. Un automatismo sin interruptor no se corrige: se abandona.

**Vive en:** lib/plan-board.ts · app/plan/board/ · backups/plan-ws9-fase2-2026-09-23-registro.json · *2026-09-23 ~depurar-plan-fase2*

## Sacarle la fricción al Perro: lo que se midió al hacerlo (23/09/2026)

El pedido fue uno solo —*«que siga funcionando normalmente, solo que NO tenga fricción a la
hora de cambiar prioridad»*— y abajo había cinco cosas que no se ven leyendo el código.

### Una cascada de PROYECTOS no sirve para TAREAS, y el síntoma culpa al tablero

`fijarYDesempatar` + `sinEmpates` existen porque los 70 proyectos ocupan 100..2 **sin un
solo hueco y sin empates**: hay un norte, y fijar uno arriba corre a los de abajo. Las
tareas no funcionan así. Medido: **241 abiertas ocupan 85 números distintos, o sea 156
empatadas**. Meter una tarea por ese camino tiene dos consecuencias y las dos son malas:

- `fijarYDesempatar` le reasigna un número único a las 241 → reescribe el tablero entero
  para mover una tarjeta;
- `sinEmpates` **falla siempre** (no entran 241 en 100), así que la respuesta habría sido
  *«la re-priorización no cumple las reglas del tablero»* cada vez.

O sea: exactamente la fricción que se venía a sacar, con un mensaje que culpa al tablero en
vez de decir que la regla no aplica. **Una invariante que vale para un nivel no se hereda al
otro solo porque compartan la columna.** Hoy: proyecto → cascada con auditorías; tarea →
se escribe su número y nada más (`fijarPrioridadAMano`).

### Deshabilitar el input que tiene el foco dispara OTRO guardado

`disabled` mientras guarda parece prudencia y es un bug: el navegador le saca el foco al
input deshabilitado, eso dispara `focusout`, y el `onBlur` vuelve a llamar a guardar.
**Medido: dos POST por cada edición.** Y el segundo llegaba DESPUÉS del «devolvérsela a
MaKo», así que volvía a poner el candado que se acababa de sacar — un cambio de estado que
la persona no pidió, producido por un botón que ella ya había apretado.

Lo que lo cierra son dos cosas, no una: el valor confirmado se mueve **antes** de mandar
(no cuando vuelve), y los inputs no se deshabilitan. Ver `app/plan/board/PrioridadAMano.tsx`.

### Una medición que CAMBIA lo que mide no puede decidir

El header del tablero decidía plegar sus botones preguntando «¿desborda ahora?» y, para
volver a desplegarlos, comparaba contra una fórmula inventada (`nAcciones * 50 + 260`).
Al plegarse cambia lo que se mide, así que la pregunta de ida y la de vuelta no son la
misma: queda un ping-pong que termina donde lo agarre el último evento — y como el header
**no cambia de tamaño**, el `ResizeObserver` no vuelve a disparar nunca.

Medido achicando la ventana (que para la página es lo mismo que el zoom del navegador):
**a 880 se pasaba 8px, a 860 28 y a 780 108**, con los botones dibujados encima del filtro,
y entremedio anchos perfectos. Un resultado no monótono en el ancho es la firma de esto: no
es un umbral mal elegido, es un empate técnico entre dos reglas.

La cura es hacer la decisión **función del ancho disponible y de nada más**: sumar el
`scrollWidth` de cada hijo (su ancho natural aunque el flex lo esté aplastando) y comparar
con el `clientWidth` del header. Y tres detalles que hacían falta igual:

- **la barra se busca ADENTRO de la medición**: al plegarse ese div se DESMONTA, y una
  referencia tomada al montar mide `scrollWidth: 0` para siempre;
- **se re-mide en `window.resize`**, que es lo único que el zoom garantiza (el header mide
  100% del ancho en píxeles CSS, así que su tamaño puede no cambiar);
- y cuando ni plegado entra, el header **baja de renglón** (`flexWrap: wrap`). Es la regla
  de la casa: una barra de navegación no scrollea ni se dibuja encima.

### Un `fetch` sin `signal` no tiene tope, aunque la ruta sí lo tenga

`/api/plan-fathom` topea en 300 s (`maxDuration`), pero el `fetch` del modal no tenía
`signal`: con la conexión caída en el medio, la promesa **no resuelve nunca** y el modal
gira para siempre. Se reportó como *«elegir una reunión y ver lo que sacó se queda
esperando para siempre»*. Y la otra mitad: el cartel de «puede tardar un par de minutos,
podés cerrar» existía SOLO para los archivos subidos, así que al elegir una reunión no
había nada que dijera que se podía cerrar sin perder el trabajo.

**Todo spinner que pueda durar más de ~8 segundos tiene que decir cuánto puede tardar y qué
pasa si cerrás.** Un spinner mudo durante minutos es indistinguible de algo colgado.

### Las checklists se fueron: los pasos viven en el detalle

*«Que no existan checklists… de última un bullet point»*, y con ellas el % por tarea
(*«una tarea se completa o no se completa»*). Lo que el Perro sí sabía hacer —los pasos—
baja al `detalle` como viñetas (`pasosComoBullets`, en `lib/detalle-fusion.ts`), que además
es lo que un agente lee para EJECUTAR la tarea.

Tres cosas que se aprendieron mudando las que ya estaban (291 tareas / 1285 ítems en el
board del dueño, 289 / 1227 en el de los clientes):

- **La conversión vive en el CÓDIGO, no en el prompt.** Los prompts se sobreescriben desde
  /configuraciones: pedirle al modelo que ya no devuelva `items` deja el cambio colgando de
  una fila de `app_settings` que nadie va a mirar.
- **La mitad de las checklists eran un resumen de su propia descripción.** Pegarlas abajo
  convierte una descripción buena en una que se repite. Se de-duplica contra la PROSA, no
  solo contra las líneas — con un piso de 12 caracteres, porque sin él «Probar» matchea
  adentro de cualquier párrafo y el paso desaparece por casualidad.
- **Sacar algo de la UI sin mudar el dato es perderlo de la peor forma**: sigue en la base y
  nadie lo ve. El día que la UI dejó de dibujar las checklists, ese texto quedó invisible
  para los dos tableros a la vez (dibujan con el mismo `BoardShell`).

### El aviso que faltaba, y por qué no puede salir uno por proyecto

*«Las notificaciones de WhatsApp son demasiadas, y ninguna avisa que un proyecto está por
vencer o atrasado»*: las dos mitades se contradicen si el aviso sale por proyecto — con 70,
una mañana cualquiera son 13 mensajes. Sale **uno** con todos adentro (`plan-avisos.ts`).

**Y la huella del dedup no puede llevar los días de atraso crudos**: cambiaría sola cada
mañana (61 → 62 → 63) y el mismo aviso saldría todos los días, que es justo lo que él
reportó de los otros. Los atrasados entran por TRAMO (pocos días / semana / mes / meses):
vuelve a sonar cuando el atraso empeora de verdad o cuando cambia la lista.

### Lo que quedó SIN hacer

- **Borrar una tarea sigue pasando por el Perro.** El flujo es: cartel de «frená un
  segundo» → elegir motivo → escribir una justificación → *«que el perro decida»* (una
  llamada al modelo, 10-30 s). Es la misma fricción que se le sacó a la prioridad, en otra
  puerta, y muy probablemente lo que él reportó como «borrar no refresca la lista»: no es
  que la lista no se refresque —se refresca— es que **el borrado no llega a ocurrir**.
  Vive en `app/plan/board/EliminarModal.tsx`. No se tocó porque no estaba en la checklist
  que él validó: es una decisión de producto, no un bug.
- **Agrupar el RESTO de los avisos de WhatsApp en uno por día.** Hoy cada aviso sale
  cuando pasa. Lo nuevo (`plan-proyecto-vence`) ya nace agrupado; los demás viven en
  `lib/avisos.ts` → `emitirAviso`, y agruparlos es tocar el motor que le escribe a TODOS
  los clientes.
- **Arrastrar con el dedo.** El arrastre del Kanban es HTML5 drag-and-drop: anda con mouse
  y no con touch. En tablet el camino es el slider del detalle.

**Vive en:** lib/plan-reprio.ts · lib/plan-vencimientos.ts · lib/plan-avisos.ts · lib/detalle-fusion.ts · app/plan/board/PrioridadAMano.tsx · app/plan/board/Tablas.tsx · app/plan/board/prefs.ts · app/plan/board/BoardShell.tsx · scripts/checklists-a-bullets.mts · *2026-09-23*

## Lo último que quedaba del Perro: borrar, y el control que se dibujaba donde no podía escribir (23/09/2026)

### «Borrar no refresca la lista» no era la lista: el borrado no llegaba a ocurrir

El wizard de eliminar terminaba en *«que el perro decida»* — un POST a `/api/mako-guardian`
con `effort: 'high'`. Dos cosas, juntas, lo convertían en un callejón:

- **El veredicto «conservar» no tenía salida.** El pie de esa pantalla ofrecía un solo
  botón, «Ok, la dejo», que llama a `onClose`. No había ningún camino a borrar.
- **`decidirEliminar` caía a «conservar» cuando el JSON del modelo no parseaba**
  (`lib/mako-guardian.ts`, la rama del `catch`). O sea que **un parseo fallido cancelaba un
  borrado**, y el usuario veía exactamente lo que reportó: apretó eliminar y la tarjeta
  seguía ahí.

La regla que queda: **un guard sobre algo que la persona decidió sólo puede AVISAR, no
puede ser una puerta.** Si algún día vuelve a hacer falta un juicio antes de borrar, va
como una línea al costado («ojo: esta tarea la pidió un cliente»), nunca como condición.

Y el corolario de la limpieza: al sacar el wizard quedaban dos **prompts editables desde
/configuraciones** (`guardian.eliminar.system` y `.user`) que ya no los llamaba nadie. Un
prompt que se puede editar y no gobierna nada es peor que código muerto: es una pantalla
que miente. Se fueron con la acción y con la función.

### Un control que se dibuja en dos tableros necesita la CAPACIDAD, no el endpoint adentro

El slider de prioridad se escribió con `fetch('/api/plan-board')` adentro del componente.
Parecía inofensivo y era un bug para todos los clientes: **el mismo `BoardShell` lo monta
el tablero del dueño y el de cada cliente** (`app/plan/TodoBoard.tsx`), y esa ruta contesta
`403 solo admin`. Además `score_manual` (mig 0143) es una columna de `plan_tareas` que
`experimento_tareas` no tiene: aunque el 403 no existiera, no habría dónde escribirlo.

Lo mismo valía para tres controles más que salieron el mismo día: la casilla «ponerle yo la
prioridad» del alta, el arrastre del Kanban y el botón de dictar.

**La regla: si un componente compartido escribe, la escritura entra por el `Repo` y el que
no la implementa NO DIBUJA EL CONTROL.** Un slider que existe y sólo puede contestar 403 se
lee como que la app está rota — y esconderlo no alcanza como protección (el que decide es
el server), pero mostrarlo sin poder usarlo es un daño en sí mismo.

⚠️ **Y el caso al revés, que también apareció:** el botón de dictar pegaba a una ruta
`getSesionAdmin`. Ahí lo correcto NO era esconderlo sino **abrir la ruta**: transcribir unos
segundos de audio con la cascada gratis es algo que un cliente puede hacer en su propio
tablero, y el gasto va contra las keys de SU workspace. La pregunta no es «¿lo escondo o lo
muestro?» sino **«¿quién puede hacer esto de verdad?»**.

### Arrastrar con el dedo: cuatro trampas que el repo ya había pagado en otras pantallas

El Kanban se arrastraba con HTML5 drag-and-drop, que en touch no dispara nunca. Agregar el
camino por pointer events tiene cuatro minas, y las cuatro estaban escritas en
`docs/hallazgos-second-brain.md` sobre otra pantalla:

1. **`setPointerCapture` mata los `onClick` de adentro.** Capturar redirige todos los
   eventos siguientes —incluido el `click`— al elemento que capturó. La tarjeta tiene
   cuatro clicks adentro (abrir, el chip del proyecto, el aviso, «Completar»): se romperían
   los cuatro, en silencio. Los listeners van en `window`, armados sólo mientras dura el
   gesto.
2. **`touch-action: none` es CSS y decide ANTES de que exista el listener.** Puesto en la
   tarjeta apaga el scroll de la página sobre cada tarjeta. Lo que frena el scroll una vez
   armado el gesto es un `touchmove` con `{ passive: false }` registrado a mano — el
   `onTouchMove` de React 19 se registra pasivo y no puede `preventDefault`.
3. **Long-press, no umbral.** A ≤560px el tablero colapsa a UNA columna y el scroll
   vertical es la única navegación: un arrastre que se arme moviendo el dedo se la roba. Se
   arma a los 300 ms quieto; si el dedo se mueve más de 10 px antes, era un scroll.
4. **El click fantasma.** Después de un arrastre táctil el navegador sintetiza un `click`
   sobre donde empezó el toque: se soltaba la tarjeta, salía el pop-up de la prioridad y
   DETRÁS se abría el detalle.

Más dos guards que no son del gesto sino del producto: soltar en la MISMA columna no abre
nada (con el dedo, un movimiento de 15 px pasa todo el tiempo) y `pointercancel` limpia —
sin manejarlo, un scroll que se gana el gesto deja la columna pintada para siempre.

**Vive en:** app/plan/board/arrastre-tactil.ts · app/plan/board/EliminarModal.tsx · app/plan/board/types.ts (Repo.prioridadManual) · app/plan/board/repo-plan.ts · *2026-09-23*

## La segunda pasada de la revisión: tres cosas que la pantalla afirmaba y el código no hacía (23/09/2026)

Las tres salieron de refutar los hallazgos de la corrida de revisión sobre el trabajo del
mismo día. Las tres tienen la misma forma —**el producto ANUNCIA algo que no ocurre**— y en
las tres el diagnóstico obvio llevaba a otro lado.

### Cerrar un control por capacidad puede dejar al cliente sin NINGÚN camino

El arreglo del día anterior fue correcto: un control que escribe entra por el `Repo` y el
tablero que no lo implementa no lo dibuja. Lo que no se preguntó es **qué le queda al que
se quedó sin el control**.

Medido: con `prioridadManual` sólo en el tablero del dueño, el tablero de un cliente quedó
sin slider, **sin arrastre** (`draggable={!!board.repo.prioridadManual}`) y sin la casilla
del alta. Y el único camino que le quedaba —el botón «Cambiar prioridad», que abre la
audiencia con el Perro— es peor todavía: `reprio-proponer` y `reprio-aplicar` leen y
escriben `plan_tareas`, que en el workspace de un cliente está vacía. O sea que el botón
arrancaba, **pagaba el razonamiento del modelo** y terminaba en «no encontré eso en el
tablero».

Resultado neto: en el tablero que van a usar los 50 clientes, **la prioridad la ponía MaKo
y no había forma de cambiarla** — exactamente lo que AGENTS.md prohíbe con el pedido del
dueño adentro («toda prioridad que pone la IA tiene que poder cambiarse a mano en la
pantalla, sin debate previo y sin fricción»).

**La regla: al cerrar un control por capacidad, enumerá qué le queda a cada tablero.** Si
la respuesta es «nada», el trabajo no es esconder el control: es implementar la capacidad
donde falta. El tablero del cliente escribe el score por `/api/todo` (sin cascada y sin
candado, porque `experimento_tareas` no tiene `score_manual` y su Perro no re-puntúa lo que
ya existe: no hay nada de lo que protegerse). Y `prioridadAlPerro` se separó de
`prioridadManual`: exigir las dos ataba el slider a un candado que la mitad de los tableros
no tiene.

### El candado de la mig 0143 era cierto para los proyectos y mentira para las tareas

`recurvarPlanOwner` reparte las tareas abiertas sobre `score_base + tiempo`, y su propio
comentario decía, textual: *«NO cambia el orden que decidió nadie: preserva el ranking tal
cual está, incluida cualquier corrección a mano del dueño»*. **No miraba `score_manual` en
ninguna línea.** Así que a una tarjeta fijada a mano en 90 se le sumaba el empuje del
deadline y el castigo por quietud, y después la curva le reescribía el número.

La pantalla, mientras tanto, dice «La fijaste a mano: MaKo ya no la toca» y ofrece
devolvérsela. Las dos cosas no podían ser ciertas a la vez.

⚠️ **Y la forma en que fallaba es la peor de todas: el número se movía SOLO, de a poco,
todos los días.** No hay un momento en que alguien pueda ver que algo se rompió; hay un
tablero que un mes después no es el que se decidió, sin una sola entrada de historial que
lo explique (la recurva no escribe historial por tarjeta, a propósito).

Lo fijado a mano ahora entra al reparto con su número tal cual —para que las otras se
ordenen ALREDEDOR— y sale sin que se le escriba nada. El cron lo cuenta aparte
(`fijadas a mano (intactas)`): un candado que funciona y un candado que nadie disparó se
ven iguales si no se cuentan.

### Una tarjeta llena se comía cada ampliación, y el historial decía que la había sumado

`ampliarTareasPlanOwner` fusiona el contexto nuevo AL FINAL del `detalle` y guarda
`detalleFinal.slice(0, 6000)`. La comparación que decide si hubo cambio se hacía contra el
texto **sin recortar**, así que en una tarjeta ya clavada en 6000 caracteres:

1. el fusionado era distinto → se decidía escribir,
2. el `slice` devolvía exactamente el detalle que ya estaba → se escribía lo mismo,
3. y el historial estampaba **«MaKo le sumó contexto (no la duplicó)»**.

Medido: **6 tarjetas del tablero en el tope exacto**. Lo que se perdía es el contexto de
una reunión, que es justo lo que no se puede volver a extraer — y la tarjeta afirmaba
haberlo incorporado, así que nadie iba a ir a buscarlo.

**Las dos reglas:** el tope se aplica **antes** de decidir si hubo cambio (comparar contra
el texto sin recortar es comparar con algo que nunca se guardó), y lo que el recorte dejó
afuera **queda escrito** — con el número de caracteres, en el historial, que es donde
alguien lo lee. Cuando no entra nada, se escribe igual: un descarte sin rastro hace
indistinguibles «no llegó» de «lo tiramos nosotros».

**Vive en:** lib/plan-board.ts (`recurvarPlanOwner`, `ampliarTareasPlanOwner`) · lib/detalle-contrato.ts (`TOPE_DETALLE`) · app/plan/TodoBoard.tsx (`prioridadManual`) · app/plan/board/types.ts (`Repo.debatePrioridad`) · app/plan/board/PrioridadAMano.tsx · *2026-09-23*

## El panel de prioridad, el alta y el header: trece cosas que se vieron MIRANDO la pantalla (23/09/2026)

Todas salieron de capturas del tablero en producción, no de leer código. Vale la pena
anotarlo porque es el patrón: lo que se arregló hoy a la mañana estaba bien *como
mecanismo* y mal *como pantalla*, y eso no lo encuentra ningún test.

### Dos controles para el mismo número no son «una opción más»: son dos

El panel del detalle terminó con TRES formas de cambiar la prioridad —el slider inline, el
botón «Cambiar prioridad» (la audiencia) y el pop-up del arrastre—, cada una con su propia
cara y su propio resultado. El reporte fue literal: *«no tiene más sentido que salga el
botón o deslizable para cambiar la prioridad allí, si para eso teníamos el pop-up»*.

Quedó UNA: un lápiz pegado al número, que abre el mismo pop-up del arrastre. La audiencia no
se borró —se movió ADENTRO del pop-up, como un link—: es una opción de quien ya decidió
cambiar el número, no un botón más en el panel. **Antes de agregar un control nuevo, contá
los que ya contestan esa misma pregunta.**

### Un desplegable por sección es no tener desplegable

El mismo panel tenía dos `<details>` anidados en 236px de ancho: «Por qué este número» e
«Impacto y esfuerzo», más el cartel del candado y el botón. Tres clicks para ver tres
renglones. *«El botón de desplegable tiene que salir en el título y se debe desplegar todo.
No que cada sección tenga su desplegable.»* Uno solo, en el título del bloque.

⚠️ Y el bloque es AHORA COMPARTIDO entre tareas y proyectos (`BloquePrioridad`), a pedido
—*«revisá que funcione igualmente para tareas como para proyecto»*—. Eran dos copias del
mismo bloque y ya habían divergido: el de proyectos no mostraba el ajuste por tiempo.

### Un ícono suelto al final de una columna no se lee como «editá esto»

El pedido incluye el porqué: *«posicionalo donde realmente se vea bien, porque donde está
ahora si aparece un icono de lápiz flotando no tiene sentido»*. El lápiz va **pegado al dato
que edita**, en la misma fila del número. La posición es parte del significado del ícono.

⚠️ Y adentro de un `<summary>`, CUALQUIER click pliega. El lápiz necesita
`preventDefault` + `stopPropagation` o abre el pop-up y cierra el bloque en el mismo gesto.

### El header ya no se mide: está SIEMPRE plegado (y ésa es la lección)

La medición se reescribió **tres veces en dos días** y las tres fallaron con el zoom puesto.
La tercera era correcta *como medición* —abajo está el porqué, que sigue siendo verdad y
vale para cualquier otro layout— y el header seguía bajando los botones a un segundo
renglón. El pedido cerró el tema: *«haz que todo se colapse independientemente del zoom que
tenga, así evitamos esto. Que siempre esté colapsado»*.

**La lección es la medición, no la fórmula.** Un layout que se decide midiéndose a sí mismo
tiene que acertar en TODAS las combinaciones de ancho, zoom, tipografía cargada o no,
cantidad de botones (que cambia sola: ⚠ y ✦ aparecen y desaparecen) y vista abierta. Cada
arreglo tapaba un caso y destapaba otro, y el modo de falla es el peor posible: los botones
caen a un renglón pegado al borde izquierdo, que se lee como una pantalla rota.

Plegado siempre no tiene ningún caso. Se pierden la palabra «Plan» y el chip de progreso del
header —el progreso no se pierde: ya viajaba arriba de todo en el menú— y a cambio hay UN
renglón con cualquier zoom y en cualquier pantalla.

⚠️ **Antes de escribir un layout que se auto-mide, preguntá qué se pierde con la versión
FIJA.** Si es un rótulo y un chip, la versión fija gana: no hay medición que valga ~90 líneas
y tres reescrituras.

### Y el porqué de la medición que igual quedó escrito: `scrollWidth` no es el ancho natural de un contenedor flex

El header se mide para decidir si pliega los botones, y la medición sumaba el `scrollWidth`
de cada hijo «que es su ancho natural aunque el flex lo esté aplastando». **Eso es falso
para un contenedor cuyo contenido ENTRA.** El buscador declara `flex: 0 1 280px` con
`minWidth: 150`: cuando el flex lo achica a 150, su contenido sigue entrando, así que
`scrollWidth` devuelve 150 — el ancho YA APLASTADO. La suma decía «entra» exactamente en el
caso en que no entraba, y el header, que envuelve por regla de la casa, tiraba los botones a
un segundo renglón pegado al borde izquierdo.

Se nota primero con el zoom porque el zoom achica el viewport en píxeles CSS sin tocar nada
más. **La medición correcta es recursiva**: un contenedor flex es la suma de sus hijos más
sus gaps; una hoja es el mayor entre lo que mide, lo que declara como `flex-basis` y lo que
ocupa su contenido. Y con `getBoundingClientRect`, no `offsetWidth`: con zoom los anchos son
fraccionarios y redondear para abajo en cada hijo vuelve a inclinar la balanza hacia «entra».

### Un slider en un ALTA es pedir un juicio sobre algo que todavía no existe

Las dos altas —tarea y proyecto— preguntaban la prioridad con un slider del 1 al 100. En el
alta de proyecto encima venía con la lista de los otros 70 al lado para comparar, dentro de
un wizard de cinco pasos. *«La opción de nueva tarea debe estar con un form modular, como
antes… solo que no tenga tanta fricción. Es mejor que MaKo le asigne la prioridad y el
proyecto correspondiente y le escriba la descripción, si eso ya se hace hoy en día:
reutilizar la lógica.»*

Las dos quedaron en una pregunta, con el resto plegado detrás de «Agregar detalles». Y lo
que se reutilizó ya existía y no se estaba usando en este camino:

- **El ruteo a proyecto** (`asignarTareasAProyectos`) lo usaba la carga de una reunión desde
  agosto. El alta manual era el ÚNICO camino que no ruteaba: o elegías de una lista de 70
  antes de escribir el título, o la tarea quedaba «sin proyecto» para siempre.
- **El score de un proyecto nuevo** (`describirProyectosNuevos`) sólo corría para los
  proyectos que abría una reunión. Uno creado a mano nacía en 50 sin razón.

**Cuando una pantalla pide un dato que el sistema ya sabe deducir en otro camino, el
problema no es la pantalla: es que falta un call site.**

### Dos preferencias con la misma pregunta adentro se leen como un filtro roto

La vista de tabla y el filtro de estado estaban duplicados —`kanban.tabla` / `proyectos.tabla`,
`kanban.estado` / `proyectos.estado`—, así que cambiar de tab deshacía lo que acababas de
elegir. Eso no se lee como dos estados independientes: se lee como que el control no
funciona. Una sola preferencia para las dos tabs; los rótulos siguen siendo distintos
(Activas/Activos) porque cambia el sustantivo, no la elección.

### Y la tab se llama «tareas», con su alias

`kanban` describe CÓMO se dibuja —y desde que hay vista de tabla ni siquiera es siempre un
kanban—; lo que hay ahí son las tareas. El nombre viejo **sigue resolviendo para siempre**
(`ALIAS_VISTA`): vive en links compartidos y en favoritos, y renombrar sin redirigir es
romperlos en silencio.

### Un plegable con tres campos adentro sigue siendo tres campos

Las dos altas quedaron en una pregunta + «Agregar detalles» plegado. No alcanzó: *«no
quiero la opción de agregar detalles, ni en proyecto ni en tareas»*. Plegar reduce lo que se
VE, no lo que hay que decidir — y mientras el control exista, quien lo abre siente que le
falta completarlo. Si el sistema puede deducir un campo, el campo no se pliega: **se saca**.

Lo que se conservó y NO es un campo: `proyectoInicial` sigue llegando cuando el alta se abre
desde la cabecera de una columna o desde un proyecto. Eso es un dato del contexto, no una
pregunta.

### Crear sin esperar al modelo abre una ventana en la que la tarjeta está VACÍA

El alta dejó de esperar al Perro (eran 10-20 segundos mirando un cartel), y eso está bien.
Lo que faltaba es que ahora la tarjeta nace sin proyecto, sin descripción y con el score de
fábrica, y durante esos segundos el detalle recién abierto **se lee como que la creación
salió mal**. *«Cuando se cree un proyecto o tarea me lo tiene que abrir el detail
inmediatamente… y en el proceso, obvio el loader.»*

Van juntos y son una sola decisión: el detalle se abre en el acto —de la tarea y del
proyecto, que antes no se abría— y arriba va el estado `analizando` de `GRAMATICA`, que
**exige nombrar la fuente**: «Revisando · tu plan, para ponerle proyecto, prioridad y
detalle». Un spinner sin objeto a los diez segundos es indistinguible de una pantalla
colgada.

**Vive en:** app/plan/board/PrioridadAMano.tsx · app/plan/board/BoardShell.tsx (`BloquePrioridad`, `PerroTrabajando`, `ALIAS_VISTA`) · app/plan/board/CrearTareaModal.tsx · app/plan/board/CrearProyecto.tsx · lib/plan-board.ts (`priorizarNuevasOwner`) · *2026-09-23*


## Once correcciones más, y las tres reglas que dejaron (23/09/2026)

Tercera tanda de feedback sobre el mismo tablero, otra vez desde capturas. Lo que vale
guardar no son las once, son las tres que generalizan.

### El arrepentimiento va en el CHOKE POINT, o el próximo campo nace sin él

*«A TODOS los cambios, absolutamente todos, debería saltar el pequeño botón de
arrepentimiento que dura 5 segundos… TODOS los cambios, sea cual sea.»*

Lo pedían **tres** call sites a mano —borrar, mover de columna y completar— y los otros
~20 campos (título, detalle, fecha, quarter, avance, notas, proyecto, score) cambiaban sin
red. El toast ahora sale de `patchLog` / `patchLogExplicit` / `setScore` / `patchLabelLog`,
que es por donde pasan TODOS los cambios logueados: un campo nuevo lo hereda sin que nadie
se acuerde.

⚠️ **Y hay que sacar los que quedaron a mano, o salen dos.** `toggleDone` y `moveTo` tenían
su propio `show` encima del que ahora dispara el choke point.

⚠️ **Sólo para `actor === 'user'`.** Lo que hace MaKo no se deshace con un toast: queda en
el historial, que es donde se audita. Un toast por cada tarjeta que toca el Perro sería un
toast permanente.

### Una casilla en la primera columna de una tabla ES el control de selección

*«En la vista de tabla el botón de marcar como completada no debería salir allí, porque
pareciera que es un botón de seleccionar varias.»* Y no era un error de lectura: lo es en
Gmail, en Drive y en cualquier tabla. Lo que faltaba era que hiciera lo que parecía que
hacía — selección múltiple con acciones en lote (completar, reabrir, un deadline para
todas, moverlas de proyecto, eliminar).

Tres cosas que costó pensar y no se ven:

- **La selección es sobre lo VISIBLE**, nunca sobre el tablero entero. Con un filtro puesto,
  «seleccionar todas» son las que se ven. Seleccionar lo que no está en pantalla es cómo se
  borra de más.
- **Una acción en lote necesita UN solo deshacer.** Como cada cambio individual ya ofrece el
  suyo, una acción sobre 12 tareas disparaba 12 toasts y el último deshacía UNA. Se guarda
  el estado anterior de todas y se pisa con un toast que las revierte juntas — que es la
  unidad en la que la persona decidió.
- **Eliminar en lote PREGUNTA y no promete deshacer.** Restaurar N tareas es volver a
  crearlas en el server una por una, y a mitad de camino puede fallar dejando la mitad. Un
  botón que promete deshacer y a veces no puede es peor que uno que avisa antes.

### Un número no significa nada solo: el pop-up de prioridad muestra a los vecinos

*«Mientras voy desplazando sería increíble ver ejemplos de otras tareas o proyectos que
están cercanos a esa prioridad que le estoy poniendo.»* Es la misma regla que gobierna al
Perro —una razón tiene que comparar contra algo que EXISTE— aplicada a la persona que mueve
el slider: **un score sólo significa algo comparado con el resto del tablero**. El pop-up
recalcula los cinco más cercanos con cada movimiento, y la barra se tiñe del color de la
banda, que es el mismo de la columna del Kanban.

### Lo demás, en una línea cada uno

- **Completar subió al header del modal**, al lugar del chip «✦ MaKo ✓ optimizada», que se
  fue: decía que la tarjeta había pasado por el Perro, y hoy pasan TODAS al crearse, así que
  había dejado de distinguir nada.
- **El marcador de un `<details>` se dibuja FUERA de la caja** (`list-style-position:
  outside`), así que en una columna con padding queda a ras del borde. Va `.mk-det`, con el
  chevron como pseudo-elemento en el flujo.
- **Las barras de scroll** pasan a 9px, sin riel y con el pulgar a 20% de tinta. ⚠️ NO se
  esconden: `scrollbar-width: none` está prohibido en este repo porque elimina la evidencia
  de que hay más contenido, no el scroll. Lo que rompía el diseño era la barra nativa de
  Windows —17px, riel gris cuadrado— adentro de un modal redondeado.
- **El Quarter se deduce del deadline** cuando está vacío, y cuando NO coincide la pantalla
  **avisa en vez de corregir**: que la fecha caiga en otro trimestre puede ser un error de
  tipeo o una decisión, y quién sabe cuál es la persona.
- **El arrastre con MOUSE no tenía ningún feedback.** `levantada` era del camino táctil; el
  de mouse es HTML5 drag, que no avisa nada por su cuenta. Van los mismos tres valores del
  CRM. Con el dedo la tarjeta CRECE (el dedo la tapa); con el mouse se HUNDE (lo que se
  mueve es la miniatura del navegador, y la tarjeta es el hueco que dejó).
- **Se fue el botón «Cambiar la fecha»** y con él la pantalla de debate de fechas: la fecha
  se cambia en el selector. El Perro la sigue PROPONIENDO al crear, que es cuando sirve.
- **Las tareas terminadas del detalle de un proyecto van plegadas**, con el conteo a la
  vista: un proyecto al 80% mostraba cuatro tarjetas tachadas arriba de la única que queda.

**Vive en:** app/plan/board/useBoard.ts (`ofrecerDeshacer`) · app/plan/board/Tablas.tsx (`enLote`) · app/plan/board/PrioridadAMano.tsx (`MoverPrioridadModal`) · app/plan/board/BoardShell.tsx · app/plan/board/cuando.ts (`quarterDeFecha`) · app/globals.css (`.mk-det`, scrollbars) · *2026-09-23*


## Dictar no era lento: era el CAMINO equivocado (23/09/2026)

*«Se tarda mucho en procesar la transcripción de lo que digo, cuando en otras apps es casi
que inmediato, le voy dictando y lo va escribiendo.»*

El diagnóstico obvio —la cascada de transcripción está lenta— era el equivocado. Lo lento
era la forma: **grabar todo → parar → armar un `FormData` → subirlo → esperar a que un
modelo lo transcriba → pegar el texto**. Con eso no aparece una sola letra hasta que
terminás de hablar, y recién ahí empiezan la espera de red y la del modelo. Las apps con
las que lo compara no transcriben en un server: usan el **reconocimiento de voz del
navegador**, que corre local, escribe palabra por palabra y no cuesta nada.

- **No reemplaza al camino viejo: lo adelanta.** `SpeechRecognition` está en Chrome, Edge y
  Safari (con prefijo `webkit`) y **no** en Firefox. Si no está, el botón vuelve a grabar y
  subir, que es más lento y funciona en todos lados.
- **No se puede saber si hay permiso de micrófono sin pedirlo.** `start()` tira
  `not-allowed` cuando está bloqueado, así que el mismo respaldo cubre ese caso.
- ⚠️ **Los parciales CORRIGEN lo ya dicho, no lo continúan.** El reconocedor cambia de
  opinión a mitad de frase, así que acumular cada parcial duplica media oración. Se guarda
  el texto que había ANTES de arrancar y cada parcial reescribe el campo entero con
  `base + loDictado`.
- ⚠️ **`no-speech` y `aborted` no son errores.** Son «te callaste» y «cortaste vos»:
  mostrarlos convierte el uso normal en un cartel rojo.
- **El idioma es un campo, no una deducción.** `navigator.language` es el idioma de la
  INTERFAZ, no el que la persona habla. Va `es-MX` explícito, que es el de Mauricio y el de
  sus clientes.

## Dos pantallas que hacen lo mismo dibujadas con dos moldes distintos

*«Revisa el diseño de nuevo proyecto, está mal, en relación al diseño de tarea está feo.»*
Las dos altas hacen exactamente lo mismo —una pregunta y dos botones— y estaban dibujadas
con dos moldes: header con borde vs sin borde, textarea con caja vs campo con línea abajo, y
un pie de dos renglones que aplastaba el botón hasta partirlo en **tres** líneas («Armarlo /
con / MaKo →»).

La regla, que es la de «una cosa, un lugar» aplicada al layout: **cuando dos pantallas
responden la misma pregunta, comparten el molde**. Si una se ve peor que la otra, casi nunca
es que esté mal diseñada: es que son dos diseños.

⚠️ **Y un botón en un pie con `space-between` se parte solo.** El texto de la izquierda
crece, el botón es lo elástico, y el resultado es una palabra por renglón. Va
`whiteSpace: nowrap` y el grupo de botones con `flex: 'none'`.

## Un ícono de editar colgado de un rótulo queda flotando contra el borde

*«Mira el botón de editar dónde quedó.»* El lápiz de PROYECTOS se había puesto arriba a la
derecha del rotulito, con un `flex: 1` en el medio: quedaba pegado al borde de la columna,
lejos del chip que edita y alineado con nada.

Es la misma regla que ya había quedado escrita para el lápiz de la prioridad y que acá se
aplicó mal: **va pegado al dato que edita**. Ahora es el último elemento de la fila de
chips, que es donde se lee como «editá esto».

**Vive en:** app/plan/board/dictado-vivo.ts · app/plan/board/CrearTareaModal.tsx · app/plan/board/CrearProyecto.tsx · app/plan/board/BoardShell.tsx · *2026-09-23*


## La fricción no se saca de a una pantalla: hay que ENUMERAR todas (23/09/2026)

Se le sacó la fricción a la prioridad, al alta de tarea y al alta de proyecto, en ese orden
y en tres tandas de feedback. Y al tocar el lápiz de «Cambiar proyecto» seguía saliendo el
mismo wizard de siempre: *«al darle aún me sigue apareciendo la fricción de antes del perro
guardián»* — «Hola, soy el Perro Guardián MaKo» con su escudo, la lista, y una
justificación OBLIGATORIA de por qué movías la tarjeta.

**La regla: cuando se decide sacar un patrón, el trabajo es enumerar DÓNDE está, no
arreglarlo donde se vio.** Cada tanda tapó el lugar reportado y dejó el siguiente, y la
persona que lo reporta no tiene por qué ir encontrándolos de a uno.

Lo que se sacó es siempre lo mismo: la pantalla de presentación del Perro, los pasos, y el
campo obligatorio que pide un porqué. **El historial ya registra QUÉ se movió y QUIÉN lo
hizo**, que es lo que se necesita para auditar; el porqué, cuando importa, va en las notas.

Lo que NO se saca, porque no es fricción sino utilidad: el buscador, los filtros por familia
y el orden. Con 70 proyectos una lista plana es un scroll donde encontrar «Feature: Landing
Analyst» es leer de a uno.

### Y volvió doce días después por la puerta que esa lista no miraba: CARGAR (05/10/2026)

*«Habíamos dicho de sacar absolutamente toda la fricción al agregar tareas y me salta esto
luego de intentar agregar tareas del fathom.»* El modal de una reunión, al apretar «Agregar
6 al plan», se convertía en un wizard: «¿Para cuándo tiene que estar resuelto el aislamiento
de datos…?», con calendario y cuatro atajos.

La enumeración del 23/09 se hizo sobre el **alta a mano** (tarea, proyecto, prioridad,
cambiar de proyecto), con `grep` de `WizardShell` / `IntroBody`. Y el alta tiene **otra
puerta, que es la más usada**: lo que entra de afuera —una reunión, WhatsApp, Claude, el
botón de proyecto vacío—, que no pasa por ninguna de esas pantallas. **El patrón no era «el
Perro pregunta en el alta», era «el alta pregunta», y tenía tres caras y cuatro productores:**

| Dónde | Qué hacía |
|---|---|
| `app/plan/board/TareasRecibidasModal.tsx` | «Agregar» llamaba a la IA para armar preguntas sobre lo elegido y las mostraba de a una |
| `app/plan/revisar/[id]/RevisarPropuesta.tsx` | preguntas + repreguntas «para profundizar» + tareas extra salidas de lo contestado |
| `lib/reunion-auto.ts` · `lib/plan-proyecto-vacio.ts` · `lib/mako-doer-acciones.ts` · la API de MaKo | las GENERABAN: el cron por cada reunión, el proyecto vacío, la tool de WhatsApp y `sugerir_preguntas_tareas` |

Se fue todo junto (`d763c2b9`). El borrador nace con `notas: []` en `crearPropuesta`, que es
el choke point de todos los productores, y `preguntas` salió del TIPO del draft: el
compilador listó solo a los diez que las pasaban, incluidos tres scripts viejos. Lo cuida
`tests/alta-sin-preguntas.test.ts` (ocho guards, uno por puerta, probados rompiéndolos).

⚠️ **Lo que esas preguntas contestaban ya lo decide el Perro solo**: la fecha (mig 0114) y la
prioridad, que se cambian a mano en el detalle. Por eso no había nada que reemplazar: lo
que el modelo no pudo deducir va escrito en el `detalle` de la tarea, que es lo que el
Perro lee.

⚠️ **Y la pregunta que faltó el 23/09, y que vale para la próxima vez que se saque un patrón:
¿por cuántas PUERTAS entra lo que este patrón frena?** Un `grep` del componente encuentra las
pantallas que lo dibujan; no encuentra al cron que fabrica el contenido que esas pantallas
van a mostrar. Acá la pantalla que lo mostraba ni siquiera era del Perro: era el modal de
una reunión.

**Lo que quedó SIN hacer:**
- `PreguntaCampo` (`app/plan/board/guardian-form.tsx`) quedó **sin call site**: sus dos únicos
  usuarios eran las dos pantallas de arriba. Y de `lib/preguntas-contrato.ts`, `CONTRATO_TIPOS_PREGUNTA`
  y `JSON_PREGUNTAS` no los lee nadie y `apuntarSobre` / `ayudaDePregunta` sólo sus tests. No se
  borraron en la misma pasada para no agrandar el diff; si nadie vuelve a necesitarlos, se van.
- La columna `plan_propuestas.notas` y `plan_propuestas.revision` (el acta) siguen en la base:
  los borradores viejos las tienen llenas y nadie las lee. No hay migración.
- No se verificó en un navegador CON CLICK, porque «Agregar» crea tareas reales en producción.
  El cambio es quitar un paso (el botón llama a `aplicar()`, la misma función que corría al
  final del wizard), y el guard fija ese cableado.

**Vive en:** app/plan/board/TareasRecibidasModal.tsx · app/plan/revisar/[id]/RevisarPropuesta.tsx · lib/plan-propuesta.ts · lib/reunion-auto.ts · lib/plan-proyecto-vacio.ts · lib/mako-doer-acciones.ts · lib/api-mako/areas/plan.def.ts · lib/agente-skill.ts · .claude/skills/plan-tareas/SKILL.md · *2026-10-05*

### Cuatro reportes sobre el mismo bloque, y el diagnóstico real lo dio él en una línea

«Sigue roto lo de prioridad» se reportó **cuatro veces**. Yo arreglé, en orden: dónde estaba
el lápiz, dónde estaba el lápiz otra vez, que la banda envolvía, y que dos líneas tampoco.
El quinto mensaje fue *«y es más fácil, está ENORME la tipografía de la prioridad»* — y era
eso desde el principio.

El valor estaba en **15px bold** porque venía de cuando el bloque era un titular con su
slider debajo. Al convertirse en un campo más de la columna nadie le bajó el tamaño, así
que un campo de 236px tenía adentro un texto más grande que el título del panel. De ahí
salía todo lo demás: no entraba en la fila, envolvía, empujaba el lápiz.

**La regla: cuando algo no entra, la primera pregunta es si tiene el tamaño que le
corresponde, no cómo acomodar lo que sobra.** Tres de los cuatro arreglos fueron acomodar
piezas alrededor de un número que estaba mal.

⚠️ **Y el olor que lo delata: un elemento que quedó con el tamaño de cuando era OTRA
cosa.** El bloque cambió de titular a campo y se llevó su tipografía puesta. Cada vez que
algo se degrada de jerarquía —de pantalla a sección, de sección a fila— hay que bajarle la
escala en el mismo commit, o queda gritando en un lugar donde ya no manda.

### Un layout que entra con «ALTA» y no con «A FUTURO» está roto, no apretado

El bloque de prioridad ponía «Prioridad:» + la banda + el número + el lápiz en UNA fila,
dentro de la columna de 236px del panel. Con ALTA, MEDIA y BAJA entraba. Con **A FUTURO**
—dos palabras— el flex partía la banda en dos renglones («A» arriba, «FUTURO» abajo) y
empujaba el lápiz fuera de la vista. Se reportó tres veces como «sigue roto lo de
prioridad», y las dos primeras veces arreglé la POSICIÓN de las piezas sin ver que el
problema era que no entraban.

**El ancho de la columna es fijo y el del texto lo decide el DATO.** Cualquier layout que
dependa de que esos dos coincidan funciona con los valores de hoy y se rompe con el
siguiente — un proyecto que se llame más largo, una traducción, una banda nueva.

Apilarlo en dos renglones tampoco era la salida («se sigue poniendo en doble línea»). Lo
que lo cierra son dos cosas juntas: el tamaño correcto (arriba) y **una fila que NO envuelve
donde cada pieza declara si puede achicarse** — el rótulo es lo único elástico y se recorta
con «…»; la banda, el número y el lápiz van `flex: 'none'` y no se parten ni se van nunca.
Así no hay que acertarle a ninguna suma de anchos: lo que cede es lo que menos informa.

⚠️ **Y probá con el valor MÁS LARGO del conjunto, no con el primero.** Las cuatro bandas
están en `PLABEL` y se leen en dos segundos; el bug vivió tres tandas de feedback porque
las pruebas mentales se hicieron siempre con «ALTA».

### Un ícono de editar tiene UN lugar, y los otros dos se ven mal

El mismo lápiz se puso en los tres lugares posibles el mismo día:

1. **Colgado del rótulo con un `flex: 1` en el medio** → flota contra el borde de la
   columna, lejos de lo que edita y alineado con nada.
2. **En la fila de los chips** → el chip ocupa los 236px de la columna, así que el
   `flex-wrap` lo baja a un renglón propio, solo, debajo de todo.
3. **Pegado al rótulo, sin hueco elástico** → «PROYECTOS ✎», que es lo que quedó.

El patrón: un ícono de acción se ancla al TEXTO que nombra lo que edita, no al contenedor.
Y si el contenido de al lado puede ocupar todo el ancho, no se lo pone en su fila.

### Dos textos generados que nadie leía

*«Elimina todos los textos como "desbloquea: Habilita el escalón 4 al mantener el
accountability y el seguimiento del plan" o "Es el paso 2 y 5 del bucle de 5 pasos, y
Mauricio lo necesita para escalar" — eso no tiene sentido.»*

- **`deadlineRazon`**, la frase con la que el Perro justificaba la fecha que propuso.
  Justificaba una decisión que desde hoy se cambia en el selector sin pedirle permiso a
  nadie: era la explicación de un debate que ya no existe, ocupando tres renglones.
- **`desbloquea`**, el renglón de prosa al lado del chip del escalón 5. Un párrafo generado
  para justificar un chip de tres palabras.

Los dos **siguen en la base**, en el export y en la API: lo que se sacó es el renglón. Y la
justificación del escalón no se pierde, se mudó al `title` del chip — que es donde vive lo
que explica sin ocupar lugar.

⚠️ **El costo que queda anotado:** los dos se siguen GENERANDO, o sea que se siguen pagando
tokens por texto que ya nadie ve. Sacarlos del prompt es otra tarea, y hay que hacerla
mirando quién más los consume (el export los lleva como columna).

**Vive en:** app/plan/board/AsignarProyecto.tsx · app/plan/board/BoardShell.tsx (`EscalonChip`) · app/plan/board/PrioridadAMano.tsx (`LapizPrioridad`) · *2026-09-23*


## El deshacer que faltaba era el del camino que NO pasa por el choke point (23/09/2026)

*«Acabo de cambiar la prioridad de una tarea, no recuerdo cuál fue y NO me apareció el botón
de deshacer.»* El arreglo del día —poner el toast en `patchLog` / `patchLogExplicit` /
`setScore` / `patchLabelLog`— cubrió los ~20 campos de una tarjeta y dejó afuera justo el
único que no pasa por ahí: **`aplicarCascadaManual`**, donde terminan el slider, el lápiz y
el arrastre. O sea que quedó sin red el número que ORDENA el tablero entero.

**La regla que faltaba: poner algo en el choke point no cierra el trabajo — hay que
enumerar qué caminos NO pasan por él.** Un `grep` de quién muta `score` directo los lista;
acá era uno solo y era el que importaba.

⚠️ **Y este deshacer tiene que ESCRIBIR EN EL SERVER.** El `undo` de los demás campos es
local porque el board persiste solo; éste ya se guardó con `repo.prioridadManual`, así que
revertir sólo la pantalla sería mentir hasta el próximo F5. Se vuelve a llamar al mismo
camino con el número anterior y —si la tarjeta no estaba fijada a mano antes— se le devuelve
la decisión al Perro: **el candado lo puso este cambio, no la persona**.

⚠️ **Lo que ya se había perdido hubo que revertirlo a mano.** El #665 pasó de 93 a 85 sin
red. Se recuperó de `plan_reprios`, que guarda `score_antes` y un `ripple` con
`manualAntes` — por eso se pudo saber que el candado había que sacarlo. `score_razon` NO se
restauró con una frase inventada: la del Perro se perdió cuando se escribió «Prioridad
fijada a mano» encima, así que quedó en null y la próxima corrida la reescribe.

## Un arrastre que sólo sabe de columnas propone siempre el mismo número

*«Si agarro una tarjeta y la arrastro por abajo, el pop-up que me salta con la nueva
prioridad se debería autocolocar según dónde solté la tarea… no solo desplazar de columna,
sino de fila.»*

Soltar en cualquier lugar de «Alta» daba el representativo de la banda, así que el pop-up
abría en 88 tanto si la dejabas arriba de todo como al fondo. Ahora la posición se mide
contra las TARJETAS —cuántas quedan por encima de la mitad de su alto— y el número que
propone el slider es el **punto medio entre la de arriba y la de abajo**. Los bordes tienen
su caso: arriba de todo, dos puntos más que la primera; abajo, dos menos que la última; en
una columna vacía, el representativo de la banda, que es lo único que se sabe.

- **Sigue siendo una SUGERENCIA.** El pop-up pregunta igual: soltar dice DÓNDE, la persona
  dice CUÁNTO.
- **El hueco es lo que hace que la posición exista para quien mira.** Sin él, el número sale
  de un lugar que nadie vio. Tiene el alto de una tarjeta para que lo de abajo se corra de
  verdad, como en el CRM.
- ⚠️ **El punto medio se calcula sobre la lista SIN la tarjeta que se está moviendo.** Si se
  la deja adentro, el promedio se hace contra su propio número y la tarjeta «no se mueve».

### ⚠️ Y el que se llevó DOS rondas: no era la tarjeta, era cuánto se redibuja el tablero

*«Sigue igual… No entiendo por qué en CRM funciona bien y aquí no.»* Esa frase era el
diagnóstico: los dos tableros usan el mismo HTML5 drag-and-drop y el mismo efecto visual,
así que la diferencia tenía que estar en otro lado. Poniéndolos lado a lado:

| | CRM | Plan (roto) |
|---|---|---|
| `dragover` de la columna | `if (dragOverCol !== c.key) setDragOverCol(...)` | `querySelectorAll` + `getBoundingClientRect` de **cada** tarjeta |
| re-renders en todo el arrastre | **4** (uno por columna) | **~60 por segundo** |

Con 55 tarjetas en «Alta», eso son ~3.300 lecturas de layout por segundo y el tablero
entero (334 tarjetas) volviéndose a dibujar sin parar. Con el DOM reconstruyéndose así, el
arrastre se ve exactamente como se reportó: la tarjeta «no se agarra» y queda un fantasma
congelado donde empezó.

**Y la lección ya estaba escrita en este mismo repo**, en `arrastre-tactil.ts`: *«leer
layout en cada movimiento es lo que hace que un arrastre se sienta pegajoso»*. Ese archivo
mide los rectángulos UNA vez, al armarse el gesto, y en coordenadas de PÁGINA para que
sobrevivan al scroll. El camino del mouse se escribió meses después sin mirarlo.

⚠️ **Cuando el usuario dice «allá funciona y acá no», eso ES el método.** Poner las dos
implementaciones en dos columnas y listar las diferencias cuesta cinco minutos y contesta;
seguir teorizando sobre la que está rota puede llevar rondas — acá llevó dos, y la primera
hipótesis (la foto que el navegador saca al terminar el `dragstart`) era cierta como
mecánica del navegador y no era la causa, porque el CRM hace exactamente lo mismo y anda.

### El otro que apareció en el camino: el navegador saca la FOTO al terminar tu handler

Con el hueco ya funcionando, la tarjeta seguía sin «agarrarse»: *«aún no agarra la tarjeta,
es como que se queda invisible»*. En la captura se veía el texto duplicado y borroso encima
de la tarjeta original.

En HTML5 drag-and-drop, lo que sigue al cursor es una **foto** que el navegador toma del
elemento **cuando tu handler de `dragstart` termina** — no antes. Así que bajarle la opacidad
adentro del handler se la aplica también a la foto: la tarjeta se desvanece Y lo que
arrastrás es un fantasma transparente dibujado encima del original. El efecto que se busca
—la tarjeta se atenúa en su lugar y la copia viaja entera— necesita que el cambio ocurra
**después** de ese momento: `setTimeout(..., 0)`.

Y había un segundo error encima: `agarrada` (estado de la tarjeta) y `oculta` (lo que le dice
el Kanban) son lo mismo dicho dos veces, y sus opacidades se estaban multiplicando hasta
0.28. Es el mismo olor que «dos campos para el mismo lugar»: uno de los dos sobra.

### ⚠️ El punto medio es correcto y la tarjeta igual NO queda donde se soltó (06/10/2026)

Llegó por la sesión de Customer Success, con dos puntos. Martín, textual sobre el segundo:
*«en el plan funciona diferente, ya que la posición son PRIORIDADES, creo que el plan ya lo
hace. Si lo hace bien, que no modifique nada»*.

**1. El drop perdido sobre el hueco NO pasa en el Plan.** En el editor de etapas de CS,
cuando el hueco aparece bajo el cursor quieto, Chromium manda `dragenter` y no `dragover`, y
sin cancelarlo el drop no llega (medido ahí: 0 de 2). Arrastrado en el Plan con Playwright
contra el dev server: **6 de 6 drops llegaron al pop-up**, 4 de ellos con el hueco debajo del
cursor quieto. No se tocó nada. No se midió POR QUÉ el Plan no lo sufre; el diagnóstico de
una pantalla no se trasladó a la otra, y por eso se arrastró antes de tocar.

**2. El orden: el Plan NO lo hace bien, y leer `scoreEntre` no lo muestra.** El punto medio
entre la de arriba y la de abajo es correcto. Lo que lo rompe son los DATOS: las tareas
admiten empates a propósito (`fijarPrioridadAMano` no corre la cascada para tareas, ver
`lib/plan-reprio.ts`), y el Kanban desempata por `num`. Medido contra el tablero real (GET de
sólo lectura + réplica del orden, de `scoreEntre` y de la escritura sin cascada):

| | |
|---|---|
| tareas abiertas que compiten | 208, en **85** números distintos |
| lugares de soltar probados (tres tarjetas, num alto/medio/bajo) | 618 |
| la tarjeta NO queda donde se soltó | **472 (76%)** — siempre corrida 1, 2 o 3 lugares |
| lugares ENTRE dos tarjetas con el MISMO número | 367 — ahí no existe un entero que la deje en el medio |
| los que se arreglan sólo eligiendo mejor el número | 99 de 472 (21%) |

O sea que ahí adentro el lugar lo decide `num`, no la persona. Las dos curas de verdad
chocan con decisiones anteriores, así que **no se implementó nada y lo decide Martín**:

- **Correr a los vecinos** para hacerle lugar (cascada local): es lo que se descartó para
  tareas el 23/09, porque fijar una reescribe números ajenos.
- **Una posición manual** como desempate, como el CRM y Customer Success: es justo lo que
  él dijo que el Plan no es.

⚠️ **La trampa:** «¿soltar abajo de otra ya la deja ahí?» no se contesta leyendo el handler
ni con un tablero de prueba de cinco tarjetas sin empates — ahí da 100%. Se contesta con los
empates del tablero real.

**Vive en:** app/plan/board/BoardShell.tsx (`scoreEntre`, el `onDrop` del Kanban) ·
lib/plan-reprio.ts (`fijarPrioridadAMano`, rama de tareas) · *2026-10-06*

### Y la cura: se corren las de abajo (09/10/2026)

Martín eligió «Correr las de abajo» **dos veces**: la primera con una estimación mía («toca de
2 a 5 tareas») que resultó falsa, y la segunda con el costo medido. La regla vive en UN módulo
puro, `app/plan/board/lugar-al-soltar.ts` (`hacerLugar` y `sugerirNumero`), y la llaman los
tres: el Kanban para sugerir el número, `fijarPrioridadAMano` con el tablero recién leído, y el
repo del cliente (`TodoBoard`).

Medido contra las 184 abiertas del tablero real (561 lugares, tres tarjetas que se mueven):

| | |
|---|---|
| la tarjeta queda donde se soltó | **561 de 561** |
| alguna vecina cambia de columna | 0 |
| alguna vecina SUBE | 0 |
| vecinas corridas por soltada | p50 **1** · p90 **29** · máx **52** (un punto cada una, sin cruzarse) |

⚠️ **Una estimación que decide entre opciones se MIDE antes de implementarla.** «De 2 a 5» salió
de pensar en un grupo de empates; la ola real atraviesa la columna, porque al correr una tarjeta
un punto queda empatada con el grupo de abajo y, si su `num` es más alto que el de alguna de
ese grupo, la arrastra. Se volvió a preguntar con los números y la respuesta fue la misma — pero
ahora es una decisión con su costo a la vista, no una con el costo inventado.

Tres cosas que cuestan ver y que la regla hace a propósito:

- **El empate por `num` se aprovecha, no se ignora.** Una vecina corrida queda en el mismo número
  que la anterior si su `num` ya la deja detrás; sólo si no, un punto menos. Restar siempre un
  punto también deja la tarjeta en su lugar —por eso pasaba el test en verde— y baja la columna
  entera. Lo cazó la aserción del plan exacto de dos vecinas, no la de «queda en su lugar».
- **El número puede quedar UN punto por debajo de la de abajo.** Con la ventana `[abajo, arriba]`,
  133 de 561 lugares exigían SUBIR a la de arriba (entre dos de 62, una soltada con `num` más alto
  sólo cabe en 62 corriendo a la de arriba). Con `[abajo − 1, arriba]` ninguno. Más abajo que eso,
  el número del pop-up contradice el lugar y gana el número: no se corre a nadie.
- **Se corre la BASE igual que el número** (`baseCorrida`). El Perro re-curva cada día desde
  `score_base` (`recurvarPlanOwner`); corriendo sólo el número que se ve, la corrida de la
  mañana siguiente lo deshace y la soltada vuelve a empatar. Y el estado local del board corre
  la base también: el autosave de una tarea upsertea la fila ENTERA.
  ⛔ **CORRECCIÓN del 14/10/2026: correr la base NO lo sostenía.** La corrida reparte por
  RANKING, no desde el número de la base, y 240 de 513 lugares se deshacían igual en la primera
  corrida. Ver «La corrida del Perro deshacía el arrastre», abajo.

Y dos que encontró escribir la verificación, no el test:

- **El botón «Cambiar» del pop-up se apagaba si el número no cambiaba.** Soltar una tarjeta de 62
  entre dos de 62 no cambia el número y SÍ el lugar, así que el lugar no se podía aplicar nunca.
  Va `conLugar`. Es «un control que se apaga por una regla que ya no es la regla».
- **Del lado del server, el atajo «mismo número y ya fijada → no hago nada»** se llevaba puesto
  el mismo caso. Ahora sólo vale sin lugar y sin deshacer.

El deshacer devuelve también a las vecinas, en el server y con compare-and-set: sólo las que
todavía tienen el número que les puso el arrastre.

**Sin hacer:**

- **No se verificó con un arrastre en el navegador.** El dev server de otra sesión (puerto 3021)
  escuchaba y no contestaba, y la máquina tenía 0,6 GB libres de 16 con 42 procesos de node:
  levantar otro con Chromium era arriesgar trabarla. Para medirlo: dev server propio con las
  claves del catálogo vacías, arrastrar en `/plan/agencia` entre dos tarjetas con el mismo
  número, y contestar el `POST /api/plan-board` desde Playwright (`page.route`) para no escribir
  —con las vecinas que devuelve `hacerLugar` sobre el `GET /api/plan-board`, que es lo que haría
  el server—. El script se escribió y no sobrevive: el scratchpad de la sesión se vacía en el
  relevo de cuenta (se perdió así también la foto del tablero del 06/10).
- ~~Las TABLAS no lo hacen.~~ Hecho el 14/10/2026: ver abajo.

### La tabla de tareas, el mismo gesto (14/10/2026)

`TablaTareas` (la de la vista Tareas y la de adentro de un proyecto) manda ahora el lugar igual
que el Kanban: con la tabla por prioridad de mayor a menor, `soltarFila` arma el lugar con
`lugarEn` y el número con `sugerirNumero`, y el pop-up se lo pasa a quien escribe. Con otro
orden va el número solo, como siempre. `useArrastreFilas` entrega `resto` y `pos` para eso; la
tabla de proyectos no los usa (los proyectos no empatan).

⚠️ **Pasar el lugar no alcanzaba: la tabla desempataba por ORDEN DE LLEGADA.** El orden por
prioridad era `s * (a.score - b.score)` a secas, y `Array.sort` es estable, así que entre dos
filas con el mismo número mandaba el orden en que `visibles` llegó — que no es el `num` con el
que `hacerLugar` decide quién va delante (`vaAntes`). El server dejaba la soltada en su lugar y
la tabla la dibujaba en otro: el mismo «la solté acá y quedó allá», con el arreglo puesto. Va
`|| s * (a.num - b.num)`, el desempate del Kanban. **Antes de reusar una regla de orden en otra
vista, mirá cómo desempata ESA vista**: la regla decide la posición con un orden, y la pantalla
la dibuja con el suyo.

**Vive en:** `app/plan/board/Tablas.tsx` (`soltarFila`, `useArrastreFilas`, el `cmp` de
`TablaTareas`) · `app/plan/board/BoardShell.tsx` (los tres montajes que la arrastran) · guard en
`tests/plan-lugar-al-soltar.test.ts`, probado rompiéndolo (6 roturas, 15/1 cada una).

**Sin verificar en el navegador**, por lo mismo que el Kanban (ver arriba cómo medirlo).

### La corrida del Perro deshacía el arrastre (14/10/2026)

**Síntoma (medido, nadie lo había reportado todavía):** la tarjeta queda donde se soltó hasta la
próxima corrida del Perro (`recurvarPlanOwner`), que corre cada día y además después de cada alta
de tareas. Ahí, la vecina que el arrastre había corrido de 92 a 91 vuelve a 92 y queda encima.
Simulando la corrida con las mismas funciones puras sobre el tablero real (174 abiertas, 513
lugares donde se puede soltar): **240 de 513 se deshacían**.

**Causa real — y el diagnóstico del 09/10 era el equivocado.** El 09/10 se dio por hecho que
correr la `score_base` de las vecinas alcanzaba, porque «el Perro re-curva desde la base». No: la
corrida reparte por RANKING sobre una pirámide fija (`curveTaskScores`), así que un punto menos de
base casi nunca cambia el puesto, y el puesto devuelve el número de antes. Y la fijada entra a ese
ranking con su número visible contra la BASE de las demás, que es otra escala: **5 de 174 tareas
tienen base = número visible**, y la diferencia va de −34 a +24. Ocupa un puesto casi al azar y
corre uno a todas las del medio.

**La cura** (`respetarFijadas`, app/plan/board/lugar-al-soltar.ts, llamada desde
`recurvarPlanOwner`): una no fijada se queda del lado de la fijada en que HOY se ve, salvo que el
Perro la ponga claramente del otro lado (`MARGEN_CRUCE` = 3 puntos o más); si se queda, se le
recorta el número lo justo, con el desempate por `num` del Kanban. **513 de 513** quedan en su
lugar, el tablero sin arrastres sale idéntico, y cada corrida recorta p50 1 tarjeta, p90 2,
máximo 4, sin cambiar a ninguna de columna. El margen se midió: con 1 se deshacían 169, con 2
cuatro, con 3 ninguno.

⚠️ **Cuatro formas de «ubicar a la fijada en el orden de mañana» fallaron antes** (65, 103, 80 y
28 de 513 deshechos): cortar sobre los números de mañana, sobre el ranking del Perro, con el
desempate de hoy, y con un primer reparto por cantidad. Todas chocan con lo mismo: el ranking
distingue tarjetas que en pantalla se ven con el mismo número —y el Kanban las desempata por
`num`, muchas veces al revés—. **Lo que la persona ve y donde suelta es el número; el ranking que
no se dibuja no es una opinión que haya que respetar.** Por eso la regla es un margen sobre el
número, no un orden.

**Cómo se midió** (el script no sobrevive al scratchpad; se rehace en 15 minutos): leer
`plan_tareas` y `plan_dependencias` del ws 9 por PostgREST (sólo GET); para tres tarjetas, cada
lugar entre dos vecinas de la misma columna → `sugerirNumero` + `hacerLugar` → aplicar en memoria
como el server (fijada, vecinas con `baseCorrida`) → la corrida en memoria (`ajusteTemporal`,
`resolverDeps`, `curveTaskScores`, y ahora `respetarFijadas`) → ¿la soltada sigue entre sus dos
vecinas?

**Vive en:** `app/plan/board/lugar-al-soltar.ts` (`respetarFijadas`, `MARGEN_CRUCE`) ·
`lib/plan-board.ts` (`recurvarPlanOwner`) · tests en `tests/plan-lugar-al-soltar.test.ts`,
probados rompiéndolo.

**Sin hacer:** `puntuarPlan` (lib/mako-guardian.ts, la re-puntuación completa con el modelo)
también curva con `curveTaskScores` y no pasa por acá; no se midió si respeta a las fijadas.
- **El Perro todavía puede re-empatar al día siguiente** a una tarjeta fijada con una vecina que no
  lo está: la curva reparte números por rango y no sabe que la fijada estaba en ese lugar. No es
  nuevo —le pasa a toda tarjeta fijada a mano— y se arregla en `recurvarPlanOwner`, no acá.

**Vive en:** app/plan/board/lugar-al-soltar.ts · app/plan/board/BoardShell.tsx (`onDrop` del
Kanban, el pop-up) · app/plan/board/PrioridadAMano.tsx (`conLugar`) · lib/plan-reprio.ts
(`fijarPrioridadAMano`) · app/plan/TodoBoard.tsx · app/plan/board/useBoard.ts
(`aplicarCascadaManual`) · tests/plan-lugar-al-soltar.test.ts · *2026-10-09*

## Un borrador no puede pedir «sin fecha»: el Perro le pone fecha a toda tarea nueva (09/10/2026)

Martín pidió cargar las 7 tareas de la proyección del 04/10 que faltaban «sin fecha». Por el
camino de siempre (`crearPropuesta` + `aplicarPropuesta`) el Perro les puso fecha a las siete,
del 10 al 16/10: es lo que hace con toda alta (`priorizarNuevasOwner` puntúa Y fecha), y
`PropuestaTarea` no tiene cómo decir «ésta va sin fecha a propósito» — un `deadline` vacío se lee
como «no se sabe», que es justo el hueco que el Perro viene a llenar.

Se resolvió sacándolas después, con su entrada en el historial. **Lo que falta** es que el
borrador pueda declararlo (un `sinFecha: true` por tarea que el Perro respete, como respeta una
fecha ya puesta). Es la regla de AGENTS.md sobre la ausencia —«¿alguien lo vació a
propósito?»— del lado del alta: un vacío decidido y un vacío por llenar no se distinguen si nadie
los marca.

Y lo esperable de toda alta, que conviene anticipar cuando se le dice a alguien qué va a pasar:
el Perro re-curvó las tareas no fijadas (103 de 187) y subió el proyecto que recibió trabajo
nuevo («Feature: Cobros y planes», 80 → 81). Rutea por TEMA: dos de las siete cayeron en otro
proyecto que el propuesto.

**Vive en:** lib/plan-propuesta.ts (`PropuestaTarea`, `aplicarPropuestas`) · lib/plan-board.ts
(`priorizarNuevasOwner`) · *2026-10-09*

## Tres cosas que se sacaron porque no significaban nada

- **El chip «5 · CONSTRUIR»** del escalón. No porque el concepto esté mal: para entender
  que un proyecto es «escalón 5» hay que conocer la escalera, y la única explicación vivía
  en un `title` de hover. **Un dato que necesita un glosario para significar algo, en una
  columna de 236px, es ruido con forma de dato.** El `escalon` sigue en la base y el Perro
  lo sigue usando para priorizar.
- **«MaKo te ayuda» en un proyecto.** En una tarea tiene sentido; en un proyecto el detalle
  ya lo escribe el Perro al crearlo y en cada corrida, así que el botón ofrecía volver a
  pedir algo que ya pasó solo.
- **«Queda al lado de» sin arriba y sin abajo.** Mostraba las cinco más cercanas en
  cualquier dirección, así que con un 85 podían salir cinco de 86 y ninguna de abajo: se
  veía una lista, no una POSICIÓN. Ahora son tres arriba, la propia destacada en el medio, y
  tres abajo — y los vecinos se abren, porque comparar contra un título cortado a 40
  caracteres no alcanza para decidir si va arriba o abajo de él.

**Vive en:** app/plan/board/useBoard.ts (`aplicarCascadaManual`) · app/plan/board/BoardShell.tsx (`scoreEntre`, el hueco del Kanban) · app/plan/board/PrioridadAMano.tsx · *2026-09-23*


## El arrastre, cuarta ronda: lo que faltaba era ABRIR EL NAVEGADOR (23/09/2026)

Tres rondas de hipótesis sobre el mismo bug, las tres razonando sobre el código. La cuarta
empezó levantando el dev server y mirando el gesto con Playwright, y en diez minutos dio dos
datos que ninguna lectura iba a dar.

**Dato 1: el mecanismo YA funcionaba.** Con el arrastre en curso: hueco dibujado en la
posición correcta, tarjeta de origen atenuada en su lugar, columna destino resaltada, y al
soltar el pop-up con «Dónde queda». Todo lo que se había escrito en las tres rondas
anteriores andaba — y yo seguía tocándolo.

**Dato 2, el que explica el reporte: `document.body.scrollHeight` = 19.630 px.** Con 334
tarjetas de 138 px y una ventana de 900, se ve el **4,6%** del tablero. Mover una tarjeta a
casi cualquier lado exige scrollear, y con el botón del mouse apretado no hay rueda que
valga: **no había auto-scroll en el camino del mouse**. Agarrás la tarjeta y no la podés
llevar a ningún lado. Eso es «no funciona», y no se parece en nada a lo que yo estaba
buscando.

El CRM lo tiene desde siempre y el arrastre CON EL DEDO de este mismo tablero también
(`arrastre-tactil.ts` empuja el scroll al llegar al borde). El del mouse era el único de los
tres sin eso.

### ⚠️ Durante un arrastre nativo, el navegador congela rAF **y** los timers

Y acá el navegador contestó algo que no estaba en ningún lado. Medido, en este orden:

| Implementación del auto-scroll | Scroll tras 1,2 s en el borde |
|---|---|
| `requestAnimationFrame` | **0 px** (y el único tick llegó DESPUÉS de soltar) |
| `setInterval(…, 16)` | **0 px** |
| `window.scrollBy` dentro del `dragover` | **306 px** |

Mientras Chrome tiene activo su bucle nativo de drag-and-drop no entrega frames de animación
ni corre los timers. Lo único que sigue entregando es **`dragover`**, así que el empujón va
adentro de ese handler: cada evento mueve la página un poco, y como los eventos llegan
mientras movés el mouse, el scroll acompaña el gesto.

⚠️ **Y el timer no se deja «por las dudas».** Se probó como complemento para el caso de
quedarse quieto en el borde: aportaba 0 px durante el gesto y, al soltar, largaba los ticks
acumulados — **112 px de scroll cuando el arrastre ya había terminado**. Una pieza que no
hace nada cuando la necesitás y hace algo cuando no, se saca.

⚠️ **Y el CRM usa rAF y anda**, lo cual confunde: ahí lo que scrollea es un contenedor, el
gesto es horizontal y corto, y en la práctica nunca se notó que el auto-scroll no corre.
Copiar de una implementación que «funciona» no garantiza que la pieza copiada funcione —
garantiza que nadie la vio fallar.

### La lección de método, que es la cara

**Tres rondas equivalen a más tiempo que levantar el dev server una vez.** El costo de
verificar era: `npm run dev`, un `dev-login`, y un script de 40 líneas con Playwright
—instalado FUERA del repo para no tocar `package.json`— que arrastra una tarjeta y cuenta
qué ve. Diez minutos. Las tres rondas anteriores fueron tres deploys, tres mensajes de
«sigue igual» y un hallazgo escrito que era cierto y no era la causa.

La regla ya estaba en AGENTS.md —«si es texto que alguien tiene que ver, miralo en la
pantalla»— y la parte que faltaba es que vale igual para los GESTOS: un arrastre no se
verifica leyendo el handler.

**Vive en:** app/plan/board/BoardShell.tsx (`empujarScroll`) · *2026-09-23*


## «Se ve transparente»: dos hipótesis, las dos medidas, una sola cierta (23/09/2026)

Quinta ronda sobre el arrastre, ya con el navegador de por medio. Dos cosas que sólo se
pudieron cerrar midiendo:

### La foto del arrastre sale OPACA — la hipótesis de la ronda 1 era falsa

Instrumentando la página con un listener de `dragstart` en `window` (que corre DESPUÉS del
de React) y leyendo el estilo computado en ese instante:

```
fin-handlers : opacity 1 · transform none · opacidad efectiva 1.000 · sin filtros
microtask    : opacity 1
timeout 0    : opacity 1
```

La tarjeta está entera cuando el navegador toma la foto, así que **lo que sigue al cursor no
es transparente**. La hipótesis de la primera ronda —«el navegador saca la foto al terminar
tu handler, y `setAgarrada` la atenúa»— es cierta como mecánica y **no era lo que pasaba
acá**: React aplica el estilo un frame después, así que el snapshot siempre se toma opaco.
Costó tres rondas descartarla a ojo y diez minutos con un `getComputedStyle`.

Lo transparente era la tarjeta **original**, al 50% en su lugar. El CRM hace eso y ahí está
bien porque no tiene hueco; acá sí, y con las dos cosas juntas el mismo ítem aparecía TRES
veces: fantasma en el origen, foto en el cursor, hueco en el destino.

### ⛔ Y colapsar el nodo ORIGEN a altura cero rompe el arrastre

La salida obvia —lo que hacen Trello y Linear: la tarjeta desaparece y su lugar lo ocupa el
hueco— **no se puede acá**. Medido: con `height: 0` + `opacity: 0` en la tarjeta que se
arrastra, el arnés no pudo completar **un solo drop**; el gesto se colgaba hasta el timeout
(exit 124) mientras la misma página cargaba perfecto y el resto de las pruebas pasaban. Al
revertirlo, el drop volvió a funcionar en el primer intento.

Sacar del flujo el nodo que originó el arrastre lo deja sin salida. No es `display: none`
contra `height: 0`: es tocarle el tamaño al origen.

**Lo que quedó:** la tarjeta se queda opaca y en su lugar, marcada con un **borde** del color
primario y un `scale(1.02)`; el hueco dice a dónde va. Nada transparente en pantalla.

⚠️ **Y el hover tuvo que dejar de pintar el borde.** Pasó a ser el `outline`, porque el
borde ahora significa «ésta es la que estás moviendo» y un `onMouseEnter` lo pisaba.

**Vive en:** app/plan/board/BoardShell.tsx (`CardTile`) · *2026-09-23*


## Seis rondas sobre el mismo arrastre, y lo que lo cerró fue PREGUNTAR (24/09/2026)

«Sigue sin andar» seis veces sobre la misma interacción. Las cinco primeras respuestas
fueron hipótesis mías: la foto que el navegador saca al terminar el handler, el re-render
por píxel, el auto-scroll, la opacidad, el colapso del nodo. **Cuatro de las cinco eran
problemas reales y ninguna era la que él estaba viendo.**

Lo que lo cerró fue una pregunta con opciones concretas, contestada en un mensaje:

- **Qué se ve mal:** «la copia que sigue al cursor» **y** «la tarjeta original queda
  fantasma».
- **Qué del CRM hay que replicar:** «que la tarjeta no cambie nada».

Con eso, el arreglo es de diez líneas. Sin eso, seis rondas y seis deploys.

⚠️ **La regla operativa: al SEGUNDO «sigue igual» sobre la misma interacción, se pregunta.**
No una pregunta abierta —«¿qué ves?» ya lo había contestado él tres veces a su manera— sino
una con las lecturas posibles enumeradas, porque el que reporta no tiene por qué saber que
«transparente» puede significar tres cosas distintas en tres capas distintas.

### ⚠️ Y `setDragImage` con el nodo FUERA DEL VIEWPORT no hace nada — sin avisar

El arreglo de arriba se desplegó y el reporte volvió igual. Lo que faltaba se vio en **Chrome
real con ventana** (no en Chromium headless, que es donde había verificado todo): espiando
`DataTransfer.prototype.setDragImage` y leyendo el rectángulo del nodo que recibe:

```
antes : { w: 281, h: 138, top: -10000, left: -10000 }   ← fuera del viewport
ahora : { w: 281, h: 138, top: 0,      left: 0     }
```

El clon estaba montado en `top: -10000px`, que es la receta que circula por todos lados para
«esconderlo». **Un nodo completamente fuera del viewport no tiene capa pintada**, así que el
compositor no tiene de dónde sacar la imagen y vuelve a la del sistema operativo — la
translúcida. La llamada ocurre, no tira error, devuelve normal: **falla en silencio**.

Va en `top: 0; left: 0; z-index: -1`: el renderer lo pinta, el ojo no lo ve porque queda
detrás de todo, y vive un solo tick.

⚠️ **Y esto NO se podía ver en headless.** Las cinco verificaciones anteriores corrieron en
Chromium headless, donde el dibujo de la imagen de arrastre no pasa por el compositor del
SO. Para cualquier cosa que el SISTEMA OPERATIVO dibuje —la imagen de un arrastre, un menú
nativo, un selector de archivos— hay que verificar con `channel: 'chrome'` y `headless:
false`.

### Lo que faltaba: la imagen del arrastre la dibuja el SISTEMA OPERATIVO

La copia que sigue al cursor **no es un elemento del DOM y no la gobierna ninguna regla
CSS**. La pinta el navegador con ayuda del SO, y en Windows Chrome la dibuja
semitransparente y anclada donde se le ocurre. Eso es lo que se reportó como «se ve
transparente» en las últimas tres rondas, y por eso ninguna de mis mediciones de
`getComputedStyle` lo iba a encontrar: **el elemento estaba opaco y la copia no**.

La única forma de controlarla es `setDragImage` con un nodo propio:

- El nodo tiene que estar **en el documento y visible** en ese instante. Con `display: none`
  el navegador **ignora el pedido en silencio** y vuelve a la imagen por defecto. Va montado
  fuera de pantalla (`position: fixed; top: -10000px`).
- El fondo se toma del `getComputedStyle` del original y se fuerza opaco: si el fondo
  computado fuese transparente, la copia hereda lo que haya detrás y se ve exactamente igual
  de fantasmal que antes.
- El offset es `cursor − borde de la tarjeta`, así la copia queda **agarrada del punto donde
  pusiste el mouse** en vez de saltar a una esquina.
- Y se saca en el tick siguiente: el navegador ya tomó la foto, y dejarlo suma un nodo por
  cada arrastre.

### Y la tarjeta de origen no cambia NADA

De todo lo que el CRM hace, lo que había que replicar era eso. Cada efecto que se le fue
agregando acá era ruido que allá no existe: `opacity: .5` («se ve transparente»), después
borde de color + `scale(1.02)` + sombra («no se visualiza correctamente la animación»).

**Lo que se mueve es la copia; lo que dice a dónde va es el hueco; y la columna destino se
tiñe.** La tarjeta de origen es el lugar del que salió, no un estado que haya que comunicar
tres veces.

**Verificado en el navegador antes de subir:** `setDragImage` llamado una vez, cero clones
colgados, hueco presente, la tarjeta con `opacity: 1 / transform: none / box-shadow: none`
durante todo el gesto, y el pop-up abriendo tanto al soltar en otra columna como al
reordenar dentro de la misma.

**Vive en:** app/plan/board/BoardShell.tsx (`CardTile`) · *2026-09-24*

## La séptima ronda la cerró el dueño: «en el CRM pasa lo mismo… es un problema de diseño» (24/09/2026)

Seis rondas arreglando el arrastre del Kanban, cada una midiendo algo real, y el séptimo
reporte fue el que cambió la pregunta:

> «Sigue igual, pero me doy cuenta que en el CRM pasa lo mismo… Es un problema de diseño.»

Hasta ahí, el método de la casa —«allá funciona y acá no» es el método— estaba apuntando a
las DIFERENCIAS entre el CRM y el plan, y encontró cuatro bugs de verdad (el re-render por
píxel, el auto-scroll, la opacidad, el `setDragImage` fuera del viewport). Lo que ninguna de
esas seis rondas podía encontrar es que **el CRM también estaba mal**: era la referencia, y
una referencia no se audita. El dueño la auditó mirando las dos.

**La cura no fue arreglar el `setDragImage`: fue dejar de usarlo.** Se le pasa una imagen
VACÍA (un canvas de 1×1 transparente) y la copia que sigue al cursor es un **nodo nuestro**:

```tsx
const vacio = document.createElement('canvas'); vacio.width = 1; vacio.height = 1;
e.dataTransfer.setDragImage(vacio, 0, 0);          // el SO no dibuja nada
onAgarrar?.(t.id, { nodo: e.currentTarget, dx, dy });  // y el Kanban monta la copia
```

El Kanban clona la tarjeta, la monta en `position: fixed` con `z-index: 3000`, le fuerza el
fondo opaco y la mueve con `translate3d(...) rotate(1.5deg)` desde un `dragover` en
`document` **en captura**. Con eso la copia deja de ser una foto del sistema operativo y
pasa a ser un elemento: opaca, nítida, con la sombra que queremos y con la rotación del CRM.

Tres cosas que hacen que funcione y que costaron las rondas anteriores:

- **La copia se mueve escribiendo `transform` sobre un `ref`, NUNCA con `setState`.** Un
  `setState` por `dragover` es un re-render del tablero 60 veces por segundo — el bug de la
  ronda 2, servido de nuevo por la puerta del arreglo.
- **El listener va en `document` y en captura.** El `dragover` de las columnas no cubre los
  huecos entre ellas ni el fondo de la página: ahí la copia se queda clavada.
- **El fondo se fuerza opaco.** Si el computado del original es transparente, la copia deja
  ver el tablero por debajo y se ve igual de fantasmal que la del SO.

⚠️ **Y la lección de método, que es la que ahorra tiempo:** cuando el usuario dice «allá
funciona», eso es una **hipótesis suya**, no un dato. Vale muchísimo como punto de partida —
encontró cuatro bugs— y hay que volver a preguntarla si el reporte se repite: «¿allá se ve
BIEN, o se ve igual de mal y no te habías fijado?». Es la pregunta que en la ronda 6 no se
hizo porque el CRM ya estaba dado por bueno.

**Verificado en Chrome real con ventana:** `{"copia":true,"opacity":"1","zIndex":"3000",
"transform":"matrix(0.999657, 0.0261769, …)","fondo":"rgb(245, 247, 250)","huecos":1}`
durante el gesto, y `{"copiasColgadas":0,"popup":true}` después de soltar.

**Vive en:** app/plan/board/BoardShell.tsx (`CardTile.onDragStart`, `agarrar`) · *2026-09-24*

### Una barra de acciones en lote es UNA, la monten dos vistas o seis

La selección múltiple salió primero en la tabla (23/09) y al día siguiente hizo falta en el
Kanban. La barra se mudó a `app/plan/board/AccionesLote.tsx` **antes** de montarla en el
segundo lugar, no después: dos copias de una barra de acciones divergen a la primera acción
nueva que se agregue en una sola, y la que queda vieja es la que nadie está mirando.

Lo que la mudanza obligó a decidir, y que con una copia por vista se habría decidido dos
veces distinto:

- **Un botón para las dos direcciones, no dos.** «Elimina el "Reabrir", sería lo mismo que
  "completar" solo que si lo aprieto a la inversa se descompleta, pero no debe haber 2
  botones». Con dos, uno siempre está de más: sobre una selección de tareas abiertas
  «Reabrir» no hace nada, y **un botón que no puede hacer nada se lee como que la app está
  rota**. El sentido lo decide la selección (`todasHechas ? descompletar : completar`).
- **Un lote, un deshacer.** Ya estaba escrito como regla; acá se hereda solo.
- **Y borrar pregunta y no promete deshacer**: restaurar N tareas es recrearlas una por una
  en el server y a mitad de camino puede fallar dejando la mitad.

En el Kanban la casilla aparece **al pasar el mouse** o cuando ya hay algo elegido. En una
tabla una casilla en la primera columna es el control de selección y se espera; en una
tarjeta es un control más compitiendo con el check de completar, el chip del proyecto y el
aviso de fecha.

**Vive en:** app/plan/board/AccionesLote.tsx · app/plan/board/BoardShell.tsx · *2026-09-24*

### Un filtro que no puede devolver NADA se lee como un tablero vacío

«Comenzadas» (progreso entre 1 y 99) existía porque el avance se calculaba tildando pasos de
una checklist. Las checklists salieron del producto el 22/09, así que desde entonces el
progreso sólo vale 0 o 100 y ese filtro **seleccionaba siempre cero tarjetas**. El dueño lo
reportó él: «elimina el estado Comenzadas, como ya no hay checklist, no tiene sentido».

⚠️ **El punto que vale para cualquier feature que se saca: lo que la alimentaba se va, y lo
que la CONSUMÍA se queda.** Sacar la checklist fue una decisión tomada y bien ejecutada; el
filtro que dependía de ella no estaba en la lista porque no vive en el mismo archivo ni se
llama parecido. Y su modo de falla es mudo: no tira, no avisa, contesta «no hay nada» — que
es indistinguible de un tablero sin tareas en ese estado.

Al sacar algo, la pregunta no es sólo «¿dónde se dibuja?» sino **«¿quién MIRA el campo que
esto llenaba?»**.

**Vive en:** app/plan/board/BoardShell.tsx (`DoneFilter`, `ESTADO_OPS`) · *2026-09-24*

### Con 70 proyectos, una lista de casillas no es un filtro: es un scroll

«En el filtro de proyectos debería poder ordenar o buscar, porque si no son muchos y es
difícil». El filtro listaba los 70 proyectos como casillas planas, ordenados por score.

- **Se busca sin acentos y sin el prefijo de familia**, así «landing» encuentra «Feature:
  Landing Analyst» y escribir «feature» no devuelve los 47.
- **Los ya elegidos quedan arriba y no los filtra nada.** Si el buscador escondiera lo que ya
  marcaste, la pantalla mentiría sobre lo que está filtrando — y quitar un filtro que no se
  ve es imposible.
- **Y el orden pasó a ser uno solo para las dos entidades**: `comparar(modo, dir)` sirve a
  tareas y a proyectos, con `'score' | 'deadline' | 'creacion' | 'az'`.

⚠️ **Ordenar por deadline pone lo SIN FECHA al final en las DOS direcciones.** Una tarjeta
sin deadline no es «la más lejana»: es una que no contestó la pregunta, y mezclarla entre las
que sí tienen fecha hace que el orden deje de significar «qué vence antes». El desempate
siempre es el score: con 334 tarjetas, dos que caen el mismo día tienen que salir en un orden
estable y que signifique algo.

**Vive en:** app/plan/board/BoardShell.tsx (`comparar`, `ORDEN_OPS`, el filtro de proyectos) · *2026-09-24*

### ⚠️ La columna `deadline` es NOT NULL: «borrar la fecha» se escribe `''`, no `null`

«Elimina el deadline de los que tienen 6 o más días atrasados» — una fecha que venció hace
una semana no informa nada y empuja la prioridad con un dato muerto.

El primer intento falló **70 de 70**, todas con el mismo error:

```
null value in column "deadline" of relation "plan_tareas" violates not-null constraint
```

La columna es `text NOT NULL DEFAULT ''`, así que **la ausencia de deadline se representa con
la cadena vacía**, no con NULL. Todo el código del board ya lo sabía (`t.deadline` se compara
contra `''` en todos lados); lo que no lo sabía era el script de una sola vez.

- **Un script que toca datos de producción falla en lote o no falla**: 70 errores idénticos
  son una condición, no mala suerte — la misma regla de «¿qué comparten TODOS los que
  fallaron?», aplicada a una escritura.
- **Con respaldo antes de tocar nada.** `backups/deadlines-borrados-*.json` tiene id,
  título y fecha vieja de las 70 — en `backups/`, que está en el `.gitignore` con su porqué
  escrito: son filas de clientes, y un respaldo versionado es una fuga con historial.

Resultado medido: `TAREAS abiertas con 6+ días de atraso: 0`.

**Vive en:** el script fue de una sola vez · el respaldo, en `backups/` · la representación, en app/plan/board/cuando.ts · *2026-09-24*

### Lo que quedó SIN hacer en esta tanda

- **Los PROYECTOS con 6+ días de atraso siguen con su deadline: son 7.** La limpieza se
  corrió sólo sobre tareas, que es lo que se pidió. Un proyecto atrasado es una decisión más
  cara que una tarea atrasada (arrastra a todas las suyas), así que no se toca sin decirlo.
- **El tablero sigue midiendo 19.630px de alto con 334 tarjetas sin virtualizar.** Medido el
  23/09 y sin cambios. No rompe nada —el auto-scroll del arrastre ya está— pero es el techo
  de cualquier cosa que quiera medir el tablero entero.

## El Quarter de un proyecto, y la fecha que no decía nada (24/09/2026, segunda tanda)

### ⚠️ «09-25»: una fecha sin su plazo obliga a hacer la cuenta

La tarjeta del Kanban pintaba `t.deadline.slice(5)`. Eso es **«09-25»**: sin día de la
semana, sin año y —lo que importa— **sin decir si ya se venció**. La tarjeta del PROYECTO,
tres pantallas más allá, ya lo hacía bien desde el 23/09: `◷ vie 24 jul · 62 días
atrasado`. El dueño lo reportó señalando la que estaba bien: «me gusta este formato, que
también dice los días faltantes y atrasados».

- **Eran CUATRO renders de la misma idea** —tarjeta, tarjeta de proyecto, detalle y lista del
  detalle— compartiendo los dos helpers (`fechaConDia`, `plazoTexto`) y componiendo cada uno
  a su manera. Lo que se comparte ahora es la composición: `<LineaDeadline>` en
  `app/plan/board/piezas.tsx`. La cuarta —la lista densa del detalle— pasa `plazo={false}`,
  que es una decisión escrita y no una copia que se quedó vieja.
- **Y va en un renglón propio.** Al lado del botón «Completar» no entra: en una tarjeta de
  281px, `◷ vie 24 jul · 62 días atrasado` mide ~200px y el botón ~85. El que CEDE es la
  fecha (`flex: 0 1 auto` + ellipsis); lo que no se puede perder es el atraso, que no se
  deduce de nada.

**Verificado en el navegador:** 4 tarjetas leyendo `jue 13 ago · 42 días atrasado`, `vie 25
sep · falta 1 día`, y **cero** con el formato viejo.

**Vive en:** app/plan/board/piezas.tsx (`LineaDeadline`) · *2026-09-24*

### El Quarter existía para las TAREAS y no para los PROYECTOS — que es donde más sirve

La mig 0155 le puso `quarter` a `plan_tareas` y la 0156 a `experimento_tareas`. Los
proyectos quedaron afuera, y es donde la pregunta más sentido tiene: una tarea cae en un
trimestre casi siempre **porque su proyecto lo decidió**. Lo cierra la mig 0162.

⚠️ **Las DOS tablas en la misma migración** (`plan_proyectos` y `tarea_categorias`). El
tablero es UNO y lo montan el dueño y cada cliente: agregar el selector en el componente
compartido y la columna en una sola tabla deja a la otra mitad con un control que no puede
guardar nada. Es exactamente el bug del slider de prioridad del 23/09, que ya está escrito
tres secciones más arriba — y aun así había que acordarse.

**Vive en:** supabase/migrations/0162_proyectos_quarter.sql · lib/plan-board.ts · lib/todo.ts · *2026-09-24*

### «(este)» → «(Actual)», y dos años de ventana

El rótulo del trimestre en curso ya salía del cálculo y no de una lista escrita a mano, así
que «configuralo para los próximos años» no requería nada: el día que empieza el Q4 se muda
solo, y en 2030 también. Lo que sí cambió: la ventana pasó de 4 trimestres a **8**, porque
un proyecto se planifica más lejos que una tarea.

**Vive en:** app/plan/board/cuando.ts (`quartersElegibles`) · *2026-09-24*

### La dirección con la que arranca un orden no es la misma para los cuatro criterios

Los cuatro arrancaban en `desc`, y eso deja dos de los cuatro al revés de lo único que
alguien quiere ver: **«Alfabético» empezaba por la Z** y **«Por deadline» por lo que vence
más LEJOS**. Un orden que hay que invertir a mano apenas se elige no es un orden: es un paso
de más. Va en una tabla (`DIR_NATURAL`), no en el handler: prioridad y creación arrancan
descendente (lo más alto, lo más nuevo), deadline y alfabético ascendente.

**Vive en:** app/plan/board/BoardShell.tsx (`DIR_NATURAL`) · *2026-09-24*

### El orden de la LISTA DE UN FILTRO no es el orden del tablero

«Aún no se puede ordenar el filtro de proyectos, son muchos y cuesta buscarlos sin
ordenamiento allí.» El menú ya tenía «Ordenar» —y por eso la primera lectura fue que ya
estaba resuelto— pero eso ordena **lo que se ve en el tablero**, no la lista donde uno va a
BUSCAR. Atarlas sería reordenar el tablero entero por abrir un filtro.

- Son dos estados distintos, los dos recordados (`filtro.proyectos.orden` / `.dir`).
- **Arranca en A-Z**, no en prioridad: el trabajo de esa lista es encontrar un nombre.
- **El dato de la derecha es el del criterio activo.** Una lista ordenada por deadline que
  muestra el score no se puede leer: no hay forma de verificar con el ojo que el orden es el
  que dice ser.

**Vive en:** app/plan/board/BoardShell.tsx (`FilterMenu`) · *2026-09-24*

### Lo que quedó SIN hacer

- **57 tareas y 2 proyectos DE CLIENTES tienen deadline y siguen sin Quarter.** El backfill
  se corrió sólo sobre el tablero del dueño (`plan_tareas`, `plan_proyectos`). El código
  nuevo se los va poniendo a medida que alguien los edita, pero eso no es «arreglado»: es
  «se arregla solo si alguien los toca». Escribir en el workspace de un cliente es una
  decisión suya, no mía.
- **Un proyecto quedó con deadline vencido hace 4 días** (`Feature: General`, dom 20 sep): la
  regla es 6+ días, y un atraso reciente todavía informa.

## La auditoría del tablero entero: 70 proyectos, 241 tareas abiertas (24/09/2026)

Ocho auditores sobre los 70 proyectos con su detalle completo, ocho escépticos tumbando
hallazgos (cayeron 40), y en paralelo chequeos deterministas sobre los datos. Lo que sigue
es lo que sobrevivió a las dos vías — y lo que ninguna de las dos habría visto sola.

### ⚠️ El detalle de un proyecto CITA TAREAS POR `#`, y la poda las borra: 155 de 260 citas apuntan a la nada

El Perro escribe en el `detalle` de cada proyecto un «Qué falta» que enumera el trabajo
pendiente **citando el número de cada tarea**: «- el freemium de captación masiva con sus
límites (#391)». Es el índice que conecta lo que se habló en una reunión con lo que está en
el tablero.

El tablero se podó dos veces (553 → 241 abiertas). La numeración va del #1 al #751 y quedan
334 filas: **417 tareas borradas**. Los detalles no se tocaron. Resultado medido:

```
citas a tareas en los detalles : 260
  abiertas en ese proyecto     :  51
  ya hechas                    :  11
  en OTRO proyecto             :  43
  NO EXISTEN                   : 155   ← el 60%
```

Es la regla de **«una ruta que apunta a la nada no rompe nada, y por eso es cara»** aplicada
a ids de tareas: no falla, no avisa, y el proyecto sigue mostrando un «Qué falta» impecable
sobre trabajo que no está en ningún lado. Peor: se lee como que el tablero está completo.

⚠️ **Y la mitad que se salvó muestra la cura: el detalle ES el respaldo, si guarda el
TÍTULO.** Ocho proyectos escribieron «se sacaron del tablero, están en el respaldo del
20/09» **con los títulos completos** (`- #251 Crear una cuenta de Instagram independiente
para la marca…`): ahí el trabajo se puede reponer leyendo el propio detalle. Los otros 37
guardaron sólo el número y una descripción en prosa — recuperable, pero sólo porque el
Perro escribe prosa larga. Si hubiera citado nada más que `(#391)`, ese trabajo estaría
perdido y nadie lo sabría.

**La regla: si un texto generado cita entidades por id, o el borrado de la entidad
actualiza el texto, o el texto guarda lo suficiente para reconstruirla.** Un id suelto es
un puntero, y los punteros se cuelgan.

**Vive en:** `plan_proyectos.detalle` · lib/plan-board.ts · *2026-09-24*

### El síntoma que delata una tarea ya construida: sus vecinas le están arreglando bugs

13 tareas abiertas están hechas. La que mejor enseña a encontrarlas es **#383 «Permitir
importación y exportación de leads mediante CSV»**, abierta en «Feature: CRM» — con
**#621** (corregir el mapeo del apellido en la importación de CSV), **#622** (detectar leads
ya ganados en la importación) y **#623** (enriquecer duplicados al reimportar) abiertas al
lado. No se puede estar arreglando el mapeo de una importación que no existe.

- **La contradicción está DENTRO del mismo proyecto**, así que se encuentra ordenando las
  tareas de cada uno y leyendo los verbos: si conviven «implementar X» y «corregir X», la
  primera sobra.
- Y el caso extremo se anuncia solo: **#32 «Editor de funnel + rediseño del proceso + Fathom
  (hecho)»**, con el «(hecho)» escrito en el título, abierta desde entonces.
- ⚠️ **El tablero no se entera de lo que se construye.** Seis de las diez tareas abiertas de
  «Feature: Plan» —el proyecto #1, que vence en tres días— están construidas: los Quarters
  (#632, #681, que además son la misma), la vista por Quarter (#635), el aviso de planificar
  el siguiente (#634) y los OKRs (#680, #633). Cerrar una tarjeta es un paso manual que
  nadie hace, y el costo no es el desorden: es que la tarjeta que vence mañana está tapada
  por seis que ya no existen.

**Vive en:** el board · *2026-09-24*

### Un proyecto sin una sola tarea puntúa igual que uno con trabajo adentro

**26 de 70 proyectos no tienen ninguna tarea abierta**, y 20 no tuvieron nunca ninguna
—nacieron el 8/8 al sembrar el catálogo—. El score no lo nota: P49 «Modelos IA» está en
**87** con cero, P29 «Configuraciones» en **86** con su propio detalle diciendo «está
terminado», P20 «Offer Analyst» en **79** con «Qué ya está: nada todavía».

Y al mismo tiempo **P31 «Ads Analyst» es el ÚLTIMO de los 70 con cinco tareas abiertas**, y
P50 «WhatsApp de MaKo» está en 34 con cinco, una de ellas en 68.

Es la regla que ya estaba escrita —«un proyecto se juzga por lo que tiene ADENTRO, no por su
nombre»— con la forma que toma cuando nadie la mide: **el tercio de arriba del tablero
ocupado por proyectos vacíos empuja el trabajo real fuera de la vista**, que es justamente
lo que un tablero ordenado por prioridad viene a evitar.

⚠️ **La brecha se mide en dos números y no hace falta un modelo:** score del proyecto contra
el score de su MEJOR tarea abierta. Con 40+ puntos de diferencia, el número del proyecto no
lo sostiene nada. Salieron cinco, encabezados por «Feature: Plan» (100 contra 48) y «Vender
MaKo: Ads» (91 contra 41, y esa tarea ni siquiera es de ese proyecto).

**Vive en:** el board · app/plan/board/metodologia.ts · *2026-09-24*

### Un compromiso con fecha que no bajó a ninguna tarea con fecha no es un plan

Cuatro proyectos vencían el 27/09 con **45 tareas abiertas entre los cuatro y ninguna con
fecha propia**. En todo el tablero, **4 de 241 tareas abiertas tienen deadline**, y **56 de
70 proyectos no tienen ninguno** — incluido el segundo del tablero, «Cobros y planes» (98).

La fecha del proyecto es una intención; la de la tarea es lo que se puede perseguir. Sin la
segunda, el día que vence el proyecto no hay nada que mirar salvo el proyecto entero.

**Vive en:** el board · *2026-09-24*

### ⚠️ Una tarea puede colgar de un módulo que no existe — y el único otro lugar donde ese nombre aparece es un EJEMPLO del prompt que la escribió

**#680 «Desarrollar funcionalidad de OBJETIVOS»** dice, en su detalle: «vinculada al
**módulo de capacidad operativa**», «vincular los objetivos con los **datos de capacidad
operativa** del usuario». Ese módulo no existe en el producto. Y las únicas otras dos
apariciones de la frase en todo el repo son el MISMO ejemplo inventado, dentro del prompt
que el Perro usa para decidir si abre un proyecto:

```
lib/mako-guardian.ts:561        «Agregar un módulo de capacidad operativa EN el Focus
lib/plan-proyecto-necesidad.ts:155   Tracker» no funda «Focus Tracker»…
```

Las únicas dos tareas del tablero que nombran «capacidad operativa» son **#680 y #681**, y
las dos salieron del **mismo audio**.

⚠️ **No está medido de dónde salió la frase**, y las dos explicaciones son plausibles: que
el modelo reciclara el vocabulario de su propio ejemplo al redactar el detalle, o que el
dueño dijera «capacidad operativa» en el audio. Lo que distingue una de otra es el
transcript, y no lo miré. Lo que SÍ es seguro, y es lo accionable: **la tarea depende de un
módulo que no está construido, no está en el catálogo de proyectos y nadie lo está
haciendo.**

La sospecha vale la pena igual, porque el modo de falla es barato de tener y carísimo de
ver: **un ejemplo dentro de un prompt es texto que el modelo está leyendo cuando escribe**,
y si el ejemplo nombra cosas que suenan a features de este producto, puede volver como
DATO. Es la familia de «el fuente y lo que se sirve no son el mismo texto», del lado de la
entrada. Al escribir un ejemplo en un prompt, conviene que nombre algo que **no pueda
confundirse con una feature real** — y si aparece en la salida, ya se sabe de dónde vino.

**Vive en:** lib/mako-guardian.ts · lib/plan-proyecto-necesidad.ts · *2026-09-24*

### Lo que aprendió la corrida sobre el MÉTODO

- **Donde las dos vías coincidieron, acertaron.** Los agentes marcaron #632, #681, #635,
  #680, #633, #32, #383 y #381 como «ya hechas» leyendo sólo los títulos y los detalles;
  yo las verifiqué después contra el código (`cuando.ts`, `lib/objectives.ts`,
  `app/funnel/FunnelEditor.tsx`, `app/crm/ImportarLeadsModal.tsx`). Las ocho coincidieron.
  Cruzar un método que lee prosa con uno que lee el repo es lo que convierte un hallazgo en
  un hecho.
- **Y el escéptico ganó su lugar: tumbó 40 de 277 hallazgos.** El molde de refutar por lote
  —un escéptico por cada auditor, obligado a volver al archivo— cuesta 8 agentes más y es lo
  único que impide que «falta X» sea una opinión bien escrita.
- ⚠️ **El chequeo determinista encontró lo que ningún agente podía:** las 155 citas muertas
  salen de cruzar los `#` de 70 detalles contra los `num` de la tabla. Ningún auditor con un
  lote de 9 proyectos puede ver que el #391 que cita el suyo no existe en ninguno de los
  otros 61.

**Vive en:** *2026-09-24*

## La auditoría estaba bien medida y mal fundada (25/09/2026)

La corrida del 24/09 midió bien: 155 citas muertas, 13 tareas construidas, 26 proyectos
vacíos. Todo eso era cierto. Lo que estaba mal era **de dónde sacó la prioridad**: del
propio tablero. El dueño lo cortó en cuatro reclamos, y los cuatro eran el mismo error.

| Lo que hice | Lo que decía la fuente real |
|---|---|
| Subí «Cobros y planes» al 2º puesto creándole 5 tarjetas | El 20/09 se mató el modelo: «MaKo 47 deja de existir… USD 1.500 el grupal» (A02). Sin suscripción no hace falta pasarela — y además está bloqueada por la identidad fiscal y por conectar Stripe (A03) |
| Dejé «Landing y VSL» en el puesto 5 | Las tres fases del 22/09 la ponen en **fase 2, el 11/10**, después de todo lo técnico |
| Dejé «Feature: Plan» con 4 tareas, ninguna de las pedidas | A47 y A48 —«que no me encargue 70 tareas»— figuraban «sin tarea en el board» desde el relevamiento |
| No toqué la Oferta | «De la oferta depende todo lo demás… va antes que los otros proyectos», y su documento vencía el 24/09 |

**Dónde estaba el contexto que me faltaba, y no es el repo:**

- `accionables-mako-20-sep.html` (292 KB, raíz del proyecto): las 4 grabaciones del 20/09
  (4 h 14 min) consolidadas — **110 accionables con su cita textual**, el estado de cada uno
  medido contra el código, 53 decisiones tomadas, 20 esperando decisión, los once proyectos,
  lo tachado con su motivo y **las tres fases con fecha**. Trae marcado, accionable por
  accionable, «sin tarea en el board»: **32 de 110**. Esa es la lista de lo que falta, y no
  hace falta deducirla.
- `tareas-reuniones-mauricio-8-y-9-sep.md` (156 KB) y `reporte-reuniones-mauricio.html`.
- El criterio de extracción del cliente, en la carpeta de Descargas (ver [[criterio-extraccion-mauricio]]).
- La memoria: [[mako-once-proyectos]] tiene las tres fases y los once proyectos.

⚠️ **Y el `detalle` de un proyecto es la fuente equivocada para esto por construcción:** lo
escribe el Perro cuando el proyecto se crea o se amplía, así que congela el mundo de ESE
día. Para «¿qué falta?» sirve —enumera pendientes con su cita—; para «¿qué va primero?» no,
porque no se entera de la sesión en la que se descartó la mitad.

**Vive en:** accionables-mako-20-sep.html · `plan_proyectos.detalle` · *2026-09-25*


## Auditar un tablero: el score se ve, el avance miente, y las tarjetas que un reporte cita se borran

De auditar «Agente: Chatbot» (25/09/2026, 28 agentes) contra el reporte de accionables del 20/09.
Tres cosas que valen para cualquier auditoría del board, no solo para esa.

⚠️ **LAS 17 TARJETAS ABIERTAS DECÍAN 0% DE AVANCE. EL RANGO REAL ERA 0 A 90%.** Nadie escribe
`progress` cuando avanza: se escribe el score, y el avance queda en cero para siempre. Con eso el
tablero afirma que no se hizo nada sobre trabajo terminado hace seis semanas (una tarjeta medida
al 90%, con su commit y sus 7 tests) y el dueño no tiene forma de ver dónde está parado.
**Regla: una auditoría que solo repriorice deja la mentira intacta — hay que escribir el avance
medido, con la evidencia en el historial.**

⚠️ **NINGUNA de las 17 se pudo cerrar, y dos parecían cerradas.** Los dos «ya está hecho» que
sobrevivieron a la medición cayeron en la refutación: en un caso el arreglo cubría el síntoma
declarado pero el estado corrupto seguía vivo en dos workspaces (un paso marcado no se
re-verifica nunca), en el otro el mismo reproductor seguía roto por otro camino. **Vale el costo:
cerrar una tarjeta que sigue rota es lo que hace que el dueño deje de revisar el board.**

⚠️ **UN REPORTE QUE CITA NÚMEROS DE TAREA SE VENCE.** El reporte del 20/09 mandaba a cinco
tarjetas (#505, #55, #419, #114, #267) que la poda del 23/09 borró. De esas, dos describían
pendientes reales que quedaron sin dueño. **Regla: al borrar una tarjeta que un documento cita,
el pendiente se muda o se declara muerto en el mismo movimiento.**

**Y la inversión de prioridad más cara no la encontró ninguna medición por tarjeta: la encontró
correr la CADENA.** 17 agentes midieron una tarjeta cada uno y ninguno vio que la última de la
lista (score 3 sobre 100) era el portón de todas las demás: el clasificador es fail-closed y sin
escenarios cargados el chatbot no contesta nada. Lo vio el crítico de completitud, que preguntó
qué pasa de punta a punta cuando un lead escribe. **Regla: además de medir cada ítem, alguien
tiene que recorrer el camino completo del usuario.**

*(La corrida quedó en `docs/hallazgos-comunicacion.md`; acá va solo lo que se aprendió del
método.)*

## El orden de 70 proyectos no se ve si no cruza una BANDA (25/09/2026)

El dueño dictó las tres fases en los audios del 22/09 y el tablero se ordenó por ellas dos
veces. Las dos veces volvió a reportar lo mismo: **«la Fase 1 NO debería incluir absolutamente
todo lo técnico; desde Feature: Conocimientos en adelante eso no se va a realizar ahora»**.

El orden estaba bien y no se veía. `prioFromScore` (`app/plan/board/types.ts:395`) parte el
tablero en **ALTA ≥ 75 · MEDIA ≥ 50 · BAJA ≥ 25 · A FUTURO < 25**, y el Kanban agrupa por eso.
Con 40 proyectos arriba de 75, ordenarlos entre sí de 99 a 76 no cambia **ni una** columna: el
dueño sigue viendo la fase 1 llena de cosas que no entran en la fase 1.

**La regla: si la pantalla agrupa por bandas, un reordenamiento que no mueve a nadie de banda
es invisible — y para quien mira, indistinguible de no haber hecho nada.** El corte se escribe
en la banda: ALTA quedó con **exactamente los 15 proyectos de esta etapa** (100 → 86) y los diez
números entre 85 y 75 quedaron **vacíos a propósito**, para que la columna se termine ahí.
Conocimientos, Infraestructura, Dashboard, Integraciones y Seguridad bajaron a MEDIA; lo tachado
en las sesiones del 20 y el 25/09 bajó a A FUTURO con su motivo escrito.

⚠️ **Y el orden a mano se escribe DESPUÉS de crear tareas**, porque `aplicarPropuesta` re-curva
los 70 proyectos (ya está arriba, en AGENTS.md). Acá la secuencia que funcionó fue: fusionar →
crear → dejar correr al Perro → escribir la escalera entera de una vez. **Escribir la escalera
ENTERA, no empujar de a uno:** el resolvedor de empates de la primera versión caminaba un
proyecto de vuelta a su score viejo (P17: 81 → 88 → 81) porque cada nudge chocaba con el
siguiente.

**Vive en:** `app/plan/board/types.ts` (`prioFromScore`) · `plan_proyectos.score` · *2026-09-25*

## Dos proyectos del mismo tema, y el que no tiene trabajo adentro parte la respuesta en dos

Reportado así: **«Hay 2 proyectos de CRM, uno tiene una sola tarea»**. Eran «Feature: CRM» (24
abiertas) y «Agente: CRM automático» (0 abiertas, 1 tarea y hecha). Ninguno de los dos estaba
mal creado —el motor de reglas ES otra cosa que el CRM—, y aun así el tablero no puede
contestar «¿dónde está lo del CRM?» en un solo lugar.

El mismo patrón, dos veces más: «Agente: Lector de reuniones» (1 abierta, el pipeline de Fathom)
contra «Feature: Plan», que es donde vive el compromiso con fecha; y «Feature: Sales Email» (1)
contra «Feature: Email» (1), dos proyectos de email sin empezar.

**La regla: un proyecto que comparte tema con otro y no tiene trabajo abierto adentro no es un
proyecto, es una faceta.** Se funde: las tareas se MUDAN al que tiene la fecha, y el vacío queda
tachado al fondo con su motivo — nada se borra. Y la contraparte, que es la que evita fusionar
de más: «Feature: WhatsApp» y «Feature: WhatsApp de MaKo» **no** se tocan, porque uno es el canal
del cliente y el otro la línea propia; los dos tienen trabajo abierto distinto.

⚠️ **El umbral que NO sirve para esto es contar tareas.** Ya está medido arriba en este mismo
documento: 9 proyectos con cero tareas y 14 con una sola son legítimos. Lo que decide es
**tema compartido + cero trabajo abierto**, las dos cosas juntas.

**Vive en:** `lib/plan-proyectos-catalogo.ts` · `plan_proyectos` · *2026-09-25*

## «Ya está hecho» en un detalle tiene DOS formas, y sólo una se cierra

Buscar las tarjetas abiertas cuyo detalle se declara terminado parece un `grep` y no lo es.
Medido sobre las 256 abiertas del ws9:

```
detalle que contiene «ya existe / ya está hecho / nada nuevo»  : 64   ← el grep ingenuo
el PRIMER párrafo de «Qué hay que hacer» lo declara            : 20
…y de esas, sin trabajo abierto: se cierran                    : 10
…que declaran una MITAD hecha y otra pendiente: se quedan      : 10
```

Los dos filtros que sobran son distintos y los dos importan:

- **Adentro del detalle, «ya existe» casi siempre nombra una pieza que la tarea va a REUSAR**,
  no a la tarea. «El canal de aviso ya está construido: sumar el aviso de baja es agregar una
  entrada al catálogo» describe trabajo **pendiente**. Por eso la señal se lee en el primer
  párrafo de «Qué hay que hacer», que es donde el que escribió el detalle puso su veredicto.
- **Y la mitad hecha no se cierra.** «La mitad principal YA ESTÁ HECHA: falta el último lector
  de la setting vieja» (#171), «el corte por insistencia YA ESTÁ HECHO pero en producción no
  puede dispararse» (#360). Cerrarlas es exactamente lo que hace que el dueño deje de mirar el
  tablero.

**Lo que costaba no cerrarlas no era el desorden: era el lugar.** #352 («la lógica de espera de
confirmación») estaba en **score 90**, segunda del proyecto más alto del tablero, sobre algo que
su propio detalle declaraba implementado con el archivo y la línea al lado. Una tarjeta hecha en
el puesto 2 tapa trabajo real; una tarjeta hecha en el puesto 200 no molesta a nadie. **Al
barrer, ordená por el score del PROYECTO: ahí están las caras.**

**Vive en:** `plan_tareas.detalle` · `backups/_cerrables.mjs` · *2026-09-25*

## El barrido de las 246 abiertas contra las tres fases (25/09/2026, 59 agentes)

21 revisores (uno por proyecto de fase, lotes para el resto) → 20 refutadores adversariales
contra el código → 3 críticos de completitud → y una segunda pasada de 15 que juzgó los
títulos, salvó lo que midió cada refutación y validó los faltantes. Lo que sigue es lo que
ninguna de las vías habría visto sola.

### ⚠️ Refutar una REESCRITURA con la vara de un CIERRE tumba 80 de 87

El refutador salió con el default correcto para un cierre: «por default `refutado: true`; sólo
`false` cuando fuiste al código y confirmaste que no queda nada». Con esa vara se le pasaron
dos clases de afirmación distintas:

- **cerrar** = «el trabajo ya está hecho». Afirmación fuerte, cara de revertir, default duro.
- **reescribir** = «el título promete otra cosa de la que queda». Afirmación débil, reversible
  — y la pregunta ni siquiera es «¿está hecho?».

Resultado medido: **80 de 87 refutados**, incluidos 54 de 57 títulos. Con eso el barrido
quedaba en nada. Una tercera pasada con la pregunta correcta —«si el dueño lee SÓLO el título
en el Kanban, ¿entiende lo que le queda?»— devolvió **35 reescrituras, 22 títulos intactos y
CERO cierres nuevos**. O sea: el refutador tenía razón en lo suyo (no había más nada que
cerrar) y estaba contestando otra cosa en el resto.

**La regla: el default de un refutador es parte de la PREGUNTA, no de su rigor.** Un refutador
por clase de afirmación, y si un lote mezcla dos clases, se parte. El síntoma que lo delata en
dos minutos: una tasa de refutación arriba del 80% no es rigor, es una vara mal puesta.

⚠️ **Y el trabajo del refutador no se tira con su veredicto.** Las 26 refutaciones de cierre
que sobrevivieron traían la medición más cara de toda la corrida (archivo:línea, la puerta que
falta, el caso que no cubre) y eso vivía sólo en el transcript de un agente. Se convirtieron
en una nota dentro de cada tarjeta. Cosechar no es guardar el veredicto: es guardar lo que se
midió para llegar a él.

**Vive en:** `plan_tareas.detalle` · *2026-09-25*

### Un agente no distingue «inventado» de «decidido hace una hora»

Ya estaba escrito que un subagente no distingue «nunca estuvo roto» de «se arregló hace una
hora». Falta la otra mitad, y es peor porque suena a integridad: **tampoco distingue una
decisión del dueño de esta mañana de una invención tuya.**

El refutador de la #328 escribió, textual: *«La cita del auditor («el post-agenda con audios es
un BLOQUE APARTE fuera del 27/09») no aparece en ninguna parte del repo: grep sobre docs/ da
CERO resultados para "BLOQUE APARTE". Es una afirmación, no evidencia.»* Tenía razón sobre el
repo y estaba equivocado sobre la autoridad: esa frase salía de una respuesta que Martín había
dado esa misma mañana, y vivía en el contrato del scratchpad, no en `docs/`.

- **El contrato viaja con su PROCEDENCIA**, no sólo con su contenido: qué audio, qué fecha, qué
  pregunta contestó el dueño. Sin eso, un agente escrupuloso lo trata como una alucinación.
- **Y una refutación que ataca el contrato se REPORTA, no se ejecuta.** Es la regla del panel
  al que le preguntás por una decisión ya tomada, vista desde el otro lado: lo que el dueño
  decidió es una restricción del problema.

**Vive en:** *2026-09-25*

### El documento que escribís para los agentes después te gobierna a vos

Al preguntarle a Martín qué hacer con los proyectos fuera de fase, enumeré 24 y entre ellos
«VSL Generator». Él contestó «todos a BAJA». Más tarde, leyendo el audio del 22/09 —*«falta
nomás lo que me había dicho Leila, que es el Generator, que es el guión»*— subí ese mismo
proyecto a ALTA, con su porqué bien escrito.

**Lo cazó el propio barrido, citándome:** *«"VSL Generator" está nombrado textual en la lista de
los 24 a BAJA»*. Un agente leyendo el contrato encontró la contradicción entre lo que yo había
preguntado y lo que yo había hecho después.

**La regla: tu propio documento de contexto es una fuente, y te aplica.** Si lo contradecís,
alguien lo va a citar — y si no lo cazan, queda una decisión del dueño revertida en silencio
por una lectura tuya. Lo que se hace con la duda es preguntarla, no resolverla: la tarjeta
quedó creada, bajada de prioridad y con la pregunta escrita adentro.

✅ **Y el final confirma la regla por el lado barato: la pregunta costó una línea y contestó
que SÍ** («subilos, los dos entran en la 1.2»). O sea que mi lectura del audio era correcta **y
aun así estaba mal hacerla valer sin preguntar**: el costo de preguntar fue un renglón, y el de
no preguntar habría sido una decisión suya revertida sin que se entere. Lo que decide no es
quién tenía razón, es quién decide.

Al subirlos apareció la otra mitad, que subir un proyecto NO resuelve: adentro quedan tarjetas
puntuadas con la premisa vieja, y una prometía cuatro veces más de lo que la fase nombra. La
fase dice «el Generator, que es el GUIÓN»; la tarjeta decía «Creador de VSL en 4 fases» (guión →
stock → gráficos → avatar), o sea un editor de video que ninguna fase pide. **Mover un proyecto
de banda es la mitad del trabajo: la otra es acotar lo que tiene adentro a lo que la fase
nombra** — y lo que se saca del alcance se escribe DENTRO de la tarjeta, no se borra.

**Vive en:** *2026-09-25*

### El tope del detalle recortó 4 de 7 fusiones EN SILENCIO, y el historial declaró las 7

Ocho tarjetas de la landing se fundieron en la #227 —eran una sola decisión de posicionamiento
con seis lugares donde aterriza— y el aplicador hacía `slice(0, 6000)` al concatenar. Medido
después: el detalle declaraba haber absorbido siete y **sólo entraron tres**. El historial decía
«Absorbí la #242» para las siete.

Es exactamente el caso que este documento ya tenía escrito («Un tope se aplica ANTES de decidir
si hubo cambio») y se reprodujo igual, un día después, en el mismo tablero. Lo que faltaba no
era la regla: era aplicarla en el camino nuevo.

- **Cuando N tarjetas se funden en una, NO se pega el texto: se NOMBRAN.** Siete líneas de
  `- **#240 · <título>** — <qué pedía>` entran en 1.935 caracteres; siete detalles pegados no
  entran nunca. Y además es la forma correcta: lo que se conserva es el índice, y el texto
  completo sigue vivo en cada tarjeta cerrada.
- **La nota va SIEMPRE al historial, que no topea, y al detalle sólo si entra.** Si no entra, el
  detalle lleva el puntero con el número de caracteres. Un descarte sin rastro hace
  indistinguibles «no llegó» de «lo tiramos nosotros».
- ⚠️ **Y el verificador que escribís para cazar esto se queda viejo con el arreglo.** El chequeo
  buscaba el marcador `De la #N ` que usaba la fusión; al reescribir la #227 en formato compacto
  (`- **#N · …`) el mismo chequeo la siguió denunciando. Un falso positivo de un verificador
  propio cuesta una vuelta entera de diagnóstico.

**Vive en:** `backups/_aplicar-barrido.mjs` · `lib/detalle-contrato.ts` (`TOPE_DETALLE`) · *2026-09-25*

### Un proyecto TACHADO no sube por tener tarjetas adentro

Dos tarjetas del reality se mudaron desde «Vender MaKo: Ads» a «Vender MaKo: Orgánico YouTube»
—correcto: el reality es contenido de YouTube—, y con eso el proyecto tachado pasaba a tener
trabajo abierto. La escalera ordena lo de fuera de fase por cantidad de trabajo, así que iba a
subir a BAJA **por encima de proyectos vivos**: lo que se descartó volviendo a la vista por la
puerta de atrás, sin que nadie lo decidiera.

**Lo tachado se fija por su PID, no se deduce de lo que tiene adentro.** Y el mismo día pasó la
versión gemela con el ruteo: el Perro mandó la vidriera de Instagram a «Orgánico Instagram» dos
veces (#253 y #803), correcto por TEMA y equivocado por FASE — el contrato la pone en fase 2
junto a la prospección. **Después de crear o mover, se comprueba dónde cayó cada una.**

**Vive en:** `backups/_escalera.mjs` · *2026-09-25*

### 70 proyectos no entran en la escalera si una banda queda vacía

El corte pedido era «arriba lo de las fases, abajo todo lo demás», con MEDIA vacía a propósito.
La cuenta no cierra: 15 en ALTA y 55 abajo, con BAJA (49-25) y A FUTURO (24-1) dando 49 lugares
para 55 proyectos. El primer intento murió en `se acabaron los números: -6`.

**La excepción quedó escrita, y es la única:** los proyectos que no tienen NI UNA tarea empatan
en 1. Entre dos proyectos sin una sola tarjeta no hay nada que ordenar, y gastar números
distintos en ellos es lo que deja sin lugar a los que sí tienen trabajo. «Prohibido empatar»
sigue valiendo arriba del piso, que es donde el orden significa algo.

⚠️ **Y la guarda de la banda no se escribe con el número, se escribe con la BANDA.** El primer
guard decía `if (n !== 85) throw` —el 86 era el final de quince proyectos— y reventó al sumar
dos. Va `if (n + 1 < 75)`: lo que hay que garantizar es que el último siga siendo ALTA, no que
haya exactamente quince.

**Vive en:** `backups/_escalera.mjs` · `app/plan/board/types.ts` (`prioFromScore`) · *2026-09-25*

### Bajar un proyecto sin bajar sus tareas deja la inversión dada vuelta

Al mandar a BAJA las 98 tareas que no mueven ninguna fase quedó el efecto espejo: dentro de los
proyectos de fase, **31 tarjetas que SÍ son el trabajo de esa fase estaban por debajo del bloque
que se acababa de bajar** — «Protocolo de graduación de un cliente» en 4, «Correr el piloto del
CRM automático» en 13, «Bugs en la vista del cliente del Plan» en 10, contra un piso de 40 para
lo descartado. El proyecto en ALTA y su trabajo leyéndose como lo último de la lista.

**Toda bajada masiva necesita su piso.** Si se mueve un conjunto hacia abajo, hay que comprobar
que lo que se quedó arriba siga estando arriba — y eso es una consulta, no una intuición:
«¿qué tarjeta de un proyecto ALTA tiene score menor que el techo que le puse a lo bajado?».

⚠️ **Y la mitad espejo: bajar el PROYECTO no baja sus tareas, y el Kanban agrupa por la
banda de la TAREA.** Al mandar a A FUTURO los 53 proyectos que no son de ninguna fase
quedaron **59 de sus tarjetas leyéndose como trabajo activo**, seis de ellas en ALTA — o sea
trabajo dormido arriba de todo, que es justo lo que la bajada venía a evitar. Cada vez que
muevas un contenedor, preguntá qué agrupa la pantalla: si agrupa por el hijo, mover al padre
no se ve. Al bajarlas se comprimió el score dividiendo por 5 (conserva el orden que ya tenían
adentro del proyecto y entra entero abajo de 25) en vez de aplastarlas todas al mismo número.

**Y abajo, los empates dejan de ser un defecto.** 53 proyectos no entran en 24 números, y
repartirlos igual sería inventar un orden que miente: entre cosas que nadie va a tocar, el
puesto 31 contra el 32 no informa nada. Lo único que abajo informa es POR QUÉ están abajo, y
eso son tres grupos — con trabajo abierto (24→18, por cuánto tiene), sin trabajo abierto (5)
y tachado con su motivo (2). **«Prohibido empatar» sigue entero arriba de 75**, que es donde
el orden decide qué se hace hoy. Y el guard del verificador se mudó a esa banda: uno que
denuncia empates deliberados cría lobos, y eso cuesta una vuelta de diagnóstico.

**Vive en:** `backups/_scores-tareas.mjs` · *2026-09-25*

### Lo que el barrido encontró, en números

```
246 abiertas  →  30 fusiones · 12 mudanzas · 4 cierres · 35 títulos reescritos
                 98 bajadas de prioridad · 83 notas medidas contra el código
                 13 tarjetas nuevas que las fases nombran y el tablero no tenía
                 0 borradas
```

De los 22 faltantes que propusieron los críticos de completitud, **8 ya existían** en otro
proyecto o con otro nombre (el crítico mira su fase, no el tablero entero) y **1 se descartó
porque la premisa no se sostenía contra el código**. Validar antes de crear evitó 9 tarjetas de
ruido sobre 22 — el 41%.

**Vive en:** el board · *2026-09-25*


## Revisar un cambio propio con agentes: lo que encuentra es lo que uno ya no puede ver

Del 25/09/2026, revisando el rework de la tab de WhatsApp (300 líneas borradas) con 40 agentes:
4 lentes —qué se perdió · el camino nuevo · el copy · la pantalla— y un refutador por hallazgo.
36 hallazgos, **23 confirmados y 13 refutados**.

**Los dos más caros eran del código que yo acababa de escribir**, y ninguno de los dos aparece
mirando el diff: salían de recorrer el camino completo (qué pasa si abro la tab dos veces
mientras el QR está en pantalla) y de comparar el momento de la lectura con el momento del uso
(una foto de dos round-trips antes). **La lente que los encontró no fue «revisá esto», fue
«tratá de romperlo desde el usuario».**

⚠️ **Y la refutación pagó sola otra vez: 13 de 36.** Entre ellas, la que decía que las
plantillas quedaban inalcanzables en 7 de 9 workspaces — cierto el mecanismo, falso el impacto:
en esos workspaces no había credenciales de Chatwoot, así que las plantillas tampoco existían
antes. Se arregló igual (un botón que no pinta nada es un defecto), pero no era «rompe».
**Sin refutación, esa habría entrado al reporte como una regresión grave y habría costado una
tarde de otro.**

**La regla que queda: al revisar un cambio propio, la lente tiene que ser el USUARIO haciendo
algo dos veces, no el diff.** El diff ya lo leíste cuando lo escribiste.

## Aplicar feedback de UI en paralelo: tres agentes, un archivo cada uno (25/09/2026)

Martín grabó dos audios revisando el detalle del plan y salieron ~25 cambios. Se repartieron
en tres paquetes por ARCHIVO —BoardShell, Tablas, piezas— porque BoardShell tiene 3493 líneas
y dos agentes editándolo se pisan. Funcionó, y lo que falló es lo que enseña.

### ⚠️ Dos agentes con archivos distintos igual escriben DOS VECES el mismo código

El paquete de `piezas.tsx` y el de `Tablas.tsx` no compartían un solo archivo, y los dos
implementaron el código de colores del deadline: uno como variante `plazo="color"` de la
pieza compartida, el otro inline en su celda. **Los dos se dieron cuenta y lo reportaron** —
«ahora hay DOS implementaciones del mismo código de colores»— y ninguno pudo arreglarlo,
porque arreglarlo era tocar el archivo del otro.

Lo cerró el verificador: la variante de la pieza tenía **cero call sites**, así que la sacó.

**La regla: repartir por ARCHIVO evita el conflicto de edición y NO evita la duplicación.**
Lo que se reparte de verdad es el ENTREGABLE: si dos paquetes tocan el mismo concepto (acá,
«cuánto falta para el deadline»), uno lo implementa y el otro lo importa — y eso se decide al
escribir los paquetes, no después. El síntoma en el reporte es literal: dos agentes
escribiendo «vale la pena que el otro importe lo mío».

⚠️ **Y por eso el verificador NO es opcional en una corrida que escribe código.** Ninguno de
los tres podía ver el código muerto que dejaron entre los tres: cada uno veía su archivo.

### El scratchpad lo COMPARTEN los subagentes, y un nombre corto se pisa

Un agente del barrido de cursos escribió su propio `tx.mjs` en el scratchpad de la sesión y
pisó el transcriptor de audios que vivía ahí con ese nombre. No hubo error: el script siguió
existiendo y haciendo otra cosa, y falló recién al usarlo, con un `ENOENT` sobre una ruta
compuesta que no se parecía al problema.

**Los archivos de trabajo de la sesión van con nombre largo y propio**
(`transcribir-audios-martin.mjs`, no `tx.mjs`). El scratchpad no es privado.

### «Tres veces el mismo dato» empieza por no mirar qué dibuja el control

Martín: «acá dice deadline y acá dice 30 del 9, acá miércoles 30 de septiembre… es tres veces
el mismo dato». La celda tenía un `<input type="date">` —que YA muestra la fecha— y al lado un
formateador lindo y el plazo en palabras. **Al poner un formateador al lado de un input,
mirá primero qué dibuja el input.**

Y el corolario del vacío: **un `<input type="date">` vacío NO se ve vacío**, dibuja
«dd/mm/aaaa». Si el hueco tiene que leerse como hueco, hay que taparlo con otra cosa — acá un
guion que monta el input al tocarlo.

### Una alarma que parpadea se gana; un hueco se muestra y ya

El mismo dato —«esta tarea no tiene fecha»— estaba dibujado como un `WarnMark` que PARPADEA.
En una tarjeta suelta es un aviso; en la lista de un proyecto con 20 tareas abiertas es una
columna de triangulitos rojos titilando, que es exactamente el ruido que el guion vino a
sacar de la tabla. **El mismo hecho no se dibuja igual en una vista de uno que en una lista
de veinte:** lo que en singular informa, en plural es ruido y se aprende a ignorar.

**Vive en:** `app/plan/board/BoardShell.tsx` · `app/plan/board/Tablas.tsx` · `app/plan/board/piezas.tsx` · *2026-09-25*

## La TERCERA tanda del mismo día: dos paquetes, un archivo cada uno, otra vez (25/09/2026)

Misma forma que la tanda anterior —un agente por archivo, un verificador al final— y los dos
hallazgos caros volvieron a ser de los que **ningún agente por archivo puede ver**.

### ⚠️ Repartir por archivo no reparte los NÚMEROS, y ahí los dos tienen razón y el producto está mal

El paquete «boardshell» unificó el ancho de la columna derecha de los dos detalles: la tarea
bajó de 280 y el proyecto **subió de 236 a 264**. El paquete «tablas», en el mismo rato, bajó
el `minWidth` de la tabla de tareas a 520 «para que entre sin barra horizontal adentro de un
proyecto», y dejó su cuenta escrita en el comentario: `820 − 236 − 44 = 538`.

Los dos números son correctos **en su archivo**. Juntos, la columna principal quedó en ~499px
útiles (820 − 2 del borde del modal − **264** − 44 de padding − 9 de la barra vertical − 2 del
borde de la caja) con una tabla que declara 520: **la barra horizontal que el pedido venía a
sacar volvió, con la cuenta que la justificaba mirando un ancho que ya no existía.**

Y no hay síntoma del lado de nadie: el typecheck pasa, los tests pasan, cada comentario
explica bien su propio número.

- **La regla: si dos paquetes hacen aritmética sobre la misma medida, la medida vive en el
  archivo que los dos importan** — acá `MODAL_DETALLE`, `COL_DER` y `ANCHO_TABLA_EN_PROYECTO`
  en `app/plan/board/piezas.tsx`, que existe justamente porque `Tablas.tsx` no puede importar
  de `BoardShell.tsx` (BoardShell importa las tablas y el ciclo deja el componente en
  `undefined`).
- **Y el olor que lo delata en el reporte, sin abrir el código: dos agentes citando el mismo
  número con valores distintos.** Uno decía «la columna del proyecto estaba en 236 y ahora
  tiene que hospedar el mismo bloque», el otro «820 − 236 − 44 = 538». Cruzar los dos informes
  por sus NÚMEROS cuesta un minuto y encuentra esto antes de abrir un archivo.
- **Sumar lo que uno quiere no contesta si entra; restar lo que hay, sí.** El 520 salió de
  sumar lo que las columnas «necesitan» (534, redondeado abajo). Esa cuenta es sobre el
  contenido y no sobre el contenedor, así que puede dar cualquier cosa y sentirse rigurosa.

### ⚠️ Una capacidad nueva puede mudar un modal a una CAPA donde su confirmación no se ve

El pedido era chico: «falta el botón de basura en la vista de tabla». La tabla ya sabía
dibujarlo; lo que faltaba era pasarle `onEliminar`, y se le pasó también a la tabla que vive
**adentro del detalle de un proyecto**.

`EliminarModal` tiene el z-index escrito a mano en **130**, que es exactamente `Z_BASE` de
`app/_components/pila-modales.ts`. Alcanzaba mientras se abriera desde el PRIMER modal de la
pila. Cada nivel suma 2: con el detalle de una tarea abierto (130) y el de su proyecto
espiado encima (132), el tacho de una fila pedía confirmación **a 130, debajo del modal que
la abrió**. Sin cartel, sin fondo oscuro y sin ninguna pista — se lee como un botón que no
hace nada.

- **El camino ya existía** (una tarea abierta DESDE un proyecto tenía el mismo problema con su
  propio tacho); lo que hizo la capacidad nueva fue volverlo el camino normal. Es «mover una
  acción a un lugar más accesible cambia sus supuestos», aplicada al APILAMIENTO.
- **Una pregunta de «¿seguro?» no se apila: se dibuja por encima de TODO.** `app/_ui/Confirm.tsx`
  ya tenía la autopsia escrita y el número (3500, arriba de los modales escritos a mano que
  eligen su z solos). `EliminarModal` es de esa familia y estaba fuera. Quedó en 3400.
- **Cómo buscarlo sin navegador: un z-index literal en un modal, y la pila que empieza en ese
  mismo número.** `grep` de `zIndex: 1[3-9]0` sobre la carpeta dio 130, 133, 140 y 150 — cuatro
  modales eligiendo su capa a ojo contra una pila que crece sola.

### El mismo componente creció una variante inalcanzable DOS DÍAS SEGUIDOS

La tanda anterior dejó en `LineaDeadline` una variante `plazo="color"` con cero call sites y
el verificador la sacó. Esta vez, en la misma pieza: el prop `plazo={false}` («sólo la fecha»)
y la rama `if (!iso)` que dibuja el **guion** de «campo sin completar». Los dos, cero usos
alcanzables — los tres call sites entran con `{x.deadline && <LineaDeadline …>}`, así que el
guion no se puede ver desde ahí ni pasándole un vacío.

Y el guion que Martín pidió SÍ existe: lo dibuja `CeldaFecha` en `Tablas.tsx`, como un botón
que al tocarlo monta el `<input type=date>`. O sea que el comentario de `LineaDeadline`
prometía una pantalla que nadie podía ver mientras el pedido estaba cumplido tres archivos más
allá, y el de `WarnMark` mandaba a buscarlo al lugar equivocado.

**La regla que queda, y es la segunda vez en dos días sobre el MISMO archivo: cuando dos
paquetes trabajan sobre un pedido de UI, la pieza compartida acumula las dos interpretaciones
del pedido — la que se usó y la que no.** El chequeo es de treinta segundos y hay que correrlo
sobre la pieza compartida, no sobre los archivos que cambiaron: por cada prop opcional, `grep`
del nombre con `=` en los call sites; si da cero, es una interpretación que no se usó.

⚠️ Y el que más engaña no es el prop: es la RAMA. Un `if (!iso)` se lee como una guarda
legítima y también puede ser una pantalla que nadie alcanza. Lo que las distingue es mirar
**cómo entran los call sites**, no la firma.

### Lo que se dibuja adentro de un `contentEditable` se GUARDA

El detalle pasó a ser UN solo `<RichText>` con el plegado como decoración encima: un efecto le
mete un `<button>` con el chevron a cada encabezado y esconde los bloques con `data-mk="x"`.
Todo eso vive DENTRO del `contentEditable`, así que viaja en el `innerHTML` que `RichText`
commitea en cada blur y termina en la base.

- La salida es marcar **sólo** con un atributo propio (`data-mk`) más un botón reconocible, y
  limpiarlo en el `onChange` del padre, que es el único camino a la persistencia.
- **El ORDEN de dos `replace` que se limpian entre sí es un bug.** Los botones se borran
  enteros PRIMERO, porque se reconocen por su propio `data-mk`; barriendo los atributos antes,
  el `<button>` queda huérfano y se guarda. Reproducido a propósito leyendo la función del
  fuente y corriéndola: con el orden correcto el ida y vuelta devuelve el HTML idéntico
  carácter por carácter y es idempotente; invertidos, queda un
  `<button contenteditable="false" …>` dentro del detalle guardado.
- **Y la comparación de «¿cambió algo?» va contra el texto YA limpio y también contra
  `mdAHtml(valor)`**: el campo guarda markdown en casi todas las tarjetas y el editor muestra
  su conversión, así que sin las dos, abrir y cerrar el modal sin tocar nada estampa una
  edición fantasma en el historial.

### `RichText` reescribe su `innerHTML` cada vez que pierde el foco, no cuando cambia el valor

Cualquier cosa que otro componente le dibuje encima desaparece con un blur **sin que cambie
ningún estado**. El síntoma es «funciona hasta que hago click adentro y click afuera», que se
lee como un bug del click y es un efecto del hijo pisando al padre. Se resuelve con un
`onBlurCapture` en el contenedor que bumpea un contador y hace redecorar en el mismo commit.

### Tres cosas chicas que costaron una vuelta cada una

- **Un `colSpan` hardcodeado es un layout que afirma la forma de la tabla desde otro lugar.**
  Estaba en 6; con `ocultarProyecto` son 5, y la fila de las completadas desbordaba la tabla.
  No da error: desborda. En una tabla con columnas condicionales la cantidad se calcula UNA
  vez y la usan todas las filas que hacen span — acá eran DOS (la fila plegada y el cartel de
  «no hay tareas») y sólo una estaba señalada en el pedido.
- **Una preferencia de orden guardada por navegador puede apuntar a una columna que ESTA
  pantalla no dibuja** (`kanban.tabla.orden === 'proyecto'` adentro de un proyecto). Cae al
  default para MOSTRAR, sin PISAR la preferencia: al volver a la vista completa su orden sigue
  donde lo dejó. Es «localStorage restaura una PREFERENCIA, nunca pisa una DECISIÓN» vista
  desde el otro lado.
- **Un `<details><summary>` no puede hospedar un link.** El chip de origen se mudó al renglón
  del historial y a veces es un link (la grabación de Fathom): adentro de un `<summary>` el
  click del link dispara igual el plegado, porque la activación es del summary y no de un
  listener, así que un `stopPropagation` no alcanza. Va un `<button>` con `aria-expanded`.

### Lo que quedó SIN verificar

**El plegado del detalle es un GESTO y no se probó en un navegador.** AGENTS.md es terminante
con que un gesto no se verifica leyendo el handler, y no se levantó el dev server porque eso
ESCRIBE en producción: un blur del detalle guarda en el tablero real de Mauricio. Lo que hay
que mirar, en orden: (1) que el chevron aparezca en la canaleta de cada encabezado y rote al
abrir; (2) que al plegar no se mueva el cursor de texto al encabezado (por eso el `mousedown`
va cancelado); (3) **entrar al detalle y salir sin tocar nada** — ahí es donde podría aparecer
un parpadeo de lo plegado si React separara los dos efectos; (4) que después de editar y salir
el detalle guardado no tenga ni un `data-mk` ni un `<button>` adentro.

Y **los anchos son una RESTA, no una medición en pantalla**: si al mirarlo todavía queda una
barra chica adentro del proyecto, el lever es `COL_DER` o el padding de la columna, nunca
volver a subir `ANCHO_TABLA_EN_PROYECTO` — que es lo que reinstala la barra.

**Vive en:** `app/plan/board/piezas.tsx` · `app/plan/board/Tablas.tsx` · `app/plan/board/BoardShell.tsx` · `app/plan/board/EliminarModal.tsx` · `app/plan/board/DependenciasBloque.tsx` · *2026-09-25*

## La CUARTA tanda del mismo día: el gesto que se escribió entero y no se ofrecía (25/09/2026)

Tres paquetes en paralelo, un archivo cada uno (`BoardShell.tsx` · `Tablas.tsx` ·
`DependenciasBloque.tsx`), sobre nueve pedidos de Martín mirando las capturas del mismo modal.

### El gesto completo que no existía para nadie

El paquete de tablas escribió el arrastre de filas entero —marca de destino, auto-scroll,
copia que sigue al cursor, número sugerido por la posición— y **`onSoltar` terminó con CERO
call sites**. El typecheck pasa (la prop es opcional), los tests pasan, y en pantalla no hay
nada que agarrar. Es «Escribir la salida no es ofrecerla» de AGENTS.md, y lo nuevo es que
acá **no fue un descuido: fue estructural**. El repartidor le dio a cada agente un archivo, y
en React la capacidad vive en un archivo y el call site en OTRO — o sea que un reparto por
archivo *garantiza* que toda prop nueva nazca huérfana, porque el único que podía enchufarla
tenía prohibido tocar ese archivo.

Lo mismo mordió en la tanda anterior con otra cara (dos paquetes citando el mismo ancho con
valores distintos), así que son dos rondas seguidas.

- **El que cierra la corrida grepea cada prop nueva y cuenta sus call sites**, antes del
  commit. Son treinta segundos y es lo único que separa «lo escribí» de «se puede usar».
- **Y el agente que no puede enchufar su propia salida lo tiene que decir en su reporte, en
  positivo, con las líneas exactas.** Éste lo hizo («BLOQUEANTE — FALTA EL CALL SITE», con
  los tres lugares y el código), y por eso el cableado costó minutos en vez de una ronda.
  Sin ese renglón, un paquete «hecho» con el gesto muerto se commitea sin que nada avise.

### Plegar sobre un `contentEditable` puede BORRAR lo que está plegado

El síntoma de Martín: «saqué los desplegables sin querer borrando 1». Eran dos bugs, y el
segundo es el irreversible.

- **Lo plegado sigue adentro del editable.** Con `display: none` el cuerpo no se ve y aun así
  entra en el rango de una selección igual que si estuviera a la vista: con tres encabezados
  plegados y pegados, la pantalla muestra tres renglones cortos, seleccionarlos de punta a
  punta y apretar Backspace **se lleva los párrafos escondidos entre ellos**. Sin error, sin
  rastro, y el editor commitea al blur. Medido: sin guardia **2 párrafos perdidos / 0 eventos
  frenados**; con guardia **0 perdidos / 2 frenados**, y las partes desplegadas con su texto a
  la vista para que la persona decida de nuevo.
- **La guardia es `beforeinput` NATIVA, no de React.** El dato que hace falta —qué rango va a
  tocar la edición— sale de `getTargetRanges()`, que sólo trae el evento nativo: el sintético
  de React no lo expone. Va con `addEventListener` y su `removeEventListener`.
- **Un reconocedor calcado de lo que EMITE tu generador se rompe con la primera edición.** El
  plegado pedía la forma exacta de `mdAHtml` (`children.length === 1` + un `<strong>`), y
  Chrome deja formas normales que esa condición no ve: `<strong>X</strong><br>` (lo que queda
  al borrar hasta el final de un renglón) y `<strong>Por</strong><strong> qué</strong>`
  (editar en el medio parte el `strong` en dos). La pregunta correcta es la que ve la persona
  —«¿todo el texto de este bloque está en negrita?»—, no la forma del HTML.
- **Un `textContent` leído sobre un nodo que vos mismo decoraste incluye tu decoración.** La
  clave del plegado salía del encabezado YA decorado; hoy el chevron es un `<svg>` y no aporta
  letras, así que «funcionaba» por casualidad. En el arnés, donde el chevron era un `›`, la
  clave pasaba a ser `›por que` y la guardia frenaba el borrado **sin desplegar nada** — el
  peor resultado posible de un bloqueo: para la persona, el gesto «no hace nada».
- **Si el creador y el reconocedor usan reglas distintas, lo que creás no se pliega y no hay
  ningún error.** Por eso el botón nuevo emite `<h3>` (una declaración) y el reconocedor
  acepta cualquier `h1-h6` salteando la heurística de ≤60 caracteres (una adivinanza). Con
  negrita se vería en negrita y no plegaría, en silencio.

### El arrastre, tres superficies y tres formas de equivocarse

- **`rAF` y los timers están congelados durante un arrastre nativo** — ya está en AGENTS.md y
  volvió a morder de una forma nueva: esperar con un `requestAnimationFrame` del `dragstart` a
  que el «Ver más» termine de desplegarse **no corre nunca**. Se mide desde el `dragover`.
- **La condición que habilita un drop no puede colgar del ESTADO de React.** El primer
  `dragover` puede llegar antes de que se commitee el render del `dragstart` (los eventos de
  arrastre son de prioridad continua), y sin `preventDefault()` en ese primer evento el
  navegador decide que no es un destino válido: el gesto arranca muerto. Va en un `ref`.
- **Una copia de arrastre no puede ser un `<tr>` clonado.** `position` no aplica a
  `display: table-row`, así que la copia es un `<div>` fijo con su propia tablita adentro y
  los anchos de celda clavados en lo medido. Y los `value`/`checked` se copian **a mano**:
  `cloneNode` copia el ATRIBUTO y React escribe los inputs por PROPIEDAD, así que sin eso la
  copia viaja con la fecha vacía.
- **El auto-scroll empuja la caja que SCROLLEA, no la ventana.** La regla de AGENTS.md («va
  adentro del `dragover`») sigue valiendo y le faltaba la otra mitad: adentro de un modal el
  que scrollea es un `div` con `overflow-y`, y ahí `window.scrollBy` mueve 0px.
- **Que una fila sea `draggable` no rompe los botones de adentro, rompe los `<input>`.** Un
  click sin movimiento no es un arrastre, así que casillas y tachos conviven (ya estaba
  probado en `CardTile`); con lo que se pelea es con un campo de texto, donde arrastrar
  significa seleccionar. Se marca ESA celda, no se baja el `draggable` a un agarre chiquito —
  que además costaría una columna, o sea la barra horizontal de vuelta.
- **El índice del drop se corre cuando bajás algo dentro de su propia lista.** El índice se
  mide contra los rectángulos DIBUJADOS, que incluyen a la tarjeta agarrada (al nodo origen no
  se le toca el tamaño), y el número se calcula contra la lista SIN ella: cada posición de
  abajo se corre una. Sin el corrimiento, la tarjeta cae un lugar más arriba del hueco que se
  estuvo viendo todo el arrastre. **El Kanban era el único de las tres superficies que no lo
  hacía** y se descubrió al escribir las otras dos — la señal fue tener tres implementaciones
  del mismo gesto y poder compararlas, que es justo lo que la duplicación permite y lo que la
  duplicación va a hacer divergir.

### El ancho: el piso no es lo que hay, es lo que se pide

La barra horizontal de adentro del detalle de un proyecto se reportó por tercera vez.

- **Declarar como piso el ancho DISPONIBLE es lo que la devuelve.** Una tabla que pide
  exactamente lo que hay no tiene margen para nada: el zoom achica el modal, una palabra más
  larga estira su columna, un borde nuevo suma 2px. El piso es la **suma de lo que las
  columnas piden** (`ANCHO_MINIMO`, 444 adentro de un proyecto) topeada contra lo disponible
  (`ANCHO_TABLA_EN_PROYECTO`, 496): los 52px de diferencia son la razón por la que no hay
  barra. `ANCHO_TABLA_EN_PROYECTO` pasó de ser el piso a ser el TECHO.
- **Un ancho declarado se prueba con el valor MÁS LARGO del conjunto** — otra vez, y esta vez
  costó la barra: la celda de prioridad estaba declarada en 124 midiendo «Alta/Media/Baja», y
  «A futuro» pedía ~129, así que la columna se estiraba sola y empujaba la tabla más allá de
  su `minWidth`. El olor: un `inline-flex` (no puede envolver) con un chip y una palabra.
- **Dos datos que son el MISMO dato se dicen una sola vez**, y acá eso valía 48px de la
  columna más apretada del producto: la palabra de la prioridad era `PLABEL[prioFromScore(score)]`,
  o sea una función pura del número que tenía al lado. Y el que lo delataba estaba a la vista —
  la tabla de PROYECTOS nunca la había dibujado.
- **Cambiar la POLÍTICA de un número deja mintiendo al comentario del archivo que lo exporta.**
  `piezas.tsx` seguía explicando la resta como el piso de la tabla, con los cuatro anchos de
  columna copiados (34 + 124 + 150 + 76) — los cuatro se movieron el mismo día en `Tablas.tsx`
  y el comentario quedó afirmando una suma que ya no existía. Los anchos ya no se copian ahí:
  viven donde se usan.

### Lo que quedó SIN hacer

- **NADA de esto se vio en un navegador**, y es la tercera tanda seguida en la misma
  situación: bootear local escribe en la Supabase de producción y hay otra sesión sobre este
  clon. Lo que hay que mirar, en orden: que adentro del detalle de un proyecto no aparezca la
  barra de abajo al 100% y al 125% de zoom; que un título largo se corte en la segunda línea
  con «…»; arrastrar una fila y ver la línea de destino y la copia opaca; que al llevar el
  cursor al borde de abajo la columna scrollee sola; y que empezando el arrastre sobre el
  `input` de la fecha NO arranque el gesto.
- **La fila de una tabla sólo se agarra con la tabla ordenada por PRIORIDAD**, y el default de
  la tabla de proyectos es `deadline`. Con cualquier otro orden la posición entre dos filas no
  dice ningún número, así que el agarre se apaga y el `title` del encabezado «Prioridad» lo
  explica — pero lo primero que se ve ahí es una tabla que no se agarra. Si molesta, la
  decisión es de Martín.
- **El molde del arrastre quedó escrito dos veces.** `useArrastreCopia` (BoardShell, para el
  Kanban y la grilla de proyectos) y `useArrastreFilas` (Tablas). Corresponde sacarlos a un
  `app/plan/board/arrastre-copia.ts` que importen los dos; el reparto por archivo lo impidió.
  Cuando se haga, llevarse lo que uno tiene y el otro no: el auto-scroll contra la caja que
  scrollea, y el corrimiento del índice.
- **El arrastre de filas es sólo con mouse.** `useArrastreTactil` está hecho para columnas
  (`data-prio`, mide cuatro rectángulos) y no sirve para filas.

**Vive en:** `app/plan/board/BoardShell.tsx` · `app/plan/board/Tablas.tsx` · `app/plan/board/RichText.tsx` · `app/plan/board/DependenciasBloque.tsx` · `app/plan/board/piezas.tsx` · *2026-09-25*

## La barra de selección múltiple: un renglón de íconos (25/09/2026)

«Utiliza iconos para ahorrar espacio, solo 1 linea, no 2 lineas». La barra pedía **899 px
donde hay ~499** (el detalle de un proyecto) y por eso se partía siempre en dos renglones,
comiéndose 106 px de alto arriba de la tabla que la ronda anterior había apretado fila por
fila. Quedó en **216 px cerrada y 300 con el calendario abierto**, 48 px de alto, medidos en
Chrome sobre el componente real con las hojas reales.

### Sacar un `<select>` nativo pierde dos cosas que el navegador daba gratis

Y ninguna la ve un typecheck, un test de DOM ni una captura.

- **El popup nativo se come el Escape.** El `Dropdown` de la casa no, así que abrir «Mover a
  un proyecto» adentro del detalle de un proyecto y apretar Escape para arrepentirse
  **cerraba el modal entero**, con la selección adentro. Se reporta como «se me cierra solo».
  ⚠️ Y el arreglo no es un `stopPropagation`: los dos handlers viven en `document` y los dos
  en burbuja, y el del modal se registró al montarse, o sea que corre ANTES. Ni siquiera un
  `stopImmediatePropagation` en burbuja llega a tiempo. **Va en CAPTURA**, que es la única
  fase que corre antes de toda la burbuja del documento. Y como vive en `Dropdown.tsx`, lo
  heredan las ~30 pantallas que lo usan — que es donde tenía que estar, no en quien lo llama.
- **Las opciones del popup nativo se navegan con teclado siempre.** Las del `Dropdown` sólo
  si hay buscador, y el buscador aparece **pasadas las 8 opciones**
  (`conBusqueda = search ?? flat.length > 8`). Con 8 o menos el foco se queda en el botón y
  el siguiente Tab se va al control de al lado: el menú queda abierto y sin foco adentro.
  **Sigue abierto** (ver abajo).

### `nowrap` no es lo contrario de un bug de `wrap`

La barra se partía en dos renglones **porque no entraba**, no porque tuviera `flexWrap`.
Sacarle el `wrap` sin hacerla entrar no arregla nada: convierte «dos renglones» en
**desborde**, y el Kanban no tiene ningún ancestro con `overflow`, así que la barra
horizontal se la come la PÁGINA. Lo que se arregla es el ancho (899 → 216); el `wrap` vuelve
como RED, y en las tres pantallas donde Martín la mira no se dispara nunca.

- **Es la misma línea de código que el bug y significa lo contrario**, así que el comentario
  tiene que decir cuál de las dos es: camino o red. Sin eso, el próximo lo saca «porque era
  el bug».
- **Y un `flex: 0 1 auto` sobre algo sin texto no cede.** El «quien CEDE» declarado era el
  envoltorio del Dropdown, y adentro el rótulo está VACÍO (`placeholder=""`) y el ícono y el
  caret son `flex: none`: el botón toca fondo en ~54 px y de ahí no baja. Ceder en el tipo no
  es ceder en píxeles — la regla de AGENTS.md pide `ellipsis` porque pide algo que se pueda
  RECORTAR, y un ícono no se recorta.

### El peso del trazo de un ícono es relativo a sus VECINOS

El trazo efectivo es `strokeWidth × (tamaño / viewBox)`. Los cinco íconos de la barra salieron
con **1.23 a 1.80** —el tilde 46% más grueso que la cruz— porque cada uno venía de un lugar
donde iba solo. El mismo ícono está bien en la tarjeta y mal en un renglón de cinco: lo que
cambió no es el ícono, es el vecindario. Se emparejan al efectivo, no al `strokeWidth`.

### Y el comentario que copia el ancho del vecino, otra vez

El archivo nuevo abrió su cabecera diciendo «899 donde hay **499**» cuando
`ANCHO_TABLA_EN_PROYECTO` calcula **496**. La regla —«no se copian acá los anchos, viven donde
se usan»— se había escrito **una hora antes**, en `piezas.tsx`, que es el archivo de al lado.
Un número copiado nace viejo aunque quien lo copie acabe de escribir la regla que lo prohíbe.

### Lo que quedó SIN hacer

- **La MISMA barra existe escrita inline en `app/ads-manager/CampanasBrowser.tsx:589-604`**,
  con texto, emoji y colores invertidos, y con DOS controles que limpian la selección con dos
  nombres distintos. «Tanto para dentro del proyecto como en cualquier lista» se puede leer
  incluyéndola; sus acciones son otras (Activar / Pausar), así que es una decisión de Martín
  y no un refactor obvio. Es la única otra superficie con selección múltiple del repo: las
  tres del /plan (tarjeta del Kanban, las dos tablas) ya comparten `AccionesLote`.
- **El teclado del `Dropdown` con ≤8 opciones** (arriba). Hace falta foco al abrir, flechas y
  devolución del foco al cerrar; y su contenedor declara `role="listbox"` con hijos `<button>`
  sin `role="option"`, o sea ARIA inválida. Vive en `app/components/Dropdown.tsx` y lo
  heredan las ~30 pantallas que lo usan, así que no es un arreglo de esta barra.
- **Nada se vio en la app.** Lo que sí se midió es el componente REAL renderizado en Chrome
  con `globals.css`, `ui.css` y la fuente que carga el layout — geometría real, no una maqueta.
  Falta el comportamiento: que el calendario abra y vuelva a ser ícono, y que Escape con el
  menú abierto ya no cierre el modal.

### Y sobre la corrida

Diez agentes en cuatro fases para un archivo de 95 líneas, con Martín preguntando por segunda
vez en el día por qué tardaba. **Lo que costó el tiempo son las BARRERAS**, no los agentes:
cuatro fases en serie suman cada una su agente más lento. Y el panel de diseño fue ceremonia —
él ya había decidido «íconos, un renglón», que es una restricción del problema y no una opción,
lo cual AGENTS.md dice explícitamente. Lo que sí valió: medir el ancho, y los refutadores, que
encontraron siete defectos reales de los cuales tres habrían llegado a producción.

**Vive en:** `app/plan/board/AccionesLote.tsx` · `app/components/Dropdown.tsx` · `app/ads-manager/CampanasBrowser.tsx` · *2026-09-25*

## Lo que se repite: la columna, la frecuencia y las cuatro veces que el call site quedó en la otra mitad (26/09/2026)

Tres migraciones en un día —`recurrente` en tareas (0163), en proyectos (0164) y `frecuencia`
en las cuatro tablas (0165)— para un criterio que Mauricio había dictado el 16/07: «acá lo que
entran son tareas que tienen un inicio y tienen un fin».

### La feature NO es la vista: es la exclusión

Lo que hacía falta no era ver las recurrentes juntas, era que **no ensucien el ranking**. El
Perro puntúa por «qué mueve la aguja» y le pone deadline a todo; algo que se repite para
siempre no tiene fin, así que se llevaba un puesto de los 5 de Prioridades, hundía el avance
de su proyecto y titilaba pidiendo una fecha que nunca iba a tener. La vista es la
consecuencia. Cada vez que hubo que decidir algo, la pregunta que lo resolvió fue «¿esto hace
que compita?», no «¿esto se ve lindo?».

- **El corte es del CONTENEDOR, no de lo que cuelga.** Un proyecto recurrente no arrastra a
  sus tareas: las que tienen fin siguen compitiendo y siguen llevando deadline. «Armar el
  documento de onboarding de Vertice» cuelga de Customer Success, tiene un entregable y se
  cierra una sola vez — sacarla del ranking por vivir adentro de algo que se repite la
  volvería invisible justo cuando hay que hacerla.
- **Marcar algo recurrente NO le baja el score**, y eso tiene una consecuencia que no se ve:
  el que estaba primero sigue primero en `porScore`, de donde sale el 🎯 Objetivo Principal.
  Sacarlo del ranking del Perro no alcanzaba; hubo que sacarlo también de esa lista. Bajarle
  el score habría sido peor: lo mandaría al fondo como si estuviera abandonado.
- **Frecuencia no es un deadline, y por eso es una columna nueva.** Un deadline llega, pasa y
  deja la tarea vencida; una frecuencia es un ritmo que no vence. Guardarla en `deadline`
  habría hecho que el motor de vencimientos, el tinte de la tabla y el Perro la leyeran como
  un plazo y avisaran que «la junta semanal está atrasada».

### El call site quedó en la otra mitad CUATRO veces

Es el mismo fallo, repetido, y vale la pena contarlo junto porque la cuarta vez ya no costó
nada: el reparto por archivo deja la CAPACIDAD en un archivo y el CALL SITE en otro.

| Vuelta | Qué quedó huérfano | Cómo se vio |
|---|---|---|
| 1 | el arrastre de filas: `onSoltar` con 0 call sites | typecheck y tests verdes, nada que agarrar |
| 2 | el tablero del CLIENTE no guardaba `recurrente` | la tarjeta se movía de vista y volvía al F5 |
| 3 | el avance del plan y el 🎯 seguían contando recurrentes | el norte del tablero señalando algo sin fin |
| 4 | las TABLAS de la vista Recurrentes sin `onSoltar` | el mismo gesto andaba o no según el interruptor del header |

**Lo que lo cortó no fue escribir mejor los prompts: fue pedir el NÚMERO.** Desde que el
encargo dice «grepeá cada export y contá sus call sites; un 0 se declara BLOQUEANTE con las
líneas exactas», los paquetes empezaron a devolver el bloqueante en vez de decir «hecho» — y
cerrarlo pasó a costar minutos. Uno además **verificó el call site rompiéndolo** (cambiar
`setFrecuencia` por otra acción y ver caer el test), que es la única forma de saber que el
test mide lo que promete: al primer intento cambió UNO solo, dio verde, y el test tenía razón
porque existía un segundo camino.

### Tres formas de que una pantalla mienta, todas medidas acá

- **Un filtro que no se dibuja pero sigue filtrando.** `fCuando` vive en `localStorage` y es
  UNA instancia para todas las vistas. La vista Recurrentes filtraba con el `passes` de
  Tareas «porque el Set está vacío si el filtro no se dibuja» — falso: con «Esta semana»
  tildado en otra vista, Recurrentes devolvía CERO tarjetas y decía **«Nada se repite
  todavía»**, una afirmación falsa sobre los datos, sin ningún control a la vista que lo
  explicara. El comentario que lo justificaba ya advertía el riesgo y lo causó igual.
- **La misma vista contradiciéndose según el interruptor.** La TABLA apagaba el puntaje y el
  chip «Se repite» (`sinRanking`) y la TARJETA los seguía pintando: el mismo dato se mostraba
  o no según tarjetas/tabla. Y en esa vista el chip es ruido en el 100% de las tarjetas.
- **Un `match` de navegación apuntando a una ruta que no existe.** El nav declaraba
  `/customer-success/cliente` y esa carpeta nunca existió: la ficha de un cliente es un
  ESTADO adentro de la lista, no una URL. Por eso no se encontraba, y por eso no se puede
  compartir un link a un cliente ni volver con el botón de atrás.

### La búsqueda: el filtro no estaba mal, el ORDEN sí — y después tampoco era el orden

Dos vueltas sobre el mismo reporte, y la primera arregló lo que no era.

1. «Busco mauricio y me trae Chatbot, Plan, Integraciones». El heno de un proyecto incluía su
   detalle, sus notas y los títulos de sus tareas, y la lista se ordena por score: el match
   exacto («Cliente: Mauricio», score 20) quedaba sepultado bajo cuatro con 99. Se ordenó por
   relevancia en tres escalones. **Correcto y insuficiente.**
2. «Busco idea y el proyecto de idea me sale último… eso sólo debería pasar en la búsqueda
   avanzada». Medido: «idea» traía 10 de 71 proyectos y UNO tiene la palabra en el nombre.
   Ordenarlos mejor deja nueve tarjetas que nadie pidió. Lo que faltaba **ya existía**: la
   búsqueda de TAREAS mira sólo el título salvo que se agreguen campos en el desplegable de
   la lupa, y la de proyectos era la única que no respetaba esa elección.

**La regla: antes de mejorar el orden de una lista, contá cuántos de sus resultados la persona
pidió.** Si la mayoría no los pidió, el problema es el filtro y no el orden. Medido después:
«idea» 1 (era 9) · «mauricio» 1 (era 5) · «landing» 3 (era 16).

### Lo que quedó SIN hacer

- **Nada se verificó en un navegador de nuestro lado** — cuarta tanda seguida. Lo que
  desbloqueó esta fue que Martín lo probara en producción y mandara la captura. Levantar local
  escribe en la base de producción; la salida barata sería el Cliente de Prueba (ws 3).
- **La ficha de cliente no tiene URL propia** (arriba). Hoy es un estado de la lista.
- **La frecuencia no se puede poner al CREAR ni en lote**, y el alta tampoco puede marcar «Se
  repite»: los dos modales de alta no nombran el campo. Es deliberado para el modal de tarea
  —«no quiero la opción de agregar detalles, ni en proyecto ni en tareas» (23/09)— y queda el
  interruptor del detalle, que es un click. Revisar si en LOTE sí conviene.
- **El arrastre de Recurrentes es sólo con mouse**: `useArrastreTactil` está cableado a las
  bandas de PRIORIDAD, que esa vista no tiene.
- **`juzgarConCriterio` sigue con cero call sites** (ver la entrada de Fathom).

**Vive en:** `supabase/migrations/0163_tareas_recurrentes.sql` · `0164_proyectos_recurrentes.sql` · `0165_recurrentes_frecuencia.sql` · `lib/plan-recurrentes.ts` · `app/plan/board/BoardShell.tsx` · `app/_components/nav.ts` · *2026-09-26*

### Un tablero, dos tablas: la mitad que se olvida (26/09/2026)

`app/plan/board/BoardShell.tsx` es UNO y lo montan dos parents sobre tablas distintas:
`plan_tareas` + `plan_proyectos` (el super-admin) y `experimento_tareas` +
`tarea_categorias` (cada cliente). Agregar un campo son **seis** lugares, y el typecheck no
ve ninguno:

| | dueño | cliente |
|---|---|---|
| columna | `plan_*` | `experimento_*` / `tarea_categorias` |
| lectura | `rowToTask` / `rowToLabel` (lib/plan-board.ts) | `toBoard` / `toLabel` (board/desde-todo.ts) |
| escritura | `taskToRow` / `labelToRow` | `editPatch` + los payloads de `categoria-crear`/`-editar` |
| puerta | — | el TIPO del patch en `app/api/todo/route.ts` |
| server | — | el `upd` campo por campo de `lib/todo.ts` |

El archivo ya lo pagó tres veces (la prioridad a mano, el Quarter de la 0162, la recurrencia
de la 0164) y el modo de falla es siempre el mismo: **el control se dibuja, la request
contesta 200 y no se guarda nada** — que se lee como que la app está rota.

⚠️ **Y en la LECTURA es DESTRUCTIVO, no sólo inerte.** El guardado del tablero del dueño es
un `upsert` de la fila ENTERA armada desde el estado del navegador: un campo que el mapper
de lectura no trae vuelve como `undefined`, sale como `null` y **borra la columna** en el
próximo save de cualquier otro campo.

### `GraphicsView` pedía el board entero para leer dos arrays

Era de sólo lectura —no escribe una fila— y su prop era `Board`, o sea el `ReturnType` de
`useBoard`: cuarenta y pico de funciones de escritura, el dirty-set y el autoguardado. Con
esa firma sólo se podía montar adentro del tablero.

El costo real no es estético: **`useBoard` autoguarda por dirty-set y su `saveTask` hace
upsert de la fila entera desde el estado del navegador**, así que montar un segundo
`useBoard` para dibujar gráficos en otra pantalla serían dos escritores pisándose sin un
solo error. Pedir `{ tasks, labels }` es lo que permitió leer las filas en el server y
mudar la pantalla a `/productivity-analyst` sin montar ninguno.

**La pregunta al escribir un componente:** ¿qué campos lee? Ésa es la firma. Pedir el
contenedor entero «por comodidad» es lo que después impide reusarlo.

### Dos trampas de esta tanda que no caza ningún test

1. **`icon: 'chart'` no existe** en `app/_components/icons.tsx` y no falla: dibuja un punto.
   Es la misma familia que `var(--token)` inexistente, que hereda y vale 0. Todo nombre que
   indexa un catálogo se verifica contra el catálogo, no contra la memoria.

2. **Un script que inserta al final de un tipo con `index('\n};')` puede caer en el tipo
   siguiente.** `Label` termina con `recurrencia?: string | null };` —el cierre en la MISMA
   línea que su último campo—, así que el siguiente `\n};` era el de la constante `ESCALERA`
   veinte líneas más abajo: dos campos de un tipo quedaron adentro de un objeto de datos.
   Da error de sintaxis y se arregla en un minuto; lo que enseña es que **un script que
   edita código fuente valida su salida antes de escribirla** (ya está en AGENTS.md) y que
   `tsc` es el primer comando después de cualquier edición automatizada.

### Lo que quedó SIN hacer

- **`listTareas` / `listCategorias` (lib/todo.ts) NO paginan**: un `.select('*')` suelto, que
  PostgREST corta en 1000 filas sin un solo error. Hoy el workspace más grande tiene 212
  tareas, así que no muerde — y lo que caiga el día que muerda deja de existir para el
  tablero del cliente y para Customer Success, sin síntoma. La cura es `leerTodo`
  (`lib/supabase-paginado.ts`), paginando por `id`.
- **`Date.now()` adentro del `useMemo` de `app/plan/board/Graphics.tsx`** (línea ~47) es un
  error de `react-hooks` que ya estaba y no se tocó: es de antes de esta tanda.

## La portada de un proyecto: el quinto campo por las mismas seis puertas (27/09/2026)

«Quiero que los proyectos también tengan portada» (mig 0173).

**Vive en:** `app/plan/board/types.ts` (`Label.portada`) · `lib/plan-board.ts`
(`rowToLabel` / `labelToRow`) · `app/plan/board/desde-todo.ts` (`toLabel`) · `lib/todo.ts`
(`Categoria`, `catRow`, `crearCategoria`, `editarCategoria`) · `app/api/todo/route.ts` (el
tipo del patch) · `app/plan/TodoBoard.tsx` (`createLabel` / `saveLabel`) ·
`app/plan/board/BoardShell.tsx` (`ProyectoCardTile`, `CampoPortada`) ·
`lib/portadas.ts` · `tests/portada-proyecto.test.ts`

Es el quinto campo que pasa por la cadena de AGENTS.md («El tablero es UNO y las tablas son
DOS») después de la prioridad a mano, el Quarter (0162), la recurrencia (0164) y el cliente
(0172). No hay nada nuevo que contar del mecanismo: lo nuevo es que **ahora está fijado por
un test que se probó rompiéndolo**, una rotura por vez, con los números en la cabecera del
archivo (8 roturas, 9 pasan / 1 falla cada una). Antes la cadena se sostenía con
comentarios, y los comentarios no cazaron ninguna de las cuatro veces anteriores.

### Una inserción por TEXTO cae en el tipo gemelo, no en el que querías

`BoardTask` y `Label` terminan los dos con exactamente el mismo comentario de
`clienteNombre` y el mismo `};`. Un `replace` anclado ahí puso `portada` en **`BoardTask`**,
que es el tipo equivocado, y el error que salió fue «Property 'portada' does not exist on
type 'Label'» en otros cuatro archivos — o sea que el síntoma no nombra el archivo donde
está el problema.

Pasó dos veces en la misma sesión: la segunda fue `onPortada: () => void;` anclado en
`  onAsignarCliente: () => void;`, que en `TaskModal` es el PREFIJO de una línea más larga,
así que la prop del proyecto terminó en el modal de la tarea.

**La regla: si dos tipos hermanos comparten la cola, el ancla no puede ser la cola.** Se
ancla en algo que sólo tenga uno (el comentario propio de ese tipo), o se usa `rindex`. Y
si el tipo gemelo es el problema estructural, **hacé que dejen de ser gemelos**: el campo
nuevo de `Label` lleva ahora un párrafo que dice por qué es del proyecto y no de la tarea,
que además es la respuesta a la pregunta que alguien se va a hacer.

### Una portada por TAREA no se hizo, y es una decisión

En un Kanban de 396 tareas, una banda por tarjeta es una pared de fotos donde hoy se lee un
título. El proyecto es el contenedor y es el nivel donde una imagen identifica algo. Está
escrito en el campo, para que el próximo que lo piense encuentre la respuesta.

## El tablero no siempre es LA pantalla: `embebido` (27/09/2026)

**Vive en:** `app/plan/board/BoardShell.tsx` (`embebido`, `onRecargar`, `Marco`,
`scrollerDe`) · `app/plan/PlanBoard.tsx` · `app/plan/TodoBoard.tsx` ·
`app/plan/board/useBoard.ts`

`BoardShell` se escribió asumiendo que ES la ruta. Desde el 26/09 también se monta adentro
de la ficha de un cliente (Customer Success), y ahí ese supuesto es falso en cinco lugares
distintos. El detalle del caso entero está en
[hallazgos-customer-success.md](hallazgos-customer-success.md); acá quedan las dos cosas
que son del TABLERO y que valen para cualquier otro sitio donde se lo monte.

### Lo que un componente «pantalla» toca sin decirlo

Al montarlo adentro de otra cosa, lo que hay que ir a buscar es todo lo GLOBAL: la URL,
`localStorage`, `document`/`window` listeners, `<main>` y los altos en `vh`,
`window.location.reload()`, y los pop-ups que se auto-abren al entrar. En este caso fueron
los cinco. Un barrido de cinco lentes en paralelo los encontró en veinte minutos y descartó
otros cuatro que sonaban peor y no lo eran (la copia del arrastre va por
`document.body.appendChild`, los desplegables van por portal con z alto, el `position:fixed`
no lo contiene ningún ancestro transformado, y el `overflow:hidden` del modal no recorta a
un descendiente cuyo bloque contenedor es un ancestro suyo).

### El auto-scroll del arrastre scrolleaba la VENTANA

`empujarScroll` decidía con `window.innerHeight` y empujaba con `window.scrollBy`. Adentro
del modal, el `Modal` de la casa puso `document.body.style.overflow = 'hidden'` y el que
scrollea pasa a ser `.mk-modal__cuerpo`: agarrabas una tarjeta, la llevabas al borde y no
pasaba nada. Es literalmente el bug que AGENTS.md ya tiene medido para `/plan` («19.630 px
de tablero contra una ventana de 900, sin auto-scroll en el camino del mouse»), reproducido
un nivel más adentro.

Ahora resuelve el scroller real subiendo por el DOM (`scrollerDe`), **una sola vez, en el
`dragstart`**: durante un arrastre el navegador congela `rAF` y los timers y lo único que
sigue entregando es `dragover` — no es momento de caminar el DOM en cada evento. Y el borde
se mide contra la caja del que scrollea, no contra el viewport. Cuando el scroller es la
página, el comportamiento es idéntico al de antes.

### Las preferencias locales llevan el CLIENTE en el scope

`scope` era `'agencia'` fijo, así que el filtro que quedó puesto en `/plan` («solo el
proyecto P33») se aplicaba adentro de la ficha, donde ese proyecto casi nunca está: el
tablero del cliente aparecía vacío y se leía como «no tiene nada asignado» — una afirmación
falsa sobre su cartera. Es el mismo bug que `prefs.ts` documenta entre workspaces, un nivel
más adentro.


## Montar el tablero de OTRO workspace: el ws no viaja por el componente, viaja por la PESTAÑA

⚠️ **LA PREMISA DE ESTA SECCIÓN MURIÓ EL MISMO DÍA, unas horas después: la ficha NUNCA
tuvo que mostrar el tablero del cliente.** Lo que va abajo se midió y es cierto, pero
describe un problema que el producto no tiene — se lee como autopsia, no como el estado
del código. Los archivos que nombra ya no existen (`lib/tablero-de-workspace.ts`,
`app/api/admin/tablero/route.ts`, `app/admin/TableroDelCliente.tsx`, el bloque `wsDeTrabajo`
de `lib/ws-tab.ts` y el override de `WsFetch.tsx`). **La corrección está en la sección
siguiente, que es la que hay que leer.** Sobrevive entero lo de `tableroDeCapa`, lo de las
props que no son capacidades y lo del `as`.

Cosechado el 28/09/2026, del pedido «aun no veo el plan, las tareas y proyectos de cada
cliente» sobre la ficha de un cliente en el panel de la plataforma. Salió de un relevo de
4 lectores + refutación, y el resultado cambió el plan: lo que parecía «montar el board
como ya lo hace Customer Success» era una escritura cruzada de inquilino.

**Vive en:** `lib/tablero-de-capa.ts` · `lib/tablero-de-workspace.ts` · `app/api/admin/tablero/route.ts` · `app/admin/TableroDelCliente.tsx` · `app/plan/board/Tablas.tsx`

### El diagnóstico obvio era el equivocado: el Repo no es por dónde se escribe

`BoardShell` recibe un `Repo`, y el Repo tiene UN solo `fetch` por tablero (`api()` en
`TodoBoard`, `apiPlan()` en `repo-plan.ts`). Eso invita a pensar que parchear ese `fetch`
alcanza para que las escrituras caigan en otro workspace.

**No alcanza: son 24 `fetch` en 11 archivos.** Los 2 de los Repos más **22 que el board
dispara por su cuenta**, contra 8 rutas distintas — `/api/plan-buscar`,
`/api/plan-propuesta`, `/api/mako-guardian`, `/api/checklist-coach`, `/api/plan-dictado`,
`/api/plan-fathom`, `/api/plan-reunion` y `/api/portadas` —, más dos llamadas a `apiPlan`
fuera del Repo. Ninguno de esos 22 sabe nada del Repo.

Y el workspace de todos ellos **no sale del componente**: sale de la URL de la pestaña
(`WsFetch` lee `?ws=`, `proxy.ts` lo valida contra la cookie firmada y lo traduce al
header interno). Parchear 2 de 24 deja 22 escribiendo en el inquilino equivocado.

### Y la escritura equivocada no falla: CLONA

`lib/plan-board.ts` hace `upsert` con `onConflict: 'workspace_id,id'`. Con el workspace
del que MIRA, arrastrar una tarjeta del cliente no edita su tarea: **le inserta una copia
al tablero del super admin**. HTTP 200, sin error, y la fila duplicada en otro inquilino.
Los `delete`/`update` son peores de ver: se convierten en no-ops de 0 filas.

**La regla que queda: antes de montar una pantalla que escribe adentro de otra, no cuentes
los endpoints del contrato — contá los `fetch`.** Un `grep -c "fetch("` sobre el subárbol
del componente es la medición, y la diferencia entre 2 y 24 es la diferencia entre un
parche y un agujero.

### `runWithWorkspace` mueve de dónde se LEE, no la SESIÓN

La forma natural de leer el tablero de otro workspace es envolver lo que ya existe:
`runWithWorkspace(13, () => filasDeTodos())`. Compila, corre y devuelve `[]`.

Porque adentro, `tableroActual()` sigue preguntando por QUIEN MIRA («soy admin y no estoy
impersonando» → `'dueno'`), así que lee `plan_tareas` del ws13 — que tiene **cero filas**.
Sin un error, sin un log, y con la ficha diciendo «este cliente no tiene trabajo». Es el
mismo bug del 26/09 con las tablas invertidas, servido por el otro lado.

**Son dos preguntas distintas y ahora son dos funciones:** `tableroActual()` contesta por
el que mira y `tableroDeWorkspace(ws)` por el mirado. Si una lectura cruza de inquilino, la
segunda es la única que sirve.

⚠️ **Y el predicado estaba escrito CINCO veces** —`app/api/agente/plan/route.ts`,
`lib/plan-propuesta.ts`, `lib/reunion-auto.ts`, `lib/api-mako/areas/plan.helpers.ts` y
`lib/mako-tools.ts`—, siempre como `(await getWorkspace(ws))?.capa === 'superadmin'`.
Nadie lo importó de nadie por una razón concreta: **la versión que ya existía vivía detrás
de `server-only`**, así que no se podía testear ni compartir, y cada uno la reescribió.
Cuando veas la misma línea por tercera vez, mirá si la original no está atrapada detrás de
una directiva.

### «La prop ES la capacidad» estaba escrito en el archivo, y el archivo lo violaba

`Tablas.tsx` documenta la regla con todas las letras: sin `onSoltar` la fila no se puede
agarrar, sin `onEliminar` no dibuja el tacho. Y dos de sus propios controles la salteaban:
el tilde de completar (`board.toggleDone`) y la celda de fecha (`board.setDeadline`)
llamaban al board directo. Mientras la tabla vivió sólo adentro del tablero no se notó
—ahí todo se puede escribir—; se notó en cuanto la montó alguien que no puede.

⚠️ **Y hay un tercer caso que NINGUNA prop ausente puede apagar: la SELECCIÓN.** Es estado
interno de la tabla (`useState`) y la barra de acciones la monta ella misma. Medido en el
navegador: una tabla montada sin una sola capacidad de escritura igual dejaba tildar una
fila y ofrecía **«Completar · Eliminar · Mover · Prioridad»**. Para eso no sirve la regla
de la ausencia y hace falta un flag explícito (`soloLectura`), que además apaga la COLUMNA
y no sólo la barra: una casilla que se tilda y no habilita nada es peor que ninguna.

⚠️ **Al volver props tres capacidades, el typecheck NO avisa de los call sites viejos**,
porque las props nuevas son opcionales. Los tres call sites del tablero real se enchufan a
mano y se cuentan (`grep -c`), o el tablero se queda mudo sin que nada falle. Es
literalmente «escribir la salida no es ofrecerla», del lado del que la saca.

### Un `as` entre dos tipos que no se parecen es una afirmación, no una conversión

El server devolvía las FILAS de la base y la tabla esperaba el modelo del board. El
`trabajo.tareas as BoardTask[]` compila perfecto —los dos son objetos y TypeScript acepta
el cast— y la pantalla revienta al dibujar con **«Cannot read properties of undefined
(reading 'includes')»**, porque una fila no tiene `labels`. El error no nombra ni el campo
ni el mapper: sale desde un chunk del board.

Lo delata la cadena de mappers: el tablero del cliente va de fila a modelo en DOS pasos
(`rowTo` → `toBoard`) y el del dueño en uno (`rowToTask`). Saltarse el segundo compila.

### Lo que quedó SIN hacer

- **No se puede editar el tablero de un cliente desde la ficha**, y es a propósito (todo lo
  de arriba). Si algún día tiene que poderse, lo que hay que resolver primero es que el ws
  viaje con el SUBÁRBOL y no con la pestaña — y no sirve un global mutable: el propio panel
  hace fetch mientras el detalle está abierto, así que sería una carrera con escrituras
  cayendo en el inquilino equivocado. Vive en `app/admin/TableroDelCliente.tsx`.
- **Tres cosas rotas del board que se van a hacer visibles en cualquier embed**, y que el
  relevo encontró de paso: `DependenciasBloque` se dibuja sin que el Repo lo soporte
  (`BoardShell.tsx:4033`), `ampliarTareas` ausente descarta filas en silencio
  (`BoardShell.tsx:1064`) y `ProyectoVacioBloque` tiene `/api/plan-board` cableado adentro
  (`BoardShell.tsx:2965`) — o sea un endpoint adentro de un componente compartido, que es
  justo lo que la regla de la casa prohíbe.
- **`onMako` es un prop obligatorio de `ProjectDetailModal` que el componente no usa**, con
  dos call sites que se lo pasan. Vive en `app/plan/board/BoardShell.tsx`.
- **El detalle de un proyecto no se abre desde la ficha** (el `onOpen` es un no-op): abrirlo
  sería montar media pantalla más para no poder tocar nada. Queda anotado, no hecho.

## La ficha de un cliente muestra MI trabajo sobre él, no el suyo (28/09/2026)

Cosechado el mismo día que la sección de arriba y en contra de ella, del reporte textual:
«**estás trayendo las tareas y proyectos de ese cliente, cuando tenés que traer los de
SUPER ADMIN relacionados a ese cliente. No tiene sentido eso. No entiendo en qué punto
asumiste que era así**».

**Vive en:** `app/admin/AdminView.tsx` (`TableroDelCliente`) · `app/customer-success/page.tsx` · `app/plan/board/BoardShell.tsx` (`vistaExtra`)

### El diagnóstico obvio era el equivocado, y me costó una jornada entera

«No veo el plan de cada cliente» tiene dos lecturas y agarré la que sonaba más difícil.
Gasté un relevo de 4 lectores, una refutación, una migración de pensamiento sobre escritura
cruzada de inquilino, un endpoint, una lib, un componente y un test — **todo para un
problema que el producto no tiene**. La lectura correcta era la barata: el tablero de la
ficha es el MÍO filtrado por ese cliente, igual que la ficha de un lead ganado en Customer
Success. Same-tenant. Cero escrituras cruzadas. Cero `?ws=`.

**Lo que tendría que haberme frenado estaba a la vista y no lo miré:**

1. **La ficha ya tenía «Inspeccionar»**, que es exactamente «ver el mundo de ese cliente».
   Si la tab de al lado del botón hace lo mismo que el botón, una de las dos está mal —
   y la que está mal es casi siempre la que estoy construyendo, no la que ya funciona.
2. **La pantalla hermana ya lo resolvía.** Customer Success muestra, para un lead ganado,
   el trabajo del que mira atribuido a ese cliente. Si dos pantallas del mismo producto
   muestran «el cliente X» y una necesita cruzar de inquilino y la otra no, el modelo de la
   que cruza es el sospechoso.
3. **El pedido decía «los de SUPER ADMIN».** Lo leí como una aclaración de permisos y era
   una aclaración de *sujeto*.

**La regla que queda: cuando una feature pide una máquina nueva y grande, buscá primero
qué pantalla del producto ya hace algo que se le parece.** Si existe y es simple, la
diferencia no es que la tuya sea más difícil: es que entendiste otra cosa. Y el costo de
preguntar es una frase; el de asumir fue todo lo que se borró.

### Las filas ya están en el HTML: no hay fetch, no hay loader

El otro reporte del mismo día: «**tarda un montón en cargar sus tareas, cuando ya habíamos
dicho que debe quedar registro y ser automático. No entiendo por qué retrocedés en los
avances que ya habíamos hecho**».

Tenía razón y el bug era estructural, no de velocidad: el tablero se pedía **al abrir la
ficha**, por un endpoint, por cliente. Con el modelo correcto el trabajo del super admin es
**uno solo** —el suyo— y ya lo lee el server de la pantalla (`filasDeTodos()` en
`page.tsx`), así que viaja con el HTML y se reparte en memoria por `porCliente[leadId]`.
Abrir una ficha dejó de ser una petición.

⚠️ **Y si algo se carga, el contenedor NO puede cambiar de tamaño.** «El detail SIEMPRE
debe ser del mismo tamaño, no achicarse. Y mostrar un loader.» Un modal que nace chico con
el mensaje de carga y crece al llegar los datos mueve todo lo que la persona estaba por
clickear. El ancho es una constante (`ANCHO = 1560`) y el estado de carga se dibuja
adentro, nunca en lugar del contenedor.

### Una vista más del board, no una segunda fila de tabs

«**Pusiste 2 seleccionables de tabs, arriba "tablero y equipo" y abajo las otras cuatro.
Eso no tiene sentido: tenés que quitar lo de arriba, y simplemente agregar "Equipo" luego
de "Recurrentes"**.»

Es el error clásico de componer por composición: el board ya trae su selector de vistas
(Prioridades · Kanban · Tabla · Recurrentes) y yo le monté OTRO selector encima para elegir
entre «el board» y «el equipo». Dos barras de tabs en la misma pantalla, a 8 px una de la
otra, y la persona tiene que aprender cuál manda.

La cura fue abrirle una puerta al selector que ya existe: `BoardShell` acepta
`vistaExtra?: { id, label, contenido }`, el switcher mapea `[...VISTAS, vistaExtra]` y el
cuerpo dibuja su contenido cuando está elegida. **Una sola fila, y «Equipo» es una vista del
board como las otras cuatro.**

⚠️ **El tipo de `view` deja de ser la unión cerrada.** `Vista` era `'prioridades' | 'kanban'
| …`; ahora es `Vista | string`, porque el id de la vista extra lo pone el call site. Eso
apaga el chequeo de exhaustividad del switch: si mañana alguien agrega una vista al enum y
se olvida de un `case`, el compilador ya no avisa. Es el precio, está anotado, y el cuerpo
tiene un `default` que no dibuja nada en vez de romper.

### Lo que quedó SIN hacer

- **El detalle de un proyecto abre a 1180 px** (era 820) porque los textos de un proyecto no
  entraban. Vive en `app/plan/board/piezas.tsx` (`MODAL_DETALLE`). No se midió contra
  pantallas de 1280: en un portátil chico el detalle ocupa casi todo el ancho.
- **`CabeceraDetalle` es la segunda de tres copias fusionadas.** La tercera es `FichaCliente`
  (Customer Success), que sigue dibujando su propia cabecera a mano. Vive en
  `app/customer-success/FichaCliente.tsx`.
- Sigue abierto todo lo de la sección anterior que no dependía de la premisa muerta:
  `DependenciasBloque` sin soporte del Repo, `ampliarTareas` descartando filas en silencio,
  y `ProyectoVacioBloque` con `/api/plan-board` cableado adentro.

## Un `<input>` no mide su texto: su ancho sale de la FUENTE (29/09/2026)

Cosechado del reporte «mira como se corta el título de "Vender MaKo: Oferta y precios"»
sobre el detalle de un proyecto. Salió de un relevo de 8 lectores, y el que midió esto
corrigió de paso mi propia medición: yo había comprobado en Chromium que **no** se
cortaba.

**Vive en:** `app/plan/board/BoardShell.tsx` (`ProjectDetailModal`) · `app/_components/CabeceraDetalle.tsx` · `app/_components/EditableInline.tsx`

### El ancho de un input no tiene nada que ver con lo que dice

`.cd-txt` es `flex: 0 1 auto`, así que se dimensiona al `max-content` de sus hijos. El
`max-content` de un `<input>` con `width:100%` **no es el ancho de su texto**: es el que
sale del atributo `size` (20 por default), contado en **avances del dígito «0» de la
fuente activa**. El `width:100%` es inerte en esa cuenta.

Medido con la misma fila a 1180 px:

| | ancho de `.cd-txt` |
|---|---|
| con «Feature: CRM» (texto de 128,2 px) | **298 px** |
| con «Vender MaKo: Oferta y precios» (285,7 px) | **298 px** |

No cambia con el texto. Y el número depende de la FUENTE: 308 px de borde-caja con Geist
600/20 y **275 px con la fallback**.

### Por qué yo lo vi bien y el dueño lo vio cortado

Con `.cd-txt` en 298 y el `paddingLeft:10` del input, la caja de texto queda en 288:

- **Chromium: sobran 2,3 px.** No se corta. Eso es lo que medí y por eso di verde.
- **WebKit: el intrínseco es 297 en vez de 308** → caja de 277 → **faltan 8,7 px**. Media
  «s», que es exactamente la captura.
- **Con la webfont sin llegar** (FOUT, `display=swap`): intrínseco 275 → caja 255 →
  **faltan 30,4 px**, mientras el texto en Arial mide casi lo mismo que en Geist.

**La regla que queda: un margen de 2 px no es «entra», es «entra por casualidad».**
Verificar en un solo motor un layout cuyo ancho sale de una métrica tipográfica da verde
sobre algo roto — y lo mismo pasa entre el primer paint y el segundo.

Y no era un nombre desafortunado: sobre los 70 del catálogo, **cuatro ya se cortaban**
(«Feature: Configuraciones y equipo», −33,1 px) y otros tres pasaban por menos de 20.

### Y una SEGUNDA causa que se suma, en la misma línea

`tituloEditable` trae `padding:0, paddingLeft:10, marginLeft:-10`. Con el padre
dimensionándose al hijo se arma un lazo: contribución del input = borde-caja(308) +
margen(−10) = 298 → `.cd-txt` = 298 → `width:100%` = 298 de borde-caja → contenido = 288.
**El padding se descuenta dos veces.**

⚠️ Eso invalida el arreglo que parecía más limpio: `field-sizing: content` SOLO deja la
caja en 275,7 para un texto de 285,7 — **se corta en los dos motores**, peor que antes. Y
tampoco puede ir en la constante: `tituloEditable` la comparten el input del proyecto y
el `<textarea rows={2}>` del título de una tarea, que con `field-sizing` colapsa de 57,2
px de alto a 28,6.

### La cura fue dejar de usar un input

`EditableInline` es un `contentEditable` y ocupa **exactamente lo que dice**, así que la
columna mide el TEXTO (medido después: 286 px, que es el ancho real). De paso es la misma
pieza que ya usan las otras dos fichas, así que las tres editan el nombre igual — y un
span sí puede recortar con «…», cosa que un input no.

⚠️ **`EditableInline` avisa de cualquier texto que CAMBIÓ, y «» cambió.** El guard de
vacío no se puede omitir: sin él, seleccionar todo y borrar deja el proyecto sin nombre.

### Partir la cabecera para que la columna derecha empiece arriba

«Haz que la sidebar llegue hasta el tope de la portada… así evitamos que tenga scroll.»
`CabeceraDetalle` se sirve en tres piezas: `PortadaDetalle` (la banda), `FilaDetalle` (el
renglón del nombre) y el combo con la misma firma para quien no necesita separarlas. El
detalle del tablero monta la banda a lo ancho y la fila DENTRO de la columna izquierda.

Medido: la columna derecha pasó de `y=258` a `y=191` y de 570 px de alto a **636**.

⚠️ **El `minHeight:0` del scroller no es defensivo, es la feature.** Sin él el hijo crece
a su contenido, la columna crece con él y el que termina scrolleando es el MODAL — o sea
que el título se va de la pantalla, que es lo contrario de lo que se pidió.

⚠️ **Y el padding se MUDA, no se duplica.** Si el `padding:'20px 22px'` se queda en la
columna, la fila arranca en x=22 y su `paddingLeft` deja de alinear con el `left:20` de la
marca, que vive en la otra pieza.

### Lo que quedó SIN hacer

- **Hay tres estilos para el mismo renglón del nombre**: `.cd-nombre` (20px/600/−.01em, el
  del tablero) y `.fw-nom` + `.fc-ed-nom` (20px/670/−.02em), que entre ellas son la MISMA
  regla. Unificarlos mueve algo que el dueño ya aprobó mirándolo, así que es una decisión
  suya y no un refactor: va en las tres o en ninguna.
- **El detalle abre a 1180 px y no se midió contra pantallas de 1280.**

## Un tablero se revisa contra el CÓDIGO, y «muchas ya están» fueron dos de trece (30/09/2026)

Cosechado del pedido «marca como completo todas las tareas que ya estén… cierra las que ya
estén, hay muchas que ya están», sobre el proyecto «Feature: Plan». Salió de 13 lectores
—uno por tarea abierta— con refutación adversarial sobre las que se proponían cerrar.

**Vive en:** el proyecto `board-plan-perro` del ws9 · `lib/plan-board.ts` (`cerrarPlanTareaOwner`)

### El resultado, y por qué no coincide con la sensación

| veredicto | cuántas |
|---|---|
| **hecha** (y sobrevivió al refutador) | **2** — #475 y #812 |
| a medias | 6 — #53, #158, #768, #769, #770, #813 |
| no hecha | 5 — #157, #766, #793, #794, #795 |

La sensación de «hay muchas» no estaba equivocada: **las seis a medias tienen una mitad
hecha de verdad**, y en varias la mitad grande. Lo que fallaba era el TÍTULO, que seguía
nombrando el trabajo entero. Por eso el cierre correcto de esas seis no es cerrarlas: es
**reescribir el título para que nombre lo que falta**, y dejar en el historial qué se
verificó hecho. Un título que promete más de lo que queda hace que el tablero se lea como
si nada avanzara.

**La regla que queda: para saber si una tarea está hecha se lee el «Listo cuando», no el
«Qué ya está».** El primer párrafo de un detalle casi siempre describe la mitad hecha, y
leerlo como veredicto es cómo se cierran tareas vivas.

⚠️ **Y una función escrita no es una función enchufada.** El grep que vale es el de los
CALL SITES. Cuatro de las cinco no-hechas son la misma cadena del criterio de Mauricio:
el juez existe entero, con 16 tests, y no lo llama nadie fuera de un script de prueba.

### El detalle del proyecto citaba ocho tareas que no llevan a ningún lado

De las 10 que nombraba en «Qué falta»: **cuatro no existen** (#25, #154, #149, #92) y
**cuatro existen pero ya no están en este proyecto** (#152 —hecha—, #153, #155, #164). Y
no mencionaba ninguna de las cuatro del criterio, que son las de score más alto. Es el
mismo problema que la auditoría del 24/09 midió a escala (155 de 260 citas apuntando a la
nada), servido en el proyecto más alto del tablero.

### Cerrar desde un script se hace con la función del repo, no con SQL

`cerrarPlanTareaOwner` escribe el historial con actor `ia` y la evidencia, y tilda la
checklist entera —dejar ítems abiertos en una tarjeta al 100% hace que el avance de la
tarjeta y el del proyecto digan cosas distintas—.

⚠️ **Y todo va envuelto en `runWithWorkspace(9, …)`.** `enPlan` cae a `OWNER_WS` cuando no
hay contexto de request, y en un script nunca lo hay: sin el envoltorio, un cierre del
tablero del super admin se escribe en el de Mauricio.

⚠️ **Y LA PRUEBA SE CORTA EN SILENCIO A LOS 219 CARACTERES (medido el 06/10/2026).** El
borrador acepta una prueba de hasta 400 (`lib/plan-propuesta.ts:250`), pero el cierre la
escribe en el historial como `MaKo la marcó hecha: <prueba>` y corta el renglón ENTERO en
240 (`lib/plan-board.ts:488`, y el mismo `.slice(0, 240)` en `lib/plan-propuesta.ts:732`).
O sea que una prueba de 220 a 400 caracteres pasa el saneo, se aplica sin error y queda
partida a la mitad en la tarjeta. En el borrador del Chatbot eran 3 de 16 (227, 233 y 420
caracteres); se acortaron antes de aplicar. Es «un tope se aplica ANTES de decidir, y lo que
recorta queda escrito» (AGENTS.md), y acá no se cumple ninguna de las dos mitades.

~~**SIN HACER:** un solo tope en una constante, que use el saneo del borrador y el renglón del
historial.~~ **Hecho el 07/10/2026** (`6641b6d8`), con el pedido «Unificar el tope de la prueba al
cerrar una tarjeta». `TOPE_PRUEBA_CIERRE` (400) en `lib/cierre-tarjeta.ts`, sin `server-only`: lo
usan el saneo del borrador, los DOS escritores del renglón (super admin y cliente) y la definición
de la API de MaKo, que tenía el 400 copiado a mano. El prefijo ya no le come lugar a la prueba
—se recorta la prueba, nunca el renglón—, y una prueba que pasa del tope termina en «…» en el
borrador, que es donde la persona la lee antes de confirmar. Lo fija
`tests/cierre-tarjeta.test.ts` (ocho roturas, todas cayeron).

⚠️ **Lo que el diagnóstico no decía: el 240 no protegía NADA.** Ni `sanearHist` (super admin) ni
`histOk` (cliente) recortan el texto de un renglón, y la tarjeta lo dibuja entero con salto de
línea. Era un número que sólo cortaba la prueba. Por eso el tope único es el del borrador, y no
el del renglón: bajarlo a 219 habría tirado evidencia para respetar un límite que no existe.

### Lo que quedó SIN hacer

- **Las seis a medias siguen abiertas con el título nuevo.** Ninguna se cerró: cerrar algo
  a medias borra del tablero el trabajo que falta.
- **El relevo corrigió mi propio arreglo de una hora antes** (ver
  `docs/hallazgos-comunicacion.md`). Un lector que mide el código de AHORA encuentra lo que
  acabás de escribir: es una ventaja, y hay que leer sus veredictos sabiendo que la mitad
  puede estar hablando de algo que ya cambió.


## El criterio estaba construido y APAGADO, y otras nueve del mismo día (30/09/2026)

Cosechado de «¿tienes toda la info necesaria para cerrar las tareas que quedan? Hazlo
todo». Eran once abiertas del proyecto «Feature: Plan»; quedó UNA, bloqueada por algo
que no es código.

**Vive en:** `lib/plan-criterio*.ts` · `lib/reunion-auto.ts` · `lib/plan-recurrentes-*.ts`
· `lib/todo.ts` · `lib/ia-cuotas*.ts` · migs 0184 y 0185

### Un módulo que sólo se puede LEER es un módulo apagado

`plan.criterio` tenía **un lector y CERO escritores en todo el repo**. El juez que lo
consume estaba entero, con 16 tests, y ningún workspace tenía el criterio cargado — así
que la feature más alta del tablero no podía correr ni una vez. No había bug: faltaba la
mitad del camino, y ninguna herramienta lo dice.

⚠️ **El grep que lo encuentra es el de los ESCRITORES, no el del nombre.** `KEY_CRITERIO`
aparecía tres veces y todas en el mismo archivo. La pregunta que lo destapa es «¿quién
ESCRIBE esto?», y se contesta en diez segundos.

### Un docstring puede describir un camino que el orden del código no alcanza

`juzgarConCriterio` dice, textual, «sin candidatas TAMBIÉN se juzga: una reunión de la
que el extractor no sacó nada puede tener compromisos que faltan». Era cierto de la
función y falso del pipeline: la llamada estaba **después** del `if (!tareas.length)
continue`, así que la reunión que el extractor leyó vacía se cerraba PARA SIEMPRE —esa
rama escribe el candado— sin que el juez la mirara. El docstring no miente sobre la
función; miente sobre el sistema, que es lo que uno lee.

### Agrupar por la CITA, que es una posición en el texto, no una paráfrasis

El documento de Mauricio advierte —y es su advertencia más fuerte— que emparejar
compromisos por parecido de palabras «no funciona y produce métricas falsas»: «análisis
de la marca de empleador comparando ofertas de la competencia» y «benchmark de
condiciones laborales frente a la competencia» son el mismo compromiso y casi no
comparten vocabulario. Su salida era que el agrupamiento lo hiciera un modelo.

No hizo falta, por una propiedad que su pipeline no tiene: acá **cada compromiso llega
con su cita ya verificada contra la transcripción**. O sea que tiene un ANCLA — el lugar
de la conversación donde se dijo. Dos corridas que encontraron lo mismo citan el mismo
momento por más distinto que lo redacten. Gratis, determinista, y cubre exactamente el
caso que el léxico no puede. El dueño entra en la clave porque dos personas pueden tener
una entrega propia cada una en la misma frase (la regla 1 de su criterio).

**La regla que queda: antes de pagar un modelo para comparar dos textos, preguntá si los
dos apuntan a un mismo TERCER objeto que sí se puede comparar exacto.**

### ⚠️ UN `select` DE POSTGREST CON UNA COLUMNA QUE NO EXISTE RECHAZA LA CONSULTA ENTERA

Y el error no sube si nadie lo lee: `data` vuelve `undefined`, la lista queda en `[]`, y
el código sigue como si la fila no tuviera hijas. El generador de recurrentes pedía
`deadline, progress, progreso` porque **la columna del avance se llama distinto en cada
mitad del tablero** (`progress` en el del dueño, `progreso` en el del cliente) — no se
pueden pedir las dos.

Lo que lo vuelve caro: **el índice único lo tapaba**. El insert rebotaba con 23505, el
código lo trataba como «ya existía» y la prueba decía «no duplicó». Era cierto, y por la
razón equivocada: la lógica estaba rota y el candado de la base la salvaba. Lo único que
lo mostró fue imprimir un CONTADOR —`conAbierta: 0` sobre una plantilla que sí tenía una
instancia abierta— que no cerraba con la realidad.

**Un candado en la base que salva a una lógica rota es un verde sobre la propiedad
equivocada.** Cuando un test pasa gracias a una guarda de integridad, no probó lo que
creés: probó la guarda. Y el contador que no cierra es lo que lo delata, así que un
proceso que decide vale lo que cuentan sus contadores.

### Un guard que lee el archivo ENTERO encuentra lo que el archivo dice DE SÍ

El test de los seis lugares de un campo preguntaba `assert.match(TODO, /notas:/)` y dio
**VERDE sobre CUATRO DE LAS CINCO roturas**: `notas:` aparece también en `Categoria`, en
`toLabel`, en los comentarios y en la línea que pasa el valor. Y el assert de al lado
—`doesNotMatch(MIG, /default \d/)`— fallaba contra **su propio comentario**, el que
explica por qué no hay default.

La cura es extraer el BLOQUE antes de buscar (la función, el tipo, la sentencia SQL). Y
la razón por la que se encontró es la de siempre: se probó rompiéndolo, una rotura por
capa. Un guard de seis capas que no dice CUÁL se rompió tampoco sirve de mucho: cada
capa lleva su test.

### Lo que la BASE no te deja hacer mal, y es un regalo

La FK de una instancia hacia su plantilla no se podía crear: la PK de `plan_tareas` es
**compuesta** (`workspace_id, id`) y Postgres contesta «there is no unique constraint
matching given keys». Escribirla entera —`(workspace_id, recurrente_de)`— da gratis el
guard que importa: una instancia no puede colgar de la plantilla de OTRO inquilino. Un
error del motor que empuja al diseño correcto.

### Tres decisiones que valen más que el código que las implementa

- **Una instancia abierta por vez.** Doce «grabar contenido» apiladas son el tablero que
  nadie mira que la feature vino a evitar.
- **Se saltean las perdidas.** Cron caído tres días: nace UNA, con la fecha de la última
  vencida. Con la primera, la serie se arrastra atrasada para siempre.
- **«El 31 de cada mes» SALTEA febrero**, no se corre al 28. Correrlo pone la tarea un día
  que nadie eligió, y en silencio. La mig 0167 ya había dejado escrito que entre las dos
  salidas nadie tomó la decisión; saltear es la única que no miente sobre la fecha.

Las tres viven en una función PURA (`queGenerar`) y no adentro del módulo con
`server-only`: una condición que decide qué se ESCRIBE necesita test, y un `server-only`
no lo puede importar ninguno.

### Lo que se dibuja y no se guarda: cinco campos, cero filas

`notas`, `deadline_razon` y `hacelo_en` tenían columna desde las migs 0114 y 0115 y
**ninguna fila de `experimento_tareas` tenía algo escrito**. El panel los dibuja para los
dos tableros; del lado del cliente faltaban CINCO de los seis lugares. No hubo backfill
que hacer: no se perdió nada, nunca se guardó.

⚠️ **Lo único que funcionaba era la lectura, y de casualidad:** `rowTo` castea la fila
entera, así que el valor llegaba en runtime mientras el tipo no lo declaraba. Un cast de
fila entera esconde exactamente esta clase de agujero — lo que falta no da `undefined`
en el tipo, da un `string` que miente.

### Y lo que NO se hizo, a propósito

- **El chip de tiempo NO volvió a la tarjeta del Kanban.** La tarjeta #158 lo pedía y el
  dueño lo había sacado de ahí el 25/09 con todas las letras («quita los íconos de subió
  de prioridad o bajó»), con el motivo medido: la card mide 249px y cada ícono le come
  ancho al nombre del proyecto, que es lo que él reclamó dos veces. Fue al DETALLE y a
  las tools. **Lo que el dueño decidió es una restricción del problema, no una opción.**
- **El juez corre en la cascada GRATIS.** El documento de Mauricio pide Claude Sonnet 5 y
  la decisión posterior del dueño es la contraria y textual: «NO, JAMÁS algo pago para el
  plan». Lo que sí se cumplió son las TRES CORRIDAS, que es lo que compensa el modelo — y
  el aporte de cada una se loguea, porque el número de 5-8 puntos de recall él lo midió
  sobre Sonnet con pensamiento adaptativo y **ese número no se hereda a otro modelo**.

### Lo que quedó SIN hacer

- **#768 sigue abierta y no es código.** Falta una SEGUNDA reunión en la que una persona
  haya anotado a mano lo que se comprometió cada uno: hay una sola (la Junta Macario
  Romero del 3/9, con sus ocho compromisos escritos). Sin una segunda vara no se puede
  medir nada — comparar dos corridas del modelo entre sí mide estabilidad, no acierto, y
  eso ya se hizo (84% general, 50% en la sesión con la que Mauricio mide).

  ⚠️ **Y el título de esa tarjeta decía «g15» y «g17»**, que son etiquetas de un
  relevamiento interno y no significan nada para quien abre el tablero. Lo reportó el
  dueño el mismo día: «NO pongas cosas tecnicas como "g15" eso no se entiende». Es la
  regla del texto que se DIBUJA, aplicada a una tarjeta: **el nombre interno de un
  archivo, una grabación o una corrida no es el nombre de la cosa.** Si al escribir un
  título hace falta un glosario para entenderlo, el título está en otro idioma.
- **La cadena del criterio está construida y sin medir en una reunión real.** Que cargue
  «las 5 que importan y no 70» es lo que la #768 tiene que comprobar.
- **El criterio de Mauricio vive en `app_settings` del ws1, no en el repo** — es material
  de su negocio. El .md de origen quedó del lado de quien lo cargó, y `scripts/cargar-criterio.ts`
  lo toma por parámetro a propósito: un default apuntando a Descargas se rompe en la
  máquina siguiente y encima sugiere que el documento es del repo.

## «Hay duplicadas»: el techo real fue 25 → 23, y la pregunta al refutador estaba mal

Cosechado del pedido «son una cantidad impresionante de tareas… intenta reducirlas al
maximo… estoy seguro que hay duplicadas o tareas que no son relevantes», sobre las 25
abiertas de «Feature: CRM». Dos corridas: cinco lentes buscando fusiones, y refutación.

**Vive en:** el proyecto `crm-automtico-leads` del ws9

### La primera pasada tumbó 5 de 5, y el que estaba mal era yo

Le pregunté al refutador: **«¿el «qué falta» de la tarjeta que queda CUBRE el de la que
se va?»**. Esa pregunta se contesta **que no SIEMPRE, por construcción**: el texto de la
que queda se escribió antes y no puede mencionar el trabajo de la otra. Las cinco
refutaciones dijeron lo mismo —«se pierde tal frase»— y en cuatro de las cinco esa frase
era **un bullet**, no una tarjeta.

Es la regla de «el default de un refutador es parte de la PREGUNTA» con una vuelta más: acá
el default estaba bien (fundir es destructivo) y **lo que estaba mal era el PREDICADO**. Una
tasa del 100% no es rigor ni default mal puesto: es que la pregunta no podía dar otra cosa.

**La pregunta correcta: fundir NO borra texto.** La fusión se aplica MUDANDO el «qué falta»
de la que se va al detalle de la que queda. Con eso puesto, lo único que decide es:

1. ¿Se **entregan por separado** y cada mitad ya le sirve a alguien? → son dos tarjetas.
2. ¿Lo que se va es tan **grande** que como bullet se pierde de vista? → no se funde.

Con ese predicado las refutaciones dejaron de ser genéricas y pasaron a ser **parciales y
medidas**: «#623 sí se funde en #621, #622 no», «el ítem 2 de #15 es la misma función que
#40, los otros tres no». Eso es un refutador trabajando.

### Y el resultado fue que casi no había duplicadas

| | |
|---|---|
| fusiones reales | **2** (#37→#701 y #623→#621) |
| mudanzas de un ítem entre tarjetas | 4 |
| no son tarea | 1 (#20) |
| **25 →** | **23** |

La intuición de «hay duplicadas» era correcta para dos pares y para nada más. Lo que sí
apareció, y es lo que de verdad explica la sensación, es otra cosa: **«Feature: CRM» no es
una feature.** Adentro hay ocho: el importador, Fathom, el funnel fijo, el tracking, las
secuencias, los pagos, Calendly y el motor. Veinticinco tarjetas de ocho temas distintos en
un proyecto se leen como una montaña; las mismas veinticinco repartidas en ocho se leen como
ocho listas cortas. **Cuando alguien dice «son demasiadas», la primera pregunta no es cuáles
se funden: es si el CONTENEDOR tiene el tamaño correcto.**

### Dos hallazgos de producto que salieron de buscar duplicadas

- **#621 sola es ACTIVAMENTE DAÑINA sin #623.** Si se despliega el arreglo del apellido y
  la clienta hace lo único obvio —volver a subir la planilla corregida—, cada lead que ya
  está en el CRM se marca `duplicado` (`leads-importar.ts:150`) y, si lo tilda —que la UI
  permite a propósito—, se crea una SEGUNDA fila. El arreglo de una tarjeta rompe a la otra:
  ése es el caso donde fundir no es prolijidad, es corrección.
- **El pisado de links de Fathom tiene mejor sede que la que decía su tarjeta.**
  `applyFathomRecording` (`lib/leads.ts:1019-1022`) deriva `fathom_links` del objeto que le
  pasaron; releer la columna ahí arregla los TRES call sites de producción de una, y la
  tarjeta sólo nombraba uno.

*2026-09-30 · crm-reducir-tareas*

---

## Escribir un plan en FECHAS sobre un tablero que se ordena por SCORE

Salió de aplicar al tablero del super admin (ws9) el plan que cerró la llamada con Leila
del 01/10 — `docs/llamada-leila-01oct.md`: cinco etapas, catorce proyectos con fecha, tope
el 4 de noviembre.

### ⚠️ El Perro rankea proyectos SIN VER NI UNA FECHA

`priorizarProyectosOwner` (`lib/plan-board.ts`) arma el payload de cada proyecto con
`id · nombre · resumen (sale del detalle) · abiertas · hechas · 5 títulos · scoreActual`, y
**ni `deadline` ni `quarter` entran**. Corre sola todas las noches por
`app/api/cron/plan-recurvar` y reescribe el score de todo lo que no tenga `score_manual`.

O sea: un plan cuyo contenido ES la fecha —«esto al 7 de octubre, esto al 11»— es
exactamente lo que el único proceso que reordena el tablero no puede mirar. Lo que lo
sostiene es la regla de ESTABILIDAD del prompt (`lib/mako-guardian.ts`: «Ante la duda,
MANTÉN»), que es prosa. Funciona —la escalera del 25/09 sobrevivió una semana de corridas—
y no es una garantía.

**La regla que queda:** al escribir un orden a mano sobre el tablero, decidí de antemano qué
lo va a sostener mañana, y son tres cosas distintas:

| Qué | Quién lo respeta | Qué cuesta |
|---|---|---|
| `score` + `score_razon` | nadie: lo reescribe la corrida de la noche salvo que el prompt decida mantener | nada |
| `score_manual` | el Perro, de verdad (`if (antes?.manual)`) | es la firma del DUEÑO: una corrida que lo escribe pone un candado sin llave — el 20/09 ya costó eso |
| el `detalle` del proyecto | el Perro, porque de ahí sale el `resumen` que lee | hay que escribir dentro del molde y topea en 6000 |

El único de los tres que una corrida puede escribir sin mentir es el primero. Por eso el
orden del 03/10 se escribió sin tocar el flag — y por eso hay que decirlo al reportar, en
vez de dar la escalera por clavada.

### Sólo 7 de los 71 proyectos tienen `score_manual`, no los 71

Medido el 03/10/2026 contra producción. AGENTS.md cuenta que el 20/09 una depuración lo fijó
en los 71 y que eso dejó al dueño sin poder mover una prioridad; el relato es correcto y **la
base de hoy no se parece**: quedan siete, y son justo los que él discutió uno por uno (CRM,
Oferta y precios, Landing y VSL, Seguridad, Infraestructura, Integraciones, Orgánico
Instagram). **Antes de razonar sobre el candado, contalo**: la foto que trae un documento es
del día que se escribió.

Corolario al aplicar una decisión nueva: tres de esos siete los nombra la llamada del 01/10
por su nombre, así que se les pisó el número **conservando el flag**. Gana la fuente más
nueva, y el flag no es la decisión — es la marca de que hubo una.

### `plan_proyectos` no tiene `progress` ni `tachado`

Las dos primeras fotos del tablero devolvieron **0 proyectos** y el script siguió contento,
que es el modo de falla que AGENTS ya tiene escrito: un `select` de PostgREST con una columna
inexistente rechaza la consulta ENTERA y `data` vuelve `undefined`. Lo específico que vale
anotar es **cuáles columnas son del otro lado del tablero**: el avance (`progress`) y el
tachado viven en `plan_tareas`; un proyecto no tiene ninguno de los dos. Un proyecto
«cerrado» no existe como columna — se baja de score y se le escribe el motivo.

Y el error sólo apareció al leer `error` de las dos consultas por separado. Con el
`if (error) throw` puesto, el diagnóstico tarda un segundo; sin él, el script imprime una
tabla vacía perfectamente plausible.

### Lo que quedó SIN hacer, y es de Martín

La propia llamada lo dice: **la poda no se hizo, se reordenó**. Lo que sigue abierto, con
dónde vive cada cosa:

1. **La poda fina ítem por ítem**, que era el deber de esa noche. Nada de lo que la llamada
   no nombró se tocó: de 85 para abajo el tablero quedó igual, a propósito — hacer la poda
   acá habría sido inventarla.
2. **Tres contradicciones de la llamada contra sí misma**: el Onboarding se fue al 14/10
   estando ROTO (la cuota de Gemini lo frena, y con el criterio del 21/09 eso era etapa 1);
   el video tutorial se descartó y volvió a entrar doce minutos después; y Offer
   Analyst/Generator está en la etapa 2 según el resumen de Fathom y «en la etapa siguiente»
   según el transcript. Las tres las decide él, no un agente.
3. **Seguridad se cayó por segunda llamada seguida**, sin discusión y sin criterio. Se le
   escribió la razón y **no se le movió el número**: la llamada no dijo dónde ponerlo, y
   bajarlo por mi cuenta sería la misma invención que la poda.
4. **El número de WhatsApp recién comprado no tiene historial** y hay que curarlo antes de
   usarlo. Es el canal de salida de todo el Chatbot del 7/10 y quedó sin método ni fecha —
   o sea que la etapa 1 cuelga de algo que no es código.

⚠️ **Y no se creó ni una tarea.** `aplicarPropuesta` dispara al Perro y re-curva TODOS los
proyectos, así que crear tarjetas después de escribir la escalera la borra. El orden va
siempre después de crear; acá el orden ya estaba escrito, así que lo que sigue —si se decide
crear algo— es volver a escribir la escalera después.

*2026-10-03 · aplicar-llamada-leila-01oct*

## `tareasDelCamino` devuelve `[]` para 121 de las 122 áreas, y no es un error (04/10/2026)

El nombre no lo dice y la firma tampoco: `tareasDelCamino(slug, ws)`
(`app/admin/dev/roadmap.ts:94`) arranca con

```ts
const titulos = TITULOS_PROPIOS[slug];
if (!titulos) return [];
```

y `TITULOS_PROPIOS` tiene **una sola clave**: `customer-success`. Para cualquier otra
área devuelve vacío **sin mirar los proyectos que esa área declara**, que es
justamente lo que el llamador cree estar pidiendo.

Medido el 04/10 construyendo la tabla del CRM de `/admin/runway`: la pantalla salió
con **cero filas** y el reparto en `1 / 0 / 0` sobre un proyecto que tiene 25 tareas
abiertas. No hubo error, ni log, ni fila rara — una tabla vacía y un contador en
cero, que se leen como «no hay nada que mostrar».

La función correcta es **`roadmapDe(slug, ws)`** (`:63`), que sí cruza
`area.proyectos` contra las tareas abiertas y devuelve `{ tareas, estado }`.

**La regla ya está escrita en AGENTS.md** —«si el `[]` de una función significa DOS
cosas, el caller tiene que preguntar CUÁL»— y esta vez la pagué desde el otro lado:
no por escribir la función ambigua, sino por llamarla. Lo que la delata antes de
mirar el código es **el cero redondo sobre un universo que sabés que no está vacío**:
25 tarjetas que se acababan de leer con un script aparecieron como 0 en la pantalla.
Un total que contradice una medición previa que se sabe buena es la señal más barata
que existe.

⚠️ **Y el comentario de arriba de `TITULOS_PROPIOS` explica para qué sirve, no para
qué NO sirve.** Dice —con razón— que un camino cruza varios proyectos y que por eso
hace falta el match por título. Lo que no dice es que sin entrada en esa tabla la
función no contesta nada. Cuando una función tiene una salida temprana que depende de
un catálogo incompleto, **el comentario que hace falta está en la salida temprana**,
no en el catálogo.

⚠️ **Y `roadmapDe` TAMPOCO SIRVE PARA PREGUNTAR QUÉ ESTÁ HECHO: filtra
`.lt('progress', 100)` EN LA CONSULTA.** Para /admin/dev eso es correcto —su
pregunta es «¿qué queda?»— pero significa que para ese lector una tarea cerrada
**no existe**, y eso no se nota hasta que alguien le pregunta otra cosa. Medido
el mismo día, al marcar lo terminado en el runway: las nueve tarjetas que se
acababan de cerrar desaparecían de la tabla, o sea que el trabajo hecho se leía
igual que el que nunca existió.

El lector propio quedó en `app/admin/runway/tareas.ts`, y lo que se gana es que
el título, la prioridad y el avance sigan saliendo del tablero en cada carga: la
alternativa —escribir los títulos a mano en el catálogo de la pantalla— es la
segunda copia que se queda vieja. **Antes de reusar un lector, mirá qué FILTRA en
la consulta, no sólo qué devuelve**: un `where` es una pregunta hecha, y los
lectores de esta casa están escritos para la suya.

**Vive en:** `app/admin/dev/roadmap.ts:94-96` y `:63` · `app/admin/runway/tareas.ts` · *2026-10-04 runway-crm*

---

## La prioridad en la TABLA, y el lote: lo que el dueño dictó mirando la pantalla (01/10/2026, arreglado el 04/10)

La llamada con Leila del 01/10 no fue de roadmap: fue una sesión de uso con el tablero
abierto, y entre 00:57 y 01:09 Martín dictó nueve defectos seguidos sin que nadie los
anotara. **La transcripción no existía en ningún lado del disco** — hubo que reconstruirla
desde los `agent-*.jsonl` de una corrida del 03/10, y eso está abajo en su propia entrada.

### ⚠️ El diagnóstico que dio el propio dueño era el equivocado, y se corrigió solo un minuto después

A las 01:01:00: *«esto lo voy a poner como 75, **tengo que recargarlo para que esto me haga
caso**»*. A las 01:02:36, sobre lo mismo: *«ah, se está por deadline, no se está ordenando
por prioridad, por eso ahí está»*.

O sea que «tengo que recargar» eran DOS cosas y sólo una era un bug: la tarjeta no se movía
porque la tabla estaba ordenada por DEADLINE, y el camino que escribe el score
(`MoverPrioridadModal` → `aplicarCascadaManual`) ya parcheaba el estado sin recargar desde el
23/09. Lo que sí faltaba era poder cambiar la prioridad **desde la fila**, que es la otra
mitad de la misma frase (*«así como le doy clic a la fecha… si le doy clic al botoncito de
prioridad debería poder cambiar ahí mismo»*). Arreglar sólo lo que la palabra «recargar»
sugiere habría sido buscar un reload que no existía.

### El chip de prioridad era un `<span>` y la capacidad ya estaba enchufada

`onSoltar` —la prop que abre el pop-up del 1 al 100— ya existía en las dos tablas desde el
25/09 **para el arrastre de filas**, y el `<Score>` de al lado era texto. El arreglo fue
darle un `onCambiar` al chip que llama a esa misma prop con el score actual: ningún control
nuevo y ningún camino de escritura nuevo. Es la regla de la casa aplicada antes de escribir
(«ANTES DE AGREGAR UN CONTROL, CONTÁ LOS QUE YA CONTESTAN ESA MISMA PREGUNTA») — el panel
del detalle ya había llegado a tener TRES formas de cambiar este número.

**Vive en:** `app/plan/board/Tablas.tsx` → `Score` · *2026-10-04*

### Una acción en LOTE sobre algo que escribe el server necesita apagar el deshacer de cada paso

El pedido: *«también debería poder subir prioridades desde ahí arriba… de varios juntos»*
(01:04:44). La barra de lote ya tenía deadline, repetición y proyecto, y los tres se
persisten solos; **la prioridad no**: la escribe el server (`fijarPrioridadAMano`, con
cascada) y la pantalla se sincroniza con `aplicarCascadaManual`, que ofrece SU deshacer.

Con eso, un lote de cuatro dispara cuatro carteles —el toast vive en un casillero único, así
que `show` pisa al anterior— y el que queda arriba deshace UNA. La regla ya estaba escrita
(«una acción en lote necesita UN deshacer») y no alcanzaba, porque el deshacer de este
camino no lo pone el lote: lo pone la función que sincroniza. Hizo falta un parámetro para
apagarlo (`conDeshacer`), y que el deshacer del lote **vuelva a llamar al server** con el
número anterior —revertir sólo la pantalla miente hasta el próximo F5— y le devuelva la
decisión al Perro a las que no estaban fijadas a mano antes.

**Vive en:** `app/plan/board/useBoard.ts` → `aplicarCascadaManual` · `app/plan/board/AccionesLote.tsx` → `ponerPrioridad` · *2026-10-04*

### El lote elige BANDA, y lo que ya está en la banda no se toca

Para varias a la vez la unidad útil no es el número sino la banda, por la regla que ya está
en este documento: el Kanban agrupa por `prioFromScore` y un reorden que no cruza una banda
es invisible. Dos decisiones que no se ven en el código:

- **Las que YA están en la banda quedan afuera.** Con un proyecto en 96 y otro en 30, pedir
  ALTA tiene que mover al de 30; poner a los dos en el representativo (85) le BAJARÍA la
  prioridad a uno mientras el control dice «subir».
- **Se aplican de menor a mayor.** La escalera de proyectos no admite empates, así que fijar
  el segundo en 85 corre al primero a 84: el ÚLTIMO aplicado queda arriba. Ordenando por el
  score que tenían, el que venía más alto se aplica último y sigue siendo el más alto.

La condición vive en `types.ts` y no adentro de la barra, para que la pueda importar un test.

**Vive en:** `app/plan/board/types.ts` → `enOrdenParaLaBanda` · *2026-10-04*

### ⚠️ Un `sticky` adentro de `cajaStyle` NO SE DISPARA, y no da ningún error

*«Que la barra de opciones… baje con mi scroll, porque si no como que tengo que subir hasta
arriba»* (00:57:43). El Kanban ya la tenía pegada desde el 24/09; la tabla no.

Lo caro no era ponerle `position: sticky`: era **dónde**. La barra vivía adentro del `<div
style={cajaStyle}>` de la tabla, y esa caja declara `overflow-x: auto` con el eje Y en
`visible` — con lo cual el valor USADO del Y pasa a `auto` y la caja ES un contenedor de
scroll. Un sticky se posiciona contra el ancestro que scrollea, y ese ancestro no scrollea
nunca en vertical (crece con su contenido), así que la barra se habría quedado clavada igual
que antes, con el `position: sticky` puesto, sin un error y sin nada que lo explique. La
regla ya estaba en AGENTS.md («Un eje en `hidden` convierte el otro en `auto`») y acá vuelve
con la conclusión operativa: **el sticky vive AFUERA de la caja que recorta.**

**Y se verificó SCROLLEANDO, en los dos scrollers que esta pantalla tiene** (Chromium,
04/10/2026): en `/plan` scrollea la página y la barra queda en `y = 8`; adentro del modal de
un proyecto scrollea la columna del detalle y la barra queda a 28 px de su borde — los 20 de
padding del contenedor más el `top: 8`. Con `scrollY = 0` las dos se ven igual que una rota.

**Vive en:** `app/plan/board/Tablas.tsx` → `BarraPegada` · *2026-10-04*

### ⚠️ La cuenta de ancho de la barra apuntaba a 499 y el lugar más angosto pasó a ser 856

`AccionesLote.tsx` trae una cuenta de px, escrita el 25/09, «contra los ~499 del lugar más
angosto (el detalle de un proyecto)». Ese 499 salía de `MODAL_DETALLE = 820`; el modal pasó a
1180 y `ANCHO_TABLA_EN_PROYECTO` —que es una RESTA sobre él— vale hoy **856**. La cuenta no
se enteró: es el olor de «dos números que dicen lo mismo y uno se quedó viejo», y acá el que
se quedó viejo era el que frenaba agregarle un control a la barra.

Medido en el navegador con tres tareas tildadas: el peor estado (calendario abierto) pide
**615 px** — 447 el grupo del medio, 48 la izquierda, 74 la derecha, 20 de huecos, 26 de
padding y borde — y se dibuja en UN renglón a 1440, 856 y 700. Por debajo de 615 lo que
falla **no es el `wrap`**: los grupos de los costados son `flex: 1` con `minWidth: 0`, así
que se encogen por debajo de su contenido y el tilde y el tacho se empiezan a pisar (a 560 el
grupo de la derecha mide 34 px para 74 px de botones). O sea que la red del `wrap` no cubre
el modo en que esta barra se rompe primero.

**Vive en:** `app/plan/board/AccionesLote.tsx` → «LA CUENTA» · *2026-10-04*

### El «—» que borra el deadline y el input de fecha son UN control

Pedido el 01/10 (01:08:32): *«quitarle por ahora el deadline a los que todavía no le voy a
asignar… le doy a deadline, borra… y no se borra. Tengo que ir uno por uno»*. El input nace
VACÍO (no tiene `value`), así que no hay nada que limpiar y el picker ni dibuja su ✕. El
botón nuevo va en la MISMA caja que el input, con `gap: 6` y no con los 14 del grupo: los 14
son para dos pastillas distintas «que a 6 px se leen como un solo bloque partido por una
raya», y acá el efecto buscado es el contrario.

**Vive en:** `app/plan/board/AccionesLote.tsx` · *2026-10-04*

### Lo que NO era un bug

- *«¿Dónde se fue? Desapareció»* (01:04:03). La encontró cuatro segundos después
  («parece que tenía un emoji de cebolla») y el toast de deshacer ya sale en ese camino desde
  el 23/09. No hay nada que arreglar, y escribir un cambio igual habría sido inventar.
- *«La P, ¿qué es?»* (01:06:21, y lo contesta Leila sola dos segundos después). Martín lo
  descartó explícitamente al repartir el trabajo.

---

## La transcripción de una llamada puede existir SÓLO adentro de los logs de los subagentes (04/10/2026)

Los nueve defectos de arriba salían de una llamada del 01/10 que **no estaba en ningún
archivo del disco ni en el repo**, y el MCP de Fathom no la podía traer:
`get_recording_by_url` y `get_recording_by_call_id` contestaban las dos «not found or access
denied», y la key del workspace sólo devolvía las reuniones de septiembre de Mauricio.

Sí estaba, partida, adentro de
`~/.claude/projects/<proyecto>/<sesión>/subagents/workflows/<runId>/agent-*.jsonl`: una
corrida del 03/10 le había pasado pedazos a varios agentes. Reconstruirla costó dos intentos
fallidos y los dos fallan en silencio, que es lo que vale la pena anotar:

1. **Keyear por NÚMERO DE LÍNEA da 159 líneas de una llamada de dos horas.** Cada chunk viene
   numerado desde 1, así que al deduplicar por número se pisan entre sí. La clave que
   funciona es el **timestamp** `[HH:MM:SS]`, que es global a la llamada.
2. **Una regex que exige `número + tab` antes del timestamp deja un hueco de 22 minutos.**
   Dos de los agentes habían recibido el transcript entero en OTRO formato, sin esa parte.
   Con la regex floja: 1.052 líneas y cero huecos entre el minuto 0 y el 103.

**La señal de que la reconstrucción está mal es el LARGO**, no un error: 159 líneas para dos
horas es imposible, y 665 con un hueco se lee perfecto si uno no verifica la continuidad de
los timestamps. La verificación barata es contar minutos faltantes, no leer el resultado.

Y la lección de fondo es la de AGENTS.md vista desde el otro lado: **esto pasó porque la
corrida del 03/10 no cosechó el transcript.** Lo que no se escribe en el repo existe sólo
mientras alguien sepa en qué `runId` buscarlo. La transcripción quedó en disco como
`llamada-leila-01oct-transcripcion.txt`, un nivel arriba del repo (86 KB), y los nueve
defectos están enumerados en la entrada de acá arriba.

**Vive en:** `llamada-leila-01oct-transcripcion.txt` (fuera del repo, junto a él) · *2026-10-04*

---

## La selección en lote, cuatro pedidos del 04/10/2026 — y lo que encontró cada capa

Cuatro cosas sobre la misma barra, pedidas juntas: desplegar el «Ver más» al seleccionar en
tarjetas y que la barra baje con el scroll; que «quitar deadline» viva dentro del
desplegable de fechas y sea texto; que el lote ofrezca también la barra deslizable del 1 al
100; y que la selección sobreviva al cambio de formato.

Lo que vale la pena de esta tanda no son los cuatro arreglos: es que **cada capa de
verificación encontró una cosa distinta, y la más cara la encontró la última.**

### ⚠️ «El desplegable de fechas» no existía

El pedido 2 nombra un control que no estaba: lo que se abría al tocar «Deadline» era el
calendario **NATIVO** del `<input type=date>`, que lo dibuja el navegador y al que no se le
puede agregar un renglón. O sea que el pedido obliga a decidir **quién va a ser ese
desplegable**, y no hay una lectura literal.

Se eligió que la ranura PASE a ser un `Dropdown` de la casa, con dos filas: «Elegir fecha…»
y «Quitar deadline» (ésta `sutil`, que el componente dibuja apagada y con un filete). No
inventa nada: las otras tres ranuras del medio —Repetición, Prioridad, Proyecto— ya eran
Dropdowns con el mismo `buttonStyle`, y Deadline era **la única que no lo era**. Cuesta un
clic más poner una fecha, y eso está dicho en el comentario en vez de escondido.

**Y el «—» se fue con un argumento que es el reclamo mismo.** Ese glifo ya significaba otras
dos cosas en este tablero: en `CeldaFecha` dice «está vacío, tocame para poner una fecha»
(abre) y en `NoAplica` dice «esto no se mide así». Acá decía «borrame la fecha», una
tercera. Tres significados para un guion es literalmente «no es intuitivo».

**Vive en:** `app/plan/board/AccionesLote.tsx` → la ranura temporal · *2026-10-04*

### ⚠️ Un comportamiento que depende de CÓMO se llegó se deriva, no se dispara — y lo encontró el navegador

El pedido 1 se escribió primero como un gesto: un `cambiarSel()` por el que pasaban los
**dos** caminos que cambian la selección —la casilla de la tarjeta y el `onLimpiar` que la
barra dispara en seis lugares internos—, con su propio ref para no pisar la decisión de la
persona. Estaba bien razonado, los dos caminos cubiertos, y con guard.

Y estaba mal, porque el pedido 4 de la misma tanda **creó un tercer camino**: tildar en la
TABLA y conmutar a tarjetas. Medido con Playwright: **tres tildados y cinco tarjetas
dibujadas**, o sea una barra en lote actuando sobre lo que no está en pantalla.

La cura no fue agregar el tercer camino al wrapper: fue dejar de tener caminos.

```tsx
const desplegadoPorSeleccion = selProy.size > 0;
const visibles = (verTodos || needle || desplegadoPorSeleccion) ? shown : shown.slice(0, REALES);
```

**La regla que queda: si el estado correcto se puede CALCULAR, calcularlo le gana a
dispararlo desde los eventos que lo producen** — un cálculo no tiene caminos que olvidar, y
el que se invente mañana lo hereda gratis. Y el corolario que vino pegado: con la expansión
mandada por la selección, el botón de «Ver más» no puede plegar nada mientras haya algo
tildado, así que **no se dibuja**; un control que no hace nada se lee como que la app está
rota.

**Vive en:** `app/plan/board/BoardShell.tsx` → `desplegadoPorSeleccion` · *2026-10-04*

### ⚠️ CUATRO guards nuevos pasaron su propia rotura en verde

Al probar los tests rompiéndolos —la regla de la casa—, cuatro de veintidós roturas no los
movieron. Las cuatro por dos defectos, y los dos son el mismo con dos caras:

1. **Dos guards leían el archivo pero no EJECUTABAN la función.** `enOrdenParaElNumero` se
   escribió con su comentario y sus guards de cableado, y no tenía **ni un test que la
   llamara**: quitarle el `filter` y quitarle el `sort` daban verde. Un guard de cableado
   contesta «¿está enchufado?», nunca «¿hace lo que dice?».
2. **Dos guards medían el TEXTO del cuerpo, no la CONDICIÓN.** Uno afirmaba
   `/abrioPorSeleccion\.current = true; setVerTodos\(true\)/`: reemplazar la condición por
   `if (false)` dejaba ese texto intacto. El otro recortaba `slice(i, i + 800)` **a ojo** y
   se comía el `!verTodos && !needle` del ARRASTRE, que está pegado y dice lo mismo — romper
   el de la selección daba verde porque el guard veía el del vecino.

**La regla: un guard de texto recorta por el CIERRE REAL del bloque —nunca por un número de
caracteres— y fija la CONDICIÓN entera, no el cuerpo que cuelga de ella.** Es la misma
familia que «un guard que lee el archivo entero encuentra lo que el archivo dice de sí», un
escalón más fino: ahí el universo era el archivo, acá es un recorte elegido de más.

**Vive en:** `tests/plan-prioridad-tabla-y-lote.test.ts` · *2026-10-04*

### ⚠️ El lote de prioridad del 01/10 anunciaba entero un lote a medias

Lo encontró un lector de esta tanda leyendo código que yo había escrito el mismo día.
`repo.prioridadManual` TIRA cuando el server rechaza, así que el `for` del lote se puede
cortar a la mitad; el `catch` era un `console.error` pelado y el `showUndo` quedaba **afuera
del try**. Resultado: la persona no veía nada, y el cartel ofrecía deshacer las N —
incluidas las que nunca se escribieron.

Ahora la escritura acumula las que de verdad entraron (`hechas`), el toast cuenta ésas y no
las pedidas, el deshacer recorre ésas, y con cero escritas el cartel lo dice en vez de
callarse. **Un lote que puede fallar a la mitad necesita saber dónde quedó: el número que se
anuncia y el universo que se deshace salen de lo ESCRITO, nunca de lo pedido.**

**Vive en:** `app/plan/board/AccionesLote.tsx` → `escribirPrioridad` · *2026-10-04*

### Filtrar «las que ya tienen ese número» lo DA VUELTA

En la banda, sacar a las que ya están ahí es lo correcto y es lo que hace que «subir» nunca
baje a nadie. Para un número EXACTO es al revés, y la traza sobre la cascada lo muestra con
A=50, B=20, C=10 pidiendo los tres a 50:

- **Filtrando a A** (que ya está en 50): se aplica B, que toma 50 y empuja a A a 49; después
  C, que empuja a B a 49 y a A a 48. **A, que ya estaba arriba, termina última.**
- **Sin filtrar y de menor a mayor** (C, B, A): A se aplica última y se queda con 50.

Y para la que ya tenía el número la escritura igual significa algo: le pone el candado de
`score_manual`. El no-op real lo resuelve el server, que tiene su salida temprana para
«mismo número Y ya estaba fijada a mano».

**Vive en:** `app/plan/board/types.ts` → `enOrdenParaElNumero` · *2026-10-04*

### Si el tablero DESEMPATA no lo dice la entidad: lo dice el repo

Pedirle el mismo número a N tarjetas no las deja a todas ahí. En el tablero del dueño
`fijarYDesempatar` reparte slots únicos, así que terminan en `[v−(N−1), v]`; el pop-up lo
dice ANTES de escribir, con el rango en la fila del medio de «Dónde queda» (medido en
pantalla: «98–100» para tres proyectos).

**Derivarlo de `entidad === 'proyecto'` es falso en el tablero del CLIENTE**: allá
`prioridadManual` escribe el número pelado, sin cascada, así que las N sí quedan todas en el
mismo número y mostrar un rango sería inventar. Lo que decide es **quién escribe**, no qué
se escribe, y por eso es una bandera del Repo (`prioridadDesempata`) y no una deducción.

**Vive en:** `app/plan/board/types.ts` → `Repo.prioridadDesempata` · *2026-10-04*

### ⚠️ Un `sticky` con z-index CREA contexto de apilamiento, y le clampea el z-index a lo que nazca adentro

El pop-up del 1 al 100 declara `zIndex: 150` en su backdrop. Montado desde la barra de lote
—que vive dentro de un `position: sticky` con `zIndex: 20`— ese 150 queda **clampeado contra
el 20 de la página**: el modal se dibuja debajo de cualquier cosa con z mayor, sin un solo
error y sin nada en el código que lo explique. Va con `createPortal` al `body`, que es lo
que ya hacía el diálogo de la repetición cuatro líneas más arriba.

**Vive en:** `app/plan/board/AccionesLote.tsx` → el montaje de `MoverPrioridadModal` · *2026-10-04*

### El sticky de un ÍTEM DE GRILLA sí se pega — dos lectores dijeron lo contrario y lo resolvió medirlo

Un relevo midió que el patrón del Kanban (`gridColumn: 1/-1` + `position: sticky`) se pega;
otro dedujo del spec que el bloque contenedor de un ítem de grilla es su ÁREA —la fila 1,
que mide lo que mide la barra— y que el recorrido es cero. **Medido en la grilla real,
inyectando una sonda con los mismos estilos: y=8 desde scrollY=400 hasta 10.000.** En Chrome
el bloque contenedor es el contenedor de grilla, no el área. Los dos moldes sirven.

⚠️ **Pero el alcance SÍ es el contenedor, y en Recurrentes eso importa:** ahí hay dos
grillas, una por grupo, así que cada barra se pega dentro de SU grupo y no de la pantalla.
Con un solo ítem por grupo —que es el dato de hoy— no hay nada que scrollear adentro y el
sticky no se puede observar. Las dos van escalonadas (`top: 8` y `top: 66`) porque las dos
selecciones de esa vista pueden estar vivas a la vez y al mismo `top` se taparían.

**Vive en:** `app/plan/board/BoardShell.tsx` → las barras de Recurrentes · *2026-10-04*

### La selección sobrevive al FORMATO y no a la VISTA, y el motivo es un choque de ids

Compartir un solo Set entre vistas suena a lo más simple y es incorrecto en el tablero del
CLIENTE: ahí `toBoard` hace `String(t.id)` sobre el bigint de `experimento_tareas` y
`toLabel` hace `String(c.id)` sobre el de `tarea_categorias` — **dos secuencias
independientes**, o sea que la tarea 7 y la categoría 7 son la misma clave. En el tablero
del dueño no pasa, porque `genId` prefija `t` y `p`: un Set único anda perfecto en el único
tablero donde se prueba y cross-selecciona en el del cliente, sin un solo error.

Y aun sin eso, los universos de las vistas son disjuntos por construcción (`conFin` contra
`lasRecurrentes`), así que una selección arrastrada de Tareas a Recurrentes intersecta en
cero ítems: la barra aparecería vacía, se leería como que la selección se perdió, y al
volver reaparecería sola. Por eso se limpia al cambiar de vista y no al conmutar formato.

**Vive en:** `app/plan/board/BoardShell.tsx` → `selTareasVista` y su efecto sobre `view` · *2026-10-04*

### Lo que quedó SIN hacer

- **La barra de la grilla de Proyectos cuenta sobre `shown` y no sobre `visibles`.** Hoy es
  inalcanzable —la selección fuerza el despliegue, así que lo tildado está dibujado— pero la
  diferencia sigue ahí, y la tabla tiene el mismo desfase con su fila plegada de
  completadas. El comentario que está dos líneas más arriba de ese cálculo ya declara la
  regla contraria («sobre lo VISIBLE, nunca sobre el tablero entero»). Cambiarlo es una
  decisión de producto: hoy tildar y plegar conserva la marca, estilo Gmail.
  **Vive en:** `app/plan/board/BoardShell.tsx:5249` y `app/plan/board/Tablas.tsx` → `elegidas` / `elegidos`.
- **`soloLectura` es una prop MUERTA en las dos tablas: cero call sites.** Su único
  consumidor, `app/admin/TableroDelCliente.tsx`, se borró. El comentario sigue describiendo
  un montaje que no existe.
- **`MoverPrioridadModal` escucha Escape en `document` sin registrarse en la pila de
  modales**, así que un Escape con el pop-up abierto adentro del detalle de un proyecto
  cierra los dos. Ya existía por el camino del lápiz; el del lote lo hace más visible porque
  la barra vive DENTRO de ese modal.
- **El `Dropdown` de la casa no tiene `title` por opción.** Lo que decía a cuántas se aplica
  el deadline viaja ahora en el `<span>` de afuera y en el `sub` de la primera fila; el
  arreglo de fondo está anotado como pendiente en el propio componente desde antes.

---

## ⚠️ Un plan tiene FECHA, y el tablero sobre el que se aplica también (03-04/10/2026)

**«Yo había depurado y sacado muchos deadline como el de offer analyst y generator… me
cambiaste todo eso, vuelve a lo que estaba»** (Martín, 04/10/2026).

La cronología, leída del historial del propio tablero y en UTC:

| cuándo | quién | qué |
|---|---|---|
| **01/10 22:32-22:52** | Martín | pone fechas a mano sobre catorce proyectos |
| **03/10 19:26** | Martín | **saca** el deadline de SEIS: Offer Analyst, Offer Generator, Landing Analyst, Landing Generator, VSL Analyst, VSL Generator |
| **03/10 19:30** | Martín | Onboarding y Oferta y precios → 2026-10-09 |
| **03/10 19:33** | Martín | Video Generator e Image Generator → 2026-10-14 |
| **03/10 19:40** | *mi corrida* | aplica el plan de la llamada con Leila **del 1/10** y escribe las fechas de ese plan encima de los diez |

**Catorce minutos.** El plan que escribí era de una llamada de dos días antes; lo que pisé
se había decidido esa misma tarde. Y la corrida no miró ni una vez si lo que iba a
sobrescribir había cambiado desde que ese plan se decidió.

La regla que esto viola ya estaba escrita en este documento —«dos fuentes con fecha distinta
que se contradicen: gana la más NUEVA»— y estaba escrita mirando el otro lado del problema
(un `detalle` viejo que resucita un modelo de negocio muerto). Acá yo TENÍA la fuente nueva
respecto del detalle… y el tablero tenía una más nueva todavía, que era la mano de la
persona esa misma tarde.

### La regla que queda

**Antes de escribir un plan sobre un tablero, comparar lo que se va a escribir contra lo que
HAY, y frenar en todo lo que una persona tocó después de que ese plan se decidiera.** Es
una consulta, no una intuición: `updated_at` y la última entrada de historial de cada fila
dicen exactamente eso. Lo que se encuentre no se resuelve solo — se reporta y lo decide
quien hizo el cambio.

⚠️ **Y el caso más caro es el que NO se ve en un diff de valores: la ausencia.** Cuatro de
los diez cambiaron de fecha y eso se nota; los otros seis habían quedado **sin** fecha a
propósito, y escribirles una no se lee como «te pisé una decisión» sino como «apareció una
fecha». Una depuración es un trabajo que deja el campo VACÍO, y un vacío es justo lo que un
plan que enumera fechas no tiene cómo distinguir de un hueco por llenar.

### Cómo se revirtió, y por qué el cruce importa

No alcanza con «borrarle la fecha a los que alguna vez la tuvieron»: eso sería inventar otra
depuración. Las dos mitades se revirtieron con un cruce que cada una verifica contra el
historial:

- **Los seis que habían quedado sin fecha** (`scripts/revertir-deadlines-resucitados.ts`):
  se revierte sólo el que cumple LAS DOS condiciones — su historial dice «Quitó el deadline»
  **y** hoy tiene exactamente el mismo valor que tenía ANTES de que se lo quitaran. La
  segunda es la que lo hace seguro: cinco proyectos más tienen «Quitó el deadline» en su
  historial y una fecha hoy, y a esos **no se los tocó**, porque alguien les puso una fecha
  nueva después — eso es una decisión, no un pisotón.
- **Los cuatro a los que les cambió la fecha** (`scripts/revertir-deadlines-del-roadmap.ts`):
  cada uno vuelve al valor de la última entrada `user` anterior a la mía, y el script lo
  **verifica** contra el historial en vez de confiar en la lista cableada.

⚠️ **Y «sin deadline» se escribe `''`, no `null`.** La columna es NOT NULL: el primer intento
rebotó con «violates not-null constraint» en los seis. Es lo que escribe `labelToRow`
(`lib/plan-board.ts:193`), y la buena noticia del modo de falla es que falló RUIDOSO y no
escribió nada a medias.

### ⚠️ Y dos veces me equivoqué de diagnóstico antes de llegar a éste

Vale la pena anotarlo porque las dos son trampas del método, no del código:

1. **«Fue un upsert de la fila entera desde un estado viejo».** Encajaba perfecto —el valor
   viejo de vuelta, y aparentemente sin rastro en el historial— y es un modo de falla que
   este repo ya tiene documentado, así que sonaba conocido. Era falso: el mensaje de mi
   propio commit (`89eac723`) nombra una por una las fechas que escribió. **Antes de culpar
   a un mecanismo, leé el commit que hizo el cambio.**
2. **«Lo escribió sin dejar entrada de historial».** También falso, y la causa es del
   arnés: mi probe cortaba el texto de cada entrada a 34 caracteres, y la entrada decía
   `Llamada con Leila del 1/10: prioridad 94 a 96 **y fecha 2026-…**`. El rastro estaba y mi
   medición se lo comía. Es «Grep sirve para ENCONTRAR, no para CITAR» con otra cara: un
   recorte de visualización que se usa para concluir.

### Lo que NO se tocó, y lo decide Martín

La misma corrida **reordenó los scores** de esos catorce proyectos (las entradas dicen
«prioridad 94 a 96», «93 a 88», «92 a 87»…). Eso no se revirtió: reordenar era lo que se le
había pedido a la corrida en ese momento, y deshacerlo por mi cuenta sería la misma falta en
el otro sentido. Queda dicho para que lo decida él.

**Vive en:** `scripts/revertir-deadlines-resucitados.ts` · `scripts/revertir-deadlines-del-roadmap.ts` · `scripts/probe-deadlines-tocados.ts` · *2026-10-04*

## El filtro de cliente del Plan y `?cliente=` (05/10/2026)

Lo pidió la ficha de un cliente en Customer Success: un botón «Ver en el Plan» que abre el
tablero ya filtrado a ese cliente. Las tareas y proyectos ya llevaban `clienteLeadId` (mig
0172), pero «Filtrar» no ofrecía filtrar por cliente y ninguna URL lo ponía.

- **Es estado de SESIÓN, nunca `usePref`.** Un filtro de cliente restaurado de `localStorage`
  en la próxima visita es un tablero que muestra un tercio de lo que hay sin que nadie lo haya
  pedido hoy («`localStorage` restaura una preferencia, nunca pisa una decisión»). Se pone con
  la URL o a mano, se ve como un chip con su ✕ en TODAS las vistas —Prioridades no dibuja
  «Filtrar», y es justo donde el filtro cambia el norte— y se escribe de vuelta en la URL:
  con `?cliente=` leído pero no reescrito, sacar el filtro y apretar F5 lo volvía a poner.
- **La URL la arma el tablero** (`hrefPlanDeCliente` en `app/plan/board/filtro-cliente.ts`) y
  la ficha la importa. La ficha tenía su propia copia del nombre del parámetro, que además
  aterrizaba en Prioridades —lo mismo que ya muestra la ficha—; va a «Tareas».
- **La vuelta `/plan/agencia` → `/plan` perdía el query**, así que el link llegaba sin el
  filtro. Arreglado en `app/plan/agencia/page.tsx`.
- **El chip del cliente salía «L…» con el header sobrado**: tenía `flex: 0 1 auto` junto a
  `BuscadorTareas`, que declara una `flex-basis` (280) mayor que su contenido, y el algoritmo
  encoge al vecino. Se declaró quién cede: `flex: none` en el chip y tope + elipsis sólo en el
  nombre.
- **`soloVista`** dibuja una sola vista sin su selector (la ficha trae sus pestañas): sin
  eso hay dos filas de tabs, que es lo que se sacó el 29/09. Y los vacíos de Prioridades
  dicen el nombre del cliente en vez de «en todo el plan».
- **Sin hacer:** lo que se CREA con el filtro puesto no nace asignado al cliente, y el chip
  de progreso y el Exportar ignoran el filtro. Las dos son decisiones de producto.

**Vive en:** `app/plan/board/BoardShell.tsx`, `app/plan/board/filtro-cliente.ts`, `app/plan/agencia/page.tsx`, `app/plan/PlanBoard.tsx`, `app/plan/TodoBoard.tsx`.

## `updated_at` no distingue al Perro de una persona: lo que distingue es el ACTOR (05/10/2026)

**Vive en:** `plan_tareas.updated_at` y `plan_tareas.historial` · la regla que lo pide está en
AGENTS.md → «la fuente más nueva puede ser el TABLERO MISMO»

La regla de no pisar lo que una persona tocó después de que un plan se decidió es correcta y
está escrita porque ya se pagó (el 03/10 una corrida le escribió fechas encima a diez
proyectos que Martín había depurado catorce minutos antes). Lo que no estaba escrito es cómo
se contesta esa pregunta, y la forma obvia —`updated_at` posterior al arranque de la corrida—
**marca como «tocada a mano» a todas las tarjetas del tablero**.

Medido al cerrar las cinco tarjetas de esta corrida: las cinco traían
`updated_at = 2026-10-06T01:05:58`, **idéntico al milisegundo entre ellas**, y la primera
entrada del historial decía `MaKo la priorizó — score N`. O sea el cron del Perro re-curvando,
que por diseño toca el tablero entero. Un guard sobre `updated_at` habría frenado la corrida
sobre las cinco y mandado a preguntarle a Martín por un cambio que no hizo.

Lo que contesta la pregunta de verdad son dos campos y hay que mirar los dos:

- **El `actor` de la primera entrada del historial.** `ia` es MaKo (el Perro, una ampliación de
  contexto, un cierre por commits); `user` es una persona. Es el mismo campo que ya usa el
  deshacer para no ofrecer un toast por cada tarjeta que toca el Perro.
- **`score_manual`**, que es lo único que significa «esto lo decidió el dueño discutiéndolo» y
  que por eso una corrida automática no escribe nunca.

Las dos señales juntas, y el timestamp sólo para acotar la ventana: un `updated_at` reciente
con `actor: 'ia'` es el cron haciendo su trabajo, y lo que hay que frenar es un `updated_at`
reciente con `actor: 'user'`.

⚠️ **Y la pista que lo delata en dos segundos: cinco filas con el MISMO timestamp al
milisegundo no las tocó una persona.** Nadie edita cinco tarjetas en el mismo milisegundo; eso
es un `update` en lote. Vale para cualquier auditoría del tablero, no sólo para este caso.

## Una depuración de prioridades dura hasta que alguien cierra una tarjeta: la del 25/09 duró seis días (10/10/2026)

**Vive en:** `app/plan/board/BoardShell.tsx` (`rePriorizar`, el efecto de `planSig`) ·
`app/plan/board/useBoard.ts` (`applyGuardian`) · `lib/mako-guardian.ts` (`puntuarPlan`)

Al depurar «Feature: Onboarding» el 10/10, tres tarjetas que el barrido del 25/09 había
mandado abajo a propósito estaban otra vez arriba:

| | 25/09 (barrido) | 01/10 22:34 (Perro) |
|---|---|---|
| #614 | 40 → 20, «Queda APARTADA» | «Priorizó · score 79» |
| #652 | 40 → 20, «Queda APARTADA» | «Priorizó · score 63» |
| #706 | 40 → 20, «Queda APARTADA» | «Priorizó · score 39» |

**El diagnóstico obvio era el reparto diario, y era el equivocado.** `recurvarPlanOwner` no
escribe historial, y lo que aparece el 01/10 es «Priorizó · score N»: lo escribe
`applyGuardian` (`app/plan/board/useBoard.ts:229`), la re-priorización que corre EN EL
NAVEGADOR 2,5 s después de que cambia el conjunto de tarjetas abiertas (crear, borrar o
completar una con /plan abierto, `BoardShell.tsx:804-812`). Manda TODAS las abiertas al Perro
y pisa `score` **y** `score_base` de cada una que vuelve. Escribir la base protege del reparto
de la mañana (ya estaba escrito acá); no protege de que alguien cierre una tarjeta.

⚠️ **Y por la misma puerta parece pisar también las fijadas a mano**, que es peor y no se
midió en el navegador: el pedido no manda `scoreManual` (`BoardShell.tsx:775`), `puntuarPlan`
no lo lee y `applyGuardian` no lo mira antes de escribir. El único que lo respeta, leído en el
código, es `recurvarPlanOwner` (`lib/plan-board.ts:885`). Si se confirma, una prioridad que
Martín ganó discutiendo se pierde la próxima vez que completa cualquier tarjeta.

La depuración del 10/10 escribió `score` y `score_base` sin `score_manual` (la regla de
AGENTS.md) y dejó el veredicto en `score_razon` y en el historial de cada tarjeta.
**Sin hacer:** que `applyGuardian` saltee las fijadas, y que el Perro reciba el veredicto de
una depuración (hoy recibe `scoreActual` y nada del porqué).

*Corrida del 10/10/2026 · chat «Onboarding» · leído en el código y en el historial de la base.*

## Una reunión que la IA no puede leer se reintenta 26 horas y después se pierde, sin aviso (15/10/2026)

**Síntoma:** el ws1 (Mauricio) no sacó **ni un borrador** de sus reuniones desde el 08/10 (`plan_propuestas` con
`ref` `fathom:*`: 3, 3, 1, 1, 1 y 1 entre el 01 y el 08/10; cero del 09 al 15/10). Nadie lo reportó.

**Causa:** su única key de Gemini no contesta desde el 08/10 a las 20:45 UTC y el resto de su cascada tampoco
(docs/hallazgos-ia.md, entrada del 15/10). `procesarReunionesNuevas` (lib/reunion-auto.ts) hace lo correcto con
una lectura fallida: NO marca la reunión (`KEY_VISTA`), así que la próxima corrida la reintenta, porque
marcarla la quemaba para siempre. Lo que no tiene es un FINAL para el fallo que no se arregla solo:

- **La ventana es de 26 h** (`horas ?? 26`, por `created_after` de Fathom). Una reunión que falla en todas las
  corridas de ese día sale de la ventana y no la vuelve a mirar nadie. No se marca, no deja borrador y no
  avisa: queda igual que una reunión que nunca existió.
- **El fallo sólo va a `console.error`** (`la lectura FALLÓ … queda para reintentar`) y al JSON de
  respuesta del cron (`err=`), que no lee nadie. El aviso al dueño sale sólo cuando hay borrador.
- **Y cada reintento cuesta**: de 20 a 56 llamadas por corrida a las :40 (los tramos de hasta 3 reuniones),
  13 corridas por día, contra una key que va a contestar lo mismo.

**Regla:** «no lo marco para reintentarlo» necesita su final: cuando el reintento se acaba (la reunión sale de
la ventana, o falla N veces seguidas por la misma causa), lo que se perdió queda ESCRITO donde el dueño lo lea,
con la reunión nombrada. Un reintento sin final es una pérdida silenciosa con un paso más.

**Actualización (16/10/2026):** el final ya existe en parte. Lo que el cron no pudo leer queda ESCRITO
(`plan_reuniones_descartadas`, mig 0296, `tipo = 'fallo'`) y se ve en el modal de Fathom, en «Sin leer»,
con «Reintentar»; las diez del ws1 del 08 al 15/10 se anotaron a mano ese día. Ver [Fathom sin
fricción](#fathom-sin-fricción-cargar-sin-ia-el-cruce-en-el-cron-y-lo-que-no-se-leyó-16102026).

**Sin hacer:** el AVISO de «esta reunión no se pudo leer» (hoy se ve sólo abriendo el modal); no reintentar mientras las
keys del negocio estén todas caídas (lo toma Automations con el freno de claves caídas,
docs/diseno-ia-claves-caidas.md); y recuperar las reuniones del ws1 del 08 al 15/10, que ya salieron de la
ventana (se pueden extraer a mano desde /plan cuando haya una key que conteste).
**Vive en:** lib/reunion-auto.ts (`procesarReunionesNuevas`: la ventana, `KEY_VISTA`, la rama `parcial`) ·
app/api/cron/fathom-plan/route.ts · *2026-10-15*

## La extracción no escribe un ROL donde va una persona (15/10/2026)

**Síntoma:** un rol que nadie dijo («su socio») se escribió como si fuera una persona y viajó a cuatro documentos; Martín no tiene socio. El caso entero está en docs/hallazgos-planes-y-cobro.md → «El socio que no existe».

**La regla, en las dos capas:** el prompt de la extracción («QUIÉN ES CADA UNO», `PLAN_FATHOM_SYSTEM_TEMPLATE`) pide el NOMBRE o «Otra persona», y `rotuloDePersona` lo frena en `coerceCandidatas`: `dueño` y `dichoPor` quedan sólo si son un invitado, quien mira el tablero o un nombre dicho en la reunión (`fuenteDicha`, armada UNA vez con el resumen y la transcripción entera). Un rol no queda nunca, aunque la palabra se diga.

**Ojo al tocarlo:** el rótulo se sanea DESPUÉS de `resolverDueño`, que decide el email y «es mío» con el texto crudo; sanear antes cambiaría a quién se le reparten las tareas.

**Vive en:** `lib/tarea-dueno.ts` (`rotuloDePersona`, `fuenteDicha`, `OTRA_PERSONA`) · `lib/plan-fathom.ts` (`coerceCandidatas`, el prompt) · `tests/tarea-dueno.test.ts`
