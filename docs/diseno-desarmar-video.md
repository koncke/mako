# Desarmar un video de la competencia — la fase 2: el worker que MIDE (ticket 97)

**Estado: escrita, no programada (14/11/2026).** La fase 1 está hecha: el Gemini del negocio mira el video entero y devuelve el
desarme (`lib/video-desarmar.ts`, lo medido en `docs/hallazgos-video-outliers.md` → «Desarmar, fase 1»). Esta fase es un
worker en Railway, SÓLO CPU, que mide lo que Gemini mide mal. El contenedor lo prende Martín con su cuenta: nadie lo
provisiona por él.

## Por qué hace falta (lo que la fase 1 midió mal)

Contra las recetas medidas a mano, Gemini (a 5 cuadros por segundo) encontró los 15 cortes del reel de los pistachos. El
diagnóstico de antes, «a 1 cuadro por segundo pierde los cortes», era el equivocado para los cortes. Lo que falla es:

| Qué | Gemini | La verdad (a mano) | Qué lo mide |
|---|---|---|---|
| Música bajo la voz | «de fondo», con whoosh | No hay: sólo golpes en los insertos y el cierre | Separar voz y música (python-audio-separator) y medir la música mientras se habla |
| Tamaño de la palabra clave | 120 % | 3 veces (300 %) | El alto de cada texto con OCR (RapidOCR) |
| Color de la palabra clave | amarillo | blanco | El color de los píxeles de la caja del OCR |
| Lo que se dice | «Que paja» por «Que paga»; sin tiempos por palabra | — | faster-whisper, palabra por palabra |
| Un corte de más | 41,0 s en un reel de 3 cortes | 3 cortes | PySceneDetect, al cuadro |

Con estas medidas, Gemini queda para lo que sí hace bien: qué se ve, la estructura, el gancho, cómo se hizo cada plano y los pasos
para replicarlo. Se le pasan los cortes y la transcripción ya medidos dentro del pedido (`instruccionDesarme`), y los números
medidos reemplazan a los suyos al leer.

## Qué corre en el worker

Un paso por herramienta, todas con licencia comercial y en CPU (Railway no tiene GPU):

1. **ffmpeg**: duración, cuadros por segundo, el audio a 16 kHz mono y un cuadro por plano.
2. **PySceneDetect 0.6.7** (BSD-3, `ContentDetector`): los cortes, al cuadro.
3. **faster-whisper 1.2.1** (MIT; ctranslate2 MIT), modelo `small` en `int8`, con `word_timestamps`. Lo que se dice, palabra por
   palabra, en español. Reemplaza a SenseVoice, que en rea-video está FIJO (`rea_video/speech.py`) y no entiende español.
4. **RapidOCR 1.4.4** (Apache-2.0; onnxruntime MIT): un cuadro por plano. Cada texto con su caja: su ALTO respecto del cuadro
   da el tamaño de la palabra clave contra los subtítulos, y sus píxeles dan el color.
5. **python-audio-separator** (MIT), SÓLO cuando se pida: voz y música por separado, para decir si hay música bajo la voz y
   a cuántos dB. ⚠️ La licencia de CADA modelo que baja (UVR MDX-Net, BandIt v2) se revisa aparte antes de usarlo, como con
   madmom y BeatNet (`docs/hallazgos-video-editor.md` → «Cortar al ritmo»).

**El código de rea-video** (Apache-2.0): se toma el corte en planos, el OCR de subtítulos, la clasificación grabado/IA/código y el
escritor de VIDEO.md. Va SIN `rea_video/speech.py` (SenseVoice). Su `NOTICE` y su licencia viajan con el código, en
`worker/desarmar/`. **Hypit no**: su licencia prohíbe operarlo multi-tenant o como SaaS.

**Cómo se conecta** (el molde del worker de montaje, `worker/montar-cola.mjs`):
- La app encola el trabajo con el video ya en el bucket privado (`archivero`, `<ws>/desarmar/<uuid>`). El worker no llama a
  Apify ni guarda claves de nadie.
- El worker pide trabajo cada 15 s, baja el video por una URL firmada y devuelve un JSON de medidas (cortes, palabras,
  textos con su alto y color, y la música si se pidió).
- La app junta las medidas con lo que dice Gemini (`leerDesarme`) y guarda.
- El worker no usa IA: Gemini sigue corriendo en la app, con la clave del negocio.

## Lo que cuesta, medido (la regla del worker: primero el reposo, después el trabajo)

Medido el 14/11/2026 en la PC de Martín (Windows, Python 3.12), con el reel de los pistachos (30,8 s, 720×1280) y el de la
palabra gigante (55 s). Los precios son los de Railway, por uso real: US$20 por vCPU-mes y US$10 por GB-mes
(`docs/hallazgos-video-pipeline.md` → «Lo que cuesta prender el worker de montaje»).

**El reposo:**

| Medición | Resultado | Costo |
|---|---|---|
| Un proceso Python que pide trabajo cada 15 s a un puerto muerto, 8 muestras cada 3 s | **22,1 MB**, planas; **0 s de CPU** en 24 s | 0,022 GB × US$10 = **US$0,22 al mes** |

⚠️ **Es así sólo si los modelos se cargan POR TRABAJO.** Con faster-whisper `small` cargado en memoria, el proceso queda en unos
585 MB todo el día: US$5,85 al mes, más de 25 veces lo anterior, y el pipeline no cambia. Cargar el modelo tardó 3,2 s: se
carga en cada trabajo y se suelta al terminar.

**El trabajo** (un reel de 30,8 s):

| Paso | Reloj | CPU | Pico de RAM |
|---|---|---|---|
| PySceneDetect (los 15 cortes, los mismos que ffmpeg) | 8,3 s | 8,9 s | — |
| faster-whisper `small` int8, 2 hilos (51 palabras con su tiempo) | 18,7 s | 20,3 s | 585 MB |
| RapidOCR, un cuadro por plano (16 cuadros) | 34,5 s | **230,7 s** | 267 MB |
| python-audio-separator | sin medir | — | — |

- **Total por reel: ~260 s de CPU, sin separar la música.** A US$20 por vCPU-mes son **~US$0,002**. La RAM es 0,6 GB por un
  minuto, ~US$0,00014. El video llega desde el bucket y vuelve sólo un JSON, así que no hay subida que pagar.
- **Mil reels por mes: ~US$2**, más los US$0,22 del reposo. El reel de 55 s: PySceneDetect 5,9 s de reloj y 13 s de CPU.
- **El OCR es el 90 % de la CPU.** RapidOCR usa todos los hilos y mira el cuadro entero. Las rebajas, sin medir todavía: pasar
  el cuadro a 540 de ancho, limitar los hilos, y mirar sólo los cuadros donde cambia el texto.
- **Sin medir:** python-audio-separator (los modelos pesan entre 50 y 200 MB y tardan minutos por minuto de audio en CPU). Es
  bajo pedido por eso. Antes de prenderlo hay que medirlo igual: reposo, trabajo y pico de RAM.
- ⚠️ **La CPU de la PC no es la de Railway.** Antes de prenderlo, hay que medir el reposo y un reel en el contenedor, con el
  mismo método.

## La imagen del contenedor

`python:3.12-slim` + `ffmpeg`, y por pip: `scenedetect[opencv-headless]==0.6.7`, `faster-whisper==1.2.1`,
`rapidocr-onnxruntime==1.4.4`, `psutil` y, aparte, `audio-separator[cpu]`.

⚠️ **faster-whisper 1.2.1 no decodifica con el PyAV que trae pip** («open() got an unexpected keyword argument
'metadata_errors'»). El audio se decodifica con ffmpeg (f32le, 16 kHz, mono) y se le pasa el arreglo.

El modelo `small` (~480 MB) se baja al construir la imagen, no en el primer trabajo.

## Lo que decide Martín

1. Prender el servicio en Railway con su cuenta. Es un servicio más en la cuenta que ya paga (US$21/mes, la de Evolution),
   no un plan nuevo.
2. Si `audio-separator` va siempre o sólo cuando se pide (es lo que más CPU y RAM promete).
