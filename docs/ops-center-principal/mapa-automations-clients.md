# Mapa del Ops Center · automations-clients

Parte de [docs/ops-center-principal.md](../ops-center-principal.md) (20/10/2026). Medido en sólo lectura sobre C:/dev/wt-push-q. Lo «sin_verificar» no se afirma.

**Chat responsable:** Automations: el chat jefe «Automations» (relevo en docs/relevo/chatbot.md, hallazgos en docs/hallazgos-chatbot.md). Clients: el chat «Customer Success, el curso y la comunidad» (relevo en docs/relevo/customer-success.md, hallazgos en docs/hallazgos-customer-success.md). Lo transversal va aparte: los verbos y las regex de áreas de lib/mako-intencion.ts son de MaKo WhatsApp, dueño del clasificador; el marco de bloques, la tarjeta de confirmación y la proyección de chats en el índice son de Ops Center 3.

**Tabs:**
- Automations (/automations, clave de nav 'setting'; app/automations/*)
- Clients › Clients (/clients: kanban de la entrega, tabla, ficha; código en app/customer-success/*)
- Clients › Classroom (/clients/classroom: curso, módulos, clases, tareas, accesos; app/customer-success/curso/*)
- Clients › Community · Calendar · Members · Leaderboards · About (app/_comunidad, app/customer-success/comunidad/*)

**Hoy:** 63 acciones · sí 4 · parcial 22 · no 35 · sin verificar 2.

## Acciones

| Acción | Operación de la API | Hoy | Falta | Bloque en el chat | Tam. |
|---|---|---|---|---|---|
| Crear una automatización con IA desde un pedido (horario, a quién, canal, texto) | crear_automatizacion_con_ia (confirma en chat) | parcial | motor, bloque | Tarjeta de la automatización creada: nombre, el CRON en una frase («Todos los martes 15:00 · Reactivación»), las tarjetas en lista, PAUSADA, y los botones Activar / Probar / Abrir en el lienzo | M |
| Contestar la pregunta de MaKo antes de crear (¿Por dónde le escribo? / ¿De qué producto? / ¿Qué hace la persona?) | crear_automatizacion_con_ia (parámetros canal, producto, evento) | parcial | bloque | Pregunta con 2 a 4 botones del catálogo, «Elige tú» y «Otra cosa» (PreguntaMako de lib/automatizacion-chat.ts) | S |
| Crear desde una plantilla de la galería (categoría y etapa) | crear_automatizacion_desde_plantilla (chat), listar_plantillas_automatizaciones | si | bloque | Galería en el chat: 3 plantillas sugeridas con su ícono y para qué sirven, más el desplegable de etapa | S |
| Crear en blanco, copiar un flujo y pegarlo en otra (Ctrl+C/Ctrl+V, token) | null | no | herramienta, bloque | Tarjeta de la automatización creada | S |
| Ver una automatización (CRON, tarjetas, ramas, escenarios) | ficha_secuencia_mensajes, escenarios_secuencia | parcial | bloque | Mini lienzo de sólo lectura (o la lista de tarjetas del sheet de app/m/automations/AutomationsM.tsx) con sus caminos y «Abrir en el lienzo» | M |
| Activar o pausar una automatización | proponer_toggle_nutricion (chat, de siempre) | parcial | herramienta, bloque | Interruptor en la tarjeta de la automatización, con el motivo cuando no se puede (medio sin conectar, voz que falta) | S |
| Renombrar y cambiar el emoji | null | no | herramienta |  | S |
| Duplicar | duplicar_automatizacion (chat) | no | herramienta, bloque | Tarjeta de la copia (nace PAUSADA) | S |
| Archivar (eliminar) y desarchivar | archivar_secuencia (pantalla), desarchivar_secuencia (chat), listar_secuencias_archivadas | no | herramienta, confirmacion | Confirmación con la consecuencia escrita: «N leads dejan de recibir y no vuelven a entrar» | S |
| Editar el flujo: cambiar el texto de un mensaje; agregar o quitar tarjetas (WhatsApp, Email, Instagram, Messenger, Esperar, Condición, AI Step, Etiqueta, Acción, MaKo en WhatsApp, Si responde, Ir a); elegir número y proveedor de WhatsApp | editar_pasos_secuencia_mensajes (pantalla; sólo secuencias SIN ramas) | parcial | herramienta, bloque, confirmacion | Antes y después del flujo con las tarjetas cambiadas resaltadas, y botones «Publicar», «Dejar en borrador» y «Abrir en el lienzo» | L |
| Cambiar la espera de un paso o agregar una tarjeta Esperar | cambiar_espera_paso (chat) | parcial | herramienta |  | S |
| Publicar o descartar los cambios del borrador | null | no | herramienta, confirmacion, bloque | Aviso «Bienvenida tiene cambios sin publicar» con Publicar / Descartar y los frenos (medio sin conectar, voz que falta) | S |
| Cambiar qué la dispara: Funnel/etapas, Etiqueta (agregada o quitada, ignorar), Instagram, Messenger, Email recibido, Pagos; varios CRON; Reentrada | cambiar_crons_secuencia (pantalla) | parcial | confirmacion, bloque, herramienta | Selector «¿Qué la dispara?» con los botones de la primera pantalla del CRON (Funnel, Recurrente, Etiqueta, Instagram, Messenger, Email, Pagos) y la frase que resulta | M |
| Recurrente en una automatización existente (cada N, días, hora, zona, desde; a quién: cohorte o grupo de MaKo) | cambiar_crons_secuencia (objeto cron) | parcial | motor, confirmacion, bloque | El horario en una frase, las próximas 3 fechas, a quién va (cohorte y cuántos hoy) y «también al grupo» | M |
| Probar: simular en el teléfono o en Gmail, elegir el escenario, contestar como el lead, mandarme la prueba de verdad, probar en el grupo | probar_secuencia (pantalla), escenarios_secuencia, simular_respuesta_setter | parcial | herramienta, confirmacion, bloque | Simulador en el chat: el teléfono con los mensajes del escenario (lib/simulador-grafo.ts), elegir entre los N caminos y «Mandármelo a mi WhatsApp» | M |
| Ver métricas (enviados, respuestas, aperturas, inscriptos) | metricas_chatbot | si | bloque | Barras o tabla de 30 días por automatización | S |
| Ver qué etapas del funnel no tienen automatización | huecos_secuencias | si | bloque | Lista de etapas sin cubrir con «Crear desde plantilla» en cada una | S |
| Ver y mandar los borradores que dejó una automatización (por la regla anti-baneo: un no-cliente por WhatsApp no oficial) | listar_borradores_whatsapp_empresa (área whatsapp), descartar_borrador_whatsapp_empresa; mandar: null | no | herramienta, bloque, confirmacion | Cola de borradores de esa automatización: texto y lead, con «Mandar todos», «Mandar» y «Descartar» | M |
| Meter o sacar a un lead de una automatización | inscribir_lead_secuencia, sacar_lead_de_secuencia (chat) | no | herramienta, bloque | Tarjeta del lead con sus secuencias, en qué paso va y el próximo envío | S |
| Saber en qué secuencias está un lead | inscripciones_lead | si | bloque | La misma tarjeta del lead | S |
| Diagnosticar «configuré una automatización y no salió» | ficha_secuencia_mensajes, plan_nutricion_hoy, inscripciones_lead, estado_canal_whatsapp_chatbot | parcial | herramienta, motor, bloque | Diagnóstico en 3 renglones: «Salió como borrador (31 esperan) · Próxima: martes 15:00 · Ojo: #282 le manda lo mismo a Reactivación» | M |
| Enseñar un caso («qué contestar si pregunta el precio») y resolver un hand-off | agregar_escenario_secuencia (pantalla), resolver_handoff (pantalla), listar_handoffs_pendientes | no | herramienta, confirmacion, bloque | Tarjeta del caso, editable (título, cuándo aplica, cómo responder, «contesta solo»), con el mensaje real del lead | S |
| Armar o editar el AI Step (objetivo, escenarios con su libertad, voz, ensayo, objeciones) | null | no | herramienta, bloque | Editor del AI Step: objetivo y escenarios con su libertad, más un ensayo de 3 turnos para probarlo | M |
| Estrategia de la secuencia (objetivo, gancho, preguntas, criterio, desenlace, modo asistido o automático, lead magnet) | guardar_estrategia_secuencia (pantalla), listar_objetivos_secuencia, agregar_objetivo_custom (chat), crear_lead_magnet (pantalla), muestra_para_criterio | parcial | confirmacion, bloque | Formulario corto de la estrategia con lo que cambia resaltado | S |
| Notas de voz: grabar una para una tarjeta, asignar o quitar, borrar, ver qué falta grabar, elegir el público, completar la guía de voz | listar_audios, audios_requeridos, asignar_audio_paso (chat), asignar_audio_situacion (chat), borrar_audio (pantalla), guardar_publico_audios (chat), guia_voz_negocio, responder_huecos_voz (pantalla), destilar_voz (pantalla), armar_secuencias_de_audios (pantalla); grabar o subir: null | parcial | herramienta, bloque, confirmacion | Grabador en el chat con el guion de la situación (audios_requeridos) y un reproductor para escuchar antes de asignar | M |
| Poner una foto, video o documento en una tarjeta (biblioteca de archivos) | null | no | herramienta, bloque | Subir y elegir de la biblioteca de archivos, con miniatura | M |
| Links de un mensaje con o sin vista previa | vista_previa_links_paso (chat) | parcial | herramienta |  | S |
| Plantilla de Meta de un paso oficial (ver su estado, mandarla a aprobar) | plantillas_meta_de_secuencia, enviar_plantilla_meta_paso (pantalla) | parcial | herramienta, confirmacion |  | S |
| Configuraciones: horario de oficina y límites de envío | null | no | herramienta, bloque | Tarjeta del horario (días, horas, zona) y de los límites con lo usado hoy, editable | S |
| Conectar los medios: QR de WhatsApp, Instagram y Messenger (Zernio), email y dominio | estado_canal_whatsapp_chatbot (lectura); conectar: null | no | herramienta, bloque, permiso | QR de WhatsApp en el chat que se refresca solo, y botón para conectar Instagram o Messenger | M |
| Publicar en Creaciones, usar la de otro negocio, dar estrellas | publicar_creacion, usar_creacion, listar_creaciones, dar_estrella (chat) | no | herramienta |  | S |
| Ver en el Ops Center el chat de MaKo de cada automatización | null | no | bloque | Sub-chat «Automations › <nombre>» con su historial | S |
| Ver la cartera: quién necesita atención, último contacto, cuotas vencidas | ver_cartera_cs | parcial | herramienta, bloque | Lista de clientes con su nivel de atención y el motivo (lib/cs-senal.ts); tocar uno abre su ficha | S |
| Ver el kanban de la entrega de un servicio y la tabla de clientes | null | parcial | herramienta, bloque | Kanban de la entrega dentro del chat; arrastrar a un cliente propone el movimiento y se confirma | M |
| Abrir la ficha de un cliente (contrato, última conversación, cuotas, trabajo, curso) | ver_cliente_cs, ver_avance_curso_cs, cobranza_lead (crm) | parcial | herramienta, bloque | Tarjeta del cliente: etapa de la entrega, avance del curso, cuotas, próxima llamada y «Abrir ficha» | S |
| Mover a un cliente de etapa de la entrega (uno o en lote) y deshacer | null | no | herramienta, confirmacion, permiso | Confirmación «Ana → Onboarding (Mentoría) · arranca la secuencia X» | M |
| Marcar el estado de un cliente: activo, graduado, baja (con motivo) o pausado | marcar_estado_cliente_cs (chat) | parcial | herramienta |  | S |
| Dar de alta a un cliente (nombre, email, teléfono, programa) | null | no | herramienta, bloque | Tarjeta del cliente creado, con su programa y su etapa | S |
| Editar nombre, empresa, foto y portada del cliente | editar_contacto_lead (crm) para nombre y empresa; foto y portada: null | sin_verificar | herramienta |  | S |
| Quitar de un producto, sacar de la entrega y volver a ponerlo | quitar_lead_de_producto (crm); sacar de la entrega: null | sin_verificar | herramienta |  | S |
| Editar las etapas de la entrega; crear, renombrar o eliminar un servicio | null | no | herramienta, bloque | Editor de columnas de la entrega en el chat (agregar, renombrar, ordenar) | M |
| Ordenar a mano una columna y autoasignar el trabajo | null | no | herramienta |  | S |
| Ver los pagos de un cliente y cobrar una cuota | cobranza_lead (crm), crear_link_cuota (cobros), ver_pagos_clientes_agencia (cs) | parcial | herramienta, bloque | Cuotas del cliente con «Cobrar con link» | S |
| Exportar la lista de clientes | null | no | herramienta, bloque | Archivo CSV para bajar | S |
| Invitar al curso, reenviar la invitación, copiar el link o mandarlo por WhatsApp | invitar_cliente_curso_cs (chat) | no | herramienta, bloque | Estado del acceso (sin invitar / invitado / entró N veces / cortado) con Reenviar y Copiar link | S |
| Invitar alumnos en lote, a un alumno nuevo o a un lead de cualquier etapa | null | no | herramienta, bloque | Selector de alumnos con casillas y el curso elegido | M |
| Cortar o habilitar el acceso; sacarle un curso; acceso con vencimiento y corte automático por cuota impaga | null | no | herramienta, motor, confirmacion | Tarjeta del acceso con «Cortar» y su consecuencia: los links ya mandados dejan de abrir, también los de sus líderes | M |
| Permisos del alumno por módulo, abrir a mano un módulo o clase con candado, darle otro intento a un quiz | null | no | herramienta, bloque | Módulos del alumno con un interruptor cada uno | S |
| Líderes de área: invitar, copiar el link, cortar o habilitar | null | no | herramienta |  | S |
| Aprobar la tarea de un alumno y abrir lo que subió | null | no | herramienta, bloque | La respuesta de la tarea con sus archivos y «Aprobar» | S |
| Ver el avance del curso de un cliente o de toda la cartera | ver_avance_curso_cs | parcial | herramienta, bloque | Barra de avance por módulo, con tareas enviadas y faltantes | S |
| Agendar o borrar la próxima llamada de la entrega (avisos del día antes y del después) | null | no | herramienta |  | S |
| Classroom: crear, renombrar y ordenar módulos; crear, editar, mover, borrar y restaurar clases (título, video por link o embed, descripción, tareas); ver los cursos | crear_modulo_curso, renombrar_modulo_curso, ordenar_modulos_curso, crear_clase_curso, editar_clase_curso, mover_clase_curso, borrar_clase_curso, restaurar_clase_curso (SÓLO http); listar_cursos y ver_curso (también app) | no | herramienta, confirmacion, bloque | La estructura del curso como árbol (módulos › clases) con lo nuevo resaltado y «Vista del alumno» | M |
| Subir el video de una clase y sus adjuntos | null | no | herramienta, bloque | Subir un video o archivo en el chat y asignarlo a una clase | M |
| Editar las tareas, el quiz y los campos de una clase | editar_clase_curso (tareas; sólo http) | no | herramienta, bloque | Formulario de la tarea o el quiz con una vista previa | M |
| Vincular un módulo a una etapa de la entrega, borrar un módulo, candados por etapa o fecha | null | no | herramienta, permiso |  | S |
| Personalizar el programa: color, fuente, portada | null | no | herramienta, bloque | 3 combinaciones de color y fuente con la vista del portal, para elegir una | S |
| Ver el portal como lo ve el alumno | ver_curso (lectura) | parcial | herramienta, bloque | El portal del alumno en un iframe con «Abrir» | S |
| Armar o migrar un curso entero desde videos o desde otra plataforma (Skool, Panda) | las del área curso por HTTP (la puerta de la migración); por chat: null | no | herramienta, motor, bloque | Propuesta de módulos y clases para aprobar antes de crear nada | L |
| Comunidad: publicar, editar, borrar y fijar posts; comentar; encuestas; likes; cerrar comentarios; buscar | publicar_post_comunidad (pantalla) y el resto del área comunidad (SÓLO http) | no | herramienta, confirmacion, bloque | Vista previa del post como en el feed (categoría, adjunto, encuesta) con «Publicar» | M |
| Calendario de la comunidad: crear, editar y borrar eventos; exportar .ics | crear_evento_comunidad (pantalla), editar_evento_comunidad, borrar_evento_comunidad, ver_calendario_comunidad (SÓLO http) | no | herramienta, confirmacion, bloque | Tarjeta del evento (fecha, hora, zona, link) con «Crear» | S |
| Miembros, ranking, niveles, categorías, About y ajustes; sacar o admitir a un alumno | listar_miembros_comunidad, sacar_alumno_comunidad (pantalla), admitir_alumno_comunidad, ver_ranking_comunidad, nombrar_niveles_comunidad, crear/editar/borrar/ordenar_categoria_comunidad, editar_about_comunidad, ajustar_comunidad (SÓLO http) | no | herramienta, confirmacion |  | M |
| MaKo Partners: llevar un lead a Partners y ver los pagos de los clientes de la agencia | llevar_a_partners (chat), ver_clientes_partners, ver_pagos_clientes_agencia | parcial | herramienta |  | S |

## La inteligencia del chat de esta área

LA TRAMPA QUE MÁS PESA, medida con el turno real. La puerta no es la API, es el clasificador. ACCION_CUENTA_RE (lib/mako-intencion.ts:634) sólo conoce 18 verbos en voseo con tilde. Por eso caen en capturar (dudosa), con 2 herramientas del Plan y ninguna del área: «Pausa» y «Activa» en tuteo (Leila del ws11 y el ws13 son de México), «Duplicá», «Archivá», «Meté», «Inscribe», «Invitá», «Creá», «Agregá», «Publicá», «Enseñale», «Conectá», «Aprobá», «Exportá» y «Llevá». Hay tres trampas más:
- «prueba» está en SALUDOS, así que «Prueba la automatización» es un saludo.
- «Dale acceso al curso» se lee como «sí, dale» (charlar, 0 herramientas).
- Las regex de cs, curso y comunidad son angostas: «la clienta Ana», «el curso» o «¿qué cursos tengo?» no suman su área.
El diagnóstico obvio («faltan operaciones») era a medias: de los 44 pedidos con operación por la app, 27 no la reciben.

CHAT DE AUTOMATIONS
SABE Y LEE ANTES DE ACTUAR:
- Las automatizaciones del negocio con su CRON y su cohorte (listar_secuencias_nutricion y ficha_secuencia_mensajes). Sirve para no duplicar (#282 y #284 iban a la misma cohorte) y para resolver «la otra» (lib/mako-pedidos.ts: nunca la primera de una lista ambigua).
- Las etapas, funnels y productos (etapas_para_secuencia, listar_productos), las etiquetas (listar_etiquetas) y los medios conectados (estado_canal_whatsapp_chatbot, lib/medios-automatizacion.ts).
- El horario de oficina y la zona del negocio (lib/horario-envio.ts, zonaDelNegocio), los límites, la guía de voz (guia_voz_negocio) y la oferta y el avatar del Second Brain, para escribir los textos con la voz del negocio.
- La galería (listar_plantillas_automatizaciones), para sugerir una plantilla antes de inventar.
- Las reglas del motor que tiene que DECIR:
  - Por WhatsApp no oficial, un no-cliente recibe un borrador, no el mensaje.
  - Todo nace pausado.
  - Archivar cancela las inscripciones y esos leads no vuelven a entrar.
  - Un paso oficial necesita su plantilla de Meta aprobada.
  - Un Recurrente le llega UNA vez a cada lead y sale en la hora en punto siguiente.

PREGUNTA (una sola vez, con botones del catálogo, nunca inventa):
- Cuándo: un horario que viene en el pedido lo extrae el CÓDIGO y lo impone. Con «cada semana» sin día ni hora, pregunta «¿Qué día y a qué hora?». Caso del 20/10: MaKo cambió «martes 15:00» por la etapa «1ª sesión sin costo».
- A quién: «todo el funnel» con varios funnels → «¿Cuál?». Si la cohorte ya la cubre otra automatización activa → «Ya está "X" para Reactivación: ¿la reemplazo, la sumo o la dejo?».
- Una vez por persona o cada vez: mientras el motor no lo haga, lo avisa.
- Por dónde, si hay más de un medio conectado.
- Qué dice el mensaje, si no lo dio: propone el texto y lo muestra.
- Activarla ya o dejarla pausada.
- Cuál automatización, cuando dos calzan.

NUNCA:
- Cambia el CRON pedido por uno «parecido». Si no puede expresarlo, lo dice.
- Agrega tarjetas que no se pidieron («Avisar al equipo», «Si responde»: regla 8 de lib/flujo-ia.ts:3017).
- Activa, archiva, publica, prueba ni manda borradores sin la tarjeta de confirmación.
- Manda una prueba a un lead: sólo al dueño (Perfil).
- Dice «no salió» sin mirar los borradores pendientes y la próxima ocurrencia.
- Toca lo publicado directo: deja un borrador y la persona publica.
- Crea automatizaciones desde una automatización (desdeUnFlujo).
- Manda datos de leads a la red gratis (turnoParaLaRed).

REUSAR:
- Prompts de lib/prompt-registry.ts: chatbot.crear-ia.system, chatbot.editar-ia.system, chatbot.explicar-ia.system, automations.ai_step.armar, automations.ai_step.objeciones, automations.probar.lead, setting.gancho, setting.preguntas, setting.criterio, setting.simulador, setting.ensayo, chatbot.paso-ia, chatbot.guion-audio, nutri.voz.*, nutri.gen.*, chatagent.voz.*.
- Código:
  - lib/flujo-ia-crear.ts (crearFlujoConIA), lib/flujo-ia.ts (editar) y lib/flujo-ia-consulta.ts (explicar sin tocar).
  - lib/flujo-ia-preguntas.ts (preguntaAntes, aplicarRespuestas) y lib/automatizacion-chat.ts (PreguntaMako).
  - lib/disparadores.ts (textoDeDisparador, opcionesCronIA) y lib/cron-aviso.ts (textoCron, proximaOcurrencia).
  - lib/simulador-grafo.ts, lib/secuencia-borrador.ts, lib/mako-pedidos.ts y app/m/automations (la vista destilada).

CHAT DE CLIENTS
SABE Y LEE ANTES:
- Quién es cliente (un lead ganado: no hay tabla de clientes) y de qué programa.
- Su etapa de la entrega, que NO es su etapa del CRM.
- El contrato (lib/cs-contrato.ts), la señal de atención (lib/cs-senal.ts), el último contacto (lib/cs-cartera.ts) y las cuotas (cobranza_lead).
- Su acceso y su avance en el curso (ver_avance_curso_cs) y la estructura del curso (ver_curso).
- Qué secuencia arranca cada etapa de la entrega (lib/cs-mover-etapa.ts).

PREGUNTA:
- Qué programa, si el cliente está en más de uno.
- El email, si el CRM no lo tiene.
- El motivo de una baja.
- Si se corta todo el acceso o un solo curso.
- Fecha, hora y zona de la llamada.
- En un curso nuevo: el link o embed de cada video, el orden, y si el módulo va suelto o atado a una etapa.

NUNCA:
- Mueve a un cliente de etapa sin decir qué secuencia arranca.
- Corta un acceso sin confirmar: los links ya mandados dejan de abrir, también los de sus líderes.
- Confunde la etapa de la entrega con la del CRM.
- Afirma datos de contrato que nadie cargó, como «Semana 1» o «Sin cargar» (la poda del 26/09).
- Automatiza al 100% las respuestas del curso. Mauricio: «no quisiera automatizarlo al cien por ciento».
- Publica en la comunidad sin una vista previa.
- Manda datos de alumnos a la red gratis.

REUSAR:
- Prompts: curso.propuesta.system y curso.propuesta.user.
- Código: lib/curso-mensajes.ts (mandarLinkDelCurso), lib/curso-acceso.ts, lib/curso-invitar.ts, lib/cs-mover-etapa.ts, lib/cs-cartera.ts y lib/cs-senal.ts.
- Vistas destiladas: app/m/cs/CustomerSuccessM.tsx, app/m/curso/CursoM.tsx y app/m/comunidad/*.

## Bloques nuevos

- Tarjeta de la automatización: nombre, el CRON en una frase, las tarjetas en lista, estado con interruptor, «Probar» y «Abrir en el lienzo»
- Pregunta con 2 a 4 opciones del catálogo, «Elige tú» y «Otra cosa» (PreguntaMako)
- Antes y después del flujo, con «Publicar», «Dejar en borrador» y «Descartar»
- Selector «¿Qué la dispara?» y editor del horario Recurrente, con sus próximas 3 fechas y a quién va
- Simulador de Probar: teléfono o Gmail con el escenario elegido y «Mandármelo»
- Cola de borradores de una automatización: «Mandar todos», «Mandar», «Descartar»
- Diagnóstico de envío: borradores que esperan, próxima ocurrencia y cohortes que se pisan
- Editor del AI Step con un ensayo de 3 turnos
- Caso o hand-off editable, con el mensaje real del lead
- Grabador de nota de voz con el guion y un reproductor; subir audio, video o archivo a la biblioteca
- QR de WhatsApp que se refresca solo, y conectar Instagram o Messenger
- Horario de oficina y límites de envío, editables
- Lista de la cartera con el nivel de atención de cada cliente
- Tarjeta del cliente: etapa de la entrega, avance del curso, cuotas, próxima llamada
- Kanban de la entrega dentro del chat, con arrastre que propone
- Estado del acceso al curso: invitar, reenviar, cortar, habilitar, permisos por módulo
- Árbol del curso (módulos › clases) con la vista del alumno
- Vista previa de un post o evento de la comunidad
- 3 combinaciones de estilo del programa para elegir
- Selector de alumnos con casillas para invitar en lote
- Sub-chat «Automations › <nombre>» en el índice del Ops Center

## Decisiones para Martín (las de esta área)

- 1. ¿Se puede mover a un cliente de etapa de la entrega desde el chat? Hoy la API lo prohíbe a propósito, porque dispara la secuencia de entrega (WhatsApp). Propuesta: sí, con una confirmación que diga qué secuencia arranca.
- 2. Crear y editar automatizaciones corre SÓLO con la cascada gratis (Gemini y Groq: «NUNCA POR CLAUDE», lib/flujo-ia-crear.ts:13). Con lo decidido el 20/10 (cada cliente conecta su Claude o su GPT), ¿se usa la IA del cliente para crear y editar flujos?
- 3. «Todos los martes a todos»: ¿le llega a cada lead CADA martes, o una sola vez por lead? Hoy el motor hace lo segundo sin avisar. Propuesta: cada vez cuando el pedido dice «todos los martes», y una vez cuando dice «cuando entra».
- 4. Cuando la persona dice «y activala», ¿la automatización creada desde el chat se activa en el mismo «sí», o siempre nace pausada y se prende con una segunda confirmación?
- 5. Curso y comunidad hoy salen SÓLO por HTTP (decisión del 08/10: «por WhatsApp nadie arma un curso de cien clases»). ¿Se abren al Ops Center de la app (y no a WhatsApp)?
- 6. Acceso con vencimiento y corte por cuota impaga: ¿a los cuántos días de vencida se corta? ¿Avisa antes al alumno o sólo al equipo?
- 7. Los borradores que deja la regla anti-baneo (a un no-cliente por WhatsApp no oficial): ¿se pueden mandar todos juntos con un toque desde el chat, o uno por uno?

## Piezas, en orden

| Pieza | Hecho = | Depende de | Tam. |
|---|---|---|---|
| 1. Clasificador del área (lib/mako-intencion.ts). Suma los verbos en tuteo y voseo: pausa, activa, cambia (sin tilde); duplicar, archivar, inscribir y meter, sacar, invitar, crear, agregar, publicar, enseñar, probar, conectar, aprobar, cortar, exportar, llevar. «prueba» con objeto deja de ser saludo. «Dale acceso…» deja de ser un «sí». Las regex de cs, curso y comunidad se ensanchan: cliente o clienta, curso, acceso, alumno, módulo, clase, comunidad, post. Dueño: MaKo WhatsApp, con las frases que dan Automations y Clients. | Un test con las 63 frases de scratchpad/automations-clients-map/casos.json da que la operación esperada llega en al menos 40 de los 44 pedidos con operación por la app. Las frases en tuteo dan lo mismo que en voseo, y «hola», «test» y «prueba» solos siguen siendo saludos. | nada | M |
| 2. Crear con IA respeta el horario y crea sólo lo pedido. El código extrae el horario del pedido y lo impone como Recurrente; si falta el día o la hora, pregunta «¿Qué día y a qué hora?». «Todo el funnel» son todas las etapas del funnel elegido. Fuera la regla 8 como relleno. Avisa si la cohorte ya la cubre otra automatización. | El pedido de Leila (#284) crea un CRON Recurrente martes 15:00 en la zona del ws11, sobre las etapas del funnel principal, sin «Si responde» ni «Avisar al equipo». Hay un test con ese pedido literal y otro con «cada semana» sin hora, que pregunta. | nada | M |
| 3. Motor del Recurrente: sale a su minuto (el tick de cada minuto también inscribe por cohorte) y reinscribe en cada ocurrencia cuando se pidió «a todos cada vez». | Un test con reloj: un Recurrente semanal sobre 3 leads manda 6 mensajes en 2 semanas, a las 15:00 y no a las 16:00. Dos automatizaciones con la misma cohorte y el mismo texto dan un aviso. | 2 y la decisión 3 de Martín | M |
| 4. Operaciones nuevas de Automations en el registro (canal app, lib/api-mako/areas/chatbot.def.ts y .run.ts): - editar_automatizacion_con_ia: el motor de editar de lib/flujo-ia.ts, que guarda un BORRADOR en el server por lib/secuencia-borrador.ts; - publicar_cambios_automatizacion y descartar_cambios_automatizacion; - renombrar_automatizacion; - crear_automatizacion_vacia y pegar_flujo; - leer y cambiar el horario de envío y los límites; - estado_envio_automatizacion: borradores pendientes, próxima ocurrencia y cohortes que se pisan; - mandar_borradores_automatizacion; - armar_ai_step; - subir_audio_biblioteca. | Cada operación tiene def, run y test del registro. «Agregá una condición: si ya pagó, que no le mande nada» deja un borrador y devuelve el antes y el después. «Publicá los cambios» publica con los mismos frenos que PATCH /api/whatsapp/secuencias. «¿Por qué no salió?» nombra los borradores pendientes y la próxima ocurrencia. | 1 | L |
| 5. Confirmar adentro del chat: las 15 acciones del área chatbot que hoy mandan a /mako/revisar pasan a confirmarse en la tarjeta del hilo, con la consecuencia escrita. Son reabrir_onboarding_chatbot, guardar_estrategia_secuencia, editar_pasos_secuencia_mensajes, cambiar_crons_secuencia, agregar_escenario_secuencia, resolver_handoff, archivar_secuencia, probar_secuencia, guardar_link_video, crear_lead_magnet, borrar_audio, responder_huecos_voz, armar_secuencias_de_audios, destilar_voz y enviar_plantilla_meta_paso. | Desde el Ops Center, ninguna acción de Automations devuelve un link a /mako/revisar. Un test sobre el registro exige confirmacion 'chat', o una excepción con su porqué escrito. | la tarjeta de confirmación de Ops Center 3 (TarjetaAccion ya sirve para 'chat') | M |
| 6. Bloques de Automations en el Ops Center: tarjeta de la automatización con su interruptor, antes y después del borrador, pregunta con opciones, selector de CRON y horario con sus próximas fechas, simulador de Probar, cola de borradores, diagnóstico de envío y QR de WhatsApp. | Cada bloque se dibuja en el Ops Center del cliente, en la computadora y en el teléfono, desde el resultado de su operación. Reusa app/m/automations/AutomationsM.tsx y lib/simulador-grafo.ts. «Abrir en el lienzo» lleva a /automations?sec=<id>&mako=1. | el marco de bloques de Ops Center 3 (Bloque = markdown|imagen|pdf|html|creacion, docs/diseno-mako-ai-native.md) y la pieza 4 | L |
| 7. El chat de cada automatización en el Ops Center: proyectar `automatizacion.chat:*` en PROYECCIONES (lib/chat-mako-indice.ts), por workspace y con la puerta de la tab. El molde es Offer. | Una automatización con chat aparece como «Automations › <nombre>» en el Ops Center del cliente y su hilo se puede leer. Un setter sin la tab no la ve. Hay test de la proyección. | nada | S |
| 8. Operaciones de Clients por la app (cs.def.ts): - mover_cliente_entrega: pasa por moverClienteDeEtapa, y la tarjeta nombra la secuencia que arranca; - crear_cliente_cs; - cortar_acceso_curso y habilitar_acceso_curso; - alcance_curso; - aprobar_tarea_curso; - agendar_llamada_entrega; - invitar_alumnos, en lote; - exportar_clientes; - ver_kanban_entrega. | «Pasá a Ana a Onboarding de Mentoría», «Cortale el acceso a Pedro» y «Aprobá la tarea de Ana» proponen y se confirman en el chat. Cada operación tiene test del registro. Mover de etapa usa el mismo choke point que el kanban. | 1 y la decisión 1 de Martín | L |
| 9. Curso y comunidad por la app: abrir el canal 'app' de las escrituras del curso (8) y de la comunidad (hoy sólo http), confirmando en el chat. | «Creá un módulo Ventas en el curso de Mentoría» y «Publicá un post en la comunidad anunciando…» llegan, muestran su vista previa y se confirman sin salir del chat. | 1 y la decisión 5 de Martín | M |
| 10. Bloques de Clients: lista de la cartera, tarjeta del cliente, kanban de la entrega, estado del acceso, árbol del curso con la vista del alumno, y vista previa de post y evento. | Se dibujan en el Ops Center desde sus operaciones, reusando app/m/cs, app/m/curso y app/m/comunidad. Arrastrar en el kanban propone mover_cliente_entrega. | 8, 9 y el marco de bloques | L |
| 11. Motor del acceso con vencimiento y corte automático por cuota impaga. | Un acceso con fecha de vencimiento deja de abrir ese día. Una cuota vencida N días corta el acceso y avisa al equipo. Hay test con reloj. | la decisión 6 de Martín (el N) | M |
| 12. La inteligencia del área en el turno: lo que lee antes, lo que pregunta y lo que nunca hace, como receta del registro (recetasDelTurno) para chatbot y cs. | Un test con 6 pedidos ambiguos: horario sin día, «todo el funnel» con 2 funnels, «la de bienvenida» con 2 candidatas, una cohorte repetida, un cliente en 2 programas y una baja sin motivo. En los 6, MaKo pregunta una vez con opciones y no crea nada. | 1 | S |
