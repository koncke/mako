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
- **El texto del SEED de `PlanBoard.tsx` describe el pasado, no el presente**: un agente que lo grepea lee «el board vive en localStorage con el Repo en no-op» y lo reporta como estado actual, tres meses después de que dejó de ser cierto → [El board](#el-board-plan).

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

**Vive en:** lib/link-borrador.ts + tests/link-borrador.test.ts (la cura) · lib/mako-doer-in.ts (donde se aplica) · app/plan/revisar/[id]/page.tsx y NoEsTuyo.tsx (la red) · *2026-08-08*

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

- **Prioridades arriba, kanban abajo.** Las 4 columnas de prioridad son fijas, no editables, y ocupan todo el ancho; los proyectos existen para agrupar tareas. «Dentro del gran proyecto 'Hacer MaKo DOER' entran muuchas tareas» (2026-07-12).
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

**Vive en:** app/plan/revisar/[id]/RevisarPropuesta.tsx:94 y :241-243 · lib/plan-propuesta.ts:668-669,725 · app/api/agente/plan/route.ts:92 vs :110 · *2026-08-06 senales-de-avance*

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

## De la reunión a la tarea (Fathom)

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

**Vive en:** lib/fathom-api.ts (fathomGet) · lib/plan-fathom.ts:131 y :161 · lib/closing.ts · *2026-07-30 fathom-preview-cards*

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

### Las decisiones tomadas sobre el pipeline de reuniones

- **Las reuniones se cargan solas, siempre**, sin botón para prenderlo (2026-07-29).
- **Paso de validación de entidades desconocidas antes de extraer:** «¿Qué es Artemisa?» alimenta una base de conocimiento persistente, más corrección de errores obvios de transcripción («Investigar con CLAU» = Claude). Si no, cada carga vuelve a preguntar lo mismo y la tarea sale con basura adentro (2026-07-18).
- **Las tareas de OTRA persona no entran a tu tablero:** se muestran aparte, se pueden reasignar a una persona (o crear una nueva) y se exportan en md para pasárselas. El plan además acepta que le subas archivos. «en la tarea de Mauricio, que no entra su Fathom a las reuniones, es una tarea de él, no se debería cargar en mi tablero de SuperAdmin» (2026-07-18).

### Lo que quedó sin hacer en reuniones

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

### ⚠️ El gate del Perro vive en el modal y `/api/retro` no tiene gate de sesión

El chequeo de «no te dejo eliminar esto» es 100 % client-side: la API solo devuelve el veredicto y nada lo enforcea. Peor, `/api/retro` no llama a `getUsuarioActual()` (a diferencia de `/api/mako-guardian`, que devuelve 401), así que un `POST {action:'generar'}` saltea cualquier gate que viva en el wizard — y esa ruta son hasta 9 llamadas a Opus con effort xhigh y maxTokens 24000 por corrida. Si se implementa el gate de «terminá lo anterior antes de correr una Retro nueva», tiene que vivir en `generarRetroV3`/el route, no en el modal.

**Vive en:** app/api/retro/route.ts; app/experimentos/EliminarModal.tsx:101-133; lib/retro-pipeline.ts · *2026-07-17 retro-mapa*

### `experimento_tareas.retro_id` se escribe siempre y no se lee nunca

El join key que haría honesta la rendición de cuentas de la Retro ya se persiste en los dos caminos (tarea plana y chain de experimento), pero un grep repo-wide devuelve solo escrituras, tipos y seeds: cero lecturas. La query que falta es una sola y no necesita migración: `select id,titulo,estado,progreso,hecho_at from experimento_tareas where retro_id = <id>` vía getTenantDb. Tres huecos que sí quedan: la columna no tiene FK ni índice (seq-scan), el link retro→experimento vive enterrado en `experimentos.config->>'retro_id'` (jsonb, no indexable), y `borrarTarea` es hard delete, así que una tarea borrada es indistinguible de una nunca creada.

**Vive en:** lib/retro-pipeline.ts:601-607 y :593-598; lib/todo.ts:267; supabase/migrations/0051 · *2026-07-17 retro-mapa*

### Las decisiones de la Retro

- **No se elige la profundidad:** «Nueva Retro» corre siempre la más profunda posible. Es configuración que el usuario no debería tener que decidir; lo que sí se amplía es QUÉ analizar y qué cruces comparar (2026-07-01).
- **Si las tareas y experimentos de la Retro anterior no se completaron, no se ejecuta una Retro nueva:** se incentiva a terminar lo anterior y solo se fuerza debatiendo por qué se ignoró. Hasta que no se complete lo anterior no tiene sentido proponer más cosas, salvo que sea muy evidente que hay que cambiar de prioridad (2026-07-11). El gate tiene que vivir server-side (ver arriba).
- **Experimentos y tareas son entidades distintas**, pero un experimento puede requerir varias tareas para ejecutarse: hay que modelarlas como cosas diferentes sin perder la relación (2026-07-11).
- **La estructura es Retro → Experiments → Conclusions / Planning**, con MaKo leyendo todas las demás tabs para generar la Retro, replicando el método SIMPLE de «Nueva campaña» — el diagnóstico que lo motivó fue «hoy parece una app barata y mal desarrollada» (2026-07-01).

### Lo que quedó sin hacer en la Retro

- **Falta el Perro en la Retro**, que se ejecute sola, que tenga fecha de creación/ejecución y que se conecte con Plan y con WhatsApp (2026-07-16).

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

## Cómo se trabaja y se prueba en esta área

Reglas de proceso que el dueño dictó mirando el resultado de corridas sobre `/plan`. No son estilo: cada una salió de algo que salió mal acá.

- **Probá vos.** Mandá los mensajes, mové el lead y devolvelo, cambiá el nombre de la campaña pausada, abrí la preview. No devuelvas la prueba al usuario: «No funciona... Por favor, prueba tú» (2026-07-20). Hay permiso permanente de preview, y él lo pide explícito: «te invito a que hagas Claude in Chrome para verificarlo» (2026-07-19).
- **Las pruebas que salen hacia afuera van siempre a martinkoncke@gmail.com y +5493764673479** (2026-07-14).
- **Resolver en una pasada.** La queja que más se repite: «Realmente no entiendo en qué te estás gastando tantos tokens y aún no solucionas las cosas que te pedí... cuántos prompts más para que lo arregles» (2026-08-07). Cuando algo ya se corrigió dos veces y sigue mal, **no va otro parche**: se lanzan multiagentes y se cierra de una — «ya dimos muchas vueltas, no sé qué tengas que hacer, si tenés que lanzar multi agente o lo que sea, pero solucionalo» (2026-07-30) · «si tienes que correr 10000mil multi agentes para hacer esto bien... pero hazlo bien» (2026-07-22).
- **Elegí tandas grandes que no necesiten su feedback y ejecutalas solo.** Preguntar de a poco lo bloquea: «selecciona las tareas que no requieran tanto de mi pensamiento o de mi feedback para que tú puedas continuar avanzando... ahora me voy a desconectar por un buen rato» (2026-07-13).
- **Terminá la feature en curso antes de saltar a otra** (2026-07-24). Y antes de construir algo grande, contale cómo lo vas a presentar para que lo apruebe (2026-07-10).
- **En cada iteración grande, reflejá lo hecho en el board `/plan`** —creando las tareas que faltaban y marcándolas— por el riel del Perro, nunca a mano: «sino, el dashboard y gestor de tareas que hicimos queda en el olvido» (2026-07-15).
- **La documentación se escribe para que la lea ÉL**, no solo otro agente: depurada, con títulos, ordenada y visible en super admin. El porqué es concreto: «si yo lo puedo entender fácil eso me habilita a darle mejores prompts al otro Claude» (2026-08-07). Este documento se lee con los ojos en `/admin/docs`.
