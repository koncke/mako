# Video Editor: lo que se hace a mano y lo que se hace por prompt

Cada acción que una persona puede hacer a mano en el Video Editor, con la operación del chat del editor y de la API de
MaKo que la hace por prompt, o por qué todavía no. Pedido de Martín (27/10/2026): «toda acción que se puede hacer a
mano en el editor se tiene que poder hacer por prompt en MaKo».

**27/10/2026 · 81 acciones (las repetidas, agrupadas) · por prompt: 44 (con las 5 añadidas el 27/10) · falta: 30 · no se puede: 7**

- **Chat** = la operación del catálogo del chat del editor (`lib/editor-video/chat-catalogo.ts`, `OPERACIONES_CHAT`).
  Desde el 27/10 el chat tiene «Discutir | Editar»: en Discutir contesta sin tocar nada; en Editar arma una propuesta
  que se acepta o se descarta entera, y «Restaurar» la vuelve atrás.
- **API** = la operación de la API de MaKo (`lib/editor-video/chat-api.ts`, `OPERACIONES_API`; WhatsApp, `/api/v1`, la
  skill). PROPONE y la persona la acepta en el editor: el proyecto vive en su navegador.
- **Lo que el chat dice que no puede** está en `NO_SE_PUEDE_CHAT` (mismo archivo). Hay que tenerlo al día con esta lista.
- **No se cuentan:** lo que se dibuja apagado («Próximamente»: Subtítulos bilingües, Emojis de IA, Resaltar palabras
  clave, Eliminación personalizada, Efectos corporales, Voz a canción), Música y Efectos de sonido (vacías: no hay
  catálogo con licencia) y las preferencias (atajos de teclado).
- El ≈160 de `docs/hallazgos-video-editor.md` cuenta cada atajo, botón y parámetro por separado; acá van agrupados.

## Línea de tiempo

| Acción a mano | Por prompt (chat · API) | Estado |
|---|---|---|
| Dividir (botón, atajo, menú) · Dividir todo | `dividir` · dividir_clip_video | cubierta |
| Arrastrar los bordes de un clip · Borrar a la izquierda / a la derecha | `recortar` · recortar_clip_video | cubierta |
| Eliminar | `borrar` · borrar_elementos_video | cubierta |
| Mover un elemento en el tiempo (arrastrar; Cortar y Pegar) | `mover` · mover_elemento_video | cubierta |
| Alargar o acortar un texto, una imagen, un sticker o una capa | `duracion` · cambiar_duracion_video | cubierta |
| Copiar y Pegar · Duplicar | `duplicar` · duplicar_elemento_video | añadida 27/10 |
| Copiar atributos · Pegar atributos | — | falta: una operación que pase filtro, ajustes, efectos, animaciones y transformación de un clip a otros |
| Reflejar | `reflejar` · reflejar_clip_video | cubierta |
| Congelar | `congelar` · congelar_cuadro_video | cubierta |
| Revertir | `revertir` · revertir_clip_video | cubierta |
| Recortar el encuadre (diálogo «Recortar») | — | falta: operación con el rectángulo del cuadro (`_opencut/recorte/cuadro.ts`). El `recortar` del chat ACORTA el clip, no lo encuadra |
| Ocultar · Silenciar · Activar/Desactivar el clip | `ocultar` + `silenciar` · ocultar_elemento_video, silenciar_clip_video | cubierta |
| Extraer / Recuperar el audio | `separar_audio` · separar_audio_video | cubierta |
| Reemplazar el clip | `reemplazar_clip` · reemplazar_clip_video | cubierta |
| Borrar silencios | — | falta: operación que mida el audio y corte, aplicada al final como `normalizar` (`_opencut/audio/borrar-silencios.ts`) |
| Marcar ritmos automáticamente | — | falta: operación sobre `_opencut/audio/ritmos.ts` |
| Marcadores (agregar, con color nuevo, ir al siguiente o al anterior) | — | falta: operación con el segundo y el color |
| Pista: bloquear, ocultar, silenciar | — | falta: operaciones por pista (hoy van por elemento) |
| Fotogramas clave (el rombo de cada propiedad y su panel) | — | falta: operación con tiempos y valores; hoy el chat no toca una propiedad que ya los tiene |
| Deshacer · Rehacer | «Restaurar» deshace lo que aplicó el chat | falta: deshacer lo hecho a mano (el historial vive en la pestaña) |
| Grabar (voz en off) | — | no se puede: necesita el micrófono de quien edita |
| Imán · Ajuste automático · Vinculación · Eje de vista previa · modo selección o división · zoom de la línea · seleccionar | — | no se puede: es el modo de trabajo de la pantalla, no cambia el video (el chat nombra cada elemento por su ref) |

## Panel derecho › Video

| Acción a mano | Por prompt (chat · API) | Estado |
|---|---|---|
| Transformación: escala, posición, girar, restablecer (también el botón «Girar» y arrastrar en el lienzo) | `transformar` · transformar_elemento_video | cubierta (escala X e Y por separado, no) |
| Mezcla: opacidad y modo (10) | `transformar` (opacidad, mezcla) · transformar_elemento_video | cubierta |
| Lienzo: color y desenfoque | `fondo_lienzo` · fondo_lienzo_video | añadida 27/10 |
| Lienzo: «Diseño» | — | falta: sumar «diseño» a `fondo_lienzo` |
| Máscara | — | falta: operación con la forma, la posición, el tamaño y el difuminado (`_opencut/masks/`) |
| Eliminar fondo › Eliminación automática (también en la barra de la línea) | `quitar_fondo` · quitar_fondo_video | añadida 27/10 |
| Eliminar fondo › Chroma key | — | falta: operación con el color y la intensidad |

## Panel derecho › Audio y Velocidad

| Acción a mano | Por prompt (chat · API) | Estado |
|---|---|---|
| Volumen (y los atajos de ±0,1 dB) | `volumen` · cambiar_volumen_video | cubierta |
| Fundido de entrada y de salida | `fundido` · poner_fundido_video | cubierta |
| Reducir el ruido | `reducir_ruido` · reducir_ruido_video | cubierta |
| Normalizar la intensidad (predeterminado, TikTok, YouTube) | `normalizar` · normalizar_audio_video | cubierta |
| Modificador de voz: filtros y personajes de voz, con sus perillas (tono, timbre…) | — | falta: operación con el id del filtro y sus valores (`_opencut/audio/voz.ts`) |
| Velocidad › Estándar: veces, duración, cambiar el tono | `velocidad` · cambiar_velocidad_video | cubierta |
| Velocidad › Curva: las predefinidas | `velocidad` (curva) · cambiar_velocidad_video | cubierta |
| Velocidad › Curva: mover los puntos a mano | — | falta: puntos en `velocidad` |

## Panel derecho › Animación, Transición, Ajustar, Filtros y Efectos

| Acción a mano | Por prompt (chat · API) | Estado |
|---|---|---|
| Animación de entrada, salida, combinada o en bucle, y su duración | `animacion` · poner_animacion_video | cubierta |
| Transición en un corte, su duración, «Aplicar a todo» (panel o biblioteca) | `transicion` · poner_transicion_video | cubierta |
| Ajustar › Básico: los 16 ajustes (temperatura … viñeta) | `ajustar_color` · ajustar_color_video | cubierta |
| Ajustar › HSL | — | falta: operación con color × matiz, saturación y luminosidad |
| Filtro del clip e intensidad (panel o biblioteca) | `filtro` · poner_filtro_video | cubierta |
| Efectos del clip: sumar y quitar (panel o biblioteca) | `efecto` · poner_efecto_video | cubierta (las perillas de cada efecto, no) |
| Filtro o efecto como capa en su propia pista | `capa_efecto` · agregar_capa_efecto_video | cubierta |
| Capa de ajuste («Agregar ajuste») | — | falta: tipo «ajuste» en `capa_efecto` |
| Guardar como predefinido · Mis elementos predefinidos · aplicar un LUT ya importado | — | falta: operación con el id del predefinido o del LUT |

## Panel derecho › Texto, Formas y Motion

| Acción a mano | Por prompt (chat · API) | Estado |
|---|---|---|
| Cambiar lo que dice | `cambiar_texto` · cambiar_texto_video | cubierta |
| Básico: fuente, tamaño, color, negrita, cursiva, subrayado, May./min., espaciado, interlineado, alinear | `estilo_texto` · cambiar_estilo_texto_video | cubierta |
| Trazo, Fondo, Sombra y Brillo: prenderlos, su color, grosor del trazo, opacidad del fondo | `estilo_texto` · cambiar_estilo_texto_video | cubierta |
| Las medidas finas: posición del trazo; esquinas, alto, ancho y corrimiento del fondo; opacidad, desenfoque, distancia y ángulo de la sombra; intensidad e intervalo del brillo | — | falta: esos campos en `estilo_texto` |
| Curva (curvar el texto) | — | falta: un campo «curva» en `estilo_texto` |
| Efectos de texto (21) · Plantilla de texto (12) | — | falta: operación con el id del estilo (`_opencut/text/`) |
| Texto a voz | — | falta: cobra en la ElevenLabs del cliente; va con confirmación en pantalla y rol admin |
| Formas: relleno, borde, esquinas, puntas, lados | — | falta: operación de estilo de forma |
| Motion: textos, tono, colores, fuente | `editar_motion` · editar_motion_video | cubierta |

## Subtítulos

| Acción a mano | Por prompt (chat · API) | Estado |
|---|---|---|
| Generar subtítulos (barra o biblioteca) | `generar_subtitulos` · generar_subtitulos_video | cubierta (con el idioma y la plantilla que estén elegidos) |
| Cambiar lo que dice un subtítulo | `cambiar_texto` · cambiar_texto_video | cubierta |
| Buscar y reemplazar | `reemplazar_en_subtitulos` · reemplazar_en_subtitulos_video | cubierta |
| Animaciones de subtítulos (karaoke) | `resaltar_palabras` · resaltar_palabras_video | cubierta |
| Identificar y eliminar las muletillas | `eliminar_muletillas` · eliminar_muletillas_video | cubierta |
| Edición basada en la transcripción (elegir y borrar) | `cortar_frase`, `cortar_tramo` · cortar_frase_video, cortar_tramo_video | cubierta |
| Elegir el idioma de origen · Plantillas de subtítulos | — | falta: el idioma en `generar_subtitulos` y una operación de plantilla |
| Ingresar subtítulos a mano · dividir y combinar | — | falta: `agregar_texto` pone un texto libre, no un subtítulo |
| Subtítulos locales (importar SRT, LRC, ASS) | — | no se puede: es un archivo del disco de quien edita |

## Biblioteca

Efectos, Filtros y Transiciones de la biblioteca van en sus filas del panel derecho.

| Acción a mano | Por prompt (chat · API) | Estado |
|---|---|---|
| Importar a Multimedia (o soltar archivos) | — | no se puede: es un archivo del disco de quien edita |
| Poner en la línea un video o una foto de Multimedia (el ⊕) | `agregar_medio` · agregar_medio_video | añadida 27/10 |
| Poner en la línea un audio de Multimedia · Extraer el audio de un video de Multimedia | — | falta: la vista lista sólo videos y fotos («medios»); hay que sumar los audios a la vista y a `agregar_medio` |
| Eliminar archivos de Multimedia | — | falta |
| Texto › Agregar texto | `agregar_texto` · agregar_texto_video | cubierta |
| Stickers (Tendencias, Emojis, Formas, Banderas) | — | falta: operación con el id del sticker |
| Plantillas › Anuncios («Utilizar plantilla») | `usar_plantilla` · usar_plantilla_video (y listar_plantillas_video) | cubierta (sólo con la línea vacía) |
| Plantillas › Motion | `agregar_motion` · agregar_motion_video | cubierta |
| Avatar de IA | — | falta: cuesta créditos de Flow; confirmación en pantalla y rol admin |

## Reproductor y lienzo

| Acción a mano | Por prompt (chat · API) | Estado |
|---|---|---|
| Relación: 16:9, 9:16, 1:1, 4:3, 3:4… | `formato_lienzo` · formato_lienzo_video | añadida 27/10 |
| Reproducir, avanzar, cuadro a cuadro, ir al corte, calidad, zoom, pantalla completa | — | no se puede: es la vista de quien edita |
| Exportar fotograma fijo · Copiar fotograma | — | no se puede: baja al disco o al portapapeles de quien edita |

## Proyecto y exportar

| Acción a mano | Por prompt (chat · API) | Estado |
|---|---|---|
| Ver y abrir proyectos | listar_proyectos_video, ver_proyecto_video (lecturas) | cubierta |
| Crear, renombrar, duplicar o eliminar un proyecto (Inicio) · «Detalles › Nombre» | — | falta: el proyecto vive en el navegador; una propuesta que el editor aplique al abrirse, como `crear_diseno_imagen` |
| Detalles: resolución y cuadros por segundo | — | falta: sumarlos a `formato_lienzo` |
| Portada (un cuadro del video) | — | falta: operación con el segundo del cuadro (la portada desde una imagen local, no se puede: disco) |
| Exportar (resolución, tasa de bits, códec, formato, fps, audio, GIF) · Exportar subtítulos SRT/TXT | — | no se puede: se codifica en el navegador de quien edita (WebCodecs) y el archivo baja a su disco |

## Lo que falta, en orden de lo que más se pide

1. **Poner un AUDIO de Multimedia en la línea** («agrega esta música»): los videos y las fotos ya van con `agregar_medio` (27/10); los audios no están en la vista («medios»).
2. **Fotogramas clave** (zoom que entra, texto que se desliza): operación con tiempos y valores por propiedad.
3. **Recortar el encuadre**: el rectángulo de `recorte/cuadro.ts`, con un nombre que no choque con `recortar`.
4. **Stickers y formas de la biblioteca**: operación con el id del catálogo y su caja en el lienzo.
5. **Borrar silencios**: operación que corre `audio/borrar-silencios.ts` al final, como `normalizar`.
6. **Copiar y pegar atributos** («el mismo estilo a todos los clips»): una operación que copia de una ref a varias.
7. **Efectos de texto, plantillas de texto, plantillas e idioma de subtítulos**: el id del estilo en `estilo_texto` y en `generar_subtitulos`.
8. **Texto a voz y Avatar de IA**: cuestan plata del cliente; van con confirmación en pantalla y `rolMinimo: 'admin'`.

## Lo que no se puede, y por qué

- **Importar archivos** (Multimedia, Subtítulos locales, LUT, portada local): el archivo está en el disco de quien edita; la IA no lo ve hasta que se sube.
- **Grabar**: necesita el micrófono de quien edita.
- **Exportar** (video, GIF, SRT/TXT, fotograma): se codifica en el navegador de quien edita y el archivo baja a su disco; la API corre en el servidor y no tiene el proyecto.
- **La vista y el modo de trabajo** (reproducir, zoom, pantalla completa, imán, vinculación, seleccionar): no cambian el video.
