# Mapa del Ops Center · plan-calendario-dashboard

Parte de [docs/ops-center-principal.md](../ops-center-principal.md) (20/10/2026). Medido en sólo lectura sobre C:/dev/wt-push-q. Lo «sin_verificar» no se afirma.

**Chat responsable:** El Plan va al chat «Plan» (Perro Guardián y extracción); si no hay jefe abierto, por la regla del 17/10 va al «CRM». El Calendario va a «Calendario» (sin verificar que exista ese jefe). El Dashboard, con Focus/General y la persona del informe, va a «Dashboard». Lo transversal va a «Ops Center 3»: el clasificador de intención del canal app (lib/mako-intencion.ts), el tipo de ítem «bloque» del hilo, la confirmación adentro del chat y el aviso cuando termina un trabajo largo. Los chats de cada área le pasan sus frases y sus renderizadores.

**Tabs:**
- /plan: Prioridades, Kanban por estado, Proyectos, Graphics, ficha de tarea y de proyecto, Nueva tarea / Nuevo proyecto, debates del Perro (prioridad, fecha, proyecto), Reuniones (Fathom) y su reparto, Bandeja de borradores, Importar, Exportar, Datos faltantes
- /plan/revisar/[id]: la pantalla donde se confirma un borrador de MaKo (preguntas de a una)
- /plan/agencia: el tablero del super-admin (dependencias, cliente por tarea, proyectos vacíos)
- /calendario: Día / Semana / Mes / Año / Agenda / 4 días; 7 capas (Publicaciones, Llamadas, Bloques, Plan, Se repite, Cobros, Objetivos) más los calendarios de Google; Crear, Plantillas de semana, Agendar llamada, conectar Google
- /dashboard: Focus (lo que era /general), las hojas, Templates, la hoja Closing (ficha de llamada), modo Ver / Editar, «Editar con MaKo», AI Analyst y chat por gráfico, Compartir, Exportar, filtros de la barra
- app/m/plan, app/m/calendario, app/m/dashboard: las versiones del teléfono (son las piezas candidatas para los bloques del chat)

**Hoy:** 89 acciones · sí 19 · parcial 26 · no 40 · sin verificar 4.

## Acciones

| Acción | Operación de la API | Hoy | Falta | Bloque en el chat | Tam. |
|---|---|---|---|---|---|
| Plan · Ver «qué hago hoy» (Prioridades: el Objetivo principal y lo de mayor puntaje) | ver_prioridades_plan | parcial | herramienta, bloque | Lista de Prioridades: el Objetivo principal arriba y de 3 a 5 tarjetas (círculo de prioridad, deadline, proyecto) con casilla «hecha» y «Abrir en el Plan» | S |
| Plan · Ver las tareas en el kanban por estado, con filtros (proyecto, estado, origen, cliente) | listar_tareas_plan | si | bloque | Mini kanban por estado (el KanbanM de app/m/plan), con los filtros como chips y «Abrir en el Plan» | M |
| Plan · Ver los proyectos y su avance | listar_proyectos_plan, ver_proyecto_plan | si | bloque | Tarjeta de proyecto: emoji, avance total, tareas abiertas y prioridad | S |
| Plan · Abrir la ficha de una tarea (detalle, puntaje y su razón, deadline y su razón, historial) | ver_tarea_plan | si | bloque | Tarjeta de tarea expandible (el sheet de app/m/plan) con acciones rápidas: fecha, columna y marcar hecha | S |
| Plan · Buscar tareas por texto | buscar_tareas_plan | si | nada |  | S |
| Plan · Buscar con IA lo que se quiso decir («lo que quedó trabado por Meta», /api/plan-buscar) | null | parcial | herramienta |  | S |
| Plan · Gráficos del tablero (reparto por proyecto, avance, ritmo de cierre) | null | no | herramienta, bloque | Gráfico del ritmo de cierre y del reparto por proyecto | M |
| Plan · Crear UNA tarea («creá una tarea para revisar la landing el viernes») | proponer_tareas_plan | no | herramienta, confirmacion, bloque | Borrador de tareas DENTRO del chat: cada tarea se puede editar (título, proyecto, deadline), las preguntas van de a una y abajo están «Crear» y «Descartar» (lo que hoy hace /plan/revisar/[id]) | M |
| Plan · Dictar una tarea por audio | proponer_tareas_plan | parcial | confirmacion, bloque | El mismo borrador de tareas adentro del chat | S |
| Plan · Importar archivos (notas, PDF, capturas, audios) y sacar tareas | proponer_tareas_plan | parcial | confirmacion, bloque | Borrador de tareas adentro del chat, cada una con «de dónde salió» | M |
| Plan · Editar el título, el detalle, el emoji o las notas de una tarea | null | no | herramienta | Tarjeta de confirmar con el detalle de antes y el de después | S |
| Plan · Cambiar la fecha límite | cambiar_fecha_tarea_plan | si | bloque | Selector de fecha en la tarjeta que confirma | S |
| Plan · Debatir la fecha con el Perro (FechaDebateModal) | null | no | herramienta, bloque | La fecha y la razón que propone el Perro contra la fecha puesta a mano, para elegir una | M |
| Plan · Mover de columna (Por iniciar, En proceso, Atorada con motivo, No cumple) | mover_tarea_plan | parcial | herramienta, bloque | Chips de columna en la tarjeta de la tarea | S |
| Plan · Cambiar el avance (%) | actualizar_avance_tarea | parcial | herramienta |  | S |
| Plan · Marcar hecha, o avisar «ya terminé X» | cerrar_tareas_plan (tarjeta en el chat), proponer_cierre_tareas (pantalla) | si | nada |  | S |
| Plan · Borrar una tarea (con confirmación) | null (sólo el campo `eliminar` del proponer_tareas_plan viejo, por borrador) | no | herramienta, confirmacion | Tarjeta «Borrar #412 Revisar la landing» con Deshacer | S |
| Plan · Pasar una tarea a otro proyecto | null | no | herramienta |  | S |
| Plan · Asignar un cliente a una tarea (tablero de la agencia) | null | no | herramienta, permiso |  | S |
| Plan · Fijar la prioridad a mano, o devolvérsela al Perro | null | no | herramienta, bloque | Círculo de prioridad con un deslizador de 1 a 100 y la razón del Perro | S |
| Plan · Debatir el puntaje de una tarea o de un proyecto con el Perro | null (la razón se lee con ver_tarea_plan) | no | herramienta, bloque |  | M |
| Plan · Re-priorizar todo | repriorizar_plan, ver_repriorizacion_plan | parcial | herramienta, motor, bloque | Barra de avance por tandas que se actualiza en el hilo | S |
| Plan · Dependencias (B espera a A) | agregar_dependencia_plan, quitar_dependencia_plan, listar_dependencias_plan | parcial | herramienta, permiso |  | S |
| Plan · Crear un proyecto (nombre según el catálogo, emoji, color, prioridad) | null (sugerir_proyecto_plan sólo sugiere el nombre) | no | herramienta, bloque | Tarjeta del proyecto nuevo con el nombre según REGLA_NOMBRE_PROYECTO y el emoji | S |
| Plan · Editar un proyecto, o que MaKo reescriba su nombre, emoji y detalle (MakoProyecto) | null | no | herramienta |  | S |
| Plan · Borrar un proyecto (y decidir qué pasa con sus tareas) | null | no | herramienta, confirmacion |  | S |
| Plan · Proyectos sin tareas: MaKo propone tareas | listar_proyectos_vacios, proponer_tareas_proyecto_vacio | parcial | confirmacion, bloque |  | S |
| Plan · Crear una tarea que se repite («todos los martes a las 3») | proponer_tareas_plan (en el esquema viejo sólo hay `recurrente: boolean`, sin ritmo) | no | herramienta, motor, bloque | Formulario del ritmo (cada N días, semanas o meses, y qué días) con la línea «el Plan repite por día: la hora no se guarda» | M |
| Plan · Ver las próximas veces de lo que se repite | ver_proximas_recurrentes (está en el área calendario) | parcial | herramienta |  | S |
| Plan · Ver mis reuniones de Fathom (y cuáles no se leyeron) | listar_reuniones_fathom | parcial | herramienta, bloque | Lista de reuniones: fecha, tipo, el borrador que dejó y, si no se leyó, por qué | S |
| Plan · Sacar las tareas de una reunión (leer la transcripción) | null | no | herramienta, bloque | Elegir la reunión, tocar «Leer y sacar tareas» y recibir el borrador adentro del chat | M |
| Plan · Ver qué salió de una reunión | ver_borrador_de_reunion | parcial | herramienta |  | S |
| Plan · Repartir lo de una reunión a cada persona (por WhatsApp o email, o en su propio plan) | null | no | herramienta, confirmacion, bloque | Reparto por persona con casillas y el canal de cada una | M |
| Plan · Bandeja de borradores: ver, aplicar, descartar | listar_borradores_plan, ver_borrador_plan, descartar_borrador_plan | parcial | confirmacion, bloque |  | S |
| Plan · Glosario (qué significa una sigla del negocio) | guardar_termino_glosario | sin_verificar | nada |  | S |
| Plan · Tareas vencidas, paradas o sin deadline | listar_tareas_vencidas, listar_tareas_paradas, listar_tareas_sin_datos | si | bloque | Lista de tareas con chips de acción rápida (fecha, cerrar) | S |
| Plan · Exportar el tablero | null | no | herramienta, bloque | Archivo para descargar adentro del chat | S |
| Plan · Deshacer el último cambio | null | no | herramienta |  | S |
| Calendario · Ver el día, la semana o el mes con sus capas (publicaciones, llamadas, bloques, plan, se repite, cobros, objetivos) | listar_eventos_calendario (más las lecturas de crm, plan y general) | parcial | herramienta, bloque | Agenda de la semana (VistasM de app/m/calendario) con las capas como chips. Lo de Google lo dibuja el código, sin pasar por el modelo | M |
| Calendario · Agendar una publicación (Story, Reel, Post, Anuncio, Email, Video) | crear_evento_calendario | parcial | herramienta, bloque | Tarjeta del evento con el color de su capa, el formato, y la fecha y hora en la zona del negocio | S |
| Calendario · Bloque de trabajo («bloqueame 2 horas el miércoles para grabar») | crear_evento_calendario | no | herramienta |  | S |
| Calendario · Llamada suelta | crear_evento_calendario (tipo llamada), proponer_agendar_agenda (en Google) | parcial | herramienta |  | S |
| Calendario · Crear un evento en Google Calendar | crear_evento_google | parcial | herramienta |  | S |
| Calendario · Mover o editar un evento de MaKo (arrastrarlo, cambiar la hora o el título) | null | no | herramienta |  | S |
| Calendario · Mover o editar un evento de Google (¿avisar a los invitados?) | proponer_mover_reunion, proponer_cambiar_reunion (están en el área crm) | si | bloque | Tarjeta con el evento de antes y el de después, más «¿Avisar el cambio?» | S |
| Calendario · Borrar un evento de MaKo (con Deshacer) | null | no | herramienta, confirmacion |  | S |
| Calendario · Borrar un evento de Google | proponer_cancelar_reunion | si | nada |  | S |
| Calendario · Marcar una publicación como hecha («Ya se publicó») | null | no | herramienta |  | S |
| Calendario · Armar la semana con una plantilla («Semana de contenido») | null | no | herramienta, bloque | Vista previa de la semana con los eventos de la plantilla (PLANTILLAS_CALENDARIO), que se pueden editar, y «Agendar todos» | M |
| Calendario · Link para agendar una llamada (Calendly o Cal.com, R1 o R2) | link_agenda_llamada | parcial | herramienta |  | S |
| Calendario · Agendar una llamada con un lead (con los huecos reales) | listar_horarios_reunion, proponer_agendar_reunion, proponer_agendar_agenda | si | bloque | Elegir entre 3 huecos | S |
| Calendario · Conectar Google Calendar (el modal de OAuth ahí mismo) | ver_estado_google_calendar (sólo lee) | parcial | bloque | Botón «Conectar Google Calendar» que abre el modal de Integraciones en el chat | S |
| Calendario · Ver los cobros que vencen (capa Cobros) | cuotas_pendientes, a_quien_cobrar | parcial | herramienta |  | S |
| Calendario · Elegir qué capas y qué calendarios se ven | null | no | bloque |  | S |
| Dashboard · Ver las hojas (Focus, las hojas, Templates) y leer una | listar_informes_dashboard, leer_hoja_dashboard | si | bloque | Miniatura de la hoja (MiniaturaHoja.tsx) con «Abrir en el Dashboard» | M |
| Dashboard · Preguntar un número («¿cuánto vendí este mes?», ROAS, CAC) | consultar_datos_dashboard, ver_revenue_periodo, metricas_negocio, ver_cac_mensual | si | bloque | Gráfico vivo (app/dashboard/Grafico.tsx dibujando el Resultado) con «Agregar a la hoja…» | M |
| Dashboard · Ver qué hay detrás de un número (Detalle) | ver_detalle_numero_dashboard | si | bloque | Lista de filas con sus acciones: abrir el lead o la llamada, marcar cobrado | S |
| Dashboard · Acciones en una fila (marcar cobrado, abrir el lead, la llamada o la tarea) | marcar_pago_cobrado (área cobros/crm) | sin_verificar | bloque |  | S |
| Dashboard · Nueva hoja con «Pídeselo a MaKo» | crear_hoja_dashboard (con pedido) | no | herramienta, bloque | Vista previa de la hoja armada (miniatura con sus gráficos) con «Crear» y «Cambiar algo» | M |
| Dashboard · Nueva hoja desde una plantilla, en blanco, o pegando un dashboard copiado | crear_hoja_dashboard (con plantilla), pegar_dashboard | no | herramienta, bloque | Elegir entre 3 plantillas, cada una con su miniatura | S |
| Dashboard · Copiar un dashboard con su código | copiar_dashboard | no | herramienta |  | S |
| Dashboard · Renombrar una hoja, cambiarle el emoji o el subtítulo, reordenarla | editar_hoja_dashboard | si | nada |  | S |
| Dashboard · Estilo de toda la hoja (plantilla, color, letra) | editar_hoja_dashboard (tema, ajustes) | si | bloque | Vista previa del estilo antes de confirmar | S |
| Dashboard · Duplicar una hoja | duplicar_hoja_dashboard | no | herramienta |  | S |
| Dashboard · Borrar (archivar) una hoja | borrar_hoja_dashboard | si | nada |  | S |
| Dashboard · Restablecer el informe | restablecer_informe_dashboard | no | herramienta |  | S |
| Dashboard · Agregar un gráfico | agregar_grafico_dashboard | no | herramienta, bloque | El gráfico dibujado con los datos reales ANTES de confirmar, con «Agregar a {hoja}» | M |
| Dashboard · Editar un gráfico (tipo, métricas, período, comparar, los filtros que lo definen) | editar_grafico_dashboard | parcial | herramienta, bloque | El gráfico antes y después, lado a lado | M |
| Dashboard · Quitar un gráfico o un elemento | quitar_componente_dashboard | no | herramienta, bloque | Tarjeta con la configuración del gráfico, para volver a agregarlo (por la API no se deshace) | S |
| Dashboard · Mover una tarjeta o cambiarle el tamaño | null | no | herramienta |  | S |
| Dashboard · Insertar un elemento (texto, imagen, enlace, video, página, línea, flecha, sección, Conclusiones, Acción) | insertar_elemento_dashboard | no | herramienta |  | S |
| Dashboard · Unir dos tarjetas con una flecha (conectores) | conectar_componentes_dashboard, quitar_conector_dashboard | no | herramienta |  | S |
| Dashboard · Filtros de la barra (período, lista de un campo, texto, agrupar) | agregar_filtro_dashboard, quitar_filtro_dashboard | no | herramienta, bloque | Chips de período y de filtro sobre el gráfico vivo | S |
| Dashboard · Pop-up de un gráfico (la mini-hoja que se abre al hacer clic) | null | no | herramienta |  | M |
| Dashboard · «Editar con MaKo» con un pedido en palabras | editar_hoja_con_ia_dashboard | parcial | herramienta, bloque | «Qué cambia», con la hoja antes y después, y Deshacer | M |
| Dashboard · AI Analyst: analizar una hoja («Analizar con MaKo») | analizar_hoja_dashboard | parcial | herramienta, motor, bloque | Tarjeta del análisis: resumen, hallazgos con su número y recomendaciones, que se actualiza cuando termina | M |
| Dashboard · Leer el último análisis | leer_analisis_dashboard | si | bloque |  | S |
| Dashboard · Programar el análisis (cada N días, semanas o meses, a una hora) | programar_analisis_dashboard | no | herramienta, bloque | El horario (unidad, cada cuánto, día y hora en la zona del negocio) con los valores por defecto A LA VISTA | S |
| Dashboard · Cancelar un análisis en curso | cancelar_analisis_dashboard | si | nada |  | S |
| Dashboard · Conclusiones de MaKo (la caja): generarlas o leerlas | generar_conclusiones_dashboard, leer_conclusiones_dashboard | parcial | herramienta |  | S |
| Dashboard · Chat por gráfico y el botón de MaKo de un gráfico (editar su prompt) | editar_grafico_dashboard (pedido_mako); el chat es /api/chart-insights, sin herramientas | parcial | herramienta |  | S |
| Dashboard · Compartir (link de acceso e invitar por email) | null | no | herramienta, confirmacion | Tarjeta de compartir: link, lista de invitados y «Enviar invitación» | S |
| Dashboard · Exportar CSV o PDF | null | no | herramienta, bloque | Archivo para descargar adentro del chat | M |
| Dashboard · Deshacer, clic derecho, buscar en la hoja (Ctrl+F) | null | no | herramienta |  | S |
| Dashboard · Experimento en la hoja («probemos X») | sugerir_experimento, crear_experimento (pantalla), iniciar_experimento | sin_verificar | confirmacion |  | M |
| Dashboard · Ficha de una llamada en la hoja Closing (ver, marcar el resultado, corregir puntajes, re-analizar, sincronizar) | detalle_llamada, marcar_resultado_llamada, corregir_puntajes_llamada, analizar_llamadas_lead | sin_verificar | bloque |  | M |
| Dashboard › Focus · Ver los objetivos y los KPIs del trimestre | leer_resumen_objetivos, ver_objetivo_principal, ver_tablero_kpis | si | bloque | Semáforo de los objetivos, con su avance | S |
| Dashboard › Focus · Crear un objetivo o registrar el valor de un KPI | guardar_objetivo (pantalla /mako/revisar), registrar_valor_kpi | no | herramienta, confirmacion |  | S |
| Dashboard · Que «mi hoja» sea la de quien chatea (el informe por persona) | todas las del área: el parámetro `persona` | parcial | permiso |  | S |

## La inteligencia del chat de esta área

CÓMO SE MIDIÓ. Se corrió el mismo camino que corre el turno: clasificarIntencion → herramientasDelChat, en canal app, con rol admin, sobre unos 110 pedidos naturales. Lo que sigue sale de esa medición; lo que no se pudo medir dice «sin verificar». El script es C:\Users\marti\AppData\Local\Temp\claude\C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main\9bc46b5e-9148-459a-96ec-697adcd3d518\scratchpad\medir\medir.mts (las frases están en pedidos-*.txt). Se corre desde C:/dev/wt-push-q con node --import tsx.

EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO. «Faltan operaciones» es cierto sólo en parte. El freno grande es el CLASIFICADOR (lib/mako-intencion.ts).
- Se escribió para el doer de WhatsApp, donde el dueño vuelca ideas. Ahí, ante la duda, capturar es lo correcto.
- Por eso no reconoce como orden ni «creá / crea / creame», ni «agregá / agrega», ni duplicá, filtrá, programá, quitá, insertá, uní, poné, generá, restablecé, editá, registrá o bloqueame. Todos se clasifican capturar DUDOSA, y toolsParaIntencion le saca a la duda la única herramienta que escribe: llegan ver_plan y listar_pendientes y nada más.
- Pasa con voseo, con tuteo y con «quiero» / «necesito que».
- Del Dashboard, 19 de 24 pedidos de escritura medidos se clasificaron así. Del Plan, 12 de 23. Las operaciones existen (agregar_grafico, crear_hoja, programar_analisis, duplicar, filtros, insertar, conectores, conclusiones, crear tarea) y no llegan nunca.
- Dos trampas más:
  - (a) «agendá» con tilde no matchea la regex de `calendario`, y «fathom» es palabra de `closing`, no de `plan`.
  - (b) editar_grafico_dashboard ocupa 4.119 de los 12.000 caracteres del presupuesto. Con «leads» en la frase, el CRM se queda con todo el presupuesto.
- Una pista de pantalla delante del texto, el molde de la ficha del CRM («Cambia la hoja del Dashboard: …»), NO lo arregla: se midió.
- El molde que sí sirve es el de esPedidoAutomatizacion / esPedidoDiseno: verbo de crear o editar más un objeto del área.

QUÉ TIENE QUE SABER Y LEER ANTES DE ACTUAR.
- Del negocio, ya viajan en el system (buildSystemPrompt) el perfil, la fase, los objetivos, los experimentos y el funnel; buscar_conocimiento viaja siempre (Second Brain y El Archivero).
- Plan:
  - ver_plan antes de proponer: proyectos existentes, dedup y el link de cada tarea.
  - listar_tareas_plan para los ids, y ver_senales_negocio para lo que ya está resuelto.
  - ver_objetivo_principal y ver_trimestre_actual para priorizar.
  - El nombre de un proyecto se arma con REGLA_NOMBRE_PROYECTO (lib/plan-proyectos-catalogo.ts) y va en inglés.
  - Las siglas están en el glosario (guardar_termino_glosario).
  - Antes de volver a leer una reunión, ver_borrador_de_reunion (leerla cuesta IA).
  - Hay dos tableros: el del super-admin (ids de texto, dependencias) y el del cliente (ids numéricos).
- Calendario:
  - La zona del negocio va en ctxHoy; una hora de pared se pasa a instante con instanteDe, en dos pasadas.
  - listar_eventos_calendario es SÓLO lo propio. Las reuniones del CRM, el Plan, las cuotas y el Quarter se leen de donde viven.
  - La agenda de Google NO pasa por el modelo: la muestra el código (lib/agenda-sin-ia.ts).
  - Antes de prometer que escribe en Google, ver_estado_google_calendar.
- Dashboard:
  - Antes de agregar o crear, ver_catalogo_dashboard (conjuntos, métricas, tipos, plantillas, campos).
  - leer_hoja_dashboard para los ids de la hoja y de sus componentes.
  - listar_informes_dashboard para saber de quién es cada informe.
  - Qué integraciones tiene el negocio: una plantilla sale sin los gráficos que quedarían vacíos.
  - leer_analisis_dashboard antes de volver a analizar (cuesta IA).

QUÉ PREGUNTA EN VEZ DE INVENTAR. El caso del 20/10: «todos los martes a las 3, a todo el funnel», y MaKo armó otra cosa con pasos por defecto.
- Ritmos: pregunta los días y cada cuánto. Dice que el Plan repite por DÍA y no guarda la hora. Dice que el Calendario no repite eventos (ni los de MaKo ni los de Google). En programar_analisis, dice la hora y el día que va a usar; el default es lunes a las 9 y nunca va callado.
- Un «agendá X» ambiguo: pregunta en cuál calendario. Una publicación o un bloque van al de MaKo; una reunión con invitados va a Google.
- Sin hora: dice que queda de todo el día. Nunca dice que un horario está libre.
- «Movela / borrala» sin objeto: pregunta qué es, igual que la pregunta que ya existe, «¿La reunión o la tarea?».
- Proyecto: pregunta sólo si hay dos candidatos de verdad.
- Deadline: sólo si lo dijeron.
- Qué hoja (si hay más de una que coincide), qué período (mes calendario o últimos 30 días) y qué métrica: «ventas» puede ser cierres o revenue.
- Borrar: muestra el nombre, la fecha y el calendario o la hoja exactos en la tarjeta antes de confirmar.

QUÉ NO HACE NUNCA.
- No crea, edita ni borra tareas directo: es la regla del Plan (plan.def.ts). Todo pasa por un borrador o una tarjeta que confirma una persona.
- No dice «listo» ni «anotado» antes de que se confirme, y no escribe links: los pone el sistema.
- No usa proponer_tareas_plan para un lead.
- No convierte un análisis en una edición. «Analizar» y «Editar» son dos modos: lo pidió Martín el 17/10, después de que falló con Mauricio. Es la regla de permisoEdicionMako.
- No cancela un evento de Google ni de Calendly cuando le pidieron uno de MaKo, ni al revés.
- No lee la agenda de Google.
- No completa valores por defecto sin decirlos.
- No manda datos de clientes (el área metricas tiene datosDeClientes en true) a la red gratis.
- No comparte un informe con un email sin una confirmación.

QUÉ REUSAR.
- Prompts del registro (lib/prompt-registry.ts):
  - del Perro: guardian.puntuar, .rutear, .cruce, .duplicados, .debate, .proj-debate;
  - plan-criterio.juez, plan-fathom.extraer / .dedup, proyecto.sugerir;
  - del Dashboard: dashboard.hoja-ia.system, dashboard.editar-ia.system, dashboard.analista.system, dashboard.elemento_ia.system;
  - chart_insights.prompt_analisis y mako.modo.analista.
- Código:
  - lib/doer-recetas.ts: RECETA_PLAN, que hay que adaptar al canal app (sin el «---» ni el acuse de WhatsApp). Faltan las recetas de Calendario y de Dashboard.
  - lib/detalle-contrato.ts (MOLDE_DETALLE), lib/plan-proyectos-catalogo.ts, lib/preguntas-contrato.ts.
  - lib/graficos-ia-generar.ts / graficos-ia-editar.ts / graficos-ia-edicion.ts, lib/graficos-analisis(-server).ts, lib/graficos-ia-red.ts (la red y el corte por datos de clientes), app/dashboard/pedidos-hoja.ts.
  - lib/agenda-sin-ia.ts, lib/calendario-modelo.ts (PLANTILLAS_CALENDARIO, capas, instanteDe), lib/plan-recurrentes-fechas.ts, lib/mako-pedidos.ts («entender el pedido»).
- Piezas para los bloques: app/m/plan (ListaPlan, KanbanM, el sheet de la tarea), app/m/calendario (VistasM, modelo.ts puro), app/m/dashboard (DashboardM, GraficoBarrasM), app/dashboard/Grafico.tsx, MiniaturaHoja.tsx, Detalle.tsx, app/_ui/TarjetaKanban.tsx y BoardShell en modo `embebido`.

PARA LA COSECHA (va al repo):
- El hallazgo del clasificador, a la doc del área donde vive lib/mako-intencion.ts.
- La tilde de «agendá» y el link de Cal.com, a docs/hallazgos-calendario.md.
- El presupuesto que se come editar_grafico_dashboard y la persona que no se fija en canal app, a docs/hallazgos-graficos.md.
- Las operaciones del Plan que faltan y «fathom» en `closing`, a docs/hallazgos-plan.md.

## Bloques nuevos

- Tarjeta de tarea (de la familia de TarjetaKanban): emoji, título, círculo de prioridad, deadline y proyecto, con acciones rápidas (fecha, columna, hecha) y «Abrir en el Plan»
- Lista de Prioridades: el Objetivo principal más las 3 a 5 tareas de arriba, con casilla
- Mini kanban del Plan por estado (KanbanM de app/m/plan) con filtros en chips
- Borrador de tareas adentro del chat (lo que hoy es /plan/revisar/[id]): tareas que se editan, preguntas de a una, «Crear» y «Descartar»
- Formulario de ritmo de una recurrente (cada N, qué días) con «el Plan repite por día, sin hora»
- Lista de reuniones de Fathom (tipo, fecha, el borrador que dejó, si no se leyó) con «Leer y sacar tareas», y el reparto por persona
- Barra de avance de un trabajo largo (Re-priorizar todo, AI Analyst, la extracción), que se actualiza en el hilo
- Agenda de la semana (VistasM de app/m/calendario) con las capas en chips; lo de Google lo dibuja el código
- Tarjeta de evento (capa, formato, fecha y hora en la zona del negocio, calendario MaKo o Google) con «Mover / Borrar / Marcar hecho» y «¿Avisar a los invitados?»
- Vista previa de una plantilla de semana con «Agendar todos»
- Elegir entre 3 huecos reales para una llamada
- Botón «Conectar Google Calendar» que abre el modal ahí mismo
- Gráfico vivo (app/dashboard/Grafico.tsx con el Resultado) con chips de período y filtro, y «Agregar a la hoja…»
- Miniatura de una hoja (MiniaturaHoja), y elegir entre 3 plantillas
- «Qué cambia» en una edición de hoja: antes y después, con Deshacer
- Tarjeta del análisis del AI Analyst: resumen, hallazgos con su número y recomendaciones
- Detalle de un número: filas con sus acciones (abrir el lead o la llamada, marcar cobrado)
- Tarjeta de compartir un informe (link e invitados) y archivo exportado (CSV o PDF) para descargar

## Decisiones para Martín (las de esta área)

- En el Ops Center (canal app), cuando MaKo no entiende un pedido, ¿deja de capturarlo como idea (el default de WhatsApp, que en una duda saca la herramienta de escribir) y pasa a preguntar qué querés hacer? Hoy «creá una tarea / una hoja / un gráfico» llega sin la herramienta.
- La regla del Plan dice que un agente nunca crea tareas directo, siempre por borrador. ¿Se mantiene con el borrador DENTRO del chat, o una tarea suelta pedida explícitamente se crea con la tarjeta de confirmar, como cambiar una fecha?
- Borrar desde el chat una tarea, un proyecto, un evento de MaKo o una hoja: ¿tarjeta con Deshacer, o sólo por borrador o pantalla?
- «Todos los martes a las 3»: el Plan repite por DÍA sin hora, y el Calendario no repite eventos ni de MaKo ni de Google. ¿Se suma la hora o la repetición, o MaKo dice que no se puede y propone la alternativa?
- Compartir un dashboard por email desde el chat le manda un correo a un tercero: ¿tarjeta en el chat o pantalla de revisión?
- El Calendario y el Dashboard son sólo del admin. ¿El closer y el setter ven sus llamadas y su hoja Closing desde el Ops Center?
- Programar publicaciones de verdad en las redes (Zernio) sigue esperando la decisión del 06/10. Mientras tanto, el chat sólo PLANEA publicaciones.

## Piezas, en orden

| Pieza | Hecho = | Depende de | Tam. |
|---|---|---|---|
| 1. Clasificador del chat central: un «pedido de hacer» en Plan, Calendario o Dashboard. Verbo de crear o editar (con tilde, sin tilde, con pronombre, «quiero / necesito que») más un objeto del área (tarea, proyecto, hoja, gráfico, filtro, análisis, conclusiones, elemento, flecha, evento, reel, post, story, bloque, objetivo, KPI) se clasifica actuar con su área y su relevancia, con el molde de esPedidoAutomatizacion / esPedidoDiseno. Se suman «agendá / programá» con tilde y «Google Calendar» al área calendario, y «fathom» al área plan. | Los pedidos de escritura medidos en este mapeo (scratchpad medir/pedidos-*.txt) se clasifican actuar y traen su operación de escritura en herramientasDelChat (canal app). Hay un test en tests/mako-turno-app.test.ts con el turno que corre, probado rompiéndolo. Una duda en WhatsApp sigue capturando. | nada (lo lleva Ops Center 3 con las frases de este mapeo) | M |
| 2. El presupuesto de 12.000 caracteres: si la frase nombra «gráfico» u «hoja», el área metricas va primero. O se achica el esquema de editar_grafico_dashboard (4.119) y el de insertar_elemento_dashboard (3.291). | «cambiá el gráfico de leads a barras» trae editar_grafico_dashboard o editar_hoja_con_ia_dashboard, y no se le cuelan las del CRM. Medido con el script. | 1 | S |
| 3. En canal app, la persona del informe del Dashboard y de General es la que chatea (ctx.actor), salvo que nombre a otra. | En un workspace con 2 o más informes, «agregá un gráfico a mi hoja de Marketing» desde el Ops Center usa el informe de quien chatea sin pedir un email. Lo cubre un test de dashboard.run / general.run. | nada | S |
| 4. Las operaciones que le faltan al Plan, sobre las MISMAS funciones de /api/plan-board: editar_tarea_plan (título, detalle, emoji, notas, proyecto), fijar_prioridad_tarea (a mano, o devolverla al Perro), crear_proyecto_plan y editar_proyecto_plan (con la regla del catálogo), borrar_tarea_plan y borrar_proyecto_plan, y el ritmo de una recurrente (RRULE, como la UI) en proponer_tareas_plan. | Cada una está en plan.def.ts con su runner sobre la función de la pantalla y sale en docs/api-mako.md. La frase natural la trae al turno (pieza 1), y borrar deja una tarjeta con Deshacer o va por borrador, según lo que decida Martín. | 1; decisión de Martín sobre borrar y sobre crear directo | M |
| 5. Las reuniones por el chat: extraer_tareas_reunion (lee UNA reunión y deja el borrador, reusando plan-fathom.extraer y reunion-cruce; antes mira ver_borrador_de_reunion) y repartir_reunion (con el candado de participantes de /api/plan-reunion). | «sacá las tareas de la reunión con Leila de ayer» deja el borrador, o dice que ya existe, sin salir del chat. «¿qué reuniones de Fathom tengo sin leer?» trae listar_reuniones_fathom. | 1 | M |
| 6. Las operaciones que le faltan al Calendario: cambiar_evento_calendario, marcar_evento_calendario (hecho), borrar_evento_calendario (con restaurar) y crear_semana_plantilla. Además, link_agenda_llamada y las de Google del CRM (proponer_agendar_agenda, proponer_mover/cambiar/cancelar_reunion) viajan también con el área calendario. | «mové / borrá / marcá hecho el reel del jueves» actúa sobre el evento de MaKo y nunca sobre uno de Google o de Calendly. «pasame el link para agendar una llamada» le da su link a un negocio que tiene sólo Cal.com. Lo cubre un test de herramientas. | 1 | M |
| 7. Las operaciones que le faltan al Dashboard: compartir_dashboard (link e invitación por email, con confirmación), exportar_hoja (CSV; el PDF del lado del servidor está sin verificar) y mover_componente_dashboard (orden y ancho). | Las tres están en dashboard.def.ts, con su runner sobre la ruta de la pantalla, y la frase natural las trae al turno. | 1 | M |
| 8. Los bloques del área en el hilo, sobre el ítem «bloque» de Ops Center 3: tarea, kanban y prioridades; agenda semanal y tarjeta de evento; gráfico vivo, miniatura de hoja y elegir entre 3 plantillas; tarjeta del análisis. | La respuesta del turno trae un bloque con tipo además del texto, la propuesta y la pantalla. HiloMako lo dibuja con las piezas de app/m y app/dashboard/Grafico.tsx, con «Abrir en el Plan / Calendario / Dashboard». Se miró en el navegador, en la computadora y en el teléfono. | Ops Center 3 (el tipo de ítem en ItemHilo y RespuestaTurno) | L |
| 9. Confirmar adentro del chat: el borrador de /plan/revisar/[id] (preguntas de a una, editar, Crear / Descartar) como bloque, por la misma acción de /api/plan-propuesta. Lo mismo para guardar_objetivo y guardar_kpi (/mako/revisar). | Cargar tareas u objetivos desde el Ops Center no abre otra pantalla. La pantalla sigue para WhatsApp. | 8 | M |
| 10. Avisar en el hilo cuando termina un trabajo largo: analizar_hoja_dashboard, repriorizar_plan, crear_hoja_dashboard con pedido y la extracción de una reunión. | El resultado aparece como mensaje o bloque en ESE chat sin recargar la página, y el siguiente turno lo puede leer. | 8 | M |
| 11. Las recetas del área en el system, cada una sólo si viaja su herramienta (recetasDelTurno): RECETA_PLAN para el canal app, RECETA_CALENDARIO (MaKo, Google y CRM; sin hora es todo el día, y se dice; nunca dice «libre»; los ritmos) y RECETA_DASHBOARD (el catálogo antes de agregar; analizar no es editar; los valores por defecto se dicen). | tests/doer-recetas.test.ts: cada receta viaja sólo con su herramienta. Las frases ambiguas medidas («todos los martes a las 3», «agendá X» sin calendario) terminan en una pregunta y no en valores por defecto. | 1 | S |
| 12. Que el chat proponga algo al entrar (la pieza 4 de la llamada con Leila), en esta área: las vencidas y paradas del Plan, el último análisis del Dashboard y lo de hoy en el Calendario. | Un chat nuevo del Ops Center abre con hasta 3 propuestas del área, cada una con su botón, armadas por código y sin gastar IA. | 8 | M |
