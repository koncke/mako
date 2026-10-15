# Las funciones de Canva contra el Image Editor de MaKo (14/10/2026)

La checklist que pedía el plano (`docs/diseno-editor-imagen.md`, tanda 5): qué hace Canva en su editor, qué tiene el
Image Editor de MaKo **hoy** (Doory portado + el re-vestido de la tanda 2 + la base de la tanda 3), dónde viviría lo que
falta y si espera una decisión de Martín. Al final, los paquetes propuestos para la tanda 5, en orden.

> **Cómo se relevó.** Canva: lo que el editor ofrece en 2025–26, de memoria de producto y de
> `relevamiento-canva-armazon.md` (el armazón medido). **No se navegó Canva**: el agente que iba a hacerlo se cortó
> con la caída del 14/10 a las 09:10, y la extensión de Chrome no estaba disponible para la cuenta claude1. MaKo: el
> código de `app/image-editor/` leído el 14/10 (los archivos están en cada fila). La checklist de Doory ANTES del port
> está en `repos/doory.md` §7; ésta la reemplaza para planificar.

**Leyenda:** SÍ = anda igual que en Canva · PARCIAL = está pero le falta algo (dicho en la fila) · NO = no existe ·
**Martín** = espera una decisión suya (publicada o a publicar en /admin/runway).

---

## 1. Texto

| Función de Canva | MaKo hoy | Dónde está / dónde iría |
|---|---|---|
| Fuentes, tamaño, color, B/I/U/tachado, mayúsculas, alineación, listas, interlineado y espaciado | SÍ | `toolbar/sections/text.tsx`, `text/lists.ts`. 70 familias propias (`mako/fuentes.ts`) |
| Combinaciones de fuentes | SÍ | Panel Texto, 14 combinaciones (`drawers/pairings.ts`, `mako/fuentes.ts`) |
| Curvar | SÍ | `text/curve.ts`, `objects/curvedText.ts` |
| Efectos: Sombra, Hueco, Contorno, Neón, Fondo | SÍ | `engine/objects/effects.ts` (shadow, outline, glow, highlight) |
| Efectos: Elevar, Salpicadura, Eco, Glitch | **NO** | `engine/objects/effects.ts`: Elevar = sombra suave grande; Eco y Salpicadura = copias desplazadas detrás (render propio en el objeto); Glitch = dos copias desplazadas en cian y magenta. Mediano |
| Fuentes subidas por el usuario | NO | `fonts/UploadFontDialog.tsx` existe; `services.fonts.mine` va en `null` (pide una tabla y el bucket) |
| «Buscar y reemplazar» texto en el diseño | NO | Comando nuevo (`builtins/commands.tsx`) que recorre las páginas. Chico |
| Escribir con IA (Magic Write) | NO | **Martín**: IA de texto (MaKo tiene la suya; regla: el plan no paga IA) |

## 2. Elementos

| Función de Canva | MaKo hoy | Dónde está / dónde iría |
|---|---|---|
| Formas básicas con borde, radio y trazo | SÍ | Herramientas › Formas; 168 formas SVG CC0 |
| **Texto dentro de una forma** (doble clic en la forma y escribir) | **NO** | Un tipo de objeto nuevo (grupo forma + textbox que sigue el tamaño), `registerObjectKind` en `editor/extensions.ts`. Mediano |
| Líneas rectas con puntas y trazo | SÍ | `DoryLine`, 5 puntas, discontinua |
| **Líneas en codo y curvas; conectores que se pegan a los objetos** | **NO** | Extender `DoryLine` (puntos intermedios) y anclar los extremos a un objeto. Mediano-grande |
| Marcos (foto dentro de una forma) | SÍ | `objects/slot.ts`, 10 máscaras |
| **Cuadrículas** (varias celdas de foto) | **NO** | Un grupo de marcos con separación ajustable; reusa `slot.ts`. Mediano |
| **Tablas** (filas, columnas, celdas editables) | **NO** | Objeto nuevo; es el más caro del paquete. Grande |
| Gráficos | PARCIAL | 4 tipos como SVG estático (`drawers/charts.ts`); **los datos no se editan**. Falta una tabla de datos y redibujar. Mediano |
| Íconos, ilustraciones y emoji | PARCIAL | 7 sets de Iconify con buscador en español (`mako/elementos.ts`); faltan ilustraciones CC0 propias (tanda 4) |
| Fotos de stock | NO | `services.stock` en `null`. **Martín** (`image-unsplash`) |
| Videos y audio de stock dentro del diseño | NO | El audio subido sí (Apps › Audio); video dentro del diseño, no. Grande |
| QR | SÍ | Apps › QR (`objects/qr.ts`) |
| **Notas adhesivas** | **NO** | Herramientas › Notas adhesivas: una forma con texto y color (sale gratis con «texto dentro de una forma»). Chico después de eso |
| **Dibujo** (bolígrafo, marcador, resaltador, borrador) | **NO** | `PencilBrush` de fabric 7 + guardar los trazos como `path`; mosaico en Herramientas. Mediano |
| Mockups (poner el diseño en una remera, un celular) | NO | Fuera del alcance de la tanda 5 |

## 3. Fotos

| Función de Canva | MaKo hoy | Dónde está / dónde iría |
|---|---|---|
| Recortar, voltear, transparencia, reemplazar | SÍ | `engine/crop.ts`, `insert.pickAndReplaceImage` |
| Filtros | SÍ | 8 presets (`engine/objects/filters.ts`) |
| Ajustes: brillo, contraste, saturación, tono, desenfoque, viñeta | SÍ | `engine/objects/filters.ts` |
| **Ajustes: temperatura, tinte, luces, sombras, blancos, negros, claridad, nitidez** | **NO** | Filtros WebGL propios de fabric (`filters.ts`, mismo molde). Mediano |
| **Efectos: duotono, pixelado** | **NO** | fabric trae `Pixelate`; duotono = `BlendColor` doble o un filtro propio. Chico |
| Quitar fondo | SÍ | U²-Net en el navegador (`engine/bgRemoval/`). **Martín** para quitar fondo de OBJETOS (`relevamiento-integracion-mako.md` §13.10) |
| Borrador mágico, Editar mágico, Expandir mágico, Captura mágica | NO | **Martín**: IA de imagen por el puente a Flow («ahora no, más tarde», 14/10) |
| Usar como fondo desde la imagen seleccionada | PARCIAL | Sólo desde Herramientas › Fondo. Un ítem en el clic derecho. Chico |

## 4. Páginas y lienzo

| Función de Canva | MaKo hoy | Dónde está / dónde iría |
|---|---|---|
| Agregar, duplicar, borrar, reordenar; tamaños distintos | SÍ | `engine/api/pages.ts`, `workspace/usePageDnd.ts` |
| Vista en cuadrícula de páginas | PARCIAL | `workspace/PageGrid.tsx`; falta el «⋯» por mosaico |
| Título de página, notas, duración, transiciones | SÍ | Barra de página, Notas, Duración, Animar |
| **Ocultar página** (no sale al descargar ni al presentar) | **NO** | Un flag en `DocPage` + saltarla en export y presentador. Chico |
| **Bloquear página** | **NO** | Un flag en `DocPage` que bloquea sus objetos. Chico |
| **«Ir a la página»** | **NO** | Comando con atajo y un campo en la píldora de páginas. Chico |
| Reglas, guías, márgenes, sangrado | PARCIAL | Reglas y guías sí; sin «márgenes» aparte; faltan las marcas de posición en la regla (`workspace/Rulers.tsx`) |
| Pantalla completa | SÍ | Barra inferior (tanda 2) |

## 5. Operaciones sobre objetos

| Función de Canva | MaKo hoy | Dónde está / dónde iría |
|---|---|---|
| Mover, escalar, rotar, posición exacta, capas, alinear, distribuir, agrupar, bloquear, duplicar, copiar y pegar | SÍ | `builtins/commands.tsx` (55 comandos), panel de capas |
| Deshacer y rehacer, atajos, menú del clic derecho | SÍ | 200 pasos; el menú con los ítems de Canva (tanda 2) |
| **Copiar estilo** (el pincel) | **NO** | Sólo existe el texto `copyStyle` en `strings.ts`. Comando que guarda las props de estilo y las aplica al próximo clic. Chico |
| **Texto alternativo** (para lectores de pantalla) | **NO** | Un campo en el objeto; va al `alt` del SVG y del PDF. Chico |
| **Descargar la selección** | **NO** | El diálogo de descarga ya elige páginas; sumar «sólo lo seleccionado». Chico |
| Enlace en un objeto | SÍ | http(s); sale en PDF y SVG |
| Mini-barra pegada a la selección | NO | Falta la posición del objeto en pantalla (hallazgos). Chico-mediano |

## 6. Marca, compartir y equipo

| Función de Canva | MaKo hoy | Dónde está / dónde iría |
|---|---|---|
| Kit de marca (logos, colores, fuentes) y «Estilos» que lo aplican al diseño | NO | `services.brand` en `null`. MaKo ya sabe cómo suena y se ve cada negocio (el contexto de MaKo): la Marca podría salir de ahí. Mediano, con tabla |
| Historial de versiones | NO | `services.versions` en `null`; tabla propia (molde `landing_doc_versiones`). Mediano |
| Compartir con enlace (ver, comentar, editar) | NO | `services.sharing` en `null`. **Martín**: quién de afuera puede ver un diseño |
| Comentarios con hilos | NO | `services.comments` en `null`; tabla propia (molde `landing_doc_comentarios`). Mediano |
| Co-edición en tiempo real | NO | Pide un servidor Yjs propio. **Martín** (infra). Grande |
| Carpetas en Proyectos | NO | Una columna `carpeta` en `image_disenos` + la pestaña que ya existe. Chico-mediano |
| Publicar en redes / programar | NO | No se copia (decisión del plano) |

## 7. Descargar

| Función de Canva | MaKo hoy | Dónde está |
|---|---|---|
| PNG (transparente, tamaño), JPG (calidad), SVG, elegir páginas | SÍ | `dialogs/DownloadDialog.tsx` |
| PDF estándar | SÍ | En el navegador, raster a 300 dpi |
| PDF para imprimir vectorial | PARCIAL | Pide un servidor con Chromium (`exportPdf` del adaptador, ausente) |
| MP4, GIF | SÍ | Exporta video y GIF del diseño animado |

---

## Los paquetes de la tanda 5, en orden

El orden pone primero lo chico y de cliente puro (se verifica en el banco sin tocar la base), y deja para el final lo
que pide tablas o decisiones.

1. **Atajos de Canva que faltan** (chico): copiar estilo, ocultar y bloquear página, «Ir a la página», texto
   alternativo, descargar la selección, usar como fondo desde el clic derecho, buscar y reemplazar texto.
2. **Texto dentro de las formas + notas adhesivas** (mediano): el objeto nuevo y, encima, las notas.
3. **Dibujo** (mediano): bolígrafo, marcador, resaltador y borrador, como mosaico en Herramientas.
4. **Fotos** (mediano): los ajustes que faltan (temperatura, tinte, luces, sombras, claridad, nitidez) y los efectos
   duotono y pixelado.
5. **Efectos de texto** (mediano): Elevar, Salpicadura, Eco y Glitch.
6. **Líneas en codo y curvas, con conectores** (mediano-grande).
7. **Cuadrículas y gráficos con datos** (mediano cada uno).
8. **Tablas** (grande).

Fuera de la tanda 5 y con su dueño: Marca, versiones, comentarios y carpetas (tablas propias, sin decisión de
producto pendiente salvo la Marca desde el contexto de MaKo); compartir con enlace, co-edición, fotos de stock e IA de
imagen (**Martín**).
