# Edición automática de anuncios verticales — el pipeline completo

> **Estado: funciona de punta a punta y produjo tres anuncios reales para Mauricio.**
> Escrito el **01/09/2026** para que Content Machine lo implemente dentro de MaKo.
>
> Esto documenta **qué se hace y por qué cada número es el que es**. Los porqués no son
> decoración: casi todos se pagaron con una entrega rechazada. La sección de gotchas es la
> más importante del documento — son todos fallos **silenciosos**, que no tiran ningún
> error y dejan el archivo mal.
>
> El detalle forense de cada uno vive en `hallazgos-video-pipeline.md` §10, §11 y §12.
> La producción de los clips (Flow, fotos, método) es previa y está en
> `guia-produccion-mauricio.md`.

---

## 1. Qué produce, medido

Entra: **N tomas de Flow** (clips verticales de duración fija con voz sintética de Google).
Sale: **un anuncio terminado** con la voz del cliente, música, subtítulos quemados y sin
aire muerto.

| | entrada | salida | silencio que queda |
|---|---|---|---|
| Video 5 | 7 tomas × 10,005 s = 70,04 s | **38,65 s** | 0 huecos ≥ 0,30 s |
| Video 6 | 7 tomas × 10,005 s = 70,04 s | **48,63 s** | 0 huecos ≥ 0,30 s |

720×1280, 24 fps, H.264 + AAC, **−14,0 LUFS** con true peak bajo −2,4 dBTP, y el texto del
guion verificado palabra por palabra contra el original.

El recorte es de **45% y 31%**. No se pierde ni una palabra: lo que se va es silencio,
respiraciones y los espasmos del modelo de voz.

**Ese último punto es el que hace la diferencia entre "un video con IA" y un anuncio.** Lo
dijo Martín mirando el resultado: *«la IA se traba y dice "eh", muy corto, como un espasmo,
y eso genera que el video se vea de IA»*.

---

## 2. Parte A — Clonar la voz del cliente (una vez por cliente)

### 2.1 Qué material pedirle

**No es "mandame audio". El registro del material tiene que ser el mismo que el del
destino.** Medido y pagado: se rehizo el clon de Mauricio con **11 minutos limpios**
grabados con el celular y salió **peor** que con 97 segundos sacados de sus anuncios —
105 Hz contra sus 139 reales, y el doble de énfasis. Grabó conversando, y el destino es un
anuncio.

> **La regla: para clonar una voz de anuncio hay que clonar de anuncios.** El registro pesa
> más que la duración y más que la calidad de grabación.

Lo que se usó en el clon que funciona:

- **3 notas de voz, 313 s**, todas en registro de anuncio y con CTA.
- **m4a 73 kbps mono 48 kHz, sin recomprimir** — se sube el archivo tal cual llega de
  WhatsApp. Recomprimir no agrega nada y puede restar.
- Se **excluyó** deliberadamente una nota que estaba a 123 Hz (más grave que su registro
  normal). Una muestra fuera de registro contamina el clon entero.

### 2.2 Autorización — no es opcional

La autorización de uso de voz del titular se grabó el **19/08/2026**, antes de clonar, y se
guardó junto al material (`Mauricio/VOZ/LEGAL/`). **En MaKo esto tiene que ser un paso
bloqueante del onboarding de voz**, no un checkbox: es la voz de una persona real.

### 2.3 Crear el clon

`POST /v1/voices/add` con los samples. En la **descripción** conviene dejar escrito qué
material entró y qué se excluyó — es lo que permite entender un año después por qué un clon
suena como suena. La del clon de Mauricio dice, textual:

> *"3 notas de voz de Mauricio del 22/08/2026 en registro de anuncio, con CTA:
> incendio del viernes, todos dijeron que sí, junta de rendición de cuentas. 313 s, m4a
> 73 kbps mono 48 kHz, sin recompresión. Excluye 'Dejar de preguntar' (123 Hz, más grave)
> y la autorización legal. Autorización de uso de voz grabada por el titular el 19/08/2026."*

Voz vigente de Mauricio: **`dKQBE4K2Lu9KFMvS8sgP`** — «Mauricio (anuncios 22-08)».

> ⚠️ **Un `voice_id` anotado se verifica antes de usarlo**, con `GET /v1/voices/{id}`. El id
> anterior (`cw1FCBOoMtF4joFyHYy9`) devuelve `voice_not_found`: la voz se re-clonó y el id
> cambió. Un id muerto **no rompe en la primera llamada de un pipeline largo** — rompe
> después de que ya gastaste el resto. `GET /v1/voices` lista las clonadas por nombre.

### 2.4 Speech-to-speech, no texto-a-voz

La voz del cliente se pone **sobre el audio de Flow** con `eleven_multilingual_sts_v2`. Es
conversión de timbre, no síntesis: **preserva el ritmo, así que no hay que resincronizar los
labios del avatar**. Medido sobre 100 s reales: desfase mediano **0 ms**, máximo 30 ms, 0 de
50 tramos por encima de 80 ms.

```bash
curl -X POST "https://api.elevenlabs.io/v1/speech-to-speech/$VOICE_ID?output_format=mp3_44100_192" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -F audio=@toma-N.wav \
  -F model_id=eleven_multilingual_sts_v2 \
  -F 'voice_settings={"stability":0.55,"similarity_boost":0.75}'
```

**Una llamada por toma**, no una por anuncio: si una falla se rehace sola, y los tramos se
derivan después del audio real de cada una.

Sobre los parámetros: se empezó con `stability 0.45` / `similarity_boost 0.85` y Martín
marcó que la voz sonaba **robótica en algunos puntos**. Un `similarity_boost` alto fuerza el
timbre del clon y mete artefactos metálicos cuando el modelo no puede reconciliarlo con el
audio fuente. Con **0,55 / 0,75** dejó de aparecer.

> **NO VERIFICADO:** que ese cambio sea la causa real. Es una hipótesis razonable que
> coincidió con que el problema desapareciera; «robótico» no se puede medir. Si vuelve a
> pasar, lo que hay que hacer es generar variantes de UNA toma y que las escuche una
> persona, no adivinar.

Verificado en cambio, y sirve como test automático: **el STS conserva el texto exacto**.
Transcribir entrada y salida con Groq y comparar es una forma barata de detectar que una
conversión salió mal.

Costo real: **1.650 caracteres por anuncio de 7 tomas** (~1,3% de un plan Creator de
131.000). No es una restricción.

---

## 3. Parte B — El montaje (cada anuncio)

Seis pasos. El script que los corre es `scripts/montar-anuncio-sin-silencios.sh`, y **es el
que produjo los videos entregados**, no pseudocódigo.

### 3.1 Plan de cortes — el corazón, y lo que más costó

`scripts/plan-cortes-anuncio.mjs`. Decide qué tramos se conservan.

**Detector de doble umbral.** Los dos salen del RMS de **cada toma**, no de una constante:

| | umbral | para qué |
|---|---|---|
| **bajo** | `RMS − 13 dB` | los **bordes** del tramo. Generoso: una vocal final decae despacio y sigue siendo parte de la palabra |
| **alto** | `RMS − 6 dB` | el **núcleo de habla**. Una respiración o una muletilla no llegan; una sílaba sí |

Un tramo del umbral bajo se conserva **solo si contiene un núcleo del alto**, y se le
recorta la cabeza hasta poco antes del primer núcleo y la cola hasta poco después del
último.

Por qué así, y no más simple:

1. **Umbral fijo: no sirve.** El piso de ruido cambia por toma — medido de **−39 dB a
   −84 dB en el mismo anuncio**, porque el locutor va manejando. Con −38 dB fijo, las tomas
   ruidosas no tienen **ni un** silencio detectable.
2. **Un solo umbral adaptativo: tampoco.** Distingue sonido de silencio, no habla de
   no-habla. El "silencio largo" que Martín marcó eran **1,36 s de respiración con pico
   −6,3 dB** — más fuerte que el habla (RMS −17 dB). Y el "eh" del modelo es una isla de
   0,2 s a −23 dB. Los dos pasan cualquier filtro de energía.

Parámetros (todos por env, arriba del script):

```
DELTA_LO=13   DELTA_HI=6    MINSIL=0.10   MINNUC=0.04
AIRE=0.07     AIRE_COLA=0.22    MINHUECO=0.14   MINSEG=0.20   CLAMP=0.45
```

- `AIRE_COLA` es **más grande que `AIRE` a propósito**: las vocales finales decaen y
  recortar la cola al ras se come finales de palabra.
- `MINHUECO` — si el corte ahorra menos que esto, no se hace: no paga su jump cut. Sin este
  umbral quedan tramos de 0,25 s, un parpadeo entre dos saltos que no gana nada.
- `CLAMP` — ver 4.3.

### 3.2 Voz

Se cortan los tramos del plan y se pegan (`atrim`/`asplit`/`concat`), y recién ahí va la
cadena tonal:

```bash
ffmpeg -i voz-cruda.wav -af "highpass=f=80:poles=2,\
deesser=i=0.35:m=0.5:f=0.5,\
acompressor=threshold=-18dB:ratio=3:attack=5:release=180:makeup=2,\
alimiter=limit=0.7:level=disabled" -ar 48000 -ac 1 voz-proc.wav
```

Sin denoise: el audio de ElevenLabs viene limpio. Lo que **sí** necesita es headroom — sale
clipeado de fábrica (sample peak 0 dBFS, true peak +0,19 dBTP).

### 3.3 Música

Se **mide** y se calcula la ganancia. Nunca un "−20 dB" a ojo:

```bash
# medir el I de la pista en el tramo que se va a usar, y llevarla a -33 LUFS
GAN = -33 - input_i
ffmpeg -t $TOTAL -i musica.mp3 -af "volume=${GAN}dB,\
afade=t=in:st=0:d=0.8,afade=t=out:st=$((TOTAL-2.5)):d=2.5" -ar 48000 -ac 2 musica.wav
```

−33 LUFS deja la música ~16 LU debajo de la voz. Dentro del rango usable (15–20).

### 3.4 Mezcla y loudness

```bash
# normalize=0 es OBLIGATORIO: sin eso amix divide por el numero de entradas
ffmpeg -i voz-proc.wav -i musica.wav -filter_complex \
  "[0:a]aformat=channel_layouts=stereo[v];[v][1:a]amix=inputs=2:normalize=0:duration=longest[m]" \
  -map "[m]" -ar 48000 mezcla.wav

# loudnorm de DOS pasadas sobre la MEZCLA (no sobre la voz: el entregable es la mezcla)
# pasada 1 mide -> pasada 2 aplica con los measured_*
ffmpeg -i mezcla.wav -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=..:measured_TP=..:\
measured_LRA=..:measured_thresh=..:linear=true:print_format=json,\
alimiter=limit=0.891:level=disabled" -ar 48000 -ac 2 audio.wav
```

**Verificar que la pasada 2 diga `"normalization_type": "linear"`.** Si dice `dynamic`, ver
4.5.

### 3.5 Subtítulos

Groq `whisper-large-v3` sobre **la voz sola** (no la mezcla: la música ensucia los
timestamps), y un `.ass` propio con `scripts/subs-anuncio.mjs`.

Look: mayúsculas, 3 palabras por bloque, máximo 18 caracteres por línea, la palabra activa
en amarillo `&H00E5FF`, blanco el resto, contorno negro, posición fija en `y=950` de 1280.

```bash
curl https://api.groq.com/openai/v1/audio/transcriptions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -F file=@voz.mp3 -F model=whisper-large-v3 \
  -F response_format=verbose_json -F "timestamp_granularities[]=word" -F language=es
```

`response_format=verbose_json` es **requisito**: sin eso `timestamp_granularities` no
devuelve palabras. Mandarle el audio ya a **16 kHz mono** — Groq downsamplea igual.

### 3.6 Render

Los trims de video, el concat y el quemado de subtítulos, **en una sola pasada**, para no
recomprimir dos veces:

```bash
ffmpeg -i toma1.mp4 ... -i audio.wav -/filter_complex filtro-video.txt \
  -map "[v]" -map "N:a" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -level 4.0 -r 24 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest final.mp4
```

El filtro lo genera `scripts/gen-filtros-anuncio.mjs`. `ass=subs.ass:original_size=720x1280`
va después del concat; `original_size` es obligatorio en 9:16.

---

## 4. Los gotchas. Todos silenciosos.

Ninguno tira error. Todos dejan el archivo mal.

### 4.1 `alimiter=limit=X` no limita nada sin `level=disabled`

Tiene un parámetro **`level` (auto level) en `true` por default** que renormaliza a 0 dBFS
**después** de limitar. El `limit` se aplica y se deshace. Medido: `limit=0.7` deja el pico
en **0,000265 dB**; con `level=disabled`, en **−3,098 dB**.

### 4.2 Los timestamps de palabra de Whisper NO sirven para POSICIONAR cortes

Parece la solución obvia y **falla por dos motivos independientes**:

- **`word.end` está estirado**: Whisper nunca deja huecos, alarga la última palabra antes de
  una pausa hasta donde arranca la siguiente. `"apriete,"` figura durando **2,44 s** cuando
  deja de sonar a los 0,5 s.
- **`word.start` está corrido**, hasta **~0,6 s** en este material. Whisper ubica
  `"apagando"` en 3.24; ahí todavía suena `"terminar"`, entre 3.42 y 3.82 hay silencio real
  y `"apagando"` arranca en 3.90.

Cortar por esos números parte palabras al medio: salieron `"pagando"`, `"quiere"` por
`"requiere"`, `"ser"` por `"hacer"`, y `"compromisos"` desaparecida.

> **La energía POSICIONA (es exacta). Whisper VERIFICA (después).** Al revés no funciona.

### 4.3 …salvo en un caso, y por eso existe `CLAMP`

Al inicio de una toma había un ruido a **−15,7 dB** contra un RMS de voz de −16,4: **más
fuerte que el habla**. Ningún umbral de energía lo separa. Ahí el único dato útil es que
Whisper no transcribió nada antes.

Se usa como **tope grueso**: si un tramo arranca más de 0,5 s antes del primer `word.start`
que contiene, se lo recorta hasta `word.start − CLAMP`. El margen de 0,45 s absorbe el error
de 4.2. Actúa solo en el caso patológico.

### 4.4 `acompressor:makeup` es un factor LINEAL, no dB

`makeup=2` es **×2 = +6,02 dB**, no +2 dB. En material que ya viene caliente empuja todo
sobre 0 dBFS y dispara 4.5.

### 4.5 `loudnorm linear=true` cae a `dynamic` también por TRUE PEAK

La documentación conocida menciona el LRA. Hay una segunda condición:

```
PLR = measured_TP − measured_I  ≤  TP_target − I_target
```

Con I=−14 y TP=−1 el techo es **13 dB de PLR**. Y no es margen teórico: uno de los anuncios
entró con **12,84**. El pipeline imprime el PLR y el `normalization_type` en cada corrida.

### 4.6 `silencedetect` escribe en STDERR

Parsear stdout (que es lo que devuelve `execFileSync`) da **«0,00 s de aire muerto» en todas
las tomas**, sin un error en ninguna parte, justo cuando el aire muerto es el problema a
resolver. La firma del bug es un informe **perfectamente uniforme**: si todas las entradas
dan el mismo valor limpio, el sospechoso es el parseo, no el material.

### 4.7 Un silencio de 50 ms es una oclusiva, no una pausa

`/p/`, `/t/`, `/g/` dejan 50–80 ms de silencio **dentro** de la palabra. Buscar el final de
palabra con `d=0.05` parte `"apagando"` en la `/g/` y sale `"dando"`. El detector va con
`d=0.10` o más.

### 4.8 Los mp3 traen padding del encoder

Cada mp3 de voz dura 26–34 ms más que su clip. Es silencio digital (−91 dB medido), pero
concatenando de corrido **acumula** y la voz se despega del video. Cada audio se ancla a la
ventana de su clip.

### 4.9 `-filter_complex_script` ya no existe (ffmpeg 7+)

En ffmpeg 9 devuelve `Unrecognized option`. El reemplazo es `-/filter_complex ARCHIVO`.

### 4.10 En un `filter_complex` no se puede reusar el mismo pad de entrada

Una toma con K tramos necesita `split=K` / `asplit=K` antes de los `trim`.

### 4.11 Un clip de Flow puede volver MUDO

Medido: un clip a **−46 dB** cuando los otros estaban a −20. Nada lo avisa. **Medir el RMS
de cada clip apenas baja de Flow** cuesta 2 segundos y evita descubrirlo en el montaje.

### 4.12 `loudnorm` resamplea a 192 kHz en silencio

Si no se fuerza `-ar 48000`. Entró 48k, salió 192k.

---

## 5. La verificación. No es opcional y no es contar palabras.

**Este es el error de método que costó dos entregas.** El verificador contaba palabras y
decía «124 de 124, intacto» mientras el corte dejaba esto:

| original | resultado |
|---|---|
| Cambiar eso **requiere** algo | Cambiar eso **quiere** algo |
| que **hacer** responsable | que **ser** responsable |
| estructurar **compromisos** que | estructurar que |

Comerse el ataque de una palabra **mantiene el conteo intacto**.

`scripts/verificar-corte-anuncio.mjs` transcribe el resultado, lo **diffea palabra por
palabra** contra la unión de las tomas originales, y devuelve exit ≠ 0 si algo falta o se
mutiló. Además reporta los huecos ≥ 0,30 s entre palabras consecutivas — que es la métrica
correcta de "quedó silencio", no la energía.

> **Falso positivo conocido:** `"pregunta si"` se transcribe como `"preguntas i"`. Es
> coarticulación del reconocedor, no daño. Se distingue mirando si hay un corte dentro del
> intervalo. **Regla: si una diferencia aparece con TODAS las configuraciones, incluidas las
> que casi no cortan, es del reconocedor y no del corte.**

Y la otra mitad del error: **se verificaba el PLAN, no el PRODUCTO**. El informe del
planificador es una predicción sobre sus propias reglas — si las reglas están mal, confirma
con entusiasmo que se aplicaron mal. Hay que medir el archivo final.

---

## 6. Qué hay que construir en MaKo

### 6.1 La decisión que bloquea todo: dónde corre ffmpeg

**Vercel no trae ffmpeg y las funciones serverless no son el lugar para esto.** Un render de
70 s tarda ~25 s de CPU y el pipeline entero encadena ~15 invocaciones de ffmpeg más 8 de
API. Hay que decidir **antes de escribir código**:

- un worker propio (contenedor con ffmpeg + node) al que MaKo encola trabajos, o
- un servicio de render externo, o
- correrlo en la máquina del usuario (no aplica: MaKo es SaaS).

Nada del resto de esta guía depende de cuál se elija, pero **todo depende de que se elija**.
Ojo con el costo: la palanca de Vercel es el **tamaño de la máquina**, no la duración.

### 6.2 Lo que ya está resuelto y se puede portar tal cual

Los cinco scripts son el pipeline real y están versionados:

| script | qué hace |
|---|---|
| `scripts/montar-anuncio-sin-silencios.sh` | orquesta los 6 pasos |
| `scripts/plan-cortes-anuncio.mjs` | el detector de doble umbral |
| `scripts/gen-filtros-anuncio.mjs` | arma los `filter_complex` de audio y video |
| `scripts/subs-anuncio.mjs` | el `.ass` palabra por palabra |
| `scripts/verificar-corte-anuncio.mjs` | la verificación de 5, con exit code |

`scripts/barrido-cortes-anuncio.sh` prueba varias configuraciones y las mide — sirve para
recalibrar cuando cambie el material.

### 6.3 Lo que hay que resolver para que sea multi-inquilino

1. **La fuente.** Hoy el `.ass` usa `Segoe UI Black`, que existe en la máquina de Martín y
   **no existe en un servidor Linux**. Y libass **no falla**: cae a otra fuente y sigue.
   Subtítulos rotos sin una línea en el log. Hay que pasar a **Anton** o **Montserrat
   ExtraBold** (OFL, se pueden bundlear) y pasar `fontsdir`.
2. **La música.** La pista de Pixabay sirve para entregarle el archivo a un cliente y **no
   sirve para el SaaS**: la licencia no concede `distribute` ni `sub-license`. Los dos
   caminos limpios son **Epidemic Sound Connect (Partner API)** o **Stable Audio Open
   self-hosted**. Ver `hallazgos-video-pipeline.md` §5(c). **Esto no se puede improvisar en
   la implementación.**
3. **BYOK de ElevenLabs.** Hoy la key es de Martín. En el SaaS, la voz clonada de un cliente
   vive en la cuenta de quien pone la key, y eso es una decisión de producto además de
   técnica.
4. **La autorización de voz** como paso bloqueante del onboarding (2.2).
5. **Los parámetros por workspace.** `DELTA_HI` y los aires son lo primero que hay que mover
   si el material cambia (otro locutor, otro ambiente). No deberían quedar hardcodeados.

### 6.4 La experiencia que se lleva el usuario

Lo que el usuario tiene que ver en MaKo: sube o genera sus tomas, y **le vuelve el anuncio
montado**. Nada de lo de arriba debería aparecer en pantalla.

Lo único que sí merece estar visible, porque es lo que le da confianza y es barato de
mostrar: **cuánto se recortó y que no se perdió ni una palabra** — los dos números ya los
produce el verificador.

---

## 7. Lo que NO está resuelto

- **Nada de esto se validó de oído, solo por medición.** El ritmo final no lo escuchó nadie
  con criterio de editor.
- **El detector no distingue una pausa retórica de una muerta.** Si se come un silencio
  dramático antes de un giro, ese es el motivo.
- **Las muletillas que Whisper SÍ transcribe** no se filtran hoy.
- **El número de tomas y su duración están fijos** (`NTOMAS`, `DURVID`). No se autodetectan.
- **Los targets de loudness de Meta/TikTok/Instagram no están verificados**: no hay
  documentación oficial, todo lo que circula es blog. −14 LUFS es un default operativo, no
  un requisito de plataforma.
- **Content ID**: no se comprobó si la música usada está registrada en YouTube o Meta.

---

## 8. El port a MaKo — hecho el 01/09/2026

Las dos decisiones que bloqueaban están tomadas por Martín: **contenedor propio** para
ffmpeg, y **Epidemic Sound Connect** para la música. La segunda es un trámite comercial,
así que el pipeline se construyó con la música **enchufable y apagada** — sin ella entrega
voz y subtítulos, y no se traba.

### Lo que se sacó, y cómo fallaba cada cosa

| Qué | Cómo fallaba fuera de la máquina de Martín |
|---|---|
| 3 llamadas a `python` | `command not found` en medio de un pipe; con `pipefail`, la salida vacía se tomaba como número |
| 5 rutas absolutas (`C:/Users/marti/…`) | música, clips, scratchpad y el `.env.local` que leían dos scripts |
| `Segoe UI Black` | **libass no falla**: cae a otra fuente y sigue |

Hoy los seis scripts no tienen una sola ruta absoluta ni una llamada a python.
`scripts/loudnorm-json.mjs` reemplaza a python, y falla ruidoso con las últimas líneas de
ffmpeg cuando no encuentra el JSON — porque un campo ausente que sale como cadena vacía
corre todos los `$1 $2 $3 $4` un lugar y `measured_TP` termina recibiendo el LRA.

### ⚠️ El fallo de la fuente, medido y con imagen

Renderizando el MISMO cuadro con y sin `fontsdir`, en ffmpeg 9.0:

```
  con fontsdir=fuentes   →  11.731 bytes   Anton: condensada, pesada
  sin fontsdir           →  22.814 bytes   Arial: fina, ancha
  ffmpeg salió 0 en los dos casos
```

No es sólo otra tipografía: la caída es **mucho más ancha**. «PRUEBA ANTON» ocupa 230 px
con Anton y 505 px con la fallback, sobre un lienzo de 720 — así que los topes de
`MAX_CHARS` del generador de subtítulos, calibrados para una condensada, desbordan.

Por eso hay **dos** guardas y no una: el montaje corta si no hay ninguna `.ttf` en
`$T/fuentes`, y el Dockerfile compara los dos renders en tiempo de build y falla si son
idénticos. Comprobar que la fuente cargó sólo se puede hacer antes de renderizar; después
es un archivo mal con exit code 0.

### El `fontsdir` va RELATIVO

Un `filter_complex` separa sus opciones con `:`, así que una ruta de Windows (`C:/…`) parte
el filtro al medio. El montaje hace `cd "$T"` antes del render y copia la fuente a
`$T/fuentes`, así que `fontsdir=fuentes` alcanza y funciona igual en los dos sistemas.

### Verificación independiente del gotcha del limitador

`alimiter=limit=0.7` sobre una señal de −24,1 dB, en ffmpeg 9.0:

```
  entrada                          -24,1 dB
  alimiter=limit=0.7               -21,0 dB   ← SUBIÓ 3,1 dB sin limitar nada
  alimiter=limit=0.7:level=disabled -24,1 dB
```

El auto-level multiplica por `1/limit`, que para 0,7 son exactamente **3,098 dB** —
el mismo número que reportó la corrida original, reproducido por otro camino.

### Lo que falta para que sea una feature

1. **La cola y el bucle del worker.** El repo ya tiene el patrón tres veces
   (`flow_trabajos` es el más cercano) y un precedente de worker largo con perro guardián
   en `scripts/cursos-perro.sh`. El Dockerfile no trae `CMD` todavía a propósito: primero
   se corre a mano contra un directorio de trabajo.
2. **Provisionar el contenedor.** Necesita la cuenta de Martín.
3. **Epidemic Sound Connect.** Trámite comercial. `MUSICA` vacío es hoy el camino normal.
4. **`NTOMAS` y `DURVID` por workspace**, hoy defaults del script.
5. **BYOK de ElevenLabs** — decisión de producto: en la cuenta de quién vive la voz clonada
   de un cliente.

---

## 9. La cola y el worker — hecho el 01/09/2026

### Cómo se prende (los pasos exactos)

**1. Un secreto, el mismo en los dos lados.**

```
openssl rand -hex 32
```

Va como `MONTAJE_WORKER_TOKEN` en Vercel (Production) **y** como variable del
contenedor. Sin él la puerta contesta 404 y el worker sale con código 1 — ninguno
de los dos se cae a «cualquiera pasa».

**2. La imagen.**

```
docker build -f worker/Dockerfile -t mako-montaje .
```

El build FALLA si Anton no se está cargando: renderiza el mismo cuadro con y sin
`fontsdir` y exige que salgan distintos. Es la única forma de detectar la caída
de libass, que no da error.

**3. Correrla**, con `MONTAJE_WORKER_TOKEN`, `MAKO_URL` y `GROQ_API_KEY` (la
transcripción de los subtítulos y de la verificación). Una réplica = un render a
la vez; la concurrencia se sube agregando réplicas, no subiendo `p_cuantos`.

### Lo que se verificó, y contra qué

| Qué | Cómo |
|---|---|
| La toma es atómica | dos `montaje_tomar` seguidos devuelven trabajos **distintos** |
| El tope de intentos | un trabajo con 3 queda `fallido` con motivo y no se re-entrega |
| La cola vacía | devuelve 0, no un error |
| La ruta pasa el middleware | por el **texto** del 404: «no encontrado» es el handler; «no autenticado» sería `proxy.ts` |

### ⚠️ El rescate de colgados va a 20 minutos, no a 10

En Flow un trabajo es una llamada HTTP y 10 minutos sobran. Acá es un pipeline
entero —transcribir, cortar, mezclar, renderizar— que en un anuncio largo pasa
los cinco minutos con facilidad. **Un rescate demasiado corto no desatasca:
duplica el render que todavía está corriendo**, y los dos escriben en la misma
ruta.

### ⚠️ La url de subida se firma AL ENTREGAR, no al encolar

Un trabajo puede esperar horas en la cola. Una firma acuñada al encolar llegaría
vencida y el worker fallaría en el último paso, **después de gastar el render
entero** — que es la forma más cara de fallar. Se acuña cuando se entrega, y si
no se puede firmar el trabajo se suelta en vez de entregarse condenado.

### Lo que falta

1. **La pantalla.** Las dos actions están (`montarAnuncioAction`,
   `estadoMontajeAction`); falta el paso del wizard que las use y muestre los dos
   números —cuánto se recortó y que no se perdió una palabra—.
2. **Provisionar el contenedor.** Necesita la cuenta de Martín.
3. **Epidemic Sound Connect.** Hoy `MUSICA` vacío es el camino normal.
4. **`NTOMAS`/`DURVID` por workspace** y **BYOK de ElevenLabs**.

### El clon de Martín (8/11/2026): el tono estaba BIEN, y aun así no se parecía

Martín rechazó seis versiones. Se midió el tono con autocorrelación, igual que en el caso de
Mauricio, y **descartó la hipótesis obvia**:

| | tono mediano |
|---|---|
| Su voz real (el video crudo) | **131 Hz** |
| Lo que genera el clon (V3, tres ajustes) | **125-128 Hz** |

**3-4% de diferencia: el clon lo agarró en registro.** No es el caso de Mauricio (105 contra 139).
⚠️ **Por eso conviene medir antes de teorizar:** yo iba a repetir «es el registro» y no era.

**Lo que quedó como causa, y la primera es un error mío:**

1. **Le subí el audio RECOMPRIMIDO Y NORMALIZADO.** Extraje la pista a mp3 y le apliqué
   `loudnorm` + `highpass`. La regla ya estaba escrita arriba: **se sube el archivo tal cual llega,
   recomprimir no agrega nada y puede restar.** La normalización además comprime el rango dinámico,
   que es justo lo que define el énfasis de una voz.
2. **El registro de INTERPRETACIÓN no coincide con el destino.** Su material es él **explicando a
   cámara, tranquilo**; la línea de destino es una **chicana de anuncio** («Che Walter, obvio
   que…»). El tono en Hz coincide, pero la entrega no. Es la misma regla del caso de Mauricio vista
   desde el otro lado: no alcanza con la altura, hay que igualar **cómo se dice**.
3. **El plan sólo da clonado INSTANTÁNEO** (`is_allowed_to_fine_tune: false`). El profesional —el que
   de verdad suena idéntico— pide plan superior.

⚠️ **Y mi consejo también estaba mal:** le dije «grabá 2-3 minutos limpios leyendo cualquier cosa».
**Eso es exactamente lo que falló con Mauricio.** Lo que hay que pedirle son **tomas cortas en el
registro del destino** —frases de anuncio, con chicana y CTA—, no lectura tranquila.

⚠️ **La cuenta está en 10/10 voces** (siete son clones viejos de Mauricio, de los experimentos del
21-22/08). Para probar otro clon hay que borrar alguno primero, y eso lo decide Martín.

### El clonado PROFESIONAL: qué pide de verdad (verificado el 8/11/2026)

Martín dudó de que hiciera falta pagar más, con razón, y se verificó contra la fuente.

**Los planes, de la página de precios de ElevenLabs:**

| Plan | US$/mes | Instantáneo | **Profesional** |
|---|---:|---|---|
| Starter (el de Martín) | 6 | sí | **NO** |
| **Creator** | **22** (11 el primer mes) | sí | **sí, 1 ranura** |
| Pro | 99 | sí | sí, 1 |
| Scale | 299 | sí | sí, 3 |

En la API se ve igual de claro: `can_use_professional_voice_cloning: false` y
`professional_voice_limit: 0` — cero ranuras, no es un tope que se pueda estirar.

✅ **MARTÍN YA PASÓ A CREATOR el 8/11/2026.** Verificado en la API: `tier: creator`,
`can_use_professional_voice_cloning: true`, **1 ranura profesional libre**, 30 voces instantáneas
(usaba 10) y 160.449 caracteres. **NO hay que volver a recomendarle que suba de plan.**

⚠️⚠️ **PERO EL PLAN NO ES EL COSTO REAL. El profesional pide un MÍNIMO de 30 MINUTOS de audio**, y
recomienda entre 1 y 3 horas (docs oficiales). Los 110 segundos de un video de teléfono no alcanzan
ni de cerca. **Pagar Creator sin grabar esos 30 minutos no cambia nada.** El entrenamiento además
tarda de 3-6 h a 24 h.

**Y lo que piden esos 30 minutos, textual de la doc, reconcilia con la regla de la casa:**

- **Un solo estilo.** «It is better to just include one style in the uploaded samples.» Y «the
  speaking style in your samples is replicated in the output». Es exactamente «el registro del
  material tiene que ser el del destino», dicho por ellos.
- **Un solo hablante**, sin música ni ruido de fondo, sin reverb ni eco.
- ⚠️ **Nivel: −23 a −18 dB RMS y pico real −3 dB.** O sea que **nivelar NO está mal** — mi
  `loudnorm=I=-19:TP=-3` cae justo adentro de esa banda. **El error fue RECOMPRIMIR** (pasar la
  pista a mp3), que es otra cosa y es lo que la regla de arriba prohíbe. Conviene no mezclar las dos:
  **nivelar sí, recodificar no.**

## De dónde sale el material: las notas de voz de WhatsApp (8/11/2026)

El clon de Martín con 110 segundos sacados de un video se rechazó **seis veces**. Lo que lo
movió no fue cambiar de modelo ni de ajustes: fue **conseguir más material del registro
correcto**. En `~/Downloads` había 8 archivos `WhatsApp Ptt …` (notas de voz, push-to-talk).

**Las notas de voz son la mejor fuente que hay para clonar.** Un solo hablante por
definición, sin música, sin otra voz encima, y en el mismo registro conversacional que
después se le va a pedir al clon. Es el equivalente a los anuncios de Mauricio: material del
destino, no material de estudio.

⚠️ **Hay que medirle el tono a CADA archivo antes de usarlo, nunca subirlos todos.** De los 8
de Martín, sólo 4 eran de él en registro:

| archivo | tono | |
|---|---|---|
| `Ptt 2026-10-15 at 23.21.16` | **131 Hz** | suyo |
| `Ptt 2026-10-21 at 18.00.22` | **127 Hz** | suyo |
| `Ptt 2026-10-22 at 18.29.37` | **124 Hz** | suyo |
| `Ptt 2026-10-22 at 18.31.07` | **123 Hz** | suyo |
| `Ptt 2026-10-08 at 02.43.02` | 148 Hz | fuera de registro — excluido |
| `Ptt 2026-10-25 at 12.27.32` | 188 Hz | **otra persona** |
| `Ptt 2026-10-23 at 09.32.00` | 90 Hz | excluido |
| `Ptt 2026-11-05 at 12.21.12` | 110 Hz | excluido |

Su voz real, medida del video original, da **128 Hz**. La medición es
`scratchpad/walter/tono.mjs` (autocorrelación, banda 70–300 Hz). Sin medir, los 8 archivos
parecen igual de válidos y dos de ellos arruinan el clon: uno es de otra persona.
Quedaron **6,2 minutos en registro**, contra los 110 segundos de antes.

### ⚠️ El tope de 11 MB por archivo: se CORTA, no se baja la calidad

`POST /v1/voices/add` rechaza cualquier archivo de más de 11 MB
(`upload_file_size_exceeded`). Un WAV 48 kHz 16-bit mono son ~96 KB/s, así que una nota de
4 minutos ya son 23 MB. FLAC sin pérdida baja un 40% — **no alcanza**, el tramo más largo
quedaba en 14 MB.

**La salida NO es bajar la calidad** (ni el sample rate ni pasar a mp3): es **cortar en
tramos** y subirlos como muestras separadas, que ElevenLabs acepta hasta 25.
`-f segment -segment_time 90` da tramos de ~5 MB a 48 kHz FLAC. Script:
`scratchpad/walter/clon-notas2.mjs`. Las 4 notas salieron como 8 muestras, 36 MB en total,
sin perder un bit.

### ⚠️ V3 con texto corto sale robótico — no es el clon, es la falta de pista

Martín venía diciendo «se escucha robótico en algunas partes» con una línea de **70
caracteres**. ElevenLabs pide **+250 caracteres** para que `eleven_v3` asiente la voz: con
una frase corta el modelo no tiene pista para entrar en registro y los primeros fonemas
salen sintéticos. **Diagnóstico equivocado el obvio**: parecía problema del clon o de los
ajustes, y era el largo del texto.

La receta: **generar con un arranque largo descartable y recortar sólo la línea**. El corte
se hace buscando el silencio más cercano a donde arranca la línea por proporción de
caracteres (`scratchpad/walter/recortar.mjs`), no a ojo.

⚠️ **El tono NO predice si suena parecido.** Las versiones con pista larga midieron 137–147 Hz
y la corta 134 Hz, o sea que la corta está «más cerca» de los 128 reales y suena peor. El tono
sirve para **descartar** material y clones fuera de registro, no para elegir entre dos que ya
están en banda. Eso lo decide Martín escuchando.

## ⚠️ EL ACENTO LO DECIDE EL MODELO, NO EL CLON: era V4, no V3 (8/11/2026)

**El hallazgo más caro de toda la sesión.** Martín rechazó la voz **siete veces**. Las siete
veces busqué la causa en el **clon**: cambié el material, lo nivelé, dejé de recomprimirlo,
pasé de 110 segundos a 6,2 minutos, probé STS contra TTS, medí tonos. Nada de eso era.

Lo destrabó una sola frase suya: **«siento que mi voz está mexicanizada»**. Martín es
rioplatense (che, voseo) y el clon salía en español neutro.

**La causa:** `eleven_v3` **prioriza la lectura emocional por encima de respetar la voz
clonada**. Cuando se le va, cae en el prior de español de base del modelo, que es neutro/
mexicano. Era el modelo que yo venía usando para todo.

**El fix:** `eleven_v4`. Los docs de ElevenLabs lo dicen explícito: **con V4, si se genera en
el MISMO idioma de las muestras, se conserva el acento original.** Es exactamente el caso
(muestras en español, destino en español). Con el mismo clon, misma línea, mismos ajustes,
V4 pasó de rechazado a aprobado. `eleven_multilingual_v2` quedó peor que los dos.

| modelo | veredicto de Martín |
|---|---|
| `eleven_v4` stability 0.5 y 0.3 | **«Ahora sí me gusta»** ✅ |
| `eleven_v3` (7 intentos, todo tipo de material) | «mexicanizada», «robótico», «no se parece» ❌ |
| `eleven_multilingual_v2` | «no me gusta, no se parece en nada» ❌ |

**La regla que queda: para clonar una voz con acento marcado, el modelo es `eleven_v4`.**
No V3, aunque sea el más nuevo en expresividad y aunque el curso de AvatarHype diga «con voz
clonada por vos, V3» — ese curso es de antes de V4. Está en `lib/` donde se genere voz.

⚠️ **El tono (Hz) no detecta esto.** V4 midió 148 Hz contra sus 128 reales y es el que suena
bien; V3 medía 134 y sonaba mexicano. El acento no está en la frecuencia fundamental. La
autocorrelación sirve para **descartar material y hablantes**, no para juzgar un clon.

### Para el clonado profesional (PVC), cuando se haga
- Mínimo **30 min**; recomendado 30–180, en archivos de ~30 min.
- ⚠️ **Pide que el dueño de la voz lea líneas de verificación.** Ese paso no se puede
  automatizar: siempre va a necesitar a la persona.
- Entrenamiento **3 a 24 h**. Ranura por plan: Creator y Pro = 1.
- ⚠️ **Clone Strength va en 50%, no en el 0% por defecto**, para acentos marcados.
- ⚠️ **El acento no se puede cambiar después de creado el clon.** Se cambian las muestras.
- Material de Martín ya medido y separado: `WhatsApp Audio 2026-10-08 at 22.58.39.mp4`,
  **27,5 min, un solo hablante, 122–126 Hz parejo**. NO sirven `2026-10-10 at 15.54.50`
  (140 Hz) ni `2026-10-25 at 12.27.32` (**188 Hz, es otra persona**).

### ⚠️ Dos trampas de ffmpeg al pegar la voz al clip

1. **`adelay` no corrió el audio** en la cadena
   `atempo,adelay,apad,atrim,loudnorm` — la voz quedaba en 0 s y nadie avisó. Se pega
   **silencio explícito** con `anullsrc` + `concat`, que es determinístico, y se **mide**
   después con `volumedetect` por tramos (silencio real da −91 dB; si da −15, no se aplicó).
2. **`loudnorm` tiene que ir sobre la voz SOLA**, antes de pegarle el silencio. Si ve los
   ~5 s de silencio del final calcula mal la sonoridad integrada y mete una ganancia enorme.

La ventana de habla la marca **el audio que generó Omni**, no el guion: es contra ESE audio
que movió la boca. Se saca con `silencedetect` sobre el clip de Omni (en el de Walter:
1,115 a 5,898 s) y se le ajusta la voz nueva con `atempo`, que conserva el tono.
Receta completa: `scratchpad/walter/armar2.mjs`.

## ⚠️ VOICE-TO-VOICE NO TIENE V4 — y por eso no se puede tener todo (8/11/2026)

Al reemplazar la voz de un clip de Omni por TTS v4, **los labios no calzan**: Omni dice la línea en
**3,49 s de habla repartidos en 3 bloques** con pausas, y el clon la dice de corrido en 4,44 s.
Calzar sólo el arranque y el largo total no alcanza — Martín lo notó enseguida.

**Voice-to-speech (STS) lo resuelve de raíz**: convierte el timbre sin generar de nuevo, así que el
ritmo es el del original. Medido contra Omni, bloque por bloque: **2 ms, 15 ms, 2 ms, 26 ms, 30 ms,
23 ms.** Los labios no se pueden despegar.

⚠️ **PERO el catálogo de la cuenta sólo tiene DOS modelos de conversión, y los dos son v2:**
`eleven_english_sts_v2` y `eleven_multilingual_sts_v2`. **No existe un STS v4.** O sea:

| | voz | labios |
|---|---|---|
| TTS `eleven_v4` | **suena a él** ✅ | se despegan ❌ |
| STS `eleven_multilingual_sts_v2` | motor v2, el que sonaba mexicanizado ❌ | **exactos** ✅ |

**No es un error de configuración: es una limitación del catálogo.** Lo que lo destraba es subir la
fidelidad del clon (clonado profesional), que es lo que le falta al motor v2 — no seguir probando
ajustes.

⚠️ Y dos cosas que v4 **ignora** y que parecen palancas: las etiquetas `<break time="0.44s" />` (el
audio sale de una sola tirada) y el parámetro `speed` (1,15 y 1,2 dieron el MISMO largo, 4,88 s).
Si hacen falta pausas, hay que generar **un pedazo por bloque** y colocarlos a mano.

### ⚠️ Subir muestras al clonado profesional desde el navegador: dos trampas

1. **`.m4a` se rechaza aunque el `accept` del input lo liste.** El `file_upload` de la extensión no
   le infiere el tipo y llega como `application/octet-stream`; la web contesta
   «*X is not supported. Please choose an audio file*». **Van en `.mp3`** (que llega como
   `audio/mpeg`), que además es lo que piden los docs: 192 kbps o más.
2. **Cada archivo entra DOS VECES si uno dispara el `change` a mano.** El `file_upload` ya dispara
   el suyo: con el segundo, la página suma la misma muestra otra vez. Se nota en el contador
   («1 hour 20 minutes» con 37 min subidos). Hay que **contar las filas reales** — los botones
   `aria-label="Remove audio sample"` — y borrar las repetidas antes de seguir.
3. El tope del puente del navegador es **10 MB por llamada, sumando todos los archivos**: un archivo
   de 7 MB va solo. Los tramos de 5 minutos a 192 kbps dan 7,2 MB y entran de a uno.

**El paso que NUNCA se va a poder automatizar:** «Verify your voice» pide grabar al dueño leyendo
líneas en pantalla, con su micrófono. Todo lo anterior —nombre, idioma, acento, muestras— sí.

## El clonado profesional, hecho de punta a punta (8/11/2026) — `I2d6BR9P2dAopVw1khNv`

**Resuelve el dilema de arriba: con el clon PROFESIONAL el voice-to-voice suena a él Y los labios
calzan.** Medido contra los bloques de Omni: **0 ms, 10 ms y 110 ms**. Es el camino bueno para
poner la voz de alguien sobre un clip generado.

| | |
|---|---|
| Voz | `I2d6BR9P2dAopVw1khNv` — «Martin Koncke», categoría `professional` |
| Muestras | 10 archivos, **37 min**: el monólogo de WhatsApp del 8/10 22:58 en tramos de 5 min + las 4 notas en registro |
| Idioma / acento | **Spanish / Argentine** (venía en English, que es el default) |

### ⚠️ Lo que NO coincide con los docs, medido

1. **Tardó ~25 minutos, no «3 a 24 horas».** Los docs dicen 3-6 h (FAQ) o 6-24 h (estado). No hay
   que planificar la tarde alrededor de eso: se mide.
2. **La web MIENTE mientras entrena.** `/app/create-voice` sigue diciendo «No slots available ·
   1 draft voice» con el clon ya entrenando y después entrenado. **El estado real es
   `fine_tuning.state` de `GET /v1/voices/<id>`**, y es lo único que hay que mirar.
3. ⚠️ **`eleven_multilingual_sts_v2` arranca en la lista de modelos y DESAPARECE.** Al crear la voz
   estaba en `fine_tuning.state` con `fine_tuning`; al terminar, los 14 modelos quedaron
   `fine_tuned` y **ése ya no figura en la lista**. No da error ni queda en «fallido»: se va.
   **Y sin embargo el STS anda igual con la voz profesional** — se probó, no se supuso. O sea que
   un modelo ausente del estado NO significa que no se pueda usar. El estado no alcanza: hay que
   llamar a la API y escuchar.
4. **La verificación se puede vencer por tiempo.** El primer intento de Martín falló con
   `Time limit for voice verification exceeded`; el segundo entró. `verification_attempts_count`
   y `verification_failures` lo cuentan, y los docs dicen que tras varios fallos hay que esperar
   24 h. **Conviene mirar esos dos campos antes de dar la verificación por hecha.**

Para vigilar el entrenamiento sin preguntarle a nadie: `scratchpad/walter/vigilar-pvc.mjs`
—consulta cada 10 min y termina sola cuando los modelos que importan quedan `fine_tuned`—.

## ⚠️ En voice-to-voice, `stability` DECIDE EL REGISTRO — y 0,4 es el peor punto (8/11/2026)

Martín aprobó los audios sueltos del clon profesional y rechazó el video: **«suena increíblemente
mal, muy grave»**. Los dos salen de la MISMA voz (`I2d6BR9P2dAopVw1khNv`), por motores distintos:
el TTS `eleven_v4` la rinde a **143 Hz** y el STS `eleven_multilingual_sts_v2`, con los ajustes que
yo venía usando, a **123 Hz**. Su voz real mide 128.

**En STS, `stability` no significa lo mismo que en TTS: decide cuánto se pega a la voz DESTINO
contra cuánto copia la entrega del ORIGEN.** Barrido sobre el mismo audio de Omni:

| `stability` | tono de salida |
|---|---|
| **0,0** | **137 Hz** |
| 0,4 ← el que venía usando | 123 Hz |
| 0,5 | 126 Hz |
| 0,7 (con `similarity_boost` 0,5) | 130 Hz |
| **1,0** | **128 Hz — su voz real, clavada** |

**La regla: el registro se arregla con `stability`, no tocando el audio.** `remove_background_noise`
no cambió nada (127 Hz), así que el problema no era que el origen fuera sintético.

### ⛔ LO QUE HICE MAL ANTES, Y NO HAY QUE REPETIR

Primero intenté **estirarle el tono** con `rubberband`. **Está mal por dos razones y Martín lo
escuchó en un segundo** («me mandaste un video que suena como una ardilla»):

1. `rubberband=pitch=X` **mueve los formantes junto con el tono**, y eso es exactamente lo que hace
   la voz de ardilla. Conservar la voz pedía `formant=preserved`, pero aun así es un parche.
2. **ElevenLabs desaconseja explícitamente el procesamiento pesado**, y nombra el pitch shifting.

Y antes de eso probé **subirle el tono al ORIGEN** antes de convertir: tampoco sirve. Con el origen
llevado a 143 Hz la salida dio **120** —más grave todavía— y el estirado le metió silencios falsos
que partieron los bloques de habla. **El STS reconstruye el tono desde el modelo de la voz y
descarta el del origen**; del origen se queda con el ritmo, que es para lo que sirve.

⚠️ **Moraleja que vale más allá de la voz: cuando una salida sale corrida, primero se barre el
parámetro que la gobierna.** Procesar la salida es lo último, y casi siempre es señal de que no se
encontró el parámetro.

⚠️ **Y no hay un camino que evite el STS**: `lib/apimart-reglas.ts:73` ya lo dice — los modelos de
voz nativa «generan el habla Y los labios juntos: montar un audio encima de un video mudo NO
sincroniza nada». Y el catálogo de ApiMart, consultado en vivo el 8/11, **no tiene ningún modelo de
lipsync** que tome video + audio: de 319 modelos, los únicos con «face» son `seedance-2.0-face` y
`seedance-2.0-fast-face`, que son de referencia de cara, no de sincronizar un audio. Las
herramientas que sí lo hacen (sync lipsync-2, Kling lip-sync) están en Replicate y fal.ai, afuera.
