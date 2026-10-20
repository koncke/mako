# Mapa del Ops Center · video-imagen

Parte de [docs/ops-center-principal.md](../ops-center-principal.md) (20/10/2026). Medido en sólo lectura sobre C:/dev/wt-push-q. Lo «sin_verificar» no se afirma.

**Chat responsable:** Chat de Video / AI Avatar (Video Editor, Video Generator, AI Avatar, Flow, voz) y chat del Image Editor. Ops Center 3 pone lo transversal: el sistema de bloques del chat, la confirmación adentro y la pieza única del chat. lib/mako-intencion.ts es compartido: avisar a MaKo WhatsApp antes de tocarlo. Desplegar el worker de montaje es de Infra.

**Tabs:**
- video-editor
- video-generator
- ai-avatar
- image-editor
- image-generator

**Hoy:** 63 acciones · sí 8 · parcial 18 · no 37 · sin verificar 0.

## Acciones

| Acción | Operación de la API | Hoy | Falta | Bloque en el chat | Tam. |
|---|---|---|---|---|---|
| Video Editor · Ver mis proyectos | listar_proyectos_video | si | bloque | Galería de proyectos (nombre, duración, editado hace…, «Abrir en el editor»). Sin miniatura: la copia no la trae. | S |
| Video Editor · Ver la línea de tiempo de un proyecto | ver_proyecto_video | parcial | herramienta, bloque | Mini línea de tiempo: pistas con un chip por elemento (ref, inicio–fin, texto o nombre). | M |
| Video Editor · Crear un proyecto nuevo (vacío, 9:16 o 16:9) | null | no | motor, herramienta, bloque | Tarjeta «Proyecto nuevo · Abrir en el editor». El editor lo crea al abrir el link, con el mismo molde que ?desde=. | M |
| Video Editor · Importar video, foto o audio a Multimedia | null | no | motor, herramienta, bloque | «Soltar archivo» en el chat: se sube a storage y el editor lo baja a Multimedia al abrir. | L |
| Video Editor · Abrir en el editor un anuncio, una toma o un montaje de MaKo («Editar en el editor») | null | no | herramienta, bloque | Tarjeta del anuncio con el botón «Editar en el editor». El link lo arma el código, no el modelo. | S |
| Video Editor · Usar una plantilla de anuncio | listar_plantillas_video, usar_plantilla_video | parcial | herramienta, motor, bloque | Elegir entre 3 plantillas sugeridas (muestra 9:16, duración, huecos), más un formulario de huecos: el texto que dicta la persona y el medio de cada clip. | M |
| Video Editor · Cortar, dividir, recortar o cortar un tramo | dividir_clip_video, recortar_clip_video, cortar_tramo_video | no | herramienta, bloque, confirmacion | Propuesta «Original | Modificado» con los cortes marcados en la mini línea de tiempo, y «Aceptar en el editor». | S |
| Video Editor · Cortar una frase dicha o eliminar las muletillas | cortar_frase_video, eliminar_muletillas_video | parcial | herramienta, bloque | Propuesta con la lista de tramos que se cortan (la frase y el segundo). | S |
| Video Editor · Borrar, mover, cambiar la duración u ocultar elementos | borrar_elementos_video, mover_elemento_video, cambiar_duracion_video, ocultar_elemento_video | parcial | herramienta, bloque | Propuesta «Original | Modificado». | S |
| Video Editor · Agregar o cambiar un texto, y su estilo | agregar_texto_video, cambiar_texto_video, cambiar_estilo_texto_video | parcial | herramienta, bloque | Propuesta con el texto antes y después, y su estilo. | S |
| Video Editor · Subtítulos automáticos, reemplazar en subtítulos, resaltar la palabra dicha | generar_subtitulos_video, reemplazar_en_subtitulos_video, resaltar_palabras_video | parcial | herramienta, bloque | Propuesta, y al aceptar la transcripción con las palabras resaltadas. | S |
| Video Editor · Estilo, fuente y tamaño de los subtítulos | null | no | motor | Elegir entre 3 estilos de subtítulo, con su muestra. | M |
| Video Editor · Audio: volumen, silenciar, fundidos, normalizar, reducir ruido, extraer el audio | cambiar_volumen_video, silenciar_clip_video, poner_fundido_video, normalizar_audio_video, reducir_ruido_video, separar_audio_video | parcial | herramienta, bloque | Propuesta «Original | Modificado». | S |
| Video Editor · Borrar los silencios | null | no | motor, herramienta | Propuesta con los tramos de silencio detectados y el total de segundos ahorrados. | M |
| Video Editor · Velocidad y curvas | cambiar_velocidad_video | parcial | herramienta, bloque | Propuesta «Original | Modificado». | S |
| Video Editor · Transiciones, animaciones, filtros, efectos, capa de efecto, ajustar el color | poner_transicion_video, poner_animacion_video, poner_filtro_video, poner_efecto_video, agregar_capa_efecto_video, ajustar_color_video | parcial | herramienta, bloque | Elegir entre 3 (transiciones, filtros o animaciones, con su vista previa animada), más la propuesta. | M |
| Video Editor · Transformar, reflejar, revertir, congelar, reemplazar el archivo de un clip | transformar_elemento_video, reflejar_clip_video, revertir_clip_video, congelar_cuadro_video, reemplazar_clip_video | parcial | herramienta, bloque | Propuesta «Original | Modificado». | S |
| Video Editor · Agregar música, sonidos, stickers o videos de la biblioteca | null | no | motor | Elegir entre 3 pistas o stickers, con muestra. | M |
| Video Editor · Quitar el fondo, croma, máscaras, recortar el encuadre, fondo del lienzo, fotogramas clave, duplicar, pegar atributos | null | no | motor | Propuesta «Original | Modificado», con un cuadro de antes y después. | L |
| Video Editor · Texto a voz / voz en off (ElevenLabs del cliente) | null | no | herramienta, confirmacion, bloque | Tarjeta de costo («usa N caracteres de tu ElevenLabs»), luego reproductor del audio y «Agregar al video». | M |
| Video Editor · Avatar de IA dentro del editor | null | no | herramienta, confirmacion, bloque | Tarjeta de costo y luego reproductor del clip del avatar. | M |
| Video Editor · Exportar o descargar el video (mp4, resolución, fps, GIF, SRT) | null | no | motor, bloque | Botón «Exportar» que abre el editor con la exportación lista. De fondo, render en el server. | L |
| Video Editor · Aceptar, descartar o restaurar un cambio propuesto | null | no | bloque, confirmacion, motor | Tarjeta de propuesta con las filas «Original | Modificado» (ya vienen en extra.cambios) y «Aceptar en el editor». Para aceptar sin salir: el editor embebido en el panel del Ops Center. | M |
| Video Editor · Ver desde el Ops Center el hilo del chat «Editar con IA» de un proyecto | null | no | herramienta | Fila del hilo en la lista de chats del Ops Center. | S |
| Video Editor · Renombrar o borrar un proyecto | null | no | motor | Para borrar, sólo el link al inicio del editor. | S |
| Video Generator · ¿Cómo van mis anuncios? (tomas, escenarios, errores) | listar_anuncios_video, ver_anuncio_video | si | bloque | Tarjeta del anuncio: las tomas en fila con miniatura, su estado y de quién fue la falla. | M |
| Video Generator · Ver o descargar el anuncio montado | ver_montaje_anuncio | parcial | bloque | Reproductor 9:16 con «Descargar» y «Editar en el editor». | S |
| Video Generator · Elegir el guion a filmar | listar_guiones_para_video (+ leer_guion_anuncio) | parcial | herramienta, bloque | Elegir entre 3 guiones (primera línea, ángulo, palabras, si ya tiene anuncio). | S |
| Video Generator · Cargar guiones (pegar, archivo, link) y editarlos | null | no | herramienta, bloque | Lista de guiones detectados con casillas «Importar». | M |
| Video Generator · Elegir formato (puesta en escena) y lugar | listar_formatos_video, listar_lugares_grabacion | parcial | bloque | Elegir entre 3 formatos con su video de muestra (el molde de PreviaVolante). | S |
| Video Generator · Generar o regenerar el plan de tomas | null | no | herramienta, bloque | El plan: tomas con su texto, segundos y escenario. | M |
| Video Generator · Editar el texto de una toma, reescribirla o su voz | null | no | herramienta | Propuesta del texto de la toma, antes y después. | S |
| Video Generator · Imagen de cada escenario: generar, elegir variante, otro fondo, subir propia, corregir, confirmar, reusar | contar_escenarios_reusables (sólo cuenta) | no | herramienta, bloque, confirmacion | Grilla de variantes para elegir una, más «Otro fondo». | M |
| Video Generator · Filmar una toma (créditos de Flow del cliente) | null | no | herramienta, confirmacion, bloque | Tarjeta de costo («Filmar la toma 3 · N créditos · te quedan M»), luego reproductor de la toma con «Seguir con la 4» y «Regenerar». | M |
| Video Generator · Estado, regenerar, descartar o restaurar una toma | ver_anuncio_video (estado guardado) | parcial | herramienta, confirmacion | Reproductor de la toma con sus acciones. | S |
| Video Generator · Créditos de Flow y si alcanzan | ver_saldo_flow, calcular_alcance_anuncio | si | herramienta | Línea de saldo con su fecha dentro de la tarjeta de costo. | S |
| Video Generator · Montar el anuncio (cortes y música) | null | no | motor, herramienta, bloque | Mini editor de cortes (las tomas en fila, los tramos que se tiran), elegir música y reproductor del resultado. | L |
| Video Generator · Diagnóstico: ¿por qué no se filma? ¿Está conectada la extensión? | ver_puente_flow, listar_trabajos_flow | parcial | herramienta, bloque | Tarjeta de estado del puente: vivo o no, versión, pausado por Google, último trabajo fallido con su frase. | S |
| Video Generator · Conectar, probar o rehabilitar el puente (extensión) | null | no | herramienta, bloque | La tarjeta del puente con «Instalar extensión», «Conectar» y «Probar». | S |
| Video Generator · Fotos de la cara para filmar | ver_contexto_video, ver_cara_de_marca, borrar_foto_cara_de_marca | parcial | herramienta, confirmacion | Las fotos adjuntas con «Usar como mi cara». | M |
| Video Generator · Acento y muletillas del video | ver_voz_cliente, ver_contexto_video (lectura) | no | herramienta | Elegir entre 3 acentos, con muestra. | S |
| Video Generator · Muestras de voz y clonar la voz (ElevenLabs del cliente) | ver_voz_cliente | no | motor, herramienta, confirmacion, permiso | Grabadora de la muestra, consentimiento explícito y estado del clon. | M |
| Video Generator · Onboarding (extensión, fotos, acento, muletillas, voz, primer escenario) | estado_onboarding_video | parcial | herramienta, bloque | Checklist en el chat con el paso que falta y su acción ahí mismo. | S |
| AI Avatar · Ver mis looks o avatares | ver_avatares | no | herramienta, permiso, bloque | Galería de looks con su estado (listo, generando, falló y por qué). | S |
| AI Avatar · Crear un look (foto + tema de la galería) | null | no | herramienta, bloque, permiso | Elegir entre 3 temas (lib/ai-avatar/plantillas.ts) y la foto, luego la imagen del look. | M |
| AI Avatar · Video con el avatar (guion → tomas) | null | no | herramienta, confirmacion, bloque, permiso | Tarjeta de costo y luego reproductor. | M |
| AI Avatar · Voces (las de su ElevenLabs y la galería; sumar una) | null | no | herramienta, bloque | Reproductor de muestras con «Usar esta voz». | S |
| AI Avatar · Video con la voz elegida o clonada (STS) | null | no | motor | Reproductor del video con la voz. | L |
| AI Avatar · Plantillas por tipo de anuncio | null | no | herramienta | Elegir entre 3 plantillas. | S |
| Image Editor · Ver mis diseños | listar_disenos_imagen | si | bloque | Galería con miniatura (image_disenos ya guarda la que sube el editor) y «Abrir en el editor». | S |
| Image Editor · Ver un diseño | ver_diseno_imagen | si | bloque | Vista previa (miniatura) con «Abrir en el editor». | S |
| Image Editor · Crear un diseño (tamaño o plantilla) | crear_diseno_imagen, listar_plantillas_imagen | si | bloque | Elegir entre 3 plantillas sugeridas con miniatura, y la vista previa del creado. | S |
| Image Editor · Cambiar los textos de un diseño | cambiar_textos_diseno_imagen | si | bloque | «Original | Modificado» con la miniatura. | S |
| Image Editor · Duplicar un diseño | duplicar_diseno_imagen | parcial | herramienta | Tarjeta de confirmación con la copia. | S |
| Image Editor · Borrar un diseño | borrar_diseno_imagen | si | nada | Tarjeta de pantalla (ya existe). | S |
| Image Editor · Editar elementos: estilo de texto, agregar texto, mover, tamaño, rotar, opacidad, color, borde, borrar, duplicar elemento, capas, alinear, bloquear, fondo, páginas, formas | null | no | herramienta, bloque | «Original | Modificado» con la miniatura, y «Abrir en el editor». | M |
| Image Editor · Agregar fotos, íconos o el logo (Subidos, Iconify) | null | no | motor, herramienta, bloque | Elegir entre los Subidos (miniaturas). | M |
| Image Editor · Subir una imagen a Subidos | null | no | herramienta | La imagen adjunta con «Guardar en Subidos». | S |
| Image Editor · Quitar fondo, recortar foto, filtros, degradados, animar, agrupar, redimensionar, usar plantilla en un diseño existente, QR, gráficos | null | no | motor | «Original | Modificado» con la miniatura. | L |
| Image Editor · Descargar PNG, JPG, PDF o MP4 | null | no | motor, bloque | Botón «Descargar» que abre el editor con la descarga lista, o render en el server. | L |
| Image Editor · Renombrar, carpetas, vista de presentador | null | no | herramienta | Link a la vista de presentador. | S |
| Image Generator · Generar una imagen con IA | null | no | motor, herramienta, bloque | Elegir entre 4 variantes, más «Usar en un diseño» o «Usar en el video». | L |
| Transversal · El chat «Editar» dentro de cada editor = el chat del Ops Center | null | no | bloque | Barra fija a la derecha con la pieza única del chat del Ops Center y el proyecto o diseño atado como contexto (pista). | M |

## La inteligencia del chat de esta área

CÓMO SE MIDIÓ (20/10/2026, sólo lectura). Se corrió el selector real del turno del Ops Center: clasificarIntencion más herramientasDelChat, de lib/mako-turno-app-reglas.ts, que es lo mismo que llama lib/mako-turno-app.ts. Vista: admin, canal app, ws9. Script: C:\Users\marti\AppData\Local\Temp\claude\C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main\9bc46b5e-9148-459a-96ec-697adcd3d518\scratchpad\medir-video.ts. Resultado: de 33 pedidos de EDICIÓN de video, sólo 8 traen la acción del editor, y 7 de esos 8 porque usan un verbo de ACCION_CUENTA_RE (borrá, cambiá, mové, subí, eliminá, actualizá). 21 caen en «capturar con duda»: viajan sólo ver_plan y listar_pendientes, y MaKo no puede hacer nada. Los otros 4 son preguntas o imperativos tipo pensar: viajan las lecturas y MaKo ofrece, que es lo que se buscaba.

TRAMPAS PARA LA COSECHA (este agente no escribió en el repo; van a docs/hallazgos-video-editor.md, docs/hallazgos-editor-imagen.md y docs/hallazgos-api-mako.md):
(1) Los verbos de edición en tuteo, o en voseo con pronombre («cortá», «agregale», «sacale», «poné», «ponele», «subile», «quitale», «acelera», «duplicá», «filmá», «montá», «exportá», «descargá») caen en capturar con duda. Sumar el área no alcanza: es el mismo caso de esPedidoDiseno del 15/10.
(2) «avatar» es palabra del área negocio (el cliente ideal): «¿tengo listo mi avatar?» nunca trae ver_avatares.
(3) «filmar», «grabar» y «toma» no son palabras del área video: «¿qué guiones me faltan filmar?» cae en contenido, y «¿por qué no se filma mi anuncio?» cae en ads.
(4) En una acción, ver_proyecto_video puede quedar afuera del tope de 12.000 caracteres. El modelo se queda sin refs ni nombres válidos.
(5) Las propuestas del Video Editor no salen como tarjeta en el chat de la app. linksDeUnaAccion sólo captura /revisar/, y CANAL_APP le prohíbe al modelo escribir el link. El diagnóstico obvio («falta la operación») era el equivocado: las 34 están, lo que falta es el bloque.
(6) El Image Editor es lo contrario del video: el diseño vive en la base y aplicarOperaciones es pura, así que el chat del Ops Center puede APLICAR en el server. El video sólo puede PROPONER, porque el proyecto y su material viven en el navegador.

QUÉ TIENE QUE SABER Y LEER ANTES DE ACTUAR:
- Video Editor: listar_proyectos_video, y ver_proyecto_video antes de CUALQUIER cambio. Las refs (v1, t2), los medios (m1) y los ids de DISPONIBLES (transiciones, filtros, fuentes) se copian exactos, nunca se inventan. Hay que saber que el proyecto vive en el navegador de quien lo editó: la copia puede estar vieja, y un proyecto no abierto desde el 16/10 no existe para la API. Todo cambio queda PROPUESTO hasta que una persona lo acepta en el editor.
- Video Generator: estado_onboarding_video y ver_contexto_video (fotos de la cara, acento, muletillas, perfil), ver_puente_flow antes de prometer nada que genere, y ver_saldo_flow más calcular_alcance_anuncio antes de filmar. El saldo puede estar viejo: creditos null quiere decir que nunca se leyó, no que tenga cero. El guion sale de Ads Writer (listar_guiones_para_video, leer_guion_anuncio) y el plan usa el texto LITERAL.
- AI Avatar: ver_avatares, ver_cara_de_marca (y «no afirmes que es el dueño») y las voces de su ElevenLabs.
- Image Editor: listar_disenos_imagen, y ver_diseno_imagen antes de cambiar textos. listar_plantillas_imagen trae primero las sugeridas para el negocio. Del Second Brain salen la oferta, los datos de la promo y la cara de marca. Kit de marca (logo, colores) no hay: services.brand está en null.
- El contexto del negocio ya entra por buildSystemPrompt (chartKey 'mako-doer'). Lo que no esté ahí, se lee con las operaciones de negocio (contexto_negocio, ver_perfil_negocio, buscar_en_segundo_cerebro).

QUÉ PREGUNTA EN VEZ DE INVENTAR. Es el caso del 20/10: «todos los martes a las 3 a todo el funnel» y MaKo armó otra cosa con pasos por defecto. Regla: si falta un dato que cambia el resultado, UNA pregunta con 2 o 3 opciones sacadas de los datos reales, nunca un valor por defecto en silencio.
- Qué proyecto o diseño: si hay más de uno parecido, o «el video» sin nombre, ofrecer los 3 más recientes.
- Cuánto cortar y dónde: «cortá el principio» sin segundos, se pregunta con los clips y sus tiempos.
- Qué texto exacto (fecha, precio, dirección, hora del evento): son hechos, nunca se rellenan («Preguntar hechos, no acciones»).
- Qué plantilla, entre 3 sugeridas con su porqué, y el texto de cada hueco. Si un hueco queda con el texto de ejemplo, hay que DECIRLO.
- Qué guion filmar y en qué formato y lugar, entre 3 opciones. Nunca escribir un guion nuevo acá: eso es Ads Writer.
- Antes de gastar: «gasta N créditos de Flow, te quedan M (leído el …), ¿filmo la toma 3?».
- Qué voz o acento, y el consentimiento explícito antes de clonar una voz.
- El tamaño de un diseño: post, story o banner.

QUÉ NO HACE NUNCA:
- Decir «listo» o «aplicado» de un cambio del Video Editor que sólo quedó propuesto.
- Gastar créditos de Flow o de ElevenLabs sin la tarjeta confirmada. Filmar varias tomas en lote: una por vez, el dueño mira la anterior. Reintentar sola una toma que falló («NO reintentar»).
- Mostrarle un prompt al cliente: «EL PROMPT NO SE MUESTRA NUNCA», regla de VideoGeneratorApp.tsx.
- Borrar un proyecto de video desde el chat: no hay papelera.
- Clonar una voz o usar una cara sin autorización, o decir que el avatar habla con la voz clonada (no está hecho).
- Usar la key de ElevenLabs de la plataforma (es BYOK).
- Meter datos de leads en un video o un diseño.
- Escribir links o ids: los pone el código.
- Simular lo que está en NO_SE_PUEDE_CHAT o NO_SE_PUEDE_CHAT_IMAGEN: hay que decirlo.

QUÉ REUSAR:
- lib/editor-video/chat-catalogo.ts: OPERACIONES_CHAT con su «para», NO_SE_PUEDE_CHAT y validarOperacion.
- lib/editor-video/chat-api.ts: las 34 acciones de la API.
- lib/editor-video/chat-prompts.ts: video_editor.chat.system y user, editables en /configuraciones (lib/prompt-registry.ts).
- lib/editor-video/propuestas.ts y propuestas-server.ts; lib/editor-video/espejo.ts (vistaDeLinea); lib/editor-video/plantillas.ts y plantillas-etiquetas.ts (sugeridas por negocio).
- lib/image-editor/chat/: catalogo.ts (18 operaciones y NO_SE_PUEDE_CHAT_IMAGEN), aplicar.ts (puro, apto para el server), vista.ts, prompts.ts (image_editor.chat.system y user), ia.ts. app/image-editor/mako/plantillas-etiquetas.ts.
- lib/prompts-video.ts y lib/prompts-imagen.ts (los prompts de Flow validados por Martín, textuales); lib/video-planner.ts (FEATURE_VIDEO_PLANNER); lib/flow-fallo-texto.ts (la frase de quién fue la falla); lib/flow-imagen.ts.
- lib/ai-avatar/plantillas.ts y voces-galeria.ts; lib/elevenlabs.ts (clonarVoz, ttsConKey, convertirVoz).
- app/video-editor/desde/ (abrir un anuncio en el editor); lib/mako-pedidos.ts («entender el pedido», OBJETOS_DE_LA_TAB de video e imagen).
- El molde del clasificador: esPedidoDiseno y esPedidoAutomatizacion, en lib/mako-intencion.ts.
- docs/edicion-video-automatica.md (la receta de montaje y el consentimiento de voz).

## Bloques nuevos

- Galería de proyectos de video y de diseños (miniatura si hay, nombre, editado hace…, «Abrir en el editor»)
- Tarjeta de propuesta del Video Editor: filas «Original | Modificado» y «Aceptar en el editor»
- Mini línea de tiempo (pistas con un chip por elemento: ref, inicio–fin, texto)
- Reproductor de video 9:16 (toma, montaje o anuncio) con «Descargar», «Editar en el editor» y «Seguir con la próxima toma»
- Elegir entre 3 con vista previa: plantillas de video con muestra, formatos, temas de avatar, plantillas de imagen, acentos y voces
- Formulario de huecos de una plantilla (texto dictado y medio por hueco)
- Tarjeta de costo antes de gastar: créditos de Flow o caracteres de ElevenLabs, con saldo y fecha de lectura
- Tarjeta de estado del puente Flow (vivo, versión, pausado por Google, último fallo) con «Instalar», «Conectar» y «Probar»
- Plan de tomas (texto, segundos, estado y escenario de cada toma)
- Grilla de variantes de imagen de escenario con «Otro fondo»
- Mini editor de cortes del montaje, con elegir música
- Vista previa de un diseño (miniatura) con «Original | Modificado»
- Grabadora de muestra de voz con consentimiento explícito
- Checklist del onboarding del Video Generator con la acción del paso que falta
- Editor embebido (Video o Image Editor) en el panel del Ops Center para aceptar o exportar sin salir

## Decisiones para Martín (las de esta área)

- AI Avatar es sólo del super admin (app/ai-avatar/acceso.ts). ¿Se abre a los clientes? Sin eso, nada de avatar por el chat para ellos.
- Exportar video desde el Ops Center: el proyecto y su material viven en el navegador del cliente (IndexedDB/OPFS). ¿Material en la nube y render en un server de MaKo (costo de infra de MaKo), o seguir con «se acepta y se exporta en el editor» con el editor embebido en el chat?
- Filmar gasta créditos de Flow de la cuenta de Google del cliente. ¿La confirmación sigue siendo por toma, como hoy, o por anuncio entero con un tope?
- El worker de montaje (worker/montar-cola.mjs) figura sin desplegar desde el 01/09 (investigación del 19/10). ¿Se despliega? Sin él, «montar» no anda en ningún lado.
- Image Editor: el chat puede aplicar cambios directo al diseño guardado, pero no hay historial de versiones (services.versions en null). ¿Se aplica directo con la tarjeta de confirmación, o primero se hace el historial?
- Clonar la voz por chat: ¿se aceptan adjuntos de audio en el chat del Ops Center (hoy sólo imagen y PDF)? El consentimiento de la persona es obligatorio.
- Image Generator está en «pronto». ¿Se genera con Flow (gratis con el Google del cliente, como las imágenes de escenario) o queda afuera?
- Música para el Video Editor: hoy está fuera por licencia. ¿Catálogo propio con licencia, o sin música de biblioteca?

## Piezas, en orden

| Pieza | Hecho = | Depende de | Tam. |
|---|---|---|---|
| 1. Clasificador: pedidos de edición y producción de video e imagen. Verbos en tuteo y voseo (cortar, agregar, sacar, poner, subir, quitar, acelerar, duplicar, filmar, grabar, montar, regenerar, exportar, descargar, editar) con el objeto a ≤3 palabras pasan a actuar, con área video o imagen y su relevancia (molde esPedidoDiseno). AREA_KEYWORDS.video suma film|grab|tomas?|avatar de ia|looks?|extensión de flow. «mi avatar» con diga, hable, look o video va a video y no a negocio. | De los 33 pedidos de edición medidos el 20/10, al menos 30 traen la operación esperada en herramientasDelChat. «¿tengo listo mi avatar?» trae ver_avatares y «¿qué guiones me faltan filmar?» trae listar_guiones_para_video. Hay un test en tests/ que llama al turno real, probado rompiéndolo. | nada | S |
| 2. Dependencias que viajan juntas: si viaja una acción del Video Editor, viajan también ver_proyecto_video y listar_proyectos_video (y con las de imagen, ver_diseno_imagen y listar_disenos_imagen), fuera del orden por relevancia. | «cambiá la velocidad del clip v1 del video Promo al doble» trae ver_proyecto_video. Test probado rompiéndolo. | 1 | S |
| 3. Receta del área en el system (lib/doer-recetas.ts): qué leer antes, qué preguntar con opciones, qué no hacer nunca (la sección inteligencia). | Con herramientas de video o imagen en el turno, el system lleva la receta. «cortá el principio del video» (sin segundos ni proyecto) hace que MaKo pregunte UNA cosa con opciones en vez de proponer un corte por defecto. Test. | 1 | S |
| 4. La propuesta del Video Editor como tarjeta en el chat. linksDeUnaAccion captura /video-editor/<proy>?propuesta=<id>, la respuesta del turno lleva las filas (extra.cambios), y el link ?propuesta= abre ESA propuesta (hoy abre el panel con todas). | Un pedido desde el Ops Center deja una tarjeta «Original | Modificado» con «Aceptar en el editor», que abre el editor en esa propuesta. Mirado en el navegador con las migraciones 0298–0302 aplicadas. | 1, 2 y los bloques de Ops Center 3 | M |
| 5. Image Editor: las 18 operaciones del chat «MaKo IA» pasan a la API (área imagen, confirmación en el chat). Escriben el diseño en el server con aplicarOperaciones y compare-and-set. ver_diseno_imagen devuelve la vista con refs y la miniatura. | «cambiá el color de fondo del flyer a azul» deja una tarjeta. Al confirmarla, el diseño guardado cambia y un editor abierto lo recibe sin pisar nada. Test probado rompiéndolo. | 1 | M |
| 6. Bloques del área sobre el sistema de bloques de Ops Center 3: galería de proyectos y diseños, elegir entre 3 con vista previa, reproductor de video 9:16, tarjeta de costo, tarjeta del puente Flow, «Original | Modificado» con miniatura. | Cada bloque sale de un campo estructurado de la respuesta del turno, no del texto del modelo. Se dibuja en ChatSecondBrain en la computadora y en el celular (Android). Visto en el navegador. | Ops Center 3 (pieza única del chat y sistema de bloques) | L |
| 7. Crear y abrir proyectos desde el chat: abrir_en_editor_video (anuncio, toma o montaje, vía /video-editor/nuevo?desde=) y proyecto_nuevo_video (vacío, o con plantilla y huecos llenos) como propuesta que el editor crea al abrir el link. | «armame un video con la plantilla de testimonio» (después del «sí») termina en una tarjeta que abre un proyecto nuevo con la plantilla y los textos dictados. | 4 | M |
| 8. Video Generator: escrituras por el canal app, con la sesión del dueño. Generar y regenerar el plan, editar una toma, imagen de escenario (generar, elegir, otro fondo, confirmar), filmar UNA toma con tarjeta de costo, releer el saldo. | Desde el Ops Center se filma una toma confirmando la tarjeta «N créditos, te quedan M», y vuelve como reproductor con «Seguir con la próxima». Nunca se encola más de una toma por confirmación. | 6 y la decisión de Martín sobre la confirmación de gasto | L |
| 9. Montaje: desplegar worker/montar-cola.mjs (Infra) más la operación montar_anuncio_video y el mini editor de cortes. | Un anuncio montado desde el chat aparece como reproductor y la cola de montaje no tiene trabajos esperando más de 10 minutos (hoy hay uno de 68.646 min). | Infra (despliegue del worker) y 8 | L |
| 10. «Editar» = el chat del Ops Center a la derecha de cada editor. PanelChat.tsx y PanelMakoIA.tsx migran a la pieza compartida, y los hilos video_editor_chats e image_editor_chats entran al índice de chats. | Abrir un proyecto o un diseño muestra el chat del Ops Center con eso atado como contexto, y la conversación aparece en la lista del Ops Center. El test de Ops Center 3 que prohíbe chats propios queda en verde. | Ops Center 3 (pieza única) | M |
| 11. Avatar y voz por chat (pieza 6 del plan de la llamada). Fotos adjuntas pasan a fotos de cara; acento y muletillas; looks; video con avatar; voces; muestra de voz por audio y clon con consentimiento. | Con fotos y una nota de voz en el chat se llega a un look listo y a una voz clonada, cada paso confirmado en su tarjeta. | Que Martín decida abrir AI Avatar, adjuntos de audio en el chat, y 6 | L |
| 12. Exportar y descargar sin entrar a la tab. Interino: «Exportar» y «Descargar» abren el editor con la exportación lista (?exportar=). De fondo: material en la nube y render en el server. | «descargá el video Promo en 1080» y «descargá el flyer en PNG» dejan un botón que termina en el archivo descargado. | 4 y 5. Para el render en server, la decisión de Martín | M |
| 13. Lo que al motor le falta, por tandas: borrar silencios por chat, estilo de los subtítulos, música y stickers de biblioteca, texto a voz y avatar en el editor, imágenes y logo en los diseños, Image Generator por Flow. | Cada capacidad sale de NO_SE_PUEDE_CHAT o NO_SE_PUEDE_CHAT_IMAGEN al pasar al catálogo y a la API, con su test. | 1–6 | L |
