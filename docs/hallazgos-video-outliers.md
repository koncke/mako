# Hallazgos — la portada de outliers del Video («Encuentra tu siguiente OUTLIER»)

El código: `lib/video-outliers.ts` (puro: fuentes, criterio, vidriera, reproductor), `lib/video-outliers-servidor.ts` (las
fuentes), `lib/video-outliers-criterio.ts` + `.json` (la clasificación por edición), `lib/video-recetas.ts` (las recetas),
`app/video-editor/OutliersVideo.tsx` y `VerReel.tsx`. Test: `tests/video-outliers-criterio.test.ts`.

## Martín, 11/11/2026: «reels random», «no se reproducen ahí mismo», «medimos sólo 159»

**El síntoma:** la tarjeta de la plantilla «Mensaje para…» era una lista gris de bloques sin miniatura; tocar un reel sacaba de
MaKo; la portada decía «159 reels» y mezclaba cualquier cosa (podcasts, gente hablando a cámara).

- **«159» no era lo medido: era lo que dejaba ver la ventana de 90 días** (`vidriera`, `DIAS_VIDRIERA`). Spy tenía 561 reels del
  negocio de Martín (ws 9), 603 del ws 11 y 175 del ws 3: **854 reels distintos de 7 cuentas** (1.341 filas). El diagnóstico
  obvio («hay que traer más con Apify») era el equivocado para esa parte: estaban en la base.
- **Las cuentas de la biblioteca de carruseles (456) no tienen NI UN reel guardado**: `carruseles_biblioteca_piezas` sólo trae
  carruseles e imágenes. Traer sus reels, y bajar los videos para clasificarlos por movimiento, cuesta Apify: a la clave de Spy le
  quedaban US$1,44 (debajo de la reserva de US$2 para Spy). Se le preguntó a Martín, por el Cerebro, con el número.
- **La miniatura de la plantilla:** la portada de Instagram de un reel (la del CDN) vence a las horas. Se sirve la nuestra:
  `public/ve/plantillas/mensaje-para.jpg` (la portada real del reel de los pistachos; en `ve/`, que el proxy deja pasar sin sesión: en `public/video/` caía en el login, `tests/proxy-matcher-completo.test.ts`).
- **Reproducir adentro:** el embed OFICIAL de Instagram (`https://www.instagram.com/reel/<código>/embed/`) reproduce dentro de
  un `<iframe>` sin abrir otra pestaña (probado el 11/11/2026 en el navegador de la app). La CSP de MaKo no tiene `frame-src`
  (sólo `frame-ancestors`), así que no hay que tocar nada. Nunca una copia nuestra del video: el reproductor es el de la red.

## El criterio: cómo se clasificaron los 854, y la regla que queda

1. Se bajaron las 851 portadas que Spy guardó en NUESTRO bucket (3 apuntaban al CDN de Instagram y daban 403) y se armaron 36
   hojas de 24, numeradas, con su texto al lado.
2. **Seis clasificadores** (uno por cada 6 hojas) con `CRITERIO.md`: formato, texto, señales y veredicto `patron` / `descartar`
   / `dudoso`. **Fueron muy dispares**: de 62 a 120 «patron» por tanda de ~140. Y generosos: 234 eran «persona a cámara con un
   título en la portada». Un mismo estilo de una cuenta, repetido decenas de veces, no es decenas de patrones.
3. **Cuatro jueces** independientes, con reglas más estrictas (`JUEZ.md`: un título común sobre alguien hablando no es patrón;
   un podcast sólo con un texto con estilo) y una **lista cerrada de 16 familias** (`FAMILIAS_EDICION`), revisaron los 854 uno
   por uno: corrigieron 76. Final: 545 con patrón, 234 dudosos, 75 descartados.
4. **La regla de la portada** (`conCriterio`): llega un reel sólo si tiene un patrón de una familia de la lista **y superó a su
   cuenta** (múltiplo ≥ 1). Un patrón que le fue peor que a su cuenta no prueba que funcione. Los demás se CUENTAN y la portada
   lo dice. Ordenados por múltiplo, sin ventana de 90 días ni variedad: un patrón de edición no vence como un audio de moda.
   Resultado: ws 9 → 149 de 561; ws 11 → 194 de 603; ws 3 → 36 de 175.

⚠️ **Es por la PORTADA.** Cortes, zooms, B-roll y ritmo no se ven en un cuadro: los «dudosos» (casi todos «persona a cámara con
subtítulos simples») se deciden con el video, y la tarjeta lo dice («Lo vi en su portada y su texto…»). Las 3 referencias de las
recetas sí se miraron en video (`b: "video"` en el JSON).

⚠️ **Un reel que Spy lea DESPUÉS del 11/11/2026 no está clasificado y no se muestra** (cuenta como «falta mirar»). Para cuentas
nuevas hace falta clasificar de nuevo (el mismo método: hojas → clasificadores → jueces → JSON).

## Las recetas (como la de los pistachos)

Se eligió una familia de cada tipo de grabación entre las que más superaron a su cuenta, se bajó la referencia con `yt-dlp` (tres
reels, como el de Josep: no es bajar en masa) y se midió: duración, tomas con `ffmpeg select='gt(scene,0.28)'` (leyendo
**stderr** con `spawnSync`: `execFileSync` devuelve stdout y daba 0 cortes) y un cuadro por segundo con su número.

- `novato-experto` (julioiero, 39,5× su cuenta): 100 s en UNA toma; la misma persona dos veces (máscara al medio), rótulos amarillos.
- `palabra-gigante` (den.borgg, 70,9×): charla de 55 s en 4 planos; subtítulos serif chicos y la palabra clave gigante.
- `pregunta-sobre-podcast` (julioiero, 8,8×): 148 s, 17 tomas (~9 s); pregunta fija arriba, podcast horizontal al medio, el mismo
  clip desenfocado de fondo, una palabra por vez abajo.

Cada receta se ve en la caja del reel («Cómo se hace»): estructura, edición en el editor de MaKo (máscara, efecto Desenfoque,
plantillas de subtítulos y palabras clave, que existen), y la grabación con el avatar o con otra persona.

## El editor primero; los outliers adentro (11/11/2026, misma noche)

Martín, mirando la portada nueva: «ya no depender de "Encuentra tu siguiente outlier", sino que sea directamente todo el sistema
de edición primero, y que en alguna parte, por ejemplo del lado de Importar, estén estos outliers». `/video-editor` abre en crear
(`vistaDeVideo`); la portada queda en `?ver=outliers`. Adentro del editor: Multimedia › «Outliers» (orden 12, después de
«Importar»), con las MISMAS tarjetas (`TarjetaReel`, `TarjetaPlantilla`) y los datos de `GET /api/video-editor/outliers`.
También dijo que la selección «es sobre todo animaciones de texto» y que faltan los más complejos, como el de los pistachos: es el
límite de mirar la PORTADA (ver arriba). Lo arregla la pasada con el video.

## Desarmar el video de la competencia: lo averiguado antes de programar (ticket 97, 13/11/2026)

Martín mandó https://github.com/JuneYaooo/rea-video: «extraer al 100 % con ingeniería inversa cómo está construido ese video,
cómo está la edición, para replicarlo; investiga si hay algo mejor». Es lo que hoy hacen a mano las recetas (arriba), para
cualquier outlier. Se leyó el repo y se relevaron 12 herramientas abiertas y 12 comerciales (13/11/2026):

- **rea-video sirve, pero no tal cual.** Apache-2.0 (conservar su NOTICE), CLI en Python ≥ 3.10 con ffmpeg y onnxruntime. Baja
  ~216 MB de modelos para separar voz, música y efectos (UVR MDX-Net + BandIt v2) y ~160 MB para la voz. Corta en planos (95 %
  recall, 94 % precisión en 9 clips anotados, `eval/RESULTS.md` del repo), hace OCR de subtítulos (RapidOCR), dice si cada plano
  es grabado, IA o código, y escribe un paquete **VIDEO.md** (ficha, resumen, línea de tiempo por plano, un archivo por plano;
  formato abierto, https://videomd.github.io/videomd). La visión es opcional, por un endpoint compatible con OpenAI
  (`REA_VLM_*`). **No corre en Vercel**: necesita un contenedor.
- **No entiende español, y no es una opción.** El reconocimiento de voz es SenseVoice con el modelo FIJO en `rea_video/speech.py`
  (zh, en, ja, ko, yue; bengalí aparte). Un reel en español sale sin lo que se dice, o con basura. Se reemplaza por
  **faster-whisper** (MIT, CPU int8, tiempo por palabra) o **WhisperX** (BSD-2, trae alineación para `es`).
- **Hypit (https://github.com/hypit-ai/hypit) NO se puede usar en MaKo**, aunque se presente como Apache-2.0: su LICENSE prohíbe
  operarlo multi-tenant o como SaaS, cobre o no, y define un tenant como un workspace. Sólo se toma la idea: anclar los cortes y
  los subtítulos a PALABRAS, no a segundos.
- **Railway no tiene GPU**: todo en CPU (PySceneDetect BSD-3 para los cortes, faster-whisper int8, RapidOCR). Qwen3-VL y
  Qwen-Image-Layered piden GPU: fuera.
- **Gemini mira 1 cuadro por segundo por defecto** y pierde los cortes de menos de 1 s de un reel. Se le pasa la lista de cortes y
  la transcripción medidas antes, o se sube el `fps`. Con la clave del negocio, nunca la de la plataforma.
- **No hay dónde correr Python hoy**: el worker de montaje (`worker/`) nunca se prendió («Lo que cuesta prender el worker»,
  `hallazgos-video-pipeline.md`). Prenderlo en Railway es con la cuenta de Martín.
- **Mantenimiento**: TransNetV2 no cambia desde 12/2023 y Demucs de Meta está archivado → python-audio-separator (MIT). La
  licencia de CADA modelo que baja se revisa aparte, como con madmom/BeatNet (arriba, en «Cortar al ritmo», del editor).
- **Choque con reglas ya decididas**: lo que parte una imagen en capas (Canva Magic Layers, Qwen-Image-Layered) sólo sirve para
  sacar el texto editable y el fondo limpio. La imagen se regenera; nunca se entrega por partes ni recortada.
- **La competencia**: Foreplay, Atria y Minea transcriben y etiquetan (Atria clona sólo imágenes); CapCut Remake sólo rehace
  plantillas armadas en CapCut; ChatCut (patrocina a rea-video), invideo, Pippit y Topview rehacen generando con IA por créditos.
  Ninguno cruza el rendimiento real (el múltiplo de Spy) + español + plantilla editable en el propio editor + IA del negocio.

## Desarmar, fase 1: lo que salió y lo que midió contra las recetas a mano (ticket 97, 14/11/2026)

**Dónde vive:**
- `lib/video-desarmar.ts`: el contrato, el pedido y el esquema para Gemini, la lectura, la receta y la plantilla. Es puro.
- `lib/video-desarmar-videomd.ts`: el paquete VIDEO.md.
- `lib/video-desarmar-gemini.ts`: YouTube por enlace o el mp4 por la File API, con los cuadros por segundo.
- `lib/video-desarmar-servidor.ts`: lo guardado, el reclamo y de dónde sale el video.
- `/api/video-editor/desarmar` y la caja `app/video-editor/Desarmar.tsx`.
- La plantilla: `?desarme=` en `[proyecto]/page.tsx` → `ArmarPlantilla`.
- Carruseles: `lib/imagen-desarmar*.ts` y `app/competitor-spy/DesarmarImagen.tsx`.
- Para probar sin la pantalla: `scripts/desarmar-probar.mts` y `scripts/desarmar-imagen-probar.mts`. No escriben en la base.

**Lo medido.** Con el Gemini del negocio de MaKo (ws 9), contra los cortes de `ffmpeg select='gt(scene,0.28)'`:

| Video | Cortes reales | Gemini | Lo que erró |
|---|---|---|---|
| Pistachos (DdTdIIPDzHU, 30,8 s; el archivo, a 5 cuadros/s) | 15 | **15 de 15**, 16 planos | Un corte 0,6 s antes (8,0 por 8,6); los demás a ~0,1 s. Dice música «de fondo» con whoosh. A mano se midió que NO hay música bajo la voz, sólo golpes en los insertos y el cierre. |
| Palabra gigante (DPUxQ8_DiVY, 55 s; el archivo, a 5 cuadros/s) | 3 | 3 de 3 exactos **y uno de más** (41,0) | El estilo, bien: «Palabra gigante», serif, palabra clave. Pero la clave al 120 % y amarilla; a mano: 3 veces y blanca. Oyó «Que paja» por «Que paga». |
| Mindvalley, Black Friday (YouTube por enlace, 2:18, a 2 cuadros/s) | — | 24 planos: 14 grabados, 9 de código, 1 de IA | Sin medir a mano. Los tres textos de la oferta, exactos. |

Los 5 textos rojos del reel de los pistachos salieron exactos: «FLOJOS», «JOSEP», «PISTACHOS», «tachocream.com» y
«DISPONIBLE EN AMAZON».

- ⚠️ **El diagnóstico obvio era el equivocado.** Se esperaba que Gemini perdiera los insertos de medio segundo, porque «mira 1
  cuadro por segundo», y que hiciera falta medir los cortes con ffmpeg ANTES, en la fase 2. Con `videoMetadata.fps` a 5 encontró
  los 15 cortes del reel de los pistachos, también los de 0,4 y 0,6 s. Lo que falla es el AUDIO (si hay música bajo la voz) y las
  MEDIDAS (cuánto más grande es la palabra clave). Eso es lo que justifica el worker: separar las pistas y un OCR con tamaños.
- **Regla: los números del ritmo los mide el código** (`ritmoDe`: planos, un corte cada cuánto, el más corto). La IA no los da:
  «cortes dinámicos y rápidos» no es un dato. La respuesta se lee como dato de un tercero (`leerDesarme`). Los planos quedan
  pegados de 0 al final, que es lo que pide la pista principal de la plantilla. Un tiempo corregido en más de 1 s se dice en
  `dudas`.
- **La plantilla «toca para reemplazar» ya existía**: la de «Utilizar plantilla» (`lib/editor-video/plantillas.ts` +
  `_opencut/plantillas/instanciar.ts`). El desarme se vuelve una `Plantilla`: un hueco por plano y los textos del original
  editables. El estilo de subtítulos es el más parecido de la galería (`estiloMasParecido`). No hizo falta tocar el motor.
- **«Hacer uno así» de Spy copiaba sólo el guion.** En la llamada con Julio (13/11), Martín dijo que, sobre un reel, «la edición
  también la copia, saca fotograma por fotograma». No lo hacía: `textoParaCopiar` escribía el gancho, el ángulo y el texto.
  - Ahora, sobre un video, la caja lo DESARMA antes de copiar (`desarmarAntes` en DetallePieza; si ya está guardado, no se
    paga).
  - La ruta de copiar escribe la edición, armada por código desde lo guardado y sin IA (`textoDeEdicionParaCopiar`), antes de
    «Tu versión».
  - La página guarda la clave en `props.desarme` y muestra al lado la caja del desarme con «Abrir en el editor».
  - Regla: lo que va a otra herramienta se escribe desde lo GUARDADO, no se vuelve a pedir a la IA. Los textos del competidor
    van entre «», dentro de un renglón de lista: una línea suya en MAYÚSCULA no puede abrir una sección del guion.
  - Si no se pudo desarmar (sin Gemini, sin el video), se copia como antes.
- **La receta vuelve del chat.** La de un video desarmado no está en `RECETAS`. `recetaDelHilo` la reconoce por la línea «En el
  editor de MaKo, todo en un pedido: …», que escribe `textoDeEdicionEnEditor` (`edicionDelTexto` es su inversa). Así la Edición
  automática la sigue sin tocar `enjambre/correr.ts`.
- **Una carga entera vacía el chat en memoria.** `ArmarPlantilla` abre el proyecto con `abrirProyectoCreado`, que recarga la
  página. La receta que MaKo dejaba en el chat se perdía, porque el hilo no se guarda hasta que el chat se carga.
  `guardarHiloAhora` lo guarda antes de recargar.

### Trampas del entorno al desarmar

- **La cuota gratis de Gemini es POR MODELO.** El 429 decía «limit: 20, model: gemini-3.8-flash» por día. La primera versión
  saltaba de cuenta ante un 429 y nunca probaba `gemini-flash-lite-latest`, que tiene su propia cuota. Ahora un 429 prueba el
  otro modelo en la misma cuenta. El guion de YouTube de Spy (`guionDeYoutubeConGemini`) sigue saltando de cuenta: ver
  `hallazgos-ia.md`.
- **De las 4 claves de Gemini del negocio de MaKo, la 1 y la 4 dan 401** («API key not valid», 14/11/2026). La 3 agotó sus 20
  del día de flash y la 2 estaba saturada (503). Las tres pruebas las contestó `gemini-flash-lite-latest`.
- La File API da la duración del video (`videoMetadata.videoDuration`, «30.784s») recién cuando el archivo queda ACTIVE. Por eso
  los cuadros por segundo se deciden DESPUÉS de subirlo (`mirar(duracionS)`), no antes.
- **Spy guarda sólo la PORTADA de un carrusel.** `laminas_imagenes` existe en la biblioteca de ejemplos (mig 0404), no en
  `spy_piezas`. El desarme de un carrusel de 6 láminas mira una y lo dice («Sólo vi la portada de 6»). La réplica de Image tiene
  el mismo límite.
- El banco de capturas (Chrome sin ventana, por CDP) se cortaba a mitad de la lista con ~1,8 GB libres. Por tandas de dos anduvo.
- El chequeo de tipos acotado no corrió: la guardia de RAM lo frenó con 1,6 GB libres. Los tipos los chequea GitHub.

## Trampas del entorno

- **Un `<Modal>` adentro de una tarjeta con animación de entrada queda ENCERRADO en la tarjeta.** `.tarjeta` tiene `animation:
  entra … both` con `transform`, y eso la vuelve el bloque contenedor de todo `position: fixed` de adentro: la caja del reel salía
  de 200 px sobre su columna. `Modal` (app/_ui/Modal.tsx) NO va por portal: desde una tarjeta, `createPortal(…, document.body)`.

- **`postgres` (el driver) devuelve los `bigint` como TEXTO**: con `vistas: "3406"`, `multiplosDe` no calcula y TODOS los reels
  salían «debajo de su cuenta». En la app no pasa (PostgREST los da como número); en un script contra la base, `Number(...)`.
- `tsc-acotado` sobre estos archivos dio «no se pudo chequear» (código 134, memoria): los tipos los chequea GitHub.

## Sin hacer

- **La segunda pasada con el VIDEO** (los 234 dudosos y confirmar los 545): pide bajar los videos con Apify (~US$2,30 los 854)
  y la decisión de Martín sobre el crédito.
- **Los reels de las 456 cuentas de carruseles**: ~US$15 de Apify (12 por cuenta). Misma decisión.
- **«Replicar» desde una receta** con su guía paso a paso en el chat, como «Mensaje para…»: la guía de esa plantilla tiene su
  propio editor de guion (`app/video-editor/guia/EditorGuion.tsx`, tipos de `mensaje-para.ts`); cada receta necesita la suya o
  una guía genérica. Hoy la receta se lee en la caja del reel.
- La clasificación automática de lo que Spy lea de ahora en más.
- **El desarme, fase 1 (ticket 97, 14/11/2026)**: hecho, y probado con Gemini real y en el banco (arriba). Falta:
  - **Verlo en producción.** El banco dibuja la caja, pero nadie vio en pantalla la plantilla armada en el editor: necesita el
    motor y WebGPU.
  - Los reels de Instagram necesitan la clave de Apify de Spy, que da 401. Hasta que Martín pegue otra, se SUBE el mp4.
  - TikTok sólo se puede subir; no se trae solo.
  - Lo que Gemini mide peor: la música bajo la voz y el tamaño de la palabra clave (arriba).
- **El desarme, fase 2**: el worker en Railway, sólo CPU, que mide lo que Gemini mide mal. Está escrita, no programada:
  `docs/diseno-desarmar-video.md`. Espera que Martín prenda el contenedor con su cuenta.
