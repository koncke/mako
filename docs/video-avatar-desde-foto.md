# Un video hablado a partir de UNA foto, con la voz del dueño (medido el 8/11/2026)

Martín pidió, a partir de una foto suya y un video de 110 s para clonar la voz, un clip diciendo
«Che Walter, obvio que tus anuncios no van a funcionar si aún no usas MaKo». Esto es lo que se midió
haciéndolo. Sirve igual para **los 14 videos del lanzamiento**, que necesitan exactamente lo mismo.

## La cadena, y por qué tiene ese orden

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

Y en Replicate, para la cadena con voz propia (cuando tenga crédito): `lucataco/xtts-v2` para clonar
(acepta español y el audio de referencia directo) y **`bytedance/omni-human`**, que toma **foto +
audio** y devuelve el video hablando — es el que resuelve el paso 4 en una sola llamada.

⚠️ **La foto tiene que estar en una URL http(s):** `/v1/videos/generations` de ApiMart rechaza
`data:`. La ruta de imágenes sí las acepta, así que una prueba hecha con imágenes no prueba nada
sobre video.
