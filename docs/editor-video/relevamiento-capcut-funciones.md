# CapCut Desktop/Web: checklist completa de funcionalidades de edición

Relevamiento para el editor de video de MaKo (port de OpenCut + interfaz de CapCut). Fase de solo lectura. Fecha: 11/10/2026.

---

## 0. Cómo leer esto

**Leyenda de procedencia** (cada dato lleva una marca):

| Marca | Qué significa | Confianza |
|---|---|---|
| **[L]** | Texto de interfaz **oficial de CapCut**, sacado del diccionario de traducciones que trae la app instalada en esta PC (`es-LA.po`, CapCut **9.3.0.3970**). Lleva la clave entre corchetes. | Alta: es lo que CapCut muestra en pantalla en español latino |
| **[D]** | Valor sacado de un **proyecto real de CapCut** (`draft_content.json`) que está en esta PC. Muestra el modelo de datos y los valores por defecto. | Alta para el modelo de datos |
| **[W]** | Verificado en la web, con la URL en §11 | Media/alta según la fuente |
| **[P]** | De `pyJianYingDraft` (ingeniería inversa del formato de JianYing, la versión china de CapCut, con el mismo motor). Sirve de referencia. | Media |
| **[I]** | Inferido: no lo encontré escrito en ninguna parte | Baja: hay que comprobarlo mirando la app |

**Hallazgo principal: los nombres oficiales en español están en esta máquina.**
CapCut 9.3.0.3970 está instalado y trae sus traducciones como texto plano:

- `C:\Users\marti\AppData\Local\CapCut\Apps\9.3.0.3970\Resources\po\es-LA.po` (15.302 cadenas)
- `...\Resources\po\en.po` (16.495 cadenas)

Los uní por clave en `research/capcut-strings/en-es.tsv` (16.494 filas, formato `clave<TAB>inglés<TAB>español`). El script es `research/capcut-strings/join_po.py` y para buscar está `look.py`.

**Es la fuente de verdad para los nombres.** Copiar textos de interfaz entra en la regla de Martín. No se copió ni se va a copiar ningún binario: íconos, PNG, modelos o fuentes.

> **Trampa: las páginas `capcut.com/es-es/resource/...` NO usan los nombres de la app.** Son traducciones automáticas de los blogs en inglés. Ejemplos:
>
> | Función | Esas páginas dicen | La app dice [L] |
> |---|---|---|
> | Relight | «Reencuentro» / «reencendido» | «**Adición de iluminación**» |
> | Sharpen | «Afilado» | «**Enfocar**» |
> | Highlights | «Aspectos destacados» | «**Iluminar**» |
>
> Para los nombres no hay que usar la web: hay que usar el `.po`.

---

## 1. Estructura general de la pantalla

### 1.1 Biblioteca (barra superior izquierda) [L `pc_materiallib_*`]

**Pestañas, en el orden inferido [I]:**

- **Archivos multimedia**: Importar · Tuyos · Biblioteca · Tu espacio · Activos de la marca · Favoritos
- **Audio**: Música · Efectos de sonido · Sonidos de TikTok · Extraer audio · Música de marca
- **Texto**: Agregar texto · Plantillas de texto · Efectos de texto · Mis elementos predefinidos
- **Stickers**: Stickers · Stickers de IA · GIPHY
- **Efectos**: Efectos de video · Efectos corporales
- **Transiciones**
- **Subtítulos**: Agregar subtítulos · Subtítulos automáticos · Importar archivo · Ingresar manualmente · Letras automáticas
- **Filtros**
- **Ajuste**: Agregar ajuste · LUT · Mis elementos predefinidos · Valores predefinidos de la marca
- **Plantillas**
- **Avatares de IA** · **Archivos multimedia de IA**, y otras entradas de IA

**Comunes a todas las pestañas:** «Favoritos» con estrella e «Inicia sesión para ver tus … favoritos».

### 1.2 Barra de la línea de tiempo [L]

- Seleccionar · **Dividir** · **Borrar a la izquierda** · **Borrar a la derecha** · Eliminar · **Agregar marcador**
- Congelar · Revertir · Reflejar · Girar · Recortar · **Crear un clip combinado** · Agrupar / Desagrupar
- **Imán de la pista principal** · **Ajuste automático** (snapping) · **Vinculación** · **Eje de vista previa** · Acercar / Alejar · Deshacer / Rehacer
- Por pista: **Bloquear pista**, **Ocultar la pista**, **Silenciar pista**, más «Portada» en la pista principal

**Límites:**
- «Solo se admiten hasta 7 pistas de picture-in-picture» [L `pc_only_supports_ip_tracks`].
- «Edición basada en la transcripción» y «Varias líneas de tiempo» [L].

**Atajos** según Primal Video [W]: dividir Ctrl+B · borrar en onda a la derecha W · borrar en onda a la izquierda Q.

### 1.3 Exportar [L/W]

- **Controles:** Resolución · Tasa de bits · Codec · Formato · Cuadros por segundo · Exportar audio (MP3/WAV/FLAC) · Exportar subtítulos.
- **Límites:** hasta 4K y 60 fps [W]. Según Vidpros la cuenta gratis exporta a 1080p y Pro a 4K/60 [W]; no está confirmado oficialmente.
- **Comprobación de copyright:** existe un interruptor «Run a copyright check» [W], que solo compara contra la base de TikTok [W, terceros].

---

## 2. Panel derecho: VIDEO (clip de video o imagen)

**Pestañas** [I, armado con la guía oficial «Video > Básico» de la página del estabilizador y con las claves `pc_new_*`]:

- **Video**, con subpestañas **Básico · Eliminar fondo · Máscara · Retoque**
- **Audio**
- **Velocidad**
- **Animación**
- **Ajustar**

### 2.1 Video › Básico

| Control (nombre CapCut) | Rango / valor por defecto | Fuente |
|---|---|---|
| **Transformación** › **Escala** | Por defecto 100 % (`scale 1.0`). Interruptor «**Escala uniforme**» encendido por defecto. Si se apaga, hay X/Y por separado. Rango 1–500 % [I] | [L `pc_new_basic_transform`, `pc_rate_same`] [D `uniform_scale.on=true`] |
| **Posición** X / Y | Por defecto 0,0. Internamente la unidad es **medio lienzo**: la UI muestra píxeles y el modelo guarda «valor / ancho del borrador» | [L `location`] [D] [P] |
| **Rotación** | En grados, por defecto 0. Sentido horario | [L] [D] [P] |
| **Voltear** (horizontal / vertical) | Por defecto falso | [D `clip.flip`] |
| **Opacidad** | 0–100 %, por defecto 100 (`alpha 1.0`) | [L `opacity`] [D] [W] |
| **Mezcla** › **Modo** | 11 modos: **Normal** + **Pantalla** (screen) · **Oscurecer** · **Iluminar** (lighten) · **Superposición** · **Luz intensa** · **Luz tenue** · **Profundidad lineal** (linear burn) · **Profundidad del color** (color burn) · **Desvanecimiento del color** (color dodge) · **Multiplicar** | [L `mix`, `blend_mode`, nombres en `Resources/MixMode/MixMode.json`] |
| **Estabilización** (casilla) › **Nivel** | **Recomendado** · **Corte mínimo** · **Más estable** | [W capcut stabilizer] [L `anti-shake_level`, `minimum_crop`, `most_stable`] [D `stable.stable_level`] |
| **Reducir el ruido de la imagen** | **Débil** / **Fuerte** | [W capcut-pro-pc] [L `pc_new_reduce_noise`, `pc_new_basic_weak_n` / `strong_n`] |
| **Eliminar los parpadeos** | Modos linterna / lapso de tiempo, 3 niveles | [L `pc_new_basic_remove_flickers`] [W] |
| **Mejorar la calidad** | Superresolución | [L `pc_new_enhance_image`] |
| **Adición de iluminación** (Relight) | Modos Facial / Ambiente / Creativo. Hasta 50 elementos predefinidos | [L `pc_feature_relight`, `pc_light_use_up`] [W] |
| **Movimiento difuminado** (motion blur) | Usa flujo óptico | [L `pc_motion_blur`] |
| **Lienzo** › Color / **Lienzo con desenfoque** / **Diseño** (patrón) / imagen propia · **Aplicar a todo** | El desenfoque tiene **4 niveles**: 0,0625 / 0,375 / 0,75 / 1,0. El color por defecto es transparente | [L `pc_background_fill`, `canvas_blur_new`, `pc_new_basic_pattern`] [P] [D `canvases.type=canvas_color`] |
| ◆ Fotograma clave | Al lado de cada propiedad. Ver §8 | [L] [W] |

### 2.2 Video › Eliminar fondo (antes «Recorte») [L `pc_new_remove_background`]

**Eliminación automática** [L `pc_new_remove_background_auto`]
- Recorta a la persona.
- Hay un aviso antiguo: «Solo se pueden recortar figuras humanas» [L].

**Eliminación personalizada** [L]
- **Pincel inteligente** / **Pincel rápido** · **Borrar** / **Borrado rápido** · **Tamaño del pincel**
- **Ampliación** · **Difuminar** · **Invertir**
- El modelo [D] guarda `matting.expansion`, `feather`, `reverse` y `strokes`.

**Chroma key** [L `chroma_matting`]
- **Selector de colores**, luego **Intensidad** · **Sombra** · **Borde de plumas** (sic, así en la app) · **Limpiar borde**.
- Rango de 0 a 100 en todos [P `add_chroma`: `intensity`, `shadow`, `edge_smooth`, `spill`].
- Texto de la app: «Elige el color y, luego, ajusta la intensidad.»

### 2.3 Video › Máscara [L `pc_color_mask_*`, `pc_mask_*`]

**Formas:** Ninguna · **Línea** · **Líneas paralelas** (es la «espejo» del inglés) · **Círculo** · **Rectángulo** · **Corazón** · **Estrella** · **Pluma** (máscara a mano alzada) · **Texto**.

**Parámetros:** **Posición** · **Rotación** · **Tamaño** (Ancho / Alto) · **Difuminar** · **Esquinas redondeadas** (solo en el rectángulo) · **Invertir**.

**Valores por defecto [P]:**
- Tamaño: 0,5 de la altura del clip, centrado.
- Difuminar: 0–100, por defecto 0.
- Esquinas redondeadas: 0–100, por defecto 0.
- Relación de aspecto: corazón 1,115, estrella 1,05, el resto 1,0.
- La línea tapa la mitad de abajo; las líneas paralelas conservan la franja del medio.

**Seguimiento:** «**Realizar seguimiento de la máscara**» → **Seguir**, con **Retroceder / Avanzar / Retroceder y avanzar**. No funciona en GIF [L].

**Variantes:**
- «Máscara de ajuste» (aplicada al color).
- «Máscara de efecto».
- Borde y sombra de la máscara [D `video_mask_stroke`, `video_mask_shadow`].

### 2.4 Video › Retoque [L `pc_retouch_*`, `pc_auto_beautify_*`]

**Estilos automáticos:** Ninguno + estilos. Parámetros: Intensidad · Filtro · Maquillaje · Remodelar · Retoque.

**Rostro**
- **Rostro único** / **Varios rostros**.
- Piel: **Suavizar** · **Proteger el color de la piel**.
- Forma: **Forma de V** · **Ancho** · **Mentón**, más ojos, cejas, nariz y boca (Alto, etc.).

**Maquillaje**

**Cuerpo**
- **Automático**: **Proporcional** · **Curvo** · **Perfeccionado**.
- **Manual**: **Adelgazar** · **Estirar** · **Redimensionar** · Área de estiramiento.

**Manual**
- **Pincel** · **Borrador** · **Borrar imperfecciones** · **Suavizar piel** · Intensidad · Tamaño.

**Parámetros predefinidos**
- **Guardar como parámetro facial / corporal predefinido** («Parámetro predefinido %1»), con un tope de N.

**Privacidad:** la app avisa «Tus archivos multimedia no se cargarán en nuestro servidor» [L `pc_retouch_allow_dialog_info_one`]. **Es procesamiento local.**

### 2.5 Velocidad [L `pc_new_speed*`, `curve_*`]

**Estándar** (antes «Normal»)
- **Velocidad** de **0,1x a 100x** [W, oficial] · **Duración**: al escribir una duración se recalcula la velocidad.
- Interruptor de tono [L `pc_new_speed_keep_pitch`], con dos rótulos según la versión:
  - «**Cambiar tono del audio**»: apagado por defecto, así que se conserva el tono [D `is_tone_modify:false`].
  - «**Mantener el tono**» [L `pc_new_voice_keep_pitch`].
- **Cámara lenta fluida**, solo con velocidad < 1x: **Flujo óptico** o **Fusión de marcos**. Mientras procesa: «Aplicando flujo óptico… %1%».

**Curva**
- Ajustes predefinidos: **Personalizado** · **Montaje** · **Héroe** (o «Momento heroico») · **Bala** · **Corte en la edición** (jump cut) · **Flash de entrada** · **Flash de salida**.
- Se editan con puntos arrastrables.

**Límite:** «El clip debe durar al menos 0,1 s después de la rampa» [L `pc_clip_too_short`].

**Modelo** [D]: `speeds {mode:0|1, speed:1.0, curve_speed:null}`.

### 2.6 Animación [L]

**Pestañas:** **Entrada** · **Salida** · **Combinado**. **Bucle** solo existe en texto y stickers.

**Control:** **Duración**, un slider sobre la duración del clip.

**Valores por defecto [P, catálogo JianYing usado como referencia]:**
- Entrada: 0,5 s es lo más común (36 de 155). Van de 0,167 s a 6,92 s.
- El combinado ocupa el clip entero.
- Solo el ~25 % de las animaciones de entrada son gratis en JianYing.

### 2.7 Ajustar (color) [L `pc_new_adjust*`, `Resources/DefaultAdjustBundle/*`]

**Arriba:**
- **Ajuste automático** (IA).
- **Combinación de colores**: «Aplica el tema de color de la foto original a los clips».
- **Corrección del color**, con IA.
- **Proteger el tono de la piel**.
- **Convertir a HDR** · **Cambiar el espacio cromático**.

**Básico** (sliders). Las carpetas `DefaultAdjustBundle` confirman este conjunto: brightness, contrast, saturation, light_sensation, highlight, shadow, temperature, tone, sharpen, fade, vignetting, particle, clear, black_white.

- **Temp** (temperatura) · **Tinte** · **Saturación** · **Brillo** · **Contraste** · **Exposición** · **Luminosidad** (brilliance)
- **Iluminar** (highlights) · **Sombras** · **Blancos** · **Negros** · **Claridad** · **Enfocar** (sharpen)
- **Granulado** · **Desvanecer** · **Viñeta**

**Rangos:**
- Internamente brillo, contraste y saturación van de −1 a 1, con 0 = original [P].
- Los archivos de configuración tienen `sliderIntensity: 50`, o sea que el slider de 0–100 arranca en el medio [L, archivo].
- En la interfaz: **−50…+50** los bipolares y **0…100** los unipolares (Enfocar, Granulado, Desvanecer) [I, documentado para móvil].

**HSL**
- 8 colores, cada uno con Matiz / Saturación / Luminosidad [L `pc_hsl_basics`, `hue`, `lightness`].

**Curvas**
- RGB + rojo, verde y azul [L `pc_curve`] [D `color_curves`, `hsl_curves`].

**Círculo cromático**
- **Principal** y **Registro** (Log) [L `pc_primary_color_wheel`, `pc_log_color_wheel`].

**LUT**
- Importar «**Archivos CUBE y 3DL**» + Intensidad [L `pc_new_adjust_support`].

**Más opciones:**
- **Máscara de ajuste**.
- **Guardar como parámetro predefinido**: hasta 200 en la marca [L].
- **Aplicar a todo**.

> **Ajuste como capa:** «**Agregar ajuste**» [L `pc_materiallib_adjust_new`] en la pestaña Ajuste de la biblioteca crea un clip de ajuste en la línea de tiempo que afecta a todo lo que está debajo. Lo mismo pasa con un Filtro o un Efecto arrastrado a una pista propia [W primalvideo].

### 2.8 Seguimiento y encuadre

- **Seguimiento de cámara** [L `lens_lock`]: Rostro / Cuerpo / Mano y «Comenzar» [W how-to-use-capcut].
- **Autoenmarcado** [L `pc_feature_auto_reframe`]: proporción (16:9, 4:3, 2:1, 9:16…), estabilización y velocidad de cámara. **Es Pro** [W, centro de ayuda oficial].

---

## 3. Panel derecho: AUDIO (pista de audio, o pestaña Audio de un clip de video)

### 3.1 Básico [L]

| Control | Detalle | Fuente |
|---|---|---|
| **Volumen** | Por defecto 100 % (`volume 1.0`). Una guía da un máximo de 200 %. La UI muestra dB [I] | [D] [W hollyland] |
| **Aparición progresiva** / **Desaparición progresiva** (fade in / out) | Duración en segundos, un solo fundido por clip. El máximo no está documentado [I] | [L `pc_new_audio_fade_in` / `out`] [P] |
| **Normalizar la intensidad** | Objetivo **−23 LUFS** en el borrador (`target_loudness:-23.0`). Guarda `avg_loudness` y `peak_loudness` | [L `pc_new_loudness_adjust`] [D `loudnesses`] |
| **Reducir el ruido** | `denoise_rate 0,85` por defecto, modelo `denoise_v2`. CapCut trae **RNNoise** local (`Resources/rnnoise/rnnoise_v2.0.model`) | [L `pc_new_audio_reduce_noise`] [D `realtime_denoises`] |
| **Mejorar voz** | Intensidad, con `ambient_sound_level 75` por defecto. Limpia ruido, eco y viento | [L `pc_feature_enhance_voice`] [D `vocal_beautifys`] [W] |
| **Aislar voz** / **Aislamiento vocal** | Elegir entre **Eliminar voz** e **Instrumentos** (o conservar la voz) | [L `pc_separate_sound`, `pc_separate_sound_save`, `pc_keep_background_new`] [D `vocal_separations.choice`] |
| **Canal** | Mono / izquierdo / derecho: «Completa un canal con el audio de otro canal» | [L `pc_channel`, `fill_voiced_side_to_silent`] [D `sound_channel_mappings`] |

### 3.2 Efectos de voz [L `change_voice`, `pc_voice_effect_*`]

**Pestañas:**
- **Filtros de voz**
- **Personajes de voz**: «Adam, joven», «Tío Tom», «Eve, voz dulce», «Monstruo»…
- **Voz a canción**
- **Modificador de voz**: voz personalizada clonada; **cobra créditos**, «1 segundo = %1 créditos» [L].

**Parámetros:** **Tono** · **Timbre** · **Fuerza** · **Tamaño de la habitación** · **Profundidad** · **Frecuencia** · **Ruido** · **Cantidad** · **Amplitud** · **Centro** · **Ritmo envolvente**.

### 3.3 Velocidad

Igual que en video (§2.5), con **Mantener el tono**.

### 3.4 Ritmos (beats) [L]

- **Ritmo automático**, con dos sensibilidades: **Ritmo 1** / **Ritmo 2**.
- **Agregar ritmo** · **Marcar ritmos**: marcas manuales sobre la onda.
- **Modelo** [D `beats`]: `ai_beats.beats_url`, que viene **precalculado en el servidor para la música de la biblioteca**, más `user_beats`.

### 3.5 Grabar y extraer

- **Grabar** → genera una pista «**Voz superpuesta**» (voiceover).
- **Extraer audio de video** · **Separar audio** [L].

---

## 4. Panel derecho: TEXTO [L]

### 4.1 Básico

| Control | Detalle y valor por defecto [D salvo otra marca] |
|---|---|
| Caja de texto | «**Texto predeterminado**» |
| **Fuente** | Catálogo propio. Se pueden importar hasta 9 fuentes a la vez [L] |
| **Tamaño de la fuente** | Unidad propia de CapCut, rango 1–300+ [W, centro de ayuda]. 15 por defecto [I]. En el borrador hay 12 y 18 |
| **Diseño** (patrón) | **Negrita** (`bold_width 0,008`) · Cursiva (`italic_degree 10°`) · Subrayado (ancho 0,05, offset 0,22) |
| **May./min.** | Mayúscula / Minúscula / Capitalizar |
| **Color de la fuente** | Por defecto `#ffffff`, opacidad 1,0 |
| **Espaciado entre caracteres** | 0 |
| **Interlineado** | 0,02 |
| **Alinear** | Izquierda / centro / derecha (centro por defecto, `alignment 1`), más vertical |
| **Estilo preestablecido** | Ajustes predefinidos de estilo |
| **Trazo** | Color (`#000000`) · **Grosor** (0,06 al activarse) · **Posición**: **Dentro / Centro / Fuera** [L `CC_PC_material_text_effect_stroke_position_*`] |
| **Fondo** | Color · Opacidad · **Esquinas redondeadas** · **Alto / Ancho** (0,14) · desplazamiento horizontal y vertical. También fondo por carácter |
| **Sombra** | Color · Opacidad (0,9) · **Desenfocar** (0,45) · **Distancia** (5) · **Ángulo** (−45°) |
| **Brillo** (glow) | Efecto de brillo [L `pc_glow_effect`] |
| **Curvar el texto** › **Fuerza** | No funciona con fondo ni con subrayado: «El texto con fondo no se puede curvar» [L `pc_text_bend*`] |
| Transformación | Escala, posición, rotación. Los subtítulos van por defecto en `y = −0,56` [D] |
| **Guardar como parámetro predefinido** | Hasta 200 en la marca |

### 4.2 Otras pestañas de texto

- **Plantillas de texto**, **Efectos de texto** y **Burbuja**.
- **Animación**: **Entrada / Salida / Bucle** + Duración.
- **Texto a voz** (§6). **Seguimiento** (de cámara o rostro).

---

## 5. Subtítulos, stickers, efectos, filtros y transiciones

### 5.1 Subtítulos [L `pc_caption_menu_*`]

**Subtítulos automáticos**
- **Idioma de origen** (con «Detectar automáticamente»).
- La app dice textualmente «CapCut puede reconocer **hasta 17 idiomas** y generar subtítulos bilingües» [L `pc_feature_caption_conent`].
- Trae 17 archivos de muestra (`Resources/icon/cc_caption_duration_info_<idioma>.json`): árabe, inglés, filipino, francés, alemán, chino tradicional, indonesio, italiano, japonés, coreano, malayo, portugués, ruso, **español**, tailandés, turco y vietnamita.
- Hay además **26 claves de idioma nuevas** (`pc_caption_language_*`: azerí, búlgaro, checo… zulú), probablemente una ampliación reciente.

**Opciones de idioma y estilo**
- **Subtítulos bilingües** › **Traducir a**. La web oficial dice más de 15 idiomas [W].
- **Plantillas de subtítulos**.
- **Resaltar palabras clave** (manual o automático), con «**Estilo**».

**Limpieza del habla**
- **Identificar las muletillas** / **Eliminar las muletillas**.
- **Edición basada en la transcripción**: **Transcribir** → borrar texto borra el video. Categorías: «**Pausa, repetición y duda**».
- Pausa mínima de **0,1 s** [L `pc_toast_text_cut_minimum_seconds`]. Primal Video sugiere unos 1,8 s [W].

**Importar y letras**
- **Importar subtítulos**: **SRT, LRC y ASS** · **Ingresar manualmente**: «El texto se dividirá en subtítulos automáticamente».
- **Letras automáticas**, con **Idioma de las letras**.

**Pro:** existe el texto «Estás utilizando una función Pro» dentro del menú de subtítulos [L `pc_caption_menu_vip`]. Parte del menú es Pro.

### 5.2 Stickers [L]

- **Stickers** · **Stickers de IA** · GIPHY.
- Animación Entrada / Salida / **Bucle** · Transformación · Seguimiento.
- Stickers que cubren rostros: «Solo se pueden cubrir hasta 5 rostros» [L].

### 5.3 Efectos [L `effects_adjust_*`]

**Tipos:** **Efectos de video** y **Efectos corporales**.

**Dos modos:**
- Arrastrado sobre un clip: afecta solo a ese clip.
- En una pista propia: afecta a todo lo que está debajo.

**Parámetros** (de 0 a 100 [P]; cada efecto trae los suyos):
- **Intensidad** · **Velocidad** · **Intervalo** (rango) · **Brillo** · **Ruido** · **Textura** · **Giro**
- **Monto** · **Atmósfera** · **Enfocar** · **Luz tenue**
- **Diferencia cromática horizontal / vertical** · Horizontal / Vertical

**Máscara de efecto.**

### 5.4 Filtros

**Intensidad** de 0 a 100, **100 por defecto** [P]. Se aplica a un clip o como capa.

### 5.5 Transiciones

- **Duración:** la UI no documenta un valor por defecto. En el catálogo de JianYing [P] lo más común es 1,0 s (122 de 453) o 0,5 s (114), con extremos de 0,2 s a 5 s.
- **Máximo:** la mitad del clip más corto [W, TourBox; no es oficial].
- **Aplicar a todo** [W].
- **Gratis:** solo unas 130 de 453 en JianYing [P].

---

## 6. Funciones de IA y automáticas: gratis o Pro, y cómo hacerlas sin pagar API

> **El estado Pro no es estable.** CapCut lo cambió varias veces:
> - Una petición de 09/2024 dice que pasaron a Pro la cámara lenta, el motion blur, las fuentes, los efectos, las animaciones, las transiciones, los stickers, el retoque, quitar fondo, la reducción de ruido, la estabilización y los filtros [W, change.org].
> - En 2026 la cuenta gratis exporta a 1080p, con 10 min de subtítulos por video y créditos limitados para quitar fondo [W Vidpros, 05/2026].
>
> El único dato oficial es que **Autoenmarcado es Pro** [W, centro de ayuda].
>
> **Dato clave:** CapCut ejecuta **en la PC** gran parte de esta IA. `Resources/models` tiene 61 modelos:
>
> | Carpeta | Para qué |
> |---|---|
> | `mattingmodel/` | Recorte de figura |
> | `interpolation/lens_vfi_v1.0.model` | Interpolación de cuadros |
> | `deflicker/` | Quitar parpadeos |
> | `noise_reduction/` | Ruido de imagen |
> | `object_tracking/` | Seguimiento de objetos |
> | `rnnoise/` | Ruido de audio |
> | `facebeautifymodel`, `skin_seg` | Retoque |
> | `audiosami/unet_denoise_44k_music` | Audio |
>
> **Que sea Pro es una decisión comercial; no hay un costo de nube detrás.** Casi todo se puede hacer en el navegador.

| Función (nombre CapCut) | Gratis/Pro en CapCut | Alternativa gratis en el navegador (librería, licencia) | Dificultad |
|---|---|---|---|
| **Subtítulos automáticos** | Conflicto: gratis con tope de 10 min/video según Vidpros; «exclusivo Pro» según la página oficial standard-vs-pro | **Whisper** con transformers.js u `@remotion/whisper-webgpu`, que devuelve marcas de tiempo por palabra [W]. Ojo: en transformers.js v3 las marcas por palabra fallaban con WebGPU (issue abierto) [W] | Media |
| **Letras automáticas** | Ídem | Whisper (peor con música; mejora si antes se aísla la voz) | Media |
| **Subtítulos bilingües** (traducir) | Parcialmente Pro [L vip] | API **Translator integrada en Chrome**: estable desde Chrome 138, solo escritorio [W]. Alternativa: Opus-MT con transformers.js. **No usar NLLB**: es CC BY-NC [I] | Baja |
| **Identificar y eliminar muletillas** / pausas | Pro según terceros | Palabras de Whisper + lista de muletillas en español («eh», «este», «o sea», «tipo», «bueno») + detección de silencio por RMS con Web Audio | Baja |
| **Edición basada en la transcripción** | Gratis o Pro, no está claro | Whisper + mapear palabra → rango de tiempo | Media |
| **Texto a voz** | Gratis; algunas voces premium son Pro [W, FAQ CapCut] | **Piper** en WASM (`@mintplex-labs/piper-tts-web`), con voz **es_AR «daniela» high** [W]. **Kokoro** tiene voces en español, pero kokoro-js fonetiza todo con reglas de inglés [W, sin confirmar]. ⚠️ La Web Speech API es gratis **pero no deja grabar el audio para exportarlo** [I] | Media |
| **Efectos de voz** (filtros y personajes) | Gratis o Pro | Web Audio: pitch con **Tone.js PitchShift** (MIT), convolver para reverb, filtros biquad, distorsión | Baja |
| **Modificador de voz** (clonación) | **Créditos** [L] | No hay nada gratis decente en el navegador. Dejarlo fuera, o pasarlo por un servicio pago opcional | n/d |
| **Voz a canción** | Pro/créditos | No hay alternativa gratis. Dejarlo fuera | n/d |
| **Reducir el ruido** (audio) | Pro según la petición | **RNNoise** en WASM (BSD-3, el mismo que usa CapCut). Paquetes `@jitsi/rnnoise-wasm` y `@shiguredo/rnnoise-wasm` (licencia por verificar) [W]. Hay que adaptar bloques de 128 → 480 muestras en el AudioWorklet | Baja |
| **Mejorar voz** | Pro según terceros | RNNoise + ecualizador + compresor (DynamicsCompressor) | Baja |
| **Normalizar la intensidad** | Gratis | Medir la intensidad EBU R128 en JS y aplicar ganancia. Objetivo −23 LUFS como CapCut, o −14 para redes [I] | Baja |
| **Aislar voz** | **Pro** [W bigvu] | **Demucs** en el navegador (demucs-web, demucs-rs, ONNX, unos 172 MB). ⚠️ Los pesos v3/v4 pueden ser **CC BY-NC**: hay fuentes en conflicto [W] | Alta + riesgo de licencia |
| **Ritmo automático** | Gratis | `web-audio-beat-detector` (MIT) [W]. ⚠️ **No usar essentia.js**: Essentia es AGPL/no comercial y sus modelos CC BY-NC-ND [W] | Baja |
| **Eliminación automática** (quitar fondo) | Créditos limitados gratis / Pro | **MediaPipe Selfie/Image Segmenter** (Apache-2.0, tiempo real) [W]. ⚠️ **@imgly/background-removal es AGPL** y **BRIA RMBG es CC BY-NC**: evitar ambos [W] | Media |
| **Chroma key** | Gratis | Shader WebGL: distancia de color + suavizado + supresión de derrame | Baja |
| **Estabilización** | Pro según la petición | **OpenCV.js** (Apache-2.0): flujo óptico Lucas-Kanade → suavizar la trayectoria → warp + recorte. Se procesa en un paso aparte, no en vivo | Alta |
| **Autoenmarcado** | **Pro (oficial)** | Detector de rostro y objetos de MediaPipe + suavizado (Kalman) → animar el recorte. Es la idea de AutoFlip de Google | Media |
| **Cámara lenta fluida** (Fusión de marcos / Flujo óptico) | Pro según la petición | **Fusión de marcos**: mezcla de cuadros, trivial. **Flujo óptico**: RIFE en ONNX, pesado | Baja / Alta |
| **Movimiento difuminado** | Pro según la petición | Acumulación de N sub-cuadros con shader | Media |
| **Mejorar la calidad** (superresolución) | Pro | Swin2SR o Real-ESRGAN con transformers.js u ONNX. Muy lento para video: limitarlo a imágenes | Alta |
| **Reducir el ruido de la imagen** / **Eliminar los parpadeos** | Pro | Shader bilateral o temporal; suavizar la luminancia cuadro a cuadro | Media |
| **Retoque** (rostro y cuerpo) | Pro según la petición | **MediaPipe Face Landmarker** (Apache-2.0) + shaders: suavizado de piel, warps de forma | Alta |
| **Seguimiento de cámara** / máscara | Pro [W bigvu] | MediaPipe (rostro, pose, manos) o un tracker de OpenCV | Media |
| **Adición de iluminación** (Relight) | Pro | Sin equivalente barato. Dejarlo fuera | n/d |
| **Escritor de IA** / **De guion a video** / **Edición con IA** / **De videos largos a cortos** | Pro / créditos | **Prompt API de Chrome** (Gemini Nano, en origin trial para páginas web) o **WebLLM** (Apache-2.0, modelos de 1–3B con WebGPU), o el LLM barato de MaKo | Media |
| **Avatares de IA** / **Sincronización labial** / **Traductor de videos** | Créditos | No hay opción gratis viable. Dejarlo fuera, o pasarlo por el puente de Google Flow si corresponde | n/d |

---

## 7. Biblioteca de audio de CapCut y licencias para MaKo

**Lo que trae CapCut:**
- **Música** y **Efectos de sonido**, con categorías y favoritos.
- **Sonidos de TikTok**: vincular la cuenta y pegar un enlace.
- **Música de marca** · **Extraer audio** · **Grabar**.

La licencia de esa música está **ligada a CapCut y TikTok**: la etiqueta «comercial» vale solo dentro de esas plataformas, y la comprobación de copyright solo compara contra TikTok [W, terceros].

**MaKo no puede reutilizarla.**

| Fuente | Licencia | ¿Sirve para la biblioteca precargada de un SaaS? | Fuente |
|---|---|---|---|
| **Freesound CC0** | Dominio público | **SÍ.** Se descarga, se aloja en nuestro Storage y se redistribuye | [W freesound FAQ] |
| Freesound CC BY | Atribución | Sí, **con atribución** visible en la app y en los créditos del video | [W] |
| Freesound CC BY-NC / Sampling+ | No comercial | **NO** | [W] |
| **API de Freesound** | Términos propios | **NO en producción sin acuerdo**: «el uso comercial de la API se negocia caso por caso con la UPF»; la licencia gratis es temporal y revocable | [W tos_api] |
| **Pixabay** (música y SFX) | Pixabay Content License | **NO.** Prohíbe «compilar contenido para replicar un servicio similar o competidor», la descarga sistemática y la distribución standalone. Además **su API no ofrece música ni SFX**, solo imágenes y video | [W pixabay terms + api docs] |
| **YouTube Audio Library** | Licencia de YouTube / CC BY por pista | **NO para precargar**: solo se baja desde YouTube Studio, sin API, y la licencia estándar está pensada para YouTube. El usuario puede importarla por su cuenta | [W, terceros] |
| **Biblioteca de CapCut / TikTok** | Ligada a la plataforma | **NO** | [W] |
| **Jamendo API** | CC por pista; comercial con Jamendo Licensing | **NO** por defecto: el uso comercial se arregla con el equipo de ventas | [W devportal] |
| **Mixkit** | Licencia propia de SFX y música | **Sin verificar**: el texto de la licencia no se pudo leer (lo carga JavaScript). Es habitual que prohíban la redistribución standalone → no usar hasta leerla | [I] |
| **Kenney** (packs de audio: interfaz, impactos…) | **CC0** | **SÍ** | [W, terceros] |
| **Openverse API** | Agrega audio CC (Jamendo, Wikimedia…) | **SÍ** filtrando `license_type=commercial,modification` y mostrando el campo `attribution` | [W, terceros] |
| Incompetech (Kevin MacLeod) | CC BY 4.0 | Sí, con atribución | [I] |
| Música generada por IA en el navegador (MusicGen) | Pesos **CC BY-NC** | **NO** | [I] |
| Lo que importa el usuario (Importar / Extraer audio / Grabar) | Del usuario | Sí; la responsabilidad es del usuario | — |

**Trampa en OpenCut (el código que se va a portar):**
- Archivo: `scratchpad/ext/classic/apps/web/src/app/api/sounds/search/route.ts`, líneas 108–112.
- Problema 1: usa la **API de Freesound**, que requiere acuerdo comercial.
- Problema 2: su filtro `commercial_only` **incluye `"Attribution Noncommercial"`**, así que con el filtro «solo comercial» igual deja pasar sonidos no comerciales.
- Problema 3: no muestra la atribución CC BY en el video exportado.

**Hay que reescribir esa parte.**

---

## 8. Fotogramas clave

**Dónde aparecen** [L/W/P]: el rombo ◆ «**Fotograma clave**» está al lado de cada propiedad. Propiedades confirmadas:
- **Posición X/Y**, **Escala** (uniforme o X/Y), **Rotación** y **Opacidad**.
- **Saturación**, **Contraste** y **Brillo**, de −1 a 1 [P].
- **Volumen** (audio y clip de video).
- Según CapCut también efectos y balance de audio [W]. Máscara y ajuste [I].
- Texto y stickers: solo posición y tamaño [P].

**Interpolación** [L `keyframe_preset_*`]:
- **Lineal** · **Aceleración** (ease in) · **Desaceleración** (ease out) · **Aceleración y desaceleración**.
- Además, «**Mostrar los gráficos del fotograma clave**»: un editor de curva [L `expand_keyframes_graph_panel`] [D `keyframe_graph_list`].

**Conflicto:** «Conflicto con los efectos. Los fotogramas clave se cancelaron» [L].

---

## 9. Modelo de datos del borrador de CapCut (útil para el port)

Origen: `C:\Users\marti\AppData\Local\CapCut\User Data\Projects\com.lveditor.draft\<proyecto>\draft_content.json`, JSON plano. Resumen en `research/capcut-strings/draft_schema_0524.txt` y `draft_schema_0824.txt`. El contenido personal está redactado.

**Tiempo**
- Todo en **microsegundos**: `source_timerange`, `target_timerange`, `{start, duration}`.

**Segmento**
- `speed` · `volume` · `is_tone_modify` · `reverse`.
- `clip {scale{x,y}, rotation, transform{x,y}, flip, alpha}` · `uniform_scale{on,value}`.
- `extra_material_refs`: velocidad, lienzo, animación, canal, separación vocal, etc.
- `keyframe_refs` · `enable_adjust` / `enable_lut` / `enable_hsl` / `enable_color_curves` / `enable_color_wheels` · `enable_video_mask`.

**`materials`: 54 tipos**
- `videos` · `audios` · `texts` · `text_templates` · `effects` · `video_effects` · `transitions` · `stickers` · `canvases`
- `speeds` · `material_animations` · `audio_fades` · `beats` · `loudnesses` · `realtime_denoises` · `vocal_beautifys` · `vocal_separations` · `sound_channel_mappings` · `audio_pitch_shifts`
- `chromas` · `common_mask` · `hsl` · `color_curves` · `primary_color_wheels` · `log_color_wheels`
- `manual_beautys` · `smart_crops` · `video_trackings` · `smart_relights`, entre otros

**Proyecto**
- `canvas_config {ratio:'original', width:1920, height:1080}` · `fps 30`.
- Pistas: `video` / `audio` / `text`; la principal tiene `flag 0` y las superpuestas `flag 2`.

---

## 10. Lo que quedó sin verificar (y cómo verificarlo sin abrir CapCut)

- **Orden exacto de pestañas y subpestañas del panel derecho.** El `.po` da los nombres, no el orden. Se puede abrir `Resources` o `lynx_core.js` y buscar las claves `pc_new_*`, o mirar capturas de 2026.
- **Rangos numéricos en la UI** de Escala (¿1–500 %?), Volumen (¿dB o %?), duración de los fundidos, tamaño de fuente por defecto (¿15?) y sliders de Ajustar (¿−50…+50?). Los defaults del modelo sí están verificados [D].
- **Qué rótulo de duplicados se ve de verdad en el panel** (la traducción de CapCut tiene variantes):

  | Concepto | Variantes en el `.po` |
  |---|---|
  | Estabilizar | «Estabilización» / «Estabilizar» |
  | Feather | «Difuminar» / «Pluma» / «Borde de plumas» |
  | Pitch | «Mantener el tono» / «Cambiar tono del audio» |
  | Hero | «Héroe» / «Momento heroico» |

  **Recomendación:** priorizar las claves `pc_new_*`, las del panel rediseñado.
- **Estado Pro de cada función en 2026:** hay que verlo en la app con la insignia Pro; las fuentes web se contradicen.
- **Licencias por confirmar:** `@shiguredo/rnnoise-wasm` (¿Apache?), `realtime-bpm-analyzer` (¿MIT o Apache?), pesos de Demucs, Mixkit, e Incompetech (CC BY).

---

## 11. Para la cosecha (candidatos a `docs/hallazgos-editor-video.md`)

1. **Nombres:** los nombres oficiales de CapCut en español están en `…\CapCut\Apps\<versión>\Resources\po\es-LA.po`. **No hay que usar** `capcut.com/es-es/resource`, que es traducción automática con otros nombres.
2. **Licencias:** Pixabay no sirve para la biblioteca de un SaaS, y la API de Freesound requiere acuerdo comercial. El filtro «comercial» de OpenCut deja pasar CC BY-NC (`route.ts:111`).
3. **IA local:** CapCut hace en la PC el recorte, la interpolación, el parpadeo, el ruido, el seguimiento y RNNoise. Que sean «Pro» es una decisión comercial, no un costo de nube. MaKo puede hacerlo en el navegador.
4. **Licencias de IA en el navegador:** evitar @imgly/background-removal (AGPL), BRIA RMBG (CC BY-NC), essentia.js (AGPL / modelos NC), NLLB (NC) y MusicGen (NC). Usar MediaPipe, RNNoise, Whisper, Piper, OpenCV.js y web-audio-beat-detector.
5. **Texto a voz:** la Web Speech API no permite grabar el audio para exportarlo. Para el texto a voz exportable hace falta Piper o Kokoro en WASM.

---

## 12. Fuentes

**Locales** (solo lectura):
- `C:\Users\marti\AppData\Local\CapCut\Apps\9.3.0.3970\Resources\po\es-LA.po` y `en.po`
- `…\Resources\MixMode\MixMode.json`
- `…\Resources\DefaultAdjustBundle\*\AmazingFeature\ImageBusinessSlider.json`
- `…\Resources\models\*` · `…\Resources\rnnoise\`
- `…\Resources\icon\cc_caption_duration_info_*.json`
- `C:\Users\marti\AppData\Local\CapCut\User Data\Projects\com.lveditor.draft\{0524,0824,1021}\draft_content.json`
- `scratchpad/ext/classic/apps/web/src/app/api/sounds/search/route.ts` (OpenCut)

**Web, oficiales de CapCut:**
- https://www.capcut.com/es-es/resource/capcut-stabilizer
- https://www.capcut.com/es-es/resource/capcut-pro-pc
- https://www.capcut.com/resource/how-to-use-capcut
- https://www.capcut.com/resource/how-to-speed-up-a-video
- https://www.capcut.com/resource/how-to-add-keyframes-in-capcut
- https://www.capcut.com/resource/how-to-remove-green-screen-in-capcut
- https://www.capcut.com/help/why-do-i-have-to-pay-for-auto-reframe
- https://www.capcut.com/help/capcut-subscription-multi-platform
- https://www.capcut.com/resource/capcut-standard-vs-pro
- https://www.capcut.com/help/font-units-in-capcut
- https://www.capcut.com/es-es/resource/capcut-color-grading
- https://capcut.com/desktop/captions-for-video

**Web, terceros sobre CapCut:**
- https://vidpros.com/capcut-pro-vs-free/ (22/05/2026)
- https://bigvu.tv/blog/capcut-free-vs-pro-what-2026s-restructure-actually-gives-you/ (29/06/2026)
- https://www.change.org/p/make-capcut-free-again-307c78ee-7202-4316-a230-ed1bf02fd703 (03/09/2024)
- https://primalvideo.com/guides/capcut-for-pc-mac-tutorial/
- https://store.hollyland.com/blogs/creator-hub/increase-volume-in-capcut-pc
- https://www.tourboxtech.com/en/news/capcut-transitions.html
- https://shotkit.com/velocity-capcut/

**Formato JianYing:**
- https://github.com/GuanYixuan/pyJianYingDraft (`keyframe.py`, `video_segment.py`, `metadata/mask_meta.py`, `metadata/transition_meta.py`, `metadata/video_intro.py`)

**Licencias:**
- https://pixabay.com/service/terms/
- https://pixabay.com/service/license-summary/
- https://pixabay.com/api/docs/
- https://freesound.org/help/faq/
- https://freesound.org/help/tos_api/
- https://devportal.jamendo.com/api_terms_of_use
- https://licenseorg.com/guide/music-audio/youtube-audio-library
- https://www.artyfile.com/blog/capcut-music-commercial-use-guide
- https://autoae.online/blog/is-capcut-free-for-commercial-use
- https://opengameart.org/content/interface-sounds
- https://essentia.upf.edu/licensing_information.html

**IA en el navegador:**
- https://www.remotion.dev/docs/whisper-webgpu
- https://github.com/huggingface/transformers.js/issues/820
- https://github.com/Mintplex-Labs/piper-tts-web
- https://huggingface.co/spaces/igortamara/sample-tts-piper
- https://unpkg.com/@imgly/background-removal@1.5.8/README.md
- https://github.com/timcsy/demucs-web
- https://huggingface.co/HRSadeghi/demucs-onnx
- https://developer.chrome.com/docs/ai/built-in-apis
- https://cdn.jsdelivr.net/npm/web-audio-beat-detector@8.2.37/README.md
- https://gitlab.xiph.org/xiph/rnnoise/-/blob/main/COPYING
- https://jitsi.org/blog/enhanced-noise-suppression-in-jitsi-meet
