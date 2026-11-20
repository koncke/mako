# Cómo está hecho este video: el método del relevo de referentes

El 19/11/2026 se relevaron los últimos reels de Ramiro Cubría (50), Víctor Heras (36) y Alex Hormozi (48) para que Martín
eligiera los temas de su serie con avatar de IA (`docs/series/referentes/`). Este documento es el método que se usó, paso a paso,
para que MaKo lo haga solo: no sólo el guion para replicarlo, sino **cómo está hecho el video** (edición, grabación, formato), de
modo que Copywriting sepa también cómo se graba y qué instrucción darle al avatar de IA o al carrusel.

Lo que la app ya hace con UN video (ticket 97, `lib/video-desarmar.ts`, `docs/hallazgos-video-outliers.md`) está al final, con lo
que le falta.

Las herramientas, tal como se usaron, están copiadas en `docs/series/herramientas/` (corren desde `C:/dev/referentes-videos/`,
fuera del repo, donde quedaron los videos, las hojas y los `reels.json` de las tres cuentas).

## La diferencia con «desarmar el video de la competencia»

Desarmar un video dice cómo está hecho ESE video. Lo que pidió Martín con Ramiro es otra cosa además: **la receta de la cuenta**.
Ramiro repite sus 5 o 6 temas con ganchos distintos; eso no se ve en un video, se ve en 30 a 50. Por eso el método tiene dos
niveles:

1. **Por video:** qué dice (con segundos), cómo se ve (gancho, persona, plano, luz, subtítulos, cortes, sonido, b-roll), el tema y
   el llamado a la acción.
2. **Por cuenta:** la lista cerrada de sus temas de siempre con cuántos reels tiene cada uno, los moldes de gancho que más repite,
   la estructura típica por segundos y qué le funcionó mejor que a su propio promedio (el múltiplo).

## Paso a paso

Los tiempos son los medidos el 19/11/2026 en la PC de Martín (16 GB, RTX 4060), con unos 20 chats abiertos.

### 1. La lista de reels, con sus reproducciones

- Instagram sin sesión muestra **12 publicaciones** por perfil y nada más. Con sesión, la pestaña «Reels» del perfil va cargando de
  a 6 a medida que se baja, y cada tarjeta trae sus **reproducciones** (`a[href*="/reel/"]` → el texto de la tarjeta: «14.5K»).
  Se juntan bajando la página, sin llamadas a la API interna.
- Los reels FIJADOS salen primero y suelen ser viejos y con muchas más reproducciones: se cuentan aparte para el múltiplo.
- Un reel suelto **sí baja sin sesión** con `yt-dlp` (720×1280 o 1080×1920). La sesión sólo hace falta para la lista.
- Los Shorts de YouTube bajaban a ~70 s cada uno por la cantidad de `yt-dlp` de otros chats a la vez; los reels de Instagram, a
  7–15 s. Para Hormozi se usó Instagram por eso.
- En MaKo: la lista ya existe, es Competitor Spy (`spy_piezas`, con su múltiplo). Lo que falta es el video de cada pieza (hoy
  Apify, con la clave vencida desde el 13/11).

### 2. Bajar y medir cada reel (`C:/dev/referentes-videos/tools/procesar.py`)

Uno por vez, en un solo proceso (el modelo de voz se carga una vez):

| Paso | Herramienta | Qué deja | Tiempo |
|---|---|---|---|
| Bajar | `yt-dlp` (`bv*[height<=1280]+ba`) + `--write-info-json` | el mp4 y el texto de la publicación (ahí está el CTA escrito: «Comentá BALLENA») | 7–15 s |
| Transcribir | `faster-whisper` small en la GPU, con tiempo por palabra | la transcripción con el segundo de cada frase, la primera palabra, palabras por segundo, idioma | 5–37 s |
| Cortes y cuadros | UNA pasada de `ffmpeg`: `fps=2` a 180×320 y `select='gt(scene,0.30)',showinfo` | los cortes de escena (leyendo stderr) y los cuadros | 2–10 s |
| Hoja de cuadros | PIL | una imagen: arriba 13 cuadros del gancho (0, 0,5, 1, 1,5, 2,5, 3,5, 5, 7, 9, 11, 13, 15 y 18 s), abajo 11 del resto, parejos, cada uno con su segundo | <1 s |
| Fondo sonoro | `tools/audio.py`: el **piso** del audio (percentil 5 del nivel en tramos de 50 ms) | «fondo constante a -32 dB» (música o ambiente) o «silencio entre frases» | ~1 s |

En total, unos 30 s por reel; 134 reels, poco más de una hora.

**Trampas que costaron tiempo:**
- Sacar los 24 cuadros con 24 búsquedas (`-ss t`) tardó **331 s** en un reel de 32 s con la PC cargada. Con una sola pasada a 2
  cuadros por segundo, 2 a 10 s.
- `faster-whisper` 1.2.1 rompe al abrir el archivo (`open() got an unexpected keyword argument 'metadata_errors'`, la versión de
  PyAV instalada): se le pasa el audio ya leído como arreglo de numpy.
- `ctranslate2` no encuentra `cublas64_12.dll`: está dentro de `torch/lib`; se agrega al PATH con `os.add_dll_directory`.
- `pip install -U yt-dlp` sobre el Python compartido dejó `yt-dlp` **sin módulo** para todos los chats (lo desinstaló y se colgó
  al reinstalar). Se arregla instalando en una carpeta propia (`pip install --target`) y copiando `yt_dlp/` y su `dist-info` a
  site-packages. Nunca se actualiza una herramienta compartida con otros chats corriendo.
- **Los cortes se miden sobre el video sin franjas.** La primera versión achicaba a 180×320 con franjas negras ANTES de detectar
  escenas; en los reels horizontales metidos en vertical las franjas diluían el puntaje y daban 0 a 1,4 cortes por minuto donde
  había 4 a 26 (lo encontró el lector de Ramiro). Ahora el filtro de escenas va en su propia rama, sin `pad`
  (`tools/recortes.py` rehace los ya medidos).
- **Guardar el tiempo de cada palabra**, no sólo el de cada frase: con las frases de whisper, el segundo en que termina el gancho o
  empieza el CTA queda a ±3 s.
- El nivel en los «huecos» entre los segmentos de whisper no sirve para decir si hay música: los segmentos incluyen las colas de
  las palabras. El piso del clip entero sí: sin música baja a -50 dB o menos entre frases; con música queda arriba de -40.

### 2b. Carruseles y posts de imagen (`tools/publicaciones.py`)

Martín pidió sumar «todas las publicaciones, sus carruseles, todo». Lo que no es reel se lista desde la grilla principal del
perfil (las tarjetas de carrusel traen el ícono «Carousel»), en el mismo período que los reels.

- `yt-dlp --dump-single-json --ignore-no-formats-error` sobre `/p/<código>/` devuelve una entrada por lámina: las de imagen sólo
  traen la URL de la imagen (`thumbnails`), las de video traen formatos. Se baja la imagen de cada una.
- El texto de cada lámina se lee con **RapidOCR** (`rapidocr-onnxruntime`, ya instalado), de arriba abajo.
- Una hoja por carrusel con todas las láminas numeradas, para mirarlo de una vez.
- Pausa de 4 a 7 s entre publicaciones: ritmo de persona, sin ráfagas, con la sesión de Martín y sin tocar su cuenta.

### 3. Leer cada reel: transcripción + hoja de cuadros

Con la transcripción con segundos y la hoja a la vista se llena una fila por reel (`reels.json`):

- **Qué dice:** la cita del gancho (15 palabras como máximo) y su **molde** en abstracto («metáfora de animales para tipos de
  cliente», «número + promesa»…).
- **Cómo está hecho:** tipo de gancho (IA exagerada, animado, persona a cámara, situación actuada, b-roll, texto), qué se ve,
  **cuándo termina el gancho y cuándo aparece la persona hablando en serio**, si la IA vuelve en el cuerpo, plano, lugar, luz,
  subtítulos (palabra por palabra, color, posición), cortes por minuto (medidos), fondo sonoro (medido), b-roll, formato.
- **El tema**, de una lista cerrada de la cuenta (ver el paso 4).
- **El llamado a la acción:** tipo (comentar una palabra, link, DM, seguir), la palabra, y en qué segundo empieza.
- **La estructura** en tramos con segundos: gancho → planteo → ejemplo → giro → CTA.

Lo que la hoja no deja ver se dice: «no se ve en los cuadros». La música no se escucha: se toma del piso medido.

### 4. La receta de la cuenta

- La **lista cerrada de temas**: 5 o 6 con una definición de una línea cada uno, de modo que otra persona clasifique un reel nuevo
  igual. Un tema es de qué habla (el dolor o la promesa), no el formato.
- Los conteos salen de un script sobre `reels.json`, nunca a ojo: reels y % por tema, reproducciones medianas por tema, moldes de
  gancho, medianas de cuándo termina el gancho, cuándo aparece la persona y cuándo empieza el CTA.
- **El múltiplo** de cada reel: sus reproducciones ÷ la mediana de la cuenta. Los 5 de mayor múltiplo, y qué tienen en común.

### 5. Verificar los conteos

Un segundo lector reclasifica **a ciegas** una muestra (uno de cada tres, más todos los de los dos temas más chicos) con las
definiciones, y compara. Si dos lectores no coinciden, la definición del tema está mal escrita, no el reel. Después recuenta y
compara cada número del documento. Lo que cambió queda en la sección «Verificación» de cada documento.

Medido el 19/11: los críticos coincidieron a ciegas con los lectores en 47 de 48 (Ramiro), 32 de 33 (Víctor) y 45 de 47
(Hormozi); corrigieron 1, 3 y 3 filas. Lo que más cambió la lectura no fue el tema sino **la edad**: una forma que gana ×5 en
crudo puede ganar ×1,2 contra los reels vecinos en fecha. Toda comparación de formas o temas se hace a igual edad (contra la
mediana de los maduros de ±3 días, sin el propio reel), y los reels de menos de 48 h quedan afuera.

Los roles corrieron como agentes de a uno (lector → crítico por cuenta, y uno que junta), no como Workflow: la guardia de RAM lo
negó dos veces (1,7 y 2,5 GB libres de 3).

### 6. De la receta a la serie (lo que va a Copywriting)

Para cada tema elegido, lo que necesita Copywriting para escribir Y para producir:

- **El guion** en el terreno del negocio, con el molde de gancho del referente y la estructura por segundos.
- **La duración se cuenta por palabras** (memoria «Duración = palabras»): el gancho de 10 a 15 s son ~25 a 40 palabras al ritmo
  medido del referente (Ramiro, ~3 a 4 palabras por segundo).
- **Cómo se graba la parte de la persona:** plano, lugar, luz, quién filma, subtítulos, b-roll, con lo medido del referente.
- **La instrucción al avatar de IA** para el gancho, con el método de siempre (imagen → video → voz; sólo Omni): la imagen del
  cuadro exagerado, un clip por frase con su duración por palabras, y la voz clonada al final.
- **Cuánto cuesta ANTES de generar:** segundos de IA × US$0,024 (Omni 1.2 Flash por ApiMart; 24 MT por segundo). Un gancho de
  15 s son US$0,36 por toma; con un reintento, US$0,72.
- **El carrusel** del mismo tema: el gancho como portada y los tramos de la estructura como láminas.

## Lo que la app ya hace con un video (ticket 97) y lo que le falta para esto

`lib/video-desarmar.ts` ya devuelve, por video y con Gemini mirando a 5 cuadros por segundo: el gancho (texto, hasta qué segundo,
tipo, por qué funciona), la estructura en bloques, cada plano con su **origen** (grabado, IA o código), encuadre y cámara, los
textos en pantalla exactos, las frases con tiempos, el estilo de subtítulos, la música, el CTA, los pasos de edición en el editor
de MaKo y cómo grabarlo con el avatar o con una persona. «Hacer uno así» de Spy le pasa la edición a Copywriting
(`textoDeEdicionParaCopiar`).

Lo que este relevo usó y la app no tiene (para que el chat del video lo compare y decida):

1. **El nivel cuenta**: la lista cerrada de temas de la cuenta, en qué tema cae cada video, los moldes de gancho que repite y el
   múltiplo contra su propia mediana. Un desarme suelto no dice «Ramiro habla siempre de estos 6 temas».
2. **El fondo sonoro medido por código** (el piso del audio), que es justo lo que Gemini mide peor según el ticket 97. Se puede
   medir en el navegador con Web Audio, sin servidor.
3. **«Cuándo aparece la persona»** como dato: hoy se deduce del primer plano «grabado» después de los «ia».
4. **La ficha de grabación junta** (lugar, luz, quién filma, vestuario, plano), para la persona y para el avatar.
5. **El costo antes de generar** el gancho con IA, en MT y en dólares.
6. **La instrucción para el guion NUEVO**: hoy el desarme dice cómo grabar el video original; lo que Copywriting necesita es la
   instrucción para SU guion (duración por palabras, un clip por frase).
7. **La salida a carrusel** desde el mismo desarme.

### Lo que respondió el chat del video (19/11/2026)

Comparó este método con el código y lo dejó en `docs/diseno-desarmar-video.md` → «Contra el método de Referentes (19/11/2026)»
(rama `punta/video-desarmar`, commit `dd21e8c5b`). No programó nada. En resumen:

1. **Nivel cuenta, a medias:** el múltiplo a igual edad YA existe (`lib/multiplo-rendimiento.ts`: 20 vecinas en el tiempo,
   mínimo 7, sin las de menos de una semana). Faltan los temas propios de cada cuenta y las medianas de gancho, persona y CTA.
   La traba es la clave de Apify, vencida desde el 13/11.
2. **Fondo sonoro:** sí, pero no en el navegador: los bytes de un reel los baja el servidor y los de YouTube no pasan por MaKo.
   El piso va al worker de la fase 2, como una pasada más de ffmpeg.
3. **Cuándo aparece la persona — corregido:** hoy no se deduce en ningún lado, y «grabado» no quiere decir persona (el b-roll
   también es grabado). Hace falta un tiempo más en el esquema de Gemini.
4. **Ficha de grabación:** confirmada, con un hueco más: «Hacer uno así» no pone la grabación en el texto de Copywriting; sólo
   sale en la caja de al lado, que no se ve en el celular.
5. **Costo:** confirmado; los números ya están (`USD_POR_SEGUNDO` y los segundos de IA del desarme), falta juntarlos.
6. **Instrucción para el guion nuevo:** confirmada; las palabras por segundo no se calculan en ningún lado.
7. **Carrusel:** confirmado; se arma por código con lo que ya se guarda, sin otra llamada a Gemini.
8. **Nuevo:** el CTA escrito en el texto de la publicación («Comentá BALLENA») no le llega a Gemini; sólo sale en el VIDEO.md.

Las trampas de ffmpeg de este relevo (franjas negras, cuadros en una pasada, piso del clip entero) pasaron al plan del worker.
