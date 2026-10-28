# Image Editor: lo que se hace a mano y lo que se hace por prompt

Cada acción que una persona puede hacer a mano en el Image Editor (la copia de Canva, motor Doory), con la operación
del chat «MaKo IA» y de la API de MaKo que la hace por prompt, o por qué todavía no. Pedido de Martín (27/10/2026):
«toda acción que se puede hacer a mano en el editor se tiene que poder hacer por prompt en MaKo».

**27/10/2026 · 55 acciones (las repetidas, agrupadas) · por prompt: 23 · añadidas el 27/10: 2 nuevas (`voltear`, `ocultar`) y 19 más que pasaron del chat a la API (las del chat, salvo `cambiar_texto`, que ya era `cambiar_textos_diseno_imagen`) · falta: 28 · no se puede: 4**

- **Chat** = la operación del catálogo del chat (`lib/image-editor/chat/catalogo.ts`, `OPERACIONES_CHAT_IMAGEN`), con
  «Discutir | Editar»: en Discutir contesta sin tocar nada; en Editar arma una propuesta que se acepta o se descarta, y
  «Restaurar» la vuelve atrás.
- **API** = la operación de la API de MaKo (`lib/api-mako/areas/imagen.def.ts`; WhatsApp, `/api/v1`, la skill). Desde el
  27/10 el catálogo entero del chat está en la API como PROPUESTAS que se aceptan en el editor (ids `<op>_imagen`).
- **«cubierta (API 27/10)»**: el chat ya la hacía; la API la suma el 27/10.
- **Sólo por prompt, sin botón:** `crear_imagen` (crear_imagen_ia) y `editar_imagen` (editar_imagen_ia) dibujan o rehacen
  una imagen con la IA del negocio. Cobran en su cuenta: por la API las confirma en pantalla un admin.
- **Lo que el chat dice que no puede** está en `NO_SE_PUEDE_CHAT_IMAGEN` (mismo archivo). Hay que tenerlo al día con
  esta lista.
- **No se cuentan:** lo apagado en MaKo (Marca, Compartir, Comentarios, Historial de versiones y fotos de stock: sus
  servicios van en `null` en `mako/adaptadorNube.ts`; la biblioteca de Audio no está instalada), Guardar (se guarda
  solo) y los atajos de teclado.

## Riel izquierdo

| Acción a mano | Por prompt (chat · API) | Estado |
|---|---|---|
| Diseño › usar una plantilla en este diseño | — | falta: operación que cambie la página por la plantilla (`_doory/editor/panels/templateOps.ts`) |
| Elementos › rectángulo o círculo | `agregar_forma` · agregar_forma_imagen | cubierta (API 27/10) |
| Elementos › las demás formas, líneas, gráficos e íconos, stickers | — | falta: operación con el id del catálogo (`mako/elementos.ts`) |
| Elementos › marcos y marcador de imagen | — | falta |
| Elementos › gráficos de datos y código QR (contenido y colores) | — | falta |
| Texto › título, subtítulo, cuerpo, combinaciones de fuentes | `agregar_texto` · agregar_texto_imagen | cubierta (API 27/10) |
| Texto › texto curvo, lista con viñetas o numerada | — | falta |
| Subidos › subir una imagen o un audio (o soltarlo en el lienzo) · «Reemplazar imagen» desde el disco | — | no se puede: es un archivo del disco de quien edita |
| Subidos › poner una imagen ya subida o reemplazar con ella · borrar un subido | — | falta: operación con la ref del subido (`agregar_imagen` ya existe, interna) |
| Herramientas › Fondo › color (también «Aplicar a todas las páginas») | `fondo` · fondo_pagina_imagen | cubierta (API 27/10) |
| Herramientas › Fondo › degradado, patrón o imagen | — | falta |
| Proyectos › ver y abrir diseños | listar_disenos_imagen, ver_diseno_imagen (lecturas) | cubierta |
| Apps › Animar: animación de los elementos y transición de página | — | falta |
| Apps › Audio: poner, recortar, volumen y fundidos de un audio subido | — | falta |
| Apps › Audio › Grabar | — | no se puede: necesita el micrófono de quien edita |
| Capas: ocultar y mostrar | `ocultar` · ocultar_elemento_imagen | añadida 27/10 |
| Capas: renombrar | — | falta |

## Barra contextual (y menú del clic derecho)

| Acción a mano | Por prompt (chat · API) | Estado |
|---|---|---|
| Texto: cambiar lo que dice | `cambiar_texto` · cambiar_textos_diseno_imagen | cubierta |
| Texto: fuente, tamaño, color, negrita, cursiva, subrayado, alineación, mayúsculas, interlineado, espaciado | `estilo_texto` · estilo_texto_imagen | cubierta (API 27/10) |
| Texto: tachado · listas | — | falta: esos campos en `estilo_texto` |
| Texto › Efectos: Sombra, Contorno, Neón, Fondo, Hueco | — | falta: campos en `estilo_texto` (`engine/api/style.ts`, `setEffects`) |
| Texto › Curvar | — | falta (`setCurve`) |
| Imagen › Editar foto: Ajustar (brillo, contraste, saturación, tono, desenfoque, viñeta…) y Filtros (8) | — | falta (`setFilters`, `applyFilterPreset`) |
| Imagen › Quitar fondo | — | falta: corre en el navegador (`engine/bgRemoval/`); la propuesta lo haría al aceptarse, como `quitar_fondo` del Video Editor |
| Imagen › Recortar (libre o con relación) | — | falta (`cropToAspect`, `engine/api/crop.ts`) |
| Imagen › Marco (máscara) · redondeo de esquinas | — | falta (`setMask`, `setCornerRadius`) |
| Color de relleno de una forma o de un texto; color de una línea | `color` · color_elemento_imagen | cubierta (API 27/10) |
| Borde: color y grosor | `borde` · borde_elemento_imagen | cubierta (API 27/10) |
| Forma: estilo del borde, redondeo, lados, puntas, radio interior, relleno degradado | — | falta |
| Línea: grosor, estilo, flechas de inicio y de fin | — | falta (`setLine`) |
| Gráfico: «Colores» | — | falta (`recolor`) |
| Posición: X e Y (arrastrar, flechas) | `mover` · mover_elemento_imagen | cubierta (API 27/10) |
| Ancho, alto, escala | `tamano` · tamano_elemento_imagen | cubierta (API 27/10) |
| Rotación | `rotar` · rotar_elemento_imagen | cubierta (API 27/10) |
| Transparencia | `opacidad` · opacidad_elemento_imagen | cubierta (API 27/10) |
| Traer al frente o adelante, enviar atrás o al fondo (también en Capas) | `capa` · capa_elemento_imagen | cubierta (API 27/10) |
| Alinear a la página | `alinear` · alinear_elementos_imagen | cubierta (API 27/10) |
| Alinear a la selección · distribuir · ordenar espaciado | — | falta (`align`, `distribute`, `tidy` de `engine/api/arrange.ts`) |
| Bloquear y desbloquear (también en Capas) | `bloquear` · bloquear_elemento_imagen | cubierta (API 27/10) |
| Duplicar · Copiar y Pegar | `duplicar` · duplicar_elemento_imagen | cubierta (API 27/10) |
| Eliminar | `borrar` · borrar_elementos_imagen | cubierta (API 27/10) |
| Voltear horizontal o vertical | `voltear` · voltear_elemento_imagen | añadida 27/10 |
| Agrupar · Desagrupar | — | falta |
| Vínculo | — | falta (`setLink`) |

## Páginas

| Acción a mano | Por prompt (chat · API) | Estado |
|---|---|---|
| Agregar página (en blanco o duplicada) | `agregar_pagina` · agregar_pagina_imagen | cubierta (API 27/10) |
| Eliminar página | `borrar_pagina` · borrar_pagina_imagen | cubierta (API 27/10) |
| Reordenar páginas (arrastrar, subir, bajar) | — | falta (`pages.move`) |
| Título de la página · notas del orador · tiempo de la página | — | falta (`pages.rename`, `setNotes`, `setDuration`) |
| Cambiar de página, zoom, reglas, cuadrícula, guías, sangrado, Presentar | — | no se puede: es la vista de quien edita, no cambia el diseño |

## Diseño y diálogos

| Acción a mano | Por prompt (chat · API) | Estado |
|---|---|---|
| Crear un diseño (Inicio: un tamaño, a medida o desde una plantilla) | crear_diseno_imagen (y listar_plantillas_imagen) | cubierta |
| Redimensionar (tamaños de Canva o a medida; escalar, reubicar o sólo el lienzo; esta página o todas) · «Copiar y redimensionar» · voltear el lienzo | — | falta: operación con ancho, alto y modo (`pages.resize`, `flipCanvas`); la copia sola ya es duplicar_diseno_imagen |
| Cambiar el nombre del diseño | — | falta: ni el chat ni la API (crear_diseno_imagen sólo lo nombra al crearlo) |
| Eliminar un diseño (Inicio) | borrar_diseno_imagen | cubierta |
| Deshacer · Rehacer · Restablecer el diseño | «Restaurar» deshace lo que aplicó el chat | falta: deshacer lo hecho a mano (el historial vive en la pestaña) |

## Exportar

| Acción a mano | Por prompt (chat · API) | Estado |
|---|---|---|
| Descargar PNG, JPG, PDF, SVG, MP4, WebM o GIF, con sus páginas · Descargar las notas | — | no se puede: se dibuja en el navegador de quien edita y el archivo baja a su disco |

## Lo que falta, en orden de lo que más se pide

1. **Poner una imagen de Subidos** (y reemplazar con ella): la operación con la ref del subido; `agregar_imagen` y `reemplazar_imagen` ya existen como internas.
2. **Quitar fondo**: una operación que corra `bgRemoval` al aceptar, como `quitar_fondo` en el Video Editor.
3. **Usar una plantilla en este diseño**: operación con el slug de listar_plantillas_imagen.
4. **Redimensionar** (pasar un post a historia): operación con ancho, alto y modo «reubicar».
5. **Efectos de texto** (sombra, contorno, neón, fondo, hueco) y curvar: campos nuevos en `estilo_texto`.
6. **Recortar, filtros y ajustes de foto**: operaciones sobre `cropToAspect`, `setFilters` y `applyFilterPreset`.
7. **Elementos del catálogo** (íconos, formas, líneas, stickers): operación con el id de `mako/elementos.ts`.
8. **Fondo degradado o con imagen, agrupar y animaciones**: completan lo que más se ve en las plantillas.

## Lo que no se puede, y por qué

- **Subir una imagen o un audio**: el archivo está en el disco de quien edita; la IA no lo ve hasta que se sube.
- **Grabar audio**: necesita el micrófono de quien edita.
- **Descargar**: el diseño se dibuja en el navegador de quien edita y el archivo baja a su disco; la API no descarga.
- **La vista** (zoom, reglas, guías, Presentar): no cambia el diseño.
