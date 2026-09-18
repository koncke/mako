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
