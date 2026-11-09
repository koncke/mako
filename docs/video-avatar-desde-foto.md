# Un video hablado a partir de UNA foto, con la voz del dueño (medido el 8/11/2026)

Martín pidió, a partir de una foto suya y un video de 110 s para clonar la voz, un clip diciendo
«Che Walter, obvio que tus anuncios no van a funcionar si aún no usas MaKo». Esto es lo que se midió
haciéndolo. Sirve igual para **los 14 videos del lanzamiento**, que necesitan exactamente lo mismo.

## ✅✅ LA RECETA FINAL, ENTREGADA Y COBRADA (8/11/2026) — US$ 0,81 en total

**Es la metodología Avatar Hype, y el orden lo exige Martín: IMAGEN → VIDEO → VOZ.** Lo de más abajo
en este documento es cómo lo hice MAL primero; esto es lo que salió.

| paso | modelo | US$ | salida |
|---|---|---:|---|
| 1. La imagen | `gemini-nano-banana-2.1-ext` (`MODELO_QUE_CONSERVA`) | **0,012** | la portada con la cara de Martín, todo lo demás intacto |
| 2. El video | **`Omni-Flash-Ext`**, `generation_type: 'frame'`, `aspect_ratio: '9:16'`, `duration: 10` | **0,40** | 720×1280 con voz del modelo y labios sincronizados |
| 3. La voz | `freevc24` de coqui-tts, **local y gratis** | 0 | el mismo audio con el timbre de Martín |

### ⛔ SÓLO OMNI PARA UNA CARA QUE HABLA

Regla de Martín, textual: **«TENÉS PROHIBIDO USAR OTRO MODELO QUE NO SEA OMNI… Es el único que podemos
usar, porque el resto NO sale bien.»** Lo dijo mirando un clip que hice con `wan2.5-preview` para
ahorrar: mueve la boca «como si» hablara pero **no sincroniza fonemas**, y se ve mal antes incluso de
tocarle la voz. Está escrito también en `lib/apimart-reglas.ts`, arriba del catálogo.

### ⚠️ Omni acepta SÓLO 16:9 o 9:16, y eso te come el título

Medido, con su propio mensaje: *«aspect_ratio=4:5 is unsupported; use 16:9 or 9:16»*. Y **sin pedirle
nada devuelve 16:9**: con una portada 4:5 de entrada, la primera corrida salió 1280×720 **cortada —
se perdió «best» y el encabezado entero**.

**La salida NO es cambiar de modelo** (eso está prohibido): se **acolcha la imagen a 9:16 antes**, con
el fondo desenfocado, y así no se pierde nada:

```
ffmpeg -i portada.jpg -filter_complex \
 "[0:v]scale=1080:-2[fg];[0:v]scale=1080:1920,boxblur=40:2[bg];[bg][fg]overlay=(W-w)/2:(H-h)/2" \
 portada-916.jpg
```

### Las otras trampas, todas medidas pagando CERO

ApiMart **devuelve la cuota cuando la tarea falla**, así que probar un parámetro no cuesta. Fallaron:

- `aspect_ratio` en un image-to-video de `wan2.5` → «ratio is determined by input image».
- `duration: 6` → «The requested option is not supported». Van **10**.
- `gemini-omni-1.2-flash-ext` para la imagen → **«did not pass content safety review»**. El que sí pasa
  es el medido, `gemini-nano-banana-2.1-ext`.
- ⚠️ **`Omni-Flash-Ext` es de VIDEO, no de imagen.** Mandarle 2 imágenes lo delata: «use
  generation_type=frame with 1 image for first-frame mode, 0 image for text-to-video, or 3+ for reference».
- El estado se consulta en **`GET /v1/tasks/<id>`**, no en `/v1/videos/generations/<id>`.
- La foto tiene que estar en una **URL pública de verdad**: `data:` lo rechaza y las de
  `api.replicate.com/v1/files` **piden credencial** (401). Se resolvió con el bucket público
  `image-editor` de nuestro propio storage (⚠️ el bucket `video-clips` **rechaza imágenes**:
  «mime type image/jpeg is not supported»).

### El reemplazo de voz — ElevenLabs STS es el bueno

**Lo que se usa: `POST /v1/speech-to-speech/<voice_id>` con `model_id=eleven_multilingual_sts_v2`.** Con la
clave de Martín (Starter, clona). Conservó el ritmo mejor que todo lo local: **10,031 s contra 10,027 s
del clip, 4 ms**. Su voice_id y el detalle, en la memoria `voz-elevenlabs-sts`.

⚠️ **La clave de ElevenLabs se copia mal muy fácil:** el panel muestra la ID al lado de la clave, y la
ID da «API key ID used as API key». **Las buenas empiezan con `sk_`**, y el valor se ve UNA sola vez.

### Los conversores locales, y por qué no alcanzaron

`pip install torch torchaudio coqui-tts six` — ⚠️ **`coqui-tts` no arrastra `torchaudio` ni `six`**, y
los dos fallan recién al importar. Cuatro conversores disponibles; **`freevc24` es el que se usa**:

⚠️ **`openvoice_v2` NO sirve para esto.** Fue el primero que probé y Martín: **«la voz no se parece en
nada»**. Transfiere muy poco timbre. `freevc24` sí.

**La prueba de que el ritmo no se tocó:** 10,000 s de salida contra 10,027 s del clip. Los labios
siguen donde estaban, que es TODA la razón por la que la voz va al final y no al principio.

## La cadena del 8/11 a la mañana, antes de que Martín corrigiera el orden

**El orden lo corrigió Martín, y yo lo tenía al revés.** Es la metodología de Avatar Hype:

1. **PRIMERO el clip**, con el modelo poniendo su propia voz. ApiMart, `wan2.5-preview`, foto + prompt
   con la frase entre comillas. **US$ 0,664** por 10 s, 124 s de espera. Salió 830×1108 vertical.
2. **DESPUÉS se reemplaza el timbre** sobre el audio que YA trae el clip (speech-to-speech), y por eso
   los labios no se desarman: el ritmo lo puso el video y la conversión no lo toca.
3. Remux con `-c:v copy`: la imagen no se recomprime.

⚠️ **Mi error, que casi mata el trabajo:** leí la nota de `lib/apimart-reglas.ts` («montar un audio
encima de un video mudo NO sincroniza nada») como si prohibiera esto, y armé la cadena generando la
voz primero. **No es lo mismo.** Esa nota habla de pegar audio NUEVO sobre un video mudo. Acá el audio
de salida es una conversión de timbre del audio ORIGINAL del clip: misma duración, mismas pausas.
**Medido: 10,0417 s contra 10,0540 s del original — 12 ms de diferencia.** Coincide con lo que ya
decía [[voz-elevenlabs-sts]] desde el 18/08: desfase mediano 0 ms sobre 100 s.

**Y con ese orden alcanza el saldo que hay**: no hace falta crédito en Replicate ni plan de ElevenLabs,
porque el reemplazo corre local y gratis.

### El reemplazo de voz — ElevenLabs STS es el bueno

**Lo que se usa: `POST /v1/speech-to-speech/<voice_id>` con `model_id=eleven_multilingual_sts_v2`.** Con la
clave de Martín (Starter, clona). Conservó el ritmo mejor que todo lo local: **10,031 s contra 10,027 s
del clip, 4 ms**. Su voice_id y el detalle, en la memoria `voz-elevenlabs-sts`.

⚠️ **La clave de ElevenLabs se copia mal muy fácil:** el panel muestra la ID al lado de la clave, y la
ID da «API key ID used as API key». **Las buenas empiezan con `sk_`**, y el valor se ve UNA sola vez.

### Los conversores locales, y por qué no alcanzaron

`pip install torch torchaudio coqui-tts six` (⚠️ `coqui-tts` **no arrastra** `torchaudio` ni `six`:
sin ellos tira `ImportError` y `ModuleNotFoundError` recién al importar). Trae cuatro conversores:
`freevc24`, `knnvc`, `openvoice_v1` y **`openvoice_v2`**, que es el que se usa — y es de los limpios.

```python
vc = TTS('voice_conversion_models/multilingual/multi-dataset/openvoice_v2').to(dev)
vc.voice_conversion_to_file(source_wav=<audio del clip>, target_wav=<voz de Martin>, file_path=<salida>)
```

⚠️ **El audio de referencia hay que normalizarlo antes** (ver abajo): el del teléfono vino a −36,6 dB.

### Las tres trampas de ApiMart, medidas pagando cero

Las tres fallaron **sin costo** — ApiMart devuelve la cuota cuando la tarea falla:

1. **No se le pasa `aspect_ratio`**: «image-to-video does not support `aspect_ratio`; ratio is
   determined by input image». Confirma lo que ya decía el catálogo: **la proporción la pone la foto**.
2. **La duración no es libre**: con `duration: 6` contestó «The requested option is not supported».
   Con **10** anduvo, que es con lo que el repo lo había medido el 7/11.
3. **La foto tiene que estar en una URL pública de verdad.** `data:` lo rechaza, y las de
   `api.replicate.com/v1/files` **piden credencial** (401), así que tampoco sirven. Se resolvió
   subiéndola al bucket público `image-editor` de nuestro propio storage, bajo `9/`.

⚠️ Y el estado se consulta en **`GET /v1/tasks/<id>`**, no en `/v1/videos/generations/<id>`.

## La cadena vieja (la que yo había escrito mal), y por qué tiene ese orden

1. **HEIC → JPG.** `ffmpeg -i foto.HEIC foto.jpg` funciona (ffmpeg 9.0 full está instalado). No hace
   falta nada de Apple.
2. **El audio de referencia, NORMALIZADO.** ⚠️ El video del teléfono vino con **media −36,6 dB y pico
   −15,4 dB**: clonar con eso da una voz apagada. Va
   `-af "loudnorm=I=-19:TP=-3:LRA=11,highpass=f=70"`, que lo dejó en −21,4 / −1,0 dB. **Medir el nivel
   antes de clonar es parte del trabajo, no una prolijidad.**
3. **Clonar la voz** y generar la línea → un mp3 con SU voz.
4. **Foto + ese audio → video hablando**, con un modelo que anime y sincronice los labios.

⚠️ **El orden no se puede invertir, y acá hay un error caro:** los modelos de video con voz nativa
(`wan2.5-preview`, `kling-v3-omni`, `kling-v4`) **generan el habla y los labios juntos**. Montarle
otro audio encima a un video ya hecho **no sincroniza nada** (está medido en
`lib/apimart-reglas.ts`). O sea: un clip hecho con voz del modelo **no es un paso hacia** el clip con
la voz propia — es un clip a tirar. Se elige antes, no después.

## ⛔ LO QUE LO FRENA HOY: las tres cuentas que clonan voz están sin pagar

| Servicio | Estado medido el 8/11 | Qué se puede hacer con ella |
|---|---|---|
| **ElevenLabs** | tier `payg`, **`can_use_instant_voice_cloning: false`** | TTS sí (9.917 caracteres libres), **clonar NO** |
| **fal.ai** | saldo **US$ 0,00** | nada |
| **Replicate** | cuenta válida (`hx-mkoncke`), **402 sin crédito** | nada |
| **ApiMart** | **US$ 1,73** de saldo | video sí, **clonar voz NO: no tiene modelo de clonado ni de lipsync** |

**El desbloqueo más barato es ElevenLabs:** el clonado instantáneo entra en el plan Starter. Es lo
mismo que necesitan los 14 videos del lanzamiento, así que se paga una vez y sirve para todos.

⚠️ La cuenta ya tuvo clonado antes: están guardadas «Johana» y «Mauricio Bustos (anuncios 22-08)»
(`dKQBE4K2Lu9KFMvS8sgP`). O sea que esto **era** posible y se cayó al bajar de plan.

## ⚠️⚠️ Y un riesgo de producción que apareció midiendo esto

**`APIMART_API_KEY` es la clave DE LA PLATAFORMA** (está en `IA_DE_UNA_CUENTA`, lib/ia-keys.ts:223):
con ese saldo genera video **todo cliente que genere**. Hoy quedan **US$ 1,73** de US$ 20. Cuando
llegue a cero, las generaciones de los clientes empiezan a fallar, y el freno que las cuida es el
medidor de MaKo Tokens, no la credencial. **Conviene recargarla antes de que la encuentre un
cliente.**

## Lo que ya está preparado

En el scratchpad de la sesión, listo para el paso 3 en cuanto haya una cuenta que clone:

- `voz-martin-norm.mp3` — los 110 s normalizados
- `ref-30s.mp3` — el recorte de 30 s que pide un clonador (ya subido a Replicate:
  `https://api.replicate.com/v1/files/ZDQ4NGRhNTktNjk3Ny00ZmQxLWIwNDktZGE1MzQyZDk4OWQ0.mp3`)
- `foto.jpg` — la HEIC convertida, 3024×4032 vertical

## Los modelos que sirven, con su precio medido

Para el paso 4, de `lib/apimart-reglas.ts` (medido el 7/11):

| Modelo | US$/s | 10 s | Voz nativa | Respeta la proporción de la foto |
|---|---:|---:|---|---|
| `MiniMax-Hailuo-2.3-Fast` | 0,0253 | **0,25** | no | sí |
| `wan2.5-preview` | 0,0664 | 0,66 | **sí** | sí |
| `kling-v4` | 0,1400 | 1,40 | **sí** | sí |

Y en Replicate, **`bytedance/omni-human`** toma **foto + audio** y devuelve el video hablando: resuelve
el paso 4 en una sola llamada.

## ⛔⛔ LA LICENCIA DECIDE ANTES QUE EL PRECIO, Y CASI ME LA COMO

La primera versión de este documento recomendaba `lucataco/xtts-v2` para clonar. **Está mal:**
XTTS-v2 es **CPML — no comercial, «y sus salidas»**, igual que F5-TTS (pesos CC-BY-NC). Un video de
venta hecho con eso no se puede usar. Lo salvó de casualidad que Replicate no tuviera crédito.

⚠️ **Que Replicate o fal hospeden un modelo NO limpia su licencia.** Está medido y escrito en
[hallazgos-ai-avatar.md](hallazgos-ai-avatar.md) → «Licencias: lo que muerde aunque el repo diga MIT».
**Antes de elegir un modelo de voz o de avatar, se lee esa sección.** No es trámite: ahí están los dos
que yo iba a usar.

**Y «replicar ElevenLabs» con `ref-voicestudio` tampoco sirve:** VoiceStudio es **AGPL-3.0** y su motor
por defecto (OmniVoice) tiene pesos **CC-BY-NC**. Está clonado para copiar el MÉTODO y su inventario de
licencias (`backend/config/model_licenses.json`), **no el código**. Sus binarios de `bin/` además están
en 0 bytes: no hay nada ejecutable ahí.

**Lo que SÍ está limpio para uso comercial** (relevado el 17/10, código y pesos):

- **Voz:** Chatterbox Multilingual (MIT, español), Qwen3-TTS (Apache), Kokoro, OpenVoice V2, GPT-SoVITS.
- **Avatar por audio:** InfiniteTalk, StableAvatar, EchoMimicV3, LongCat-Avatar, HuMo, Wan2.2-S2V.
- ⚠️ De los de avatar, **en 8 GB sólo StableAvatar tiene chance** (y sin medir). La PC de Martín tiene
  16 GB y hoy corre con ~1,4 GB libres.
- ApiMart **no revende ninguno de los limpios de voz**: no hay Chatterbox ni Qwen3-TTS en su catálogo.

**Por eso el camino más barato y limpio sigue siendo pagar ElevenLabs Starter:** es un servicio
comercial, la licencia de salida viene con el plan, y clona en el momento sin instalar nada.

⚠️ **La foto tiene que estar en una URL http(s):** `/v1/videos/generations` de ApiMart rechaza
`data:`. La ruta de imágenes sí las acepta, así que una prueba hecha con imágenes no prueba nada
sobre video.

## ✅✅ LO QUE FALTABA, VISTO EN FLOW EL 8/11: el avatar captura CARA Y VOZ juntas

Martín: «no me termina de convencer el clip que hiciste con la voz… debe haber alguna metodología que
no estemos utilizando». **La hay, y está adentro de Flow.**

En el selector de recursos de un proyecto, pestaña **Avatars**, dice textual: **«Your face, your
voice, your story»**. Graba un **video selfie** diciendo unas palabras y **captura el parecido y la
voz en el mismo paso**.

**Por qué esto es mejor que lo que veníamos haciendo, y no es una opinión:** nosotros generábamos el
clip con la voz del modelo y después CONVERTÍAMOS el timbre (ElevenLabs STS, freevc24, knnvc). Eso
parte de audio **sintético**, y convertir de sintético a una voz real tiene un techo que ningún
conversor rompe — está medido más arriba en este mismo documento. Con el avatar de Flow **no hay paso
de conversión**: el video se genera ya con la voz capturada.

⚠️ **Dos límites que avisa la propia pantalla:**
- Es **experimental** y «might take a few attempts».
- **La captura es SÓLO en inglés.** Las palabras de la captura van en inglés; eso no impide que el
  avatar después hable en español, pero el paso de captura no se puede hacer en otro idioma.

⚠️ **Lo tiene que grabar la persona**: necesita su cámara y su voz. No se puede automatizar ni
reemplazar con un video viejo subido.

### Lo demás que se vio en Flow el 8/11

- **«Voices» NO clona**: es un catálogo de voces sintéticas con nombre (Achernar, Achird, Algenib…),
  cada una con su descripción, más un campo libre para describir la interpretación. Sirve para una voz
  en off, no para la propia.
- El modelo de imagen de Flow es **🍌 Nano Banana 2.1**, el mismo que usamos por ApiMart
  (`MODELO_QUE_CONSERVA`). O sea que la imagen sale igual por los dos lados.
- **Omni 1.2 Flash** es de Flow, y de ahí viene el nombre que usa Martín. Su changelog menciona
  extensión de video con **referencias de imagen, personaje Y VOZ**.
- ⚠️ **La cuenta avisa que queda poco crédito de Flow.**
- ⚠️ **Subir archivos a Flow necesita el clic de la persona**: el `input[type=file]` no existe hasta
  que se toca el botón, y simular `drop` con un `DataTransfer` **no lo toma** (probado el 8/11 con las
  dos referencias ya en URLs públicas). Para una prueba con material propio, lo sube Martín.

## ⚠️⚠️ LA VOZ: ERA V3, Y ESTABA EN NUESTRO PROPIO CURSO (8/11/2026)

Martín rechazó cuatro versiones de la voz («la voz no se parece en nada», «se escucha robótico»,
«aún no me gusta»). La respuesta estaba en **AvatarHype**, el primer curso de `/conocimientos`
(`app/conocimientos/curso.ts`, con las clases transcriptas). Dice **textual**:

> **Voz — ElevenLabs**, 10.000 créditos gratis/mes. Con voz de biblioteca usás **Eleven Multilingual
> V2**; **con voz clonada por vos, V3**.

**El error era de MÉTODO, no de modelo ni de ajustes.** Yo venía haciendo **speech-to-speech** sobre
`eleven_multilingual_sts_v2`: tomaba el audio sintético del clip y le convertía el timbre. Eso tiene
dos problemas encima:

1. **V2 es el modelo de las voces de BIBLIOTECA.** Para una voz clonada va **`eleven_v3`**, que es el
   más expresivo y el que el curso prescribe.
2. **Convertir parte de audio sintético**, y eso tiene un techo que ningún conversor rompe (probados
   `openvoice_v2`, `freevc24`, `knnvc` y el propio STS con `similarity_boost` al máximo).

**Lo correcto es generar directo con TTS desde la voz clonada**, no convertir. Verificado el 8/11:
`POST /v1/text-to-speech/<voice_id>` con `model_id: 'eleven_v3'` responde 200 y devuelve el audio.

⚠️ **Y el JSON va por archivo o por script, nunca inline en bash:** el primer intento murió con
`invalid_unicode` porque la `ú` de «aún» se rompió en el shell. Mismo pariente que
[[heredoc-come-backslash]].

### El resto del stack que prescribe AvatarHype, textual

- **Imágenes:** Nano Banana Pro por **Kie (~9 céntimos)** o **APImart (~5 céntimos)** — APImart es
  casi la mitad. Siempre **9:16** y **2K, que cuesta lo mismo que 1K**. El producto va como imagen de
  referencia, y se abren varias pestañas en paralelo.
- **Video:** APImart con **Veo 3**, calidad **720**, **9:16**, en modo **primer y último frame**
  (subís la primera y la última imagen y él arma la transición). Duración **4 s**. Todo se guarda
  como P1, P2, P3… para no perderse.
- **Lipsync:** «lo resuelve el propio modelo de video o herramientas dedicadas».
- **Montaje:** CapCut.

⚠️ **Lo de Veo y los costos NO está verificado contra la clase original:** la propia transcripción
trae una nota del sistema aclarando que parte de eso es contexto del stack del curso y no un resumen
verificado de esa clase. **Lo de la voz sí está dicho directo.** Antes de apoyarse en los parámetros
de Veo, confirmarlos contra la clase.

## Cómo se cambia de escena SIN perder la cara: el editor y un cambio por vez (9/11/2026)

Lo dictó Martín después de que le mandara cuatro intentos y en ninguno se reconociera:
«lo mejor que puedes hacer es partir de la imagen original y simplemente pedirle que no tenga fondo…
y que la persona ya no esté sujetando la foto y que esté de brazos cruzados. Entonces ahí ya tienes
un avance. Una vez que ya te dé eso, le pides…».

**El error que esto corrige:** yo venía pidiendo la escena nueva como una GENERACIÓN, con la imagen
aprobada «de referencia». Generar vuelve a dibujar a la persona, y la persona vuelve a dibujarse
distinta. Encima la pedí de cuerpo entero: a ese tamaño la cara ocupa cuatro píxeles y el parecido
se pierde entero. Martín: «¿quién es esa persona?».

**Lo que funciona —probado hoy, dos pasos, 0 créditos:**

1. Se abre **la imagen aprobada en el editor** de Flow (se le hace clic a la tarjeta; la URL queda
   en `/project/<id>/edit/<imageId>`). La caja de abajo ya no dice «What do you want to create?»
   sino **«What do you want to change?»**: eso es lo que hay que ver antes de escribir nada.
2. **Un cambio por vez**, nombrando primero todo lo que NO cambia («same face, same features, same
   hair, same expression, same t-shirt») y después el cambio, chiquito y concreto.
   - Paso 1: brazos cruzados + fondo blanco liso. Salió la misma persona, idéntica.
   - Paso 2, sobre el resultado del paso 1: la luz (blanco quemado detrás, él a contraluz ~1,5
     diafragmas más oscuro, borde cálido en pelo y hombros, **y la cara legible**).

⚠️ **`Escape` en el editor NO cierra un menú: SALE del editor.** Lo apreté para cerrar el menú de
descarga, el editor se cerró, y el texto que escribí después cayó en la caja del PROYECTO —donde
«generar» habría vuelto a inventar a la persona, sin referencia ni imagen de base—. Para cerrar un
menú se hace clic en un lugar vacío. Si la caja dice «What do you want to **create**?», estás en el
lugar equivocado.

### ⚠️⚠️ EL PROMPT CORTO LE GANA AL PROMPT TÉCNICO, Y NO POR POCO (9/11/2026)

**Martín lo sacó él en un intento, con una frase, después de que yo quemara cuatro con párrafos.**
Su regla, textual: «el prompt tiene que ser **SIMPLE**, mientras más simple y humano, mejor te
entiende».

Yo le escribía la receta de un director de fotografía: «expuesto para la pared», «un diafragma y
medio más oscuro», «borde cálido en el pelo y los hombros», «la cara sigue legible», «NO es una
silueta». **Cada una de esas frases es una instrucción más que el modelo cumple literal**, y todas
juntas no reconstruyen la foto: reconstruyen un RETRATO DE ESTUDIO, con luz de pelo y relleno
frontal. Medido contra el fotograma del reel, mi resultado tenía esto:

| | el reel | el mío (prompt largo) |
|---|---:|---:|
| borde del pelo | 108 | **213** (casi quemado) |
| pelo (medio) | 49 | 36 |
| **cara** | **37** | **49** |
| borde del hombro | 176 | 89 |
| hombro (centro) | 25 | 12 |

**La prueba está en la cara.** En el reel la cara (37) es **más oscura que el pelo** (49): no le pega
nada de frente, está toda en sombra. En el mío la cara (49) quedó **más clara** que el pelo (36),
porque pedí «que la cara siga legible» y el modelo, obediente, le puso una luz. Lo mismo con el
«borde cálido en el pelo»: lo leyó como una lámpara de contra y la clavó a 213.

**Pedir el efecto, no la receta.** Nombrar el resultado en una frase («que esté a contraluz contra un
fondo blanco») trae el paquete entero —el contorno, la caída, el color— porque es UN concepto que el
modelo ya tiene. Enumerar las partes lo obliga a construirlo pieza por pieza, y cada pieza que
agregás es una oportunidad más de que arme otra cosa.

⚠️ **Y lo que se escribe en negativo se cumple al revés.** «NO es una silueta» metió relleno; «sin
sombra proyectada» antes había metido un fondo plano de recorte. Si no lo querés, no lo nombres.

### La segunda referencia SÍ sirve — pero sólo dentro del editor

En una GENERACIÓN, dos referencias compiten y gana el estilo: con el personaje + un fotograma de luz
salió una silueta negra. **En una EDICIÓN no pasa**, porque la imagen base está fija y la segunda
sólo aporta el estilo. Probado hoy: sobre el paso 1 ya limpio, con el fotograma del reel adjunto por
el `+` del editor y la consigna «copiá SÓLO la luz y la exposición, no cambies ni la persona ni la
pose ni el encuadre», salió el contraluz del reel con la cara intacta.

Lo dictó Martín: «pásale nuevamente en el paso 1 la referencia del chico de los pistachos, para que
entienda cómo lo tiene que hacer, pero pídele que el resto lo mantenga igual».

⚠️ **Dos veces se mandó algo a la papelera sin querer**, por hacerle clic a la barra de arriba del
editor con un menú viejo abierto (la papelera está pegada al botón de descargar). El aviso «1 item
moved to trash» trae **Undo** y lo devuelve entero — pero hay que verlo: desaparece solo. Antes de
hacer clic en esa barra, una captura.

⚠️ **La estética nunca va antes que el parecido.** Pedir que la toma lea «oscura» para copiar un
reel es pedir que la cara desaparezca; en el original de referencia el cuerpo se recorta contra el
blanco pero la cara se sigue leyendo. Primero la persona, después la luz, y siempre en pasos.

### Una toma que replica una referencia se MIRA AL LADO de la referencia antes de mandarla (9/11/2026)

Martín: «**te pido que lo compares con Josep siempre**. ¿Por qué te cuesta tanto?».

Le había mandado la toma de perfil sin ponerla al lado del fotograma. En cuanto las junté, la
diferencia saltaba en un segundo: en el reel las manos van **juntas, delante de la cara y sin
tocarla, con los codos abajo y los brazos recogidos**; en la mía los brazos estaban **estirados
hacia adelante**, como empujando una pared. Dos ediciones cortas y quedó («las dos manos pegadas a
la cara, codos abajo» → quedaron sobre la boca; «las manos no tocan la cara, quedan un poco
adelante, palmas hacia adelante» → esa era).

**La regla: antes de mandar, `hstack` de la referencia y la toma.** Un `ffmpeg -i ref -i toma
-filter_complex "[0]scale=400:716[a];[1]scale=400:716[b];[a][b]hstack=inputs=2"` cuesta un segundo
y ahorra la vuelta entera. Mirarlas de a una no sirve: el parecido se evalúa por comparación, no de
memoria.

⚠️ Y esto **no contradice** la regla del prompt corto: la comparación es para MIS ojos, para saber
qué pedir. Lo que se escribe sigue siendo una frase humana («las manos no tocan la cara»), nunca la
medición.

### Los créditos de video de Flow se terminaron (9/11/2026 ~04:00)

«You're out of Google Flow credits.» Las **imágenes siguen siendo gratis** —las ediciones de hoy
salieron después del cartel—, pero no sale ningún video más. Un clip de **3 s a 720p x1 cuesta 9
créditos** (contra 48 de 8 s x2: la duración y las variantes son casi todo el costo). Para animar
queda ApiMart con Omni, y el saldo medido el 8/11 era **US$ 0,26** — no alcanza para un clip de 5 s
(US$ 0,2795). **Hay que recargar.**

### Animar en Flow: los números y las dos trampas del panel (9/11/2026)

Las dos tomas de fondo blanco salieron **a la primera**, con la imagen aprobada como PRIMER FOTOGRAMA
y una frase corta. Lo que costó fue el panel, no el modelo.

| ajuste | lo que venía puesto | lo que hay que poner |
|---|---|---|
| modelo | **Veo 3.1 - Lite** | **Omni 1.2 Flash** (regla de Martín: sólo Omni) |
| modo de la imagen | **Ingredientes** | **Fotogramas** — «ingrediente» es una referencia de estilo; «fotograma» es el cuadro 0 |
| resolución | **360p** | **720p** |
| variantes | **x2** | x1 |

⚠️ **El default de resolución es 360p y por eso el precio engaña:** 8 s x1 a 360p decía **8 créditos**
y a 720p son **24**. Un «qué barato» es, casi siempre, un ajuste que no miraste.
⚠️ **Recargar la página BORRA el primer fotograma** (y puede resetear el panel): se vuelve a pegar y
se vuelve a revisar todo antes de generar.

**Lo que se pide, en una frase:** «La boca cerrada y quieta. Descruza los brazos muy despacio y los
vuelve a cruzar.» / «La boca cerrada y quieta. Mueve apenas los dedos de las manos.»

### ⚠️ Omni DEVUELVE PISTA DE AUDIO AUNQUE NADIE HABLE

Los dos clips vinieron con un `aac` adentro: **−42,5 dB** de media el primero y **−62,2** el segundo.
No es voz —es ambiente—, pero un clip que tiene que ir mudo **no se entrega con pista**: se saca con
`ffmpeg -an -c:v copy`, que además no recomprime el video. Medir el nivel antes es lo que distingue
«trae ambiente» de «se puso a hablar solo», y lo segundo ya pasó.

**El chequeo que se hizo antes de entregar** (la regla de Martín): duración y tamaño con `ffprobe`,
nivel de audio con `volumedetect`, y una tira de 5 fotogramas con `hstack` para ver el movimiento, la
boca y que la cara siga siendo la misma.

### El movimiento se pide por lo que SE QUEDA QUIETO, no por lo que se mueve (9/11/2026)

«Mueve apenas los dedos de las manos» le bastó para bajar el brazo entero; «descruza los brazos muy
despacio y los vuelve a cruzar» lo cumplió al pie de la letra y Martín no quería que los descruzara.
En las dos, el modelo se quedó con el VERBO y se olvidó del resto del cuerpo.

**Lo que funciona es nombrar primero lo que no se mueve**, en positivo y como estado:

| mal | bien |
|---|---|
| «Mueve apenas el dedo índice, muy despacio.» | «**El dedo queda levantado todo el tiempo y el brazo no baja.** Sólo un movimiento muy sutil del torso.» |
| «Descruza los brazos muy despacio y los vuelve a cruzar.» | «**Los brazos quedan cruzados todo el tiempo**; sólo respira y mueve apenas la cabeza.» |

Las dos versiones buenas salieron al primer intento. Es la misma regla del prompt corto, con el
matiz que faltaba: corto **no** es «decí sólo el movimiento» — el ancla es la parte quieta.

⚠️ **Y las generaciones se lanzan EN PARALELO** (Martín, 9/11): Flow acepta varias a la vez y ApiMart
también. Esperar a que una termine para empezar la siguiente es tiempo regalado — se encola todo lo
que ya tiene su imagen y su frase, y después se bajan y se chequean de a una.

## El reel de referencia, desarmado: qué copiar de «el chico de los pistachos» (9/11/2026)

El reel es `pistachos-video.mp4` (Josep / crema Tacho): **720×1280, 30,8 s, 16 tomas**. Es el molde de
los 14 videos del lanzamiento, así que acá queda medido y no hay que volver a desarmarlo.

⚠️ **Nuestra copia del archivo NO tiene pista de audio** (`ffprobe -select_streams a` no devuelve
nada). La transcripción que hay en `trans.json` vino de otra pasada. **La verdad de lo que dice son
los subtítulos quemados**, y leerlos arregló lo que la transcripción traía mal: no es «haber plantado
pistachos» sino **«Déjate de polvitos y batiditos. ¡Haber plantao pistachos!»**.

**La estructura, que es lo que se copia:**

| bloque | t | qué hace |
|---|---|---|
| DISPARO | 0–3 s | «Este es un mensaje para todos los ___ de pacotilla» — nombra al destinatario y lo pincha |
| CREDENCIAL | 3,5–8,5 s | nombre, los años, las manos en la materia prima |
| EL PRODUCTO COMO CONSECUENCIA | 9,5–12,5 s | «Para ahora crear ___» — no se presenta, se deduce |
| BENEFICIO DEL OTRO | 13–16,5 s | «Una fuente de ___ para todos aquellos que ___» |
| REMATE | 17–20,5 s | vuelve al insulto de la apertura y cierra el círculo |
| CIERRE MUDO | 20,5–30,8 s | **10 s sin voz**: insertos + dominio + dónde se compra |

- **Dos mundos alternados**: la nave real y el inserto sobre blanco quemado a contraluz. En la primera
  mitad nunca van dos seguidas del mismo mundo. **Los insertos blancos son los que estamos generando
  en Flow** —dedo arriba, brazos cruzados, perfil con las manos—: son el 50% del reel.
- **Los insertos de la primera mitad son flashes de 0,6–1,0 s**; los del final se estiran a 1,4–3,1 s,
  cuando ya no hay voz que seguir. Un inserto de 3 s en la apertura rompe el ritmo.
- **Una sola palabra por inserto**, roja, con serif, arriba. Sólo **tres** en toda la parte hablada
  (FLOJOS, JOSEP, PISTACHOS) y dos carteles al final. El resto de los insertos van mudos.
- Subtítulos de la parte hablada: blancos, centrados, **a media altura, no abajo**, 2–3 palabras.
- **El producto aparece recién a los 9,6 s**, un tercio adentro.

### Dos trampas del ffmpeg de esta PC, medidas desarmándolo

- ⚠️ **`drawtext` no corre**: «Fontconfig error: Cannot load default config file». Para poner el reloj
  en una grilla de contactos hay que resolverlo por otro lado (o contar las celdas: con `fps=1` y
  `tile=NxM`, la celda k es el segundo k).
- ⚠️ **`-pattern_type glob` no existe en este build**: «globbing is not supported by this libavformat
  build». Las tiras de fotogramas se arman con secuencia numerada (`-i t_%02d.jpg`), no con `t_*.jpg`.
- La receta que sirvió para sacar la estructura: cortes con
  `select='gt(scene,0.3)',showinfo`, un fotograma por toma con `-ss <medio>`, y para leer los
  subtítulos quemados una grilla de la banda recortada (`fps=2,crop=720:230:0:560,tile=4x16`).
