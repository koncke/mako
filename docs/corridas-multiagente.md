# Registro de corridas multi-agente

Las 260 corridas de workflow que dejaron rastro en disco entre junio y agosto de 2026,
con **3340 subagentes** en total. Existe porque el contexto de un subagente no vuelve: lo
único que queda es el texto que devolvió, y ese texto vive en journals que nadie iba a
abrir. Esto es el índice.

| Veredicto | Corridas | Qué significa |
|---|---|---|
| **rescatada** | 134 | Encontró algo durable que **no** estaba escrito en el repo. Se cosechó el 2026-08-07 |
| ya escrita | 75 | Sus conclusiones ya estaban en `AGENTS.md`, en `docs/` o en las memorias |
| — | 51 | Exploración, generación de contenido, o quedó obsoleta |

**Más de la mitad de las corridas nunca escribió nada.** Ése es el argumento de la regla
de la cosecha en [AGENTS.md](../AGENTS.md): sin una fase final que escriba en el repo, el
trabajo de los agentes se evapora. Lo rescatado está repartido por área en los
`hallazgos-*.md` (índice en [hallazgos.md](hallazgos.md)), bajo «Cosecha retroactiva».

Los nombres con `~` los infirió el rescate: esas corridas son anteriores a que se
persistiera el script del workflow, así que no conservaban nombre propio.

Los journals siguen en disco, en
`~/.claude/projects/<proyecto>/<sesión>/subagents/workflows/<runId>/journal.jsonl`.


## 2026-09

| Fecha | Corrida | Agentes | Qué se fue a buscar | |
|---|---|---|---|---|
| 2026-09-16 | `reunion-mau-martin-2026-09-08-tareas` | 46 | Todas las tareas de la llamada «Mau <> Martin: CHATBOT» del 8/9: extraer con 11 lentes, fusionar, refutar contra el transcript, ubicar cada una en el código y asignarle un chat por tab | **rescatada** |
| 2026-09-16 | `reunion-mau-martin-tareas-v2` | 45 | Lo mismo para la continuación del 9/9: la skill de MaKo en el Claude de Mauricio, la oferta grupal evergreen y la reactivación de los leads que no cerraron | **rescatada** |

Lo cosechado está en hallazgos-plan.md («El Plan de Mauricio es la tabla de clientes») y en
hallazgos-comunicacion.md («La post-agenda del ws 1 quedó prendida y no le llegó un audio a nadie»).

**Lo que costó aprender en estas dos.** Refutar **por tarea**, con tres agentes que leen el
transcript entero cada uno, son tres lecturas completas por tarea: con 57 y 75 tareas fueron unos 400
agentes. El límite de sesión cortó las dos corridas en esa fase, dos veces, y se perdieron unos 370.
La misma verificación **en lotes de 8 tareas por agente** fueron 34 agentes y terminó. Y el paso que
ubica cada tarea en el repo tiene que leer `git log` en el momento: el prompt decía «después del 11/9
no hubo commits» y el 16/9 ya había cuatro.

## 2026-08

| Fecha | Corrida | Agentes | Qué se fue a buscar | |
|---|---|---|---|---|
| 2026-08-07 | `ideas-content-machine` | 6 | Diseño de la tab /ideas: qué generadores de contenido existen de verdad, cómo expandir una idea y cómo capturarla (input con placeholder animado) | **rescatada** |
| 2026-08-07 | `~cerrar-pendientes-de-hallazgos` | 9 | Cierre de los pendientes de docs/hallazgos-*: zona horaria en display de la ficha, WizardShell vs el chrome forkeado de StageMoveDialog, fuente única del mapeo índice→R1/R2, paginado con leerTodo/leerPorPaginas y validación de requisitos en setPipelineStage | ya escrita |
| 2026-08-07 | `~selector-hora-y-cinco-bugs-del-crm` | 11 | Rediseño del selector de hora del reagendado (combobox + agenda de Google) y cierre de 5 bugs del worklist/etapas del CRM | ya escrita |
| 2026-08-07 | `contexto-mako-md` | 7 | Consolidar en un solo documento el vocabulario, las fronteras, el estado real y las trampas del repo, para que una sesión nueva arranque sin releer todo | **rescatada** |
| 2026-08-06 | `~resumenes-por-proyecto` | 3 | Escribir el resumen de cada proyecto del board /plan; 3 agentes en paralelo, 8 escritos cada uno | — |
| 2026-08-06 | `rediseno-notificaciones` | 7 | Rediseño de Configuraciones › Notificaciones a matriz evento × canal: inventario del sistema de diseño, auditoría de si se pueden borrar las cards de teléfono y plantilla, y crítica adversarial del "logo en gris" | **rescatada** |
| 2026-08-06 | `contexto-de-todas-las-tareas` | 8 | Por qué el campo `detalle` de las tareas del plan sale pobre según el origen (Fathom/WhatsApp/archivo/Claude Code/manual), medido en prod sobre 475 tareas; más el renombre «Feature: » del catálogo de proyectos y las tareas mal ruteadas | **rescatada** |
| 2026-08-06 | `~molde-4-partes-descripciones-proyectos` | 5 | Reescribir las descripciones de los ~40 proyectos del board a un molde de 4 partes (Qué es / Qué ya está / Qué falta / Por qué importa) sin perder referencias | — |
| 2026-08-06 | `~auditoria-notificaciones-y-titulo-de-pestana` | 18 | Revisión adversarial (hallar + refutar) del panel de Notificaciones, el motor de avisos y el título de pestaña por ruta | **rescatada** |
| 2026-08-06 | `~verificar-tareas-ya-hechas` | 24 | Cruzar las tareas abiertas de los boards /plan (4 workspaces) contra el código para marcar cuáles ya estaban hechas, con un verificador adversarial cazando datos inventados | ya escrita |
| 2026-08-06 | `~busqueda-crm-y-estado-google-calendar` | 2 | Búsqueda avanzada del board del CRM (#id vs texto), estado real de Google Calendar en /integraciones y unificación de los requisitos que pide el wizard al mover de etapa | **rescatada** |
| 2026-08-06 | `mila-ia-nativa` | 8 | Investigación de Mila (mila.gg) + auditoría de por qué MaKo «no se siente como IA»: los ~73 puntos de IA del producto y dos propuestas de rediseño puestas a prueba por un revisor adversarial | **rescatada** |
| 2026-08-06 | `crm-tracking-import-export-audit` | 5 | Auditoría del chrome del CRM (filtros/acciones), del deep-link de anuncio en la ficha, del wizard de exportar leads, de la importación por CSV y del pipeline de retención del VSL | **rescatada** |
| 2026-08-06 | `~fabrica-creativos-y-ads-writer-research` | 10 | Qué persiste Ads Analyst, qué vocabulario comparte con Ads Writer, los topes de la fábrica de candidatos (avatares/razones/entregables) y tres propuestas de rediseño de /ads-writer | **rescatada** |
| 2026-08-06 | `~crm-toolbar-e-importar-exportar` | 2 | Refactor de la toolbar del CRM (filtros drill-down, chips, vista Pendientes) y reescritura de exportar/importar leads con wizard | **rescatada** |
| 2026-08-06 | `gcal-write-y-history-completo` | 2 | Escritura en Google Calendar al reagendar (mover el evento y avisar al invitado) + auditar el cambio de etapa del lead en un solo lugar (etapa_vista, mig 0122) | **rescatada** |
| 2026-08-06 | `senales-de-avance` | 11 | Qué señales del negocio podrían cerrar solas una tarea del plan; auditoría del motor de auto-cierre (plan-senales, todo-seeds, cerrar-por-commits) contra datos de producción | **rescatada** |
| 2026-08-06 | `~review-adversarial-content-machine` | 50 | Revisión adversarial (50 verificadores) del diff de /ads-writer «Content Machine»: galería de guiones, MatrizView, GuionCard/GuionLector y el popover de filtros | **rescatada** |
| 2026-08-06 | `~wizard-que-hacer-ahora-y-horarios-de-google` | 14 | Rediseño del wizard «¿Qué hacer ahora?» del CRM (preguntar el hecho, no la acción) + `horariosLibresDeGoogle` con freeBusy | **rescatada** |
| 2026-08-05 | `~auditoria-mudanza-dominio` | 52 | Barrido en vivo de todo lo que quedó apuntando al dominio viejo tras mudar a hola-mako.com: código, Vercel, Chatwoot, Evolution, Calendly, Meta, Google, Resend, Fathom y el beacon de la landing | **rescatada** |
| 2026-08-05 | `bugs-plan-fathom` | 24 | 5 bugs del board /plan y del flujo reunión Fathom → tareas (chip que suma tareas propias y ajenas, loader ausente al aplicar, extracción manual que no persiste, buscador ciego al pid del proyecto, duplicados que el Perro marca pero igual se crean) | ya escrita |
| 2026-08-05 | `~review-commit-firma-webhooks` | 42 | Review adversarial (multi-lente + verificadores) del commit 1f64cb9: firma de webhook por workspace y barrera de credenciales en Fathom/Calendly | **rescatada** |
| 2026-08-05 | `cierre-ronda-mako` | 6 | Cierre de ronda: 'Ver más' en los historiales del board, apertura del borrador de reunión, licenciamiento/fugas del bundle y seed de arranque generado por IA | **rescatada** |
| 2026-08-05 | `review-landing-tabs` | 35 | Review adversarial de las tabs nuevas Landing Analyst + Landing Generator (fetch, prompts, paginado, UI y persistencia) | **rescatada** |
| 2026-08-05 | `~fathom-preguntas-lote-whatsapp-forense` | 25 | Cinco frentes sobre el board /plan: por qué las tareas de Fathom salen pobres, por qué las preguntas del Perro están rotas, y forense en prod de la ráfaga de 16 mensajes de WhatsApp | **rescatada** |
| 2026-08-05 | `diagnostico-ronda-reuniones` | 12 | Seis diagnósticos con seis verificaciones adversariales sobre el pipeline reunión→plan: modal de WizardShell sin techo, la extracción que "no persistía", preguntas dinámicas incoherentes, política de duplicados y destinatarios que no aparecían | **rescatada** |
| 2026-08-05 | `~borrador-reunion-fathom-frentes` | 8 | Tres frentes sobre el borrador de reunión de Fathom: por qué las propuestas descartadas desaparecen, por qué el detalle de las tareas sale pobre, y si Google Calendar puede resolver los participantes sin email | **rescatada** |
| 2026-08-05 | `~verificar-commits-contra-el-board` | 20 | Descripción de los 30 proyectos del board + verificadores adversariales que confirman o refutan qué tareas cerraron de verdad los commits del día | **rescatada** |
| 2026-08-05 | `whatsapp-contexto-perdido` | 4 | Forense de por qué 5 tareas dictadas por WhatsApp terminaron en cuatro proyectos equivocados: el detalle no llegaba al ruteador del Perro | ya escrita |
| 2026-08-05 | `~auditoria-ruleta-hidratacion-credenciales` | 19 | Barrido de las ~40 credenciales por familia (Chatwoot/Evolution, Meta, IA, Calendly/Fathom, media/email) buscando cuáles se leen por process.env y mueren con la hidratación fallida | **rescatada** |
| 2026-08-05 | `~alta-tab-vsl-analyst` | 7 | Mapa de los ~20 registros que hay que tocar para dar de alta una tab nueva (VSL Analyst / VSL Writer) + qué plomería de datos del VSL ya existe y qué falta | **rescatada** |
| 2026-08-05 | `ronda-clientes-y-automatizacion` | 12 | Cinco frentes en paralelo: importar archivos al plan, auto-cierre de tareas, reordenar los boards de clientes, UX del detalle de tarea y auditoría de seguridad/aislamiento | **rescatada** |
| 2026-08-02 | `~investigacion-rediseno-chat-agent-17-puntos` | 11 | Investigación previa al rediseño del Chat Agent: borrar la tab Audios, renombrar jugada→secuencia, wizard nuevo, hand-off, randomizer de variantes y el motor de nutrición por detrás | **rescatada** |
| 2026-08-02 | `~diagnostico-audio-ensayo-chat-agent` | 4 | Por qué el ensayo del onboarding de Chat Agent pintaba «Tu nota de voz (no disponible)» con los 3 audios grabados | **rescatada** |
| 2026-08-02 | `~investigar-onboarding-chat-agent` | 9 | Investigación y diseño del onboarding del Chat Agent: paso de contexto/voz, los 3 audios, ensayo por escenarios y traer el perfil del dueño en Datos de Mau | **rescatada** |
| 2026-08-02 | `mako-desconexion-estado-pegado` | 3 | Por qué desvincular el WhatsApp no oficial dejaba el onboarding y el inbox como si siguiera conectado (estado fósil + espejo intacto) | **rescatada** |
| 2026-08-02 | `~chat-agent-ensayo-y-secuencias` | 5 | Rediseño del Chat Agent: el ensayo del onboarding (deriva de personaje, bucle del precio, falta de desenlace), tipo 'sistema' del hilo y persistencia de los pasos de secuencia | **rescatada** |
| 2026-08-02 | `~ensayo-chat-agent-y-datos-mau` | 7 | Caza adversarial de bugs en el paso Ensayo del onboarding del Chat Agent y en la copia de datos del dueño (lib/datos-mau.ts) | **rescatada** |
| 2026-08-01 | `mako-onboarding-copy-y-bugs` | 5 | Onboarding de tabs: el ícono de WhatsApp roto, la key de Gemini que no se copiaba con «datos de Mau», el patrón visual de los pasos y una auditoría de copy | **rescatada** |
| 2026-08-01 | `mapa-onboarding-metodologia` | 4 | Mapear el onboarding global (wizard bloqueante, tarjeta partida, estado en app_settings) para poder replicarlo como onboarding por tab | ya escrita |
| 2026-08-01 | `mako-cliente-prueba-diagnostico` | 7 | Por qué el Cliente de Prueba impersonado ve cosas que no debería y no ve funciones que sí; loader colapsado de /setting; plan de reset de workspace; rename Setting → Chat Agent | **rescatada** |
| 2026-08-01 | `mapa-clonar-workspace` | 3 | Inventario de qué se puede clonar de un workspace a otro (app_settings, credenciales, funnel, nutrición, storage) y qué nunca | **rescatada** |
| 2026-08-01 | `~poda-board-leila-ws11` | 20 | Auditoría del board del cliente ws11: qué podar del seed, qué es trabajo real de su reunión, y por qué su borrador de Fathom nunca entró | **rescatada** |
| 2026-08-01 | `mako-contactos-onboarding` | 4 | Por qué el paso de conversaciones del onboarding de Chat Agent muestra números crudos y trae pocas charlas, y de dónde sacar el arranque de cada conversación para aprender el tono de prospección | ya escrita |
| 2026-08-01 | `~extraccion-reunion-mau-mensajes` | 9 | Extracción por tramos de la reunión Mau/Martín sobre prospección: audios del dueño, 3 secuencias y qué del producto no soporta lo acordado | **rescatada** |
| 2026-08-01 | `auditoria-plan-y-whatsapp` | 15 | Por qué el Perro no puntúa en el board del cliente, por qué MaKo no le contestaba a nadie por WhatsApp y foto de producción de las tablas del plan y del canal | **rescatada** |
| 2026-08-01 | `auditoria-plan-tareas-basura` | 12 | Por qué el board del cliente acumulaba tareas sin proyecto, sin fuente y con carteles del navegador al aplicar un borrador de reunión | **rescatada** |
| 2026-08-01 | `diagnostico-reunion-plan` | 3 | Forense del pipeline reunión→plan: por qué la reunión de 3h con Mauricio no cargó ni una tarea (cron, clasificación, reparto, filtros del board) | ya escrita |
| 2026-08-01 | `dedup-y-envio-a-mi-plan` | 31 | Por qué el board se llena de tareas repetidas y por qué no se podía mandar tareas al propio plan; auditoría de los 9 caminos que crean tareas + verificación adversarial en prod | **rescatada** |
| 2026-08-01 | `tareas-por-cliente` | 20 | Por qué las tareas de una reunión con un cliente terminan en el proyecto de otro cliente o sin proyecto en el board de Mauricio (ws1) | **rescatada** |

## 2026-07

| Fecha | Corrida | Agentes | Qué se fue a buscar | |
|---|---|---|---|---|
| 2026-07-31 | `auditoria-tokens-meta` | 9 | Las 6 credenciales de Meta del onboarding: para qué sirve cada una de verdad, qué permisos exige, cuáles se pueden derivar del token principal y cuánta fricción le cuesta al cliente | ya escrita |
| 2026-07-31 | `mapa-integraciones-meta` | 3 | Mapa del formulario de credenciales y del catálogo para el rediseño de Meta a un solo token con autodescubrimiento | **rescatada** |
| 2026-07-31 | `~review-adversarial-nutricion` | 23 | Revisión adversarial del motor de nutrición tras los commits de recordatorios anclados a la reunión, flags de canal por workspace y el generador de copy de MaKo | **rescatada** |
| 2026-07-31 | `~investigacion-meta-2446984` | 43 | Investigación con verificación de fuentes (30+ pasadas) del error 2446984 de Meta que retiene los anuncios publicados desde MaKo | ya escrita |
| 2026-07-31 | `~nomenclatura-meta-ads` | 25 | Nomenclatura de campañas/conjuntos/anuncios de Meta: qué rompe renombrar 222 entidades y de dónde sale el nombre de un anuncio nuevo | **rescatada** |
| 2026-07-31 | `~mapa-envio-flags-nutricion-crm-auto` | 8 | Mapear el interruptor de envío real por workspace, el motor de nutrición, el CRM automático y el funnel derivado antes de tocarlos | **rescatada** |
| 2026-07-31 | `~review-wizard-campana-existente` | 54 | Revisión adversarial del wizard de Ads Manager en modo «agregar creativos a una campaña existente» | **rescatada** |
| 2026-07-30 | `~quiz-de-voz-y-catalogo-de-angulos` | 3 | Research de quizzes de voz de marca (dimensiones, forced-choice, frases concretas en vez de adjetivos) + redacción del quiz de 10 preguntas y del catálogo de ángulos de venta para la fábrica de creativos | ya escrita |
| 2026-07-30 | `guion-copywriting-research` | 5 | Research externo de CTAs y frameworks de copy para video ads, y reescritura del prompt del guion de Meta | ya escrita |
| 2026-07-30 | `~cola-de-accion-mako` | 4 | Forense de por qué un «sí, cargalo» por WhatsApp cargó las tareas equivocadas: mapa de las 8 colas de pendientes de MaKo y diseño de la cola de acción única | **rescatada** |
| 2026-07-30 | `angulos-guion-research` | 3 | Investigación de hooks y taxonomía de ángulos de video ads para armar el catálogo del generador de guiones | ya escrita |
| 2026-07-30 | `fathom-preview-cards` | 5 | Preview de las tareas de una reunión de Fathom antes de cargarlas, y cuándo se generan las preguntas de contexto | **rescatada** |
| 2026-07-29 | `~forense-canal-mako-mudo` | 5 | Por qué el aviso del cron fathom-plan nunca llegó al grupo de WhatsApp: frente de entrada, frente de salida, estado real de Evolution y cómo correr el cron a mano | **rescatada** |
| 2026-07-29 | `review-onboarding-resto` | 7 | Review adversarial de los pasos que faltaban del onboarding (razones, ángulos, guiones) con verificador que refutó uno de los tres hallazgos | **rescatada** |
| 2026-07-29 | `~audit-onboarding-persona` | 4 | Revisión adversarial del paso de la cara de marca del onboarding (describir fotos con IA de visión) | **rescatada** |
| 2026-07-29 | `~auditoria-archivero-onboarding` | 4 | Caza de bugs en el paso Archivero del wizard de onboarding, con verificación adversarial | **rescatada** |
| 2026-07-29 | `reunion-multi-borrador` | 4 | Unificar varias reuniones en un solo aviso y una sola pantalla de confirmación de tareas: copy, fecha/hora real de la reunión y reparto por persona×reunión | **rescatada** |
| 2026-07-29 | `~extraccion-reunion-8-de-95-tareas` | 5 | Reunión de 122 min de la que MaKo sacó 8 tareas contra ~95 reales: techo de tokens, recorte del transcript y prompt que descartaba las recomendaciones del consultor | ya escrita |
| 2026-07-29 | `~hover-celdas-matriz` | 1 | Revisión visual de MatrizView: el hover de la celda y de la flechita no se aplica porque los estilos inline vencen a la hoja embebida | — |
| 2026-07-28 | `~review-tanda-avatares` | 6 | Review de una tanda de cambios en el generador de avatares/preguntas del onboarding | **rescatada** |
| 2026-07-28 | `~review-onboarding-fabrica-creativos` | 12 | Review adversarial del onboarding y de la fábrica de creativos (avatares → razones → matriz): pérdidas silenciosas de datos | **rescatada** |
| 2026-07-28 | `~review-avatares-angulos-onboarding` | 9 | Review adversarial del rediseño de avatares/ángulos en el onboarding (lib/avatares.ts, AvataresView, AngulosView, ResumenView) | **rescatada** |
| 2026-07-28 | `mapear-onboarding-ajustes` | 4 | Dónde viven Entregable/Persona y la matriz de razones dentro del onboarding, y qué falta para cablear los ángulos por celda | **rescatada** |
| 2026-07-27 | `branding-mako-conocimientos` | 4 | Plan para meter ~95 MB de material de marca en /conocimientos y poder compartirlo por link público sin login (Storage, catálogo en DB, tabla de shares) | **rescatada** |
| 2026-07-26 | `meta-app-review-dificultad` | 7 | Qué tan difícil es el App Review de Meta para leer y escribir ads de terceros, y si se puede evitar en el onboarding de clientes que pagan vs el lead magnet frío | ya escrita |
| 2026-07-26 | `mh-add-resumenes` | 56 | Resúmenes de las clases del curso MasteryHaus para el portal /conocimientos | — |
| 2026-07-26 | `~catalogo-de-features-de-la-landing` | 4 | Decidir si el catálogo de /vsl se recorta o se agranda: cuántas cards, qué se fusiona, qué features reales del código no están contadas y cuál es la cola de videos | **rescatada** |
| 2026-07-26 | `~consolidar-catalogo-features-landing` | 5 | Consolidar el catálogo de features de la landing de 25 a 17 (qué merece video propio, qué se funde, qué sale de la grilla) | **rescatada** |
| 2026-07-26 | `copy-semaforo` | 5 | Reescritura del copy de la feature Semáforo en la landing /vsl contra el guion del video | — |
| 2026-07-26 | `perro-fusion-proyectos` | 5 | Por qué el Perro escribe «redundante con el proyecto X» y aun así crea el proyecto duplicado (dedupe léxico antes vs juicio semántico después) | ya escrita |
| 2026-07-26 | `fases-mako-contenido` | 7 | Redacción del contenido de las 5 fases del negocio y las 5 dimensiones del diagnóstico (síntomas, acciones, hito, qué NO hacer) | ya escrita |
| 2026-07-24 | `auditar-copy-crm` | 5 | Auditoría del copy de la página de feature del CRM en la landing /vsl contra las reglas de hero con mini-VSL | **rescatada** |
| 2026-07-24 | `~resumir-sesiones-curso-bluehacker` | 105 | Resumen en lote de ~105 sesiones en vivo del curso BlueHacker 2.0 (funnels, copy, ventas) para el portal de conocimientos | — |
| 2026-07-23 | `vercel-costo-auditoria` | 5 | De dónde sale la factura de Vercel (builds, polling, crons, Fluid) y si el uso se puede monitorear por API | **rescatada** |
| 2026-07-23 | `audit-perro-origenes` | 6 | Trazar los 5 orígenes de carga de tareas (WhatsApp, Claude Code, Fathom, archivo, alta manual) y ver cuáles pasan de verdad por el Perro Guardián | ya escrita |
| 2026-07-23 | `map-integracion-landing` | 5 | Mapeo del board de /integraciones (catálogo, ServicioModal, íconos, molde del tutorial) para mover el agente Claude Code a card+modal | — |
| 2026-07-23 | `trace-gemini-leak-ws` | 5 | Por qué Mauricio (ws1) ve el saldo y el historial de Gemini que cargó Martín (ws9) en /integraciones | **rescatada** |
| 2026-07-23 | `bluehacker-sesiones` | 34 | Resumir 34 sesiones en vivo del curso BlueHacker (tráfico pago, orgánico, funnels) para el portal /conocimientos | — |
| 2026-07-22 | `~research-landing-funnel` | 8 | Research de avatar/voz de cliente para la landing + mapa de qué es real en el editor de /funnel y en los motores que mueven leads | **rescatada** |
| 2026-07-22 | `bluehacker-resumenes` | 94 | 94 agentes resumiendo las clases del curso BlueHackers (mindset, oferta, ads) para cargarlas como material del negocio | — |
| 2026-07-22 | `mh-m6-resumenes` | 39 | Resúmenes en prosa de las clases del módulo de Marketing Perpetuo (email, YouTube, LinkedIn, Meta) para el portal de formación | — |
| 2026-07-22 | `audit-ia-routing` | 6 | Mapa completo del ruteo de IA: registro de modelos por feature, cascada barata, rotación por cuota y qué cambia cargar créditos en Gemini | **rescatada** |
| 2026-07-22 | `mh-m6-resumenes` | 28 | Resumir 28 clases del módulo de Marketing Perpetuo (Meta, LinkedIn, métricas) para el portal /conocimientos | — |
| 2026-07-21 | `~resumenes-clases-nicho-avatar` | 3 | Resúmenes de tres clases del curso (nicho de oro, clientes de por vida, avatar con ChatGPT) para el portal de conocimientos | — |
| 2026-07-21 | `conocimientos-explicaciones` | 10 | Redactar las explicaciones de cada recurso del curso AVATARHYPE en el portal /conocimientos | — |
| 2026-07-21 | `conocimientos-contenido-v2` | 16 | Redacción de resúmenes de clases y fichas de recursos del curso AVATARHYPE para el portal /conocimientos | — |
| 2026-07-21 | `~resumenes-clases-curso-mastery` | 66 | Resumir 66 clases del curso (mentalidad, oferta, nicho, fórmula) para cargarlas al portal /conocimientos | — |
| 2026-07-21 | `~research-transcribir-cursos-con-gemini` | 4 | Research de la Files API de Gemini para transcribir cientos de horas de cursos alojados en Drive: límites, costo, privacidad y mecánica | **rescatada** |
| 2026-07-21 | `~research-storage-video-cursos` | 8 | Dónde alojar el video de los cursos de /conocimientos: comparación de R2, B2, Bunny, S3+CloudFront, Supabase Storage, Stream/Mux y Drive | **rescatada** |
| 2026-07-20 | `avatarhype-recursos` | 10 | Extracción del material del curso AvatarHype (páginas de Notion y prompts de los GPTs) para cargarlo al portal de conocimientos | — |
| 2026-07-20 | `avatarhype-transcripts` | 6 | Resumen de las clases del curso AVATARHYPE (Sora/KIE/APImart/Veo) para el portal /conocimientos | — |
| 2026-07-20 | `avatarhype-notion-urls` | 6 | Resolver las URLs de Notion de 6 recursos del curso AVATARHYPE | — |
| 2026-07-19 | `~landing-graficos-por-feature` | 24 | 24 agentes generando el bloque de gráficos (hero + groups con paramsJson) de cada página /vsl/<slug> de detalle de features | — |
| 2026-07-19 | `~landing-24-features-auditoria` | 135 | auditoría de las 24 features contra el código (qué hace / status live-partial-vaporware / gotchas) + verificadores + copy final de cada landing | **rescatada** |
| 2026-07-19 | `~review-tareas-de-whatsapp-al-plan` | 17 | Code review adversarial del feature «MaKo carga tareas al plan desde WhatsApp»: bandeja, confirmación de acciones y ruteo del doer | **rescatada** |
| 2026-07-19 | `~specs-visuales-landing-detalle` | 24 | Specs de los mockups animados de las 24 páginas de detalle de features de la landing /vsl (hero + grupos de componentes por slug) | — |
| 2026-07-19 | `~revision-landing-estrategia-vsl` | 7 | Revisión de /vsl/estrategia: fidelidad al brief (decidido vs recomendado), aritmética de los números, layout y contraste | **rescatada** |
| 2026-07-19 | `~review-datosmodal-plan-board` | 21 | Review del DatosModal del board /plan: preferencias en localStorage, apilado de modales, progreso derivado y código muerto del gauntlet | **rescatada** |
| 2026-07-19 | `~review-doer-whatsapp-y-snapshot` | 17 | Revisión adversarial del doer de WhatsApp (acuse automático, auto-confirmación, anti-eco) y del snapshot del board del dueño | **rescatada** |
| 2026-07-19 | `source-logos` | 10 | Bajar logos oficiales a color y con fondo transparente (Claude, Google, WhatsApp, Meta, Panda, Calendly) para la landing | — |
| 2026-07-19 | `~detalle-features-vsl` | 24 | Escribir las 24 fichas de features de la landing (/vsl/<slug>): headline, lead y cuerpo de cada una | ya escrita |
| 2026-07-19 | `~vsl-detalle-visuales` | 24 | Generación de los specs de visuales (hero + grupos) para las 24 rutas de detalle de features de la landing /vsl | — |
| 2026-07-18 | `~relevamiento-pipeline-reunion-a-plan` | 6 | Relevamiento del pipeline reunión→plan: dueño por tarea, glosario del negocio, dedup del Perro, clasificación de la reunión y carga de archivos | ya escrita |
| 2026-07-18 | `~review-autocarga-reunion` | 14 | Revisión del opt-in «cargalas solas al plan» en ReunionExtractModal y del flujo de subir archivo | **rescatada** |
| 2026-07-17 | `~metodo-facts-del-ping` | 3 | qué dato reconocible puede devolver el ping de cada uno de los 8 servicios de /metodo, slides por tab, y un verificador que cruzó el copy contra el código | **rescatada** |
| 2026-07-17 | `retro-mapa` | 5 | Mapa de la Retro: esquema, motor, costo, crons/avisos y los 7 puntos pedidos (incluida la rendición de cuentas falsa) | **rescatada** |
| 2026-07-17 | `~reconciliar-lote-de-commits-con-el-plan` | 23 | Cruzar 8 lotes de commits (Retro, board, capas, seguridad) contra el board para marcar checklists y detectar trabajo huérfano | **rescatada** |
| 2026-07-17 | `~verificacion-tareas-seguridad` | 12 | Verificación «¿sigue viva?» de 8 tareas de seguridad del /plan (knowledge sin guard, requireRolWs, ads-guard, META_PAGE_ID) + 4 auditorías nuevas de auth y webhooks | **rescatada** |
| 2026-07-16 | `integraciones-modal-v2-investigar` | 3 | Rediseño del modal de servicio de /integraciones: qué confirmación reusar, qué protege de verdad el cifrado BYOK y cómo darle alto fijo con scroll interno | **rescatada** |
| 2026-07-16 | `mako-onboarding-solo-meta` | 6 | Qué ve, qué falta y sobre todo qué MIENTE el producto cuando el cliente conectó solamente Meta (tabs, Retro, semáforo de /general) | **rescatada** |
| 2026-07-16 | `byok-de-verdad` | 3 | Qué haría falta para que BYOK sea verdad y no slogan: guard del ojito de /integraciones, vías por las que la agencia llega a las llaves del cliente, y si zero-knowledge es alcanzable | ya escrita |
| 2026-07-16 | `~auditoria-env-vars` | 4 | Auditoría var por var del entorno: qué queda de plataforma, qué es infra y qué debería ser por cliente, y qué pasa si se borra | **rescatada** |
| 2026-07-16 | `~auditoria-migracion-cifrado-credenciales` | 23 | Auditoría adversarial del backfill v1→v2 de credenciales, su runbook y el módulo de cripto | **rescatada** |
| 2026-07-16 | `audit-owner-ws-misrouting` | 55 | Auditoría de misrouteo cross-tenant: qué webhooks/crons caen a OWNER_WS por el default sin sesión | **rescatada** |
| 2026-07-16 | `perro-guardian-captura` | 12 | Si el Perro Guardián podía puntuar y cargar tareas que llegan por WhatsApp; mapeo de los 8 caminos de entrada de tareas al board | **rescatada** |
| 2026-07-16 | `~censo-features-onboarding` | 15 | Censo de todo el producto por clusters (estado real de cada feature + qué config pide de un cliente nuevo) para decidir la oferta cebolla y el onboarding WOW-first | **rescatada** |
| 2026-07-16 | `~perro-ataja-duplicados-al-crear` | 18 | Cuatro propuestas de diseño (+ jueces) para que el Perro Guardián frene una tarea duplicada al CREARLA en vez de al borrarla | **rescatada** |
| 2026-07-16 | `~auditoria-refactor-integraciones` | 49 | Revisión adversarial del refactor de /integraciones (guardado por key, modal de alto fijo, aviso de seguridad): qué rompe y qué miente | **rescatada** |
| 2026-07-16 | `~multi-vsl-panda-y-baja-de-auth-cookie` | 3 | Dos frentes: qué pasa con varios VSL cargados en Panda (A/B) y qué se rompe si se borra AUTH_COOKIE_VALUE de Vercel | **rescatada** |
| 2026-07-16 | `mako-auditoria-rutas-byok` | 5 | Qué rutas se escapan del gating y por qué la key de IA del cliente no se usa; anatomía del modal de /integraciones | ya escrita |
| 2026-07-16 | `~tutoriales-integraciones-y-logos` | 12 | Escribir los pasos por servicio de /integraciones (Groq, OpenAI, Anthropic, Resend, YouTube, Meta, Calendly…) y resolver el logo/ícono del modal | ya escrita |
| 2026-07-15 | `~review-toast-gasto-ia` | 7 | Review del toast de gasto de IA y del board de /integraciones, con verificadores que refutaron 2 de los hallazgos | **rescatada** |
| 2026-07-15 | `~ruteo-ia-por-tarea` | 4 | Inventario de todos los call-sites de IA para decidir qué baja a Groq/OpenAI y qué se queda en Claude | **rescatada** |
| 2026-07-15 | `~review-bulk-fill-crm` | 2 | Review del marcado en lote del CRM (asignar setter/closer/empresa a N leads) | ya escrita |
| 2026-07-15 | `~auditoria-ia-router-modelos` | 3 | Inventario de los ~35 call-sites de IA, por qué se usa Opus de más y diseño del router barato/Sonnet/Opus | ya escrita |
| 2026-07-15 | `~review-reclasificar-reactivacion` | 3 | Review adversarial del script one-off de reclasificación a Reactivación y del guard T2 del motor CRM-auto | — |
| 2026-07-14 | `mako-doer-discovery` | 4 | Inventario de piezas para el doer bidireccional: webhook de grupos de Evolution, loop de tool-use y las 6 escrituras que MaKo podría ejecutar con confirmación | **rescatada** |
| 2026-07-14 | `mako-cableado-avisos` | 6 | Dónde cablear cada aviso del catálogo (webhooks de Calendly/Chatwoot/Meta/Fathom, crons, libs de pagos y leads) y con qué dedup | **rescatada** |
| 2026-07-14 | `research-free-ai-apis` | 17 | Research de proveedores de IA gratis/baratos (LLM y STT) para sacar a Opus de las tareas simples y de la transcripción | **rescatada** |
| 2026-07-14 | `research-nvidia-nim` | 3 | Si build.nvidia.com (NIM) sirve como capa gratis de LLM + STT en español para lib/ai-cheap.ts | **rescatada** |
| 2026-07-14 | `mako-avisos-discovery` | 9 | Mapa del motor de avisos al dueño: semáforo de Meta, crons de reporte, dispatcher multicanal, eventos que hoy quedan mudos, PDF por WhatsApp y workspace de agencia | ya escrita |
| 2026-07-13 | `~reconstruccion-proyectos-roadmap` | 8 | Reconstruir desde el historial de commits los proyectos del roadmap con tareas, checklists y progreso | — |
| 2026-07-13 | `plan-autonomo-tanda2` | 5 | Qué clusters del backlog se pueden ejecutar en autonomía: confinamiento de webhooks, tests que faltan, refactors de eficiencia y código muerto | **rescatada** |
| 2026-07-13 | `~review-commits-funnel-dropdowns` | 4 | Review de los commits de refactor de prompts, contexto de funnel y migración de <select> a Dropdown | **rescatada** |
| 2026-07-13 | `~auditoria-aislamiento-slices` | 17 | Auditoría de aislamiento cross-tenant y gates de auth por slices de rutas (ads-manager, mako-ai, admin, email, webhooks, crons), con verificadores adversariales | ya escrita |
| 2026-07-13 | `plan-autonomo-investigar` | 7 | Qué clusters del backlog se podían atacar solos: código muerto, ficha del lead, funnel real, dropdowns, tests, prompts de Experimentos/Retro y fugas cross-tenant | ya escrita |
| 2026-07-13 | `~generacion-roadmap-proyectos` | 5 | Generación del roadmap por proyectos del board /martinkoncke (tool-use, go-live, CRM automático, multi-inquilino, CS Analyst, agente de ads) | ya escrita |
| 2026-07-13 | `~perro-puntua-el-roadmap` | 6 | El Perro Guardián puntúa impacto/esfuerzo/prioridad de 34 proyectos y 117 tareas del roadmap del super-admin | ya escrita |
| 2026-07-13 | `~memorias-a-tareas-del-board` | 8 | Convertir las memorias del proyecto en tarjetas del board /plan (título, detalle, checklist y % de avance por pieza) | ya escrita |
| 2026-07-12 | `~auditoria-board-todo` | 21 | Auditoría adversarial del board de tareas (useBoard, TodoBoard, lib/todo.ts, PriorizarWizard, checklist-coach) | **rescatada** |
| 2026-07-12 | `todo-board-v5-research` | 7 | Research de patrones existentes del repo para el rediseño v5 del board: tarjeta del CRM, picker de emojis, historial con deshacer, wizard de 1 pregunta, firma de chatClaude | — |
| 2026-07-11 | `study-kan-ui` | 10 | Extracción de la estética del kanban open-source «kan» (paleta, card, columna, modal, filtros) como referencia visual | — |
| 2026-07-11 | `study-app-kanbans` | 4 | Inventario de los kanbans de la app (CRM, /todo, PlanBoard), su drag&drop, toasts con undo y persistencia, para el rediseño del board | — |
| 2026-07-11 | `~inventario-backlog-hecho-vs-abierto` | 5 | Inventario de 31 puntos del backlog contra el código: qué está hecho, parcial o abierto (perfil, onboarding, admin, nutrición, email, experimentos, RAG) | — |
| 2026-07-10 | `evolution-labels-research` | 1 | Contrato de Evolution v2.3.7 para etiquetas, borrar/editar/marcar leído y la lista completa de eventos del webhook, más el plan de auto-etiqueta por etapa | ya escrita |
| 2026-07-10 | `wa-no-oficial-paridad-diagnostico` | 3 | Cómo el inbox oficial mezcla Chatwoot con leads del CRM sin chat, cómo replicarlo en el no oficial, y diagnóstico del hilo que se quedaba en «Cargando…» para siempre | **rescatada** |
| 2026-07-10 | `wa-oficial-audit` | 5 | Spec exhaustiva del inbox oficial (lista, hilo, composer, panel de contexto, grabador de audio) para reescribir el no oficial 1:1 y elegir el diferenciador de canal | ya escrita |
| 2026-07-10 | `~skills-externas-para-pensar-antes` | 3 | Relevar colecciones públicas de skills de Claude Code (obra/superpowers, mattpocock, otras) y elegir las de planear/especificar/red-team antes de construir | — |
| 2026-07-10 | `~bugs-de-paridad-empresainbox` | 9 | Caza y verificación de bugs del inbox no oficial (EmpresaInbox) contra el oficial: error de envío invisible, spinner que parpadea, punto de no-leído fantasma y la conversación que desaparece al escribirle a un lead buscado por nombre | ya escrita |
| 2026-07-10 | `wa-parity-map` | 5 | Mapa de paridad entre el inbox oficial (Chatwoot) y el no oficial (Evolution): qué se reusa tal cual, qué falta (audio, adjuntos, MaKo, bloqueo, notificaciones, ticks) y el contrato real de sendMedia/sendWhatsAppAudio | ya escrita |
| 2026-07-10 | `map-doer-pillars` | 4 | Mapa de los 5 pilares del programa app viva (To-do, Retro, Experiments, Semáforo) y qué falta para que sean 'doer' | ya escrita |
| 2026-07-10 | `evolution-lid-incoming-research` | 2 | Investigar por qué los entrantes de WhatsApp no oficial no aparecen: descarte upstream en Evolution y el alias @lid de los contactos no agendados | ya escrita |
| 2026-07-10 | `evolution-live-pull-research` | 2 | Cómo leer mensajes en vivo de Evolution en vez de depender del espejo wa_mensajes, y el contrato real de findMessages/findChats en v2.3.7 | **rescatada** |
| 2026-07-09 | `~review-canal-email` | 25 | Review adversarial del canal de email (Resend): dominio por cliente, broadcasts y motor de nutrición | **rescatada** |
| 2026-07-09 | `~mapa-app-doer` | 7 | Seis lectores mapean la app entera para el rediseño Doer, más un crítico que resuelve las contradicciones entre ellos | **rescatada** |
| 2026-07-09 | `~auditoria-evolution-f2.1` | 15 | Auditoría de seguridad y robustez de la conexión por QR a Evolution: webhook fail-open, secret global adivinable, fallback ?? OWNER_WS, desconectar no idempotente y el QR que se muere en silencio | ya escrita |
| 2026-07-09 | `~auditoria-envio-evolution-nutricion` | 14 | Auditoría del envío por el número no oficial: borradores, regla dura de auto-send y el cron de nutrición | **rescatada** |
| 2026-07-09 | `~auditoria-espejo-evolution-inbox` | 19 | Auditoría del espejo de WhatsApp no oficial: webhook, upsert de mensajes, media y la bandeja de empresa | **rescatada** |
| 2026-07-09 | `~review-nutricion-plantillas-meta` | 25 | Review adversarial del puente nutrición ↔ plantillas de Meta (guard de aprobación, backoff, UI de NutricionGenerar) | ya escrita |
| 2026-07-09 | `skills-mako-v2` | 6 | Censo de repos públicos de Agent Skills (estrellas/instalaciones) y tres tandas de ideas de producto apoyadas en ellas | — |
| 2026-07-09 | `f33-understand` | 5 | Mapa del pipeline de plantillas de WhatsApp (borrador → Meta → aprobada → envío de nutrición) para automatizar el auto-envío F3.3 | **rescatada** |
| 2026-07-09 | `skills-mapping-mako` | 13 | Relevamiento de skills públicas y propias (dev-time y runtime) aplicables al repo y al producto | ya escrita |
| 2026-07-05 | `~review-adversarial-crm-automatico` | 34 | Caza de bugs en el motor automático del CRM (T1..T6) y en el deshacer de mako_confirmaciones, con verificadores que refutaron la mitad de los hallazgos | **rescatada** |
| 2026-07-05 | `~triage-ficha-lead` | 10 | Triage de 8 problemas de la ficha del lead (wizard Solucionar, insights, historial, navegación) + auditoría de aislamiento por workspace | ya escrita |
| 2026-07-05 | `map-crm-automatico` | 7 | Mapa del CRM automático: qué datos sin marcar puede completar MaKo, crons, transiciones del funnel y detección de reuniones | ya escrita |
| 2026-07-05 | `auditoria-multitenant-crm` | 53 | Robustez multi-tenant del CRM: vistas sin scope, funnel hardcodeado, mako_knowledge, crons que no iteran workspaces | ya escrita |
| 2026-07-05 | `auditoria-eficiencia-crm` | 41 | Eficiencia y hardcoding del CRM: N+1 de crm-auto, SELECT * de leads, índices sin workspace_id, TC y emails internos hardcodeados | ya escrita |
| 2026-07-04 | `~auditoria-insights-del-lead` | 18 | Revisión adversarial de la generación de insights del lead: gate de faltantes, wizard de etapa, prompt de Opus y fuentes que alimenta | **rescatada** |
| 2026-07-03 | `~deal-details-contrato-y-comprobante` | 2 | Extracción ampliada del contrato + comprobante de pago y la tarjeta Deal Details de la ficha del lead | **rescatada** |
| 2026-07-02 | `audit-automatizaciones-lead` | 7 | 6 fuentes (Fathom/closing, Calendly, VSL/landing, Chatwoot, nutrición/Resend, Meta) x qué campo del lead se puede automatizar, más un crítico de cruces | **rescatada** |
| 2026-07-02 | `map-admin-clientes` | 4 | mapeo del panel /admin (tabs Clientes y Usuarios) para entender por qué no se podía des-asignar el workspace de un usuario | **rescatada** |
| 2026-07-02 | `~auditoria-acceso-roles` | 6 | Auditoría de control de acceso: fallback a OWNER_WS con sesión inválida, guard faltante en una sub-ruta y el invariante de "no dejar un cliente sin admin" | **rescatada** |
| 2026-07-02 | `~auditoria-seguridad-rutas-108` | 108 | Auditoría OWASP/STRIDE del modelo de datos, las fronteras de confianza y la matriz completa de rutas API | **rescatada** |
| 2026-07-02 | `map-equipo-roles` | 5 | Mapa del modelo de roles para el panel de Equipo: rol global vs rol por workspace, sesión, sidebar y gating por URL | ya escrita |
| 2026-07-02 | `auditoria-multitenant-ux` | 37 | Auditoría de estado compartido entre usuarios (perfil, prefs, cachés, saldo de IA) y de los mensajes de error que mienten sobre por qué falló una integración | **rescatada** |
| 2026-07-02 | `~auditoria-onboarding` | 12 | Auditoría del wizard de onboarding y su motor de extracción histórica: gates, fallbacks de credenciales, livelocks, concurrencia entre pestañas y terminación de los 6 jobs | **rescatada** |
| 2026-07-02 | `audit-lead-detail` | 11 | Auditoría de la ficha del lead: las tres superficies (modal, ruta, wrapper), sus divergencias, código muerto y los invariantes que solo viven en el cliente | ya escrita |
| 2026-07-02 | `~mapa-onboarding-extraccion-retro` | 5 | Qué hace falta para el onboarding de un cliente nuevo: perfil, integraciones, orden de la extracción histórica y retro inicial | **rescatada** |
| 2026-07-02 | `~auditoria-retro-v3` | 21 | Revisión adversarial del pipeline y la UI de la Retro v3 (/experimentos): stream, plan accionable y persistencia del reporte | **rescatada** |
| 2026-07-01 | `~reskin-dorado-a-azul` | 3 | reskin por lotes de componentes: dorado de acción -> azul, neutros cálidos -> fríos, respetando el dorado de marca de MaKo | — |
| 2026-07-01 | `~auditar-federacion-credenciales` | 22 | Auditoría del cambio de guard esWorkspaceDueno→integracionConectada en las rutas de Meta y WhatsApp | **rescatada** |
| 2026-07-01 | `mapa-fase2` | 4 | Mapa de qué hay que tocar para la Fase 2b (ingesta por cliente): lecturas de env por lib, crons y funciones de credenciales | ya escrita |
| 2026-07-01 | `~verificar-fixes-seguridad` | 6 | Verificación adversarial de 6 fixes de seguridad ya aplicados (open redirect, suspensión de usuario, /metodo, default de META_API_VERSION, guard de host) | **rescatada** |
| 2026-07-01 | `titulos-con-icono` | 13 | Poner ícono al lado del h1 de 13 tabs y normalizar los títulos | — |
| 2026-07-01 | `~recon-repo-antes-de-auth` | 6 | Reconocimiento del repo antes de construir usuarios/roles: estilo de migraciones, app_settings, patrón page+client, sidebar, tokens de diseño y crons | — |
| 2026-07-01 | `mapa-multitenant` | 4 | Plan para volver multi-inquilino el esquema, las queries y las credenciales (35 tablas, choke points, crons) | — |
| 2026-07-01 | `~auditoria-seguridad-metodo` | 27 | Auditoría de seguridad del panel /metodo (credenciales BYOK): SSRF de Chatwoot, guards de rol, open redirect de Google, hidratación de credenciales | ya escrita |
| 2026-07-01 | `~review-wizard-retro` | 5 | Review del wizard de la Retro (selección de alcance) y del armado del texto-fuente que consume MaKo | ya escrita |
| 2026-07-01 | `~review-todo-board-y-retro` | 9 | Revisión del board /todo (coherencia progreso↔estado, slider desincronizado) y del wizard de Nueva Retro en modo demo | — |
| 2026-07-01 | `~review-retro-todo` | 9 | Review del puente Retro → tablero de tareas del cliente: trazabilidad del origen, orden del alta en lote y comportamiento en modo demo | ya escrita |
| 2026-07-01 | `~review-whatsapp-advisor-conocimiento` | 21 | Review del WhatsApp Advisor (recomendaciones, chat, redactor de plantillas Meta) y del portal /conocimiento (transcripción de clases, RAG por área) | ya escrita |
| 2026-07-01 | `~reskin-dorado-a-azul` | 15 | Reskin por tab: el dorado de ACCIÓN pasa a azul y los neutros cálidos se enfrían; el dorado queda solo para marca MaKo, ámbar de estado y series de data-viz | ya escrita |
| 2026-07-01 | `~auditoria-aislamiento-multi-tenant` | 18 | Auditoría adversarial de fugas cross-tenant tras la migración 0054 (rutas de WhatsApp/ads sin guard, upserts globales, tablas fuera de TENANT_TABLES) | **rescatada** |

## 2026-06

| Fecha | Corrida | Agentes | Qué se fue a buscar | |
|---|---|---|---|---|
| 2026-06-30 | `~review-editar-textos-anuncio` | 7 | Review del feature «Editar textos» de un anuncio publicado: el round-trip leer→reconstruir el creativo de Meta | **rescatada** |
| 2026-06-30 | `~review-de-4-issues-de-ads-manager` | 5 | Review de los eventos activos del píxel, la cascada de activación, el actor de Instagram y la miniatura de video en el creador de campañas | ya escrita |
| 2026-06-30 | `map-ads-campaign-creation` | 7 | Mapeo del subsistema de escritura a Meta Ads y de los datos disponibles para fundamentar una campaña, antes de construir "Nueva campaña" | ya escrita |
| 2026-06-30 | `~inventario-reportes-whatsapp-notificaciones` | 4 | Inventario de las funciones y tablas que hacen falta para mandar reportes automáticos por WhatsApp y para un centro de notificaciones + tab de perfil | ya escrita |
| 2026-06-30 | `~auditoria-ads-manager-editar-publico` | 8 | Round-trip del targeting de Meta al editar el público de un conjunto, y alta de conjunto/anuncio en campaña existente | **rescatada** |
| 2026-06-30 | `~auditoria-email-marketing-resend` | 28 | Auditoría de /email: broadcasts, motor de nutrición por email, webhook de Resend, baja/opt-out y accesibilidad | **rescatada** |
| 2026-06-30 | `nueva-campana-4fixes-investigate` | 5 | Cuatro fallas del wizard Nueva campaña del Ads Manager: eventos del pixel, activar en cascada, Instagram/placements y el error #3858258 en Threads | **rescatada** |
| 2026-06-30 | `~revision-adversarial-nueva-campana` | 19 | Revisión adversarial del creador de campañas de Meta: orquestación, payloads de la Graph API, round-trip de ajuste con MaKo y subida de creativos | ya escrita |
| 2026-06-30 | `~experimentos-medicion-y-ui` | 8 | Revisión de la medición de experimentos (baseline vs actual) y de la UI de /experimentos | **rescatada** |
| 2026-06-29 | `~review-nutricion-manual-con-deadline` | 3 | Review de la etapa «Nutrición - Manual» con deadline obligatorio: quién lo exige, quién no, y cómo queda la card cuando el pendiente se resuelve desde otra pantalla | ya escrita |
| 2026-06-29 | `~prueba-de-workflow` | 2 | Corrida de prueba del runner de workflows: los dos agentes devolvieron {veredicto:'test', bugs:[]} | — |
| 2026-06-29 | `~negritas-copy-landing` | 4 | Elegir qué frases van en negrita/itálica/highlight en los bloques de copy de la landing | — |
| 2026-06-29 | `~inventario-de-prompts` | 10 | Censo de todos los prompts del repo (archivo, línea, símbolo, variables, si es editable) para armar el registro central de /configuraciones | ya escrita |
| 2026-06-29 | `auditoria-ficha-lead` | 7 | Auditoría de la ficha del lead: datos falsos o inventados en la UI, arquitectura de información y acciones que faltaban | ya escrita |
| 2026-06-29 | `~recuperar-la-ficha-del-lead` | 3 | Inventario del modal LeadDetail viejo (commit 945f9b4) para recuperar su riqueza en la ruta /leads/[id] | — |
| 2026-06-29 | `~rediseno-seccion-beta-landing` | 3 | Tres propuestas de rediseño visual de la sección #beta (cupos + Calendly) de la landing de venta | — |
| 2026-06-25 | `~audit-script-analyst-valorador` | 3 | revisión adversarial del valorador de guiones nuevos, del motor de patrones (buildPatterns) y del wiring de la UI del Script Analyst | **rescatada** |
| 2026-06-25 | `scripts-analyst-quadrant-redesign` | 3 | tres propuestas de rediseño del cuadrante de retención (ejes fijos vs mediana, overlap, labels fuera del plot, filtro de fecha propio) | ya escrita |
| 2026-06-25 | `mako-roadmap-ideacion` | 10 | Ideación de features por lente (leads, nutrición, funnel, ads, CS, data cruzada, cerebro con tools) más los gaps contra el copy de la landing | ya escrita |
| 2026-06-25 | `~clasificar-grabaciones-fathom` | 31 | Clasificación una por una de 31 grabaciones de Fathom en venta/entrega_servicio/otro, con tipo R1-R2 y score | — |
| 2026-06-25 | `~portar-diseno-closing` | 18 | Diff pixel a pixel entre el template de diseño y el port de /closing (embudo, player, momentos, dimensiones) | — |
| 2026-06-25 | `~auditoria-features-landing` | 15 | Feature por feature de la landing /vsl: implementado vs vaporware, y el molde de copy de las cards | ya escrita |
| 2026-06-25 | `~clasificar-grabaciones-fathom` | 43 | Clasificación en lote de 43 grabaciones de Fathom (venta vs entrega de servicio, R1/R2, score) | — |
| 2026-06-25 | `~review-script-analyst` | 2 | Review del refactor de métricas del Script Analyst: agregación, paginado de PostgREST y matemática del cuadrante hook×retención | ya escrita |
| 2026-06-25 | `~revision-port-scripts-analyst` | 4 | Revisión del port a React del Scripts Analyst: fidelidad al diseño, matemática de retención, cableado de datos y convenciones Next 16 | ya escrita |
| 2026-06-25 | `scripts-analyst-v3-design` | 3 | Diseño v3 del Scripts Analyst: modal de confirmación del sync, panel de filtros, catálogo de patrones y valorador de un guion nuevo (nunca construido) | — |
| 2026-06-25 | `~closing-panorama-port` | 5 | Port del diseño de Claude Design del Closing Analyst: mapeo del mock contra ClosingAnalysisRow y spec de la vista «Métricas» | **rescatada** |
| 2026-06-25 | `~review-closing-analyst-v2` | 10 | Review adversarial del Closing Analyst v2: retry de Fathom, lectura del score y clasificación R1/R2 | ya escrita |
| 2026-06-25 | `~rediseno-closing-analyst` | 4 | Propuesta de rediseño de la pantalla de Closing Analyst con lente «veredicto primero» | — |
| 2026-06-24 | `~review-plantillas-whatsapp` | 3 | Review de editar/eliminar plantillas de WhatsApp contra Meta, con un verificador que descartó 3 falsos positivos | ya escrita |
| 2026-06-24 | `~diseno-de-ads-manager` | 5 | Diseño de /ads-manager: mover el navegador de campañas, réplica de la tabla de Meta (sort, multiselect, columnas, sticky, toggle, presupuesto inline) y la ruta de escritura /api/meta-write con el bloqueo 4841013 y las recomendaciones vacías | ya escrita |
| 2026-06-24 | `~review-plantillas-whatsapp` | 3 | Review de la feature de plantillas de WhatsApp: cooldown de Meta, header multimedia y el selector del chat | ya escrita |
| 2026-06-24 | `~map-secuencias-y-plantillas-meta` | 6 | Mapeo de la tab Secuencias + modelo de datos de nutrición + investigación de las reglas de aprobación de plantillas de WhatsApp de Meta | **rescatada** |
| 2026-06-24 | `~mapa-convenciones-closing-analyst` | 4 | Reconocimiento de convenciones del repo (tokens CSS, route handlers, crons, componentes cliente) antes de construir el Closing Analyst | — |
| 2026-06-24 | `~review-plantillas-whatsapp-meta` | 5 | Review pre-deploy de la feature de plantillas de WhatsApp contra la Graph API de Meta (drafts, submit, reconcile, validador) | **rescatada** |
| 2026-06-24 | `~review-closing-sync` | 13 | Code review del sync del Closing Analyst: presupuesto de tiempo, contadores de la corrida, defensas ante datos malos de Fathom | **rescatada** |
| 2026-06-24 | `~salud-de-cuenta-meta` | 9 | Diseño de la vista de estado de entrega de Meta: enums de account_status/effective_status, qué guarda hoy la capa de datos y alerta en el semáforo de /general | ya escrita |
| 2026-06-23 | `mako-landing-copy` | 5 | exploración de pantallas del dashboard para escribir el copy de la landing de MaKo (one-liners y bullets por tab) | — |
| 2026-06-23 | `~review-inbox-whatsapp` | 4 | Code review del inbox de WhatsApp: bloqueo de contactos, beep de mensajes nuevos y cache de hilos | **rescatada** |
| 2026-06-23 | `~audit-notificaciones-whatsapp` | 3 | Auditoría del NotificationsProvider y la página de WhatsApp: por qué el sonido y el pop-up no aparecían «estés donde estés» y si el badge de no leídos miente | ya escrita |
| 2026-06-23 | `~auditoria-inbox-whatsapp-chatwoot` | 5 | Auditoría del inbox de WhatsApp oficial: no leídos, grabación de notas de voz, bloqueo de contactos y el webhook de Chatwoot | **rescatada** |
| 2026-06-23 | `~review-adjuntos-whatsapp` | 5 | Review adversarial (4 lentes + verificador) del envío de adjuntos por WhatsApp: contrato de Chatwoot, runtime de Next, seguridad y UX | **rescatada** |
| 2026-06-23 | `mako-landing-research` | 7 | Relevamiento del stack, tokens de diseño, componentes reusables y branding para construir la landing de venta | — |
| 2026-06-23 | `wa-inbox-recon` | 4 | Dónde enganchar avatar del contacto, adjuntos y ficha del lead en el inbox de WhatsApp (Chatwoot + route handler) | **rescatada** |
| 2026-06-23 | `whatsapp-nutricion-templates` | 13 | Redactar y auditar las 13 plantillas de WhatsApp de nutrición por etapa del funnel, con revisión de compliance de Meta | ya escrita |
| 2026-06-23 | `~review-inbox-whatsapp` | 4 | Review del inbox de WhatsApp antes de entregarlo: notas de voz, emoji picker, ticks de estado y refresco del hilo abierto | **rescatada** |
| 2026-06-23 | `~review-inbox-whatsapp` | 3 | Review adversarial del inbox de WhatsApp sobre Chatwoot: polling, badges, envío optimista, grabación de audio y hilo de 15→4 conversaciones | **rescatada** |
| 2026-06-23 | `wa-batch-recon` | 4 | Recon de endpoints de Chatwoot (marcar leído, bloquear contacto), renombre J1/J2→R1/R2 en la UI y cómo mover un lead a «Nutrición - Manual» desde el webhook | — |
| 2026-06-23 | `wa-audio-131053` | 2 | Por qué Meta rechaza los audios con error 131053 y si conviene migrar de MP3 (lamejs) a Ogg/Opus para mandar notas de voz | **rescatada** |
| 2026-06-22 | `~forense-tracking-vsl` | 17 | Forense eslabón por eslabón de la cadena de tracking del VSL: landing Lovable → beacon → vsl_events → leads.visitor_id | ya escrita |
| 2026-06-22 | `research-whatsapp-antiban` | 4 | Investigación de límites de envío, quality rating y reglas anti-baneo de WhatsApp Business para el motor de nutrición | **rescatada** |
| 2026-06-22 | `review-lead-detail` | 6 | Revisión de la ficha del lead: datos inventados (atribución, historial, VSL), etapas hardcodeadas y Calendly embebido para R1/R2 | ya escrita |
| 2026-06-22 | `~inventario-workflows-n8n` | 5 | Inventario de los workflows de n8n (ManyChat, Calendly, Chatwoot, follow-ups) y qué duplican de la app | ya escrita |
| 2026-06-21 | `~review-funnel-editor-transiciones` | 19 | Review adversarial del FunnelEditor y de la migración 0024 de funnel_transitions: keys por índice, selectedEdge zombie, guardado sin transacción y asistencia en el drag&drop | — |
| 2026-06-21 | `~revision-crm-board-etapas` | 4 | Revisión del board del CRM y del mapeo de etapas (validStageKeys, drag entre bandas, desplegable de «Mover a…») | — |
| 2026-06-21 | `funnel-as-source-of-truth-brainstorm` | 6 | Brainstorm de funnel_config como fuente única: qué superficie lo consume, qué lo alimenta y 20+ ideas priorizadas | ya escrita |
| 2026-06-21 | `funnel-feature-research` | 5 | Cómo agregar la tab /funnel: modelo de etapas, persistencia, routing del sidebar y renombre Junta→Reunión | — |
