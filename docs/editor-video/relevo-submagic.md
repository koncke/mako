# Relevamiento de Submagic: subtítulos (leído de las páginas públicas)

Fecha: 2026-11-10. Leí con `curl` las páginas de docs, blog, ayuda y producto. Cada dato lleva su fuente.
Ojo: **la documentación pública NO publica los valores visuales** (escala, duración, rebote, colores, palabras
por renglón de cada estilo). Eso no está escrito en ningún sitio que pude abrir. Donde no hay dato lo digo.

## 1. Plantillas de subtítulos (nombres)

### Lista completa del endpoint `GET https://api.submagic.co/v1/templates` (42 nombres)
Fuente: https://docs.submagic.co/api-reference/templates.md (campo `templateName` al crear proyecto)

Matt, Jess, Jack, Nick, Laura, Kelly 2, Caleb, Kendrick, Lewis, Doug, Carlos, Luke, Leila, Mark, Sara,
Daniel, Dan 2, Hormozi 4, Dan, Devin, Tayo, Ella, Tracy, Hormozi 1, Hormozi 2, Hormozi 3, Hormozi 5,
Jason, William, Leon, Ali, Beast, Maya, Karl, Iman, Umi, David, Noah, Gstaad, Malta, Nema, seth

- Si no se pasa `templateName`, el default es `"Sara"` (https://docs.submagic.co/api-reference/create-project.md).
- La doc dice que cada template incluye: tipografía/tamaño/color/posición, efectos de animación
  (cómo entran y salen los subtítulos), formas de fondo/resaltados/decoración, paleta de colores,
  "cómo se muestran y animan los emojis" y alineación. No da valores por template.
  (https://docs.submagic.co/api-reference/templates.md)
- La API no ofrece previews de templates (misma página).
- El sitio habla de "35+ plantillas de animación que resaltan, rebotan y se desvanecen palabra por palabra"
  (https://www.submagic.co/ai-caption). Otra sección de la misma página dice "12+ estilos". Las cifras
  de marketing no coinciden; la API lista 42.
- Hay también `userThemeId` (tema personalizado propio) y "Brand Kit" (tipografía, colores y estilos de
  subtítulo guardados). Plantillas propias solo en planes Pro/Business
  (https://care.submagic.co/en/article/how-to-use-submagic-step-by-step-guide-pafx7o/).

### Plantillas "AI edit" (aparte, para `aiEditTemplate`)
Solo `kelly` (minimal, diseño), `karl` (efectivo, moderno), `ella` (dinámico, atrevido). Aplican
división de escenas, b-roll, música y estilo de una vez; con ellas solo se pueden pasar `title`, `language`,
`videoUrl`, `webhookUrl`, `dictionary`. (https://docs.submagic.co/api-reference/create-project.md)

### Lo único con características concretas: los estilos Hormozi
Fuente: https://www.submagic.co/blog/how-to-make-alex-hormozi-captions
- Estilo viejo de Hormozi: fuente TheBoldFont, **texto en mayúsculas, con sombra, sin contorno**.
- Estilo nuevo (Hormozi y Leila): fuente **Anton**, **mayúsculas, sombra leve, contorno amarillo,
  efecto "pop-in" de abajo hacia arriba**.
- "Hormozi usa un máximo de 4-6 palabras en 2 líneas" (instrucciones de la sección de Premiere Pro).
- Destaca palabras clave **cambiando color o tamaño**; para agrandar una clave se parte el subtítulo justo
  donde se dice la palabra y se agranda esa parte.
- El blog dice que en 2025 Submagic agregó "4 estilos Hormozi nuevos" (la API lista Hormozi 1 a 5).
  No dice cuál estilo es cuál.

## 2. Animación de la palabra activa

**No encontré valores.** Lo único textual: "plantillas que resaltan, rebotan y se desvanecen palabra por
palabra en sincronía con el video" (https://www.submagic.co/ai-caption) y "pop-in de abajo hacia arriba"
para el Hormozi nuevo (blog arriba). No hay números de escala, duración ni descripción de caja detrás de
la palabra por plantilla. Habría que verlo en el editor (requiere cuenta) o medir frames de videos de ejemplo.

## 3. Palabras clave / highlight

- El auto-editor "genera subtítulos, agrega emojis, **resalta palabras clave**, aplica animaciones e inserta
  b-roll" (https://www.submagic.co/features/auto-video-editor). No explica cómo elige ni cuántos colores usa.
- Manual: en el editor, "Edit Captions" permite "resaltar o enfatizar palabras específicas"; también
  cambiar color, fuente, peso y tamaño, mover o redimensionar subtítulos y corregir errores
  (https://care.submagic.co/en/article/how-to-use-submagic-step-by-step-guide-pafx7o/).
- El blog muestra colorear palabras clave a mano en Premiere/CapCut; es la lógica del estilo, no un dato de
  Submagic.
- Diccionario personalizado: `dictionary` (array) al crear el proyecto, para corregir términos
  (https://docs.submagic.co/api-reference/create-project.md; https://care.submagic.co/en/article/jbyav2/).

## 4. Emojis automáticos

- Existen: "agrega emojis animados, colores y GIFs" (listado de features en
  https://www.submagic.co/features/auto-zooms) y los templates incluyen "cómo se muestran y animan los emojis"
  (docs de templates).
- En el editor se pueden agregar o quitar a mano ("Add or remove emojis"), y hay un interruptor de emojis
  por estilo ("add emojis for personality") (guía de care.submagic.co arriba).
- La página de b-roll menciona "animar emojis con sonido" (https://www.submagic.co/features/auto-zooms).
- **No encontré**: frecuencia, si es uno por frase, si va encima o al lado del texto, ni la animación exacta.

## 5. Zooms, sonidos

### Magic Zooms / Auto zoom (https://www.submagic.co/features/auto-zooms y /features/b-roll)
- Un clic; la IA coloca zooms de entrada y salida en momentos clave según la transcripción; el botón es
  "Magic B-rolls" (agrega zooms + b-rolls + transiciones). También se agregan a mano con "+" en la línea
  del subtítulo.
- Estilos: la página de auto-zoom dice **6 estilos**; la de auto-edit dice **4 (smooth, crash, expo, linear)**;
  la de b-roll lista "fast zoom, crash out zoom, crash, smooth zoom in, expo zoom, linear zoom".
  Se pueden poner zooms "progresivos o rápidos" también sobre los b-rolls. Sin números de escala/duración.
- API: `magicZooms: boolean` (https://docs.submagic.co/api-reference/create-project.md).

### Sound effects (https://www.submagic.co/features/add-sound-effects-to-video)
- Biblioteca de **10 efectos** ("desde clics hasta whooshes"), subida de audio propio, control de volumen,
  inserción **línea por línea** con el ícono de parlante en una línea de subtítulo. Gratis.
- Dice que el audio de las transiciones se genera automático con los b-rolls. No hay opción de API listada.

## 6. B-roll automático (https://www.submagic.co/features/b-roll)
- "Magic B-rolls": la IA lee la transcripción e inserta clips relevantes de la biblioteca de stock
  integrada o de tus propios archivos; un slider controla la frecuencia.
- Manual: buscar por palabra clave; tipos: imágenes/videos libres o premium, GIFs, estáticas, o subir los
  propios; posición y duración; diseño (pantalla completa, esquinas redondeadas, etc.).
- Son **videos y también imágenes/GIFs** (ver layouts en API).
- API: `magicBrolls: boolean`, `magicBrollsPercentage` 0-100 (default 50); `items[]` con
  `type: "ai-broll"` + `prompt` (1-2500 caracteres) para B-roll generado por IA; media propia con
  `userMediaId`. Layouts de video: `cover, contain, rounded, square, split-50-50, split-35-65,
  split-50-50-bordered, split-35-65-bordered, pip-top-right, pip-bottom-right`; de imagen: `cover, contain,
  rounded, square`. (https://docs.submagic.co/api-reference/create-project.md)

## 7. Otros controles

Fuente de la API: https://docs.submagic.co/api-reference/create-project.md y update-project.md
- `captionPositionY` (0-80, % desde arriba) y `captionPositionX` (0-100, 50 = centro): sobrescriben la
  posición del template.
- `removeSilencePace`: `natural` (0.6+ s), `fast` (0.2-0.6 s), `extra-fast` (0.1-0.2 s). `removeBadTakes`
  (IA). `cleanAudio` (quita ruido). `disableCaptions`. `autoRender` (si es false puedes corregir el
  transcript antes de exportar).
- `hookTitle`: título de gancho animado al inicio (true o `{text 1-100, template, top 0-80 (def 50),
  size 0-80 (def 30)}`). Hook templates: tiktok, laura, steph, kevin, kelly, mark, logan, enrico, mike,
  devin, hormozi, masi, ali (https://docs.submagic.co/api-reference/hook-title-templates.md).
- `music` (userMediaId, volume, fade, startFromTime); presets (`presetId`); Magic Clips para clips
  desde YouTube/archivo.
- Edición del transcript por API: `words[]` con `id, text, type (word|silence|punctuation), startTime,
  endTime`; "el diseño de los subtítulos se recalcula" (update-project.md). Los silencios llegan como
  segmentos propios.
- Editor (https://care.submagic.co/en/article/how-to-use-submagic-step-by-step-guide-pafx7o/): elegir idioma
  y número de hablantes, trim, ajuste de brillo/saturación/temperatura, export 1080p/2K/4K a 30 o 60 fps.
- "Safe-zone": exports con colocación segura para que el texto no quede bajo la UI de la plataforma
  (https://www.submagic.co/ai-caption).
- **No encontré** "stagger/escalonado", número de líneas ni máximo de palabras por renglón por plantilla.

## 8. Lista de templates de la API
Ver la sección 1 (42 nombres, copiada tal cual) y los 13 hook templates en la sección 7.

## Lo que no pude ver

- Valores de la animación de palabra activa (escala, duración, rebote, caja) y detalles por plantilla:
  no están en docs ni en el sitio; solo se ven en el editor con cuenta o en videos de ejemplo.
- Cómo elige la IA las palabras clave, cuántos colores usa, y la lógica de frecuencia/posición de emojis.
- Páginas sin respuesta (404): /auto-zoom, /sound-effects, /features/ai-captions, /features/subtitle-generator
  (las reales son /features/auto-zooms y /features/add-sound-effects-to-video).
- Los demás artículos de care.submagic.co y help.submagic.co solo los usé a través del índice: solo abrí la guía
  paso a paso y el de API (hay otros, como Magic Clips, no los abrí).
- Cualquier cosa tras login (el editor mismo, Brand Kit, el listado visual de estilos).
