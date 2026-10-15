# Inventario de la copia de CapCut — qué tiene, qué está hecho, qué falta

*15/10/2026 (actualizado con los subtítulos del mismo día), chat «Video Editor», cuenta claude1. Pedido de Martín (por «Estrategia 3 cuentas»): «Creo que Video
Editor no terminó de copiar todo lo que debía copiar de CapCut, tal vez que termine eso primero».*

**La fuente** es el relevamiento de CapCut 9.3 (`relevamiento-capcut-funciones.md`, una fila por función que
nombra) y **lo hecho** se midió contra el código de `app/video-editor/` ese día (los registros de pestañas,
secciones y herramientas, y los catálogos). Lo que falta y su archivo salen de `docs/hallazgos-video-editor.md` →
«Lo que quedó SIN hacer».

> ⚠️ **«Hecho» quiere decir ESCRITO, no visto andar.** Las tres tandas del editor se construyeron sin servidor
> local. En producción sólo se midieron importar → agregar → dividir (13/10). El export y los subtítulos nunca se
> probaron en Chrome. Lo primero de cualquier plan es mirar lo hecho.

## El resumen

| Familia | CapCut | Hecho | A medias | Falta, y se puede copiar | Fuera, con su motivo |
|---|---:|---:|---:|---:|---:|
| Texto | 24 | 19 | 2 | 3 | 0 |
| Subtítulos | 15 | 9 | 1 | 5 | 0 |
| Audio | 20 | 5 | 5 | 3 | 7 |
| Color, efectos, filtros y fondo | 19 | 7 | 1 | 10 | 1 |
| Video básico, máscara y retoque | 18 | 5 | 4 | 8 | 1 |
| Transiciones | 6 | 4 | 1 | 1 | 0 |
| Animaciones | 6 | 5 | 0 | 1 | 0 |
| Velocidad | 6 | 3 | 2 | 1 | 0 |
| Línea de tiempo y operaciones de clip | 23 | 12 | 6 | 5 | 0 |
| Exportar | 12 | 6 | 2 | 2 | 2 |
| Biblioteca y plantillas | 9 | 2 | 1 | 1 | 5 |
| **Total** | **158** | **77** | **25** | **40** | **16** |

- **«A medias»**: está, pero le falta una parte que CapCut sí tiene. Va escrita en la fila.
- **«Fuera»**: no se copia por licencia, por costo, porque el navegador no puede o porque **no hay de dónde
  copiarla**. Las fuera por «no hay fuente» se nombran acá y no se inventan (regla de Martín del 14/10).

## Por familia

Estado: ✓ hecho · ◐ a medias · ✗ falta y se puede copiar · ⊘ fuera.

### Texto (24)
| Función | | Nota |
|---|---|---|
| Agregar texto · Plantillas de texto (12) · Efectos de texto (21) · Mis elementos predefinidos | ✓ | |
| Fuente · Tamaño · Negrita/Cursiva/Subrayado · May./min. · Color · Espaciado · Interlineado | ✓ | |
| Trazo · Sombra · Brillo · Curvar el texto · Transformación · Guardar como predefinido | ✓ | |
| Animación Entrada/Salida/Bucle · Texto a voz (ElevenLabs del cliente) | ✓ | |
| Alinear | ◐ | falta la alineación vertical |
| Fondo | ◐ | falta el fondo por carácter |
| Burbuja | ✗ | `text/registro.ts` |
| Fotograma clave en tamaño, espaciado, trazo y sombra | ✗ | el render usa el valor base (`params/extra/texto.ts`) |
| Seguimiento (de cámara o rostro) | ✗ | MediaPipe, Apache-2.0 |

### Subtítulos (15)
| Función | | Nota |
|---|---|---|
| Subtítulos automáticos · Idioma de origen · Plantillas (12) · Importar SRT/LRC/ASS · Ingresar manualmente · Exportar SRT/TXT | ✓ | nunca vistos en Chrome |
| Muletillas | ◐ | se identifican; eliminarlas no (lo cercano es «Borrar silencios») |
| Tiempos por palabra | ✓ | se guardan desde el 15/10 (`subtitles/palabras.ts`) |
| Dividir y combinar con Enter/Retroceso/Supr · Buscar y reemplazar | ✓ | 15/10, `subtitles/editar.ts`; sin ver en Chrome |
| Resaltar palabras clave | ✗ | ya tiene los tiempos por palabra |
| Edición basada en la transcripción (borrar el texto borra el video) | ✗ | palabras de Whisper → tramo de tiempo |
| Subtítulos bilingües | ✗ | Translator de Chrome (gratis, sólo escritorio); NLLB no (CC BY-NC) |
| Letras automáticas | ✗ | Whisper, peor con música |
| Emojis de IA | ✗ | necesita un modelo: va con el Gemini del cliente y se avisa antes |

### Audio (20)
| Función | | Nota |
|---|---|---|
| Volumen · Fundidos · Normalizar · Filtros y personajes de voz (19) · Ritmos automáticos | ✓ | normalizar no vuelve a medir al recortar; ritmos topea en 10 min |
| Reducir el ruido | ◐ | no es RNNoise: no saca un ruido que varía (`audio/dsp/ruido.ts`) |
| Tono y Timbre | ◐ | sin ◇ |
| Ritmos › Alinear con los marcadores | ◐ | falta |
| Grabar | ◐ | no compensa la latencia ni dibuja el clip que crece |
| Extraer / Recuperar audio | ◐ | «Recuperar» no saca el extraído de la mitad nueva de un video dividido |
| Mejorar voz · Canal | ✗ | RNNoise + ecualizador + compresor; canal es Web Audio |
| Vúmetro junto al tiempo | ✗ | `audio-manager.ts` |
| Aislar voz | ⊘ | Demucs: los pesos pueden ser CC BY-NC |
| Voz a canción · Clonar la voz | ⊘ | no hay nada gratis; cuesta créditos |
| Música · Efectos de sonido · Sonidos de TikTok · Música de marca | ⊘ | licencia (`lib/musica-catalogo.ts`) |

### Color, efectos, filtros y fondo (19)
| Función | | Nota |
|---|---|---|
| Filtros (28) · Efectos de video (21) · Ajustar básico (16) · HSL · LUT (CUBE/3DL) · Croma · Quitar fondo automático | ✓ | quitar fondo con el modelo selfie (tomas cercanas) |
| Guardar predefinido · Aplicar a todo | ◐ | el alcance de «Aplicar a todo» falta confirmarlo contra CapCut |
| Efectos corporales · Máscara de efecto | ✗ | «Próximamente» (`effects/components/biblioteca.tsx`) |
| Curvas · Círculo cromático | ✗ | sin registrar (`effects/registro-ce.ts`) |
| Ajuste automático · Combinación de colores · Corrección del color · Proteger el tono de la piel | ✗ | se calculan en el navegador, sin un modelo pago |
| Máscara de ajuste | ✗ | |
| Eliminación personalizada (pincel) | ✗ | `fondo/panel-eliminar-fondo.tsx` |
| Convertir a HDR / espacio cromático | ⊘ | el codificador del navegador no exporta 10 bits |

### Video básico, máscara y retoque (18)
| Función | | Nota |
|---|---|---|
| Escala · Posición · Rotación · Opacidad · Fotogramas clave | ✓ | la Posición Y está hecha de memoria: confirmar contra CapCut |
| Voltear | ◐ | el vertical existe y no tiene botón |
| Mezcla (11 modos) | ◐ | «Profundidad lineal» no está en el motor |
| Lienzo (color, desenfoque) | ◐ | uno por proyecto; sin «Diseño» ni «Aplicar a todo» |
| Máscara | ◐ | sin «Esquinas redondeadas», sin «Pluma» y sin seguimiento |
| Estabilización · Reducir el ruido de la imagen · Eliminar los parpadeos · Movimiento difuminado | ✗ | OpenCV.js o shaders: lo más pesado de la lista |
| Mejorar la calidad | ✗ | sólo imágenes; para video es muy lento |
| Retoque (rostro y cuerpo) · Seguimiento de cámara · Autoenmarcado | ✗ | MediaPipe, Apache-2.0 |
| Adición de iluminación (Relight) | ⊘ | no hay nada equivalente en el navegador |

### Transiciones (6)
| Función | | Nota |
|---|---|---|
| Catálogo (21) · Duración · Aplicar a todo · Arrastrar al corte | ✓ | CapCut trae ~450 (las miniaturas son suyas: no se copian) |
| Fundido a negro / Destello sobre un vertical en 16:9 | ◐ | tiñen sólo el clip, no las barras |
| Avisar al soltar en un hueco | ✗ | `drag-drop-controller.ts` |

### Animaciones (6)
| Función | | Nota |
|---|---|---|
| Entrada (7) · Salida (7) · Combinado (3) · Bucle (1) · Duración | ✓ | catálogo chico: JianYing tiene ~155 de entrada |
| Las de desenfoque y 3D («Desenfoque», «Zoom borroso») | ✗ | el gancho sólo mueve posición y opacidad |

### Velocidad (6)
| Función | | Nota |
|---|---|---|
| Estándar 0,1×–100× · Duración · Puntos de la curva | ✓ | |
| Cambiar tono del audio | ◐ | con curva no se conserva |
| Curva (7 predefinidos) | ◐ | las formas son aproximadas |
| Cámara lenta fluida | ✗ | la fusión de marcos es simple; el flujo óptico, pesado |

### Línea de tiempo y operaciones de clip (23)
| Función | | Nota |
|---|---|---|
| Seleccionar · Dividir · Borrar izq./der. · Eliminar · Congelar · Reflejar · Girar · Recortar · Imán · Ajuste automático · Acercar/Alejar · Deshacer | ✓ | |
| Marcadores | ◐ | van en una fila propia, no sobre la regla |
| Revertir | ◐ | no invierte el audio separado |
| Vinculación | ◐ | Q/W no borra lo vinculado |
| Eje de vista previa | ◐ | no suena |
| Bloquear/Ocultar/Silenciar pista | ◐ | desde el reproductor se mueven clips de pistas bloqueadas |
| Portada | ◐ | no se incrusta; «Editar portada» apagado |
| Clip combinado · Agrupar | ✗ | el motor no los tiene |
| Altura de la pista · Reemplazar el clip | ✗ | |
| Atajos I/O, Shift+X, Ctrl+R, Shift+B, Ctrl+J, Tab | ✗ | `actions/definitions.ts` |

### Exportar (12)
| Función | | Nota |
|---|---|---|
| Tasa de bits · H.264/HEVC/AV1 · mp4/mov (+webm) · fps · Subtítulos SRT/TXT · GIF | ✓ | **nunca exportado en producción** |
| Resolución | ◐ | 2K y 4K se estiran desde el lienzo |
| Audio | ◐ | AAC/MP3/WAV; falta FLAC |
| Portada incrustada | ✗ | |
| Flujo óptico · Marca de agua · Superresolución · Clips seleccionados · Rango I/O · 10 bits | ✗ | `export/opciones.ts` |
| Comprobación de copyright | ⊘ | compara sólo contra TikTok |
| 8K · ProRes | ⊘ | el navegador no los codifica (se dibujan apagados) |

### Biblioteca y plantillas (9)
| Función | | Nota |
|---|---|---|
| Importar · Avatares de IA | ✓ | el avatar llega entero cuando el puente lea el video del Flow nuevo |
| Stickers (emojis y formas) | ◐ | entran llenando el lienzo; CapCut los pone a ~1/3 |
| Favoritos | ✗ | |
| Tuyos · Tu espacio · Activos de la marca | ⊘ | necesitan el material en la nube (decisión 5) |
| Stickers de IA · Archivos multimedia de IA | ⊘ | cuestan créditos |
| GIPHY | ⊘ | API con términos propios: sin revisar |
| **Plantillas (de proyecto)** | ⊘ | **NO HAY DE DÓNDE COPIARLAS**: son el catálogo de ByteDance. Tenerlas es CREAR uno propio, y eso lo decide Martín |

## Los subtítulos, primero

**De dónde sale la transcripción: ya está resuelto, y no consume nada del cliente.** El editor transcribe con
**Whisper adentro del navegador** (transformers.js, `services/transcription/worker.ts`):
- es gratis;
- no gasta la cuota de IA del cliente;
- el audio no sale de la computadora;
- pide los **tiempos por palabra** (`return_timestamps: 'word'`, con los modelos `*_timestamped`; si fallan,
  cae a tiempos por frase).

El único costo es la primera descarga del modelo (≈77 MB en WASM, ≈300 MB en WebGPU), que después queda
guardada en el navegador.

**La cascada de STT de la casa no sirve acá, y no hace falta.** Corre en el servidor, gasta la cuota del cliente,
y su contrato es un texto, sin tiempos por palabra confiables. La decisión 6 del diseño ya la había descartado
para esto.

**Lo que falta para que los subtítulos sean los de CapCut:**
1. Mirarlos andar en Chrome: generar, plantillas, importar, manual, exportar SRT, y lo del 15/10.
2. ~~Guardar los tiempos por palabra en cada subtítulo~~ — **hecho el 15/10** (`7ef765fcc`). Hasta ese día se
   pedían y se tiraban.
3. ~~Dividir y combinar con Enter/Retroceso · Buscar y reemplazar~~ — **hechos el 15/10**. Falta resaltar
   palabras (tipo karaoke y palabras clave).
4. Eliminar las muletillas del VIDEO (sus tiempos ya se guardan, marcados) y la edición basada en la
   transcripción. Cortan el video: se construyen después de poder mirarlas en Chrome.
5. Bilingües (Translator de Chrome) · Letras automáticas · Emojis de IA. Esta última necesita un modelo: va con
   el Gemini del cliente y la pantalla lo avisa antes de arrancar.
