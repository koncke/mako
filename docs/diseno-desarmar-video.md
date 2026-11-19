# Desarmar un video de la competencia — la fase 2: el worker que MIDE (ticket 97)

**Estado: escrita, no programada (14/11/2026).** La fase 1 está hecha: el Gemini del negocio mira el video entero y devuelve el
desarme (`lib/video-desarmar.ts`, lo medido en `docs/hallazgos-video-outliers.md` → «Desarmar, fase 1»). Esta fase es un
worker en Railway, SÓLO CPU, que mide lo que Gemini mide mal. El contenedor lo prende Martín con su cuenta: nadie lo
provisiona por él.

Al final, **«Contra el método de Referentes (19/11/2026)»**: lo que le falta a la app para que Copywriting sepa también cómo
grabarlo, contrastado con el código. Tampoco está programado.

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

1. **ffmpeg**: duración, cuadros por segundo, el audio a 16 kHz mono y un cuadro por plano. Los cuadros, en UNA pasada
   (`fps=2`): con una búsqueda `-ss` por cuadro, un reel de 32 s tardó 331 s contra 2 a 10 s (relevo de referentes, 19/11).
   Y **el piso del audio**: el percentil 5 del nivel en tramos de 50 ms, del clip entero. Sin nada debajo de la voz baja a
   -50 dB o menos; con música o ambiente queda arriba de -40. Es lo que Gemini mide peor (la tabla de arriba), y cuesta un
   segundo de CPU. El nivel en los huecos entre frases de whisper NO sirve: los segmentos traen la cola de las palabras.
2. **PySceneDetect 0.6.7** (BSD-3, `ContentDetector`): los cortes, al cuadro. ⚠️ **Sobre el video sin franjas negras**: un
   reel horizontal metido en vertical con franjas diluye el puntaje de escena, y dio 0 a 1,4 cortes por minuto donde había 4 a
   26 (relevo de referentes). Se detecta antes de cualquier `pad`, o se recortan las franjas (`cropdetect`).
3. **faster-whisper 1.2.1** (MIT; ctranslate2 MIT), modelo `small` en `int8`, con `word_timestamps`. Lo que se dice, palabra por
   palabra, en español. Reemplaza a SenseVoice, que en rea-video está FIJO (`rea_video/speech.py`) y no entiende español.
4. **RapidOCR 1.4.4** (Apache-2.0; onnxruntime MIT): un cuadro por plano. Cada texto con su caja: su ALTO respecto del cuadro
   da el tamaño de la palabra clave contra los subtítulos, y sus píxeles dan el color.
5. **python-audio-separator** (MIT), SÓLO cuando se pida: voz y música por separado, para decir si hay música bajo la voz y
   a cuántos dB. Con el piso del paso 1, «¿hay algo debajo de la voz?» ya está contestado casi gratis: el separador queda
   para «¿es música o ambiente?», si alguna vez hace falta. ⚠️ La licencia de CADA modelo que baja (UVR MDX-Net, BandIt v2) se revisa aparte antes de usarlo, como con
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

## Contra el método de Referentes (19/11/2026): qué le falta a la app

El chat de Referentes desarmó a mano 134 reels de Ramiro Cubría, Víctor Heras y Hormozi, y escribió su método en
`docs/series/desarmar-video-referente.md` (rama `punta/referentes-videos`, `402ecc4a0`). Martín pidió (19/11) que desarmar
no sea sólo copiar el guion: que diga cómo está editado, cómo se grabó y qué formato es, para que Copywriting sepa también
cómo grabarlo o qué instrucción darle al avatar o al carrusel. Sus 7 puntos, contrastados con el código el 19/11.

**Lo que la app ya tiene y el método no sabía:**
- **El múltiplo a igual edad ya es la regla.** `lib/multiplo-rendimiento.ts` compara cada pieza con la mediana de hasta 20
  vecinas en el tiempo (mínimo 7) y saca lo de menos de una semana. Es la lección del paso 5 del método («la edad»), que llegó a
  ±3 días y 48 h.
- **Spy ya clasifica cada pieza** (`spy_piezas.analisis`: gancho, ángulo y formato, con un catálogo de toda la app) y ordena
  «lo que mejor le fue» por formato (`lib/spy-detalle.ts`).

**Los 7 puntos:**

1. **El nivel cuenta. Confirmado, a medias.** El múltiplo está. Falta:
   - la lista CERRADA de temas propia de cada cuenta (el catálogo de Spy es de toda la app y dice el ángulo y el formato, no
     «de qué habla Ramiro»);
   - en qué tema cae cada pieza y los moldes de gancho que repite;
   - las medianas, sobre muchos desarmes, de cuándo termina el gancho, cuándo aparece la persona y cuándo empieza el CTA.

   ⚠️ La traba no es el código: un reel de otro se trae por Apify, con la clave de Spy vencida desde el 13/11. Hoy sólo se
   desarma YouTube o lo que se sube a mano.
2. **El fondo sonoro medido. Confirmado; corrijo dónde.** No se puede medir «en el navegador con Web Audio» para casi
   nada. Los bytes de un reel o de un anuncio los baja el SERVIDOR (`lib/video-desarmar-servidor.ts`), y los de YouTube no
   pasan por MaKo: Gemini los lee por la URL. En el navegador sólo está el archivo subido. Va en el worker de esta fase, como
   una pasada más de ffmpeg (el paso 1 de arriba).
3. **Cuándo aparece la persona. Corrijo: hoy no se deduce en ningún lado.** Los datos para deducirlo están (`origen`, `broll`
   y `seVe` de cada plano, y las frases), pero «grabado» no es «persona a cámara»: un B-roll también es grabado. Lo seguro es
   un tiempo más en el esquema de Gemini (`personaDesdeS`, null si no aparece), leído como los demás en `leerDesarme`. De ahí
   sale la mediana por cuenta del punto 1.
4. **La ficha de grabación junta. Confirmado, y con un hueco que el método no vio.**
   - `grabarConAvatar` y `grabarConPersona` son listas de texto libre. Lugar, luz, quién filma, vestuario y plano no son
     campos; sólo el encuadre y la cámara están por plano.
   - **Copywriting casi no la ve.** «Hacer uno así» escribe en la página `textoDeEdicionParaCopiar`, que lleva la edición plano
     a plano y NO la grabación. La grabación está sólo en la caja Desarmar de al lado (`app/copywriter/editor/EditorGuion.tsx`),
     que no se muestra en el celular ni en una página compartida, y no está en el texto de la página.
   - Agregarla al texto es código, sin IA. Es lo primero que pidió Martín.
5. **El costo antes de generar. Confirmado; los números ya existen, falta juntarlos.**
   - El precio: `USD_POR_SEGUNDO` en `lib/mako-tokens-reglas.ts` (US$0,024 por segundo = 24 MT).
   - Los segundos hechos con IA del original: `mezclaDeOrigen(d).ia.segundos`.
   - Para el guion NUEVO, los segundos salen de sus palabras (punto 6), no del original.
   - El desarme mismo ya reserva y liquida sus MT (`video-desarmar`, con el medidor).
6. **La instrucción para el guion NUEVO. Confirmado.**
   - `grabarConAvatar` describe el ORIGINAL. El pedido le dice a Gemini «un video por frase, con la duración por la cantidad de
     palabras», pero con las frases del original.
   - Falta una función de código: con el guion nuevo y el desarme, da un clip por frase, sus segundos por palabras al ritmo del
     referente y su costo (punto 5).
   - El ritmo (palabras por segundo) no se calcula en ningún lado. Sale de `frases`: las palabras ÷ los segundos hablados.
     Con los tiempos de Gemini es aproximado; con faster-whisper de esta fase, exacto.
7. **La salida a carrusel. Confirmado.**
   - El desarme de carruseles existe (`lib/imagen-desarmar.ts`, «Replicar en Image»), pero un VIDEO desarmado no sale a
     carrusel.
   - El pedido se arma por código con lo guardado, sin otra llamada a Gemini: el gancho es la portada y cada bloque de
     `estructura`, con sus frases, una lámina.

**Lo que el método no listó y también falta:**
- **El CTA se mide y no se ve.** `llamadaALaAccion` sólo sale en el VIDEO.md. No lo muestran la caja Desarmar, el chat del
  proyecto ni «Hacer uno así».
- **El CTA escrito suele estar en el texto de la publicación** («Comentá BALLENA»), no en el video. El pedido a Gemini lleva
  sólo 160 caracteres del título. Spy tiene el texto de la pieza, aunque lo borra a los 30 días.
- **El desarme no guarda el múltiplo de su pieza** (`FuenteDesarme`). Para «los 5 de mayor múltiplo y qué tienen en común»
  hay que cruzarlo con Spy.

**Por costo, de menor a mayor** (lo decide el Cerebro):
- Sólo código, con lo que ya se guarda: la grabación y el CTA en «Hacer uno así» (4), el costo (5), el clip por frase del
  guion nuevo (6) y el carrusel (7).
- Un campo más para Gemini: cuándo aparece la persona (3).
- El worker de esta fase, con el OK de Martín: el piso del audio (2).
- La clave de Apify al día, y después un diseño propio: el nivel cuenta (1).
