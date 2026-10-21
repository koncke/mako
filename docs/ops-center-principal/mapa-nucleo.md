# Mapa del Ops Center · nucleo

Parte de [docs/ops-center-principal.md](../ops-center-principal.md) (20/10/2026). Medido en sólo lectura sobre C:/dev/wt-push-q. Lo «sin_verificar» no se afirma.

**Chat responsable:** Ops Center 3: el marco de bloques, la confirmación adentro, «Abrir en la app», los sub-chats por área, proponer al entrar y el progreso. El clasificador (lib/mako-intencion.ts y doer-herramientas.ts) es de MaKo WhatsApp, coordinado con Ops Center 3, porque es el mismo para las dos puertas. Cada chat de área aporta el bloque de su tab y las operaciones que faltan: Video, Image, Ads, Automations.

**Tabs:**
- /second-brain (Ops Center del cliente: ChatSecondBrain.tsx sobre /api/mako/chat)
- /m/mako (el mismo turno en el teléfono)
- MaKo en WhatsApp (grupo; lib/mako-doer-in.ts): otra puerta del mismo clasificador
- /admin/operaciones (el Ops Center de Martín): sólo como fuente de piezas reusables (PreguntaChat, Trabajando, Avance, Visor, PlanJefe)
- /mako/revisar/[id] y /plan/revisar, /crm/revisar (adonde hoy sale a confirmar el 42%)

**Hoy:** 48 acciones · sí 12 · parcial 17 · no 18 · sin verificar 1.

## Acciones

| Acción | Operación de la API | Hoy | Falta | Bloque en el chat | Tam. |
|---|---|---|---|---|---|
| Abrir el Ops Center y ver la barra: el jefe «Second Brain» y sus sub-chats | — | si | nada |  | S |
| Nuevo chat (se crea con el primer mensaje) y buscar un chat | listar_chats_mako / hilo_chat_mako (lecturas, canal app) | si | nada |  | S |
| Mandar texto, pegar un texto largo (va solo a El Archivero si es admin) y dictar con el micrófono | — | si | nada |  | S |
| Adjuntar fotos y PDF | — | parcial | bloque | miniatura y visor del adjunto (Visor.tsx del Centro) también en lo que MaKo devuelve | S |
| Tocar un arranque («¿Qué hago hoy?», «¿Cómo viene el mes?», «¿Qué sabes de mi negocio?») | — | parcial | motor, bloque | «Propuestas al entrar»: 3 tarjetas con datos reales (plan atrasado, tabs sin configurar, lo pendiente, la fase), cada una con «Hacerlo» | M |
| Confirmar o cancelar una acción `chat` en la tarjeta del hilo | — | si | nada |  | S |
| Revisar y confirmar una propuesta `pantalla` (formulario, borrador del Plan, ficha nueva del CRM) | — | parcial | confirmacion, bloque | el formulario de /mako/revisar (RevisarAccion.tsx, armado desde `parametros`) desplegado adentro de la tarjeta, con «Confirmar» y «Abrir en la app» como salida secundaria | L |
| Ver lo que quedó hecho después de confirmar («Abrir en la app» de lo creado) | — | no | bloque | tarjeta «Creado» con miniatura, título y «Abrir en <editor>» (diseño, landing, guion, automatización, hoja) | M |
| Abrir una propuesta de edición de video o un borrador de WhatsApp que MaKo dejó | las 34 de video (pantalla '/video-editor') y crear_borrador_whatsapp_empresa (pantalla '/whatsapp') | no | bloque, confirmacion | fila «Propuesta en el editor» con «Abrir en el editor» | S |
| «Ir a …»: el link a la tab donde se hace lo pedido | — | si | nada |  | S |
| Leer los chats de «Antes» (/mako) y las conversaciones de Offer | — | si | nada |  | S |
| Leer el grupo «MaKo en WhatsApp» (admin) | — | parcial | motor |  | M |
| Ver los chats de las tabs (CRM y lead, Automations, Dashboard, Web Generator, Video, Image) en el Ops Center | — | no | motor |  | M |
| Sub-chat POR ÁREA que ya tiene sus herramientas («Web Generator › Landing webinar») | — | no | motor, herramienta |  | L |
| Mapa (el grafo del negocio) | — | si | nada |  | S |
| Ver «Lo que hizo» este chat | lo_que_hizo_chat_mako | parcial | bloque, herramienta | el riel «Lo que hizo» (rombos de Avance.tsx) con estado y «Abrir» | S |
| Renombrar un chat | renombrar_chat_mako | sin_verificar | nada |  | S |
| Avisarle al equipo de MaKo que algo no anda (ticket) | levantar_ticket | parcial | herramienta |  | S |
| Conectar su IA cuando MaKo no puede contestar | — | parcial | motor |  | L |
| Web: crear una landing («creame una landing…», «quiero una web para mi negocio») | generar_landing_con_ia (pantalla) / crear_landing_en_blanco (chat) | parcial | bloque, confirmacion | vista previa de la landing (iframe sandbox) con 3 variantes para elegir y «Abrir en el Web Generator» | M |
| Web: editar (cambiar un título, agregar una sección) | cambiar_texto_landing, agregar_seccion_landing, editar_landing_con_ia | parcial | bloque | antes/después de la sección tocada, con «Deshacer» y «Abrir en el editor» | M |
| Web: publicar, replicar una página de afuera | publicar_landing (pantalla), replicar_landing (chat, ~275 s) | parcial | confirmacion, bloque | progreso del trabajo largo y, al terminar, la miniatura con el link publicado | M |
| Video: editar (sacar muletillas, subtítulos, cortar 5 s) | eliminar_muletillas_video, generar_subtitulos_video, recortar_clip_video / cortar_tramo_video | no | herramienta, confirmacion, bloque | reproductor del video con la línea de tiempo y los cortes propuestos marcados (antes/después), con «Aceptar» y «Abrir en el editor» | L |
| Video: crear un anuncio con su avatar, ponerle música, clonar avatar y voz con fotos y audio | ninguna (no existe en el registro) | no | motor, herramienta, bloque | elegir guion, formato y avatar (3 opciones) y después el progreso del render | L |
| Imagen: crear un flyer o un diseño, cambiarle textos | crear_diseno_imagen, cambiar_textos_diseno_imagen (chat) | si | bloque | miniatura del diseño con «Abrir en Image Editor» y «Otra variante» | S |
| Contenido: «quiero un carrusel» | ninguna (no existe en el registro) | no | motor, herramienta, bloque | carrusel de N láminas con vista previa y «Abrir en Image Editor» | L |
| Contenido: escribir un guion de reel o de anuncio | sugerir_guion_anuncio (lectura) → escribir_guion_anuncio / escribir_guion_anuncio_auto | parcial | bloque | el guion como documento con 3 ganchos para elegir y «Guardar en Ads Writer» | M |
| WhatsApp: «mandale un WhatsApp a Juan diciendo que…» | crear_borrador_whatsapp_empresa (pantalla '/whatsapp') | no | herramienta, confirmacion, bloque | burbuja de WhatsApp con el texto editable, a quién va y «Mandar» | M |
| Chats: «¿quién me escribió hoy?», cerrar o posponer una conversación | listar_chats, cerrar_chat, posponer_chat | si | bloque | lista de conversaciones con el último mensaje y «Abrir en Chats» | S |
| Automations: crear una recurrente («todos los martes a las 3 mandale un recordatorio a todo el funnel») | crear_automatizacion_con_ia | no | herramienta, motor, bloque | pregunta con opciones (¿todo el funnel o una etapa? ¿qué mensaje? el horario en su zona) y después la vista del flujo para confirmar | M |
| Automations: crear por evento, editar un paso de una secuencia | crear_automatizacion_con_ia (chat), editar_pasos_secuencia_mensajes (pantalla) | parcial | confirmacion, bloque | mini lienzo del flujo (sólo lectura) con el paso cambiado resaltado | M |
| CRM: mover de etapa, marcar calificado, agendar una reunión | proponer_cambio_etapa, proponer_agendar_agenda | si | bloque | tarjeta del lead con su etapa y los próximos pasos | S |
| CRM: «mis 5 leads más calientes» | buscar_leads | no | herramienta, bloque | lista de 5 TarjetaKanban con «Abrir en el CRM» | S |
| Cobros: mandar un link de pago | crear_link_pago | si | bloque | tarjeta del cobro con monto, link copiable y estado | S |
| Ads: pausar una campaña, subir el presupuesto, cambiar el texto de un anuncio | proponer_estado_campana (chat), proponer_presupuesto_campana y proponer_editar_textos_anuncio (pantalla) | parcial | confirmacion |  | S |
| Ads: crear una campaña nueva en Meta | ninguna (no existe en el registro) | no | motor, herramienta |  | L |
| Email: mandar un mail a todos los leads | crear_broadcast (pantalla) | parcial | herramienta, confirmacion | vista previa del correo con a cuántos va y «Programar» o «Mandar prueba» | S |
| Dashboard y General: agregar un gráfico; «¿cómo viene el mes?» | agregar_grafico_dashboard, metricas_negocio | si | bloque | el gráfico dibujado en el hilo con «Abrir en el Dashboard» | M |
| General: cargar el valor de un KPI | registrar_valor_kpi | no | herramienta |  | S |
| Plan: anotar una tarea / cerrar una que ya hizo | proponer_tareas_plan; cerrar_tareas_plan | parcial | herramienta, bloque | la tarjeta de la tarea (PlanJefe.tsx: el círculo que se tilda) | S |
| Offer: «analizá mi oferta» | listar_analisis_oferta, ver_analisis_oferta (lecturas), guardar_oferta_analisis | parcial | motor, bloque | el PDF de Offer en el visor, con «Seguir en Offer» | M |
| Second Brain: «¿qué sabés de mi negocio?» y corregir un dato del perfil («mi negocio se llama…») | contexto_negocio, buscar_en_segundo_cerebro; guardar_campo_perfil (pantalla) | parcial | herramienta |  | S |
| Calendario: «programá un reel para el jueves» | crear_evento_calendario | no | herramienta |  | S |
| Equipo: invitar a alguien como setter | invitar_miembro_equipo (pantalla) | no | herramienta, confirmacion |  | S |
| Clients: marcar a un cliente «en riesgo» | marcar_estado_cliente_cs | no | herramienta |  | S |
| Experimentos: crear uno | crear_experimento (pantalla) | no | herramienta, confirmacion |  | S |
| Ver el avance de un trabajo largo (render, toma de Flow, replicar una landing) | — | no | motor, bloque | progreso con pasos (Trabajando.tsx del Centro) que se actualiza solo y termina en la tarjeta «Listo» con la vista previa | L |
| Elegir entre opciones cuando MaKo necesita un dato | — | no | bloque, herramienta | pregunta con opciones numeradas, la recomendada marcada y «Escribe otra cosa» (PreguntaChat.tsx) | M |

## La inteligencia del chat de esta área

LO QUE HOY DECIDE (medido): el turno de la app usa el clasificador del grupo de WhatsApp del dueño, cuyo default ante la duda es CAPTURAR (mako-intencion.ts:1227). En un chat que le habla a MaKo, ese default es el freno principal. Con 45 pedidos naturales, 17 caen en capturar (dudosa) con 2 herramientas (ver_plan y listar_pendientes). Las causas: verbos que no conoce (cortá, creá, cerrá, cargá, programá, invitá, editá, mandale, ponele, sacale) y, con la duda, doer-herramientas.ts:240 descarta las áreas que el texto sí nombra. Si se los fuerza a actuar, 9 de 13 recuperan su operación. Faltan además palabras de área («cliente en riesgo», «mi negocio se llama», «programá» con tilde, «todos los martes… a todo el funnel»), y el presupuesto de 12.000 caracteres corta la operación correcta: con «mandá un mail a todos» entra enviar_broadcast y queda afuera crear_broadcast.

QUÉ TIENE QUE SABER ANTES DE ACTUAR. El system ya trae, por buildSystemPrompt: el perfil, la fase, los objetivos (sólo el admin), la metodología (searchKnowledge; la memoria dice que el RAG cae sin crédito de OpenAI, sin verificar hoy), los experimentos, el funnel, la cara de marca, los hechos de MaKo y las tabs sin configurar. Lo que NO trae y debería leer por herramientas cuando el pedido lo toca: el análisis de Offer, los avatares, El Archivero y el Second Brain (buscar_en_segundo_cerebro, que es `lenta`). BUG verificado en mako-context.ts:100: a todo cliente le dice «NEGOCIO DE MARTÍN (perfil del cliente)». Siempre lee la ENTIDAD por id antes de proponer (el lead, la landing, la automatización, el proyecto de video), las pendientes vigentes del chat, los 12 mensajes del hilo y, en un sub-chat de área, los objetos de esa tab (objetosDeTab de /api/mako/pedidos, para «la otra»).

QUÉ PREGUNTA EN VEZ DE INVENTAR (con opciones, no con texto suelto): la cadencia y la hora en la zona del negocio; la audiencia («todo el funnel» o una etapa: el caso del 20/10); el canal (WhatsApp, Instagram, email); cuál objeto cuando hay más de uno; el producto (PREGUNTA_PRODUCTO, lib/mako-pedidos.ts); «¿la reunión o la tarea?»; el monto y el presupuesto. Pregunta UNA vez y sólo si el dato es decisivo (la regla de flujo-ia-preguntas.ts: preguntaAntes con tope de rondas). Lo que se contestó lo IMPONE el código (aplicarRespuestas), no se le pide al modelo.

QUÉ NO HACE NUNCA: ejecutar sin la tarjeta (alcance 'proponer'); escribir links o ids (los pone el código); inventar números, nombres o fechas; sumar pasos por defecto que nadie pidió (la regla 8 de chatbot.crear-ia.system); prometer sin haber corrido una herramienta (en la app el guardia está apagado: corrioHerramientas va true fijo en mako-turno-app.ts:520, y forzarTool del CONTRATO no se aplica); decir «vi tu Instagram» sin leerlo; contestar un pedido nuevo con material viejo; mandar datos de clientes a la red gratis (turnoParaLaRed); darle montos a un closer o setter (sinNumerosDelNegocio).

QUÉ REUSAR: lib/mako-intencion.ts (clasificarIntencion, CONTRATO, AREA_KEYWORDS); lib/doer-herramientas.ts; lib/mako-turno-app-reglas.ts (herramientasDelChat, linksDeUnaAccion, tarjetaDePendiente); lib/mako-pedidos.ts + lib/mako-pedidos-ia.ts («entender el pedido»: ya separa pedidos y resuelve área y operación, pero hoy sólo da links); lib/doer-recetas.ts; lib/flujo-ia-preguntas.ts; lib/agenda-sin-ia.ts; lib/respuesta-doer.ts y lib/doer-salida.ts; lib/mako-context.ts; lib/prompt-registry.ts (146 prompts: chatbot.crear-ia.system, landing_editor.*, video_editor.chat.system, image_editor.chat.system, dashboard.editar-ia.system…). Piezas de UI: app/_chat/{HiloMako,TarjetaAccion,ArchivosHilo}.tsx; app/admin/operaciones/{PreguntaChat,Trabajando,Avance,Visor,PlanJefe}.tsx; app/mako/revisar/[id]/RevisarAccion.tsx; chart_chats.bloques (mig 0305, hoy sólo adjuntos) para guardar los bloques.

PARA COSECHAR (no lo escribí: es sólo lectura): el clasificador y el turno van en docs/hallazgos-ia.md, porque el código vive en lib/mako-intencion.ts y lib/doer-herramientas.ts. El hilo, la confirmación y el «Abrir» van en docs/hallazgos-second-brain.md.

## Bloques nuevos

- Creación: miniatura, título y «Abrir en <editor>» para lo que MaKo creó o cambió (diseño, landing, guion, automatización, hoja)
- Vista previa de landing en iframe sandbox con 3 variantes para elegir y «Abrir en el Web Generator»
- Reproductor de video con la línea de tiempo, los cortes y subtítulos propuestos (antes/después), «Aceptar» y «Abrir en el editor»
- Elegir entre 3: variantes de copy, diseño, gancho o landing; la elegida sigue el flujo
- Pregunta con opciones (PreguntaChat.tsx) para un dato decisivo que falta: cadencia, audiencia, canal, producto, cuál objeto
- Formulario de confirmación inline (el de /mako/revisar desde `parametros`) adentro de la tarjeta
- Trabajo largo: progreso con pasos (Trabajando.tsx) que termina en «Listo» con la vista previa
- Burbuja de WhatsApp o correo con el texto editable, el destinatario y «Mandar» o «Programar»
- Tarjeta de lead (etapa, próximos pasos) y la lista «tus 5 leads calientes» con TarjetaKanban
- Gráfico del Dashboard dibujado en el hilo con «Abrir en el Dashboard»
- Visor de PDF (Offer, El Archivero)
- Mini lienzo de una automatización (sólo lectura) con el paso cambiado resaltado
- Propuestas al entrar: 3 tarjetas con datos del negocio
- Riel «Lo que hizo» del chat (rombos de Avance.tsx) con estado y «Abrir»

## Decisiones para Martín (las de esta área)

- Dónde corre el Claude o GPT de cada cliente: su computadora, un servidor de MaKo o las routines de su nube. Sin eso, el Ops Center no contesta a quien no conectó una API key.
- En el chat de la app, ante la duda, ¿MaKo PROPONE la acción con tarjeta en vez de «anotarla»? Recomendado: sí en la app (nada se ejecuta sin el toque) y sin cambios en el grupo de WhatsApp, donde el dueño vuelca ideas.
- Editar videos desde el Ops Center: hoy una edición sólo se acepta en el editor del navegador donde vive el proyecto. ¿Se mudan los proyectos a MaKo para aceptarla en el chat, o alcanza con «Abrir en el editor»?
- Lo que no tiene operación en la API (crear una campaña en Meta, carrusel, generar un video con avatar, clonar avatar y voz con fotos y audio): ¿entra en esta ola o va después del lanzamiento?
- Los sub-chats por área: ¿los crea MaKo solo cuando detecta el área de un pedido, o hay uno fijo por cada tab que el cliente usa?
- MaKo por WhatsApp 1 a 1 con su número: hoy contesta sólo en grupos. ¿Se habilita como puerta del Ops Center?
- La Gemini gratis con datos de clientes (sigue abierto en el debate del 20/10): ¿se corta, o se le pide al cliente su Claude?

## Piezas, en orden

| Pieza | Hecho = | Depende de | Tam. |
|---|---|---|---|
| 0. Test guardián del ruteo: la batería de 45 pedidos naturales (la de medir-ruteo.ts) como tests/ops-center-ruteo.test.ts, contra herramientasDelChat y herramientasDelTurno | El test existe y hoy marca 23 de 45 con la operación esperada. Cada pieza que sigue sube el piso del test, y romper un verbo a propósito lo hace caer |  | S |
| 1. Clasificador por canal: en la app (Ops Center y /m/mako) el default deja de ser capturar dudoso. Un pedido sin señal clara va como actuar, con las áreas del texto (en la app una escritura sólo PROPONE una tarjeta). Se suman los verbos de voseo y tuteo que faltan (cortá, creá, cerrá, cargá, programá, invitá, editá, mandale, ponele, sacale, crea, edita) y las palabras de área (cs «cliente(s) en riesgo», negocio «mi negocio se llama|nombre del negocio», calendario con tilde, chatbot «todos los <día> a las|cada semana|recordatorio a todo»). El grupo de WhatsApp conserva su default | La batería pasa de 23 a 40 o más de 45 (los 5 pedidos sin operación no cuentan). tests/agenda-whatsapp y mako-turno-app siguen verdes, y WhatsApp sigue en capturar con un volcado «Idea: …» | 0 | M |
| 2. La operación que resuelve «entender el pedido» entra al turno: mako-pedidos (partirPedidos + operacionPara) corre en el servidor adentro de turnoApp, y su operación va como `ids` obligatorios ANTES del presupuesto. El corte por presupuesto deja de ser sólo un console.warn: el turno sabe qué quedó afuera y lo puede pedir | Ningún pedido de la batería pierde su operación por el presupuesto, y «mandá un mail a todos mis leads» → «sí» trae crear_broadcast | 1 | M |
| 3. Marco de bloques en el hilo: ItemHilo suma {k:'bloque'} con los tipos creacion, imagen, landing (iframe sandbox), video, grafico, kanban, pdf, opciones y trabajo. Una operación devuelve `datos.bloque` (el contrato va en lib/api-mako/tipos.ts), el turno lo pasa en RespuestaTurno.bloques y se guarda en chart_chats.bloques | Confirmar crear_diseno_imagen dibuja su miniatura sin recargar, y un test dibuja cada tipo en node (el molde de Hilo.tsx) |  | L |
| 4. «Abrir en la app» de lo hecho y de lo propuesto: linksDeUnaAccion captura también los links de /video-editor?propuesta= y /whatsapp y el `datos.link` de una acción confirmada. ResultadoTarjeta trae `abrir:{titulo,href}`, y la tarjeta lo muestra como botón | Una edición de video pedida en el Ops Center deja «Abrir en el editor». Confirmar un diseño deja «Abrir en Image Editor» en la misma sesión | 3 | S |
| 5. Preguntar con opciones: PreguntaChat.tsx como bloque `opciones` para el cliente, más una herramienta de control preguntar_al_usuario (canal app) que el modelo llama cuando le falta un dato decisivo. La respuesta vuelve como mensaje y la impone el código (el molde de flujo-ia-preguntas) | Con «todos los martes a las 3 a todo el funnel», MaKo pregunta (¿todo el funnel o una etapa?, ¿qué mensaje?) y no propone nada hasta tenerlo | 3 | M |
| 6. Confirmar adentro del chat: el formulario de /mako/revisar (RevisarAccion.tsx, desde `parametros`) se despliega en la tarjeta para las 121 acciones genéricas. Las de pantalla propia (plan y crm revisar) van con vista previa y «Abrir» | El porcentaje de acciones que mandan a confirmar afuera baja del 42% (148 de 350) a menos del 10%. Un test cuenta las `pantalla` que no tienen bloque inline | 3 | L |
| 7. Progreso de trabajos largos: la confirmación de una operación `lenta` encola y vuelve enseguida, y el bloque `trabajo` (Trabajando.tsx) consulta su estado (flow_trabajos, la cola de replicar, el render) hasta «Listo» con la vista previa | Confirmar replicar_landing vuelve en menos de 5 s (hoy ~275 s con la ruta bloqueada), y el hilo muestra el avance y el resultado sin recargar | 3 | L |
| 8. Sub-chats por área: jefeDeClave y las proyecciones de CRM (:crm:, :lead:), Automations y Dashboard en PROYECCIONES. Un sub-chat de área FIJA sus áreas en el turno (FiltroTools por área o clave), además de las del texto | En «Web Generator › Landing webinar», «cambiá el título» trae cambiar_texto_landing sin nombrar la landing, y los chats de CRM y Automations aparecen en la barra | 1 | L |
| 9. Proponer al entrar: con el jefe vacío o al volver después de N horas, el CÓDIGO arma 3 propuestas con lecturas que ya existen (ver_plan, listar_tabs_por_configurar, listar_pendientes, ver_diagnostico_fase), sin gastar IA, como bloque opciones | Un cliente nuevo entra y ve «vi que tu negocio es X: ¿empezamos con A, B o C?» con sus datos reales; elegir una manda el pedido | 5 | M |
| 10. El contexto y el guardia de promesas: «NEGOCIO DE MARTÍN» pasa a «EL NEGOCIO»; en la app, sanearSalida recibe si de verdad corrió alguna herramienta, y se aplica forzarTool del CONTRATO | Un test: el system de un workspace distinto del 1 no nombra a Martín, y «Listo, ya lo armé» sin herramienta sale con SIN_HACER |  | S |
| 11. La IA del cliente: desplegar 25f9bbca6 (el Claude del negocio por API key en la cascada, hoy sólo en la rama ticketera) y que el botón «Conectar» abra la IA que eligió. Después, la suscripción de Claude o GPT según dónde decida Martín que corre | Un negocio con sólo su Claude conectado recibe respuesta con herramientas en el Ops Center (hoy 0 llamadas con la key de un negocio) |  | L |
| 12. WhatsApp como otra puerta del mismo cerebro: la batería también corre con canal whatsapp, una pendiente propuesta en el grupo se ve y se confirma en el Ops Center, y el grupo deja de ser sólo lectura para el admin | Pedir algo en el grupo y confirmarlo en el Ops Center (o al revés) deja una sola pendiente y la misma respuesta en los dos hilos | 1 | M |
