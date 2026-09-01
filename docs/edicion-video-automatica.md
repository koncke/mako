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

> *"3 notas de voz de Mauricio Bustos del 22/08/2026 en registro de anuncio, con CTA:
> incendio del viernes, todos dijeron que sí, junta de rendición de cuentas. 313 s, m4a
> 73 kbps mono 48 kHz, sin recompresión. Excluye 'Dejar de preguntar' (123 Hz, más grave)
> y la autorización legal. Autorización de uso de voz grabada por el titular el 19/08/2026."*

Voz vigente de Mauricio: **`dKQBE4K2Lu9KFMvS8sgP`** — «Mauricio Bustos (anuncios 22-08)».

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
