# CapCut: el armazón de la interfaz (estructura, barra de herramientas, línea de tiempo, inicio, exportar, atajos)

Relevamiento para vestir el motor de OpenCut con la interfaz de CapCut **tal cual**. Fecha: 11/10/2026.
Versión de referencia: **CapCut Desktop 9.3.0.3970 para Windows** (instalada en esta PC, build del 21/08/2026) más capturas oficiales de capcut.com del mismo ciclo (finales de 2025, interfaz idéntica a la 9.x).

## 0. Cómo se obtuvo y cuánto confiar en cada dato

| Marca | Fuente | Confianza |
|---|---|---|
| **[CAP]** | Capturas **oficiales** de CapCut Desktop (Windows), PNG sin pérdida, 1919×1062/1079, publicadas en https://www.capcut.com/resource/how-to-use-capcut-on-pc . Descargadas a `research/dl/pc_*.png` y **medidas píxel a píxel** con PIL (`research/tools/*.py`). | Alta (es lo que se ve) |
| **[PO]** | Archivo de textos de la app instalada: `C:/Users/marti/AppData/Local/CapCut/Apps/9.3.0.3970/Resources/po/es-LA.po` (15.921 textos en español latino) cruzado con `en.po` (17.113) por clave. **Es exactamente lo que CapCut muestra en español.** | Alta para el texto; media para "qué clave se usa en qué lugar" cuando el mismo texto inglés tiene varias traducciones |
| **[KM]** | Mapas de atajos que la app guarda: `C:/Users/marti/AppData/Local/CapCut/User Data/Config/Shortcut/{Premiere Pro,Final Cut Pro X,Custom1-3}.json` (91 acciones) + tabla de teclas embebida en `VECreator.dll` (VEKeymap.cpp). | Alta para los nombres de acción y las teclas existentes |
| **[PDF]** | Guía con capturas de eMotion Video (2025, capturas de la versión Mac 2023): https://www.emotionvideo.com.au/wp-content/uploads/2025/05/The-2025-CapCut-Desktop-Guide-by-eMotion-Video-and-Media-Training.pdf | Media (versión vieja, pero describe comportamientos) |
| **[DK]** | Lista de atajos de DefKey (coincide 1:1 con el panel de atajos de la app): https://defkey.com/capcut-video-editor-shortcuts | Alta (cruza con [KM]) |
| **[3P]** | Guías de terceros (Filmora, FastShortcuts, TourBox, seosve) | Media/baja, se indica caso por caso |
| **[I]** | Inferido por mí (conocimiento previo o deducción de íconos) | Verificar antes de dar por cierto |

**No se lanzó CapCut.exe ni ningún navegador.** Solo se leyeron archivos de la instalación y de la web.

**Trampas de la investigación (para no repetirlas):**
- La búsqueda web de "atajos CapCut" devuelve sobre todo **spam SEO y listas inventadas**. Skillademia y MeowTool publican atajos que **no existen** en CapCut (Ctrl+T "agregar texto", Ctrl+Shift+E "exportar", R "rotar 90°", M "silenciar"). No usarlas.
- Las páginas `capcut.com/es-es/resource/...` están **traducidas a máquina** y **no coinciden** con los textos de la app ("Pegatinas", "Voltea", "Reverso", "Congelación", "Tecla croma"). La app dice "Stickers", "Reflejar", "Revertir", "Congelar". **La única fuente buena de nombres en español es el `es-LA.po`.**
- WebFetch resume con un modelo chico y **se come los detalles**; las capturas oficiales descargadas y medidas dieron 10 veces más información que leer las páginas.
- Las capturas oficiales parecen tomadas con **Windows al 125 %** (las letras de los rótulos tienen 10–13 px de altura de mayúscula). Los px de este informe son **los de la captura**; para CSS al 100 % dividir por ~1,25 (estimado, ver §1).

---

## 1. Estructura general y proporciones [CAP]

Medido sobre la captura del editor vacío (`pc_empty.png`, ventana 1919×1062). Entre paréntesis, el estimado al 100 % (÷1,25).

```
┌──────────────────────────────── Barra superior 54 px (≈43) #141414 ────────────────────────────────┐
│ ┌── Biblioteca 654 px (34,1 %) ──┐ 10 ┌── Reproductor 663 px (34,5 %) ──┐ 10 ┌─ Propiedades 555 px (28,9 %) ─┐ │
│ │ Pestañas con ícono 62 px #303030│    │ Cabecera "Reproductor" 62 px    │    │ Cabecera/pestañas 62 px #303030│ │
│ │ Subcat. 179 px │ contenido       │    │ #262626                          │    │ #262626                         │ │
│ └────────────────┴────────────────┘    └──────────────────────────────────┘    └─────────────────────────────────┘ │
│  ── separación 9 px (#141414) — el divisor horizontal se puede arrastrar ──                                        │
│ ┌──────────────────────────── Línea de tiempo 324 px (30,5 % de la altura) #262626 ─────────────────────────────┐ │
│ │ Barra de herramientas 48 px (≈38) · línea 1 px #09090b                                                         │ │
│ │ Cabecera de pistas 184 px (≈147) #2a2a2a │ columna Portada 70 px (≈56) │ regla + pistas (el 0 cae en x≈274)  │ │
│ └────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Zona superior (los tres paneles): y 54→728 = **675 px = 63,6 %** de la altura. Línea de tiempo: y 738→1062 = **30,5 %**.
- Márgenes de la ventana: 13 px a izquierda y derecha; **10 px entre paneles**; 9 px entre paneles y línea de tiempo.
- Paneles con **esquinas redondeadas de ~8–9 px** (≈7 al 100 %). Botones (Exportar, subcategorías) ~5 px.
- **El divisor entre paneles y línea de tiempo se arrastra**: en otra captura oficial (`pc_tts.png`) la zona superior termina en y≈628 en lugar de 728. [CAP]
- Botón **Diseño** (ícono de ventana partida ▾ en la barra superior) con plantillas de distribución [PO]: «Predeterminado» (*Diseño de panel equilibrado*), «Archivos multimedia» (*Amplía el panel de archivos multimedia*), «Atributos» (*Amplía el panel de atributos*), «Vertical» (*Perfecto para videos verticales de las redes sociales*), «Diseño personalizado 1/2/3», «Restablecer diseño actual». También existe «Primero el reproductor».

### 1.1 Paleta medida (tema oscuro, único tema de CapCut Desktop) [CAP]

| Token sugerido | Hex | Dónde aparece |
|---|---|---|
| `--cc-app` | `#141414` | fondo de ventana, barra superior, separaciones entre paneles |
| `--cc-panel` | `#262626` | cuerpo de los paneles, barra de herramientas, regla, fondo de la línea de tiempo, diálogo Exportar |
| `--cc-panel-head` | `#303030` | franja de pestañas de la biblioteca, cabecera "Reproductor", pestañas del panel derecho |
| `--cc-raised` | `#3b3b3b` | botones de subcategoría, desplegables (select), botón Portada, segmento elegido, botón Pro |
| `--cc-input` | `#343337` | campos de texto (Nombre, Exportar a), botón Menú |
| `--cc-sunken` | `#1c1c1c` | fondo de control segmentado (Básico/Eliminar fondo/…), cajas de valor numérico; `#1b1b1c` fondo del botón imán activo |
| `--cc-btn-2` | `#4f4f4f` | Compartir, Cancelar, interruptor apagado |
| `--cc-scroll` | `#404040` | barra de desplazamiento horizontal de la línea de tiempo (9 px) |
| `--cc-track-head` | `#2a2a2a` | columna de cabecera de pistas |
| `--cc-track` | `#292929` | fila de pista normal |
| `--cc-track-active` | `#2f2f2f` | fila de la pista que tiene el clip elegido |
| `--cc-line` | `#09090b` / `#353535` | línea bajo la barra de herramientas / borde inferior de pista |
| **`--cc-accent`** | **`#00c1cd`** | **Exportar, pestaña activa (texto e ícono), tiempo actual del reproductor, interruptores encendidos, casillas marcadas, botones Generar/Aplicar primarios, imán y vinculación activos, borde del ítem elegido** |
| `--cc-text` | `#e0e0e0` | texto principal |
| `--cc-text-2` | ~`#b7b7b7`–`#bfbfbf` | texto secundario, segmentos no elegidos |
| `--cc-text-3` | ~`#929292` | sugerencias ("Arrastra el material aquí…") |
| `--cc-ruler` | ~`#555555` | números de la regla |
| `--cc-icon` / `--cc-icon-off` | `#c9c9c9` / `#575757` | íconos de barra activos / deshabilitados |
| `--cc-track-icon` | `#808080` | íconos de cabecera de pista |
| `--cc-pro` | `#8e7fff` | diamante "Pro" (función paga) |
| Clip video | `#004d52` cuerpo · `#1a5f64` franja del nombre | pista principal y superpuestas |
| Clip texto | `#9c4937` | pista de texto/subtítulo |
| Clip audio | `#0e3058` cuerpo · `#0e81b3` barras de onda · `#274569` franja del nombre | pista de audio |
| Selección | `#ffffff` | clip elegido: tiradores laterales 4 px + borde 2 px arriba/abajo |
| Cabezal | `#e3e3e3`–`#ffffff` | línea vertical + "escudo" en la regla |

Colores de pistas de la versión 2023 [PDF, a ojo, no medidos]: Ajuste = mostaza, Filtros = índigo, Efectos = violeta, Stickers = naranja, Texto = rojo ladrillo. Con la 9.x solo se midieron video/texto/audio.

### 1.2 Tipografía
- La app trae su propia fuente: `Resources/Font/SystemFont/CapCutSansText-{Regular,Medium,Bold}.otf` (+ Noto Sans para otros alfabetos). **Es propiedad de ByteDance: no se copia.** Sustituto: Inter (Google Fonts) o la fuente que ya usa MaKo. [archivo local]
- Alturas de mayúscula en la captura (125 %): título "Player" 13 px, rótulos de pestaña 10 px, "Export" 12 px, nombre del proyecto 15 px, nombre de clip 10 px. Estimado al 100 %: rótulos de pestaña ~11–12 px, cuerpo ~13 px, títulos de panel ~14 px. [CAP + I]

---

## 2. Barra superior [CAP + PO]

De izquierda a derecha (captura 9.x):

| # | Elemento | Nombre en español [PO] | Comportamiento / medida |
|---|---|---|---|
| 1 | Logo CapCut | — (no copiar el logo) | x 14–95 |
| 2 | Botón **Menu ▾** | **Menú** | botón `#343337`, ~78×32 px. Abre el menú de la app (Archivo, Editar, Configuración, Ayuda, Buscar actualizaciones…) [I sobre el contenido exacto] |
| 3 | ✓ "Auto saved: 21:19:38" | **Guardado automático:** hh:mm:ss | ícono de tilde cian + hora del último guardado; texto `#929292` |
| 4 | Nombre del proyecto (centrado) | — | por defecto la **fecha MMDD** ("1123"), y "1123 (1)" si se repite. Clic para renombrar [I] |
| 5 | Ícono Diseño ▾ | **Diseño** | plantillas de distribución (§1) |
| 6 | Ícono teclado | **Atajos** | abre el panel de atajos (§9) |
| 7 | Botón **◆ Pro** | **Pro** / «Unirse a Pro» | `#3b3b3b`, diamante `#8e7fff` |
| 8 | Botón **Share** | **Compartir** | `#4f4f4f`, ícono de pantalla con flecha |
| 9 | Botón **Export** | **Exportar** | **`#00c1cd`**, 100×34 px, radio ~5 px, ícono de "subir" + texto blanco. Abre el diálogo Exportar (§8) |
| 10 | Minimizar / Maximizar / Cerrar | — | dibujados por la app, ~48 px de separación |

## 3. Biblioteca (panel izquierdo)

### 3.1 Fila de pestañas con ícono (62 px, `#303030`) [CAP + PO]
Ícono arriba, rótulo abajo, ~73 px por pestaña. Activa = ícono y texto `#00c1cd` (en "Multimedia" el ícono activo es un rectángulo relleno cian). Cuando no entran, aparecen flechas **‹ ›** en los extremos para desplazar la fila. Orden exacto (capturas `pc_empty` + `pc_export2`):

| Orden | Inglés (captura) | **Español [PO]** |
|---|---|---|
| 1 | Media | **Multimedia** (clave `pc_media`) |
| 2 | Audio | **Audio** |
| 3 | Text | **Texto** |
| 4 | Stickers | **Stickers** |
| 5 | Effects | **Efectos** |
| 6 | Transitions | **Transiciones** |
| 7 | Captions | **Subtítulos** |
| 8 | Filters | **Filtros** |
| 9 | Adjustment | **Ajuste** |
| 10 | Templates | **Plantillas** |
| 11 | AI avatar | **Avatar de IA** |

(En la versión 2023 eran 8 pestañas: Media, Audio, Text, Stickers, Effects, Transitions, Filters, Adjustment [PDF].)

### 3.2 Columna de subcategorías (179 px) y contenido [CAP + PO]
Ítems de 36 px de alto, 12 px de separación, fondo `#3b3b3b`, radio ~5 px; los que tienen hijos llevan ▾/▴ a la derecha; el elegido va en texto cian. Contenido: buscador arriba ("Buscar…", ícono de filtro ⚲▾), grilla de 3 miniaturas de ~128 px con nombre debajo, ⬇ para descargar, diamante Pro en la esquina.

| Pestaña | Subcategorías (español [PO]) | Contenido verificado |
|---|---|---|
| Multimedia | **Importar ▴** (→ Multimedia, **Proyectos secundarios**), **Tuyos ▾**, **Archivos multimedia de IA ▾**, **Espacios ▾**, **Biblioteca ▾**, **Dreamina** | Zona punteada "⊕ **Importar** — *Arrastra y suelta los videos, las fotos y los archivos de audio aquí*"; debajo "*¿No tienes archivos multimedia? Crea con estas herramientas*": Archivos multimedia de IA · Avatares de IA · **Grabar**. Miniatura importada: duración arriba a la derecha, "Agregado" si ya está en la línea de tiempo, al pasar el mouse se previsualiza (scrub), botón ⊕ cian para agregar [PDF] |
| Audio | **Importar**, **Tuyos ▾**, **Música de IA**, **Música ▴** (Tendencias, Hot Bgm, Vlog, Marketing, Cute, Dreamy, Hits…), **Efectos de sonido ▾** | Buscador "*Buscar canciones o artistas*"; filas con portada, título, "artista · 02:49", ☆ favorito, ⬇ / ＋ |
| Texto | **Agregar texto**, **Montaje de IA**, **Tuyos ▾**, **Efectos de texto ▾**, **Plantilla de texto ▾**, **Subtítulos automáticos**, **Subtítulos locales** | Tarjeta "**Texto predeterminado**" |
| Efectos | **Efectos de video ▾**, **Efectos corporales ▾** (con categorías: Tendencias, …) [PDF] | grilla |
| Transiciones | categorías (2023: Básico, Cámara, Efecto, Redes sociales, MG, Deslizar, Máscara) [PDF] | grilla |
| Subtítulos | **Subtítulos automáticos**, **Plantillas ▾**, **Montaje de IA**, **Letras automáticas**, **Agregar subtítulos**, **Emojis de IA** | Subtítulos automáticos: **Idioma de origen** [English ▾], **Subtítulos bilingües** ◆ [Ninguno ▾], **Resaltar palabras clave automáticamente** ◆ ⏻, **Emojis de IA** (Free) ⏻, **Identificar las muletillas** ◆ ⏻; pie: ☐ **Eliminar los subtítulos actuales** + botón cian **Generar** |
| Filtros | **Favoritos**, **Filtros ▴** (Destacado, NEW, Hits, Life, Photo Booth, Landscape, Movies, Mono, Portrait, Retro…) | Buscador "*Buscar filtros*" |
| Avatar de IA | **Biblioteca de avatares** ◆, **De foto a avatar** ◆, **De video a avatar** ◆, Modelo de ropa de IA ◆, **Traductor de videos** ◆, **Escena de diálogo de IA** ◆ | asistente con pasos "① **Elige el avatar** — …" |

## 4. Reproductor (panel central) [CAP + PO + PDF]
- Cabecera de 62 px: título **«Reproductor»** a la izquierda, menú **≡** a la derecha.
- Lienzo centrado con la proporción del proyecto; el clip elegido muestra marco con tiradores y un control de rotación ⟳ debajo.
- Fila de controles inferior (≈y 696 en la captura):
  - Izquierda: **tiempo actual en cian** `00:00:03:15` + " / " + **duración total** `00:00:10:20` (formato **HH:MM:SS:FF**, cuadros al final), y el botón de **medidores de audio** (barras verde/amarillo; abre el vúmetro a la derecha de la línea de tiempo [PDF]).
  - Centro: **▶ Reproducir/Pausar**.
  - Derecha, en orden: **[Full]** = resolución de reproducción («**Completa**», «**1/2**», «**1/4**»; recomendaciones «Alta/Media/Baja calidad», *"Reduce la resolución para conseguir una reproducción más fluida. La resolución del video exportado no se verá afectada."*), **[Q] zoom del reproductor** («Acercar reproductor», «Alejar reproductor», «Hacer zoom para ajustar el reproductor»), **[Ratio]** = «**Relación**» (lista: Original, 16:9, 9:16, 1:1, 4:3, 2:1, 5.8", 2.35:1, 3:4, 1.85:1 — `Resources/video_template_ratio.json`; en la 2023 el botón decía "Original"), **⤢ Pantalla completa** («Pantalla completa» / «Salir de pantalla completa»).
- El proyecto toma la proporción del **primer clip** que se agrega [PDF].
- Guías y reglas: «Mostrar/ocultar guías» (Ctrl+;), «Mostrar/ocultar reglas» (Ctrl+Alt+R), mantener **Ctrl** ignora las guías de alineación [KM].

## 5. Panel derecho (propiedades) [CAP + PO]

**Sin nada elegido → «Detalles»** (título en cian): Nombre:, Ruta (path del borrador), **Relación de aspecto:** Original, **Resolución:** Adaptado, **Cuadros por segundo:** 30.00fps, **Medios importados:** «Mantener en la ubicación original», separador, **Proxy:** «Desactivado» (ⓘ), **Disposición de capas:** «Activado» (ⓘ); botón **Modificar** abajo a la derecha (abre la configuración del proyecto). Filas cada 48 px; columna de rótulos 210 px.

**Pestañas según lo elegido** (texto 17 px en la captura, activa en cian, flecha › si no entran):

| Elegido | Pestañas (español [PO]) | Subpestañas / controles vistos |
|---|---|---|
| Clip de video | **Video · Velocidad · Animación · Ajustar · Estilizado de IA** | Segmentado **Básico · Eliminar fondo · Máscara · Retoque**. Básico: **Transformación ▴** (Escala 100 % con deslizador y ⇕, **Escala uniforme** ⏻ cian, **Posición** X/Y, **Girar** 0.00° + rueda, fila de 6 botones de alineación), ☑ **Mezcla ▾**, ☐ **Estabilización ◆ ▾**, ☐ Autoenmarcado ◆ (Relación de aspecto, Estabilización de imagen, Velocidad de movimiento de la cámara, **Aplicar**), ☐ **Eliminar los parpadeos** ◆, ☐ **Movimiento de IA** ◆. Cada fila tiene ↺ restablecer y **◇ fotograma clave** con ‹ › |
| Clip de audio | **Básico · Modificador de voz · Velocidad** | Modificador de voz: **Filtros de voz · Personajes de voz · Voz a canción**; grilla (Original, Mic Echo, …), **Tono**, **Timbre** con valor y ◇ |
| Texto | **Texto · Animación · Seguimiento · Texto a voz · IA›** | Texto: **Básico · Burbuja · Efectos**; caja "Texto predeterminado", **Escritor de IA** (Free), **Fuente** (System), **Tamaño de la fuente**, **Diseño** (B U I), **May./min.** (TT tt Tt), **Color**; botón cian **Guardar como parámetro predefinido**. Texto a voz: **Voces personalizadas · Texto a voz**, grilla de voces, ☐ **Actualizar la voz según el guion**, botón cian **Generar contenido de voz** |
| Clip de IA | **Archivos multimedia de IA · Video · Audio · Velocidad · Animación ›** | botones Modificar / Regenerar / Más |

Animación (2023): **Entrada · Salida · Combinado** + grilla de presets [PDF+PO].

## 6. Barra de herramientas de la línea de tiempo [CAP + PO]

48 px de alto, fondo `#262626`, íconos ~20 px cada ~54 px, separadores verticales finos. **Es contextual**: con un texto elegido solo muestra hasta Eliminar; con video agrega Recortar y el grupo Reflejar/Girar; con audio agrega herramientas de audio.

### 6.1 Izquierda (clip de video elegido, captura 9.x)

| # | Ícono | Nombre en español [PO] | Atajo | Notas |
|---|---|---|---|---|
| 1 | ↖ ▾ | **Seleccionar** (menú: «Selecciona el modo» / «Modo de división», «Seleccionar hacia la izquierda», «Seleccionar hacia la derecha») | A / B / [ / ] | "Cambiar al modo de selección o división" |
| — | separador | | | |
| 2 | ↶ | **Deshacer** | Ctrl+Z | gris si no hay nada |
| 3 | ↷ | **Rehacer** | Ctrl+Shift+Z | |
| — | separador | | | |
| 4 | ]I[ | **Dividir** | Ctrl+B | corta en el cabezal |
| 5 | ]⁞[ izq. | **Borrar a la izquierda** | Q | borra desde el inicio del clip hasta el cabezal |
| 6 | ]⁞[ der. | **Borrar a la derecha** | W | |
| 7 | 🗑 | **Eliminar** | Supr / Retroceso | |
| 8 | ⛉ | **Agregar marcador** | M | |
| 9 | ⌗ | **Recortar** | — | recorte del cuadro (solo video/imagen) |
| 10 | ⊿⟳ con ◢ | grupo **Reflejar / Girar** (y probablemente **Congelar / Revertir**) | — | el triangulito ◢ indica submenú. [I: Filmora lista "Freeze / Reverse / Mirror / Rotate" como un solo ítem; en la 2023 eran botones sueltos: Revertir, Reflejar, Girar, Recortar [PDF]] |
| — | separador | | | |
| 11 | 📄✂ | **Generar subtítulos** o edición por **Transcripción** [I] | — | |
| 12 | 🔈✦ | **Mejorar audio** [I por el ícono; texto PO] | — | |
| 13 | 👤✦ | **Eliminar fondo** | — | |
| 14 | 🪄✦ | **Ajustar color** (ajuste automático) | — | |
| 15 | HD ◢ | **Mejorar elementos visuales** (submenú: Mejorar la calidad, Mejorar movimiento) | — | |

Con **audio** elegido, después de Agregar marcador: 📄✂, **Marcar ritmos automáticamente ◢**, ecualizador, **Mejorar voz** (micrófono ✦), forma de onda, ícono de traducción/voz [I para los tres últimos].

**Congelar** («Congelar»): agrega un cuadro fijo de **3 s** en el cabezal, con bordes blancos para estirarlo; deshabilitado si no hay clip elegido [3P: https://www.tourboxtech.com/en/news/how-to-freeze-a-frame-in-capcut-pc.html]. Los clips congelados quedan vinculados al original («Vincular los clips del marco congelado al video original») [PO].
**Revertir** («Revertir») también está en el panel Velocidad [3P].

### 6.2 Derecha (de izquierda a derecha)

| # | Ícono | Nombre [PO] | Atajo [DK] | Comportamiento |
|---|---|---|---|---|
| 1 | 🎙 | **Grabar** (voz superpuesta) | — | graba del micrófono [PDF] |
| — | separador | | | |
| 2 | ▬⇠▬ (cian = activo) | **Imán de la pista principal** | P | sin huecos en la pista principal: al borrar o mover, los clips se juntan. Apagado: lo movido queda donde cae y si se suelta encima se convierte en superposición [PDF]. "La pista principal está bloqueada. No se puede activar el imán" [PO] |
| 3 | ⫼ (blanco = apagado en la captura) | **Ajuste automático** | N | encaje contra bordes de clips y cabezal |
| 4 | 🔗 ▾ (cian) | **Vinculación** + menú **Configuración de vinculación** | ` (tecla a la izquierda del 1) | Activa: lo que está encima de la pista principal se **mueve y borra con su clip**. Tipos tildables: Texto, Stickers, Efectos, Filtros, Ajustar, Audio, Efectos de sonido, Texto a voz, Superposición; "Seleccionar todo", "Hecho" [PO]. Valor por defecto local: `linkageEnableTypes=text, effect, sticker, filter, adjust, sound, tts` [config] |
| 5 | ⊏⇣ ▾ | **Eje de vista previa** + menú: «Vista previa de video y audio», «Vista previa solo de video», «Desactivar el eje de vista previa»; «Reproducir el audio mientras se navega» | S | al pasar el mouse por la línea de tiempo, el reproductor muestra ese cuadro sin mover el cabezal |
| — | separador | | | |
| 6 | regla+lupa | **Hacer zoom para ajustar la línea de tiempo** [I por ícono] | Shift+Z | |
| 7 | ⊖ | **Alejar** («Reducir la línea de tiempo») | Ctrl+- | |
| 8 | deslizador | zoom | Ctrl+rueda | ~140 px, perilla blanca |
| 9 | ⊕ | **Acercar** («Aumentar la línea de tiempo») | Ctrl++ | |

## 7. Línea de tiempo

### 7.1 Pistas [CAP + PDF + PO]
- **Pista principal** («Pista principal»): la de video de abajo de todo; el primer clip va ahí; nunca sube. Más alta que las demás: **~110 px** en la captura cuando es la única. Fila `#292929`, `#2f2f2f` si tiene el clip elegido.
- **Superposiciones** («Superposición»): pistas de video encima de la principal (B-roll). "Superposición es el término que usa CapCut" [PDF]. Límite local: `video_track_limit=40` [config].
- **Texto/stickers/efectos/filtros/ajuste**: pistas finas (clip de texto 27 px, fila ~36 px) por encima; el orden de apilado es el de creación y **lo de arriba afecta a lo de abajo** (un filtro encima tiñe al sticker de abajo) [PDF].
- **Audio**: siempre abajo de la principal; clip ~70 px con forma de onda.
- Separación entre pistas ~6 px (`#262626`). Altura de pista configurable: **Altura de la pista** → Corto / Predeterminado / Alto [PO].
- Arrastrar material a la línea vacía: *"Arrastra el material aquí y empieza a crear"* con ícono de película, caja punteada [CAP+PO].

### 7.2 Clip [CAP]
- Video: franja superior de 20 px con el nombre del archivo (y duración, p. ej. "Food blogger cooking… 0"), **miniaturas** continuas (~57 px de alto), franja inferior de ~22 px con la **onda del audio** propio. Clip de IA: rótulo "✦ AI media 00:00:08:00".
- Texto: barra ladrillo `#9c4937` con el texto como rótulo.
- Audio: azul marino con barras celestes; rótulo "Hip Hop Background(814204)  Voice filters High" (nombre + efectos aplicados); en los extremos **círculos blancos** de fundido (aparición/desaparición progresiva).
- **Elegido**: contorno blanco; **tiradores laterales de 4 px** (blancos) para recortar.

### 7.3 Cabecera de pista (184 px) [CAP + PO + PDF]
| Pista | Controles (izq→der) |
|---|---|
| Video principal | ícono ▭ · 🔒 **Bloquear pista** · 👁 **Ocultar la pista** · 🔈 **Silenciar pista** · ⋯ |
| Texto / sticker / efecto | ícono (TI, etc.) · 🔒 · 👁 |
| Audio | ♪ · 🔒 · 🔈 · ⋯ |

- A la derecha de la cabecera de la pista principal: botón **Portada** («Portada», lápiz ✎ + texto, 54×57 px `#3b3b3b`). Abre el diseño de portada (plantillas, texto) que se exporta con el video [CAP+PDF].
- Íconos `#808080`, ~20 px de separación.

### 7.4 Regla y cabezal [CAP]
- Regla de ~28 px; rótulos "|00:00 |00:05 |00:10" (formato mm:ss en esa escala; al acercar aparecen cuadros, formato "00:00:15f" [I]); marcas menores cada pocos px, texto `#555`.
- Cabezal: línea blanca de 1–2 px a todo el alto + **"escudo" blanco** sobre la regla; se arrastra; clic en la regla lo lleva ahí.
- Marcadores: M agrega; Alt+M con otro color; Shift+M / Alt+Shift+M navegan [DK].
- Punto de entrada/salida: I / O; Shift+X marca el rango del clip; Alt+X lo borra; **solo se exporta ese rango** [https://www.capcut.com/help/export-clip-of-video].

### 7.5 Interacciones
| Acción | Cómo | Fuente |
|---|---|---|
| Recortar | pasar el mouse por el borde → cursor cambia → arrastrar | [PDF] |
| Mover entre pistas | arrastrar; con imán apagado, soltarlo sobre la principal lo convierte en superposición | [PDF] |
| Encaje | Ajuste automático (N); mantener Ctrl ignora guías | [DK, KM] |
| Zoom | **Ctrl+rueda**; Ctrl++ / Ctrl+-; Shift+Z ajustar a pantalla | [DK, KM] |
| Desplazar | rueda = vertical; **Alt+rueda = horizontal** | [DK, KM] |
| Selección múltiple | Shift+clic / Ctrl+clic y recuadro desde zona vacía | [I — sin fuente oficial] |
| Seleccionar todo hacia un lado | [ / ] | [DK] |
| Agrupar / clip combinado | Ctrl+G / Alt+G (doble clic entra al clip combinado) | [DK, config `double_click_enter_combination_show`] |
| Copiar/pegar atributos | menú «Copiar/pegar atributos» | [PO] |
| Exportar clips elegidos | «Exportar clips seleccionados» (menú contextual) | [PO] |
| Desactivar clip | V («Activar/Desactivar el clip») | [DK] |
| Extraer audio | Ctrl+Shift+S («Extraer/Restaurar el audio») | [DK] |
| Duración por defecto de imagen | 5 s (150 cuadros a 30 fps) | [config `imageDefaultSecondDuration=5`] |
| Paso grande con Shift+flechas | 10 cuadros | [config `timelineLargeAdjustRange=10`] |

## 8. Pantalla de inicio [CAP + PO]

Captura `pc_home.png` (1919×1079):
- Fondo casi negro `#0d0d0d` con degradado verde azulado arriba (`#0f2123`). Barra lateral de 320 px (`#0e1b1c`).
- **Barra lateral**: tarjeta de usuario (avatar, nombre, ID, botón ⇄) + botón degradado **«Unirse a Pro»**; sección **«Edición de videos»**: **Inicio** (elegido `#1c2627`), **Plantillas**, **Espacios ▾**; separador; **Diseño de IA**; abajo banner "CapCut — Professional video editor".
- Arriba a la derecha: compartir, subir, comentarios, ⚙ **Configuración**, y los botones de ventana.
- **Banner «⊞ Crear proyecto»**: rectángulo grande (1150×215 px) con degradado cian (`#60d5e1`→`#13bddc`), texto negro.
- Tarjetas de herramientas IA (insignia "AI" `#13bfeb`): Creador de videos de IA, **De guion a video**, **Grabar la pantalla**; carrusel a la derecha (Diseño de IA…).
- **«Más herramientas»**: íconos de 70 px (`#181f22`) con rótulo debajo, cada 198 px: **De videos largos a cortos**, **Video de IA**, **Imagen de IA**, **Traductor de videos**, **Escena de diálogo de IA**, **Modelo de ropa de IA**, **Texto a voz**.
- **«Proyectos»**: a la derecha 🔍 **Buscar**, vista ▦▾ (**Cuadrícula** / **Lista**), 🗑 **Papelera**, ☁ **Sincronización de proyectos** (botones `#29292d`). Tarjetas de ~147×147 px con nombre ("1123") y "9.1K | 00:00" (tamaño | duración). Menú de tarjeta: Abrir, Renombrar, **Duplicar**, **Mover a la papelera**, **Cargar al espacio** [PO].
- Configuración (2023) [PDF]: pestañas Proyecto · Editar · Rendimiento · Idioma; caché con borrado automático a 30 días. Rendimiento: «Acelerar la decodificación por hardware», «Acelerar la codificación por hardware» [PO].

## 9. Diálogo Exportar [CAP + PO + PDF]

Captura `pc_export1.png`: modal de **1078×845 px** (x 421–1498, y 118–962), fondo `#262626`, el resto de la app oscurecido (~`#181818`). Título **«Exportar»** arriba a la izquierda (48 px). Cuerpo en dos columnas:

- **Izquierda**: portada 480×270 con chip **«✎ Editar portada»** arriba a la izquierda.
- **Derecha** (rótulos en x=960, controles de 336–395 px de ancho, filas cada 57 px):

| Campo | Español [PO] | Opciones | Fuente de las opciones |
|---|---|---|---|
| Name | **Nombre** | texto, por defecto el nombre del proyecto | [CAP] |
| Export to | **Exportar a** | ruta + botón 📁 | [CAP] |
| ☑ Video ▴ | **Video** (sección plegable con casilla cian) | | [CAP] |
| Resolution | **Resolución** | 480P · 720P · 1080P · 2K · 4K · **8K** | 8K y 1080P [CAP+PO]; 2K (2560×1440) y 4K (3840×2160) [https://www.capcut.com/help/export-videos-in-capcut]; 480P/720P [I] |
| Bit rate | **Tasa de bits** | **Más bajo · Recomendado · Más alto · Personalizado** (→ **CBR (tasa de bits estática)** / VBR + valor). Ayuda: *"La tasa de bits determina la calidad de las imágenes…"* | [PO]; por defecto VBR (`default_enable_cbr=0`) [config] |
| Codec | **Codec** (así, sin tilde) | **H.264 · HEVC · AV1** ; con alfa: **Apple ProRes 4444 (alfa)**, **HEVC (alfa)**, RLE; opción **10 bits** | H.264/HEVC [CAP+PDF]; ProRes/HEVC alfa/RLE/10 bits [PO]; AV1 [I: la app trae `SvtAv1Enc.dll`] |
| Format | **Formato** | mp4 · mov | [CAP+PDF] |
| Frame rate | **Cuadros por segundo** | 24 · 25 · 29,97 · 30 · 50 · 59,94 · 60 fps | [PO `pc_export_24`…`pc_export_60`] |
| Optical flow ◆ | **Flujo óptico** | interruptor + ⓘ | [CAP] |
| Color space | **Espacio cromático** | "Rec. 709 SDR" (informativo, gris) | [CAP] |
| Cover (2023) | Portada | **Con portada / Sin portada** | [PDF+PO] |
| ☐ Audio | **Audio** | Formato (MP3 en 2023; la 9.x tiene AAC, PCM, 192/256/320 kbps) | [PDF+PO] |
| ☐ Captions | **Subtítulos** | **Formato del subtítulo** (SRT/TXT [I]) | [PO] |
| ☐ Export GIF | **Exportar GIF** | **Resolución**: 320P / 640P. Error: *"No se puede exportar. El video es demasiado largo."* | [PO]; https://www.capcut.com/resource/gif-maker |
| Copyright | **Aplicar una revisión de los derechos de autor** | interruptor (revisa la música contra TikTok) | texto [PO]; ubicación al final del formulario [I] |
| Watermark | **Marca de agua**: Mantener / Eliminar | según plan | [PO] |

- **Pie** (70 px): ícono de película + **«Duración: 11s | Tamaño: aprox. 82 MB»** (estimado en vivo); botones **Exportar** (cian, 108×40) y **Cancelar** (`#4f4f4f`, 108×40).
- Exportar parte: solo el rango I/O (§7.4). Otras salidas: «Exportar el marco fijo», «Exportar clips seleccionados», «Superresolución» (sube a la resolución elegida) [PO].
- Errores con texto propio: falta de disco, archivos multimedia faltantes ("aparecerán fotogramas negros… Vincular archivos multimedia") [PO].

## 10. Atajos de teclado completos (Windows, preset "CapCut")

**Panel «Atajos»**: ícono de teclado en la barra superior. Tiene **presets**: CapCut (por defecto), **Final Cut Pro X**, **Premiere Pro**, **Personalizado 1/2/3** (archivos en `User Data/Config/Shortcut/`). Clic en un atajo para cambiarlo («Haz clic para modificar el acceso directo»); avisa conflictos («Conflicto entre accesos directos»); máximo de modificadoras. [KM+PO]

Columna Conf.: **V** = DefKey + tabla del binario + presets coinciden; **P** = probable (aparece en la tabla de teclas por defecto del binario pero la acción se deduce); nombre en español del [PO].

### Línea de tiempo
| Acción | Español [PO] | Tecla | Conf. |
|---|---|---|---|
| Split | Dividir | Ctrl+B | V |
| Split all | Dividir todo | Ctrl+Shift+B | V |
| Select mode | Selecciona el modo *(sic)* | A | V |
| Split mode | Modo de división | B | V |
| Select leftward / rightward | Seleccionar hacia la izquierda / derecha | [ / ] | V |
| Delete left / right | Borrar a la izquierda / derecha | Q / W | V |
| Delete | Eliminar | Supr / Retroceso | V |
| Main track magnet | Imán de la pista principal | P | V |
| Auto snapping | Ajuste automático | N | V |
| Linkage | Vinculación | ` (≈ "~") | V |
| Preview axis | Eje de vista previa | S | V |
| Timeline zoom in / out | Aumentar / Reducir la línea de tiempo | Ctrl++ (o Ctrl+=) / Ctrl+- | V |
| Zoom with wheel | — | Ctrl+rueda | V |
| Scroll vertical / horizontal | — | rueda / Alt+rueda | V |
| Zoom to fit timeline | Hacer zoom para ajustar la línea de tiempo | Shift+Z | V |
| Activate/Deactivate clip | Activar/Desactivar el clip | V | V |
| Extract/Restore audio | Extraer/Restaurar el audio | Ctrl+Shift+S | V |
| Add marker | Agregar marcador | M | V |
| Add marker with new color | Agregar marcador con nuevo color | Alt+M | V |
| Go to next / previous marker | Ir al siguiente / al marcador anterior | Shift+M / Alt+Shift+M | V |
| In point / Out point | En el punto *(sic)* / Punto de salida | I / O | V |
| Select by clip | Seleccionar por clip | Shift+X | V |
| Deselect | Anular selección | Alt+X | V |
| Group / Ungroup | Agrupar / Desagrupar | Ctrl+G / Ctrl+Shift+G | V |
| Create / Undo compound clip | Crear un clip combinado / Deshacer el clip combinado | Alt+G / Alt+Shift+G | V |
| Show speed panel | Mostrar el panel de velocidad | Ctrl+R | V |
| Curve speed | Velocidad de la curva | Shift+B | V |
| Volume +0.1 dB / −0.1 dB | Volumen +0.1 dB / Volumen -0.1 dB | Ctrl+. / Ctrl+, | V |
| Show/Hide keyframe panel | Mostrar/ocultar el panel de fotogramas clave | Alt+K | V |
| Add keyframe on keyframe panel | Agregar fotograma clave en el panel de fotogramas clave | Shift+clic | V |
| Render selected area ("In" en DefKey) | — | Shift+Enter | P |
| Copy / Cut / Paste | Copiar / Cortar / Pegar | Ctrl+C / Ctrl+X / Ctrl+V | V |
| Copy / Paste attributes | Copiar atributos / Pegar atributos | Ctrl+Shift+C / Ctrl+Shift+V | P |
| Select all | Seleccionar todo | Ctrl+A | V |
| Match cut / mark beat | Corte paralelo | Ctrl+J | P |

### Reproductor
| Acción | Español [PO] | Tecla | Conf. |
|---|---|---|---|
| Play/Pause | Reproducir/Pausar | Espacio | V |
| Previous / Next frame | Cuadro anterior / Siguiente cuadro | ← / → | V |
| Step back / forward many frames (10) | Retroceder / Avanzar muchos fotogramas | Shift+← / Shift+→ | V |
| Locate to first / last frame | Localizar hasta el primer / último fotograma | Inicio / Fin | V |
| Last / Next cut point | Último / Siguiente punto de corte | ↑ / ↓ | V |
| Shuttle left / stop / right | Rebobinar a varias velocidades / Detener búsqueda rápida / Búsqueda rápida a la derecha | J / K / L | V |
| Full screen / exit | Pantalla completa / Salir de pantalla completa | Ctrl+Shift+F / Esc | V |
| Zoom in / out / fit player | Acercar reproductor / Alejar reproductor / Hacer zoom para ajustar el reproductor | Alt+Shift+= / Alt+Shift+- / Alt+Shift+Z | V |
| Ignore alignment guides | — | mantener Ctrl | V |
| Show/hide guides / rulers | Mostrar/ocultar guías / reglas | Ctrl+; / Ctrl+Alt+R | P |

### Básico / texto
| Acción | Español [PO] | Tecla | Conf. |
|---|---|---|---|
| New project | Nuevo proyecto | Ctrl+N | V |
| Import media | Importar archivos multimedia | Ctrl+I | V |
| Undo / Redo | Deshacer / Rehacer | Ctrl+Z / Ctrl+Shift+Z | V |
| Export | Exportar | **Ctrl+E** | P (tabla por defecto del binario; FastShortcuts dice que varía) |
| Switch material panel | Cambiar el panel de los materiales | Tab | V |
| Back to edit page / home | Volver a la página de inicio | Ctrl+Alt+Q | V |
| Close window / Quit | — / Salir | Ctrl+W / Ctrl+Q | V |
| Split caption / new line | — | Enter / Ctrl+Enter | V |
| Resize text box from center | — | Alt+arrastrar | V |
| Record screen | Grabar la pantalla | Ctrl+Shift+R | V (texto PO) |

Presets alternativos que trae la app (para quien venga de otros editores), diferencias principales [KM]:
- **Premiere Pro**: V seleccionar, C cuchilla, Ctrl+K dividir, Ctrl+Shift+K dividir todo, S ajuste, Shift+Retroceso imán, Ctrl+L vinculación, Shift+P vista previa, Ctrl+M exportar, Shift+E activar clip, Alt+Shift+L extraer audio, Ctrl+Alt+C/V atributos, Ctrl+Alt+P grabar.
- **Final Cut Pro X**: B cuchilla, C dividir, N ajuste, P imán, ` vinculación, S vista previa, Ctrl+E exportar, A activar clip, Ctrl+Shift+S extraer audio, Shift+rueda horizontal, Alt+rueda zoom.

## 11. CapCut Web (para diferenciar) [captura de marketing oficial `pc_editor.png`, aproximada]
- Barra lateral **vertical** de íconos a la izquierda (no fila horizontal): Upload, Templates, Audio, Text, Elements, Transcript, Captions, Effects, Transitions, Filters.
- Barra superior: ícono de nube (guardado), nombre del proyecto, herramientas puntero/mano, zoom "100%", deshacer/rehacer, **Export** cian, escudo, ayuda, notificaciones, avatar.
- Barra de la línea de tiempo con dividir/eliminar/…, **reproducir y tiempo centrados** en la barra ("00:00:00 | 00:09:00").
- Texto naranja, audio verde. Exportar → "Download" con nombre, resolución, calidad, fps, formato [https://www.capcut.com/resource/capcut-tutorial-for-beginners].
- **No se extrajeron los textos en español de la Web** (los carga en tiempo de ejecución). Si se elige copiar la Web en vez del Desktop, hay que relevarla aparte.

## 12. Qué NO se copia y con qué se reemplaza
| Elemento de CapCut | Por qué no | Reemplazo |
|---|---|---|
| Fuente CapCut Sans Text (`.otf`) | binario propietario | Inter / fuente de MaKo, mismos tamaños |
| Íconos (SVG/PNG del binario) | binarios propietarios | set libre (Lucide/Tabler) eligiendo formas equivalentes; ver lista de formas en §6 |
| Logo, banners del inicio, miniaturas de filtros/efectos/música, avatares | propiedad de ByteDance / licencias | contenido propio o vacío |
| El archivo `es-LA.po` entero | es un archivo de ByteDance | **copiar a mano solo los rótulos usados** (los textos de interfaz sí se copian según la regla) |
| Capturas descargadas en `research/dl/` | propiedad de ByteDance | solo referencia de trabajo; no van al repo ni a la app |

## 13. Decisiones que esto obliga a tomar (con recomendación)
1. **Referencia: CapCut Desktop 9.x, no CapCut Web.** Es la que Martín tiene instalada, de la que hay textos exactos en español y la más completa. La Web es otra distribución (barra lateral vertical).
2. **Textos en español: los del `es-LA.po` literal**, cargados a mano en el i18n de MaKo. Hay que decidir dos cosas: (a) **tú vs. vos**: CapCut usa tú ("Arrastra el material aquí y empieza a crear"); la mayoría de los rótulos son sustantivos o infinitivos, así que el choque es chico. Recomendación: copiar literal los rótulos y pasar a vos solo las 5–10 frases imperativas, si la regla de voz de MaKo lo exige. (b) **Errores de traducción de CapCut**: "Selecciona el modo" (debería ser "Modo de selección"), "En el punto" (punto de entrada), "Codec" sin tilde, "marcos" por fotogramas, la clave `shortcut` traducida como "AutoCut". Recomendación: copiar igual y corregir solo los que son errores evidentes; anotarlo.
3. **Atajos: replicar el preset "CapCut"** (§10). Los presets Premiere/FCPX quedan para después.
4. **Atajos que el navegador no deja tomar**: en Chrome, Ctrl+N, Ctrl+W y Ctrl+T (y Ctrl+Shift+N/T/W, Ctrl+Tab) **no se pueden interceptar desde la página**; Ctrl+Q en Windows sí llega (en Mac Cmd+Q cierra el navegador). Ctrl+R, Ctrl+=/-, Ctrl+B, Ctrl+I, Ctrl+E, Ctrl+J se pueden tomar con `preventDefault`. [I, comportamiento conocido de Chrome; probarlo] Recomendación: Nuevo proyecto (Ctrl+N) y Cerrar ventana (Ctrl+W) sin atajo en MaKo; Ctrl+rueda con listener `{passive:false}` para frenar el zoom del navegador.
5. **Teclado latino/español**: ` [ ] ; no están donde en EE. UU. (en LatAm el `[` pide AltGr). Recomendación: escuchar por `event.code` (`Backquote`, `BracketLeft`, `BracketRight`, `Semicolon`), no por `event.key`, igual que hace CapCut con la posición física.
6. **Diamantes "Pro" y pestañas de IA paga** (Avatar de IA, Dreamina, Archivos multimedia de IA, Flujo óptico, Subtítulos bilingües…): no copiar el diamante; mostrar solo lo que MaKo tenga (p. ej., el puente a Google Flow) o atarlo al plan de MaKo. Decidir qué pestañas de IA aparecen.
7. **Opciones de Exportar que el navegador no puede cumplir** (ProRes, HEVC con alfa, AV1 según navegador, 8K): mostrar la lista completa de CapCut pero deshabilitar las imposibles, o recortarla. Recomendación: mostrar igual que CapCut y deshabilitar con aviso, para que el diálogo sea idéntico.
8. **Tamaños en CSS**: usar los px de este informe ÷1,25 como punto de partida y ajustarlos comparando lado a lado con el CapCut de Martín en su pantalla (él puede abrirlo; no se lanzó acá).

## 14. Riesgos y trampas concretas
- **La interfaz de CapCut cambia seguido** (CapCut tiene un artículo de ayuda solo para eso: https://www.capcut.com/help/capcut-ui-update-changes). Este informe queda fijado a la **9.3.0.3970**; la 2023 tenía otra barra de herramientas (botones sueltos de Revertir/Reflejar/Girar).
- **Un mismo texto inglés tiene varias traducciones** según el lugar: Media → "Multimedia" / "Archivos multimedia"; Rotate → "Girar" / "Rotar"; la pestaña izquierda "Adjustment" → "Ajuste" pero la pestaña derecha "Adjust" → "Ajustar". Se eligió la clave más probable en cada lugar, pero **solo mirando CapCut en español se confirma al 100 %**.
- **El contenido de algunos íconos se dedujo** (marcados [I]): el grupo ◢ Reflejar/Girar/Congelar/Revertir, las herramientas IA de la barra y el ícono de "ajustar zoom".
- **Selección múltiple sin fuente oficial**: Shift/Ctrl+clic y recuadro son deducción.
- **La configuración local de CapCut (`User Data/Config`) tiene datos personales** (rutas, IDs, tokens). Se leyeron solo claves de interfaz; no copiar esos archivos a ningún lado.
- Las capturas oficiales están en **inglés**; los nombres en español salen del `.po`, no de una captura en español.

## 15. Fuentes
- Capturas oficiales de CapCut Desktop: https://www.capcut.com/resource/how-to-use-capcut-on-pc (descargadas: `research/dl/pc_{empty,timeline,basic,audio,captions,tts,export1,export2,home,editor}.png`)
- Instalación local CapCut 9.3.0.3970: `C:/Users/marti/AppData/Local/CapCut/Apps/9.3.0.3970/Resources/po/{en,es-LA}.po`, `Resources/video_template_ratio.json`, `Resources/Font/SystemFont/`, `VECreator.dll`; `C:/Users/marti/AppData/Local/CapCut/User Data/Config/{Shortcut/*.json, globalSetting, commonSetting.ini, ToolbarCfg}`
- eMotion Video, guía CapCut Desktop 2025 (capturas 2023): https://www.emotionvideo.com.au/wp-content/uploads/2025/05/The-2025-CapCut-Desktop-Guide-by-eMotion-Video-and-Media-Training.pdf
- DefKey, atajos de CapCut: https://defkey.com/capcut-video-editor-shortcuts
- FastShortcuts, atajos de CapCut 2026: https://fastshortcuts.com/shortcuts/capcut/
- Ayuda oficial: https://www.capcut.com/help/export-videos-in-capcut · https://www.capcut.com/help/export-clip-of-video · https://www.capcut.com/help
- GIF en Desktop: https://www.capcut.com/resource/gif-maker · https://www.capcut.com/resource/capture-gifs
- Filmora, ajustes de la línea de tiempo de CapCut: https://filmora.wondershare.com/advanced-video-editing/capcut-timeline.html
- TourBox, congelar cuadro en CapCut PC: https://www.tourboxtech.com/en/news/how-to-freeze-a-frame-in-capcut-pc.html
- Vinculación (respuesta de foro): https://www.capeditcut.com/community/capcut/overlays-on-the-second-track-no-longer-move-with-the-main-clip-auto-snap-enabled/
- Tutorial en español (2024, orden de la barra): https://seosve.com/capcut-escritorio/
- **Descartadas por inventar atajos**: https://www.skillademia.com/shortcuts/capcut-shortcuts/ · https://www.meowtool.com/en/capcut-keyboard-shortcuts/ ; **descartadas por traducción automática**: https://www.capcut.com/es-es/resource/how-to-use-capcut

Herramientas de medición (reutilizables): `research/tools/{mode,scan,px,ink,texth,crop}.py` (PIL), `research/tools/po.py` (cruce en/es del `.po`: `python -I -X utf8 tools/po.py exact "Split"`), `research/tools/keymaps.py`, `research/tools/binctx.py`. Salidas del cruce: `research/out_po*.txt`.
