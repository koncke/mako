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
- **El desarme automático (ticket 97)**: fase 1 sin servidor (Gemini del negocio sobre el video entero → la receta como
  `EdicionDeReceta` de `lib/video-recetas.ts`, abierta en el editor como plantilla «toca para reemplazar»); fase 2 en el worker
  (cortes, voz en español, OCR, y el código de rea-video sin SenseVoice), que espera que Martín prenda el contenedor.
