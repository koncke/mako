# Un video hablado a partir de UNA foto, con la voz del dueño (medido el 8/11/2026)

Martín pidió, a partir de una foto suya y un video de 110 s para clonar la voz, un clip diciendo
«Che Walter, obvio que tus anuncios no van a funcionar si aún no usas MaKo». Esto es lo que se midió
haciéndolo. Sirve igual para **los 14 videos del lanzamiento**, que necesitan exactamente lo mismo.

## ✅ LA CADENA QUE FUNCIONA (hecha de punta a punta el 8/11), y el orden importa

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

### El reemplazo de voz, local

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
