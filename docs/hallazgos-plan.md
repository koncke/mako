# Hallazgos del plan

El board `/plan`, el Perro Guardián, el pipeline reunión → tareas y el reparto por
proyecto. Lo que aprendimos trabajando ahí y **no se puede deducir leyendo el código**.

La regla que los produce está en [AGENTS.md](../AGENTS.md) → «La cosecha».

---

## Cosecha retroactiva (2026-08-07)

Rescatado de los journals de las 261 corridas multi-agente de junio a agosto de 2026:
**134 de 260 nunca habían escrito nada en el repo**. El registro completo de las corridas
está en [corridas-multiagente.md](corridas-multiagente.md).

⚠️ **Es material de segunda mano.** Sale de lo que devolvieron los subagentes en su
momento, no de una relectura del código de hoy. Cada entrada dice de qué corrida y de qué
fecha viene. **Antes de actuar sobre una, verificá contra el código**: varias ya están
arregladas, y donde el rescate lo sabía, lo dice.

### Trampas: el diagnóstico obvio era el equivocado

#### El sexto escritor del `detalle`: checklist-coach reescribe lo que escribieron los otros cinco

Síntoma: de los cinco orígenes de una tarea, solo claude-code conservaba el molde de 4 partes en el tablero, y Fathom saltaba de p50=136 chars en el borrador a p50=228 en la tarjeta sin que nadie tocara su prompt. Causa real: hay un SEXTO escritor aguas abajo — `checklistsParaTareas` corre dentro de `priorizarNuevasOwner` sobre TODAS las tareas de TODOS los orígenes (también las de clientes, vía todo-guardian) y su contrato pedía prosa de 2-4 frases; `fusionarDetalle` le suma ese texto al del origen, así que el markdown sobrevive solo si el origen lo trajo. La regla: cualquier contrato del campo `detalle` que no incluya a checklist-coach se rompe solo aguas abajo, y arreglar el prompt del origen no alcanza. Segunda mitad, igual de importante: cuando el coach infla el detalle sin ver el material original (105→854 chars desde el título y un stub), eso no es contexto recuperado, es maquillaje generado hoy.

**Vive en:** lib/checklist-coach.ts (CHECKLIST_BATCH_JSON_SHAPE) + lib/plan-board.ts:485 y :521 (checklistsParaTareas / fusionarDetalle) + lib/todo-guardian.ts · *2026-08-06 · contexto-de-todas-las-tareas*

#### El call-id de Fathom NO es el recording_id: el 404 no significa que la grabación no exista

`fuente.url` de las tareas guarda el id de la URL que uno copia del navegador (fathom.video/calls/<id>, rango 764M-771M), y la API keyea por recording_id (rango 158M-170M). Pedir `/recordings/<call-id>/transcript` devuelve 404 en las dos cuentas, así que parece que la grabación se borró o que la key no alcanza. Para recuperar el transcript hay que listar meetings y matchear por `m.url`. Las 6 reuniones del tablero del dueño resolvieron así: 710.000 chars de transcript vivos que el 404 daba por perdidos.

**Vive en:** plan_tareas.fuente.url (lo escribe lib/plan-fathom.ts) contra lib/fathom-api.ts · *2026-08-06 · contexto-de-todas-las-tareas*

#### El tope por tarjeta no era el problema: el scroll infinito era el historial AGREGADO

Se buscaba el bug en el `slice(0, 40)` del historial por tarjeta. Una sonda read-only a prod lo descartó: el récord real es 14 entradas en un proyecto y 6 en una tarea — ese tope NUNCA se toca. El scroll venía del historial agregado de la tab de Proyectos (191 filas hoy, con flatMap sobre todos los labels). Dos deudas quedaron abiertas del mismo hilo: el cap client-side es `HIST_CAP = 80` y el del server `slice(0, 40)`, así que el navegador puede mostrar entradas que el próximo save borra; y el nuevo `slice(0, 200)` con 191 filas reales está a punto de empezar a esconder historial sin decirlo (el botón cuenta sobre 200, no sobre el total). `NotasLista.tsx:97` sigue sin ningún tope.

**Vive en:** app/plan/board/BoardShell.tsx:1746; app/plan/board/types.ts:139 vs lib/plan-board.ts:414/522 · *2026-08-05 cierre-ronda-mako*

#### `key={obj.id}` no re-monta: un objeto nuevo con el mismo id no revalida nada

El modal de tareas recibidas inicializa sus filas con `useState(() => …)` (init perezoso desde props). Si se pinta primero lo que ya está en memoria y después llega la respuesta del server, un swap de objeto con el MISMO id no re-inicializa absolutamente nada: el modal sigue mostrando el snapshot viejo y puede ofrecer «Agregar al plan» sobre tareas ya cargadas en otra pestaña. Para que la revalidación entre, la key tiene que ser una huella de lo que importa (`id:estado:tareas.length:aplicadas.length`), no el id. Del mismo hilo: `resumenPropuestasPorRefs` ya hace `.select('id, ref, estado, tareas, aplicadas')` y reduce la columna pesada a dos `.length` — o sea trae el 85-90 % del peso de la fila y lo tira, obligando a un segundo round-trip; medido, `select('*')` cuesta lo mismo (467 ms vs 491 ms).

**Vive en:** app/plan/board/BoardShell.tsx:751 y :791; app/plan/board/TareasRecibidasModal.tsx:112; lib/plan-propuesta.ts:379-391 · *2026-08-05 cierre-ronda-mako*

#### El catálogo cerrado de proyectos tiene una puerta trasera en su propio catch

La regla escrita dice que el ruteo ya no puede inventar proyectos porque asignarTareasAProyectos elige contra una lista cerrada. Pero el `.catch()` de esa llamada devuelve `{ asign: [] }` y la línea siguiente hace `ruteo[i] || it.proyecto?.trim()` — o sea, si el ruteo falla se vuelve al nombre que inventó el modelo y nace un proyecto nuevo igual (verificado hoy en lib/plan-board.ts:287 y :306). Es la misma forma del incidente medido: la ráfaga del 05/08 dejó 19 proyectos, entre ellos tres de Instagram y dos de «Ads Content Machine». Matiza la regla ya escrita: el catálogo cierra el camino feliz, no el degradado.

**Vive en:** lib/plan-board.ts:287 y :306 (asignarTareasAProyectos + fallback) · *2026-08-05 · ~fathom-preguntas-lote-whatsapp-forense*

#### La misma reunión se analiza dos veces (y cada lectura se come cosas distintas)

Cuando dos workspaces tienen cada uno su propia key de Fathom, el mismo call queda grabado dos veces con recordingIds distintos y el pipeline lo procesa dos veces, sin saberlo. Caso medido: rec 169308217 (ws9) sacó 28 tareas y rec 169308247 (ws11) sacó 34 de la MISMA reunión de 109 minutos; la unión son ~40 compromisos, o sea que cada corrida por separado quedó 15-30% corta y se pagó el análisis dos veces. Peor: cada lectura se comió compromisos distintos — la de ws9 perdió casi todos los de Leila y la de ws11 casi todos los de Martín. Antes de repartir tareas de una reunión con cliente, cruzar contra lo que ya se creó del otro lado; a futuro, unificar por (título + fecha ±1 min) aunque el recordingId difiera.

**Vive en:** lib/reunion-auto.ts · lib/plan-fathom.ts · app_settings 'mako.fathom.cache.<recordingId>' · *2026-08-01 · ~poda-board-leila-ws11*

#### El seed del board se recorta UNA vez y nunca más: no hay re-seed

faseMin/faseMax/canales solo se leen dentro de seedRelevante, al sembrar, y seedTodoBoardSiVacio devuelve [] apenas el board tiene un proyecto o una tarea. Resultado: un board sembrado antes de un cambio del seed arrastra la forma vieja para siempre, y nada lo reconcilia. Caso medido: ws11 se sembró 8 horas antes del commit que introdujo el filtro y quedó con el proyecto «Escalar la campaña ganadora» (faseMin 3) estando en fase 1. Dos lecciones que salieron de los verificadores: faseMin significa «todavía no», no «no le aplica» (el que decide aplicabilidad es `canales`), y borrar a mano es irreversible porque nada lo vuelve a crear — la salida correcta es llevar faseMin/faseMax al RENDER (colapsar/atenuar con «todavía no te toca»), no un DELETE en prod.

**Vive en:** lib/todo-seeds.ts (seedTodoBoardSiVacio) · lib/todo-seeds-data.ts (seedRelevante) · *2026-08-01 · ~poda-board-leila-ws11*

#### Después de cambiar el prompt de extracción NO se re-extrae nada: medir el fix sin forzar es medir la salida vieja

Síntoma: se arregló el prompt de extracción de reuniones y «no movió la aguja», así que se salió a buscar la causa a otro lado (se acusó al preámbulo de marca por pedir brevedad). El verificador refutó esa hipótesis mostrando que la evidencia no significaba nada: hay TRES candados encadenados que sirven la salida pre-fix — el cache `mako.fathom.cache.<recordingId>` salvo `reanalizar:true`, `crearPropuesta` que es idempotente por `ref='fathom:<id>'` y devuelve la fila vieja sin reescribirla, y el cron que saltea la reunión si ya hay propuesta o quedó vista. El 100% de las reuniones ya leídas devuelve texto viejo. Regla: para medir un cambio de prompt de reuniones hay que apretar «Volver a analizar (gasta tokens)» Y borrar el borrador con esa `ref`; y antes de tocar código hay que descartar las dos configuraciones que le ganan al default: el override de `mako.prompt-overrides` (lib/prompt-render.ts) y el de modelo en `mako.modelos` (un pin a Groq/Gemini degrada la extracción muchísimo más que cualquier prompt).

**Vive en:** app/api/plan-fathom/route.ts:215 · lib/plan-propuesta.ts (candado por ref) · lib/reunion-auto.ts · lib/prompt-render.ts · lib/model-registry.ts · *2026-08-05 diagnostico-ronda-reuniones*

#### Precomputar el `next` fuera del functional updater: dos setState en un handler se pisan

El PriorizarWizard perdía el deadline que el usuario acababa de elegir: guardaba el checklist y la tarea seguía marcada «⚠ falta deadline», con el wizard ya cerrado. La causa no era el wizard sino `patchLog`/`patchLogExplicit`: leían `t = byId(id)` del `tasks` del render, armaban un objeto `next` COMPLETO y hacían `setTasks(ts => ts.map(x => x.id===id ? next : x))` devolviendo ese `next` constante. Como `guardar()` llama a setDeadline y setChecklist en el mismo handler sincrónico, ambos leían el mismo snapshot viejo y el segundo pisaba al primero (también en el `persist` a la base). El contraste lo prueba: `patch()` computa dentro del updater a partir del `t` fresco y no tiene el bug. La regla: en un hook con varios setters encadenables, el estado nuevo se computa DENTRO del updater, nunca antes. tsc no ve nada de esto.

**Vive en:** app/plan/board/useBoard.ts (patchLog/patchLogExplicit vs patch) + PriorizarWizard.tsx · *2026-07-12 ~auditoria-board-todo*

#### `hecho_at` se re-sellaba en cada edición porque el patch siempre mandaba el progreso

Una tarea completada el 1/7 pasaba a tener `hecho_at` del 12/7 con sólo renombrarla o arrastrarla de columna. El guard parecía correcto (`if (patch.progreso != null)`), pero `editPatch` incluía SIEMPRE `progreso: d.progress` — un número, nunca null — así que el guard era verdadero en todo touch y volvía a ejecutar `upd.hecho_at = new Date()`. El comentario decía «sella hecho_at» (una vez, al completar) y el código sellaba en cada guardado. Como el ledger de accountability se ordena por `experimento_tareas.hecho_at`, editar una tarea vieja la corría a otro período de retro. La regla: un timestamp de transición se sella comparando contra el estado PREVIO (`COALESCE(hecho_at, now())` o un SELECT antes), no ante la mera presencia del campo en el patch.

**Vive en:** lib/todo.ts editarTarea + app/plan/board/TodoBoard.tsx editPatch · *2026-07-12 ~auditoria-board-todo*

#### Ids optimistas que pasan por Number(): NaN que se descarta en silencio

Dos variantes del mismo patrón, ambas mudas. (1) Si `createTask` falla, la tarjeta queda con su id temporal `'tmp…'` para siempre: cada edición posterior manda `Number('tmp…')` = NaN, el route responde 400 y `saveTask` no chequea `j.ok` → el usuario ve que guardó y no guardó nada, hasta que recarga y la tarjeta desaparece. (2) Las etiquetas se crean con `uid()` ('xabc123'); `editPatch` hace `d.labels.map(Number).filter(Number.isFinite)` y tira las no reconciliadas sin error visible. Además, cuando el create SÍ resuelve, la reconciliación reemplaza la tarjeta optimista ENTERA por la canónica del server, descartando lo que el usuario editó durante el vuelo. La regla: mientras un id sea temporal, o bloqueá la persistencia o mapeá temp→canónico antes de mandar; y al reconciliar, mergeá dentro del updater en vez de reemplazar.

**Vive en:** app/plan/board/useBoard.ts create/createLabel + TodoBoard.tsx editPatch/saveTask + app/api/todo/route.ts · *2026-07-12 ~auditoria-board-todo*

#### Deshacer un borrado recreaba la tarea como manual y le cortaba el hilo con la retro

`remove` guarda un snapshot y el «Deshacer» del toast llama a `repo.createTask(snap)`, pero ese camino manda sólo `{titulo, prioridad}`: el server aplica `origenOk(undefined)='manual'` y deja `retro_id`/`experimento_id` en null, y el `editar` que le sigue tampoco los acepta. Resultado: una tarea que MaKo había creado desde una Retro reaparecía con ícono de usuario, perdida la atribución, y desligada del join de accountability `experimento_tareas.retro_id`. La regla: restaurar no es crear — o el 'crear' del restore lleva los campos de procedencia (el route ya los acepta), o hace falta una acción 'restaurar' que reinserte la fila completa.

**Vive en:** app/plan/board/useBoard.ts remove/undo + TodoBoard.tsx createTask + lib/todo.ts crearTarea · *2026-07-12 ~auditoria-board-todo*

#### El piso de largo que le pedís al prompt choca contra un techo de 600 en la otra punta

El detalle de las tareas de reunión salía pobre (74-265 caracteres contra las 4-8 frases que pide el prompt) y el inventario de recortes decía «los tres topes del camino son 4000/6000/6000 y nunca se tocan». Falso: hay un CUARTO y un QUINTO recorte, de 600 caracteres, justo en el camino de repartir una tarea a otro participante — `app/api/plan-reunion/route.ts:61` (`String(t.detalle).slice(0, 600)`) y `lib/plan-inbox.ts:66`. Los dos siguen vivos hoy. La regla: antes de subir el piso de largo en un prompt, buscá los topes de la ruta ENTERA por la que viaja ese texto; si no, el detalle rico llega cortado a mitad de frase exactamente en el escenario que motivó el cambio, y encima sin error.

**Vive en:** app/api/plan-reunion/route.ts:61 y lib/plan-inbox.ts:66 (el prompt vive en lib/plan-fathom.ts) · *2026-08-05 · ~borrador-reunion-fathom-frentes*

#### Resolver una persona por nombre NO se filtra por workspace: filtrarlo devuelve cero

El diagnóstico obvio fue «hay dos Mauricio Bustos Eguia en la base, desambiguá filtrando por workspace_id». Está mal y empeora lo que ya funciona: la reunión vive en el ws 9 y las dos cuentas homónimas están en ws1 y ws3 — filtrando por el ws de la reunión quedan CERO candidatos. `buscarUsuarioPorNombre` (lib/usuarios.ts:79-107) es cross-workspace A PROPÓSITO y desambigua por ESTADO: busca primero entre las cuentas `activo` y solo si ahí no hay ninguna mira el resto; con 0 o con >1 candidato devuelve null. La regla: el nombre que aparece en una reunión pertenece a una PERSONA, no al inquilino de la reunión.

**Vive en:** lib/usuarios.ts:79 (buscarUsuarioPorNombre), consumido por lib/reunion-destinatarios.ts · *2026-08-05 · ~borrador-reunion-fathom-frentes*

#### El impacto/esfuerzo que calcula el Perro se pierde en cada reload — solo para los clientes

La migración 0093 le dio columnas `impacto` y `esfuerzo` a `plan_tareas` y `plan_proyectos` (el board del dueño), pero `experimento_tareas` (el board del CLIENTE) no las tiene y `lib/todo.ts` no las menciona ni una vez. `editPatch` de app/plan/TodoBoard.tsx:36-44 manda titulo, detalle, prioridad, progreso, deadline, categorias, checklist, historial, en_prioridad, score, score_razon y fuente — todo menos impacto/esfuerzo. El guardián los calcula (useBoard.ts), se pintan en pantalla y se evaporan al recargar, así que la matriz impacto×esfuerzo de app/plan/board/Graphics.tsx:183-184 muestra «Sin impacto/esfuerzo cargado todavía» para siempre en cualquier workspace de cliente. Es un caso vivo de la regla «cambios impactan a clientes»: el dueño lo ve funcionar y el cliente nunca.

**Vive en:** app/plan/TodoBoard.tsx:36 (editPatch), lib/todo.ts, supabase/migrations/0093_plan_board.sql (columnas solo en plan_*) · *2026-07-16 · perro-guardian-captura*

#### Exportar «Solo los proyectos» en Markdown baja igual todas las tareas

En `bajar()` (app/plan/board/ExportarModal.tsx:101-103) la rama del formato se evalúa ANTES que el qué: `if (formato === 'md') → tableroAMarkdown(tareasOut, proyectosOut, ...)`, sin mirar `que`. Con «Solo los proyectos» + «Documento (Markdown)» el archivo sale con todas las tareas adentro, mientras el resumen del pie informa solo la cantidad de proyectos — que es exactamente el «descargar a ciegas» que el encabezado del componente dice existir para evitar. Además ese combo saltea el paso `cuales`, así que el markdown se genera con el default sin forma de cambiarlo. Sigue vivo. Corolario para cualquier cambio ahí: cualquier regla del tipo «con que==='proyectos' ocultá tal campo» tiene que condicionarse también al formato, porque `tableroAMarkdown` SÍ renderiza campos que `proyectosACSV` ignora.

**Vive en:** app/plan/board/ExportarModal.tsx:101-103 (bajar) + app/plan/board/exportar.ts (tableroAMarkdown) · *2026-08-05 · ~borrador-reunion-fathom-frentes*

#### El nombre del proyecto se trunca a 40 en la clave de búsqueda pero no en el índice

`aplicarPropuestas` arma el índice con los nombres COMPLETOS (`cats.map(c => [c.nombre.trim().toLowerCase(), c.id])`) y después busca con `t.proyecto.slice(0,40)`: todo proyecto de más de 40 caracteres nunca matchea y se crea un duplicado truncado. Ya pasó en prod: tres categorías de ws1 quedaron guardadas con exactamente 40 caracteres ("Validar el funnel completo (VSL → agenda", "Construir el banco de creativos y conten") mientras el seed las define completas y otros workspaces las tienen enteras — la diferencia es el camino de escritura, porque el seeder inserta directo y `crearCategoria`/`editarCategoria` cortan. Peor: como `editarCategoria` trunca en CADA guardado, un proyecto hoy bien nombrado se corta solo la primera vez que alguien lo toca. Regla: normalizar con un helper único usado en los dos lados de la comparación, y no truncar donde la columna es TEXT sin tope.

**Vive en:** lib/plan-propuesta.ts:393-402, lib/todo.ts:315 y :323, lib/mako-doer-acciones.ts:121-131 · *2026-08-01 auditoria-plan-y-whatsapp*

#### Cuanto más honesto es el modelo, más tareas se apilan en el primer proyecto

El prompt de extracción le pide al modelo dejar `proyectoId` en null si duda. Ese null viaja como `undefined` a `board.create`, y en el board del CLIENTE (`labelMode:'single'`) el default lo convierte en `labels[0]` — que por el orden `created_at` es SIEMPRE el primer seed, "Setup inicial de MaKo". En prod: las 19 tareas que ws11 sacó de una reunión quedaron todas ahí (el proyecto pasó de 6 a 25) mientras "Encontrar el primer anuncio ganador" y "Montar el seguimiento por WhatsApp" recibieron 0, y el historial nunca dice "no eligió proyecto, la puse en el primero". Encima los dos caminos de confirmación de la misma reunión terminan distinto: por el modal de extracción caen en labels[0], por el modal de borrador quedan sin proyecto. Regla: distinguir "no me pasaron proyecto" de "esta alta no eligió proyecto" (array vacío explícito), y que el fallback viva solo en el alta manual, donde además se pregunta el porqué.

**Vive en:** app/plan/board/useBoard.ts:59, app/plan/board/BoardShell.tsx:464, app/plan/TodoBoard.tsx:45, lib/plan-fathom.ts:190,245 · *2026-08-01 auditoria-plan-y-whatsapp*

#### El Perro del board no puede VER una tarea al 100% ni NOMBRAR la que encontró

Se pedía que el Perro frenara un duplicado al crear y el diagnóstico obvio («le falta un chequeo») era el equivocado: el chequeo era inejecutable. Dos límites, los dos vivos hoy. (1) Los nueve call-sites del guardián en BoardShell filtran `t.progress < 100`, así que una tarea completada es estructuralmente invisible: una tarjeta al 100% que dice «probado» y otra nueva que dice «no funciona» no se pueden contradecir, se llame cuando se llame. (2) `planResumen` se arma como `- [score] título (proyecto)` SIN ids y eso es lo que recibe la acción 'debatir' al crear: el modelo no tiene con qué señalar el duplicado. La única función que sí manda `[id] título — detalle` es `buscarDuplicados`, y tiene UN solo call-site: EliminarModal — el Perro busca duplicados cuando querés BORRAR, no cuando creás. Mismo patrón que [[ruteo-sin-detalle]]: chequeá QUÉ le llega a cada eslabón.

**Vive en:** app/plan/board/BoardShell.tsx:439 (planResumen) y :162/193/218/325/336/401/755/758/764; app/plan/board/EliminarModal.tsx:64; lib/mako-guardian.ts:347 · *2026-07-16 · ~perro-ataja-duplicados-al-crear*

#### `setChecklist` pisa en silencio si tocás dos veces la misma tarea, y reabre sola una tarea al 100%

El caller le pasa el array `next` ya calculado, y lo calcula leyendo `tasks` del render actual (`byId` adentro también). Dos mutaciones sobre la MISMA tarea dentro de un mismo loop (típico de aplicar un lote de decisiones de MaKo) hacen que la segunda pise a la primera, sin error y sin rastro: hay que agrupar por id y fusionar en un solo patch antes de llamar. Aparte, deriva el progreso INCONDICIONALMENTE (`done/total`): agregarle 2 ítems sin tildar a una tarea 4/4 la baja a 67% y la reabre sola, y si la tarea no tenía checklist, N ítems nuevos la dejan en 0%. Sirve como mecanismo de «reabrir» deliberado, pero es una trampa si solo querías sumar ítems.

**Vive en:** app/plan/board/useBoard.ts:172-180 (setChecklist) · *2026-07-16 · ~perro-ataja-duplicados-al-crear*

#### Los dos motores de auto-cierre trabajan sobre tablas distintas y no se cruzan nunca

Síntoma: aparecieron 62 tareas que ya estaban hechas y ninguna se había cerrado sola, aunque hay dos mecanismos de cierre automático corriendo. El diagnóstico obvio —«faltan señales»— era el equivocado. Causa real: `autocompletarPorSenales` escribe con `editarTarea` de lib/todo, que toca EXCLUSIVAMENTE `experimento_tareas` (el board del CLIENTE), y el cron `tareas-verificar` llama `listTareas()`, que es la misma tabla; el bot de commits lee SOLO `plan_tareas` del super-admin. Medido contra prod el 6/8: ws9 tiene 408 abiertas en plan_tareas y CERO en experimento_tareas — el cron entra al workspace del dueño, encuentra la lista vacía, cierra 0 y se va. La regla que queda: agregar una señal en lib/plan-senales.ts no puede tocar ni una tarea del tablero del dueño; antes de sumar la señal número 14 hay que enchufar plan_tareas al motor (y filtrar por origen, para que una señal de negocio no cierre una tarea de código).

**Vive en:** lib/todo-seeds.ts:117 (autocompletarPorSenales) · app/api/cron/tareas-verificar/route.ts:33 y :62 · lib/cerrar-por-commits.ts:79-86 · app/plan/page.tsx:35,57 · *2026-08-06 senales-de-avance*

#### leerSenales destructura 13 lecturas POR POSICIÓN de un Promise.all

`leerSenales()` hace un `Promise.all` de 13 lecturas y las recibe en un array destructurado por orden, para después armar el objeto de señales a mano. Insertar una señal en el medio corre todas las demás un lugar y cada señal pasa a leer la tabla de otra — en silencio, y sin que TypeScript diga nada, porque las 13 son `boolean`. Es la misma familia del bug de `funnel_config` que ya está documentado tres líneas más arriba en ese archivo. Verificado vivo el 7/8/2026. La regla: al tocar ese bloque, agregar la señal al FINAL del array y del objeto, o pasar a un registro `{ id, evidencia, leer() }` como ya hacen lib/integraciones-catalogo.ts y lib/tab-activacion.ts.

**Vive en:** lib/plan-senales.ts:87-115 (leerSenales) · *2026-08-06 senales-de-avance*

#### Dos señales cierran tareas con el dato equivocado, y ninguna mira la fecha

`nutricion-activa` es `hayFilas('nutricion_secuencias')` y NO mira la columna `activa`: una secuencia guardada y apagada cierra igual la tarjeta cuya checklist termina en «Activar» (en prod ws1 tenía 25 secuencias y solo 13 activas). `oferta-definida` es `haySetting('mako.entregable')`, que es el LEAD MAGNET, no la oferta — y con eso cierra «Definir la oferta y el precio»; la fuente correcta es la tabla `productos` (mig 0117), que hoy no lee nadie. Encima `hayFilas` devuelve `count > 0` sin mirar CUÁNDO: una señal sin timestamp no distingue «esto ya estaba antes de que la tarea existiera» de «esto pasó porque alguien la hizo», que es exactamente la diferencia entre cerrar bien y cerrar mal. El único lugar del repo que ya lo hace bien es `landingRecibioEventos`, que exige eventos dentro de una ventana de días: ese es el molde. Todo verificado vivo el 7/8/2026.

**Vive en:** lib/plan-senales.ts:53-59 (hayFilas), :104 y :106 · lib/todo-seeds-data.ts (EVIDENCIA_SENAL) · lib/landing-token.ts:116-124 · *2026-08-06 senales-de-avance*

#### El dedup descarta los tokens de 2 letras, que son justo los que distinguen una tarea de otra

`palabrasClave` filtra `w.length > 2`, así que R1, R2, IA, WA, A/B, CPA, ROI o Q4 se caen antes de comparar. Caso real y único en toda la base: «Medir el show-rate de la R1» vs «Medir el impacto en el show-rate» quedan como {medir,show,rate} ⊂ {medir,impacto,show,rate} y disparan las DOS ramas del criterio (Jaccard 0.75 y contención con ≥3 palabras). Son tareas distintas: una instrumenta la métrica base, la otra mide el efecto de las secuencias — distinto detalle, distinto checklist, distinto proyecto. Fue el ÚNICO par que el criterio marcó en los cuatro tableros de producción, y era un falso positivo. En este dominio el token corto es señal, no ruido: antes de tocar el umbral, mirá la tokenización.

**Vive en:** lib/tareas-dedup.ts:31 (palabrasClave) · *2026-08-01 dedup-y-envio-a-mi-plan*

#### El cruce anti-duplicados falla ABIERTO y mudo: «no pude leer» y «no hay duplicados» son la misma respuesta

`cruzarCandidatas` hace `try { parseJsonObject(raw) } catch { return { cruces: [] } }`. Una respuesta cortada por maxTokens devuelve exactamente lo mismo que «ningún duplicado», y `CruceOut` no tiene campo `error` donde decirlo. Ya pasó una vez con maxTokens 1500 —por eso hoy está en 4000 y el comentario del código lo cuenta—, y con 40 candidatas contra un plan grande 4000 vuelve a quedar al límite. El gemelo `puntuarPlan` resolvió lo mismo agregando `error?: string` recién después de 13 corridas pagadas sin una sola prioridad aplicada. La regla: un chequeo que puede quedarse ciego tiene que poder DECIR que se quedó ciego. Fail-open está bien; fail-open mudo, no.

**Vive en:** lib/mako-guardian.ts, cruzarCandidatas (el catch de parseJsonObject) · *2026-08-01 dedup-y-envio-a-mi-plan*

#### «Esto se hace en MaKo» está exactamente invertido: se escribe donde molesta y falta donde sirve

El campo `hacelo_en` (botón «Ir a Ads Manager») solo se persiste en el board del DUEÑO (`lib/plan-board.ts`), y el board del CLIENTE —el único destinatario legítimo— lo descarta: `priorizarNuevasCliente` aplica score, razón, detalle y checklist pero nunca `haceloEn` (ni deadline, ni impacto, ni esfuerzo), y el adapter del TodoBoard tampoco lo mapea, aunque la columna existe desde la mig 0115. Medido en prod: de las 15 tareas con el campo puesto, 13 son tareas de CONSTRUIR la pantalla a la que te mandan (#524 «Dashboard: separar salud…» → «Ir a Dashboard») — precisión ~13%. La causa raíz no es el modelo: `puntuarNuevas` inyecta el catálogo de capacidades SIEMPRE, sin distinguir tablero, y en el board del super-admin los proyectos se llaman igual que las tabs POR DISEÑO, así que el match del título es perfecto con el significado invertido. Y la regla del prompt solo prohíbe «esto no pasa por ninguna pantalla»; no contempla «la tarea ES construir esa pantalla» (ni «evaluarla», «definirla»).

**Vive en:** lib/mako-guardian.ts:605 (regla del prompt) y :734 (inyecta capacidades siempre) · lib/plan-board.ts:464 (único que persiste) · lib/todo-guardian.ts:72 (lo descarta) · app/plan/TodoBoard.tsx · *2026-08-05 ronda-clientes-y-automatizacion*

#### El proyecto huérfano no era criterio de la IA: era un uid() que se volvía NaN

Síntoma: 7 tareas de ws1 sin proyecto y 4 proyectos autocreados con 0 tareas; todo apuntaba a que el modelo clasificaba mal. Causa real: BoardShell crea el proyecto nuevo con `const nuevoId = uid()` ('x…') y le asigna ESE string a la tarea; `useBoard.createLabel` recibe el id canónico del server pero devuelve void (types.ts:99 lo tipa `Promise<Label>`, la implementación no lo cumple), y TodoBoard hace `categorias: d.labels.map(Number).filter(Number.isFinite)` → NaN → se descarta → `categorias: []`. Verificado en prod: las huérfanas son EXACTAMENTE las tareas cuyo proyecto era nuevo, ni una más; un proyecto autocreado con 0 tareas es la huella dactilar del bug, porque si el modelo no lo hubiera nombrado el proyecto no existiría. Regla: cuando el id lo genera el cliente y lo canoniza el server, el creador tiene que devolver el canónico y el caller usar ESE, no el temporal.

**Vive en:** app/plan/board/BoardShell.tsx:513-530 · app/plan/board/useBoard.ts:222-227 · app/plan/TodoBoard.tsx:37 · *2026-08-01 tareas-por-cliente*

#### Los proyectos se reusan por NOMBRE entre reuniones, y el historial del proyecto apunta al cliente equivocado

BoardShell reusa un proyecto existente comparando `norm(l.name) === norm(nom)`. La extracción de «Junta Patricia Muñoz baja teriyaki» (00:25) creó «Sistemas y Formulario Operativo», «Capacitación Operativa» y «Programa de Mantenimiento Preventivo» y los dejó vacíos; 13 minutos después la extracción de «Junta con Sergio y Adriana» (Grupo Esquer) los vio en la lista con id numérico y les metió 14 tareas de OTRO cliente. El `historial` de esos proyectos dice «Creó el proyecto — de la reunión «Junta Patricia Muñoz baja teriyaki»» aunque el 100% de su contenido sea de Esquer: quien reparta guiándose por la procedencia del PROYECTO manda 14 compromisos al cliente equivocado. Para atribuir hay que mirar la `fuente.etiqueta` de cada TAREA.

**Vive en:** app/plan/board/BoardShell.tsx:513-522 · tarea_categorias.historial · *2026-08-01 tareas-por-cliente*

#### El email del cliente no está en 65 de 66 tareas, y «mirar todos los emails» no aporta ninguno

El plan obvio era cruzar los participantes de la reunión contra `leads` por email. Medido: de 66 tareas con fuente Fathom, solo 1 cuelga de una grabación donde aparece el email de alguno de los 9 clientes. `participantesDeReunion` YA incluye calendar_invitees + recorded_by + action_items[].assignee — el mismo universo que `emailsDeLaReunion` — y en las reuniones que el dueño graba desde su lado devuelve únicamente su propio email; `closing_analyses` las guarda con `invitee_email` NULL y `category='interna'`. El fallback por nombre es peor: «Adriana» matchea 3 leads no relacionados. La única señal que funciona en las 3 reuniones de cliente es el TÍTULO de la grabación.

**Vive en:** lib/plan-fathom.ts:72-97 · lib/reunion-clasificar.ts:47-74 · app_settings 'mako.fathom.cache.<recordingId>' · *2026-08-01 tareas-por-cliente*

#### callId y recordingId son dos espacios de id distintos; el único puente es closing_analyses

`experimento_tareas.fuente.url` guarda el CALL id de Fathom (760170818), mientras el cache por reunión (`mako.fathom.cache.*`) y `closing_analyses.recording_id` usan el RECORDING id (167004346). No hace falta inventar una tabla ni una «memoria de workspace»: `closing_analyses` guarda `call_url` y `recording_id` en la MISMA fila, más `invitee_email` y `lead_id`. La cadena es tarea.fuente.url → callId → closing_analyses.call_url → recording_id → cache. Filtrar SIEMPRE por workspace_id: el callId de «Mau <> Martin» solo existe en ws9, consultarlo sin scope es un leak cross-tenant.

**Vive en:** closing_analyses (call_url + recording_id) · lib/plan-fathom.ts (cacheKeyReunion) · *2026-08-01 tareas-por-cliente*

#### Arreglar la detección de cliente APAGA el cron de reuniones

`reunion-auto` procesa solo las reuniones con `tipo === 'equipo'`. Hoy las reuniones del dueño con SUS clientes caen en 'equipo' por accidente: `clasificarReunion` busca el lead solo entre los `is_external` calendar invitees, y `listarUsuarios()` usa `getSupabaseServer()` sin scope de workspace, así que el host-usuario gana. El día que el matcheo de leads funcione, esas reuniones pasan a 'entrega' y el cron las descarta: el usuario deja de recibir los borradores de su trabajo real y parece que «el cron dejó de andar». Cualquier mejora del clasificador tiene que aceptar 'entrega' con cliente detectado EN EL MISMO cambio.

**Vive en:** lib/reunion-auto.ts:138 · lib/reunion-clasificar.ts:65 · lib/usuarios.ts:33 · lib/reunion-gate.ts:26-32 · *2026-08-01 tareas-por-cliente*

#### `esDeOtro` se calcula contra el HOST de la grabación, no contra quien va a responder

El «yo» de la extracción sale de `r.host?.email` y, si no hay host, del primer admin del workspace. Pero el borrador se crea a nivel WORKSPACE, sin columna de usuario, y BoardShell se lo ofrece a cualquiera que entre a /plan. Si el que abre el modal no es el host, TODAS las preguntas de contexto son sobre tareas ajenas por construcción, sin que haya pasado nada raro en el medio. Peor: el cache por reunión es compartido per-workspace, así que la extracción manual devuelve las tareas con los flags calculados contra el HOST — y a la inversa, una extracción manual fresca pisa el cache con flags calculados para el usuario logueado.

**Vive en:** lib/reunion-auto.ts:105-114 y :172 · lib/plan-fathom.ts:437 (preguntasDeContexto) · app/api/plan-fathom/route.ts:100-115 · *2026-07-30 fathom-preview-cards*

#### La API de Fathom ignora dos de sus propios filtros, no expone sus webhooks y devuelve un número como string

`?recording_id=X` en `/meetings` se IGNORA y devuelve las más recientes: para una grabación puntual hay que usar `GET /recordings/{id}/transcript` y `/summary` (no existe `/meetings/{id}`). `recorded_after` también se ignora; el filtro real lo aplica la lib a mano. No hay API para leer ni actualizar los webhooks de Fathom (404 en las 4 variantes): se re-registran a mano en la consola en cada mudanza de dominio, y hay 3 cuentas. Y `closing_analyses.score` es NUMERIC, que PostgREST serializa como STRING ("7.5"): hay que coercionar con `Number()` antes de cualquier promedio, o el KPI sale roto sin error.

**Vive en:** lib/fathom-api.ts (fathomGet) · lib/plan-fathom.ts:131 y :161 · lib/closing.ts · *2026-07-30 fathom-preview-cards*

#### `nuevos` del ruteador no manda ni una tarea: el proyecto nuevo solo nace si el modelo repite el nombre en `asign`

Síntoma: «el Perro nunca abre un proyecto nuevo aunque le dictes una feature entera». El diagnóstico obvio (el prompt de las 4 condiciones es demasiado restrictivo) era solo la mitad. `asignarTareasAProyectos` devuelve `{ asign, nuevos }`, pero el `.map` de mako-guardian.ts:526 TIRA el array `tareas` (los índices) que el modelo puso en cada `nuevo`, y el tipo `RuteoNuevo` (l.468) ni siquiera lo declara. Río abajo, plan-board.ts arma el ruteo solo con `asign` (l.283) y el mapa `propuestosPorElPerro` (l.287) se consulta después únicamente para DECORAR el proyecto con emoji/porqué (l.308): si el modelo propone un proyecto y no repite ese nombre en `asign`, no se crea nunca y el hecho no se loguea. En el camino del CLIENTE (todo-rutear.ts:90-101) `r.nuevos` se descarta entero, así que un proyecto que igual llega por `asign` nace sin `que`, sin `porQue` y sin renglón de historial. Y el filtro `if (n.cuantas < 3) return false` (l.521) es matemáticamente imposible en los lotes de WhatsApp de 1 o 2 tareas — medido en prod — y descarta el 100% en silencio.

**Vive en:** dashboard-marketing/lib/mako-guardian.ts (RuteoNuevo 468, filtro 521, .map 526) + lib/plan-board.ts:279-308 + lib/todo-rutear.ts:90-101 · *2026-08-05 whatsapp-contexto-perdido*


### Reglas que quedan

#### El front no mira si el server hizo el trabajo, y falla mudo

Dos casos del mismo patrón en el board. (1) `rePriorizar` chequea solo `j.ok`: la ruta del Perro devuelve `{ok:true, ...}` incluso cuando puntuarPlan cortó y trae `error` + arrays vacíos, así que aplica el no-op, marca la firma como procesada y no avisa nada — el propio código ya documenta el precedente: 13 corridas pagadas (US$2.74) sin una sola prioridad aplicada y nadie se enteró. Para el dueño es peor que invisible: `recordUsage` ya corrió, así que salta el toast "MaKo usó IA · re-priorización · $X" confirmando un cobro por una corrida que no aplicó nada. (2) `deleteTask` no mira el `ok` y ni `apiPlan` ni `api` tiran nunca: un 403/500/corte de red se traga, la tarjeta desaparece localmente y vuelve en la siguiente carga — literalmente "pareciera que no se borró". Regla: un update optimista necesita fail-loud (revertir + avisar), y si el envelope trae un campo `error`, el consumidor lo lee.

**Vive en:** app/plan/board/BoardShell.tsx:290-296, app/plan/PlanBoard.tsx:746, app/plan/TodoBoard.tsx:77, lib/mako-guardian.ts:403-415 · *2026-08-01 auditoria-plan-y-whatsapp*

#### Un opt-in guardado en localStorage sin workspace se filtra al impersonar

`AUTOLOAD_KEY = 'mako_reunion_autoload'` es una key por ORIGEN, sin namespace. El super-admin prende «cargalas solas al plan» en su propio board, después entra como un cliente (mismo origen, mismo localStorage) y abre una reunión de equipo de ese cliente: `finalizar()` lee autoload=true, saltea la pantalla de revisión y le inyecta tareas al plan del cliente, donde nunca optó por nada. No es fuga de datos (las tareas son suyas y van a su plan), es fuga de CONSENTIMIENTO. Regla: toda preferencia o consentimiento guardado en localStorage se namespacea por workspace_id.

**Vive en:** app/plan/board/ReunionExtractModal.tsx:19 y :94-147 · *2026-07-18 ~review-autocarga-reunion*


### Decisiones tomadas, y por qué

#### El `window.location.reload()` al aplicar un borrador es el contrato, no pereza — no lo cambies por estado local

`onListo={() => window.location.reload()}` parece un atajo obvio de arreglar, y romperlo degrada la pantalla. Dos razones concretas: no existe ningún endpoint de listado de tareas (ni `/api/todo` ni `/api/plan-board` tienen acción de listar; tareas y categorías salen ÚNICAMENTE del server component `app/plan/page.tsx` con `force-dynamic`), y el Perro corre server-side DESPUÉS de crear, con sus parches descartados a propósito (hay un comentario textual en la rama cliente de plan-propuesta que lo dice). La respuesta de `aplicar-lote` devuelve `{ ok, ids, borradas }` — ids pelados, sin título, score, checklist ni fuente. Pintar con eso mostraría las tarjetas sin score y sin checklist, justo lo que el usuario espera ver.

**Vive en:** app/plan/board/BoardShell.tsx:630 · lib/plan-propuesta.ts (rama cliente de aplicarPropuestas) · *2026-08-01 · auditoria-plan-tareas-basura*

#### `categorias: []` es un contrato deliberado — no poner un gate que lo prohíba

La reacción obvia al ver 7 tareas sin proyecto es prohibir categorías vacías en el alta. Es una regresión: useBoard.ts:60-65 documenta que `[]` significa «esta tarea NO va a ningún proyecto» y que con `undefined` TODO terminaba dentro de «Setup inicial de MaKo», incluidas tareas de otras personas — que es justo la queja que se estaba investigando. Además el gate no frenaría nada: esas tareas no pasan por `crearTarea` ni por `agregarTareasPlanOwner`, entran por /api/todo desde TodoBoard. Si hace falta un destino, va una categoría «Sin clasificar» explícita, nunca un fallback que hereda el primer proyecto del tablero. Nota del mismo barrido: `tarea_categorias` no tiene parent_id ni estado archivado, y el único borrado de la UI (`deleteLabelYTareas`) borra el proyecto Y TODAS SUS TAREAS — «degradar a sub-etiqueta» o «archivar» no existen.

**Vive en:** app/plan/board/useBoard.ts:60-65 y :268-274 · lib/todo.ts (crearTarea) · lib/plan-board.ts (agregarTareasPlanOwner) · *2026-08-01 tareas-por-cliente*


### Lo que quedó sin hacer

#### Cero preguntas engendra cero preguntas: el generador que sí funciona cuelga de la otra puerta

`preguntasParaCargar` arma preguntas cerradas leyendo las tareas y su detalle, sin depender de lo que haya mandado el modelo del doer — pero su ÚNICO call-site es el modal del board (`TareasRecibidasModal.tsx:412`). El link que MaKo manda por WhatsApp va a /plan/revisar/[id], que arma los pasos con `prop.preguntas` y encima gatea la repregunta dinámica en `prop.preguntas.length > 0`: con 0 preguntas el wizard es una sola pantalla de «Crear». El mismo borrador pregunta si entra por el board y no pregunta si entra por el link. Por eso el reclamo «¿por qué no me lo preguntó?» no se arregla tocando el prompt del doer. Verificado vivo el 2026-08-07: sigue así.

**Vive en:** app/plan/revisar/[id]/RevisarPropuesta.tsx:211 y :222 · lib/plan-propuesta.ts:536 · app/api/plan-propuesta/route.ts:124 · *2026-08-06 · contexto-de-todas-las-tareas*

#### El gate del Perro vive en el modal y `/api/retro` no tiene gate de sesión

El chequeo de «no te dejo eliminar esto» es 100 % client-side: la API solo devuelve el veredicto y nada lo enforcea. Peor, `/api/retro` no llama a `getUsuarioActual()` (a diferencia de `/api/mako-guardian`, que devuelve 401), así que un `POST {action:'generar'}` saltea cualquier gate que viva en el wizard — y esa ruta son hasta 9 llamadas a Opus con effort xhigh y maxTokens 24000 por corrida. Si se implementa el gate de «terminá lo anterior antes de correr una Retro nueva», tiene que vivir en `generarRetroV3`/el route, no en el modal.

**Vive en:** app/api/retro/route.ts; app/experimentos/EliminarModal.tsx:101-133; lib/retro-pipeline.ts · *2026-07-17 retro-mapa*

#### `experimento_tareas.retro_id` se escribe siempre y no se lee nunca

El join key que haría honesta la rendición de cuentas de la Retro ya se persiste en los dos caminos (tarea plana y chain de experimento), pero un grep repo-wide devuelve solo escrituras, tipos y seeds: cero lecturas. La query que falta es una sola y no necesita migración: `select id,titulo,estado,progreso,hecho_at from experimento_tareas where retro_id = <id>` vía getTenantDb. Tres huecos que sí quedan: la columna no tiene FK ni índice (seq-scan), el link retro→experimento vive enterrado en `experimentos.config->>'retro_id'` (jsonb, no indexable), y `borrarTarea` es hard delete, así que una tarea borrada es indistinguible de una nunca creada.

**Vive en:** lib/retro-pipeline.ts:601-607 y :593-598; lib/todo.ts:267; supabase/migrations/0051 · *2026-07-17 retro-mapa*

#### Las respuestas del wizard del Perro son write-only: viven en un prompt efímero y se tiran

El contexto que el dueño contesta (hasta 6 preguntas iniciales más las de profundizar) viaja como parámetro de función hasta puntuarNuevas y muere ahí. Al aplicar, el UPDATE escribe `notas: []` en las dos ramas del ternario y no existe ninguna columna donde guardar lo respondido (verificado hoy: lib/plan-propuesta.ts:825-826, sin columna `respuestas`). En el camino feliz sobrevive el derivado (score, razón, detalle); si el Perro falla o si la request se corta por timeout (maxDuration 300 y el Perro corre en tandas de 20 DESPUÉS de marcar el borrador aplicado), el trabajo se pierde entero: el reintento choca con «La propuesta ya fue aplicada», la pantalla dice «✓ Creé N tareas» y el cliente borra su única copia en localStorage justo en ese momento.

**Vive en:** lib/plan-propuesta.ts:825 (notas: []) · app/plan/revisar/[id]/RevisarPropuesta.tsx · app/api/plan-propuesta/route.ts · *2026-08-05 · ~fathom-preguntas-lote-whatsapp-forense*

#### Al cliente le viajan las tareas de la agencia aunque no entren a su tablero

Un borrador de reunión compartida trae las tareas del otro con esDeOtro:true. El server las filtra bien al aplicar, pero el payload que se sirve al wizard del cliente incluye sus títulos y detalles: en el caso real, una clienta veía en su pantalla el precio de suscripción $49/$99, el costo de tokens por usuario, el CAC objetivo y el plan de beta de 30 personas. Encima el contador no filtra esDeOtro (`nT = prop.tareas.length`), así que el botón decía «Crear 34» y el éxito «Creé 34 tareas» cuando el server creaba 13. Falta decidir si el payload se filtra en la lectura para workspaces que no son dueños de esas tareas.

**Vive en:** app/plan/revisar/[id]/RevisarPropuesta.tsx · lib/plan-propuesta.ts (filtro !esDeOtro al aplicar) · *2026-08-01 · ~poda-board-leila-ws11*

#### El tope de 25 de listMeetingsPage es un índice mudo: si la reunión no está entre las últimas 25, se cae media extracción

`extraerTareasDeReunion` busca la reunión dentro de `listMeetingsPage({ limit: 25 })` sin cursor para sacar `meta`. Si extraés a mano una reunión que quedó fuera de esa página (llegaste por «Cargar más» o por el filtro de fecha), `meta` es undefined y en cascada se pierden tres cosas sin un solo aviso: los action items de Fathom con su dueño ya atribuido, la lista de participantes (el user prompt pasa a decir literalmente «no tengo la lista de invitados» mientras el system exige nombrar a quién lo pidió) y hasta el rescate por Google Calendar, que necesita `meetingStartIso(meta)` para buscar el evento. El mismo patrón está en /api/plan-reunion, que resuelve destinatarios contra las últimas 40 y responde un 409 que la UI tira. Arreglo barato: paginar por cursor 2-3 páginas o subir el limit (es metadata, sin transcript).

**Vive en:** lib/plan-fathom.ts:753 y :772-795 · app/api/plan-reunion/route.ts (respaldo de 40) · *2026-08-05 diagnostico-ronda-reuniones*

#### «Cargar en su plan» devuelve 403 justo para el participante resuelto por nombre

El candado anti-spam de `app/api/plan-reunion/route.ts:115` valida al destinatario con `participantes.find(p => p.email === email)` contra la lista blanca cacheada al extraer. Cuando el email se resolvió POR NOMBRE, el participante cacheado tiene `email: ''` y ese find falla → 403 «Esa persona no estuvo en la reunión». El botón «Enviar» se salva porque el front manda `manual: !dest?.email` (ReunionTareas.tsx:628); «Cargar en su plan» (ReunionTareas.tsx:646) NO manda ese flag. Se agregó un escape `esVos` para el caso propio, pero la asimetría entre los dos botones sigue viva: para cualquier tercero resuelto por nombre, «Cargar» revienta y «Enviar» funciona.

**Vive en:** app/plan/board/ReunionTareas.tsx:646 (falta `manual: !dest?.email`) vs app/api/plan-reunion/route.ts:115-118 · *2026-08-05 · ~borrador-reunion-fathom-frentes*

#### El canal `eliminar` se propone y no se puede confirmar nunca; y el agente no puede mandar un lote de puros cierres

Dos cabos sueltos del riel de propuestas, los dos vivos el 7/8/2026. (1) El canal `eliminar` lo producen tres caminos y `aplicarPropuestas` lo sabe ejecutar, pero el wizard de revisión no tiene paso para confirmarlo: su `type Step` es `'cerrar'|'q'|'dyn'|'confirm'` y al aplicar solo manda `cerrarIds` y `aMediasIds`. Se propone y muere ahí. (2) `POST /api/agente/plan` corta con 400 «mandá al menos una tarea en tareas» aunque quince líneas después acepte `cerrar`: Claude Code no puede mandar un lote de puros cierres sin inventarse una tarea de relleno.

**Vive en:** app/plan/revisar/[id]/RevisarPropuesta.tsx:94 y :241-243 · lib/plan-propuesta.ts:668-669,725 · app/api/agente/plan/route.ts:92 vs :110 · *2026-08-06 senales-de-avance*

#### Cargar tareas a mano desde una reunión no deja rastro, y el cron vuelve a proponer lo mismo con otras palabras

`crearDesdeReunion` escribe al tablero pero solo guarda `fuente: {tipo:'fathom', etiqueta:<título>}`, sin el recordingId, y la ruta manual no escribe el candado que el cron lee (KEY_VISTA). Caso real: las tareas 171/172 del ws1 se cargaron a mano a las 03:04 y 12 horas después el cron dejó el borrador de la MISMA grabación con los mismos dos compromisos reformulados — Jaccard 0.07 y 0.08, o sea que el guard léxico ni los ve. Encima `titulosDelTablero` mira solo las tareas abiertas a propósito, así que una tarea ya completada es estructuralmente invisible al guard. OJO con el arreglo obvio: escribir KEY_VISTA (o una propuesta 'aplicada' con ese ref) al cargar a mano suprime el borrador ENTERO — en ese caso concreto, para matar 2 duplicados se perdían las 16 tareas de otra persona, que solo viajan por ahí. El rastro tiene que ser por TAREA, y el cruce contra lo ya cargado de esa grabación tiene que ser semántico, no léxico.

**Vive en:** app/plan/board/BoardShell.tsx (crearDesdeReunion) · lib/reunion-auto.ts (existePropuestaRef + KEY_VISTA) · lib/plan-propuesta.ts (titulosDelTablero) · *2026-08-01 dedup-y-envio-a-mi-plan*

#### Dos caminos de creación de tareas de reunión con semánticas incompatibles

`ReunionExtractModal.confirmar → onCrear → crearDesdeReunion` crea de a una y NO toca `plan_propuestas`. `TareasRecibidasModal.aplicar → aplicar-lote → aplicarPropuestas` marca el borrador y guarda `aplicadas`. Si una pantalla muestra el contenido de un borrador y usa el primer camino, el borrador queda pendiente con las mismas tareas adentro y la próxima entrada al plan las vuelve a ofrecer: se crean dos veces. Segundo efecto silencioso: `crearDesdeReunion` declara su parámetro sin `minuto`/`minutos`, que `aplicarPropuestas` sí usa para armar el `?timestamp=` — mezclar los caminos deja tarjetas de la misma reunión, unas con link al minuto y otras sin. Aparte: hay borradores que JAMÁS aparecen en la lista de Fathom (los que crea `cargarTareasEnPlanDe` en el workspace de otra persona, que no tiene esa grabación en SU Fathom); si el botón de Fathom deja de ser la puerta de vuelta, esos quedan inalcanzables.

**Vive en:** app/plan/board/ReunionExtractModal.tsx:152-159 · app/plan/board/BoardShell.tsx:425 y :517 · lib/plan-propuesta.ts:274-330 · lib/reunion-destinatarios.ts:189 · *2026-07-30 fathom-preview-cards*

