# Mapa del Ops Center · web-ads

Parte de [docs/ops-center-principal.md](../ops-center-principal.md) (20/10/2026). Medido en sólo lectura sobre C:/dev/wt-push-q. Lo «sin_verificar» no se afirma.

**Chat responsable:** Web Generator (jefe de las landings: operaciones, frases de esPedidoDeLanding, bloques de landing) y Ads Manager (jefe de Meta: esPedidoDeAds, activación en cascada, crear campaña, crear conjunto, subir creativos). Lo transversal lo hace Ops Center 3: el clasificador del chat de la app sin el default «capturar», la confirmación adentro del chat de las operaciones 'pantalla', los trabajos largos y el tipo de bloque nuevo en ItemHilo. Los guiones (Ads Writer y Ads Analyst) van con el jefe de Ads Writer, si existe (sin verificar).

**Tabs:**
- Web Generator (/web-generator: Panel, Plantillas, Temas, Papelera, Crear con IA, Replicar, Editor, Diagnóstico /web-generator/analizar)
- Ads Manager (/ads-manager y /ads-manager/[adId])
- Ads Writer (/ads-writer: Anuncios, Guiones, Analizar guion)
- Ads Analyst (hoy hoja «Ads Analyst» del Dashboard; /ads-analyst redirige)

**Hoy:** 82 acciones · sí 26 · parcial 27 · no 28 · sin verificar 1.

## Acciones

| Acción | Operación de la API | Hoy | Falta | Bloque en el chat | Tam. |
|---|---|---|---|---|---|
| WG · Ver mis landings y presentaciones (Panel, con miniatura, estado y búsqueda por nombre) | listar_landings_creadas (+ ver_landing_creada) | si | bloque | Lista de tarjetas de landing: miniatura (reusa app/web-generator/MiniaturaLanding.tsx), estado borrador/publicada/pausada, dirección y «Abrir en el editor» | S |
| WG · Crear con IA desde una idea (Generar) | generar_landing_con_ia | parcial | confirmacion, bloque, herramienta | Chips de objetivo/producto + elegir tema entre 3 + progreso de la generación + tarjeta de la landing creada con «Abrir en el editor» | M |
| WG · Crear con IA desde un texto pegado o un archivo (Pegar / Importar archivo) | generar_landing_con_ia (texto, modoTexto) | parcial | confirmacion, bloque | 3 chips para el texto: de guía / resumido / tal cual (modoTexto generar, condensar, conservar) | S |
| WG · Revisar y editar el esquema (secciones) antes de generar | null | no | herramienta, bloque | Esquema editable en el hilo: título y puntos por sección, reordenar, sacar, agregar y «Generar» (reusa crear/EditorEsquema.tsx) | M |
| WG · Crear desde un diseño (Plantillas) con su objetivo | crear_landing_desde_diseno (+ listar_disenos_landing) | si | bloque | Elegir entre 3 diseños con miniatura (8 de 9 con video) | S |
| WG · Crear en blanco con un tema (Temas) | crear_landing_en_blanco | si | bloque | Grilla de temas con vista previa | S |
| WG · Crear una presentación desde una plantilla | crear_presentacion_desde_plantilla | si | bloque | Miniaturas de las plantillas de presentación | S |
| WG · Replicar una página de afuera (Presentación / Landing / Página idéntica, copiando el estilo) | replicar_landing | parcial | bloque | Elegir formato entre 3 + progreso (~275 s) + tarjeta de la copia | M |
| WG · Analizar una página de afuera (Diagnóstico) | analizar_landing (+ ver_diagnostico_landing, listar_analisis_landing) | parcial | bloque | Puntaje + hallazgos con citas y «Crear una mejor» (generar_landing_con_ia con basadaEn) | M |
| WG · Renombrar una landing | renombrar_landing | si | nada |  | S |
| WG · Duplicar una landing | duplicar_landing | si | nada |  | S |
| WG · Mandar a la papelera / restaurar | mandar_landing_a_papelera | parcial | herramienta |  | S |
| WG · Eliminar para siempre (desde la papelera) | borrar_landing_creada | parcial | confirmacion | Tarjeta con «No se puede deshacer» confirmada adentro del chat | S |
| WG · Pausar / reanudar el sitio publicado | pausar_landing | si | nada |  | S |
| WG · Cambiar un texto exacto (titular, párrafo) | cambiar_texto_landing (+ ver_secciones_landing) | si | bloque | Antes/después de la sección con «Deshacer» (restaurar_version_landing; reusa editor/diff-tarjetas.ts) | S |
| WG · Editar con IA (agente del editor: más corta, traducir, más directa, mejorar los textos) | editar_landing_con_ia | parcial | herramienta, confirmacion, bloque | Diff de la sección con «Aceptar / Descartar», como PanelAgente | M |
| WG · Ver 3 diseños alternativos de una sección y elegir uno | null | no | herramienta, bloque | Elegir entre 3 miniaturas de la sección | M |
| WG · Agregar una sección | agregar_seccion_landing | si | bloque | Antes/después con «Deshacer» | S |
| WG · Mover, ocultar o borrar una sección | acomodar_seccion_landing | si | nada |  | S |
| WG · Estilo de una sección (fondo, imagen de acento, ancho, alto, alineación, notas del orador) | configurar_seccion_landing | no | herramienta |  | S |
| WG · Agregar un bloque (imagen, video, botones, formulario, agenda, gráfico, HTML) | agregar_bloque_landing | si | nada |  | S |
| WG · Mover o borrar un bloque | acomodar_bloque_landing | parcial | herramienta |  | S |
| WG · Poner el link del VSL o de la agenda | poner_enlace_landing | si | nada |  | S |
| WG · Formulario (campos y destino) | configurar_formulario_landing | no | herramienta |  | S |
| WG · Botón (texto, destino, estilo) | configurar_boton_landing | si | nada |  | S |
| WG · Botón de pago: qué cobra / dejar de cobrar | cobrar_producto_landing, quitar_cobro_landing, ver_cobro_landing | parcial | herramienta, confirmacion, bloque | Elegir el producto del catálogo (con su precio) y la pasarela conectada | S |
| WG · Páginas del sitio (página de gracias, ordenar, inicio) | acomodar_pagina_landing | si | nada |  | S |
| WG · Cambiar el tema | cambiar_tema_landing (+ listar_temas_landing) | si | bloque | Elegir entre 3 temas con vista previa | S |
| WG · Crear, editar o borrar un tema propio | guardar_tema_landing, borrar_tema_landing | si | bloque | Paleta y fuentes con vista previa | S |
| WG · Animaciones y efectos | cambiar_animacion_landing | si | bloque | Vista previa animada de la sección | S |
| WG · Configuración (título en Google, descripción, favicon, idioma) | configurar_landing | si | nada |  | S |
| WG · Ajustes del sitio (Píxel de Meta y demás) | configurar_sitio_landing | parcial | confirmacion |  | S |
| WG · Barra de navegación y pie | configurar_navegacion_landing | no | herramienta |  | S |
| WG · Buscar fotos de uso libre o elegir de la biblioteca | buscar_fotos_landing, listar_imagenes_landing | parcial | bloque | Grilla de fotos para tocar y poner en la sección | S |
| WG · Subir una imagen o un video propio a la landing | null | no | herramienta, motor, bloque | Adjunto del chat con «Usar en la landing» y el lugar | M |
| WG · Historial: ver versiones, volver a una, deshacer, guardar una a mano | listar_versiones_landing, restaurar_version_landing, guardar_version_landing | no | herramienta, bloque | Línea de versiones con fecha y «Volver a esta» | S |
| WG · Comentarios del equipo: leer, comentar, resolver | listar_comentarios_equipo_landing, resolver_comentario_equipo_landing (comentar y borrar: null) | parcial | herramienta |  | S |
| WG · Link privado del borrador para compartir | compartir_borrador_landing | no | herramienta, bloque | Link con «Copiar» | S |
| WG · Exportar (PDF, PNG, PPTX, HTML) | null | no | herramienta, bloque | Archivo para descargar en el hilo | M |
| WG · Presentar (modo presentación) | null | no | bloque | «Presentar» que abre la vista a pantalla completa | S |
| WG · Publicar con su dirección | revisar_direccion_landing + publicar_landing | parcial | confirmacion, bloque | Dirección libre/ocupada, «Publicar» y el link público con «Copiar» y «Abrir» | S |
| WG · Despublicar | despublicar_landing | si | nada |  | S |
| WG · Conectar un dominio propio | conectar_dominio_landing (+ ver_dominio_landing) | parcial | confirmacion, bloque | Tabla de registros DNS con «Copiar» y el estado (pendiente, verificado, www) | M |
| WG · Verificar o quitar el dominio | verificar_dominio_landing, quitar_dominio_landing | parcial | herramienta |  | S |
| WG · Analítica de una landing (visitas, leads, conversión) | ver_analitica_landing | si | bloque | Mini gráfico de visitas y leads por día | S |
| WG · Pagos rechazados de una landing | ver_rechazos_pago_landing | si | nada |  | S |
| WG · Comportamiento medido y mapa de calor | ver_comportamiento_landing | parcial | bloque | Mapa de calor sobre la captura (reusa app/landing-analyst/MapaDeCalor.tsx) y curva de scroll | M |
| WG · Diagnóstico de una landing nuestra (evaluador) | diagnosticar_landing_creada (+ listar_comentarios_landing) | parcial | confirmacion, bloque | Lista de comentarios con «Aplicar» y «Deshacer» cada uno (reusa diagnostico/PanelDiagnostico.tsx) | M |
| WG · Aplicar un comentario del diagnóstico o todos | aplicar_comentario_landing, aplicar_todos_comentarios_landing | no | herramienta, confirmacion, bloque | El mismo de la lista de comentarios, con «Aplicar todos» | M |
| WG · Pasar comentarios a la copia / marcarlos / importar un borrador viejo | pasar_comentarios_a_copia_landing, cambiar_estado_comentario_landing, importar_borrador_landing | sin_verificar |  |  | S |
| AM · Ver campañas, conjuntos y anuncios con estado y métricas (fechas, filtro de estado, columnas) | ver_estado_meta, listar_conjuntos_meta, listar_anuncios_meta, listar_campanas_meta | si | bloque | Tabla compacta por nivel con semáforo, gasto, resultados, coste por resultado y presupuesto, con rango de fechas, toggle y «Abrir en Ads Manager» | M |
| AM · Rendimiento por anuncio (CPL, leads de Meta contra CRM, cierres, cash) | ver_rendimiento_anuncios | si | bloque | Ranking de anuncios con barras y la fuga Meta→CRM | S |
| AM · Detalle de una campaña o un conjunto por día (gráfico) | null | no | herramienta, bloque | Gráfico diario de gasto, leads y agendas de la entidad | S |
| AM · Pausar o activar una campaña | proponer_estado_campana | parcial | herramienta, motor, bloque | Toggle en la fila de la tabla que deja la tarjeta de confirmar | S |
| AM · Pausar o activar un conjunto o un anuncio | proponer_estado_conjunto, proponer_estado_anuncio | parcial | herramienta, motor |  | S |
| AM · Cambiar el presupuesto de una campaña o un conjunto | proponer_presupuesto_campana, proponer_presupuesto_conjunto | no | herramienta, confirmacion, bloque | Monto actual → nuevo en la moneda de la cuenta (y su equivalente en USD), diario, con «Confirmar» | M |
| AM · Renombrar una campaña, un conjunto o un anuncio | proponer_renombrar_campana, proponer_renombrar_entidad_meta | parcial | herramienta |  | S |
| AM · Renombrar en lote con la nomenclatura (001 / 001.01 / a) y MaKo | null | no | herramienta, bloque | Lista de nombres actual → nuevo con «Aplicar todos» | M |
| AM · Eliminar entidades pausadas | proponer_eliminar_entidad_meta | parcial | herramienta, confirmacion |  | S |
| AM · Asignar el funnel (producto) a una campaña o conjunto | asignar_campana_funnels (área crm) | si | nada |  | S |
| AM · Editar los textos de un anuncio | proponer_editar_textos_anuncio (+ ver_textos_anuncio_meta) | parcial | herramienta, confirmacion, bloque | Vista previa del anuncio con los textos editables en línea y «Guardar» (crea un creativo nuevo y vuelve a revisión) | M |
| AM · Editar el público de un conjunto (lugares, edad, intereses) | proponer_editar_publico_conjunto (+ buscar_lugares_meta, buscar_intereses_meta, ver_publico_conjunto_meta) | no | herramienta, confirmacion, bloque | Selector de lugar con el alcance de Meta en vivo (reusa LugarPicker.tsx) e intereses | M |
| AM · Agregar un conjunto a una campaña | null | no | herramienta, bloque | Lugar, público y presupuesto del conjunto, con «Crear en pausa» | M |
| AM · Agregar un anuncio a un conjunto (reusar un ganador o una media ya subida) | proponer_agregar_anuncio | no | herramienta, motor, confirmacion, bloque | Vista previa del anuncio + destino (formulario o landing) + «Crear en pausa» | M |
| AM · Subir creativos (imagen o video) a Meta | null | no | herramienta, motor, bloque | Adjuntar foto o video en el chat con el progreso de la subida y del procesado de Meta | M |
| AM · Subir creativos a una campaña existente (campaña → conjunto → creativos → destino → copy de MaKo → revisión → lote en pausa) | null | no | herramienta, motor, bloque, confirmacion | Las mismas preguntas del modo «existente» del NuevaCampanaModal, una por bloque, y la revisión del lote | M |
| AM · Nueva campaña con MaKo (creativos, inversión en USD, objetivo, lugar, estrategia, público, ubicaciones, destino, copy, revisión, crear en pausa) | null | no | herramienta, bloque, confirmacion | Una pregunta por bloque en el hilo (las del NuevaCampanaModal), resumen vivo y revisión con «Crear en pausa» | L |
| AM · MaKo mira los creativos (visión) para la estrategia y el copy | null | no | herramienta |  | M |
| AM · Vista previa del anuncio como sale en Facebook/Instagram | null | no | herramienta, bloque | Vista previa del anuncio por ubicación | S |
| AM · Analizar con Meta (recomendaciones) | listar_recomendaciones_meta | parcial | herramienta, bloque | Lista de recomendaciones con su acción propuesta | S |
| AM · Anuncios rechazados o retenidos, por qué, y aprobar en Meta | listar_anuncios_con_problemas_meta, verificar_aprobacion_meta | si | bloque | Tarjeta del problema en español (explicarIssueEs) con «Aprobar en Meta ↗» (linkAprobarEnMeta) y «Editar textos» | S |
| AM · Salud de la cuenta (pago, deshabilitada, entrega frenada) | ver_salud_cuenta_meta, ver_estado_meta | parcial | herramienta |  | S |
| AM · Crear un público de retargeting | proponer_crear_publico_meta | no | herramienta, confirmacion |  | S |
| AM · Crear un formulario instantáneo | proponer_crear_formulario_meta (+ ver_base_formulario_meta) | no | herramienta, confirmacion, bloque | Formulario con sus preguntas y vista previa | M |
| AM · Ver públicos, formularios, píxeles, eventos y conversiones | listar_publicos_meta, listar_formularios_meta, listar_pixeles_meta, listar_eventos_pixel_meta, listar_conversiones_meta | parcial | herramienta |  | S |
| AM · Buscar intereses y lugares para segmentar | buscar_intereses_meta, buscar_lugares_meta | no | herramienta |  | S |
| AM · Qué anuncios ganadores se pueden reusar | verificar_ganadores_reusables | si | nada |  | S |
| AM · Usar un video de MaKo (Video Generator) como creativo | null | no | herramienta |  | S |
| AA · Qué guiones, ángulos y ganchos rinden (cuadrante gancho contra retención) | listar_guiones_analizados, ver_perfil_guiones, ver_cuadrante_retencion | parcial | herramienta, bloque | Cuadrante gancho contra retención | S |
| AA · Analizar los guiones nuevos, reanalizar, corregir ángulo o avatar | proponer_sincronizar_guiones, proponer_reanalizar_guion, proponer_corregir_angulo_guion, proponer_corregir_avatar_guion | no | herramienta |  | S |
| AW · Valorar un guion que no corrió (Analizar guion) | valorar_guion_nuevo | no | herramienta, bloque | Tarjeta de valoración (reusa app/ads-writer/ValoracionGuion.tsx) | S |
| AW · Escribir un guion de anuncio con MaKo | escribir_guion_anuncio_auto, escribir_guion_anuncio, sugerir_guion_anuncio | parcial | herramienta, bloque | Tarjeta del guion con su valoración y «Llevar al Video Generator» | M |

## La inteligencia del chat de esta área

LO MEDIDO (20/10, con el turno que corre: clasificarIntencion + herramientasDelChat, vista del chat de la app, admin de un negocio Completo). Las acciones de Meta que escriben, dichas en tuteo («pausa», «sube», «crea», «cambia», «elimina», «renombra», «ponle», «súbele»), llegan con su herramienta en 0 de 18 frases. En voseo con tilde llegan 7 de 13. La causa: ACCION_CUENTA_RE (lib/mako-intencion.ts) sólo conoce el voseo con tilde, y el default del clasificador es «capturar» (dudosa), con ver_plan y listar_pendientes y nada de Meta. Las landings tienen su propio detector (esPedidoDeLanding) y llegan en 10 de 19 frases en tuteo. Confirman fuera del chat 8 de las 13 acciones de Meta y 14 de las 53 del área landing. Lo que se confirma en /mako/revisar no vuelve al hilo.

WEB GENERATOR. QUÉ LEE ANTES DE ACTUAR:
(1) Lo que ya existe: listar_landings_creadas, para no duplicar y para resolver «la del webinar». Para editar, ver_secciones_landing (los ids). El modelo nunca escribe el JSON del editor.
(2) El negocio: oferta, producto y precio (Offer y el catálogo); el avatar y la voz (listar_avatares_negocio, ver_personalidad_voz, del área negocio: hoy sólo viajan si el mensaje dice oferta, avatar o producto); el funnel (ver_funnel), que decide el objetivo y el CTA: agendar, vender, registrar o descargar.
(3) Las integraciones que usa la landing: el link de agenda, la pasarela y los productos del botón de pago (ver_cobro_landing), y el Pixel.
(4) Lo medido: listar_analisis_landing (para «basadaEn»), ver_analitica_landing, ver_comportamiento_landing. El número lo da el código, y «no medido» nunca es 0.

QUÉ PREGUNTA EN VEZ DE INVENTAR (una pregunta, con opciones en botones):
- Para qué producto, si hay más de uno (productoDelPedido, lib/mako-pedidos.ts). Con un solo producto y «mi otro producto» hoy crea sobre el principal: tiene que preguntar en texto libre.
- El objetivo, si el funnel no lo deja claro.
- Si el texto pegado va de guía, resumido o tal cual.
- Cuál landing, si el nombre coincide con dos. Nunca la primera de la lista.
- La dirección y el dominio exactos al publicar (antes, revisar_direccion_landing).
- Qué producto y qué precio cobra el botón: del catálogo, nunca inventado.
- Si publica ya o queda en borrador.

ADS. QUÉ LEE ANTES DE ACTUAR:
- ver_cuenta_meta: la MONEDA de la cuenta. El ws13 cobra en USD; todo *_mxn es en realidad la moneda de la cuenta; la inversión se piensa en USD y se convierte con usdACuenta.
- ver_salud_cuenta_meta y ver_estado_meta: pago, entrega, ids y estado efectivo en vivo. listar_campanas_meta sólo trae las campañas que gastaron en 30 días.
- verificar_aprobacion_meta: el 2446984 es «peer approval», no un rechazo, y no hay API para aprobar. Se manda a «Aprobar en Meta ↗».
- El funnel: el objetivo sale del funnel_config.
- El Pixel y sus eventos ACTIVOS (listar_eventos_pixel_meta): optimizar por un evento inactivo arruina la entrega.
- Los públicos y formularios que ya hay, para no duplicar.
- verificar_ganadores_reusables y ver_rendimiento_anuncios (leads de Meta contra los del CRM).
- La landing de destino publicada (listar_landings_creadas).
- gating.integracion 'meta' es sólo documentación (lib/api-mako/docs.ts): las herramientas viajan aunque Meta no esté conectada, y fallan al correr. El chat tiene que mirar antes si está conectada y, si no, decirlo.

QUÉ PREGUNTA:
- El monto, la moneda y si es diario o total.
- Si es la campaña o el conjunto (CBO o ABO) y CUÁL, cuando dos se parecen.
- El lugar (país o ciudad, con el alcance de Meta), el objetivo y el destino (formulario, landing o WhatsApp), los creativos, el público (frío, retargeting o intereses) y las fechas.
- El caso del 20/10: «todos los martes a las 3 a todo el funnel». MaKo eligió la etapa de nombre parecido, mandó a una sola y perdió «martes 15:00» sin avisar. Acá el mismo caso es «subile 50 a la de captación los lunes» o «pausá los anuncios con CPL arriba de 10». La API no programa cambios ni tiene reglas automáticas. MaKo tiene que DECIRLO en una línea y ofrecer lo que sí puede (cambiarlo ahora). Nunca arma otra cosa con valores por defecto ni suelta en silencio una parte del pedido. La tarjeta repite el pedido entero: qué, cuál, cuánto y cuándo.

QUÉ NO HACE NUNCA:
- Mover plata, activar o borrar sin la tarjeta confirmada.
- Crear en Meta fuera de PAUSA.
- Activar una campaña sin avisar que hoy sus conjuntos y anuncios quedan en pausa (el chat no activa en cascada).
- Borrar algo activo (sólo se borra lo pausado).
- Inventar métricas, o coronar un «ganador» con una sola agenda (la señal de ángulo ganador de Ads Analyst es falsa con N chico).
- Decir «vi tu landing» o «vi tu Instagram» sin haberla leído.
- Escribir links, ids o direcciones: los pone el código.
- Inventar testimonios, cifras, garantías o precios en el copy, o dejar «sin dato:» en una página publicada.
- Publicar sin que se lo pidan.
- Borrar la landing abierta.
- Elegir el primero de una lista ambigua.
- Tomar «sacá el botón de la web» como despublicar.

QUÉ REUSAR:
- Prompts del registro (lib/prompt-registry.ts): landing_editor.esquema, secciones, editar, texto, disenos y notas; landing_writer.suggest y adjust; landing_analyst.analyze; campaign.suggest y adjust (lib/campaign-structurer.ts, con su grounding en funnel, KPIs y ganadores); script_analyst.analysis y valoracion.
- lib/editor-landing/ia.ts, ia-reglas.ts e ia-bloques.ts.
- lib/mako-pedidos.ts y mako-pedidos-ia.ts: pedidos sueltos, «¿cuál?» y productoDelPedido.
- esPedidoDeLanding (lib/mako-intencion.ts), como molde de un esPedidoDeAds.
- RECETA_PRESUPUESTO (lib/doer-recetas.ts).
- lib/meta-health-ui.ts: explicarIssueEs, esAprobacionPendiente y linkAprobarEnMeta.
- lib/presupuesto-cambio.ts (usdACuenta).
- construirSpec del NuevaCampanaModal: las respuestas son la fuente de verdad y MaKo sólo escribe el copy.
- lib/meta-recos-cuenta.ts.
- Pantallas para los bloques: MiniaturaLanding.tsx, crear/EditorEsquema.tsx, editor/diff-tarjetas.ts, diagnostico/PanelDiagnostico.tsx, landing-analyst/MapaDeCalor.tsx, ads-manager/LugarPicker.tsx, EditarTextosModal.tsx y ads-writer/ValoracionGuion.tsx.

PARA COSECHAR (lo hace la síntesis; este agente no escribió en el repo):
- docs/hallazgos-ads.md: el chat no activa en cascada; gating.integracion no frena; el tuteo de Meta no llega a su herramienta.
- docs/hallazgos-editor-landing.md: lo de /mako/revisar no vuelve al hilo; el chat de PanelAgente vive en un Map en memoria y se pierde al recargar; las frases de landing que se caen.
- docs/hallazgos-ia.md: el default «capturar» en el chat de la app.

## Bloques nuevos

- Tarjeta de landing: miniatura (MiniaturaLanding), estado, dirección y botones «Abrir en el editor» y «Publicar»
- Elegir entre 3 con miniatura: diseños, temas, variantes de una sección, formato de Replicar
- Esquema editable antes de generar: secciones con sus puntos, reordenar, sacar y agregar
- Diff de una sección (antes y después) con «Aceptar», «Descartar» y «Deshacer»
- Trabajo largo con progreso que termina en una tarjeta en el hilo: generar, replicar, diagnosticar, subir un video a Meta
- Publicar: dirección libre u ocupada, link publicado con Copiar y Abrir, y tabla DNS con su estado
- Diagnóstico: comentarios con «Aplicar» cada uno y «Aplicar todos»
- Analítica de una landing: mini gráfico y mapa de calor
- Grilla de fotos, y un adjunto del chat con «Usar en la landing»
- Línea de versiones con «Volver a esta»
- Archivo para descargar (exportar PDF, PNG, PPTX o HTML)
- Tabla compacta de Meta: semáforo, gasto, resultados y coste por resultado, con toggle de pausar y activar
- Cambio de presupuesto: antes → después en la moneda de la cuenta, más su equivalente en USD
- Vista previa del anuncio con los textos editables en línea
- Campaña en el chat: una pregunta por bloque, resumen vivo y «Crear en pausa»
- Subida de un creativo con el progreso del procesado de Meta
- Selector de lugar con el alcance de Meta e intereses (LugarPicker)
- Tarjeta de problema de Meta: la explicación en español con «Aprobar en Meta ↗» y «Editar textos»
- Confirmación adentro del chat de las operaciones 'pantalla' (transversal, Ops Center 3)
- Tarjeta de guion con su valoración y «Llevar al Video Generator»

## Decisiones para Martín (las de esta área)

- Lo que mueve plata en Meta (presupuesto, activar, borrar, crear una campaña), ¿se confirma con la tarjeta del chat, con un toque y el monto antes → después a la vista, o sigue en una pantalla aparte? Con la tarjeta, todo queda en el Ops Center, pero un toque gasta plata. Con la pantalla, 8 de las 13 acciones de Meta siguen sacando a la persona del chat. Hoy RECETA_PRESUPUESTO prohíbe confirmar el presupuesto por el chat.

## Piezas, en orden

| Pieza | Hecho = | Depende de | Tam. |
|---|---|---|---|
| Clasificador del chat de la app (canal 'app'): un mensaje dudoso ya no se guarda en silencio. MaKo pregunta en una línea «¿Lo hago o lo anoto?» con dos botones, y el tuteo sin tilde con un objeto de Meta o de landing cuenta como orden. El doer de WhatsApp sigue capturando como hoy. | Las frases medidas el 20/10 (las de las evidencias de este mapeo) corren como test de turno del chat de la app, y cada operación que existe llega en tuteo y en voseo. Sacar la regla hace fallar el test, y los tests de WhatsApp siguen en verde. | nada (lo hace Ops Center 3; Web Generator y Ads Manager le pasan sus frases) | M |
| esPedidoDeAds en lib/mako-intencion.ts, con el molde de esPedidoDeLanding. Detecta un verbo de pedido (voseo, tuteo, «¿puedes…?», «hazme el favor de…») con un objeto de Meta (campaña, conjunto, anuncio, presupuesto, público, formulario, creativo) a 3 palabras o menos, y le suma el área ads y una relevancia que pone primero la operación. AREA_KEYWORDS.ads suma «público», «formulario instantáneo», «cuenta publicitaria», «intereses» y «segmentar». | Llegan con su operación, en el chat de la app y en WhatsApp: «pausa la campaña X», «súbele el presupuesto…», «ponle 50 dólares diarios…», «crea un público…», «cámbiale el texto al anuncio…» y «¿qué públicos tengo en Meta?». Corre el test de turno de TODA el área, porque una relevancia nueva le roba lugar a otra (regla del 17/10). | 1 | M |
| Completar esPedidoDeLanding con lo que hoy se cae: estilo de sección, formulario, navegación, versiones y deshacer, link privado, papelera, cobro del botón, aplicar el diagnóstico, «mejora los textos» y «necesito un sitio». | Las 15 frases de landing medidas sin su operación la traen en tests/mako-intencion-landing.test.ts, y los T1-T4 siguen en verde. | 1 | M |
| Activar en cascada desde la API. proponer_estado_campana y proponer_estado_conjunto con ACTIVE activan el subárbol y los padres, con la misma regla que statusCascadeIds de CampanasBrowser. Pausar sigue siendo una sola llamada. | Hay un test que confirma «activar» sobre un árbol en pausa y verifica que manda ACTIVE a la campaña, sus conjuntos y sus anuncios; volver a una sola llamada lo hace fallar. El resumen de la tarjeta dice cuántos se activan. | nada | S |
| Confirmar adentro del chat lo que hoy va a /mako/revisar (14 de landing y 8 de Meta). La tarjeta abre el MISMO detalle editable que RevisarAccion y confirma ahí. Lo que se confirme en /mako/revisar anota «Hecho: …» en el hilo de origen (canalKey app:<sesión>). | publicar_landing, proponer_presupuesto_campana y generar_landing_con_ia, pedidas desde el Ops Center, se confirman sin salir del chat, y el hilo muestra el resultado: el link publicado, el monto nuevo, la landing creada. | Ops Center 3 (la tarjeta con detalle editable es transversal); para el presupuesto, la decisión de Martín | L |
| Bloques «tarjeta de landing» y «elegir entre 3»: un tipo nuevo en ItemHilo, armado con MiniaturaLanding. | Listar, crear y replicar terminan en el hilo con la miniatura y «Abrir en el editor». «Armame una landing» sin un diseño muestra 3 diseños para tocar. Se ve igual en la computadora y en el teléfono. | Ops Center 3 (el tipo de bloque en la pieza única del chat) | M |
| Trabajos largos en el chat: generar, editar con IA, replicar y diagnosticar corren en segundo plano, con progreso, y al terminar la tarjeta llega al hilo. | «Créame una landing para el webinar» en el Ops Center termina con la miniatura en el hilo sin recargar, aunque tarde 3 minutos. Si se cierra la pestaña a mitad, al volver la tarjeta está. | 5, 6 | M |
| Diff de cada edición en el hilo: la sección antes y después, con «Deshacer», que es restaurar_version_landing con la version_antes. | Cada edición hecha desde el chat deja su antes y después, y el Deshacer vuelve la versión. Probado en ws3. | 6 | M |
| Publicar y dominio en el hilo: si la dirección está libre u ocupada, el link publicado con Copiar y Abrir, y la tabla DNS con su estado. | «Publicá la landing del webinar en /webinar» termina en el hilo con el link público. «Conectá midominio.com» muestra los registros y, al verificar, el estado cambia en el mismo bloque. | 5 | M |
| Operaciones que le faltan al Web Generator: exportar (PDF, PNG, PPTX, HTML), 3 diseños alternativos de una sección, comentar como equipo, pasar un adjunto del chat a la biblioteca de la landing, y generar en dos pasos (esquema revisable y después las secciones). | Cada una está declarada en landing-editor.def.ts y .run.ts, con docs/api-mako.md, el snapshot y plugin/ regenerados. Cada una tiene su test de turno y se puede usar desde el Ops Center. | 3 | M |
| Bloques de Meta: tabla compacta con semáforo y toggle; presupuesto antes → después en la moneda de la cuenta (más su equivalente en USD); tarjeta de problema con «Aprobar en Meta ↗»; vista previa del anuncio con los textos editables. | «¿Cómo van mis campañas?» muestra la tabla con su rango de fechas. Pausar desde la tabla deja la tarjeta de confirmar. El presupuesto se ve antes → después en la moneda de la cuenta. | 2, 5, 6 | M |
| Subir creativos desde el chat a Meta: el adjunto va al bucket ads-creatives y de ahí a uploadAdImage o uploadAdVideoByUrl, esperando el procesado. También se puede elegir de «Mis creativos de MaKo» o de los ganadores. | Un video adjunto en el Ops Center termina como anuncio EN PAUSA en un conjunto de ws3, por proponer_agregar_anuncio con su video_id. | 2, 11 | M |
| proponer_agregar_conjunto: hereda el objetivo, la optimización y la conversión del primer conjunto real, como hace AgregarConjuntoModal. | Desde el chat se agrega un conjunto en pausa, con un lugar y un público, a una campaña de ws3, sin pisar la segmentación cruda (la lección de getAdsetTargeting). | 11 | M |
| proponer_crear_campana: la campaña entera desde el chat. Hace las mismas preguntas del NuevaCampanaModal, una por bloque: creativos, inversión en USD, objetivo, lugar, estrategia, público, ubicaciones y destino. construirSpec es la fuente de verdad y MaKo sólo escribe el copy (campaign.suggest). Crea en PAUSA, con rollback si falla a mitad. | Una campaña creada desde el Ops Center en ws3 queda igual a la del wizard (el mismo spec), en pausa, con el aviso de peer approval cuando corresponde. Se prueba UNA publicación real: hasta hoy nunca se probó en vivo. | 4, 12, 13 | L |
| Llevar el chat del agente del editor al Ops Center. Hoy PanelAgente guarda la conversación en un Map en memoria, que se pierde al recargar. Pasa a la pieza única del chat. | Lo que se habla con MaKo dentro del editor queda guardado y aparece en el Ops Center como un chat de esa landing. Recargar el editor no lo borra. | Ops Center 3 (la pieza única del chat y las proyecciones de chat-mako-indice) | M |
| La inteligencia del área en el system: una receta de landing y una de ads, con qué leer antes y qué preguntar, cada una con su test de turno. | Hay un test de turno para cada caso. Con dos campañas que dicen «captación», «ponle 50 por día a la de captación» hace que MaKo pregunte cuál y en qué moneda antes de proponer. «Pausá los anuncios con CPL > 10 todos los lunes» hace que diga que programar no existe y ofrezca hacerlo ahora. Con un solo producto, «créame una landing para mi otro producto» hace que pregunte cuál. | 2, 3 | M |
