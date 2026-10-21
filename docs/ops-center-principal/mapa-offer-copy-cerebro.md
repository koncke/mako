# Mapa del Ops Center · offer-copy-cerebro

Parte de [docs/ops-center-principal.md](../ops-center-principal.md) (20/10/2026). Medido en sólo lectura sobre C:/dev/wt-push-q. Lo «sin_verificar» no se afirma.

**Chat responsable:** El área tiene dos dueños: «Offer» lleva la oferta, el PDF y el diagnóstico de fase; «Second Brain» lleva el grafo, El Archivero y las áreas del negocio. Copywriting (Ads Writer, Carousels, Reels, Stories) no tiene chat abierto: propongo que lo tome «Offer» o abrir «Copywriting». Lo transversal es de otros: el marco de bloques, la tarjeta para confirmar adentro y los sub-chats son de «Ops Center 3»; el clasificador de intención (lib/mako-intencion.ts) es de «MaKo WhatsApp».

**Tabs:**
- /offer — Offer: árbol funnel → oferta → conversación, chat pieza por pieza, Armar, conclusión, PDF, Guardar en funnels; secciones de super admin: Strategy (/admin/estrategia) y Offer Playbook (/admin/offer-playbook)
- /ads-writer — Copywriting › Ads Writer: vistas Anuncios (la matriz), Guiones y Analizar guion; Copy Method (/admin/copywriting, sólo super admin); Ideas (/ideas) y YouTube Writer (/youtube-writer) están «Próximamente»
- /carousels — Carousels (dentro de Image, para todos los clientes)
- /reels — Reels (dentro de Video, adminOnly)
- /stories — Stories (dentro de Copywriting, adminOnly)
- /second-brain — el Ops Center del cliente (el chat) y el Mapa, sólo para el admin. Áreas que se editan ahí (lib/secciones-negocio.ts): Norte/Diagnóstico de fase, Documentos/El Archivero, Panorama, Oferta (la entidad y el brief), Cliente, Productos, Lead Magnet, Avatares, Razones (Matriz, Razones, Ángulos), Voz (Personalidad, Persona) y Funnel (es del CRM)

**Hoy:** 48 acciones · sí 2 · parcial 20 · no 24 · sin verificar 2.

## Acciones

| Acción | Operación de la API | Hoy | Falta | Bloque en el chat | Tam. |
|---|---|---|---|---|---|
| Offer · Abrir el árbol funnel → oferta → conversación y retomar una conversación | listar_analisis_oferta (sólo lista); abrir o retomar: null | parcial | herramienta, bloque | Selector en tarjeta (funnel → ofertas → conversaciones) con «Retomar acá» y «Abrir en Offer» | M |
| Offer · Empezar una conversación nueva para un funnel (o desde una oferta base) | null (acción 'nueva' de /api/offer) | no | herramienta, bloque | Elegir el funnel entre tarjetas | S |
| Offer · Conversar pieza por pieza: una pregunta por mensaje, respuestas rápidas tocables (se pueden marcar varias), audio | null (motor propio lib/offer-ia.ts, prompts offer.turno y offer.arranque) | no | herramienta, bloque | Chips de respuestas rápidas con multiselección y «Otro» (los de app/offer/ChatOffer.tsx:350), dentro del hilo del Ops Center | L |
| Offer · Mandar un documento, un audio o el link de su web para que MaKo lo lea y complete piezas | null (acciones leer, leer-link y /api/offer/audio) | parcial | herramienta, bloque | Chip del archivo con el estado «leyendo → leído» y «aportó: cliente, precio…» | M |
| Offer · Ver el riel de piezas (mínimas, hechas, provisorias) | ver_analisis_oferta (la conclusión); las piezas en curso, sin verificar | sin_verificar | herramienta, bloque | Checklist de piezas (Cliente, Problema, Resultado, Entregables, Ventas, Prueba, Precio…) con su estado | S |
| Offer · «Armar mi oferta»: diagnóstico y propuesta en el servidor, con aviso al terminar | null (acción 'armar') | no | herramienta, confirmacion, bloque | Tarjeta «Armando tu oferta…» con progreso, que al terminar se reemplaza sola por la conclusión | M |
| Offer · Ver la conclusión: puntaje 0-100, nota por dimensión, «Qué falta para venderla» y «Oferta nueva» | ver_analisis_oferta | parcial | bloque | Tarjeta de conclusión: aro del puntaje, barras por dimensión que se despliegan, «Qué falta», pestañas PDF/Diagnóstico/Oferta nueva y botones Descargar PDF · Seguir afinando · Guardar en funnel · Abrir en Offer (se reusa app/offer/Conclusion.tsx) | M |
| Offer · Descargar el PDF (el del dueño y «PDF para tu cliente») y ver versiones anteriores | null | no | herramienta, bloque | Visor del PDF embebido (app/offer/VistaPdf.tsx) con selector de versión y los dos botones de descarga | M |
| Offer · Guardar la oferta en uno o varios funnels | guardar_oferta_analisis (se confirma en el chat) | parcial | bloque | La tarjeta de confirmación con los funnels para marcar (ElegirFunnels) | S |
| Offer · Seguir afinando / Pulir una versión | null | no | herramienta | Botón «Seguir afinando» en la tarjeta de conclusión, que reabre el turno de Offer en el hilo | S |
| Offer · Renombrar o borrar una conversación | null | no | herramienta, confirmacion | Menú ⋯ de la conversación en la barra del Ops Center; para borrar, tarjeta «No se puede deshacer» | S |
| Offer · «Probarlo»: abrir un experimento con la hipótesis de un cambio propuesto | crear_experimento (área experimentos); no verifiqué que viaje | sin_verificar | bloque | Botón «Probarlo» por cada cambio de la tarjeta de conclusión → tarjeta de confirmación del experimento | S |
| Offer y Second Brain › Norte · Hacer o rehacer el diagnóstico de fase (6 preguntas de 5 opciones) y ver la fase | listar_preguntas_diagnostico_fase, guardar_diagnostico_fase (se confirma en pantalla), ver_diagnostico_fase | parcial | herramienta, confirmacion, bloque | Pregunta cerrada de a una con sus 5 opciones tocables y, al final, la tarjeta «Fase N · cuello · qué no hacer todavía» | M |
| Offer y Copywriting (super admin) · Leer Strategy, Offer Playbook y Copy Method | null | no | bloque | Link «Abrir en la app» (son pantallas de lectura del criterio) | S |
| Copywriting › Ads Writer · Ver la matriz avatar × razón y la cobertura («12 de 18 anuncios con guion») | listar_anuncios_planteados, cobertura_guiones_anuncio, ver_anuncio_planteado | si | bloque | Mini matriz avatar × razón con los huecos marcados y la cobertura arriba; tocar una celda abre su guion | M |
| Ads Writer · «Escribir el próximo guion» (la primera celda sin guion) | escribir_guion_anuncio_auto (se confirma en el chat) | parcial | herramienta, bloque | Tarjeta del guion por bloques (GANCHO · HISTORIA · CTA) con su estado, Copiar, Aprobar, Editar y «Abrir en Ads Writer» | M |
| Ads Writer · Escribir un guion eligiendo ángulo, estructura, siguiente paso y nota (o con la sugerencia de MaKo) | sugerir_guion_anuncio, catalogo_angulos_guion, catalogo_estructuras_guion, opciones_siguiente_paso_guion, escribir_guion_anuncio (se confirma en pantalla) | parcial | confirmacion, bloque | Elegir entre 3 ángulos y 3 estructuras como tarjetas, con «cuándo conviene», antes de escribir | M |
| Ads Writer · Corregir el texto de un guion | editar_texto_guion_anuncio (se confirma en pantalla) | parcial | confirmacion, bloque | Antes y después del bloque cambiado, con Aceptar en el hilo | S |
| Ads Writer · Mover un guion de estado (borrador → aprobado → grabado → publicado) | mover_estado_guion_anuncio (se confirma en el chat) | parcial | herramienta, bloque | Los estados en fila dentro de la tarjeta del guion | S |
| Ads Writer · Borrar un guion | borrar_guion_anuncio (se confirma en pantalla, no se deshace) | parcial | confirmacion | Tarjeta de confirmación con «No se puede deshacer» en el hilo | S |
| Ads Writer · Leer, copiar, descargar en .md y filtrar guiones (ángulo, avatar, fecha, estado) | listar_guiones_anuncio, leer_guion_anuncio | si | bloque | Lector del guion con Copiar y Descargar .md; lista filtrable por estado | S |
| Ads Writer y Second Brain › Razones · Generar las razones de compra y editar las celdas de la matriz (nombre, descripción, copy) | null | no | herramienta, confirmacion, bloque | Tabla avatar × razón editable, con un «Regenerar» que avisa que reemplaza la matriz | M |
| Ads Writer y Second Brain › Ángulos · Elegir el formato de creativo de un anuncio o pedir los recomendados | listar_formatos_creativo, elegir_formato_creativo_anuncio y recomendar_formatos_creativo (se confirman en el chat) | no | herramienta, bloque | Galería de formatos (imagen y video) con su ejemplo y «Elegir» | S |
| Ads Writer › Analizar guion · Valorar un guion pegado | valorar_guion_nuevo (área ads) | parcial | herramienta, bloque | Tarjeta de valoración con nota por criterio y qué cambiar | S |
| Ads Writer › Analizar guion · Sincronizar, editar ángulos y avatares del análisis y borrar del historial | proponer_sincronizar_guiones (chat); proponer_agregar/editar/borrar_angulo y _avatar y proponer_borrar_guion_valorado (pantalla) | no | herramienta, confirmacion | Tarjeta de confirmación en el hilo | S |
| Carousels · Generar un carrusel (tema + tipo: educativo, storytelling o venta): slides con texto y nota de diseño, y el caption | null (el motor existe: lib/ig-writer.ts, generarPieza) | no | herramienta, bloque | Carrusel navegable slide a slide (texto + nota de diseño), caption, Copiar todo y «Abrir en Carousels» | M |
| Carousels · Editar una slide, su nota de diseño o el caption, y copiar | null | no | herramienta, bloque | Mini editor de la slide dentro de la tarjeta del carrusel | S |
| Carousels y Stories · Volver a una pieza anterior (historial) | null | no | motor, herramienta | Riel «Lo que hizo» con las piezas anteriores | S |
| Reels (sólo super admin) · Generar el guion de un reel (tema, objetivo, duración): hook doble, escenas y caption | null | no | herramienta, bloque, permiso | Guion del reel por escenas con tiempos; el hook con la frase y el título en pantalla; caption, Copiar y «Llevar al Video Editor» | M |
| Reels · Pedir otra versión con feedback y ver el historial | null | no | herramienta | «Otra versión» en la tarjeta del reel; la anterior queda en el riel | S |
| Stories (sólo super admin) · Generar la secuencia del día (objetivo + idea) como storyboard | null | no | herramienta, motor, bloque, permiso | Storyboard: tarjetas verticales 9:16, una por story, con texto, sticker o encuesta y CTA | M |
| Ideas y YouTube Writer (hoy «Próximamente») | null | no | motor, herramienta, bloque | Lista de ideas para elegir y convertir en pieza; guion de YouTube por capítulos | L |
| Second Brain · Las preguntas de arranque del Ops Center («¿Qué hago hoy?», «¿Cómo viene el mes?», «¿Qué sabes de mi negocio?») | indice_segundo_cerebro, recuperar_del_segundo_cerebro, contexto_negocio | parcial | herramienta, bloque | Apertura que propone en 3 tarjetas: «vi que tu negocio es X, ¿empezamos con A, B o C?» | M |
| Second Brain · Ver el Mapa, filtrar por carpetas o capas y tocar un nodo para ver su detalle | indice_segundo_cerebro, recuperar_del_segundo_cerebro (la vista local) | parcial | bloque | Vista local del grafo (el nodo y sus vecinos, con los colores de su área) como tarjeta, con «Abrir el Mapa» | M |
| Second Brain · Buscar en el cerebro | buscar_en_segundo_cerebro | parcial | herramienta | Resultados como lista de nodos con su área y «Ver en el Mapa» | S |
| Second Brain · Exportar el ZIP (el vault de Obsidian) del recorte filtrado | null | no | herramienta, bloque | Botón de descarga del ZIP en la tarjeta | S |
| El Archivero · Subir documentos (PDF, imagen, Word, Excel) para que MaKo complete el brief | null | parcial | herramienta, motor, bloque | Chip del documento con el estado «leyendo → leído», «aportó N campos» y link a Documentos | M |
| El Archivero · Agregar una web o un Instagram para que lo lea | null | no | herramienta | Chip del link con lo que se leyó, o «no se pudo leer» (con las reglas de lib/archivero-webs.ts) | S |
| El Archivero · Ver los documentos y el resumen (Panorama), y abrir o descargar uno | ver_archivero, obtener_link_documento_archivero, contexto_negocio | parcial | herramienta, bloque | Lista de documentos con ícono, fecha, qué aportó y Ver/Descargar | S |
| El Archivero · Borrar un documento | borrar_documento_archivero (se confirma en pantalla, no se deshace) | parcial | confirmacion | Tarjeta «borrar X: se recalcula el perfil y no se deshace» en el hilo | S |
| El Archivero · Completar los huecos del perfil (preguntas cerradas de a una, «Otro», «Terminar») | generar_preguntas_huecos_perfil, guardar_campo_perfil (se confirma en pantalla) | parcial | herramienta, confirmacion, bloque | Pregunta cerrada de a una con 2 a 4 opciones tocables, «Otro» y «Saltear» | M |
| Second Brain › Oferta y Cliente (el brief) · Corregir un dato que ya está cargado | guardar_campo_perfil sólo llena campos VACÍOS; para corregir uno lleno: null | no | herramienta, confirmacion, bloque | Tarjeta del campo: el valor de hoy, de dónde salió (documento o edición) y el nuevo, con Aceptar | M |
| Second Brain › Oferta · La oferta del negocio: sugerirlas con IA, editarla (precio, cobro, bonos, urgencia, garantía), marcarla principal, borrarla, ligar o desligar funnels y productos, crear un funnel | null para editar, borrar, marcar principal y ligar. crear_oferta_lead y asignar_oferta_lead sólo sirven atadas a un lead; guardar_oferta_analisis, sólo desde una conversación de Offer | no | herramienta, confirmacion, bloque | Ficha de la oferta con sus campos editables y los funnels y productos ligados como chips | L |
| Second Brain › Productos · Armar el catálogo con IA, editar y borrar productos | sugerir_productos y borrar_producto (pantalla), guardar_producto (área crm, pantalla), listar_productos | parcial | confirmacion, bloque | Los productos propuestos como tarjetas para aceptar o descartar de a uno | M |
| Second Brain › Lead Magnet · Generar de 1 a 3, responder sus preguntas y editarlo | listar_lead_magnets, siguiente_pregunta_lead_magnet, generar_lead_magnets y editar_lead_magnet (pantalla); «describir un archivo»: null | no | herramienta, confirmacion, bloque | Elegir entre 3 lead magnets, cada uno con su línea de FOMO | M |
| Second Brain › Avatares · Ver, afinar con preguntas, regenerar, editar y borrar | listar_avatares_negocio, siguiente_pregunta_avatares, afinar_avatares, generar_avatares, editar_avatar_negocio, borrar_avatar_negocio (todas las escrituras se confirman en pantalla) | parcial | herramienta, confirmacion, bloque | Los 3 avatares lado a lado (segmento, dolor, cómo encontrarlo en Meta) con Editar y un «Regenerar» que avisa | M |
| Second Brain › Voz · Quiz de personalidad, muletillas y reiniciar | ver_pregunta_personalidad, responder_pregunta_personalidad (chat), guardar_muletillas_marca y reiniciar_personalidad (pantalla), ver_personalidad_voz | no | herramienta, bloque | Pregunta del quiz con sus frases de anuncio para tocar, de a una | S |
| Second Brain › Voz › Persona · Subir fotos de la cara de marca, describirla, editar la descripción y borrar una foto | ver_cara_de_marca, guardar_descripcion_cara_de_marca y borrar_foto_cara_de_marca (pantalla); subir y describir una foto: null | no | herramienta, confirmacion, bloque | Galería de fotos con la descripción física editable | M |

## La inteligencia del chat de esta área

QUÉ SABE YA (no lo vuelve a pedir):
- El system de cada turno ya trae el perfil, la fase, el trimestre, el RAG y el funnel (buildSystemPrompt, lib/mako-context.ts).
- BUG verificado: rotula el perfil «NEGOCIO DE MARTÍN (perfil del cliente)» en TODOS los workspaces (lib/mako-context.ts:100). Hay que cambiarlo por el nombre del negocio, y ese nombre se confirma antes de escribirlo (caso Florencia del 20/10, «mi marca personal:»).

QUÉ LEE ANTES DE ACTUAR:
- Datos del negocio: indice_segundo_cerebro (~300 tokens) y después recuperar_del_segundo_cerebro con la pregunta. Nunca leer_segundo_cerebro_como_archivos para contestar (AGENTS.md:1578).
- Contenido:
  - estado_contexto_contenido: si el perfil no está listo, decirlo con lo que falta.
  - Los avatares (listar_avatares_negocio), la matriz (listar_anuncios_planteados), la voz (ver_personalidad_voz y las muletillas), la oferta vigente (ver_analisis_oferta) y el lead magnet.
  - Para Instagram, limites_formato_instagram.
  - generarPieza ya arma su propio brief (buildContenidoBrief: funnel + perfil + conocimiento): no se duplica.
- Oferta: UN solo lector, lib/offer-contexto.ts (perfil, panorama del Archivero, oferta principal, ofertas, productos, fase, funnels, avatares, razones).
  - `oferta_ticket` es texto libre: jamás parseFloat.
  - Cada número dice de dónde sale, o no aparece (hallazgo #888, «el 43»).

QUÉ PREGUNTA EN VEZ DE INVENTAR (es la lección del 20/10: «todos los martes a las 3 a todo el funnel», y MaKo armó otra cosa con pasos por defecto):
- Carrusel, reel o story sin tema, tipo, objetivo o duración: UNA pregunta con 3 opciones a medida del negocio. Si la herramienta del formato no está en el turno, lo dice; NUNCA cae a escribir_guion_anuncio_auto (hoy pasa: tras el «sí» a un carrusel viajan sólo las de guion de anuncio).
- Lo que el pedido trae y la herramienta no puede cumplir («7 slides», «30 segundos», «todos los martes»): avisarlo ANTES de proponer, que es lo que faltó con «martes 15:00».
- Guion para «el anuncio de X» cuando dos celdas se parecen: preguntar cuál. Nunca «el de nombre más parecido» (el error de Automations del 20/10). «El próximo» sí usa proximaCeldaDe (app/ads-writer/reglas.ts).
- Precio, ventas, prueba, garantía y urgencia son HECHOS del dueño: si no están, se preguntan; nunca «sin dato:» en el PDF ni respuestas rápidas inventadas guardadas como dato.
- La urgencia no se deduce: su tipo cerrado (fecha, cupos, capacidad, inicio) lo declara el dueño.
- Guardar la oferta con más de un funnel: preguntar en cuáles.
- Corregir un campo ya cargado: mostrar el valor de hoy y su fuente, y preguntar.
- Fase: las 6 preguntas con sus 5 opciones originales, una por vez. Nunca deducir la fase de la conversación.
- Regenerar algo que reemplaza una lista entera (avatares, razones, matriz, lead magnets, catálogo) y paga IA: preguntar siempre.

QUÉ NO HACE NUNCA:
- Escribir un guion de anuncio cuando le piden un carrusel, un reel, stories o YouTube.
- Decir «vi tu Instagram» o «leí tu web» sin haberlo leído, ni dar por guardado en El Archivero lo que `archivero.ok` no confirmó.
- Borrar un documento, un guion, un avatar, un producto o una conversación sin la tarjeta «No se puede deshacer».
- Guardar en los datos del negocio lo que propuso MaKo sin el sí de la persona: un canal propone, una persona confirma.
- Partir el cerebro en dos ni dibujar un segundo grafo.
- Mandar datos de clientes del negocio a la red gratis (turnoParaLaRed). Los writers de Instagram sí corren por la red de plataforma (redDePlataforma: true en lib/ig-writer.ts) porque usan sólo material del negocio. Offer corre con las keys del cliente (chatCheapCascade, lib/offer-ia.ts:7).
- Mostrarle a un closer o setter el Mapa, las áreas o la plata (esAdminDeTab, sinNumerosDelNegocio).
- Escribir con la voz de MaKo lo que va al público: la voz es la del NEGOCIO (lib/offer-ia.ts:86).

QUÉ SE REUSA:
- Prompts del registro (lib/prompt-registry.ts):
  - offer.turno, offer.arranque, offer.diagnostico, offer.propuesta y offer.lectura (:1319-1368, motor lib/offer-ia.ts);
  - ofertas.system/user (lib/ofertas-ia.ts), productos.system/user (lib/productos-ia.ts);
  - archivero.extract.system, onboarding.extract.system;
  - mako.modo.guiones, script_analyst.valoracion.*.
- Motores:
  - lib/ig-writer.ts (generarPieza) + lib/ig-formatos.ts (la metodología por formato). OJO: sus templates NO están en el registro (TODO en el encabezado).
  - app/reels/reels-datos.ts (historial), lib/razones.ts (generarRazones), lib/guion-*.ts (ángulos, estructuras, cierre, estado).
  - lib/avatares.ts, lib/entregable.ts, lib/personalidad*.ts, lib/persona.ts, lib/fase-diagnostico.ts y lib/fase-store.ts.
  - lib/archivero*.ts (archivero-webs para los links), lib/cerebro-recuperar.ts, lib/vault.ts (el ZIP).
  - lib/offer-sesiones.ts, lib/offer-pdf.ts, lib/offer-reglas.ts (alertas, números con fuente) y lib/offer-marco.ts (las piezas mínimas).
- Pantallas para los bloques: app/offer/Conclusion.tsx, VistaPdf.tsx, ChatOffer.tsx; app/onboarding/*View.tsx; app/ads-writer/GuionLector.tsx; app/carousels/CarouselsApp.tsx.
- Hoy lib/doer-recetas.ts no tiene NINGUNA receta del área: faltan CONTENIDO, OFERTA y CEREBRO, y cada una viaja sólo con su herramienta.

## Bloques nuevos

- Tarjeta de conclusión de Offer: aro del puntaje, barras por dimensión, «Qué falta», pestañas PDF/Diagnóstico/Oferta nueva y Descargar · Seguir afinando · Guardar en funnels · Abrir en Offer (se reusa app/offer/Conclusion.tsx)
- Visor del PDF de Offer con selector de versión y «PDF para tu cliente» (se reusa app/offer/VistaPdf.tsx)
- Chips de respuestas rápidas con multiselección y «Otro» (se reusa app/offer/ChatOffer.tsx:350)
- Pregunta cerrada de a una con opciones tocables, «Otro» y «Saltear»: diagnóstico de fase, huecos del Archivero, quiz de voz, avatares y lead magnet. Un solo bloque para los cinco
- Tarjeta de resultado de fase: «Fase N · cuello · qué no hacer todavía»
- Tarjeta de guion de anuncio por bloques (GANCHO · HISTORIA · CTA) con los estados en fila, Copiar, Descargar .md, Editar y «Abrir en Ads Writer»
- Mini matriz avatar × razón con huecos y cobertura
- Elegir entre 3 (ángulos, estructuras, formatos, avatares, lead magnets, productos propuestos) como tarjetas
- Antes y después de un cambio de texto (guion, campo del brief, precio de la oferta) con Aceptar en el hilo
- Carrusel navegable slide a slide con nota de diseño, caption y Copiar todo (se reusa el visor de app/carousels/CarouselsApp.tsx)
- Guion de reel por escenas con tiempos y hook doble, y «Otra versión»
- Storyboard de stories en tarjetas verticales 9:16
- Riel «Lo que hizo» con las piezas anteriores (carruseles, reels, stories, guiones)
- Chip de documento del Archivero con el estado «leyendo → leído» y «aportó N campos»
- Lista de documentos del Archivero con Ver y Descargar
- Vista local del grafo (nodo + vecinos) con «Abrir el Mapa»
- Botón de descarga del ZIP del Second Brain
- Ficha de la oferta (la entidad) editable, con funnels y productos ligados
- Apertura del Ops Center que propone 3 cosas para hacer

## Decisiones para Martín (las de esta área)

- Confirmar adentro: ¿qué acciones del área pasan de /mako/revisar a la tarjeta del chat? Hoy 18 de 24 se confirman afuera (75%). Propuesta: todo lo reversible pasa al chat; borrar, y regenerar lo que reemplaza una lista y paga IA, también al chat, con «No se puede deshacer».
- Offer dentro del Ops Center: ¿la conversación se continúa ahí, como sub-chat con el motor de Offer y las keys del cliente, o queda de sólo lectura con «Abrir en Offer»? La decisión 5 del diseño del 16/10 dijo «Offer no se muda».
- Reels y Stories hoy los ve sólo el super admin en la barra: ¿se abren a los clientes por el Ops Center?
- ¿Las piezas de Instagram se guardan? Hoy Carousels y Stories pierden el historial al recargar. Propuesta: sí, como Reels.
- Ideas y YouTube Writer están «Próximamente» y no tienen motor: ¿se construyen o se sacan?
- Carrusel visual: ¿sale como diseño del Image Editor (varias páginas) o se queda en texto?
- Corregir por el chat un dato YA cargado del brief: hoy guardar_campo_perfil sólo llena campos vacíos. ¿El chat puede pisar uno lleno con confirmación?
- Ángulos (FormatosView): ningún generador lee sus recomendaciones y cada «regenerar» paga IA. Está pendiente desde el 15/10: ¿se queda o se saca?

## Piezas, en orden

| Pieza | Hecho = | Depende de | Tam. |
|---|---|---|---|
| 1. Clasificador: que cada pedido del área traiga su herramienta. Sumar «quiero/necesito un carrusel, reel, story, contenido»; los verbos generá, regenerá, sincronizá y pasá a… como acción; las palabras fase, diagnóstico, archivero, documentos, second brain, cerebro, mapa, cara de marca y formato; y sacar «lead magnet» de la regex del CRM | tests/ops-center-contenido-negocio.test.ts corre las frases de este mapa por clasificarIntencion + herramientasDelChat (el turno que corre), cada una recibe su herramienta, y el test está probado rompiéndolo | nada (lo hace el chat MaKo WhatsApp, dueño del clasificador) | M |
| 2. Operaciones de Instagram en la API: generar_pieza_instagram (reel, carrusel o story, con tipo, objetivo y duración) y listar_piezas_instagram, sobre lib/ig-writer.ts. El historial de Carousels y Stories se guarda como el de Reels | «armame un carrusel educativo sobre X» en el Ops Center devuelve un CARRUSEL (no un guion de anuncio) y sigue en /carousels al recargar. Probado con el turno real | 1 | M |
| 3. Inteligencia del área en el turno: las recetas CONTENIDO, OFERTA y CEREBRO en lib/doer-recetas.ts; el rótulo «NEGOCIO DE MARTÍN» de lib/mako-context.ts:100 cambiado por el nombre del negocio; los templates de ig-writer movidos al registro de prompts | tests/doer-recetas.test.ts: cada receta viaja sólo con su herramienta, y el system de un workspace de cliente no dice «Martín» | 1 | S |
| 4. Bloques de contenido en el hilo: tarjeta de guion, carrusel navegable, reel por escenas, storyboard y el riel «Lo que hizo» | En el Ops Center, en escritorio y en el teléfono, se ve, se copia y se abre en su tab cada pieza creada | 2 y el marco de bloques de Ops Center 3 (la columna de bloques en chart_chats) | M |
| 5. Confirmar adentro: las acciones del área que hoy van a /mako/revisar se confirman con la tarjeta del hilo; las irreversibles, con «No se puede deshacer» | Ningún pedido del área devuelve un link a /mako/revisar; las 24 acciones se confirman en el hilo | la tarjeta de Ops Center 3 y la decisión de Martín sobre qué pasa al chat | M |
| 6. Bloque «pregunta cerrada de a una» sobre las operaciones que ya existen: diagnóstico de fase, huecos del Archivero, quiz de voz, preguntas de avatares y de lead magnet | «haceme el diagnóstico de fase» se contesta tocando las 6 preguntas en el hilo y termina en la tarjeta de la fase guardada | 1 y 5 | M |
| 7. Las operaciones de Offer que faltan: link_pdf_oferta (versión, externo), armar_oferta (avisa al terminar), nueva/abrir conversación, renombrar y borrar | «descargame el PDF de mi oferta» muestra el PDF de la última versión en el hilo, y «armame la oferta» la arma y avisa en el hilo al terminar | 1 | M |
| 8. Offer como sub-chat del Ops Center: la conversación sigue con el motor de lib/offer-ia.ts (chips, audio, documentos), con la tarjeta de conclusión y el visor del PDF | Una conversación de Offer empieza, sigue y termina en el Ops Center sin abrir /offer, y la misma fila de offer_sesiones sigue en /offer | 7, el chat único de Ops Center 3 y la decisión de Martín (la decisión 5 decía «Offer no se muda») | L |
| 9. La oferta (la entidad), las razones y el brief por la API: editar_oferta, ligar y desligar funnel o producto, marcar principal, borrar_oferta, generar_razones_compra, editar_celda_razon y corregir un campo lleno del brief | «cambiá el precio de mi oferta a 500 USD por mes» propone ESE cambio en una tarjeta con el antes y el después, y nada más | 5 | L |
| 10. Second Brain en el chat: las preguntas de arranque usan indice y recuperar; vista local del grafo como bloque; exportar el ZIP; imágenes, Word y links a El Archivero con su chip | «¿qué sabes de mi negocio?» cita de 3 a 5 nodos del cerebro con su área y abre el Mapa en ese nodo; una imagen o un link mandado al chat queda en El Archivero con su chip | 1 | M |
| 11. Que proponga al entrar: un chat nuevo abre con 3 propuestas sacadas de la fase, los huecos y las piezas sin hacer | Al abrir un chat nuevo, MaKo propone 3 cosas concretas del negocio, cada una con su botón, sin que la persona escriba | 3 y 10 | M |
| 12. Lo nuevo, sólo si Martín lo decide: Ideas, YouTube Writer y el carrusel visual en el Image Editor (un diseño de varias páginas) | Lo que Martín apruebe se pide en el Ops Center y sale como pieza con su bloque | decisión de Martín | L |
